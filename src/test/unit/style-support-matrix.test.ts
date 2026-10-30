import { describe, it, expect } from 'vitest';
import {
  STYLE_SUPPORT_MATRIX,
  getStyleSupport,
  auditComputedStyles
} from '../../core/styles/style-support-matrix';

describe('Style Support Matrix & Diagnostics', () => {
  it('contains entries for all core CSS visual categories', () => {
    expect(STYLE_SUPPORT_MATRIX['background-color']?.supportLevel).toBe('EXACT');
    expect(STYLE_SUPPORT_MATRIX['linear-gradient']?.supportLevel).toBe('EXACT');
    expect(STYLE_SUPPORT_MATRIX['conic-gradient']?.supportLevel).toBe('APPROXIMATED');
    expect(STYLE_SUPPORT_MATRIX['repeating-linear-gradient']?.supportLevel).toBe('APPROXIMATED');
    expect(STYLE_SUPPORT_MATRIX['filter-complex']?.supportLevel).toBe('OMITTED');
    expect(STYLE_SUPPORT_MATRIX['outline']?.supportLevel).toBe('APPROXIMATED');
  });

  it('retrieves rule details via getStyleSupport', () => {
    const conicRule = getStyleSupport('conic-gradient');
    expect(conicRule?.diagnosticCode).toBe('CONIC_GRADIENT_AFFINE_MAPPED');
  });

  it('audits computed styles and generates diagnostics for approximated or omitted features', () => {
    const dirtyStyles = {
      borderStyle: 'ridge',
      filter: 'blur(5px) grayscale(80%)'
    };

    const diagnostics = auditComputedStyles(dirtyStyles, 'card_1');
    expect(diagnostics).toHaveLength(2);
    expect(diagnostics.some((d) => d.code === 'BORDER_STYLE_APPROXIMATED')).toBe(true);
    expect(diagnostics.some((d) => d.code === 'UNSUPPORTED_FILTER_EFFECT')).toBe(true);
    expect(diagnostics[0]?.nodeId).toBe('card_1');
  });

  it('produces empty diagnostics for cleanly supported styles', () => {
    const cleanStyles = {
      backgroundColor: '#ffffff',
      borderStyle: 'solid',
      filter: 'blur(4px)'
    };

    const diagnostics = auditComputedStyles(cleanStyles, 'node_clean');
    expect(diagnostics).toHaveLength(0);
  });
});
