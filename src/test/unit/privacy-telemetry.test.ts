import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Privacy and Zero-Telemetry Audit (Phase 22)', () => {
  const SUSPICIOUS_TELEMETRY_PATTERNS = [
    'google-analytics.com',
    'analytics.google.com',
    'stats.g.doubleclick.net',
    'segment.io',
    'api.segment.io',
    'mixpanel.com',
    'sentry.io',
    'browser.sentry-cdn.com',
    'clarity.ms',
    'hotjar.com',
    'amplitude.com',
    'loggly.com',
    'datadoghq.com',
    'newrelic.com',
    'telemetry.posthog.com'
  ];

  function getAllSourceFiles(dir: string): string[] {
    const results: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules' && entry.name !== 'dist' && entry.name !== '.git') {
          results.push(...getAllSourceFiles(fullPath));
        }
      } else if (/\.(ts|tsx|js|mjs)$/.test(entry.name)) {
        // Exclude this test file itself from the pattern scan
        if (!entry.name.includes('privacy-telemetry.test.ts')) {
          results.push(fullPath);
        }
      }
    }
    return results;
  }

  it('verifies zero analytics, tracking, or telemetry endpoints exist in source code', () => {
    const srcDir = path.resolve(__dirname, '../../');
    const sourceFiles = getAllSourceFiles(srcDir);
    expect(sourceFiles.length).toBeGreaterThan(30);

    const violations: Array<{ file: string; pattern: string }> = [];

    for (const file of sourceFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      for (const pattern of SUSPICIOUS_TELEMETRY_PATTERNS) {
        if (content.toLowerCase().includes(pattern.toLowerCase())) {
          violations.push({ file: path.relative(srcDir, file), pattern });
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('verifies manifest permissions do not request broad invasive permissions', () => {
    const pkgJson = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../package.json'), 'utf-8'));
    expect(pkgJson.name).toBe('web-to-figma-exporter');

    // Check manifest template or build script
    const buildScript = fs.readFileSync(path.resolve(__dirname, '../../../scripts/build-extension.mjs'), 'utf-8');
    expect(buildScript).not.toContain('"cookies"');
    expect(buildScript).not.toContain('"history"');
    expect(buildScript).not.toContain('"webRequest"');
    expect(buildScript).not.toContain('"debugger"');
  });
});
