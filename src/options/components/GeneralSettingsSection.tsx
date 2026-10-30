import React from 'react';
import type { ExtensionSettings } from '../../shared/contracts/settings';
import { EXPORT_MODES } from '../../popup/components/ModeSelector';

export interface GeneralSettingsSectionProps {
  settings: ExtensionSettings;
  onUpdateSettings: (partial: Partial<ExtensionSettings>) => Promise<void>;
}

export const GeneralSettingsSection: React.FC<GeneralSettingsSectionProps> = ({
  settings,
  onUpdateSettings
}) => {
  return (
    <div className="options-card">
      <div className="card-header">
        <h2>General Preferences</h2>
        <p>Set extension startup behaviors, clipboard preferences, and system notifications.</p>
      </div>

      <div className="form-group" style={{ maxWidth: '320px' }}>
        <label htmlFor="default-mode-select">Default Export Mode</label>
        <select
          id="default-mode-select"
          className="form-select"
          value={settings.defaultMode}
          onChange={(e) => onUpdateSettings({ defaultMode: e.target.value })}
        >
          {EXPORT_MODES.map((mode) => (
            <option key={mode.id} value={mode.id}>
              {mode.label}
            </option>
          ))}
        </select>
        <span className="form-hint">Selected automatically when opening the extension popup.</span>
      </div>

      <div className="form-checkbox-row">
        <input
          type="checkbox"
          id="auto-copy-toggle"
          checked={settings.autoCopyClipboard}
          onChange={(e) => onUpdateSettings({ autoCopyClipboard: e.target.checked })}
        />
        <label htmlFor="auto-copy-toggle" className="checkbox-text">
          <strong>Auto-Copy to Clipboard on Complete</strong>
          <span>
            Attempts to copy immediately when capture finishes. (Note: Modern browsers may require an explicit user gesture if crawling took more than a few seconds).
          </span>
        </label>
      </div>

      <div className="form-checkbox-row">
        <input
          type="checkbox"
          id="notify-complete-toggle"
          checked={settings.notifyOnComplete}
          onChange={(e) => onUpdateSettings({ notifyOnComplete: e.target.checked })}
        />
        <label htmlFor="notify-complete-toggle" className="checkbox-text">
          <strong>Show Browser Completion Notification</strong>
          <span>Displays a desktop notification when long multi-page crawls finish.</span>
        </label>
      </div>
    </div>
  );
};
