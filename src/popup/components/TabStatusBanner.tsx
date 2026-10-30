import React from 'react';
import type { ActiveTabContext } from '../../shared/contracts/messages';

export interface TabStatusBannerProps {
  activeTab: ActiveTabContext | null;
  loading: boolean;
}

export const TabStatusBanner: React.FC<TabStatusBannerProps> = ({
  activeTab,
  loading
}) => {
  if (loading) {
    return (
      <div className="tab-status-banner loading" role="status" aria-live="polite">
        <span className="spinner-sm" aria-hidden="true" />
        <span>Inspecting active tab...</span>
      </div>
    );
  }

  if (!activeTab) {
    return (
      <div className="tab-status-banner warning" role="alert">
        <svg className="banner-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <div className="banner-body">
          <strong>No Active Tab Detected</strong>
          <p>Please open a browser tab to export layout into Figma.</p>
        </div>
      </div>
    );
  }

  if (!activeTab.isInjectable) {
    return (
      <div className="tab-status-banner restricted" role="alert">
        <svg className="banner-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <div className="banner-body">
          <strong>Restricted Page</strong>
          <p>
            Browser security prohibits script injection on internal pages (<code>chrome://</code>, <code>about:</code>), web extension stores, and local PDF files.
          </p>
          <span className="banner-tip">Tip: Switch to an ordinary HTTP or HTTPS webpage to export.</span>
        </div>
      </div>
    );
  }

  return null;
};
