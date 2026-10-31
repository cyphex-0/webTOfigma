import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = path.resolve(__dirname, '../../..');

describe('Public-Release Security, Privacy, and Legal Audit (Phase 24)', () => {
  it('verifies all required public documentation and legal policy files exist', () => {
    const requiredFiles = [
      'docs/privacy/data-inventory.md',
      'docs/privacy/privacy-policy.md',
      'docs/privacy/permission-disclosures.md',
      'docs/security/threat-model.md',
      'SECURITY.md',
      'LICENSE',
      'THIRD_PARTY_NOTICES.md',
      'docs/release/security-and-privacy-review.md'
    ];

    for (const relPath of requiredFiles) {
      const fullPath = path.join(rootDir, relPath);
      expect(fs.existsSync(fullPath)).toBe(true);
      const content = fs.readFileSync(fullPath, 'utf8');
      expect(content.length).toBeGreaterThan(50);
    }
  });

  it('verifies threat model contains all required threat items with complete risk metadata', () => {
    const threatModelPath = path.join(rootDir, 'docs/security/threat-model.md');
    const content = fs.readFileSync(threatModelPath, 'utf8');

    const expectedThreats = [
      'Malicious Page DOM',
      'Hostile Text & Script Injection',
      'SVG Script and Event Payloads',
      'CSS-Based Resource Abuse',
      'Oversized or Decompression-Bomb Assets',
      'Malformed Image & Vector Data',
      'Supply Chain & Compromised Dependencies',
      'Prototype Pollution',
      'Message Spoofing Across Extension Boundaries',
      'Extension UI Injection',
      'Clipboard Payload Corruption',
      'Accidental Capture of Sensitive Form Fields',
      'SSRF & Private Network Navigation'
    ];

    for (const threat of expectedThreats) {
      expect(content).toContain(threat);
    }

    // Verify required audit sections exist
    expect(content).toContain('Severity');
    expect(content).toContain('Exploit Preconditions');
    expect(content).toContain('Impact');
    expect(content).toContain('Mitigation');
    expect(content).toContain('Test Reference');
    expect(content).toContain('Residual Risk Owner');
  });

  it('verifies that LICENSE is MIT and THIRD_PARTY_NOTICES covers all bundled dependencies', () => {
    const licensePath = path.join(rootDir, 'LICENSE');
    const licenseText = fs.readFileSync(licensePath, 'utf8');
    expect(licenseText).toContain('MIT License');
    expect(licenseText).toContain('Web-to-Figma Exporter Contributors');

    const noticesPath = path.join(rootDir, 'THIRD_PARTY_NOTICES.md');
    const noticesText = fs.readFileSync(noticesPath, 'utf8');
    expect(noticesText).toContain('kiwi-schema');
    expect(noticesText).toContain('react');
    expect(noticesText).toContain('react-dom');
    expect(noticesText).toContain('webextension-polyfill');
    expect(noticesText).toContain('zod');
  });

  it('verifies built extension bundles do not contain dangerous eval or remote analytics endpoints', () => {
    const chromiumDir = path.join(rootDir, 'dist/chromium');
    if (fs.existsSync(chromiumDir)) {
      const bgPath = path.join(chromiumDir, 'background.js');
      const contentPath = path.join(chromiumDir, 'content.js');

      for (const p of [bgPath, contentPath]) {
        if (fs.existsSync(p)) {
          const code = fs.readFileSync(p, 'utf8');
          // No eval statement
          expect(code).not.toMatch(/\beval\s*\(/);
          // No remote tracking endpoints
          expect(code).not.toContain('google-analytics.com');
          expect(code).not.toContain('segment.io');
          expect(code).not.toContain('mixpanel.com');
          expect(code).not.toContain('sentry.io');
        }
      }
    }
  });
});
