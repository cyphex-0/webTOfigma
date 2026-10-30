import React, { useState } from 'react';
import type { ExtensionSettings, DomainOverride } from '../../shared/contracts/settings';

export interface DomainOverridesSectionProps {
  settings: ExtensionSettings;
  onUpdateSettings: (partial: Partial<ExtensionSettings>) => Promise<void>;
}

export const DomainOverridesSection: React.FC<DomainOverridesSectionProps> = ({
  settings,
  onUpdateSettings
}) => {
  const [newDomain, setNewDomain] = useState<string>('');
  const [minibarEnabled, setMinibarEnabled] = useState<boolean>(true);
  const [maxPages, setMaxPages] = useState<number>(5);
  const [fontFallback, setFontFallback] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);

  const handleAddRule = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanDomain = newDomain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (!cleanDomain || cleanDomain.length < 3) {
      setFormError('Please enter a valid domain name (e.g. github.com)');
      return;
    }

    const updatedOverrides: Record<string, DomainOverride> = {
      ...settings.domainOverrides,
      [cleanDomain]: {
        domain: cleanDomain,
        minibarEnabled,
        maxPages: maxPages > 0 ? maxPages : undefined,
        customFontFallback: fontFallback.trim() || undefined
      }
    };

    await onUpdateSettings({ domainOverrides: updatedOverrides });
    setNewDomain('');
    setFontFallback('');
  };

  const handleRemoveRule = async (domain: string) => {
    const updated = { ...settings.domainOverrides };
    delete updated[domain];
    await onUpdateSettings({ domainOverrides: updated });
  };

  const overrideList = Object.values(settings.domainOverrides);

  return (
    <div className="options-card">
      <div className="card-header">
        <h2>Per-Domain Overrides</h2>
        <p>Define site-specific capture boundaries, font fallback substitutions, and minibar behavior.</p>
      </div>

      <form className="add-rule-form" onSubmit={handleAddRule}>
        <div className="form-group" style={{ minWidth: '180px' }}>
          <label htmlFor="rule-domain-input">Domain</label>
          <input
            id="rule-domain-input"
            type="text"
            className="form-input"
            placeholder="e.g. github.com"
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
          />
        </div>

        <div className="form-group" style={{ width: '100px' }}>
          <label htmlFor="rule-max-pages">Max Pages</label>
          <input
            id="rule-max-pages"
            type="number"
            min="1"
            max="100"
            className="form-input"
            value={maxPages}
            onChange={(e) => setMaxPages(parseInt(e.target.value, 10) || 5)}
          />
        </div>

        <div className="form-group" style={{ minWidth: '150px' }}>
          <label htmlFor="rule-font-input">Font Fallback</label>
          <input
            id="rule-font-input"
            type="text"
            className="form-input"
            placeholder="Inter, Roboto"
            value={fontFallback}
            onChange={(e) => setFontFallback(e.target.value)}
          />
        </div>

        <div className="form-checkbox-row" style={{ paddingBottom: '8px' }}>
          <input
            type="checkbox"
            id="rule-minibar-toggle"
            checked={minibarEnabled}
            onChange={(e) => setMinibarEnabled(e.target.checked)}
          />
          <label htmlFor="rule-minibar-toggle">Allow Minibar</label>
        </div>

        <button type="submit" className="btn-add-rule">
          Add Override
        </button>
      </form>

      {formError && (
        <div className="error-banner" style={{ marginTop: '8px' }}>
          <span>{formError}</span>
        </div>
      )}

      <div style={{ marginTop: '16px' }}>
        {overrideList.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', fontStyle: 'italic' }}>
            No domain overrides configured. Global settings will apply to all sites.
          </p>
        ) : (
          <table className="overrides-table">
            <thead>
              <tr>
                <th>Domain</th>
                <th>Minibar</th>
                <th>Max Pages</th>
                <th>Font Fallback</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {overrideList.map((override) => (
                <tr key={override.domain}>
                  <td><strong>{override.domain}</strong></td>
                  <td>{override.minibarEnabled ? 'Enabled' : 'Disabled'}</td>
                  <td>{override.maxPages ?? 'Default'}</td>
                  <td>{override.customFontFallback ?? 'None'}</td>
                  <td>
                    <button
                      type="button"
                      className="btn-remove-rule"
                      onClick={() => handleRemoveRule(override.domain)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
