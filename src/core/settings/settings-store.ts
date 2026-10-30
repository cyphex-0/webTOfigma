/**
 * Settings Store & Cross-Context Synchronization Engine.
 * Manages persistent user preferences, capture profiles, and per-domain rules
 * with strict Zod validation, automatic recovery, and live onChanged broadcast.
 */

import { browser } from '../../shared/browser/browser-api';
import type {
  ExtensionSettings,
  CaptureProfile,
  DomainOverride
} from '../../shared/contracts/settings';
import { ExtensionSettingsSchema } from '../../shared/schemas/settings.schema';

export const STORAGE_KEY_SETTINGS = 'web_to_figma_settings';

export const DEFAULT_EXTENSION_SETTINGS: ExtensionSettings = {
  schemaVersion: 1,
  defaultMode: 'full-page',
  activeProfileId: 'desktop-standard',
  profiles: [
    {
      id: 'desktop-standard',
      name: 'Desktop Standard (1440px)',
      viewportWidth: 1440,
      viewportHeight: 900,
      devicePixelRatio: 2,
      fullPageScrollLimit: 15000,
      scrollDelayMs: 250,
      includeFixedElements: true,
      waitStrategy: 'networkidle',
      maxAssetsPerJob: 200,
      maxNodesPerJob: 15000
    },
    {
      id: 'desktop-compact',
      name: 'Desktop Compact (1280px)',
      viewportWidth: 1280,
      viewportHeight: 800,
      devicePixelRatio: 1,
      fullPageScrollLimit: 10000,
      scrollDelayMs: 200,
      includeFixedElements: true,
      waitStrategy: 'networkidle',
      maxAssetsPerJob: 150,
      maxNodesPerJob: 10000
    },
    {
      id: 'mobile-iphone',
      name: 'Mobile iPhone (390px)',
      viewportWidth: 390,
      viewportHeight: 844,
      devicePixelRatio: 3,
      fullPageScrollLimit: 12000,
      scrollDelayMs: 200,
      includeFixedElements: true,
      waitStrategy: 'load',
      maxAssetsPerJob: 100,
      maxNodesPerJob: 8000
    }
  ],
  domainOverrides: {},
  autoCopyClipboard: false,
  notifyOnComplete: true
};

export class SettingsStore {
  private cachedSettings: ExtensionSettings | null = null;
  private isListening = false;
  private readonly listeners = new Set<(settings: ExtensionSettings) => void>();

  constructor() {
    this.ensureStorageListener();
  }

  private ensureStorageListener(): void {
    if (this.isListening) return;
    if (typeof browser !== 'undefined' && browser.storage?.onChanged) {
      browser.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === 'local' && changes[STORAGE_KEY_SETTINGS]) {
          const change = changes[STORAGE_KEY_SETTINGS];
          if (change.newValue) {
            const parsed = ExtensionSettingsSchema.safeParse(change.newValue);
            if (parsed.success) {
              this.cachedSettings = parsed.data;
              this.notifyListeners(parsed.data);
            }
          }
        }
      });
      this.isListening = true;
    }
  }

  private notifyListeners(settings: ExtensionSettings): void {
    for (const listener of this.listeners) {
      try {
        listener(settings);
      } catch (err) {
        console.error('[WebToFigma] Error in settings listener:', err);
      }
    }
  }

  /**
   * Loads settings from storage. If missing, corrupt, or outdated,
   * returns and persists default settings.
   */
  async load(): Promise<ExtensionSettings> {
    try {
      const data = await browser.storage.local.get(STORAGE_KEY_SETTINGS);
      const raw = data[STORAGE_KEY_SETTINGS];

      if (!raw) {
        await this.save(DEFAULT_EXTENSION_SETTINGS);
        return DEFAULT_EXTENSION_SETTINGS;
      }

      const parsed = ExtensionSettingsSchema.safeParse(raw);
      if (parsed.success) {
        this.cachedSettings = parsed.data;
        return parsed.data;
      } else {
        console.warn(
          '[WebToFigma] Stored settings failed schema validation. Falling back to defaults.',
          parsed.error
        );
        await this.save(DEFAULT_EXTENSION_SETTINGS);
        return DEFAULT_EXTENSION_SETTINGS;
      }
    } catch (err) {
      console.error('[WebToFigma] Failed to load settings from storage:', err);
      return DEFAULT_EXTENSION_SETTINGS;
    }
  }

  /**
   * Returns current cached settings or loads them from storage.
   */
  async getSettings(): Promise<ExtensionSettings> {
    if (this.cachedSettings) {
      return this.cachedSettings;
    }
    return this.load();
  }

  /**
   * Validates and saves new settings to storage.
   */
  async save(settings: ExtensionSettings): Promise<void> {
    const validated = ExtensionSettingsSchema.parse(settings);
    await browser.storage.local.set({
      [STORAGE_KEY_SETTINGS]: validated
    });
    this.cachedSettings = validated;
  }

  /**
   * Partially updates settings and persists them.
   */
  async update(partial: Partial<ExtensionSettings>): Promise<ExtensionSettings> {
    const current = await this.getSettings();
    const merged: ExtensionSettings = {
      ...current,
      ...partial,
      schemaVersion: 1
    };
    await this.save(merged);
    return merged;
  }

  /**
   * Returns the currently active capture profile.
   */
  async getActiveProfile(): Promise<CaptureProfile> {
    const settings = await this.getSettings();
    const profile = settings.profiles.find((p) => p.id === settings.activeProfileId);
    if (profile) return profile;

    const fallback = settings.profiles[0] ?? DEFAULT_EXTENSION_SETTINGS.profiles[0];
    if (!fallback) {
      throw new Error('No capture profiles configured in settings');
    }
    return fallback;
  }

  /**
   * Sets the active capture profile ID.
   */
  async setActiveProfile(profileId: string): Promise<ExtensionSettings> {
    const current = await this.getSettings();
    const exists = current.profiles.some((p) => p.id === profileId);
    if (!exists) {
      throw new Error(`Profile with id "${profileId}" does not exist`);
    }
    return this.update({ activeProfileId: profileId });
  }

  /**
   * Adds or updates a domain override rule.
   */
  async setDomainOverride(
    rawDomain: string,
    override: Omit<DomainOverride, 'domain'>
  ): Promise<ExtensionSettings> {
    const domain = this.normalizeDomain(rawDomain);
    if (!domain) {
      throw new Error(`Invalid domain name: "${rawDomain}"`);
    }

    const current = await this.getSettings();
    const updatedOverrides = {
      ...current.domainOverrides,
      [domain]: {
        domain,
        ...override
      }
    };
    return this.update({ domainOverrides: updatedOverrides });
  }

  /**
   * Removes a domain override rule.
   */
  async removeDomainOverride(rawDomain: string): Promise<ExtensionSettings> {
    const domain = this.normalizeDomain(rawDomain);
    const current = await this.getSettings();
    const updatedOverrides = { ...current.domainOverrides };
    delete updatedOverrides[domain];
    return this.update({ domainOverrides: updatedOverrides });
  }

  /**
   * Retrieves domain override rule for a given hostname or URL.
   */
  async getDomainOverride(hostnameOrUrl: string): Promise<DomainOverride | null> {
    const domain = this.normalizeDomain(hostnameOrUrl);
    if (!domain) return null;

    const settings = await this.getSettings();
    // Direct exact match
    if (settings.domainOverrides[domain]) {
      return settings.domainOverrides[domain];
    }

    // Check parent domain (e.g. sub.example.com -> example.com)
    const parts = domain.split('.');
    while (parts.length > 2) {
      parts.shift();
      const parent = parts.join('.');
      if (settings.domainOverrides[parent]) {
        return settings.domainOverrides[parent];
      }
    }

    return null;
  }

  /**
   * Resets all settings to factory conservative defaults.
   */
  async resetToDefaults(): Promise<ExtensionSettings> {
    await this.save(DEFAULT_EXTENSION_SETTINGS);
    return DEFAULT_EXTENSION_SETTINGS;
  }

  /**
   * Subscribes to settings updates (fired via storage.onChanged across all extension contexts).
   */
  subscribe(listener: (settings: ExtensionSettings) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Cleans and normalizes a domain string or URL into a raw lowercase hostname.
   */
  private normalizeDomain(input: string): string {
    const trimmed = input.trim().toLowerCase();
    try {
      if (trimmed.includes('://')) {
        const parsed = new URL(trimmed);
        return parsed.hostname.toLowerCase();
      }
      // If port is present, strip it
      const hostWithoutPort = trimmed.split(':')[0] ?? '';
      // Strip leading slashes
      return hostWithoutPort.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    } catch {
      return trimmed.split('/')[0]?.split(':')[0] ?? '';
    }
  }
}

export const settingsStore = new SettingsStore();
