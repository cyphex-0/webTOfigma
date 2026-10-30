import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DOMWalker } from '../../core/dom/dom-walker';
import { buildComplexTestDomFixture, type TestDomFixture } from '../../core/dom/dom-fixture-builder';
import { SourceNodeSchema } from '../../shared/schemas/source-node.schema';
import { PageCaptureMetadataSchema } from '../../shared/schemas/page-capture.schema';

describe('DOMWalker Engine and End-to-End Fixture Extraction', () => {
  let fixture: TestDomFixture;

  beforeEach(() => {
    fixture = buildComplexTestDomFixture();
  });

  afterEach(() => {
    fixture.cleanup();
  });

  it('traverses complex DOM fixture and validates every node against SourceNodeSchema', () => {
    const walker = new DOMWalker({
      rootElement: fixture.container,
      maxNodeCount: 500,
      maxDepth: 30,
      resolvePaintOrder: true
    });

    const result = walker.walk(fixture.container);

    expect(result.nodes.length).toBeGreaterThan(5);
    expect(result.metadata).toBeDefined();

    // Validate metadata against PageCaptureMetadataSchema
    const metaParse = PageCaptureMetadataSchema.safeParse(result.metadata);
    expect(metaParse.success).toBe(true);

    // Validate EVERY node against SourceNodeSchema
    for (const node of result.nodes) {
      const nodeParse = SourceNodeSchema.safeParse(node);
      if (!nodeParse.success) {
        console.error('Failed node schema validation:', node.sourceTag, nodeParse.error.format());
      }
      expect(nodeParse.success).toBe(true);
    }
  });

  it('produces deterministic node IDs and identical tree structures across multiple runs', () => {
    const walker1 = new DOMWalker({ rootElement: fixture.container });
    const result1 = walker1.walk(fixture.container);

    const walker2 = new DOMWalker({ rootElement: fixture.container });
    const result2 = walker2.walk(fixture.container);

    expect(result1.nodes.length).toBe(result2.nodes.length);
    for (let i = 0; i < result1.nodes.length; i++) {
      const n1 = result1.nodes[i]!;
      const n2 = result2.nodes[i]!;
      expect(n1.nodeId).toBe(n2.nodeId);
      expect(n1.sourceTag).toBe(n2.sourceTag);
      expect(n1.childIds).toEqual(n2.childIds);
      expect(n1.textRuns).toEqual(n2.textRuns);
    }
  });

  it('prunes extension UI overlays marked with data-w2f-exclude="true"', () => {
    const walker = new DOMWalker({ rootElement: fixture.container });
    const result = walker.walk(fixture.container);

    // Find any node that came from the excluded overlay
    const excludedFound = result.nodes.some(
      (n) => n.textRuns.some((tr) => tr.text.includes('In-Page Minibar Overlay'))
    );
    expect(excludedFound).toBe(false);
  });

  it('enforces strict privacy and never extracts user passwords or confidential values', () => {
    const walker = new DOMWalker({ rootElement: fixture.container });
    const result = walker.walk(fixture.container);

    const serializedTree = JSON.stringify(result.nodes);

    // Confirm passwords, confidential form values are NOT anywhere in the capture
    expect(serializedTree).not.toContain('super_secret_pw_999!');
    expect(serializedTree).not.toContain('My confidential diary entry');

    // Confirm input type and placeholder are preserved
    const passwordNode = result.nodes.find(
      (n) => n.sourceTag === 'input' && n.accessibleLabel === 'Password'
    );
    expect(passwordNode).toBeDefined();
    expect((passwordNode as any).value).toBeUndefined();
  });

  it('safely stops traversal and reports MAX_NODES_EXCEEDED when node limit is breached', () => {
    const walker = new DOMWalker({
      rootElement: fixture.container,
      maxNodeCount: 4
    });

    const result = walker.walk(fixture.container);
    expect(result.nodes.length).toBeLessThanOrEqual(4);

    const limitDiagnostic = result.diagnostics.find((d) => d.code === 'MAX_NODES_EXCEEDED');
    expect(limitDiagnostic).toBeDefined();
    expect(limitDiagnostic?.severity).toBe('warning');
  });

  it('safely prunes deep descendants and reports MAX_DEPTH_EXCEEDED when depth limit is breached', () => {
    const walker = new DOMWalker({
      rootElement: fixture.container,
      maxDepth: 1
    });

    const result = walker.walk(fixture.container);
    const depthDiagnostic = result.diagnostics.find((d) => d.code === 'MAX_DEPTH_EXCEEDED');
    expect(depthDiagnostic).toBeDefined();
    expect(depthDiagnostic?.severity).toBe('warning');
  });

  it('traverses open Shadow DOM and captures internal shadow elements', () => {
    const walker = new DOMWalker({ rootElement: fixture.container });
    const result = walker.walk(fixture.container);

    const shadowHeadingNode = result.nodes.find(
      (n) => n.sourceTag === 'h4' && n.textRuns.some((tr) => tr.text.includes('Shadow DOM Root'))
    );
    expect(shadowHeadingNode).toBeDefined();
  });

  it('handles closed Shadow DOM custom elements with light-DOM slotted nodes and diagnostic', () => {
    const walker = new DOMWalker({ rootElement: fixture.container });
    const result = walker.walk(fixture.container);

    const closedDiag = result.diagnostics.find(
      (d) => d.code === 'CLOSED_SHADOW_ROOT_ENCAPSULATED'
    );
    expect(closedDiag).toBeDefined();

    // Confirm slotted light-DOM children were preserved
    const slottedNode = result.nodes.find(
      (n) => n.textRuns.some((tr) => tr.text.includes('Slotted Light DOM Heading'))
    );
    expect(slottedNode).toBeDefined();
  });

  it('detects 3D transforms, projects 2D convex bounds, and emits TRANSFORM_3D_PROJECTED_FLAT', () => {
    const walker = new DOMWalker({ rootElement: fixture.container });
    const result = walker.walk(fixture.container);

    const transform3dDiag = result.diagnostics.find(
      (d) => d.code === 'TRANSFORM_3D_PROJECTED_FLAT'
    );
    expect(transform3dDiag).toBeDefined();

    const card3d = result.nodes.find(
      (n) => n.computedStyle.transform.includes('matrix3d')
    );
    expect(card3d).toBeDefined();
    expect(card3d?.sourceRect.width).toBeGreaterThan(0);
    expect(card3d?.sourceRect.height).toBeGreaterThan(0);
  });
});
