import React from 'react';
import { browser } from '../../shared/browser/browser-api';
import type { CaptureProfile } from '../../shared/contracts/settings';

export interface ProfileBadgeProps {
  profile: CaptureProfile | null;
}

export const ProfileBadge: React.FC<ProfileBadgeProps> = ({ profile }) => {
  const handleOpenSettings = async () => {
    try {
      if (typeof browser !== 'undefined' && browser.runtime?.openOptionsPage) {
        await browser.runtime.openOptionsPage();
      }
    } catch (err) {
      console.error('[WebToFigma] Failed to open options page:', err);
    }
  };

  if (!profile) return null;

  return (
    <div className="profile-badge-row">
      <div className="profile-info" title={`${profile.viewportWidth}x${profile.viewportHeight} @${profile.devicePixelRatio}x DPR`}>
        <span className="profile-label">Profile:</span>
        <span className="profile-name">{profile.name}</span>
        <span className="profile-dims">
          ({profile.viewportWidth}px · {profile.devicePixelRatio}x DPR)
        </span>
      </div>
      <button
        type="button"
        className="profile-edit-btn"
        onClick={handleOpenSettings}
        title="Configure capture profiles in Settings"
      >
        Edit
      </button>
    </div>
  );
};
