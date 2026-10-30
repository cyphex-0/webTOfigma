import { describe, it, expect } from 'vitest';
import {
  calculateGeometry,
  normalizeRect,
  roundToPrecision
} from '../../core/dom/geometry';
import {
  Matrix4x4,
  parseTransformString,
  parseTransformOrigin,
  projectTransformedRect
} from '../../core/dom/matrix-projector';
import type { SourceRect } from '../../shared/contracts/source-node';

describe('Geometry and Coordinate Calculator', () => {
  it('normalizes fractional pixels and clamps invalid dimensions', () => {
    expect(roundToPrecision(12.3456, 2)).toBe(12.35);
    expect(roundToPrecision(NaN)).toBe(0);
    expect(roundToPrecision(Infinity)).toBe(0);

    const rect = normalizeRect(10.555, 20.444, -50, 100.123);
    expect(rect.x).toBe(10.56);
    expect(rect.y).toBe(20.44);
    expect(rect.width).toBe(0); // Clamped negative width
    expect(rect.height).toBe(100.12);
  });

  it('measures viewport sourceRect and documentRect with page scroll offsets', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);

    // Mock getBoundingClientRect
    el.getBoundingClientRect = () => ({
      left: 100,
      top: 50,
      right: 300,
      bottom: 150,
      width: 200,
      height: 100,
      x: 100,
      y: 50,
      toJSON: () => {}
    });

    // Static element with scroll (scrollX: 25, scrollY: 150)
    const result = calculateGeometry(el, 25, 150, 'static');
    expect(result.sourceRect).toEqual({ x: 100, y: 50, width: 200, height: 100 });
    expect(result.documentRect).toEqual({ x: 125, y: 200, width: 200, height: 100 });
    expect(result.isFixedOrSticky).toBe(false);

    // Fixed element
    const fixedResult = calculateGeometry(el, 25, 150, 'fixed');
    expect(fixedResult.isFixedOrSticky).toBe(true);
    expect(fixedResult.position).toBe('fixed');

    // Sticky element
    const stickyResult = calculateGeometry(el, 25, 150, 'sticky');
    expect(stickyResult.isFixedOrSticky).toBe(true);
    expect(stickyResult.position).toBe('sticky');

    document.body.removeChild(el);
  });
});

describe('3D Matrix Decomposition and Projection Engine', () => {
  const baseRect: SourceRect = { x: 100, y: 100, width: 200, height: 100 };

  it('returns unchanged rectangle when transform is none or empty', () => {
    const resNone = projectTransformedRect(baseRect, 'none');
    expect(resNone.projectedRect).toEqual(baseRect);
    expect(resNone.isTransformed).toBe(false);
    expect(resNone.is3D).toBe(false);
    expect(resNone.diagnostic).toBeUndefined();

    const resEmpty = projectTransformedRect(baseRect, '');
    expect(resEmpty.projectedRect).toEqual(baseRect);
    expect(resEmpty.isTransformed).toBe(false);
  });

  it('projects 2D translation matrix accurately', () => {
    // matrix(1, 0, 0, 1, 50, 30) -> translate(50px, 30px)
    const res = projectTransformedRect(baseRect, 'matrix(1, 0, 0, 1, 50, 30)');
    expect(res.isTransformed).toBe(true);
    expect(res.is3D).toBe(false);
    expect(res.projectedRect).toEqual({
      x: 150,
      y: 130,
      width: 200,
      height: 100
    });
    expect(res.diagnostic).toBeUndefined();
  });

  it('projects 2D scaling around center transform origin', () => {
    // matrix(2, 0, 0, 2, 0, 0) -> scale 2x around center (100, 50)
    const res = projectTransformedRect(baseRect, 'matrix(2, 0, 0, 2, 0, 0)', '100px 50px');
    expect(res.isTransformed).toBe(true);
    expect(res.is3D).toBe(false);
    // Center was (200, 150), size doubles to 400x200, top-left is (0, 50)
    expect(res.projectedRect).toEqual({
      x: 0,
      y: 50,
      width: 400,
      height: 200
    });
  });

  it('projects 2D 90-degree rotation bounds enclosing convex hull', () => {
    // 90 deg rotation around center (100, 50):
    // cos(90) = 0, sin(90) = 1, -sin(90) = -1, cos(90) = 0
    // matrix(0, 1, -1, 0, 0, 0)
    const res = projectTransformedRect(baseRect, 'matrix(0, 1, -1, 0, 0, 0)', '100px 50px');
    expect(res.isTransformed).toBe(true);
    expect(res.is3D).toBe(false);
    // 200x100 rotated 90 deg around its center becomes 100x200
    expect(res.projectedRect.width).toBe(100);
    expect(res.projectedRect.height).toBe(200);
  });

  it('detects 3D transforms, projects flat 2D bounds, and emits diagnostic', () => {
    // 3D rotation with perspective / z influence:
    // matrix3d(1, 0, 0, 0,  0, 0.7071, 0.7071, 0,  0, -0.7071, 0.7071, 0,  0, 0, 100, 1)
    const transform3d =
      'matrix3d(1, 0, 0, 0, 0, 0.7071, 0.7071, 0, 0, -0.7071, 0.7071, 0, 0, 0, 100, 1)';
    const res = projectTransformedRect(baseRect, transform3d, '100px 50px', 'node_test_3d');

    expect(res.isTransformed).toBe(true);
    expect(res.is3D).toBe(true);
    expect(res.diagnostic).toBeDefined();
    expect(res.diagnostic?.code).toBe('TRANSFORM_3D_PROJECTED_FLAT');
    expect(res.diagnostic?.severity).toBe('info');
    expect(res.diagnostic?.nodeId).toBe('node_test_3d');
    expect(res.projectedRect.width).toBeGreaterThan(0);
    expect(res.projectedRect.height).toBeGreaterThan(0);
  });

  it('parses transform origin keywords and percentages correctly', () => {
    const origin1 = parseTransformOrigin('50% 50%', 200, 100);
    expect(origin1).toEqual({ x: 100, y: 50 });

    const origin2 = parseTransformOrigin('left top', 200, 100);
    expect(origin2).toEqual({ x: 0, y: 0 });

    const origin3 = parseTransformOrigin('right bottom', 200, 100);
    expect(origin3).toEqual({ x: 200, y: 100 });

    const origin4 = parseTransformOrigin('25px 75px', 200, 100);
    expect(origin4).toEqual({ x: 25, y: 75 });
  });
});
