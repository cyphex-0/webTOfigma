import React from 'react';
import { PRESET_FILTERS } from '../../core/crawler/route-filter';

export interface RouteFiltersProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  activePresetIds: string[];
  onTogglePreset: (presetId: string) => void;
  customRegexPattern: string;
  onRegexChange: (pattern: string) => void;
  regexError?: string | undefined;
  excludeDestructive: boolean;
  onToggleExcludeDestructive: (val: boolean) => void;
  pageCap: number;
  onPageCapChange: (cap: number) => void;
}

export const RouteFilters: React.FC<RouteFiltersProps> = ({
  searchQuery,
  onSearchChange,
  activePresetIds,
  onTogglePreset,
  customRegexPattern,
  onRegexChange,
  regexError,
  excludeDestructive,
  onToggleExcludeDestructive,
  pageCap,
  onPageCapChange
}) => {
  return (
    <div className="route-filters" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {/* Search Input */}
      <div>
        <input
          type="text"
          placeholder="Filter routes by path or title..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          style={{
            width: '100%',
            padding: '4px 8px',
            fontSize: '12px',
            borderRadius: '4px',
            border: '1px solid #d1d5db',
            boxSizing: 'border-box'
          }}
        />
      </div>

      {/* Preset Chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
        <span style={{ fontSize: '11px', color: '#6b7280', marginRight: '2px' }}>Presets:</span>
        {PRESET_FILTERS.map((preset) => {
          const isActive = activePresetIds.includes(preset.id);
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onTogglePreset(preset.id)}
              style={{
                fontSize: '10px',
                padding: '2px 6px',
                borderRadius: '12px',
                border: '1px solid',
                borderColor: isActive ? '#2563eb' : '#d1d5db',
                backgroundColor: isActive ? '#eff6ff' : '#ffffff',
                color: isActive ? '#1d4ed8' : '#4b5563',
                cursor: 'pointer',
                fontWeight: isActive ? 600 : 400
              }}
            >
              {preset.label}
            </button>
          );
        })}
      </div>

      {/* Custom Regex Input & Error Callout */}
      <div>
        <input
          type="text"
          placeholder="Custom regex filter (e.g. ^/blog/.*)..."
          value={customRegexPattern}
          onChange={(e) => onRegexChange(e.target.value)}
          style={{
            width: '100%',
            padding: '3px 8px',
            fontSize: '11px',
            fontFamily: 'monospace',
            borderRadius: '4px',
            border: `1px solid ${regexError ? '#ef4444' : '#d1d5db'}`,
            boxSizing: 'border-box'
          }}
        />
        {regexError && (
          <div
            data-testid="regex-error-message"
            style={{ fontSize: '10px', color: '#b91c1c', marginTop: '2px' }}
          >
            {regexError}
          </div>
        )}
      </div>

      {/* Destructive Guard & Page Cap Row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#374151', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={excludeDestructive}
            onChange={(e) => onToggleExcludeDestructive(e.target.checked)}
          />
          Exclude destructive (/logout, /delete)
        </label>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <label htmlFor="page-cap-select" style={{ fontSize: '11px', color: '#6b7280' }}>
            Page Cap:
          </label>
          <select
            id="page-cap-select"
            value={[1, 5, 10, 25, 50, 100].includes(pageCap) ? String(pageCap) : 'custom'}
            onChange={(e) => {
              if (e.target.value !== 'custom') {
                onPageCapChange(parseInt(e.target.value, 10));
              }
            }}
            style={{
              fontSize: '11px',
              padding: '2px 4px',
              borderRadius: '4px',
              border: '1px solid #d1d5db',
              backgroundColor: '#fff'
            }}
          >
            <option value="1">1</option>
            <option value="5">5</option>
            <option value="10">10</option>
            <option value="25">25</option>
            <option value="50">50</option>
            <option value="100">100</option>
            <option value="custom">Custom</option>
          </select>
          {![1, 5, 10, 25, 50, 100].includes(pageCap) && (
            <input
              type="number"
              aria-label="Custom page cap"
              min={1}
              max={1000}
              value={pageCap}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val) && val > 0) {
                  onPageCapChange(val);
                }
              }}
              style={{ width: '45px', fontSize: '11px', padding: '1px 3px' }}
            />
          )}
        </div>
      </div>
    </div>
  );
};
