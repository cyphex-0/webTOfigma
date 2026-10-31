import { describe, it, expect } from 'vitest';
import {
  extractColorTokens,
  rgbaToHex,
  colorDistance
} from '../../core/design-system/color-token-extractor';
import {
  extractTypographyTokens,
  inferTypographyRole
} from '../../core/design-system/typography-token-extractor';
import { extractSpacingTokens } from '../../core/design-system/spacing-token-extractor';
import type { SceneNode } from '../../shared/contracts/scene';

describe('Design-System Token Extractors (Phase 21)', () => {
  describe('Color Token Extractor & Deterministic Clustering', () => {
    it('converts normalized RGBA to hex correctly', () => {
      expect(rgbaToHex({ r: 1, g: 1, b: 1, a: 1 })).toBe('#FFFFFF');
      expect(rgbaToHex({ r: 0, g: 0, b: 0, a: 1 })).toBe('#000000');
      expect(rgbaToHex({ r: 0.1, g: 0.2, b: 0.3, a: 1 })).toBe('#1A334D');
    });

    it('extracts unique colors from fills, strokes, and text with roles and frequencies', () => {
      const nodes: SceneNode[] = [
        {
          id: 'n1',
          parentId: null,
          childIds: [],
          name: 'Primary Button',
          type: 'FRAME',
          visible: true,
          x: 0,
          y: 0,
          width: 120,
          height: 40,
          rotation: 0,
          fills: [{ type: 'SOLID', color: { r: 0.1, g: 0.4, b: 0.9, a: 1 }, opacity: 1, visible: true }],
          strokes: [{ color: { r: 0.05, g: 0.2, b: 0.5, a: 1 }, weight: 1, align: 'INSIDE', visible: true }],
          effects: [],
          clipsContent: true
        },
        {
          id: 'n2',
          parentId: null,
          childIds: [],
          name: 'Secondary Button',
          type: 'FRAME',
          visible: true,
          x: 0,
          y: 50,
          width: 120,
          height: 40,
          rotation: 0,
          fills: [{ type: 'SOLID', color: { r: 0.1, g: 0.4, b: 0.9, a: 1 }, opacity: 1, visible: true }],
          strokes: [],
          effects: [],
          clipsContent: true
        }
      ];

      const tokens = extractColorTokens(nodes);
      expect(tokens.length).toBeGreaterThanOrEqual(2);

      const dominant = tokens[0]!;
      expect(dominant.hex).toBe(rgbaToHex({ r: 0.1, g: 0.4, b: 0.9, a: 1 }));
      expect(dominant.frequency).toBe(2);
      expect(dominant.roles).toContain('fill');
    });

    it('clusters near-identical colors while preserving original member values', () => {
      // Two very close grays: #202020 and #212121
      const c1 = { r: 32 / 255, g: 32 / 255, b: 32 / 255, a: 1 };
      const c2 = { r: 33 / 255, g: 33 / 255, b: 33 / 255, a: 1 };

      expect(colorDistance(c1, c2)).toBeLessThan(0.02);

      const nodes: SceneNode[] = [
        {
          id: 'n1',
          parentId: null,
          childIds: [],
          name: 'Card 1',
          type: 'FRAME',
          visible: true,
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          rotation: 0,
          fills: [{ type: 'SOLID', color: c1, opacity: 1, visible: true }],
          strokes: [],
          effects: [],
          clipsContent: false
        },
        {
          id: 'n2',
          parentId: null,
          childIds: [],
          name: 'Card 2',
          type: 'FRAME',
          visible: true,
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          rotation: 0,
          fills: [{ type: 'SOLID', color: c2, opacity: 1, visible: true }],
          strokes: [],
          effects: [],
          clipsContent: false
        }
      ];

      const tokens = extractColorTokens(nodes, { clusteringThreshold: 0.03 });
      expect(tokens).toHaveLength(1); // Clustered into 1 primary token

      const cluster = tokens[0]!;
      expect(cluster.frequency).toBe(2);
      expect(cluster.members).toHaveLength(2); // Preserves both original member values
    });
  });

  describe('Typography Token Extractor', () => {
    it('infers semantic roles H1-H6, Body, and Caption correctly', () => {
      expect(inferTypographyRole(40, 700)).toBe('H1');
      expect(inferTypographyRole(32, 600)).toBe('H1');
      expect(inferTypographyRole(28, 600)).toBe('H2');
      expect(inferTypographyRole(24, 600)).toBe('H3');
      expect(inferTypographyRole(20, 500)).toBe('H4');
      expect(inferTypographyRole(16, 600)).toBe('H6');
      expect(inferTypographyRole(16, 400)).toBe('Body');
      expect(inferTypographyRole(14, 400)).toBe('Body Small');
      expect(inferTypographyRole(12, 400)).toBe('Caption');
    });

    it('extracts typography tokens and detects font substitutions', () => {
      const nodes: SceneNode[] = [
        {
          id: 't1',
          parentId: null,
          childIds: [],
          name: 'Heading',
          type: 'TEXT',
          visible: true,
          x: 0,
          y: 0,
          width: 300,
          height: 48,
          rotation: 0,
          fills: [],
          strokes: [],
          effects: [],
          clipsContent: false,
          textData: {
            text: 'Hero Title',
            fontSize: 32,
            fontWeight: 700,
            fontFamily: 'CustomBrandFont',
            sourceFont: 'CustomBrandFont',
            resolvedFont: 'Inter',
            lineHeight: 40,
            textAlign: 'LEFT'
          }
        },
        {
          id: 't2',
          parentId: null,
          childIds: [],
          name: 'Paragraph',
          type: 'TEXT',
          visible: true,
          x: 0,
          y: 50,
          width: 300,
          height: 24,
          rotation: 0,
          fills: [],
          strokes: [],
          effects: [],
          clipsContent: false,
          textData: {
            text: 'Body text content here',
            fontSize: 16,
            fontWeight: 400,
            fontFamily: 'Inter',
            sourceFont: 'Inter',
            resolvedFont: 'Inter',
            lineHeight: 24,
            textAlign: 'LEFT'
          }
        }
      ];

      const result = extractTypographyTokens(nodes);
      expect(result.tokens).toHaveLength(2);
      expect(result.tokens[0]?.role).toBe('H1');
      expect(result.tokens[1]?.role).toBe('Body');

      // Font substitution check
      expect(result.fontSubstitutions).toHaveLength(1);
      expect(result.fontSubstitutions[0]?.sourceFont).toBe('CustomBrandFont');
      expect(result.fontSubstitutions[0]?.resolvedFont).toBe('Inter');
    });
  });

  describe('Spacing & Radius Token Extractor', () => {
    it('extracts recurring spacing with neutral labels without synthetic names', () => {
      const nodes: SceneNode[] = [
        {
          id: 'c1',
          parentId: null,
          childIds: [],
          name: 'Card',
          type: 'FRAME',
          visible: true,
          x: 0,
          y: 0,
          width: 200,
          height: 200,
          rotation: 0,
          cornerRadius: 12,
          fills: [],
          strokes: [],
          effects: [],
          clipsContent: true,
          layoutMetadata: {
            layoutMode: 'VERTICAL',
            itemSpacing: 16,
            padding: { top: 24, right: 16, bottom: 24, left: 16 }
          }
        }
      ];

      const result = extractSpacingTokens(nodes);

      // Spacing tokens check
      const spacingValues = result.spacingTokens.map((s) => s.valuePx);
      expect(spacingValues).toContain(16);
      expect(spacingValues).toContain(24);

      const token16 = result.spacingTokens.find((s) => s.valuePx === 16);
      expect(token16?.label).toBe('Spacing 16 px'); // Neutral label, not "space-4"

      // Radius tokens check
      expect(result.radiusTokens).toHaveLength(1);
      expect(result.radiusTokens[0]?.valuePx).toBe(12);
      expect(result.radiusTokens[0]?.label).toBe('Radius 12 px');
    });
  });
});
