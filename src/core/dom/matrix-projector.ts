/**
 * 3D Matrix Decomposition and Flat Projection Engine.
 * Parses computed CSS transform matrices (2D matrix and 3D matrix3d), projects 3D/2D
 * transformed element vertices into axis-aligned 2D bounding boxes, and emits
 * TRANSFORM_3D_PROJECTED_FLAT diagnostics for non-planar transformations.
 */

import type { SourceRect } from '../../shared/contracts/source-node';
import type { ExportDiagnostic } from '../../shared/contracts/diagnostics';
import { normalizeRect, roundToPrecision } from './geometry';

export interface Point2D {
  x: number;
  y: number;
}

export interface TransformOrigin {
  x: number;
  y: number;
}

export interface ProjectedTransformResult {
  projectedRect: SourceRect;
  is3D: boolean;
  isTransformed: boolean;
  diagnostic?: ExportDiagnostic | undefined;
}

/**
 * 4x4 Transformation Matrix representation.
 * Stored in column-major order matching CSS matrix3d specification:
 * [ m11, m12, m13, m14,
 *   m21, m22, m23, m24,
 *   m31, m32, m33, m34,
 *   m41, m42, m43, m44 ]
 */
export class Matrix4x4 {
  public m: Float64Array;

  constructor(elements?: number[]) {
    this.m = new Float64Array(16);
    if (elements && elements.length === 16) {
      this.m.set(elements);
    } else {
      this.identity();
    }
  }

  identity(): void {
    this.m.fill(0);
    this.m[0] = 1;
    this.m[5] = 1;
    this.m[10] = 1;
    this.m[15] = 1;
  }

  static from2D(a: number, b: number, c: number, d: number, tx: number, ty: number): Matrix4x4 {
    const mat = new Matrix4x4();
    mat.m[0] = a;
    mat.m[1] = b;
    mat.m[4] = c;
    mat.m[5] = d;
    mat.m[12] = tx;
    mat.m[13] = ty;
    return mat;
  }

  static from3D(elements: number[]): Matrix4x4 {
    if (elements.length !== 16) {
      throw new Error(`matrix3d requires exactly 16 values, got ${elements.length}`);
    }
    return new Matrix4x4(elements);
  }

  /**
   * Checks if matrix has non-planar 3D components (rotation out of plane, z-translation, perspective).
   */
  isNonPlanar3D(): boolean {
    const m = this.m;
    // Check z column/row influence (m13, m23, m31, m32, m33 !== 1, m43 !== 0)
    // Check perspective row (m14, m24, m34 !== 0, m44 !== 1)
    const hasZInfluence =
      Math.abs(m[2] ?? 0) > 1e-5 ||
      Math.abs(m[6] ?? 0) > 1e-5 ||
      Math.abs(m[8] ?? 0) > 1e-5 ||
      Math.abs(m[9] ?? 0) > 1e-5 ||
      Math.abs((m[10] ?? 1) - 1) > 1e-5 ||
      Math.abs(m[14] ?? 0) > 1e-5;

    const hasPerspective =
      Math.abs(m[3] ?? 0) > 1e-5 ||
      Math.abs(m[7] ?? 0) > 1e-5 ||
      Math.abs(m[11] ?? 0) > 1e-5 ||
      Math.abs((m[15] ?? 1) - 1) > 1e-5;

    return hasZInfluence || hasPerspective;
  }

  /**
   * Checks whether this matrix is effectively an identity matrix (no transform).
   */
  isIdentity(): boolean {
    const m = this.m;
    return (
      Math.abs((m[0] ?? 1) - 1) < 1e-5 &&
      Math.abs(m[1] ?? 0) < 1e-5 &&
      Math.abs(m[2] ?? 0) < 1e-5 &&
      Math.abs(m[3] ?? 0) < 1e-5 &&
      Math.abs(m[4] ?? 0) < 1e-5 &&
      Math.abs((m[5] ?? 1) - 1) < 1e-5 &&
      Math.abs(m[6] ?? 0) < 1e-5 &&
      Math.abs(m[7] ?? 0) < 1e-5 &&
      Math.abs(m[8] ?? 0) < 1e-5 &&
      Math.abs(m[9] ?? 0) < 1e-5 &&
      Math.abs((m[10] ?? 1) - 1) < 1e-5 &&
      Math.abs(m[11] ?? 0) < 1e-5 &&
      Math.abs(m[12] ?? 0) < 1e-5 &&
      Math.abs(m[13] ?? 0) < 1e-5 &&
      Math.abs(m[14] ?? 0) < 1e-5 &&
      Math.abs((m[15] ?? 1) - 1) < 1e-5
    );
  }

  /**
   * Transforms a 2D local point (x, y) through the 4x4 matrix with perspective division.
   */
  transformPoint(x: number, y: number, z = 0): Point2D {
    const m = this.m;
    const m0 = m[0] ?? 1;
    const m1 = m[1] ?? 0;
    const m3 = m[3] ?? 0;
    const m4 = m[4] ?? 0;
    const m5 = m[5] ?? 1;
    const m7 = m[7] ?? 0;
    const m8 = m[8] ?? 0;
    const m9 = m[9] ?? 0;
    const m11 = m[11] ?? 0;
    const m12 = m[12] ?? 0;
    const m13 = m[13] ?? 0;
    const m15 = m[15] ?? 1;

    const px = m0 * x + m4 * y + m8 * z + m12;
    const py = m1 * x + m5 * y + m9 * z + m13;
    const pw = m3 * x + m7 * y + m11 * z + m15;

    // Apply perspective division if w != 1 and w != 0
    if (Math.abs(pw - 1) > 1e-6 && Math.abs(pw) > 1e-6) {
      return { x: px / pw, y: py / pw };
    }

    return { x: px, y: py };
  }
}

/**
 * Parses a computed CSS transform string into a 4x4 matrix.
 */
export function parseTransformString(transformStr?: string | null): Matrix4x4 {
  if (!transformStr || transformStr === 'none' || transformStr.trim() === '') {
    return new Matrix4x4();
  }

  const str = transformStr.trim();

  // 1. Check for matrix(a, b, c, d, e, f)
  const matrix2dMatch = str.match(/^matrix\s*\(([^)]+)\)$/i);
  if (matrix2dMatch && matrix2dMatch[1]) {
    const parts = matrix2dMatch[1].split(',').map((p) => parseFloat(p.trim()));
    if (parts.length === 6 && parts.every((n) => Number.isFinite(n))) {
      return Matrix4x4.from2D(parts[0]!, parts[1]!, parts[2]!, parts[3]!, parts[4]!, parts[5]!);
    }
  }

  // 2. Check for matrix3d(m1, m2, ..., m16)
  const matrix3dMatch = str.match(/^matrix3d\s*\(([^)]+)\)$/i);
  if (matrix3dMatch && matrix3dMatch[1]) {
    const parts = matrix3dMatch[1].split(',').map((p) => parseFloat(p.trim()));
    if (parts.length === 16 && parts.every((n) => Number.isFinite(n))) {
      return Matrix4x4.from3D(parts);
    }
  }

  // Fallback to identity matrix for unhandled or invalid strings
  return new Matrix4x4();
}

/**
 * Parses computed transform-origin string into absolute coordinates relative to the element box.
 * Default is "50% 50%" (element center).
 */
export function parseTransformOrigin(
  originStr?: string | null,
  width = 0,
  height = 0
): TransformOrigin {
  const defaultOrigin = { x: width / 2, y: height / 2 };
  if (!originStr || originStr.trim() === '') return defaultOrigin;

  const parts = originStr.trim().split(/\s+/);
  const xPart = parts[0];
  const yPart = parts[1];

  let x = width / 2;
  let y = height / 2;

  if (xPart) {
    if (xPart.endsWith('%')) {
      x = (parseFloat(xPart) / 100) * width;
    } else if (xPart.endsWith('px')) {
      x = parseFloat(xPart);
    } else if (xPart === 'left') {
      x = 0;
    } else if (xPart === 'right') {
      x = width;
    } else if (xPart === 'center') {
      x = width / 2;
    }
  }

  if (yPart) {
    if (yPart.endsWith('%')) {
      y = (parseFloat(yPart) / 100) * height;
    } else if (yPart.endsWith('px')) {
      y = parseFloat(yPart);
    } else if (yPart === 'top') {
      y = 0;
    } else if (yPart === 'bottom') {
      y = height;
    } else if (yPart === 'center') {
      y = height / 2;
    }
  }

  return {
    x: Number.isFinite(x) ? x : width / 2,
    y: Number.isFinite(y) ? y : height / 2
  };
}

/**
 * Projects transformed element bounds into an axis-aligned 2D bounding box.
 * If the element has a 3D transform, flattens the vertices to 2D and emits a diagnostic.
 */
export function projectTransformedRect(
  baseRect: SourceRect,
  transformStr?: string | null,
  originStr?: string | null,
  nodeId?: string
): ProjectedTransformResult {
  const matrix = parseTransformString(transformStr);

  if (matrix.isIdentity()) {
    return {
      projectedRect: baseRect,
      is3D: false,
      isTransformed: false
    };
  }

  const is3D = matrix.isNonPlanar3D();
  const origin = parseTransformOrigin(originStr, baseRect.width, baseRect.height);

  // Define 4 corner vertices relative to element origin
  const localCorners: Point2D[] = [
    { x: -origin.x, y: -origin.y },
    { x: baseRect.width - origin.x, y: -origin.y },
    { x: baseRect.width - origin.x, y: baseRect.height - origin.y },
    { x: -origin.x, y: baseRect.height - origin.y }
  ];

  // Transform each vertex through the matrix and translate back from origin
  const transformedPoints: Point2D[] = localCorners.map((pt) => {
    const t = matrix.transformPoint(pt.x, pt.y);
    return {
      x: baseRect.x + origin.x + t.x,
      y: baseRect.y + origin.y + t.y
    };
  });

  // Compute 2D axis-aligned bounding box enclosing all transformed corners
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const pt of transformedPoints) {
    if (pt.x < minX) minX = pt.x;
    if (pt.x > maxX) maxX = pt.x;
    if (pt.y < minY) minY = pt.y;
    if (pt.y > maxY) maxY = pt.y;
  }

  const projectedRect = normalizeRect(
    minX,
    minY,
    Math.max(0, maxX - minX),
    Math.max(0, maxY - minY)
  );

  let diagnostic: ExportDiagnostic | undefined;
  if (is3D) {
    diagnostic = {
      severity: 'info',
      code: 'TRANSFORM_3D_PROJECTED_FLAT',
      message: 'Element with 3D transform was projected flat into an axis-aligned 2D bounding box.',
      phase: 'dom-extraction',
      ...(nodeId ? { nodeId } : {}),
      timestamp: Date.now()
    };
  }

  return {
    projectedRect,
    is3D,
    isTransformed: true,
    ...(diagnostic ? { diagnostic } : {})
  };
}
