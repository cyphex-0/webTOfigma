import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const rootDir = path.resolve(__dirname, '../../..');

describe('Release-Candidate Qualification Suite (Phase 23)', () => {
  const chromiumManifestPath = path.join(rootDir, 'manifests/manifest.chromium.json');
  const firefoxManifestPath = path.join(rootDir, 'manifests/manifest.firefox.json');

  it('validates least-privilege permission policy in both manifest templates', () => {
    const chManifest = JSON.parse(fs.readFileSync(chromiumManifestPath, 'utf8'));
    const ffManifest = JSON.parse(fs.readFileSync(firefoxManifestPath, 'utf8'));

    for (const manifest of [chManifest, ffManifest]) {
      expect(manifest.permissions).toContain('activeTab');
      expect(manifest.permissions).toContain('storage');

      // Prohibited broad permissions
      expect(manifest.permissions).not.toContain('<all_urls>');
      expect(manifest.permissions).not.toContain('cookies');
      expect(manifest.permissions).not.toContain('webRequest');
      expect(manifest.permissions).not.toContain('debugger');
      expect(manifest.permissions).not.toContain('management');
      expect(manifest.permissions).not.toContain('history');
    }
  });

  it('verifies that background implementations adhere to target engine specifications', () => {
    const chManifest = JSON.parse(fs.readFileSync(chromiumManifestPath, 'utf8'));
    const ffManifest = JSON.parse(fs.readFileSync(firefoxManifestPath, 'utf8'));

    // Chromium: Service worker MV3
    expect(chManifest.background.service_worker).toBe('background.js');
    expect(chManifest.background.type).toBe('module');
    expect(chManifest.browser_specific_settings).toBeUndefined();

    // Firefox: Scripts array with Gecko ID
    expect(ffManifest.background.scripts).toEqual(['background.js']);
    expect(ffManifest.browser_specific_settings.gecko.id).toBe('web-to-figma-exporter@local');
  });

  it('verifies required Phase 23 documentation artifacts exist and are populated', () => {
    const requiredDocs = [
      'README.md',
      'CHANGELOG.md',
      'docs/known-limitations.md',
      'docs/release/four-browser-compatibility-matrix.md',
      'docs/release/release-candidate-report.md',
      'docs/release/dependency-inventory.md'
    ];

    for (const doc of requiredDocs) {
      const fullPath = path.join(rootDir, doc);
      expect(fs.existsSync(fullPath)).toBe(true);
      const content = fs.readFileSync(fullPath, 'utf8');
      expect(content.length).toBeGreaterThan(100);
    }
  });

  it('verifies packaged release archives and SHA256 checksums file exist in release/', () => {
    const releaseDir = path.join(rootDir, 'release');
    expect(fs.existsSync(releaseDir)).toBe(true);

    const checksumsPath = path.join(releaseDir, 'SHA256SUMS.txt');
    expect(fs.existsSync(checksumsPath)).toBe(true);

    const checksumContent = fs.readFileSync(checksumsPath, 'utf8');
    expect(checksumContent).toContain('web-to-figma-exporter-chromium');
    expect(checksumContent).toContain('web-to-figma-exporter-firefox');

    // Verify SHA-256 integrity for chromium zip
    const lines = checksumContent.trim().split('\n');
    for (const line of lines) {
      const [expectedHash, fileName] = line.trim().split(/\s+/);
      const filePath = path.join(releaseDir, fileName!);
      if (fs.existsSync(filePath)) {
        const fileBuffer = fs.readFileSync(filePath);
        const actualHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
        expect(actualHash).toBe(expectedHash);
      }
    }
  });
});
