import { describe, it, expect } from 'vitest';
import { generateDesignSystemBoards } from '../../core/design-system/design-system-board';
import type { SceneNode } from '../../shared/contracts/scene';

describe('Design-System Boards Generator (Phase 21)', () => {
  const sampleNodes: SceneNode[] = [
    // Frame with colors and layout
    {
      id: 'f1',
      parentId: null,
      childIds: ['btn1', 'btn2', 't1'],
      name: 'Hero Section',
      type: 'FRAME',
      visible: true,
      x: 0,
      y: 0,
      width: 1200,
      height: 600,
      rotation: 0,
      cornerRadius: 16,
      fills: [{ type: 'SOLID', color: { r: 0.98, g: 0.98, b: 0.98, a: 1 }, opacity: 1, visible: true }],
      strokes: [{ color: { r: 0.9, g: 0.9, b: 0.9, a: 1 }, weight: 1, align: 'INSIDE', visible: true }],
      effects: [],
      clipsContent: true,
      layoutMetadata: {
        layoutMode: 'VERTICAL',
        itemSpacing: 24,
        padding: { top: 32, right: 32, bottom: 32, left: 32 }
      }
    },
    // Heading Text
    {
      id: 't1',
      parentId: 'f1',
      childIds: [],
      name: 'Main Title',
      type: 'TEXT',
      visible: true,
      x: 32,
      y: 32,
      width: 800,
      height: 48,
      rotation: 0,
      fills: [{ type: 'SOLID', color: { r: 0.1, g: 0.1, b: 0.1, a: 1 }, opacity: 1, visible: true }],
      strokes: [],
      effects: [],
      clipsContent: false,
      textData: {
        text: 'Design System Extraction',
        fontSize: 36,
        fontWeight: 700,
        fontFamily: 'Inter',
        lineHeight: 44,
        textAlign: 'LEFT'
      }
    },
    // Button 1 (Repeated candidate)
    {
      id: 'btn1',
      parentId: 'f1',
      childIds: ['btn1_txt'],
      name: 'Primary Button',
      type: 'FRAME',
      visible: true,
      x: 32,
      y: 100,
      width: 140,
      height: 40,
      rotation: 0,
      cornerRadius: 8,
      fills: [{ type: 'SOLID', color: { r: 0.2, g: 0.5, b: 0.9, a: 1 }, opacity: 1, visible: true }],
      strokes: [],
      effects: [],
      clipsContent: true
    },
    {
      id: 'btn1_txt',
      parentId: 'btn1',
      childIds: [],
      name: 'Label',
      type: 'TEXT',
      visible: true,
      x: 16,
      y: 10,
      width: 100,
      height: 20,
      rotation: 0,
      fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1, visible: true }],
      strokes: [],
      effects: [],
      clipsContent: false,
      textData: {
        text: 'Get Started',
        fontSize: 14,
        fontWeight: 600,
        fontFamily: 'Inter',
        textAlign: 'CENTER'
      }
    },
    // Button 2 (Repeated candidate)
    {
      id: 'btn2',
      parentId: 'f1',
      childIds: ['btn2_txt'],
      name: 'Secondary Button',
      type: 'FRAME',
      visible: true,
      x: 190,
      y: 100,
      width: 140,
      height: 40,
      rotation: 0,
      cornerRadius: 8,
      fills: [{ type: 'SOLID', color: { r: 0.2, g: 0.5, b: 0.9, a: 1 }, opacity: 1, visible: true }],
      strokes: [],
      effects: [],
      clipsContent: true
    },
    {
      id: 'btn2_txt',
      parentId: 'btn2',
      childIds: [],
      name: 'Label',
      type: 'TEXT',
      visible: true,
      x: 16,
      y: 10,
      width: 100,
      height: 20,
      rotation: 0,
      fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1, visible: true }],
      strokes: [],
      effects: [],
      clipsContent: false,
      textData: {
        text: 'Learn More',
        fontSize: 14,
        fontWeight: 600,
        fontFamily: 'Inter',
        textAlign: 'CENTER'
      }
    }
  ];

  it('generates all 4 design system reference boards with proper non-overlapping spacing', () => {
    const result = generateDesignSystemBoards(sampleNodes, {
      boardGap: 200,
      startX: 0,
      startY: 0
    });

    expect(result.boardFrames).toHaveLength(4);
    expect(result.summary.colorTokenCount).toBeGreaterThan(0);
    expect(result.summary.typographyTokenCount).toBeGreaterThan(0);
    expect(result.summary.spacingTokenCount).toBeGreaterThan(0);
    expect(result.summary.componentCandidateCount).toBeGreaterThan(0);

    const [colorBoard, typoBoard, spacingBoard, compBoard] = result.boardFrames;
    expect(colorBoard?.name).toBe('Design System — Color Palette');
    expect(typoBoard?.name).toBe('Design System — Typography Scale');
    expect(spacingBoard?.name).toBe('Design System — Spacing & Radius Tokens');
    expect(compBoard?.name).toBe('Design System — Inferred Component Candidates');

    // Verify non-overlapping sequential Y progression
    expect(typoBoard!.y).toBeGreaterThanOrEqual(colorBoard!.y + colorBoard!.height + 200);
    expect(spacingBoard!.y).toBeGreaterThanOrEqual(typoBoard!.y + typoBoard!.height + 200);
    expect(compBoard!.y).toBeGreaterThanOrEqual(spacingBoard!.y + spacingBoard!.height + 200);
  });

  it('selectively excludes boards when requested in options', () => {
    const result = generateDesignSystemBoards(sampleNodes, {
      includeColors: true,
      includeTypography: false,
      includeSpacing: false,
      includeComponents: false
    });

    expect(result.boardFrames).toHaveLength(1);
    expect(result.boardFrames[0]?.name).toBe('Design System — Color Palette');
  });

  it('includes honest non-claim disclaimer in inferred components board', () => {
    const result = generateDesignSystemBoards(sampleNodes, {
      includeColors: false,
      includeTypography: false,
      includeSpacing: false,
      includeComponents: true
    });

    const disclaimerNode = result.allNodes.find((n) => n.id === 'board_inferred_components_disclaimer');
    expect(disclaimerNode?.textData?.text).toContain(
      'Not proven to be source-code reusable components'
    );
  });
});
