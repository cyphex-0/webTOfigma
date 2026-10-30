import React, { useState, useEffect } from 'react';
import type { JobRecord } from '../../shared/contracts/messages';

export interface JobProgressViewProps {
  job: JobRecord;
  onCancelJob: () => void;
}

export const JobProgressView: React.FC<JobProgressViewProps> = ({ job, onCancelJob }) => {
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [showWarnings, setShowWarnings] = useState<boolean>(false);

  useEffect(() => {
    const startTime = job.createdAt;
    const updateElapsed = () => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startTime) / 1000)));
    };
    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);
    return () => clearInterval(interval);
  }, [job.createdAt]);

  const formatTime = (secs: number): string => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const getPhaseTitle = (): string => {
    switch (job.state) {
      case 'injecting':
        return 'Injecting DOM Extractor...';
      case 'capturing':
        return 'Capturing Rendered Elements...';
      case 'processing':
        return 'Packaging Figma Scene...';
      default:
        return 'Export in Progress...';
    }
  };

  return (
    <div className="job-progress-view" role="status" aria-live="polite">
      <div className="progress-header">
        <div className="progress-title-wrap">
          <span className="spinner-sm" aria-hidden="true" />
          <h2 className="progress-phase-title">{getPhaseTitle()}</h2>
        </div>
        <span className="progress-timer">{formatTime(elapsedSeconds)}</span>
      </div>

      <div className="progress-bar-container">
        <div
          className="progress-bar-fill"
          style={{ width: `${Math.min(100, Math.max(5, job.progressPercent))}%` }}
          role="progressbar"
          aria-valuenow={job.progressPercent}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>

      <div className="progress-stats-row">
        <span className="current-step-text" title={job.currentStep}>
          {job.currentStep || 'Analyzing visual tree...'}
        </span>
        <span className="percentage-text">{job.progressPercent}%</span>
      </div>

      {typeof job.nodeCount === 'number' && (
        <div className="progress-counter-badge">
          <span>Nodes Extracted: <strong>{job.nodeCount.toLocaleString()}</strong></span>
        </div>
      )}

      {job.warnings && job.warnings.length > 0 && (
        <div className="warnings-section">
          <button
            type="button"
            className="warnings-toggle-btn"
            onClick={() => setShowWarnings((prev) => !prev)}
            aria-expanded={showWarnings}
          >
            <span>{job.warnings.length} extraction warnings</span>
            <span>{showWarnings ? '▲' : '▼'}</span>
          </button>
          {showWarnings && (
            <ul className="warnings-list">
              {job.warnings.map((w, i) => (
                <li key={i} className="warning-item">
                  {w}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="progress-actions">
        <button
          type="button"
          className="btn-cancel-active-job"
          onClick={onCancelJob}
        >
          Cancel Export
        </button>
      </div>
    </div>
  );
};
