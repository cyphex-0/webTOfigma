import { describe, it, expect, beforeEach } from 'vitest';
import { translateElementStyles } from '../../core/styles/index';
import { DOMWalker } from '../../core/dom/dom-walker';
import { ComputedStyleSnapshot } from '../../shared/contracts/source-node';

describe('Comprehensive Style Translation Integration', () => {
  describe('translateElementStyles from Snapshot', () => {
    it('translates complex card styles with gradients, borders, shadows, and blur', () => {
      const snapshot: ComputedStyleSnapshot = {
        display: 'block',
        position: 'relative',
        overflow: 'hidden',
        boxSizing: 'border-box',
        backgroundColor: '#1e293b',
        backgroundImage: 'linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(0, 0, 0, 0.2))',
        color: '#f8fafc',
        fontSize: '16px',
        fontFamily: 'Inter',
        fontWeight: '600',
        lineHeight: '24px',
        letterSpacing: '0px',
        textAlign: 'left',
        borderRadius: '12px 16px 20px 24px',
        borderWidth: '0px',
        borderBottomWidth: '3px',
        borderColor: '#38bdf8',
        borderStyle: 'solid',
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.2), inset 0 1px 0 0 rgba(255, 255, 255, 0.1)',
        filter: 'blur(1px)',
        backdropFilter: 'blur(8px)',
        opacity: '0.95',
        mixBlendMode: 'screen',
        transform: 'none',
        padding: '16px',
        margin: '0px'
      };

      const result = translateElementStyles(snapshot, { nodeId: 'test_card' });

      // 1. Fills: solid background + linear gradient
      expect(result.fills).toHaveLength(2);
      expect(result.fills[0]?.type).toBe('SOLID');
      expect(result.fills[1]?.type).toBe('GRADIENT_LINEAR');

      // 2. Corner radii: asymmetric 4 distinct values
      expect(result.cornerRadii).toEqual([12, 16, 20, 24]);
      expect(result.uniformCornerRadius).toBeUndefined();

      // 3. Strokes: independent edge weights
      expect(result.strokes).toHaveLength(1);
      expect(result.strokes[0]?.weight).toBe(3);
      expect(result.strokeWeights).toEqual({ top: 0, right: 0, bottom: 3, left: 0 });

      // 4. Effects: drop shadow + inset shadow + layer blur + backdrop blur
      expect(result.effects).toHaveLength(4);
      expect(result.effects[0]?.type).toBe('DROP_SHADOW');
      expect(result.effects[1]?.type).toBe('INNER_SHADOW');
      expect(result.effects[2]?.type).toBe('LAYER_BLUR');
      expect(result.effects[2]?.radius).toBe(1);
      expect(result.effects[3]?.type).toBe('BACKGROUND_BLUR');
      expect(result.effects[3]?.radius).toBe(8);

      // 5. Opacity & Blend Mode
      expect(result.opacity).toBe(0.95);
      expect(result.blendMode).toBe('SCREEN');
    });

    it('preserves alpha and opacity independently without double-multiplication', () => {
      const snapshot: ComputedStyleSnapshot = {
        display: 'block',
        position: 'static',
        overflow: 'visible',
        boxSizing: 'content-box',
        backgroundColor: 'rgba(255, 0, 0, 0.4)',
        color: '#000000',
        fontSize: '14px',
        fontFamily: 'sans-serif',
        fontWeight: '400',
        lineHeight: 'normal',
        letterSpacing: 'normal',
        textAlign: 'left',
        borderRadius: '0px',
        borderWidth: '0px',
        borderColor: 'transparent',
        borderStyle: 'none',
        boxShadow: 'none',
        opacity: '0.7',
        transform: 'none',
        padding: '0px',
        margin: '0px'
      };

      const result = translateElementStyles(snapshot);
      const fill = result.fills[0];

      // Color alpha is 0.4, NOT 0.4 * 0.7 = 0.28
      expect(fill?.color?.a).toBeCloseTo(0.4, 2);
      // Layer opacity is 0.7
      expect(result.opacity).toBeCloseTo(0.7, 2);
    });

    it('generates non-crashing diagnostics for unsupported filter effects', () => {
      const snapshot: ComputedStyleSnapshot = {
        display: 'block',
        position: 'static',
        overflow: 'visible',
        boxSizing: 'content-box',
        backgroundColor: '#ffffff',
        color: '#000000',
        fontSize: '14px',
        fontFamily: 'sans-serif',
        fontWeight: '400',
        lineHeight: 'normal',
        letterSpacing: 'normal',
        textAlign: 'left',
        borderRadius: '0px',
        borderWidth: '0px',
        borderColor: 'transparent',
        borderStyle: 'none',
        boxShadow: 'none',
        filter: 'grayscale(100%) sepia(50%)',
        transform: 'none',
        padding: '0px',
        margin: '0px'
      };

      const result = translateElementStyles(snapshot, { nodeId: 'fx_node' });
      expect(result.effects).toHaveLength(0);
      expect(result.diagnostics.some((d) => d.code === 'UNSUPPORTED_FILTER_EFFECT')).toBe(true);
      expect(result.diagnostics[0]?.nodeId).toBe('fx_node');
    });
  });

  describe('DOM Walker Snapshot to Style Translation Pipeline', () => {
    beforeEach(() => {
      document.body.innerHTML = '';
    });

    it('extracts computed styles from a live DOM element and translates them faithfully', () => {
      const card = document.createElement('div');
      card.id = 'dom_card';
      card.style.display = 'block';
      card.style.backgroundColor = 'rgb(30, 41, 59)';
      card.style.borderRadius = '16px';
      card.style.border = '2px solid rgb(56, 189, 248)';
      card.style.boxShadow = '0 4px 6px 0 rgba(0, 0, 0, 0.1)';
      card.style.opacity = '0.9';
      document.body.appendChild(card);

      const walker = new DOMWalker();
      const walkResult = walker.walk(card);
      const rootNode = walkResult.nodes[0];
      expect(rootNode).toBeDefined();

      const translated = translateElementStyles(rootNode!.computedStyle, {
        nodeId: rootNode!.nodeId
      });

      expect(translated.fills).toHaveLength(1);
      expect(translated.fills[0]?.type).toBe('SOLID');
      expect(translated.fills[0]?.color?.r).toBeCloseTo(30 / 255, 2);

      expect(translated.uniformCornerRadius).toBe(16);
      expect(translated.strokes).toHaveLength(1);
      expect(translated.strokes[0]?.weight).toBe(2);
      expect(translated.effects).toHaveLength(1);
      expect(translated.effects[0]?.type).toBe('DROP_SHADOW');
      expect(translated.opacity).toBeCloseTo(0.9, 2);
    });
  });
});
