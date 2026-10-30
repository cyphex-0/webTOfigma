import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  SettingsStore,
  DEFAULT_EXTENSION_SETTINGS,
  STORAGE_KEY_SETTINGS
} from '../../core/settings/settings-store';
import type { ExtensionSettings } from '../../shared/contracts/settings';
import { browser } from '../../shared/browser/browser-api';

describe('SettingsStore & Cross-Context Synchronization', () => {
  let store: SettingsStore;

  beforeEach(async () => {
    await browser.storage.local.clear();
    store = new SettingsStore();
  });

  it('loads default settings when storage is empty', async () => {
    const settings = await store.load();
    expect(settings.schemaVersion).toBe(1);
    expect(settings.defaultMode).toBe('full-page');
    expect(settings.profiles).toHaveLength(3);
    expect(settings.activeProfileId).toBe('desktop-standard');
  });

  it('falls back to defaults and repairs if stored data is corrupted', async () => {
    // Put corrupted data in storage
    await browser.storage.local.set({
      [STORAGE_KEY_SETTINGS]: {
        schemaVersion: 99,
        invalidField: 'corrupt'
      }
    });

    const settings = await store.load();
    expect(settings.schemaVersion).toBe(1);
    expect(settings.defaultMode).toBe('full-page');

    // Storage should now be healed with defaults
    const raw = await browser.storage.local.get(STORAGE_KEY_SETTINGS);
    const healed = raw[STORAGE_KEY_SETTINGS] as ExtensionSettings;
    expect(healed.schemaVersion).toBe(1);
  });

  it('updates partial settings successfully', async () => {
    await store.load();
    const updated = await store.update({
      defaultMode: 'viewport',
      autoCopyClipboard: true
    });

    expect(updated.defaultMode).toBe('viewport');
    expect(updated.autoCopyClipboard).toBe(true);

    const reloaded = await store.load();
    expect(reloaded.defaultMode).toBe('viewport');
    expect(reloaded.autoCopyClipboard).toBe(true);
  });

  it('gets and sets active capture profile', async () => {
    await store.load();
    const active = await store.getActiveProfile();
    expect(active.id).toBe('desktop-standard');
    expect(active.viewportWidth).toBe(1440);

    await store.setActiveProfile('desktop-compact');
    const newActive = await store.getActiveProfile();
    expect(newActive.id).toBe('desktop-compact');
    expect(newActive.viewportWidth).toBe(1280);

    // Rejects unknown profile ID
    await expect(store.setActiveProfile('non-existent-profile')).rejects.toThrow(
      /does not exist/
    );
  });

  it('manages domain overrides with URL normalization and subdomain matching', async () => {
    await store.load();

    await store.setDomainOverride('https://app.example.com/dashboard?query=1', {
      minibarEnabled: false,
      maxPages: 3,
      customFontFallback: 'Roboto'
    });

    // Exact match
    const direct = await store.getDomainOverride('app.example.com');
    expect(direct).not.toBeNull();
    expect(direct?.domain).toBe('app.example.com');
    expect(direct?.minibarEnabled).toBe(false);
    expect(direct?.maxPages).toBe(3);

    // Subdomain inheritance: set on parent domain
    await store.setDomainOverride('google.com', {
      minibarEnabled: true,
      maxPages: 10
    });
    const subMatch = await store.getDomainOverride('docs.sub.google.com');
    expect(subMatch).not.toBeNull();
    expect(subMatch?.domain).toBe('google.com');

    // Remove domain override
    await store.removeDomainOverride('app.example.com');
    expect(await store.getDomainOverride('app.example.com')).toBeNull();
  });

  it('resets settings to factory defaults', async () => {
    await store.load();
    await store.update({ defaultMode: 'select-element', notifyOnComplete: false });

    const reset = await store.resetToDefaults();
    expect(reset.defaultMode).toBe(DEFAULT_EXTENSION_SETTINGS.defaultMode);
    expect(reset.notifyOnComplete).toBe(DEFAULT_EXTENSION_SETTINGS.notifyOnComplete);
  });

  it('triggers listeners when storage changes across contexts', async () => {
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    const newSettings = {
      ...DEFAULT_EXTENSION_SETTINGS,
      defaultMode: 'selected-pages'
    };

    // Simulate cross-context storage update from another window
    await browser.storage.local.set({
      [STORAGE_KEY_SETTINGS]: newSettings
    });

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ defaultMode: 'selected-pages' })
    );

    unsubscribe();
    await browser.storage.local.set({
      [STORAGE_KEY_SETTINGS]: { ...newSettings, defaultMode: 'even-pages' }
    });

    // Listener was unsubscribed, so call count remains 1
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
