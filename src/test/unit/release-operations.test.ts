import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const rootDir = path.resolve(__dirname, '../../..');

describe('Release Operations and Store Submission Verification (Phase 25)', () => {
  it('verifies all store submission checklists and reviewer guides exist', () => {
    const requiredSubmissionDocs = [
      'docs/release/chrome-web-store-submission.md',
      'docs/release/edge-addons-submission.md',
      'docs/release/firefox-addons-submission.md',
      'docs/user-guide/index.md',
      '.github/ISSUE_TEMPLATE/bug_report.md',
      '.github/ISSUE_TEMPLATE/feature_request.md'
    ];

    for (const relPath of requiredSubmissionDocs) {
      const fullPath = path.join(rootDir, relPath);
      expect(fs.existsSync(fullPath)).toBe(true);
      const text = fs.readFileSync(fullPath, 'utf8');
      expect(text.length).toBeGreaterThan(100);
    }
  });

  it('validates structure and contents of docs/release/release-manifest.json', () => {
    const manifestPath = path.join(rootDir, 'docs/release/release-manifest.json');
    expect(fs.existsSync(manifestPath)).toBe(true);

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    expect(manifest.version).toBe('0.1.0');
    expect(manifest.sourceCommit).toBeDefined();
    expect(manifest.buildTimestamp).toBeDefined();

    // Environment info
    expect(manifest.environment.nodeVersion).toBeDefined();
    expect(manifest.environment.npmVersion).toBeDefined();
    expect(manifest.environment.lockfileSha256).toBeDefined();

    // Minimum browser versions
    expect(manifest.minimumBrowserVersions.chrome).toContain('116+');
    expect(manifest.minimumBrowserVersions.edge).toContain('116+');
    expect(manifest.minimumBrowserVersions.brave).toContain('116+');
    expect(manifest.minimumBrowserVersions.firefox).toContain('120+');

    // Artifacts
    expect(manifest.artifacts.chromium.file).toBe('web-to-figma-exporter-chromium-v0.1.0.zip');
    expect(manifest.artifacts.chromium.sha256).toHaveLength(64);
    expect(manifest.artifacts.firefox.file).toBe('web-to-figma-exporter-firefox-v0.1.0.zip');
    expect(manifest.artifacts.firefox.sha256).toHaveLength(64);

    // Documentation pointers
    expect(manifest.documentation.sbom).toBe('docs/release/dependency-inventory.md');
    expect(manifest.documentation.privacyPolicy).toBe('docs/privacy/privacy-policy.md');
  });

  it('verifies that actual release archives match SHA256 checksums in release-manifest.json', () => {
    const manifestPath = path.join(rootDir, 'docs/release/release-manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    const releaseDir = path.join(rootDir, 'release');

    for (const target of ['chromium', 'firefox']) {
      const artifact = manifest.artifacts[target];
      const filePath = path.join(releaseDir, artifact.file);

      if (fs.existsSync(filePath)) {
        const fileBuffer = fs.readFileSync(filePath);
        const actualSha256 = crypto.createHash('sha256').update(fileBuffer).digest('hex');
        expect(actualSha256).toBe(artifact.sha256);
      }
    }
  });

  it('verifies that user-guide and submission guides disclose local processing and zero telemetry', () => {
    const userGuide = fs.readFileSync(path.join(rootDir, 'docs/user-guide/index.md'), 'utf8');
    expect(userGuide).toContain('Zero Telemetry');
    expect(userGuide).toContain('Sensitive Data Masking');

    const cwsDoc = fs.readFileSync(path.join(rootDir, 'docs/release/chrome-web-store-submission.md'), 'utf8');
    expect(cwsDoc).toContain('100% LOCAL & PRIVATE');
    expect(cwsDoc).toContain('Reviewer Test Instructions');
  });
});
