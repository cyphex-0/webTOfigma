import { describe, it, expect } from 'vitest';
import {
  detectRepeatedComponents,
  classifyCandidateType,
  computeComponentSignature
} from '../../core/design-system/repeated-component-detector';
import type { SceneNode } from '../../shared/contracts/scene';

describe('Repeated Component Pattern Detector (Phase 21)', () => {
  const createButton = (id: string, text: string): { btn: SceneNode; label: SceneNode } => {
    const label: SceneNode = {
      id: `${id}_label`,
      parentId: id,
      childIds: [],
      name: text,
      type: 'TEXT',
      visible: true,
      x: 16,
      y: 10,
      width: 60,
      height: 20,
      rotation: 0,
      fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1, visible: true }],
      strokes: [],
      effects: [],
      clipsContent: false,
      textData: {
        text,
        fontSize: 14,
        fontWeight: 600,
        fontFamily: 'Inter',
        textAlign: 'CENTER'
      }
    };

    const btn: SceneNode = {
      id,
      parentId: null,
      childIds: [label.id],
      name: `Button ${text}`,
      type: 'FRAME',
      visible: true,
      x: 0,
      y: 0,
      width: 120,
      height: 40,
      rotation: 0,
      cornerRadius: 6,
      fills: [{ type: 'SOLID', color: { r: 0.1, g: 0.5, b: 0.9, a: 1 }, opacity: 1, visible: true }],
      strokes: [],
      effects: [],
      clipsContent: true,
      layoutMetadata: {
        layoutMode: 'HORIZONTAL',
        itemSpacing: 8,
        padding: { top: 10, right: 16, bottom: 10, left: 16 }
      }
    };

    return { btn, label };
  };

  const createBadge = (id: string, text: string): { badge: SceneNode; label: SceneNode } => {
    const label: SceneNode = {
      id: `${id}_label`,
      parentId: id,
      childIds: [],
      name: text,
      type: 'TEXT',
      visible: true,
      x: 8,
      y: 4,
      width: 40,
      height: 14,
      rotation: 0,
      fills: [{ type: 'SOLID', color: { r: 0.2, g: 0.5, b: 0.2, a: 1 }, opacity: 1, visible: true }],
      strokes: [],
      effects: [],
      clipsContent: false,
      textData: {
        text,
        fontSize: 11,
        fontWeight: 500,
        fontFamily: 'Inter',
        textAlign: 'CENTER'
      }
    };

    const badge: SceneNode = {
      id,
      parentId: null,
      childIds: [label.id],
      name: `Badge ${text}`,
      type: 'FRAME',
      visible: true,
      x: 0,
      y: 0,
      width: 64,
      height: 22,
      rotation: 0,
      cornerRadius: 11,
      fills: [{ type: 'SOLID', color: { r: 0.9, g: 0.96, b: 0.9, a: 1 }, opacity: 1, visible: true }],
      strokes: [],
      effects: [],
      clipsContent: true
    };

    return { badge, label };
  };

  it('classifies button and badge candidate frames correctly', () => {
    const { btn, label: btnLabel } = createButton('b1', 'Submit');
    expect(classifyCandidateType(btn, [btnLabel])).toBe('button');

    const { badge, label: badgeLabel } = createBadge('bg1', 'Active');
    expect(classifyCandidateType(badge, [badgeLabel])).toBe('badge');
  });

  it('detects recurring buttons and groups them into a candidate pattern', () => {
    const b1 = createButton('btn_1', 'Sign In');
    const b2 = createButton('btn_2', 'Sign Up');
    const b3 = createButton('btn_3', 'Continue');

    const nodes = [b1.btn, b1.label, b2.btn, b2.label, b3.btn, b3.label];

    const candidates = detectRepeatedComponents(nodes, { minInstances: 2 });
    expect(candidates).toHaveLength(1);

    const btnPattern = candidates[0]!;
    expect(btnPattern.candidateType).toBe('button');
    expect(btnPattern.instanceCount).toBe(3);
    expect(btnPattern.name).toContain('Inferred Visual Component: Button (3 instances)');
    expect(btnPattern.disclaimer).toContain('Not proven to be a source-code reusable component');
  });

  it('ignores unique one-off components', () => {
    const b1 = createButton('btn_unique', 'Only Once');
    const bg1 = createBadge('badge_unique', 'Only Once');

    const nodes = [b1.btn, b1.label, bg1.badge, bg1.label];

    // minInstances is 2; one button and one badge must produce zero candidates
    const candidates = detectRepeatedComponents(nodes, { minInstances: 2 });
    expect(candidates).toHaveLength(0);
  });
});
