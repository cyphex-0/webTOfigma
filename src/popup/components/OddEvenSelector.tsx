import React from 'react';
import { RouteNumberingMode } from '../../core/crawler/route-order';

export interface OddEvenSelectorProps {
  mode: RouteNumberingMode;
  onModeChange: (mode: RouteNumberingMode) => void;
  onSelectOdd: () => void;
  onSelectEven: () => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onInvert: () => void;
  selectionSummary?: string | undefined;
  totalSelected: number;
  totalRoutes: number;
}

export const OddEvenSelector: React.FC<OddEvenSelectorProps> = ({
  mode,
  onModeChange,
  onSelectOdd,
  onSelectEven,
  onSelectAll,
  onDeselectAll,
  onInvert,
  selectionSummary,
  totalSelected,
  totalRoutes
}) => {
  return (
    <div className="odd-even-selector" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <label htmlFor="numbering-mode-select" style={{ fontSize: '11px', color: '#6b7280', fontWeight: 500 }}>
            Order Mode:
          </label>
          <select
            id="numbering-mode-select"
            value={mode}
            onChange={(e) => onModeChange(e.target.value as RouteNumberingMode)}
            style={{
              fontSize: '11px',
              padding: '2px 6px',
              borderRadius: '4px',
              border: '1px solid #d1d5db',
              backgroundColor: '#fff'
            }}
          >
            <option value="discovery-order">Discovery Order</option>
            <option value="pagination-number">Pagination Number</option>
            <option value="manual-order">Manual Order</option>
          </select>
        </div>

        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            type="button"
            onClick={onSelectOdd}
            title={`Select odd items according to ${mode}`}
            style={{
              fontSize: '11px',
              padding: '3px 8px',
              borderRadius: '4px',
              border: '1px solid #d1d5db',
              backgroundColor: '#f9fafb',
              cursor: 'pointer'
            }}
          >
            Odd
          </button>
          <button
            type="button"
            onClick={onSelectEven}
            title={`Select even items according to ${mode}`}
            style={{
              fontSize: '11px',
              padding: '3px 8px',
              borderRadius: '4px',
              border: '1px solid #d1d5db',
              backgroundColor: '#f9fafb',
              cursor: 'pointer'
            }}
          >
            Even
          </button>
          <button
            type="button"
            onClick={onInvert}
            title="Invert current route selection"
            style={{
              fontSize: '11px',
              padding: '3px 8px',
              borderRadius: '4px',
              border: '1px solid #d1d5db',
              backgroundColor: '#f9fafb',
              cursor: 'pointer'
            }}
          >
            Invert
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            type="button"
            onClick={onSelectAll}
            style={{
              fontSize: '11px',
              color: '#2563eb',
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              textDecoration: 'underline'
            }}
          >
            Select All
          </button>
          <span style={{ fontSize: '11px', color: '#9ca3af' }}>|</span>
          <button
            type="button"
            onClick={onDeselectAll}
            style={{
              fontSize: '11px',
              color: '#6b7280',
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              textDecoration: 'underline'
            }}
          >
            Deselect All
          </button>
        </div>

        <span
          data-testid="selection-summary-badge"
          style={{
            fontSize: '11px',
            color: '#374151',
            fontWeight: 500,
            backgroundColor: '#f3f4f6',
            padding: '2px 8px',
            borderRadius: '9999px'
          }}
        >
          {selectionSummary || `${totalSelected} of ${totalRoutes} selected`}
        </span>
      </div>
    </div>
  );
};
