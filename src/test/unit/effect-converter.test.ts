import { describe, it, expect } from 'vitest';
import { parseBoxShadow } from '../../core/styles/shadow-parser';
import { convertEffectStyles } from '../../core/styles/effect-converter';

describe('CSS Effects & Box-Shadow Converter', () => {
  describe('parseBoxShadow', () => {
    it('parses standard drop shadow with blur and spread', () => {
      const shadows = parseBoxShadow('0 4px 6px -1px rgba(0, 0, 0, 0.1)');
      expect(shadows).toHaveLength(1);
      const s = shadows[0];
      expect(s?.isInset).toBe(false);
      expect(s?.offsetX).toBe(0);
      expect(s?.offsetY).toBe(4);
      expect(s?.blurRadius).toBe(6);
      expect(s?.spreadRadius).toBe(-1);
      expect(s?.color.a).toBeCloseTo(0.1, 2);
    });

    it('parses inset shadow with keyword at start or end', () => {
      const sStart = parseBoxShadow('inset 0 2px 4px 0 rgba(0, 0, 0, 0.2)')[0];
      expect(sStart?.isInset).toBe(true);

      const sEnd = parseBoxShadow('0 2px 4px 0 rgba(0, 0, 0, 0.2) inset')[0];
      expect(sEnd?.isInset).toBe(true);
    });

    it('parses multiple comma-separated shadows', () => {
      const multi = parseBoxShadow(
        '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
      );
      expect(multi).toHaveLength(2);
      expect(multi[0]?.offsetY).toBe(10);
      expect(multi[1]?.offsetY).toBe(4);
    });

    it('handles color at the beginning of the declaration', () => {
      const s = parseBoxShadow('#ff0000 2px 4px 8px 1px')[0];
      expect(s?.color).toEqual({ r: 1, g: 0, b: 0, a: 1 });
      expect(s?.offsetX).toBe(2);
      expect(s?.offsetY).toBe(4);
      expect(s?.blurRadius).toBe(8);
      expect(s?.spreadRadius).toBe(1);
    });
  });

  describe('convertEffectStyles', () => {
    it('converts drop and inner shadows into SceneEffects', () => {
      const res = convertEffectStyles({
        boxShadow: '0 4px 6px 0 rgba(0, 0, 0, 0.1), inset 0 1px 2px 0 rgba(255, 255, 255, 0.2)'
      });

      expect(res.effects).toHaveLength(2);
      expect(res.effects[0]?.type).toBe('DROP_SHADOW');
      expect(res.effects[0]?.offset).toEqual({ x: 0, y: 4 });
      expect(res.effects[0]?.radius).toBe(6);

      expect(res.effects[1]?.type).toBe('INNER_SHADOW');
      expect(res.effects[1]?.offset).toEqual({ x: 0, y: 1 });
      expect(res.effects[1]?.radius).toBe(2);
    });

    it('translates filter blur into LAYER_BLUR', () => {
      const res = convertEffectStyles({
        filter: 'blur(12px)'
      });

      expect(res.effects).toHaveLength(1);
      expect(res.effects[0]?.type).toBe('LAYER_BLUR');
      expect(res.effects[0]?.radius).toBe(12);
    });

    it('translates backdrop-filter blur into BACKGROUND_BLUR', () => {
      const res = convertEffectStyles({
        backdropFilter: 'blur(20px)'
      });

      expect(res.effects).toHaveLength(1);
      expect(res.effects[0]?.type).toBe('BACKGROUND_BLUR');
      expect(res.effects[0]?.radius).toBe(20);
    });

    it('emits diagnostic for unsupported filter functions without crashing', () => {
      const res = convertEffectStyles(
        {
          filter: 'blur(4px) grayscale(100%) contrast(150%)'
        },
        { nodeId: 'node_fx' }
      );

      expect(res.effects).toHaveLength(1);
      expect(res.effects[0]?.type).toBe('LAYER_BLUR');
      expect(res.diagnostics).toHaveLength(1);
      expect(res.diagnostics[0]?.code).toBe('UNSUPPORTED_FILTER_EFFECT');
      expect(res.diagnostics[0]?.nodeId).toBe('node_fx');
    });

    it('preserves layer opacity separately from color alpha', () => {
      const res = convertEffectStyles({
        opacity: '0.75'
      });
      expect(res.layerOpacity).toBe(0.75);
    });

    it('maps mix-blend-mode to uppercase identifier', () => {
      const res = convertEffectStyles({
        mixBlendMode: 'multiply'
      });
      expect(res.blendMode).toBe('MULTIPLY');
    });
  });
});
