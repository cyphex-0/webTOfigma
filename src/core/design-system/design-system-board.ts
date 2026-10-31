/**
 * Design-System Boards Generator.
 * 
 * Synthesizes extracted design tokens and visual component candidates
 * into clean, readable Figma reference boards:
 * 1. Color Palette Board (swatches, hex, frequency, CSS variables, cluster members)
 * 2. Typography Board (H1-H6, body, caption samples, font metrics, substitutions)
 * 3. Spacing & Radius Board (neutral "Spacing 16 px" tokens, radius chips)
 * 4. Inferred Components Board (exemplar frames, honest non-claim disclaimer)
 * 
 * Strictly additive, evidence-based, and non-distorting to core page exports.
 */

import type { SceneNode } from '../../shared/contracts/scene';
import { extractColorTokens, type ExtractedColorToken } from './color-token-extractor';
import { extractTypographyTokens, type ExtractedTypographyResult } from './typography-token-extractor';
import { extractSpacingTokens, type ExtractedSpacingResult } from './spacing-token-extractor';
import { detectRepeatedComponents, type RepeatedComponentCandidate } from './repeated-component-detector';

export interface DesignSystemBoardOptions {
  includeColors?: boolean | undefined; // default true
  includeTypography?: boolean | undefined; // default true
  includeSpacing?: boolean | undefined; // default true
  includeComponents?: boolean | undefined; // default true
  startX?: number | undefined; // default 0
  startY?: number | undefined; // default 0
  boardGap?: number | undefined; // default 160 px
}

export interface GeneratedDesignBoardsResult {
  boardFrames: SceneNode[];
  allNodes: SceneNode[];
  summary: {
    colorTokenCount: number;
    typographyTokenCount: number;
    spacingTokenCount: number;
    radiusTokenCount: number;
    componentCandidateCount: number;
  };
}

/**
 * Builds the Color Palette Board.
 */
function buildColorPaletteBoard(
  tokens: readonly ExtractedColorToken[],
  x: number,
  y: number
): { boardFrame: SceneNode; nodes: SceneNode[] } {
  const boardId = 'board_color_palette';
  const boardWidth = 1000;
  const padding = 32;
  const swatchWidth = 200;
  const swatchHeight = 72;
  const gap = 16;
  const columns = 4;

  const childIds: string[] = [];
  const nodes: SceneNode[] = [];

  // Title
  const titleId = `${boardId}_title`;
  childIds.push(titleId);
  nodes.push({
    id: titleId,
    parentId: boardId,
    childIds: [],
    name: 'Board Title',
    type: 'TEXT',
    visible: true,
    x: padding,
    y: padding,
    width: boardWidth - padding * 2,
    height: 28,
    rotation: 0,
    fills: [{ type: 'SOLID', color: { r: 0.1, g: 0.15, b: 0.2, a: 1 }, opacity: 1, visible: true }],
    strokes: [],
    effects: [],
    clipsContent: false,
    textData: {
      text: 'Design System — Color Palette',
      fontSize: 20,
      fontWeight: 700,
      fontFamily: 'Inter',
      lineHeight: 28,
      textAlign: 'LEFT'
    }
  });

  let currentX = padding;
  let currentY = padding + 48;
  let col = 0;

  tokens.slice(0, 24).forEach((tok, idx) => {
    const cardId = `${boardId}_swatch_${idx + 1}`;
    const rectId = `${cardId}_color`;
    const labelId = `${cardId}_label`;
    childIds.push(cardId);

    // Color Swatch Box
    const rectNode: SceneNode = {
      id: rectId,
      parentId: cardId,
      childIds: [],
      name: `Color ${tok.hex}`,
      type: 'RECTANGLE',
      visible: true,
      x: 0,
      y: 0,
      width: 48,
      height: 48,
      rotation: 0,
      cornerRadius: 6,
      fills: [{ type: 'SOLID', color: tok.rgba, opacity: 1, visible: true }],
      strokes: [
        {
          color: { r: 0.85, g: 0.88, b: 0.92, a: 1 },
          weight: 1,
          align: 'INSIDE',
          visible: true
        }
      ],
      effects: [],
      clipsContent: true
    };

    // Label Info
    const labelNode: SceneNode = {
      id: labelId,
      parentId: cardId,
      childIds: [],
      name: 'Hex Info',
      type: 'TEXT',
      visible: true,
      x: 58,
      y: 4,
      width: swatchWidth - 58,
      height: 40,
      rotation: 0,
      fills: [{ type: 'SOLID', color: { r: 0.2, g: 0.25, b: 0.3, a: 1 }, opacity: 1, visible: true }],
      strokes: [],
      effects: [],
      clipsContent: false,
      textData: {
        text: `${tok.hex}\n${tok.frequency}x (${tok.roles.join(', ')})`,
        fontSize: 12,
        fontWeight: 600,
        fontFamily: 'Inter',
        lineHeight: 18,
        textAlign: 'LEFT'
      }
    };

    // Card Container
    const cardNode: SceneNode = {
      id: cardId,
      parentId: boardId,
      childIds: [rectId, labelId],
      name: `Swatch: ${tok.hex}`,
      type: 'FRAME',
      visible: true,
      x: currentX,
      y: currentY,
      width: swatchWidth,
      height: swatchHeight,
      rotation: 0,
      fills: [],
      strokes: [],
      effects: [],
      clipsContent: false
    };

    nodes.push(cardNode, rectNode, labelNode);

    col++;
    if (col >= columns) {
      col = 0;
      currentX = padding;
      currentY += swatchHeight + gap;
    } else {
      currentX += swatchWidth + gap;
    }
  });

  const boardHeight = col === 0 ? currentY + padding : currentY + swatchHeight + padding;

  const boardFrame: SceneNode = {
    id: boardId,
    parentId: null,
    childIds,
    name: 'Design System — Color Palette',
    type: 'FRAME',
    visible: true,
    x,
    y,
    width: boardWidth,
    height: Math.max(200, boardHeight),
    rotation: 0,
    cornerRadius: 12,
    fills: [{ type: 'SOLID', color: { r: 0.98, g: 0.99, b: 1, a: 1 }, opacity: 1, visible: true }],
    strokes: [{ color: { r: 0.9, g: 0.92, b: 0.96, a: 1 }, weight: 1, align: 'INSIDE', visible: true }],
    effects: [],
    clipsContent: true
  };

  nodes.unshift(boardFrame);
  return { boardFrame, nodes };
}

/**
 * Builds the Typography Scale Board.
 */
function buildTypographyBoard(
  result: ExtractedTypographyResult,
  x: number,
  y: number
): { boardFrame: SceneNode; nodes: SceneNode[] } {
  const boardId = 'board_typography';
  const boardWidth = 1000;
  const padding = 32;

  const childIds: string[] = [];
  const nodes: SceneNode[] = [];

  // Title
  const titleId = `${boardId}_title`;
  childIds.push(titleId);
  nodes.push({
    id: titleId,
    parentId: boardId,
    childIds: [],
    name: 'Board Title',
    type: 'TEXT',
    visible: true,
    x: padding,
    y: padding,
    width: boardWidth - padding * 2,
    height: 28,
    rotation: 0,
    fills: [{ type: 'SOLID', color: { r: 0.1, g: 0.15, b: 0.2, a: 1 }, opacity: 1, visible: true }],
    strokes: [],
    effects: [],
    clipsContent: false,
    textData: {
      text: 'Design System — Typography Scale',
      fontSize: 20,
      fontWeight: 700,
      fontFamily: 'Inter',
      lineHeight: 28,
      textAlign: 'LEFT'
    }
  });

  let currentY = padding + 48;

  // Render font substitutions banner if present
  if (result.fontSubstitutions.length > 0) {
    const subId = `${boardId}_substitutions`;
    childIds.push(subId);
    const subText = result.fontSubstitutions
      .map((s) => `"${s.sourceFont}" substituted with "${s.resolvedFont}" (${s.count}x)`)
      .join(' • ');

    nodes.push({
      id: subId,
      parentId: boardId,
      childIds: [],
      name: 'Font Substitutions Note',
      type: 'TEXT',
      visible: true,
      x: padding,
      y: currentY,
      width: boardWidth - padding * 2,
      height: 20,
      rotation: 0,
      fills: [{ type: 'SOLID', color: { r: 0.7, g: 0.35, b: 0.05, a: 1 }, opacity: 1, visible: true }],
      strokes: [],
      effects: [],
      clipsContent: false,
      textData: {
        text: `Notice: ${subText}`,
        fontSize: 12,
        fontWeight: 500,
        fontFamily: 'Inter',
        lineHeight: 18,
        textAlign: 'LEFT'
      }
    });

    currentY += 32;
  }

  // Render up to 10 top typography tokens
  result.tokens.slice(0, 10).forEach((tok, idx) => {
    const rowId = `${boardId}_row_${idx + 1}`;
    childIds.push(rowId);

    const rowNode: SceneNode = {
      id: rowId,
      parentId: boardId,
      childIds: [],
      name: tok.name,
      type: 'TEXT',
      visible: true,
      x: padding,
      y: currentY,
      width: boardWidth - padding * 2,
      height: Math.max(32, tok.lineHeight + 12),
      rotation: 0,
      fills: [{ type: 'SOLID', color: { r: 0.15, g: 0.2, b: 0.25, a: 1 }, opacity: 1, visible: true }],
      strokes: [],
      effects: [],
      clipsContent: false,
      textData: {
        text: `${tok.role} (${tok.fontSize}px / ${tok.fontWeight}) — The quick brown fox jumps over the lazy dog`,
        fontSize: tok.fontSize,
        fontWeight: tok.fontWeight,
        fontFamily: tok.resolvedFont,
        lineHeight: tok.lineHeight,
        letterSpacing: tok.letterSpacing,
        textAlign: 'LEFT'
      }
    };

    nodes.push(rowNode);
    currentY += rowNode.height + 16;
  });

  const boardHeight = currentY + padding;

  const boardFrame: SceneNode = {
    id: boardId,
    parentId: null,
    childIds,
    name: 'Design System — Typography Scale',
    type: 'FRAME',
    visible: true,
    x,
    y,
    width: boardWidth,
    height: Math.max(200, boardHeight),
    rotation: 0,
    cornerRadius: 12,
    fills: [{ type: 'SOLID', color: { r: 0.98, g: 0.99, b: 1, a: 1 }, opacity: 1, visible: true }],
    strokes: [{ color: { r: 0.9, g: 0.92, b: 0.96, a: 1 }, weight: 1, align: 'INSIDE', visible: true }],
    effects: [],
    clipsContent: true
  };

  nodes.unshift(boardFrame);
  return { boardFrame, nodes };
}

/**
 * Builds the Spacing and Radius Board.
 */
function buildSpacingBoard(
  result: ExtractedSpacingResult,
  x: number,
  y: number
): { boardFrame: SceneNode; nodes: SceneNode[] } {
  const boardId = 'board_spacing_radius';
  const boardWidth = 1000;
  const padding = 32;

  const childIds: string[] = [];
  const nodes: SceneNode[] = [];

  // Title
  const titleId = `${boardId}_title`;
  childIds.push(titleId);
  nodes.push({
    id: titleId,
    parentId: boardId,
    childIds: [],
    name: 'Board Title',
    type: 'TEXT',
    visible: true,
    x: padding,
    y: padding,
    width: boardWidth - padding * 2,
    height: 28,
    rotation: 0,
    fills: [{ type: 'SOLID', color: { r: 0.1, g: 0.15, b: 0.2, a: 1 }, opacity: 1, visible: true }],
    strokes: [],
    effects: [],
    clipsContent: false,
    textData: {
      text: 'Design System — Spacing & Radius Tokens',
      fontSize: 20,
      fontWeight: 700,
      fontFamily: 'Inter',
      lineHeight: 28,
      textAlign: 'LEFT'
    }
  });

  let currentY = padding + 48;

  // Spacing Section Header
  const spaceHeaderId = `${boardId}_space_header`;
  childIds.push(spaceHeaderId);
  nodes.push({
    id: spaceHeaderId,
    parentId: boardId,
    childIds: [],
    name: 'Spacing Header',
    type: 'TEXT',
    visible: true,
    x: padding,
    y: currentY,
    width: 300,
    height: 20,
    rotation: 0,
    fills: [{ type: 'SOLID', color: { r: 0.3, g: 0.35, b: 0.45, a: 1 }, opacity: 1, visible: true }],
    strokes: [],
    effects: [],
    clipsContent: false,
    textData: {
      text: 'LAYOUT SPACING TOKENS',
      fontSize: 12,
      fontWeight: 700,
      fontFamily: 'Inter',
      lineHeight: 20,
      textAlign: 'LEFT'
    }
  });
  currentY += 28;

  // Render spacing tokens as visual width bars
  result.spacingTokens.slice(0, 10).forEach((tok, idx) => {
    const rowId = `${boardId}_space_${idx}`;
    const barId = `${rowId}_bar`;
    const labelId = `${rowId}_label`;
    childIds.push(rowId);

    const barNode: SceneNode = {
      id: barId,
      parentId: rowId,
      childIds: [],
      name: `Bar ${tok.valuePx}px`,
      type: 'RECTANGLE',
      visible: true,
      x: 0,
      y: 0,
      width: Math.min(300, Math.max(16, tok.valuePx * 4)),
      height: 20,
      rotation: 0,
      cornerRadius: 4,
      fills: [{ type: 'SOLID', color: { r: 0.2, g: 0.5, b: 0.9, a: 0.8 }, opacity: 0.8, visible: true }],
      strokes: [],
      effects: [],
      clipsContent: false
    };

    const labelNode: SceneNode = {
      id: labelId,
      parentId: rowId,
      childIds: [],
      name: 'Label',
      type: 'TEXT',
      visible: true,
      x: 320,
      y: 2,
      width: 250,
      height: 18,
      rotation: 0,
      fills: [{ type: 'SOLID', color: { r: 0.2, g: 0.25, b: 0.3, a: 1 }, opacity: 1, visible: true }],
      strokes: [],
      effects: [],
      clipsContent: false,
      textData: {
        text: `${tok.label} (${tok.frequency} occurrences)`,
        fontSize: 12,
        fontWeight: 500,
        fontFamily: 'Inter',
        lineHeight: 18,
        textAlign: 'LEFT'
      }
    };

    const rowNode: SceneNode = {
      id: rowId,
      parentId: boardId,
      childIds: [barId, labelId],
      name: tok.label,
      type: 'FRAME',
      visible: true,
      x: padding,
      y: currentY,
      width: 600,
      height: 20,
      rotation: 0,
      fills: [],
      strokes: [],
      effects: [],
      clipsContent: false
    };

    nodes.push(rowNode, barNode, labelNode);
    currentY += 28;
  });

  currentY += 16;

  // Radius Section Header
  const radiusHeaderId = `${boardId}_radius_header`;
  childIds.push(radiusHeaderId);
  nodes.push({
    id: radiusHeaderId,
    parentId: boardId,
    childIds: [],
    name: 'Radius Header',
    type: 'TEXT',
    visible: true,
    x: padding,
    y: currentY,
    width: 300,
    height: 20,
    rotation: 0,
    fills: [{ type: 'SOLID', color: { r: 0.3, g: 0.35, b: 0.45, a: 1 }, opacity: 1, visible: true }],
    strokes: [],
    effects: [],
    clipsContent: false,
    textData: {
      text: 'CORNER RADIUS TOKENS',
      fontSize: 12,
      fontWeight: 700,
      fontFamily: 'Inter',
      lineHeight: 20,
      textAlign: 'LEFT'
    }
  });
  currentY += 28;

  // Render radius tokens
  result.radiusTokens.slice(0, 8).forEach((tok, idx) => {
    const rowId = `${boardId}_rad_${idx}`;
    const boxId = `${rowId}_box`;
    const labelId = `${rowId}_label`;
    childIds.push(rowId);

    const boxNode: SceneNode = {
      id: boxId,
      parentId: rowId,
      childIds: [],
      name: `Box r${tok.valuePx}`,
      type: 'RECTANGLE',
      visible: true,
      x: 0,
      y: 0,
      width: 36,
      height: 36,
      rotation: 0,
      cornerRadius: tok.valuePx,
      fills: [{ type: 'SOLID', color: { r: 0.9, g: 0.93, b: 0.98, a: 1 }, opacity: 1, visible: true }],
      strokes: [
        {
          color: { r: 0.2, g: 0.5, b: 0.9, a: 1 },
          weight: 1.5,
          align: 'INSIDE',
          visible: true
        }
      ],
      effects: [],
      clipsContent: false
    };

    const labelNode: SceneNode = {
      id: labelId,
      parentId: rowId,
      childIds: [],
      name: 'Label',
      type: 'TEXT',
      visible: true,
      x: 48,
      y: 8,
      width: 250,
      height: 20,
      rotation: 0,
      fills: [{ type: 'SOLID', color: { r: 0.2, g: 0.25, b: 0.3, a: 1 }, opacity: 1, visible: true }],
      strokes: [],
      effects: [],
      clipsContent: false,
      textData: {
        text: `${tok.label} (${tok.frequency}x)`,
        fontSize: 12,
        fontWeight: 500,
        fontFamily: 'Inter',
        lineHeight: 20,
        textAlign: 'LEFT'
      }
    };

    const rowNode: SceneNode = {
      id: rowId,
      parentId: boardId,
      childIds: [boxId, labelId],
      name: tok.label,
      type: 'FRAME',
      visible: true,
      x: padding,
      y: currentY,
      width: 320,
      height: 36,
      rotation: 0,
      fills: [],
      strokes: [],
      effects: [],
      clipsContent: false
    };

    nodes.push(rowNode, boxNode, labelNode);
    currentY += 44;
  });

  const boardHeight = currentY + padding;

  const boardFrame: SceneNode = {
    id: boardId,
    parentId: null,
    childIds,
    name: 'Design System — Spacing & Radius Tokens',
    type: 'FRAME',
    visible: true,
    x,
    y,
    width: boardWidth,
    height: Math.max(200, boardHeight),
    rotation: 0,
    cornerRadius: 12,
    fills: [{ type: 'SOLID', color: { r: 0.98, g: 0.99, b: 1, a: 1 }, opacity: 1, visible: true }],
    strokes: [{ color: { r: 0.9, g: 0.92, b: 0.96, a: 1 }, weight: 1, align: 'INSIDE', visible: true }],
    effects: [],
    clipsContent: true
  };

  nodes.unshift(boardFrame);
  return { boardFrame, nodes };
}

/**
 * Builds the Inferred Component Candidates Board.
 */
function buildComponentCandidatesBoard(
  candidates: readonly RepeatedComponentCandidate[],
  x: number,
  y: number
): { boardFrame: SceneNode; nodes: SceneNode[] } {
  const boardId = 'board_inferred_components';
  const boardWidth = 1000;
  const padding = 32;

  const childIds: string[] = [];
  const nodes: SceneNode[] = [];

  // Title
  const titleId = `${boardId}_title`;
  childIds.push(titleId);
  nodes.push({
    id: titleId,
    parentId: boardId,
    childIds: [],
    name: 'Board Title',
    type: 'TEXT',
    visible: true,
    x: padding,
    y: padding,
    width: boardWidth - padding * 2,
    height: 28,
    rotation: 0,
    fills: [{ type: 'SOLID', color: { r: 0.1, g: 0.15, b: 0.2, a: 1 }, opacity: 1, visible: true }],
    strokes: [],
    effects: [],
    clipsContent: false,
    textData: {
      text: 'Design System — Inferred Component Candidates',
      fontSize: 20,
      fontWeight: 700,
      fontFamily: 'Inter',
      lineHeight: 28,
      textAlign: 'LEFT'
    }
  });

  // Disclaimer Note
  const discId = `${boardId}_disclaimer`;
  childIds.push(discId);
  nodes.push({
    id: discId,
    parentId: boardId,
    childIds: [],
    name: 'Non-Claim Disclaimer',
    type: 'TEXT',
    visible: true,
    x: padding,
    y: padding + 36,
    width: boardWidth - padding * 2,
    height: 20,
    rotation: 0,
    fills: [{ type: 'SOLID', color: { r: 0.45, g: 0.5, b: 0.6, a: 1 }, opacity: 1, visible: true }],
    strokes: [],
    effects: [],
    clipsContent: false,
    textData: {
      text: 'Notice: Inferred visual candidates based on repeated DOM structure and geometry. Not proven to be source-code reusable components.',
      fontSize: 11,
      fontWeight: 400,
      fontFamily: 'Inter',
      lineHeight: 18,
      textAlign: 'LEFT'
    }
  });

  let currentY = padding + 76;

  candidates.slice(0, 8).forEach((cand) => {
    const wrapperId = `${boardId}_exemplar_${cand.candidateId}`;
    const labelId = `${wrapperId}_label`;
    childIds.push(wrapperId);

    const labelNode: SceneNode = {
      id: labelId,
      parentId: wrapperId,
      childIds: [],
      name: 'Candidate Label',
      type: 'TEXT',
      visible: true,
      x: 0,
      y: 0,
      width: 400,
      height: 20,
      rotation: 0,
      fills: [{ type: 'SOLID', color: { r: 0.2, g: 0.25, b: 0.3, a: 1 }, opacity: 1, visible: true }],
      strokes: [],
      effects: [],
      clipsContent: false,
      textData: {
        text: cand.name,
        fontSize: 13,
        fontWeight: 600,
        fontFamily: 'Inter',
        lineHeight: 20,
        textAlign: 'LEFT'
      }
    };

    // Clone representative node into board frame
    const clonedRep: SceneNode = {
      ...cand.representativeNode,
      id: `${wrapperId}_rep`,
      parentId: wrapperId,
      x: 0,
      y: 28
    };

    const wrapperHeight = clonedRep.height + 36;

    const wrapperNode: SceneNode = {
      id: wrapperId,
      parentId: boardId,
      childIds: [labelId, clonedRep.id],
      name: cand.name,
      type: 'FRAME',
      visible: true,
      x: padding,
      y: currentY,
      width: Math.max(clonedRep.width, 400),
      height: wrapperHeight,
      rotation: 0,
      fills: [],
      strokes: [],
      effects: [],
      clipsContent: false
    };

    nodes.push(wrapperNode, labelNode, clonedRep);
    currentY += wrapperHeight + 20;
  });

  const boardHeight = currentY + padding;

  const boardFrame: SceneNode = {
    id: boardId,
    parentId: null,
    childIds,
    name: 'Design System — Inferred Component Candidates',
    type: 'FRAME',
    visible: true,
    x,
    y,
    width: boardWidth,
    height: Math.max(200, boardHeight),
    rotation: 0,
    cornerRadius: 12,
    fills: [{ type: 'SOLID', color: { r: 0.98, g: 0.99, b: 1, a: 1 }, opacity: 1, visible: true }],
    strokes: [{ color: { r: 0.9, g: 0.92, b: 0.96, a: 1 }, weight: 1, align: 'INSIDE', visible: true }],
    effects: [],
    clipsContent: true
  };

  nodes.unshift(boardFrame);
  return { boardFrame, nodes };
}

/**
 * Builds optional, additive design system reference boards from scene nodes.
 */
export function generateDesignSystemBoards(
  nodes: readonly SceneNode[],
  options: DesignSystemBoardOptions = {}
): GeneratedDesignBoardsResult {
  const includeColors = options.includeColors ?? true;
  const includeTypography = options.includeTypography ?? true;
  const includeSpacing = options.includeSpacing ?? true;
  const includeComponents = options.includeComponents ?? true;

  const startX = options.startX ?? 0;
  let currentY = options.startY ?? 0;
  const gap = options.boardGap ?? 160;

  const boardFrames: SceneNode[] = [];
  const allNodes: SceneNode[] = [];

  // 1. Color Palette Board
  let colorTokenCount = 0;
  if (includeColors) {
    const colorTokens = extractColorTokens(nodes);
    colorTokenCount = colorTokens.length;
    if (colorTokens.length > 0) {
      const { boardFrame, nodes: colorNodes } = buildColorPaletteBoard(colorTokens, startX, currentY);
      boardFrames.push(boardFrame);
      for (const n of colorNodes) allNodes.push(n);
      currentY += boardFrame.height + gap;
    }
  }

  // 2. Typography Board
  let typographyTokenCount = 0;
  if (includeTypography) {
    const typoResult = extractTypographyTokens(nodes);
    typographyTokenCount = typoResult.tokens.length;
    if (typoResult.tokens.length > 0) {
      const { boardFrame, nodes: typoNodes } = buildTypographyBoard(typoResult, startX, currentY);
      boardFrames.push(boardFrame);
      for (const n of typoNodes) allNodes.push(n);
      currentY += boardFrame.height + gap;
    }
  }

  // 3. Spacing & Radius Board
  let spacingTokenCount = 0;
  let radiusTokenCount = 0;
  if (includeSpacing) {
    const spacingResult = extractSpacingTokens(nodes);
    spacingTokenCount = spacingResult.spacingTokens.length;
    radiusTokenCount = spacingResult.radiusTokens.length;
    if (spacingTokenCount > 0 || radiusTokenCount > 0) {
      const { boardFrame, nodes: spacingNodes } = buildSpacingBoard(spacingResult, startX, currentY);
      boardFrames.push(boardFrame);
      for (const n of spacingNodes) allNodes.push(n);
      currentY += boardFrame.height + gap;
    }
  }

  // 4. Inferred Component Candidates Board
  let componentCandidateCount = 0;
  if (includeComponents) {
    const candidates = detectRepeatedComponents(nodes);
    componentCandidateCount = candidates.length;
    if (candidates.length > 0) {
      const { boardFrame, nodes: compNodes } = buildComponentCandidatesBoard(candidates, startX, currentY);
      boardFrames.push(boardFrame);
      for (const n of compNodes) allNodes.push(n);
      currentY += boardFrame.height + gap;
    }
  }

  return {
    boardFrames,
    allNodes,
    summary: {
      colorTokenCount,
      typographyTokenCount,
      spacingTokenCount,
      radiusTokenCount,
      componentCandidateCount
    }
  };
}
