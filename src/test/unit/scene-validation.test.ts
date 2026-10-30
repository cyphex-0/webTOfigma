import { describe, it, expect } from 'vitest';
import { validatePageScene } from '../../core/scene/scene-validation';
import { PageScene, SceneNode } from '../../shared/contracts/scene';

function createMockPageScene(nodes: SceneNode[]): PageScene {
  const pageFrame = nodes[0]!;
  return {
    metadata: {
      schemaVersion: 1,
      pageIndex: 0,
      requestedUrl: 'https://acme.io/',
      finalUrl: 'https://acme.io/',
      title: 'Acme Home',
      readinessState: 'complete',
      capturedAt: Date.now(),
      viewport: { width: 1440, height: 900, devicePixelRatio: 2, scrollX: 0, scrollY: 0 },
      documentDimensions: { width: 1440, height: 1800 },
      captureMode: 'full-page',
      totalNodes: nodes.length
    },
    pageFrame,
    nodes,
    diagnostics: []
  };
}

describe('Scene Graph Validation', () => {
  it('validates a clean, consistent scene tree', () => {
    const root: SceneNode = {
      id: 'root',
      parentId: null,
      childIds: ['child_1'],
      name: '01 — Acme Home — /',
      type: 'FRAME',
      visible: true,
      x: 0,
      y: 0,
      width: 1440,
      height: 900,
      rotation: 0,
      fills: [],
      strokes: [],
      effects: [],
      clipsContent: true
    };

    const child: SceneNode = {
      id: 'child_1',
      parentId: 'root',
      childIds: [],
      name: 'Heading — H1',
      type: 'TEXT',
      visible: true,
      x: 40,
      y: 80,
      width: 400,
      height: 60,
      rotation: 0,
      fills: [],
      strokes: [],
      effects: [],
      clipsContent: false,
      textData: {
        text: 'Welcome to Acme',
        fontFamily: 'Inter',
        fontSize: 32,
        fontWeight: 700,
        textAlign: 'LEFT'
      }
    };

    const scene = createMockPageScene([root, child]);
    const result = validatePageScene(scene);

    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('detects bidirectional parent-child mismatch', () => {
    const root: SceneNode = {
      id: 'root',
      parentId: null,
      childIds: [], // Root forgot child_1
      name: '01 — Acme Home — /',
      type: 'FRAME',
      visible: true,
      x: 0,
      y: 0,
      width: 1440,
      height: 900,
      rotation: 0,
      fills: [],
      strokes: [],
      effects: [],
      clipsContent: true
    };

    const child: SceneNode = {
      id: 'child_1',
      parentId: 'root',
      childIds: [],
      name: 'Text',
      type: 'TEXT',
      visible: true,
      x: 10,
      y: 10,
      width: 100,
      height: 20,
      rotation: 0,
      fills: [],
      strokes: [],
      effects: [],
      clipsContent: false,
      textData: {
        text: 'Text',
        fontFamily: 'Inter',
        fontSize: 16,
        fontWeight: 400,
        textAlign: 'LEFT'
      }
    };

    const scene = createMockPageScene([root, child]);
    const result = validatePageScene(scene);

    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('does not contain it'))).toBe(true);
  });

  it('detects hierarchy cycles', () => {
    const root: SceneNode = {
      id: 'root',
      parentId: null,
      childIds: ['node_a'],
      name: 'Page Frame',
      type: 'FRAME',
      visible: true,
      x: 0,
      y: 0,
      width: 1000,
      height: 800,
      rotation: 0,
      fills: [],
      strokes: [],
      effects: [],
      clipsContent: true
    };

    const nodeA: SceneNode = {
      id: 'node_a',
      parentId: 'root',
      childIds: ['node_b'],
      name: 'Container A',
      type: 'FRAME',
      visible: true,
      x: 10,
      y: 10,
      width: 200,
      height: 200,
      rotation: 0,
      fills: [],
      strokes: [],
      effects: [],
      clipsContent: false
    };

    // Cycle: B points back to A as its child
    const nodeB: SceneNode = {
      id: 'node_b',
      parentId: 'node_a',
      childIds: ['node_a'],
      name: 'Container B',
      type: 'FRAME',
      visible: true,
      x: 20,
      y: 20,
      width: 100,
      height: 100,
      rotation: 0,
      fills: [],
      strokes: [],
      effects: [],
      clipsContent: false
    };

    const scene = createMockPageScene([root, nodeA, nodeB]);
    const result = validatePageScene(scene);

    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('Cycle detected'))).toBe(true);
  });

  it('detects non-finite geometry and missing textData', () => {
    const root: SceneNode = {
      id: 'root',
      parentId: null,
      childIds: ['bad_text'],
      name: 'Page Frame',
      type: 'FRAME',
      visible: true,
      x: 0,
      y: 0,
      width: 1000,
      height: 800,
      rotation: 0,
      fills: [],
      strokes: [],
      effects: [],
      clipsContent: true
    };

    const badText: SceneNode = {
      id: 'bad_text',
      parentId: 'root',
      childIds: [],
      name: 'Bad Text',
      type: 'TEXT',
      visible: true,
      x: NaN,
      y: 10,
      width: 0,
      height: -20,
      rotation: 0,
      fills: [],
      strokes: [],
      effects: [],
      clipsContent: false
      // missing textData
    };

    const scene = createMockPageScene([root, badText]);
    const result = validatePageScene(scene);

    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('non-finite coordinates'))).toBe(true);
    expect(result.errors.some((e) => e.includes('missing textData'))).toBe(true);
  });
});
