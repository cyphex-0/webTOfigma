import React from 'react';
import type { CaptureProfile, ExtensionSettings } from '../../shared/contracts/settings';

export interface CaptureProfilesSectionProps {
  settings: ExtensionSettings;
  onUpdateSettings: (partial: Partial<ExtensionSettings>) => Promise<void>;
}

export const CaptureProfilesSection: React.FC<CaptureProfilesSectionProps> = ({
  settings,
  onUpdateSettings
}) => {
  const handleSelectActiveProfile = async (profileId: string) => {
    await onUpdateSettings({ activeProfileId: profileId });
  };

  const handleUpdateProfileProperty = async (
    profileId: string,
    key: keyof CaptureProfile,
    value: string | number | boolean
  ) => {
    const updatedProfiles = settings.profiles.map((p) => {
      if (p.id !== profileId) return p;
      return { ...p, [key]: value };
    });
    await onUpdateSettings({ profiles: updatedProfiles });
  };

  const activeProfile = settings.profiles.find((p) => p.id === settings.activeProfileId) ?? settings.profiles[0];

  return (
    <div className="options-card">
      <div className="card-header">
        <h2>Capture Profiles</h2>
        <p>Configure responsive viewport presets, scroll restrictions, and extraction budgets.</p>
      </div>

      <div className="profiles-grid" role="radiogroup" aria-label="Available Capture Profiles">
        {settings.profiles.map((profile) => {
          const isActive = profile.id === settings.activeProfileId;
          return (
            <div
              key={profile.id}
              role="radio"
              aria-checked={isActive}
              tabIndex={0}
              className={`profile-card ${isActive ? 'active' : ''}`}
              onClick={() => handleSelectActiveProfile(profile.id)}
              onKeyDown={(e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                  e.preventDefault();
                  void handleSelectActiveProfile(profile.id);
                }
              }}
            >
              <div className="profile-card-header">
                <span className="profile-title">{profile.name}</span>
                {isActive && <span className="active-pill">Active</span>}
              </div>
              <ul className="profile-details-list">
                <li>Viewport: {profile.viewportWidth} × {profile.viewportHeight} px</li>
                <li>Device Pixel Ratio: {profile.devicePixelRatio}x</li>
                <li>Full Page Max: {profile.fullPageScrollLimit.toLocaleString()} px</li>
                <li>Wait Strategy: {profile.waitStrategy}</li>
              </ul>
            </div>
          );
        })}
      </div>

      {activeProfile && (
        <div className="profile-edit-box" style={{ marginTop: '16px', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>
            Editing: {activeProfile.name}
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
            <div className="form-group">
              <label htmlFor="viewport-width-input">Viewport Width (px)</label>
              <input
                id="viewport-width-input"
                type="number"
                min="320"
                max="3840"
                className="form-input"
                value={activeProfile.viewportWidth}
                onChange={(e) =>
                  handleUpdateProfileProperty(
                    activeProfile.id,
                    'viewportWidth',
                    parseInt(e.target.value, 10) || 1440
                  )
                }
              />
            </div>

            <div className="form-group">
              <label htmlFor="scroll-limit-input">Full-Page Scroll Limit (px)</label>
              <input
                id="scroll-limit-input"
                type="number"
                min="1000"
                max="50000"
                step="1000"
                className="form-input"
                value={activeProfile.fullPageScrollLimit}
                onChange={(e) =>
                  handleUpdateProfileProperty(
                    activeProfile.id,
                    'fullPageScrollLimit',
                    parseInt(e.target.value, 10) || 15000
                  )
                }
              />
            </div>

            <div className="form-group">
              <label htmlFor="scroll-delay-input">Scroll Stitching Delay (ms)</label>
              <input
                id="scroll-delay-input"
                type="number"
                min="50"
                max="2000"
                step="50"
                className="form-input"
                value={activeProfile.scrollDelayMs}
                onChange={(e) =>
                  handleUpdateProfileProperty(
                    activeProfile.id,
                    'scrollDelayMs',
                    parseInt(e.target.value, 10) || 250
                  )
                }
              />
            </div>

            <div className="form-group">
              <label htmlFor="wait-strategy-select">Wait Strategy</label>
              <select
                id="wait-strategy-select"
                className="form-select"
                value={activeProfile.waitStrategy}
                onChange={(e) =>
                  handleUpdateProfileProperty(
                    activeProfile.id,
                    'waitStrategy',
                    e.target.value as 'load' | 'networkidle' | 'domcontentloaded'
                  )
                }
              >
                <option value="networkidle">networkidle (Recommended)</option>
                <option value="load">window.load</option>
                <option value="domcontentloaded">DOMContentLoaded</option>
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
