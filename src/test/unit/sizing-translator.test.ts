import { describe, it, expect } from 'vitest';
import { translateChildSizing } from '../../core/layout/sizing-translator';

describe('Sizing and Constraint Translator', () => {
  it('assigns FIXED dimensions in positioned frame (NONE layout)', () => {
    const res = translateChildSizing({
      style: { width: '100%', flexGrow: '1' },
      hasChildren: true,
      isText: false,
      parentLayoutMode: 'NONE'
    });
    expect(res).toEqual({ horizontal: 'FIXED', vertical: 'FIXED' });
  });

  describe('within HORIZONTAL Auto Layout parent', () => {
    it('maps flex-grow to horizontal FILL', () => {
      const res = translateChildSizing({
        style: { flexGrow: '1', height: '40px' },
        hasChildren: false,
        isText: false,
        parentLayoutMode: 'HORIZONTAL'
      });
      expect(res.horizontal).toBe('FILL');
      expect(res.vertical).toBe('FIXED');
    });

    it('maps explicit pixel widths to horizontal FIXED', () => {
      const res = translateChildSizing({
        style: { width: '180px', height: 'auto' },
        hasChildren: true,
        isText: false,
        parentLayoutMode: 'HORIZONTAL'
      });
      expect(res.horizontal).toBe('FIXED');
      expect(res.vertical).toBe('HUG');
    });

    it('maps content-sized text to HUG', () => {
      const res = translateChildSizing({
        style: { width: 'auto', height: 'auto' },
        hasChildren: false,
        isText: true,
        parentLayoutMode: 'HORIZONTAL'
      });
      expect(res.horizontal).toBe('HUG');
      expect(res.vertical).toBe('HUG');
    });

    it('maps counter-axis stretch to vertical FILL', () => {
      const res = translateChildSizing({
        style: { width: '100px', alignSelf: 'stretch' },
        hasChildren: false,
        isText: false,
        parentLayoutMode: 'HORIZONTAL'
      });
      expect(res.horizontal).toBe('FIXED');
      expect(res.vertical).toBe('FILL');
    });
  });

  describe('within VERTICAL Auto Layout parent', () => {
    it('maps flex-grow to vertical FILL', () => {
      const res = translateChildSizing({
        style: { flexGrow: '2', width: '200px' },
        hasChildren: false,
        isText: false,
        parentLayoutMode: 'VERTICAL'
      });
      expect(res.horizontal).toBe('FIXED');
      expect(res.vertical).toBe('FILL');
    });

    it('maps width: 100% to horizontal FILL on counter axis', () => {
      const res = translateChildSizing({
        style: { width: '100%', height: 'auto' },
        hasChildren: true,
        isText: false,
        parentLayoutMode: 'VERTICAL'
      });
      expect(res.horizontal).toBe('FILL');
      expect(res.vertical).toBe('HUG');
    });
  });
});
