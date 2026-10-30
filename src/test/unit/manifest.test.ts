import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Manifest Templates', () => {
  const rootDir = path.resolve(__dirname, '../../..');

  it('validates Chromium manifest template', () => {
    const filePath = path.join(rootDir, 'manifests/manifest.chromium.json');
    expect(fs.existsSync(filePath)).toBe(true);

    const manifest = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.name).toBe('Web-to-Figma Exporter');
    expect(manifest.background.service_worker).toBe('background.js');
    expect(manifest.background.type).toBe('module');
    expect(manifest.permissions).toContain('activeTab');
    expect(manifest.permissions).toContain('storage');
    // Ensure no unapproved broad permissions exist
    expect(manifest.permissions).not.toContain('<all_urls>');
    expect(manifest.permissions).not.toContain('cookies');
    expect(manifest.permissions).not.toContain('webRequest');
  });

  it('validates Firefox manifest template', () => {
    const filePath = path.join(rootDir, 'manifests/manifest.firefox.json');
    expect(fs.existsSync(filePath)).toBe(true);

    const manifest = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.name).toBe('Web-to-Figma Exporter');
    expect(manifest.background.scripts).toEqual(['background.js']);
    expect(manifest.browser_specific_settings.gecko.id).toBe('web-to-figma-exporter@local');
    expect(manifest.permissions).toContain('activeTab');
    expect(manifest.permissions).toContain('storage');
    expect(manifest.permissions).not.toContain('<all_urls>');
  });
});
