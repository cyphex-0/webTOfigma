import React from 'react';
import { getBrowserTargetName } from '../shared/browser/browser-api';

export const OptionsApp: React.FC = () => {
  const target = getBrowserTargetName();

  return (
    <div className="card">
      <h1>Web-to-Figma Exporter Settings</h1>
      <p>Target Browser: {target}</p>
      <p style={{ marginTop: '16px' }}>
        Settings interface baseline established. Options configuration will be expanded in Phase 4.
      </p>
    </div>
  );
};
