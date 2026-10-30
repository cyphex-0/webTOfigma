import React from 'react';
import type { ExportPipelineStage } from '../../core/export/export-pipeline';

export interface ExportProgressProps {
  stage: ExportPipelineStage;
  currentStep: string;
  onCancel?: () => void;
}

const STAGE_STEPS: Array<{ key: ExportPipelineStage; label: string }> = [
  { key: 'capturing_dom', label: 'DOM Snapshot' },
  { key: 'validating_semantics', label: 'Semantics & Geometry' },
  { key: 'fetching_assets', label: 'Assets' },
  { key: 'analyzing_layout', label: 'Styles & Layout' },
  { key: 'building_scene', label: 'Scene Graph' },
  { key: 'ready_to_copy', label: 'Ready' }
];

export const ExportProgress: React.FC<ExportProgressProps> = ({
  stage,
  currentStep,
  onCancel
}) => {
  const currentIndex = STAGE_STEPS.findIndex((s) => s.key === stage);

  return (
    <div className="export-progress-panel" role="region" aria-label="Export Progress">
      <div className="stage-steps-list">
        {STAGE_STEPS.map((s, idx) => {
          const isDone = currentIndex > idx || stage === 'ready_to_copy';
          const isCurrent = s.key === stage;

          return (
            <div
              key={s.key}
              className={`stage-step-item ${isDone ? 'step-done' : ''} ${isCurrent ? 'step-active' : ''}`}
            >
              <div className="step-circle" aria-hidden="true">
                {isDone ? '✓' : idx + 1}
              </div>
              <span className="step-label">{s.label}</span>
            </div>
          );
        })}
      </div>

      <div className="step-detail-message">
        <span className="spinner-sm" aria-hidden="true" />
        <p className="current-step-label">{currentStep || 'Processing page...'}</p>
      </div>

      {onCancel && (
        <div className="progress-cancel-row">
          <button type="button" className="btn-cancel" onClick={onCancel}>
            Cancel Export
          </button>
        </div>
      )}
    </div>
  );
};
