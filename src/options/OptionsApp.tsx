import React, { useState, useEffect } from 'react';
import { getBrowserTargetName } from '../shared/browser/browser-api';
import { settingsStore } from '../core/settings/settings-store';
import type { ExtensionSettings } from '../shared/contracts/settings';
import { CaptureProfilesSection } from './components/CaptureProfilesSection';
import { GeneralSettingsSection } from './components/GeneralSettingsSection';
import { DomainOverridesSection } from './components/DomainOverridesSection';
import { ResetSection } from './components/ResetSection';
import './options.css';

type OptionsTab = 'profiles' | 'general' | 'domains' | 'reset';

export const OptionsApp: React.FC = () => {
  const browserTarget = getBrowserTargetName();
  const [settings, setSettings] = useState<ExtensionSettings | null>(null);
  const [activeTab, setActiveTab] = useState<OptionsTab>('profiles');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      const data = await settingsStore.load();
      if (isMounted) {
        setSettings(data);
      }
    }
    void load();

    const unsubscribe = settingsStore.subscribe((updated) => {
      setSettings(updated);
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2000);
  };

  const handleUpdateSettings = async (partial: Partial<ExtensionSettings>) => {
    const updated = await settingsStore.update(partial);
    setSettings(updated);
    showToast('Settings saved');
  };

  const handleResetDefaults = async () => {
    const reset = await settingsStore.resetToDefaults();
    setSettings(reset);
    showToast('Settings reset to defaults');
  };

  if (!settings) {
    return (
      <div className="options-layout">
        <p>Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="options-layout">
      <header className="options-header">
        <div className="options-brand">
          <div className="brand-logo" aria-hidden="true">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <rect width="24" height="24" rx="6" fill="#2563EB" />
              <path d="M12 4L6 8L12 12L18 8L12 4Z" stroke="white" strokeWidth="2" strokeLinejoin="round" />
              <path d="M6 12L12 16L18 12" stroke="white" strokeWidth="2" strokeLinejoin="round" />
              <path d="M6 16L12 20L18 16" stroke="white" strokeWidth="2" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="options-title-wrap">
            <h1>Web to Figma Preferences</h1>
            <p>Control extraction parameters, viewport profiles, and security boundaries</p>
          </div>
        </div>
        <span className="options-target-badge">{browserTarget} Extension</span>
      </header>

      <nav className="options-nav" role="tablist" aria-label="Preferences Sections">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'profiles'}
          className={`nav-tab-btn ${activeTab === 'profiles' ? 'active' : ''}`}
          onClick={() => setActiveTab('profiles')}
        >
          Capture Profiles
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'general'}
          className={`nav-tab-btn ${activeTab === 'general' ? 'active' : ''}`}
          onClick={() => setActiveTab('general')}
        >
          General
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'domains'}
          className={`nav-tab-btn ${activeTab === 'domains' ? 'active' : ''}`}
          onClick={() => setActiveTab('domains')}
        >
          Domain Overrides
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'reset'}
          className={`nav-tab-btn ${activeTab === 'reset' ? 'active' : ''}`}
          onClick={() => setActiveTab('reset')}
        >
          Reset
        </button>
      </nav>

      <main role="tabpanel">
        {activeTab === 'profiles' && (
          <CaptureProfilesSection
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
          />
        )}
        {activeTab === 'general' && (
          <GeneralSettingsSection
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
          />
        )}
        {activeTab === 'domains' && (
          <DomainOverridesSection
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
          />
        )}
        {activeTab === 'reset' && (
          <ResetSection
            onResetDefaults={handleResetDefaults}
          />
        )}
      </main>

      {toastMessage && (
        <div className="save-toast" role="status">
          {toastMessage}
        </div>
      )}
    </div>
  );
};
