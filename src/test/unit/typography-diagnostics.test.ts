import { describe, it, expect } from 'vitest';
import {
  createFontSubstitutedDiagnostic,
  createTextClippedDiagnostic,
  createLineClampDiagnostic,
  createRtlTextDiagnostic,
  createWeightQuantizedDiagnostic
} from '../../core/typography/typography-diagnostics';

describe('Typography Diagnostics & Reporting', () => {
  it('creates FONT_SUBSTITUTED diagnostic with warning severity', () => {
    const diag = createFontSubstitutedDiagnostic({
      sourceFamily: 'GT Walsheim',
      resolvedFamily: 'Inter',
      nodeId: 'heading_1'
    });

    expect(diag.code).toBe('FONT_SUBSTITUTED');
    expect(diag.severity).toBe('warning');
    expect(diag.phase).toBe('style-resolution');
    expect(diag.nodeId).toBe('heading_1');
    expect(diag.message.includes('GT Walsheim')).toBe(true);
    expect(diag.message.includes('Inter')).toBe(true);
    expect(diag.recoveryAction).toBeDefined();
  });

  it('creates TEXT_CLIPPED_BY_HEIGHT diagnostic when height expanded', () => {
    const diag = createTextClippedDiagnostic({
      measuredHeight: 20,
      safeHeight: 48,
      nodeId: 'card_desc'
    });

    expect(diag.code).toBe('TEXT_CLIPPED_BY_HEIGHT');
    expect(diag.severity).toBe('warning');
    expect(diag.phase).toBe('layout-computation');
    expect(diag.message.includes('20px')).toBe(true);
    expect(diag.message.includes('48px')).toBe(true);
  });

  it('creates LINE_CLAMP_DETECTED diagnostic', () => {
    const diag = createLineClampDiagnostic({
      maxLines: 3,
      nodeId: 'article_preview'
    });

    expect(diag.code).toBe('LINE_CLAMP_DETECTED');
    expect(diag.severity).toBe('info');
    expect(diag.message.includes('3 lines')).toBe(true);
  });

  it('creates RTL_TEXT_DETECTED diagnostic for right-to-left scripts', () => {
    const diag = createRtlTextDiagnostic({
      direction: 'rtl',
      nodeId: 'arabic_text'
    });

    expect(diag.code).toBe('RTL_TEXT_DETECTED');
    expect(diag.severity).toBe('info');
    expect(diag.phase).toBe('dom-extraction');
  });

  it('creates FONT_WEIGHT_QUANTIZED diagnostic for variable weights', () => {
    const diag = createWeightQuantizedDiagnostic({
      family: 'Inter',
      sourceWeight: 465,
      quantizedWeight: 500
    });

    expect(diag.code).toBe('FONT_WEIGHT_QUANTIZED');
    expect(diag.severity).toBe('info');
    expect(diag.message.includes('465')).toBe(true);
    expect(diag.message.includes('500')).toBe(true);
  });
});
