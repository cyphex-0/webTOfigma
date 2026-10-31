import { describe, it, expect } from 'vitest';
import {
  detectHardwareCapabilities,
  getHardwareAdaptiveBudgetProfile,
  queryMaxTextureSize,
  BUDGET_PROFILES
} from '../../core/figma/clipboard/compatibility-profile';

describe('CompatibilityProfile & Hardware-Adaptive Budgeting', () => {
  it('detects constrained tier on low-RAM devices or small max-texture limits', () => {
    const mockNav = {
      deviceMemory: 2, // 2 GB RAM
      hardwareConcurrency: 2
    };

    const caps = detectHardwareCapabilities({ nav: mockNav });
    expect(caps.detectedTier).toBe('constrained');

    const profile = getHardwareAdaptiveBudgetProfile(caps);
    expect(profile.maxPagesPerBatch).toBe(3);
    expect(profile.maxNodesPerBatch).toBe(800);
    expect(profile.maxAssetBytesPerBatch).toBe(8 * 1024 * 1024);
  });

  it('detects standard tier on typical mid-range desktop devices', () => {
    const mockNav = {
      deviceMemory: 8, // 8 GB RAM
      hardwareConcurrency: 4
    };

    const caps = detectHardwareCapabilities({ nav: mockNav });
    // In test environment queryMaxTextureSize defaults to 8192
    expect(caps.detectedTier).toBe('standard');

    const profile = getHardwareAdaptiveBudgetProfile(caps);
    expect(profile.maxPagesPerBatch).toBe(6);
    expect(profile.maxNodesPerBatch).toBe(1500);
    expect(profile.maxAssetBytesPerBatch).toBe(16 * 1024 * 1024);
  });

  it('detects high-capacity tier on high-end hardware', () => {
    const caps = {
      deviceMemoryGb: 32,
      hardwareConcurrency: 16,
      maxTextureSize: 16384,
      detectedTier: 'high_capacity' as const
    };

    const profile = getHardwareAdaptiveBudgetProfile(caps);
    expect(profile.maxPagesPerBatch).toBe(12);
    expect(profile.maxNodesPerBatch).toBe(3000);
    expect(profile.maxAssetBytesPerBatch).toBe(32 * 1024 * 1024);
    expect(profile.maxTextureDimension).toBe(16384);
  });

  it('handles queryMaxTextureSize gracefully when WebGL is unavailable', () => {
    const mockCanvas = {
      getContext: () => null // WebGL disabled
    } as unknown as HTMLCanvasElement;

    const size = queryMaxTextureSize(mockCanvas);
    expect(size).toBe(4096);
  });
});
