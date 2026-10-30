import { describe, it, expect } from 'vitest';
import {
  fnv1aHash,
  generateNodeId,
  generateSyntheticNodeId,
  parseNodeId
} from '../../core/dom/id-generator';
import {
  toDocumentSpace,
  toViewportSpace,
  sanitizeRect,
  roundRect
} from '../../core/dom/coordinate-normalizer';

describe('Deterministic ID Generator & Coordinate Normalizer', () => {
  describe('fnv1aHash', () => {
    it('produces deterministic 8-character hex output', () => {
      const hash1 = fnv1aHash('button.primary#submit');
      const hash2 = fnv1aHash('button.primary#submit');
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(8);
      expect(/^[0-9a-f]{8}$/.test(hash1)).toBe(true);
    });

    it('generates different hashes for different inputs', () => {
      const hashA = fnv1aHash('header > nav');
      const hashB = fnv1aHash('footer > nav');
      expect(hashA).not.toBe(hashB);
    });

    it('handles empty strings reliably', () => {
      const emptyHash = fnv1aHash('');
      expect(emptyHash).toBe('811c9dc5');
    });
  });

  describe('generateNodeId & parseNodeId', () => {
    it('generates stable tree-path based identifiers', () => {
      expect(generateNodeId(0, [])).toBe('p0_n_0');
      expect(generateNodeId(0, [0])).toBe('p0_n_0');
      expect(generateNodeId(0, [0, 1, 3])).toBe('p0_n_0_1_3');
      expect(generateNodeId(2, [1, 5, 2, 0])).toBe('p2_n_1_5_2_0');
    });

    it('round-trips correctly with parseNodeId', () => {
      const path = [0, 2, 4, 1];
      const id = generateNodeId(1, path);
      const parsed = parseNodeId(id);

      expect(parsed).not.toBeNull();
      expect(parsed?.pageIndex).toBe(1);
      expect(parsed?.treePath).toEqual(path);
    });

    it('returns null for non-matching or malformed IDs', () => {
      expect(parseNodeId('custom-id')).toBeNull();
      expect(parseNodeId('p0_synthetic_123')).toBeNull();
      expect(parseNodeId('')).toBeNull();
    });
  });

  describe('generateSyntheticNodeId', () => {
    it('generates reproducible synthetic IDs with sanitized prefixes', () => {
      const synId1 = generateSyntheticNodeId(0, 'pseudo::before', 'content-text');
      const synId2 = generateSyntheticNodeId(0, 'pseudo::before', 'content-text');
      expect(synId1).toBe(synId2);
      expect(synId1.startsWith('p0_syn_pseudo__before_')).toBe(true);
    });

    it('differs when seed changes', () => {
      const id1 = generateSyntheticNodeId(0, 'wrapper', 'div#1');
      const id2 = generateSyntheticNodeId(0, 'wrapper', 'div#2');
      expect(id1).not.toBe(id2);
    });
  });

  describe('Coordinate Normalizer', () => {
    it('translates viewport coordinates to document coordinates with scroll offsets', () => {
      const clientRect = { x: 50, y: 100, width: 300, height: 200 };
      const docRect = toDocumentSpace(clientRect, 25, 450);

      expect(docRect).toEqual({
        x: 75,
        y: 550,
        width: 300,
        height: 200
      });
    });

    it('inverts document coordinates back to viewport coordinates', () => {
      const docRect = { x: 75, y: 550, width: 300, height: 200 };
      const clientRect = toViewportSpace(docRect, 25, 450);

      expect(clientRect).toEqual({
        x: 50,
        y: 100,
        width: 300,
        height: 200
      });
    });

    it('sanitizes undefined, NaN, and negative values', () => {
      const corruptedRect = {
        x: undefined,
        y: NaN,
        width: -50,
        height: Infinity
      };
      const cleaned = sanitizeRect(corruptedRect);

      expect(cleaned.x).toBe(0);
      expect(cleaned.y).toBe(0);
      expect(cleaned.width).toBe(0);
      expect(cleaned.height).toBe(0);
    });

    it('rounds sub-pixel jitter to requested decimal places', () => {
      const jittery = { x: 12.3456, y: 78.9101, width: 100.1234, height: 45.6789 };
      const rounded = roundRect(jittery, 2);

      expect(rounded).toEqual({
        x: 12.35,
        y: 78.91,
        width: 100.12,
        height: 45.68
      });
    });
  });
});
