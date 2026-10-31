/**
 * Hardware-Adaptive Compatibility Profile and WebGL Texture Capability Prober.
 * 
 * Inspects client hardware capacity to scale export partition budgets dynamically:
 * - Constrained Tier: RAM <= 4 GB or max texture <= 4,096 px
 * - Standard Tier: RAM 4-8 GB, max texture 8,192 px
 * - High-Capacity Tier: RAM >= 16 GB, max texture >= 16,384 px
 * 
 * Prevents Figma WebGL canvas context crashes and out-of-memory errors upon pasting.
 */

export type HardwareBudgetTier = 'constrained' | 'standard' | 'high_capacity';

export interface HardwareCapabilities {
  deviceMemoryGb?: number | undefined;
  hardwareConcurrency?: number | undefined;
  maxTextureSize: number;
  detectedTier: HardwareBudgetTier;
}

export interface ExportBudgetProfile {
  tier: HardwareBudgetTier;
  maxPagesPerBatch: number;
  maxNodesPerBatch: number;
  maxAssetBytesPerBatch: number;
  maxTextureDimension: number;
  maxHierarchyDepth: number;
  estimatedMaxClipboardBytes: number;
}

export const BUDGET_PROFILES: Record<HardwareBudgetTier, ExportBudgetProfile> = {
  constrained: {
    tier: 'constrained',
    maxPagesPerBatch: 3,
    maxNodesPerBatch: 800,
    maxAssetBytesPerBatch: 8 * 1024 * 1024, // 8 MB
    maxTextureDimension: 4096,
    maxHierarchyDepth: 30,
    estimatedMaxClipboardBytes: 15 * 1024 * 1024
  },
  standard: {
    tier: 'standard',
    maxPagesPerBatch: 6,
    maxNodesPerBatch: 1500,
    maxAssetBytesPerBatch: 16 * 1024 * 1024, // 16 MB
    maxTextureDimension: 8192,
    maxHierarchyDepth: 45,
    estimatedMaxClipboardBytes: 30 * 1024 * 1024
  },
  high_capacity: {
    tier: 'high_capacity',
    maxPagesPerBatch: 12,
    maxNodesPerBatch: 3000,
    maxAssetBytesPerBatch: 32 * 1024 * 1024, // 32 MB
    maxTextureDimension: 16384,
    maxHierarchyDepth: 60,
    estimatedMaxClipboardBytes: 60 * 1024 * 1024
  }
};

/**
 * Detects the WebGL MAX_TEXTURE_SIZE supported by the current browser graphics context.
 * Falls back safely to 8,192 px in JSDOM/test environments, or 4,096 px if WebGL is unavailable.
 */
export function queryMaxTextureSize(canvasOverride?: HTMLCanvasElement): number {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return 8192; // Default fallback in headless/test environments
  }

  // JSDOM does not implement WebGL canvas context without external binary packages
  if (
    typeof navigator !== 'undefined' &&
    navigator.userAgent &&
    navigator.userAgent.includes('jsdom') &&
    !canvasOverride
  ) {
    return 8192;
  }

  try {
    const canvas = canvasOverride ?? document.createElement('canvas');
    if (typeof canvas.getContext !== 'function') {
      return 4096;
    }
    const gl =
      canvas.getContext('webgl2') ||
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl');

    if (gl && typeof (gl as WebGLRenderingContext).getParameter === 'function') {
      const maxTexture = (gl as WebGLRenderingContext).getParameter(
        (gl as WebGLRenderingContext).MAX_TEXTURE_SIZE
      );
      if (typeof maxTexture === 'number' && maxTexture >= 1024) {
        return maxTexture;
      }
    }
  } catch {
    // Non-fatal WebGL context creation error
  }

  return 4096;
}

export interface DetectCapabilitiesOptions {
  nav?: any | undefined;
  canvasOverride?: HTMLCanvasElement | undefined;
  maxTextureOverride?: number | undefined;
}

/**
 * Probes client hardware metrics (RAM, CPU cores, WebGL max texture size)
 * and resolves the appropriate budget tier.
 */
export function detectHardwareCapabilities(
  options: DetectCapabilitiesOptions = {}
): HardwareCapabilities {
  const nav = options.nav ?? (typeof navigator !== 'undefined' ? navigator : undefined);

  let deviceMemoryGb: number | undefined = undefined;
  let hardwareConcurrency: number | undefined = undefined;

  if (nav) {
    if (typeof nav.deviceMemory === 'number') {
      deviceMemoryGb = nav.deviceMemory;
    }
    if (typeof nav.hardwareConcurrency === 'number') {
      hardwareConcurrency = nav.hardwareConcurrency;
    }
  }

  const maxTextureSize = options.maxTextureOverride ?? queryMaxTextureSize(options.canvasOverride);

  // Determine budget tier
  let detectedTier: HardwareBudgetTier = 'standard';

  if (maxTextureSize <= 4096 || (deviceMemoryGb !== undefined && deviceMemoryGb <= 4)) {
    detectedTier = 'constrained';
  } else if (
    maxTextureSize >= 16384 &&
    ((deviceMemoryGb !== undefined && deviceMemoryGb >= 16) ||
      (hardwareConcurrency !== undefined && hardwareConcurrency >= 8))
  ) {
    detectedTier = 'high_capacity';
  } else {
    detectedTier = 'standard';
  }

  return {
    deviceMemoryGb,
    hardwareConcurrency,
    maxTextureSize,
    detectedTier
  };
}

/**
 * Resolves the dynamic hardware-adaptive budget profile for the current machine.
 */
export function getHardwareAdaptiveBudgetProfile(
  capabilities?: HardwareCapabilities
): ExportBudgetProfile {
  const caps = capabilities ?? detectHardwareCapabilities();
  return BUDGET_PROFILES[caps.detectedTier];
}
