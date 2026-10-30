import React from 'react';
import type { ExportMode } from '../../shared/contracts/export-job';

export interface ActionControlsProps {
  selectedMode: ExportMode;
  isInjectable: boolean;
  isJobRunning: boolean;
  isLoading: boolean;
  onStartExport: () => void;
  onCancelJob?: () => void;
  disabledReason?: string | undefined;
}

export const ActionControls: React.FC<ActionControlsProps> = ({
  selectedMode,
  isInjectable,
  isJobRunning,
  isLoading,
  onStartExport,
  onCancelJob,
  disabledReason
}) => {
  const isButtonDisabled = !isInjectable || isJobRunning || isLoading;

  const getButtonLabel = (): string => {
    if (isLoading) return 'Initializing...';
    if (isJobRunning) return 'Exporting...';
    switch (selectedMode) {
      case 'viewport':
        return 'Capture Viewport to Figma';
      case 'full-page':
        return 'Export Full Page to Figma';
      case 'select-element':
        return 'Activate Element Picker';
      case 'selected-pages':
        return 'Export Selected Pages';
      case 'odd-pages':
        return 'Export Odd Pages';
      case 'even-pages':
        return 'Export Even Pages';
      case 'entire-site':
        return 'Export Entire Site';
      default:
        return 'Export to Figma';
    }
  };

  return (
    <div className="action-controls-section">
      <div className="primary-action-wrap">
        <button
          type="button"
          className="btn-primary-export"
          disabled={isButtonDisabled}
          onClick={onStartExport}
          aria-busy={isLoading || isJobRunning}
          title={isButtonDisabled ? disabledReason ?? 'Export unavailable' : undefined}
        >
          {(isLoading || isJobRunning) && (
            <span className="spinner-sm" aria-hidden="true" />
          )}
          <span className="btn-text">{getButtonLabel()}</span>
        </button>

        {isJobRunning && onCancelJob && (
          <button
            type="button"
            className="btn-cancel-job"
            onClick={onCancelJob}
            title="Cancel active export job"
          >
            Cancel
          </button>
        )}
      </div>

      {isButtonDisabled && disabledReason && (
        <p className="action-disabled-hint" role="status">
          {disabledReason}
        </p>
      )}
    </div>
  );
};
