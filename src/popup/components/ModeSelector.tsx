import React from 'react';
import type { ExportMode } from '../../shared/contracts/export-job';

export interface ModeOption {
  id: ExportMode;
  label: string;
  badge?: string;
  description: string;
  icon: React.ReactNode;
}

export const EXPORT_MODES: ModeOption[] = [
  {
    id: 'viewport',
    label: 'Current Viewport',
    badge: 'Fast',
    description: 'Captures only the currently visible browser area',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    )
  },
  {
    id: 'full-page',
    label: 'Full Page',
    badge: 'Popular',
    description: 'Scrolls and stitches the complete scrollable layout',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
        <line x1="8" y1="6" x2="16" y2="6" />
        <line x1="8" y1="10" x2="16" y2="10" />
        <line x1="8" y1="14" x2="12" y2="14" />
      </svg>
    )
  },
  {
    id: 'select-element',
    label: 'Select Element',
    description: 'Click to select an individual card, section, or component',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 3l7 18 3-7 7-3L3 3z" />
      </svg>
    )
  },
  {
    id: 'selected-pages',
    label: 'Selected Pages',
    description: 'Batch export custom linked routes into separate frames',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    )
  },
  {
    id: 'odd-pages',
    label: 'Odd Pages',
    badge: 'Crawl',
    description: 'Batch process pagination sequences matching odd index pages',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" />
      </svg>
    )
  },
  {
    id: 'even-pages',
    label: 'Even Pages',
    badge: 'Crawl',
    description: 'Batch process pagination sequences matching even index pages',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="16" />
        <line x1="8" y1="12" x2="16" y2="12" />
      </svg>
    )
  },
  {
    id: 'entire-site',
    label: 'Entire Site',
    badge: 'Deep',
    description: 'Automatically discover and export reachable same-domain pages',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
    )
  }
];

export interface ModeSelectorProps {
  selectedMode: ExportMode;
  onSelectMode: (mode: ExportMode) => void;
  disabled?: boolean;
}

export const ModeSelector: React.FC<ModeSelectorProps> = ({
  selectedMode,
  onSelectMode,
  disabled = false
}) => {
  return (
    <div className="mode-selector-section">
      <div className="section-label-row">
        <label className="section-title" id="mode-selector-label">
          Export Mode
        </label>
        <span className="section-hint">Select capture target</span>
      </div>

      <div
        className="mode-grid"
        role="radiogroup"
        aria-labelledby="mode-selector-label"
      >
        {EXPORT_MODES.map((mode) => {
          const isSelected = selectedMode === mode.id;
          return (
            <button
              key={mode.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              disabled={disabled}
              className={`mode-card ${isSelected ? 'selected' : ''}`}
              onClick={() => onSelectMode(mode.id)}
            >
              <div className="mode-card-header">
                <div className="mode-icon-wrap" aria-hidden="true">
                  {mode.icon}
                </div>
                <div className="mode-label-wrap">
                  <span className="mode-name">{mode.label}</span>
                  {mode.badge && <span className="mode-badge">{mode.badge}</span>}
                </div>
              </div>
              <p className="mode-desc">{mode.description}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
};
