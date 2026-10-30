import { describe, it, expect } from 'vitest';
import { isFirefox, isChromium, getBrowserTargetName } from '../../shared/browser/browser-api';
import { detectBrowserCapabilities } from '../../shared/browser/browser-capabilities';

describe('browser-api', () => {
  it('should export expected boolean flags', () => {
    expect(typeof isFirefox).toBe('boolean');
    expect(typeof isChromium).toBe('boolean');
    expect(isFirefox !== isChromium).toBe(true);
  });

  it('should return a non-empty target name string', () => {
    const targetName = getBrowserTargetName();
    expect(typeof targetName).toBe('string');
    expect(targetName.length).toBeGreaterThan(0);
  });

  it('should detect browser capabilities safely without throwing', () => {
    const caps = detectBrowserCapabilities();
    expect(caps).toHaveProperty('supportsClipboardWrite');
    expect(caps).toHaveProperty('supportsScriptingApi');
    expect(caps).toHaveProperty('supportsLocalStorage');
    expect(caps).toHaveProperty('browserTarget');
  });
});
