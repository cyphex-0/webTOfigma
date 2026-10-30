import React, { useState } from 'react';
import { browser, getBrowserTargetName } from '../shared/browser/browser-api';

export const App: React.FC = () => {
  const [pingResult, setPingResult] = useState<string | null>(null);
  const targetName = getBrowserTargetName();

  const handlePing = async () => {
    try {
      const response = await browser.runtime.sendMessage({ type: 'PING' });
      setPingResult(JSON.stringify(response));
    } catch (err: any) {
      setPingResult(`Error: ${err?.message || 'Failed to ping background'}`);
    }
  };

  const handleOpenOptions = () => {
    browser.runtime.openOptionsPage?.();
  };

  return (
    <div className="popup-container">
      <div className="header">
        <div className="title-area">
          <div className="logo-badge">W</div>
          <div className="title-text">
            <h1>Web-to-Figma</h1>
          </div>
        </div>
        <span className="target-badge">{targetName}</span>
      </div>

      <div className="status-card">
        <span className="status-title">Phase 0 — Baseline Foundation</span>
        <span className="status-desc">
          No capture implemented yet. Development baseline ready.
        </span>
      </div>

      <button className="ping-btn" onClick={handlePing}>
        Test Background Ping
      </button>

      {pingResult && <div className="ping-result">{pingResult}</div>}

      <div className="footer">
        <span>v0.1.0</span>
        <a onClick={handleOpenOptions}>Options</a>
      </div>
    </div>
  );
};
