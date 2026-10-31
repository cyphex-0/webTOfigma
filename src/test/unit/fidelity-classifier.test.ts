import { describe, it, expect } from 'vitest';
import {
  classifyPageFidelity,
  type FidelityClassificationInput
} from '../../core/diagnostics/fidelity-classifier';
import type { ExportDiagnostic } from '../../shared/contracts/diagnostics';

describe('Evidence-Based Page Fidelity Classifier (Phase 22)', () => {
  it('classifies empty or failed captures as unsupported', () => {
    const blank = classifyPageFidelity({
      pageUrl: 'https://example.com/blank',
      nodeCount: 0
    });
    expect(blank.fidelity).toBe('unsupported');
    expect(blank.reasons[0]?.code).toBe('EMPTY_OR_CORRUPT_DOM');

    const fatal = classifyPageFidelity({
      pageUrl: 'https://example.com/crashed',
      nodeCount: 50,
      hasFatalError: true
    });
    expect(fatal.fidelity).toBe('unsupported');
    expect(fatal.reasons[0]?.summary).toContain('fatal error');
  });

  it('classifies capture with inaccessible assets or font substitutions as partial with evidence', () => {
    const diagnostics: ExportDiagnostic[] = [
      {
        severity: 'warning',
        code: 'ASSET_FETCH_FAILED',
        message: 'HTTP 404 fetching hero image',
        phase: 'asset-fetch',
        timestamp: Date.now()
      },
      {
        severity: 'info',
        code: 'FONT_SUBSTITUTED',
        message: 'Font "GT America" substituted with "Inter"',
        phase: 'style-resolution',
        timestamp: Date.now()
      }
    ];

    const result = classifyPageFidelity({
      pageUrl: 'https://example.com/partial',
      nodeCount: 250,
      diagnostics
    });

    expect(result.fidelity).toBe('partial');
    expect(result.reasons).toHaveLength(2);

    const codes = result.reasons.map((r) => r.code);
    expect(codes).toContain('INACCESSIBLE_ASSETS');
    expect(codes).toContain('SUBSTITUTED_FONTS');
    expect(result.reasons[0]?.details?.[0]).toContain('HTTP 404');
  });

  it('classifies capture with bounded infinite scroll as partial', () => {
    const diagnostics: ExportDiagnostic[] = [
      {
        severity: 'warning',
        code: 'INFINITE_SCROLL_LIMIT_REACHED',
        message: 'Infinite scroll bounded at safety depth of 10 viewport heights',
        phase: 'dom-extraction',
        timestamp: Date.now()
      }
    ];

    const result = classifyPageFidelity({
      pageUrl: 'https://example.com/feed',
      nodeCount: 1200,
      diagnostics
    });

    expect(result.fidelity).toBe('partial');
    expect(result.reasons.some((r) => r.code === 'INFINITE_SCROLL_BOUNDED')).toBe(true);
  });

  it('classifies capture as high fidelity ONLY when zero degrading evidence exists', () => {
    const result = classifyPageFidelity({
      pageUrl: 'https://example.com/pristine',
      nodeCount: 150,
      diagnostics: []
    });

    expect(result.fidelity).toBe('high');
    expect(result.reasons).toHaveLength(0);
    expect(result.highFidelityJustification).toBeDefined();
    expect(result.highFidelityJustification).toContain('Zero fidelity-degrading diagnostics');
  });
});
