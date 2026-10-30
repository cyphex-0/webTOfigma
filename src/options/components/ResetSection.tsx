import React, { useState } from 'react';

export interface ResetSectionProps {
  onResetDefaults: () => Promise<void>;
}

export const ResetSection: React.FC<ResetSectionProps> = ({ onResetDefaults }) => {
  const [confirming, setConfirming] = useState<boolean>(false);
  const [isResetting, setIsResetting] = useState<boolean>(false);

  const handleConfirm = async () => {
    setIsResetting(true);
    try {
      await onResetDefaults();
      setConfirming(false);
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="options-card">
      <div className="card-header">
        <h2>Reset All Settings</h2>
        <p>Restore extension preferences, capture profiles, and per-domain rules back to conservative defaults.</p>
      </div>

      <div className="reset-warning-box">
        <strong>Caution: Destructive Action</strong>
        <p style={{ marginTop: '4px' }}>
          This will wipe all custom viewport profiles and per-domain overrides, reverting the extension to factory defaults.
        </p>
      </div>

      {!confirming ? (
        <button
          type="button"
          className="btn-danger-reset"
          onClick={() => setConfirming(true)}
        >
          Reset to Factory Defaults
        </button>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            className="btn-danger-reset"
            onClick={handleConfirm}
            disabled={isResetting}
          >
            {isResetting ? 'Resetting...' : 'Yes, Confirm Reset'}
          </button>
          <button
            type="button"
            className="btn-remove-rule"
            style={{ color: 'var(--text-secondary)' }}
            onClick={() => setConfirming(false)}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
};
