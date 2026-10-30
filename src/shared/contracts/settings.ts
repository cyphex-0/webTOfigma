/**
 * Settings and capture profile contracts.
 */

export interface CaptureProfile {
  id: string;
  name: string;
  viewportWidth: number;
  viewportHeight: number;
  devicePixelRatio: number;
  fullPageScrollLimit: number;
  scrollDelayMs: number;
  includeFixedElements: boolean;
  waitStrategy: 'load' | 'networkidle' | 'domcontentloaded';
  maxAssetsPerJob: number;
  maxNodesPerJob: number;
}

export interface DomainOverride {
  domain: string;
  minibarEnabled: boolean;
  maxPages?: number | undefined;
  customFontFallback?: string | undefined;
}

export interface ExtensionSettings {
  schemaVersion: number;
  defaultMode: string;
  activeProfileId: string;
  profiles: CaptureProfile[];
  domainOverrides: Record<string, DomainOverride>;
  autoCopyClipboard: boolean;
  notifyOnComplete: boolean;
}
