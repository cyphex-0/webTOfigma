/**
 * Native Node Mapper.
 * 
 * Maps extracted SourceNode records to target-independent SceneNode models:
 * - Frames & Groups for containers and layout blocks.
 * - Text nodes for editable typography with quantized fonts and rich text.
 * - Image nodes for raster assets and image fills.
 * - Vector nodes for SVG shapes and icons.
 * - Rectangles for decorative shapes, dividers, and colored surfaces.
 * - Collapses purely structural unstyled wrappers when safe.
 */

import {
  SceneNode,
  SceneNodeType,
  ScenePaint,
  SceneTextData,
  SceneBuilderOptions
} from '../../shared/contracts/scene';
import { SourceNode } from '../../shared/contracts/source-node';
import { ExportDiagnostic } from '../../shared/contracts/diagnostics';
import { translateElementStyles } from '../styles';
import { parseCssColor } from '../styles/color-parser';
import { resolveTypographyFont } from '../typography/font-fallback-resolver';
import { generateChildNodeName, SiblingNameRegistry } from './scene-naming';

export interface NodeMappingOptions extends SceneBuilderOptions {
  siblingNameRegistry?: SiblingNameRegistry | undefined;
}

export interface NodeMappingResult {
  sceneNode: SceneNode;
  synthesizedChildren: SceneNode[];
  diagnostics: ExportDiagnostic[];
}

/**
 * Checks whether computed styles have visible background fills.
 */
export function hasMeaningfulFills(computedStyle: SourceNode['computedStyle']): boolean {
  const bg = computedStyle.backgroundColor.trim().toLowerCase();
  const hasColor =
    bg !== '' &&
    bg !== 'transparent' &&
    bg !== 'rgba(0, 0, 0, 0)' &&
    bg !== 'none';

  const img = computedStyle.backgroundImage?.trim().toLowerCase();
  const hasImage = Boolean(img && img !== 'none' && img !== '');

  return hasColor || hasImage;
}

/**
 * Checks whether computed styles have visible borders.
 */
export function hasMeaningfulBorders(computedStyle: SourceNode['computedStyle']): boolean {
  const width = computedStyle.borderWidth?.trim();
  const style = computedStyle.borderStyle?.trim().toLowerCase();
  return Boolean(
    width &&
    width !== '0px' &&
    style &&
    style !== 'none' &&
    style !== 'hidden'
  );
}

/**
 * Determines the target-independent SceneNodeType for a SourceNode.
 */
export function determineSceneNodeType(node: SourceNode): SceneNodeType {
  const tag = node.sourceTag.toLowerCase();
  const semantic = node.semanticKind?.toLowerCase();

  if (tag === 'svg' || tag === 'path' || semantic === 'vector') {
    return 'VECTOR';
  }

  if (tag === 'img' || tag === 'picture' || semantic === 'image') {
    return 'IMAGE';
  }

  if (tag === '#text') {
    return 'TEXT';
  }

  // If node has text and no child elements:
  if (node.textRuns.length > 0 && node.childIds.length === 0) {
    const hasBg = hasMeaningfulFills(node.computedStyle);
    const hasBorder = hasMeaningfulBorders(node.computedStyle);
    // If it has visible container backgrounds or borders, it acts as a FRAME container
    if (hasBg || hasBorder) {
      return 'FRAME';
    }
    return 'TEXT';
  }

  // Containers with children or layout properties
  if (
    node.childIds.length > 0 ||
    node.layoutHints.isFlexContainer ||
    node.layoutHints.isGridContainer
  ) {
    return 'FRAME';
  }

  // Leaf decorative boxes
  if (hasMeaningfulFills(node.computedStyle) || hasMeaningfulBorders(node.computedStyle)) {
    return 'RECTANGLE';
  }

  return 'FRAME';
}

/**
 * Maps a single SourceNode into a SceneNode (and optional synthesized children).
 */
export function mapSourceNodeToSceneNode(
  sourceNode: SourceNode,
  options: NodeMappingOptions = {}
): NodeMappingResult {
  const diagnostics: ExportDiagnostic[] = [];
  const synthesizedChildren: SceneNode[] = [];

  const nodeType = determineSceneNodeType(sourceNode);

  // 1. Translate styles (fills, strokes, effects, radii)
  const styles = translateElementStyles(sourceNode.computedStyle, {
    nodeId: sourceNode.nodeId
  });
  diagnostics.push(...styles.diagnostics);

  // 2. Generate layer name
  const name = generateChildNodeName({
    semanticKind: sourceNode.semanticKind,
    sourceTag: sourceNode.sourceTag,
    role: sourceNode.role,
    accessibleLabel: sourceNode.accessibleLabel,
    name: sourceNode.name,
    isText: nodeType === 'TEXT',
    isImage: nodeType === 'IMAGE',
    isVector: nodeType === 'VECTOR'
  });

  // 3. Build base scene node
  const sceneNode: SceneNode = {
    id: `scene_${sourceNode.nodeId}`,
    sourceNodeId: sourceNode.nodeId,
    parentId: sourceNode.parentId ? `scene_${sourceNode.parentId}` : null,
    childIds: sourceNode.childIds.map((cid) => `scene_${cid}`),
    name,
    type: nodeType,
    visible: sourceNode.visibility.isVisible,
    x: sourceNode.documentRect.x,
    y: sourceNode.documentRect.y,
    width: Math.max(0.01, sourceNode.documentRect.width),
    height: Math.max(0.01, sourceNode.documentRect.height),
    rotation: 0,
    fills: [...styles.fills],
    strokes: [...styles.strokes],
    effects: [...styles.effects],
    clipsContent:
      sourceNode.computedStyle.overflow === 'hidden' ||
      sourceNode.computedStyle.overflow === 'clip',
    ...(styles.uniformCornerRadius !== undefined
      ? { cornerRadius: styles.uniformCornerRadius }
      : {}),
    cornerRadii: styles.cornerRadii,
    strokeWeights: styles.strokeWeights
  };

  // 4. Handle IMAGE type
  if (nodeType === 'IMAGE') {
    if (sourceNode.assetRefs && sourceNode.assetRefs.length > 0) {
      const assetRef = sourceNode.assetRefs[0]!;
      const imagePaint: ScenePaint = {
        type: 'IMAGE',
        imageRef: assetRef,
        opacity: 1,
        visible: true
      };
      // Prepend image paint
      sceneNode.fills = [imagePaint, ...sceneNode.fills];
    }
  }

  // 5. Handle TEXT type
  if (nodeType === 'TEXT' && sourceNode.textRuns.length > 0) {
    const textData = buildSceneTextData(sourceNode);
    sceneNode.textData = textData;

    // In Figma, text color is represented as a solid paint fill
    if (sourceNode.textRuns[0]?.color) {
      const parsed = parseCssColor(sourceNode.textRuns[0].color);
      const color = parsed ?? { r: 0, g: 0, b: 0, a: 1 };
      sceneNode.fills = [
        {
          type: 'SOLID',
          color: { r: color.r, g: color.g, b: color.b, a: color.a },
          opacity: 1,
          visible: true
        }
      ];
    }
  }

  // 6. Handle FRAME with direct text (e.g. Button with text inside it)
  if (nodeType === 'FRAME' && sourceNode.textRuns.length > 0 && sourceNode.childIds.length === 0) {
    const textData = buildSceneTextData(sourceNode);
    const textChildId = `scene_${sourceNode.nodeId}_label`;

    const parsedText = sourceNode.textRuns[0]?.color
      ? parseCssColor(sourceNode.textRuns[0].color)
      : null;
    const textColor = parsedText ?? { r: 0, g: 0, b: 0, a: 1 };

    const textChild: SceneNode = {
      id: textChildId,
      sourceNodeId: `${sourceNode.nodeId}_label`,
      parentId: sceneNode.id,
      childIds: [],
      name: `${sceneNode.name} Label`,
      type: 'TEXT',
      visible: true,
      x: sceneNode.x,
      y: sceneNode.y,
      width: sceneNode.width,
      height: sceneNode.height,
      rotation: 0,
      fills: [
        {
          type: 'SOLID',
          color: { r: textColor.r, g: textColor.g, b: textColor.b, a: textColor.a },
          opacity: 1,
          visible: true
        }
      ],
      strokes: [],
      effects: [],
      clipsContent: false,
      textData
    };

    sceneNode.childIds.push(textChildId);
    synthesizedChildren.push(textChild);
  }

  return {
    sceneNode,
    synthesizedChildren,
    diagnostics
  };
}

/**
 * Constructs SceneTextData from SourceNode text runs and computed styles.
 */
function buildSceneTextData(node: SourceNode): SceneTextData {
  const primaryRun = node.textRuns[0];
  const combinedText = node.textRuns.map((r) => r.text).join('');

  const rawFontFamily = primaryRun?.fontFamily || node.computedStyle.fontFamily || 'sans-serif';
  const rawWeight = primaryRun?.fontWeight || node.computedStyle.fontWeight || 400;
  const rawStyle = primaryRun?.fontStyle || 'normal';

  const resolved = resolveTypographyFont(rawFontFamily, rawWeight, rawStyle);

  const fontSize = primaryRun?.fontSize || parseFloat(node.computedStyle.fontSize) || 16;

  // Line height
  let lineHeight: SceneTextData['lineHeight'] = undefined;
  if (primaryRun && primaryRun.lineHeight > 0) {
    lineHeight = { unit: 'PIXELS', value: primaryRun.lineHeight };
  } else if (node.computedStyle.lineHeight === 'normal') {
    lineHeight = { unit: 'AUTO' };
  } else {
    const parsedLh = parseFloat(node.computedStyle.lineHeight);
    if (!isNaN(parsedLh) && parsedLh > 0) {
      lineHeight = { unit: 'PIXELS', value: parsedLh };
    }
  }

  // Letter spacing
  let letterSpacing: SceneTextData['letterSpacing'] = undefined;
  if (primaryRun && primaryRun.letterSpacing !== 0) {
    letterSpacing = { unit: 'PIXELS', value: primaryRun.letterSpacing };
  } else {
    const parsedLs = parseFloat(node.computedStyle.letterSpacing);
    if (!isNaN(parsedLs) && parsedLs !== 0) {
      letterSpacing = { unit: 'PIXELS', value: parsedLs };
    }
  }

  // Text alignment
  const rawAlign = (primaryRun?.textAlign || node.computedStyle.textAlign || 'left').toLowerCase();
  const textAlign: SceneTextData['textAlign'] =
    rawAlign === 'center'
      ? 'CENTER'
      : rawAlign === 'right'
        ? 'RIGHT'
        : rawAlign === 'justify'
          ? 'JUSTIFIED'
          : 'LEFT';

  // Text case
  const textTransform = (primaryRun?.textTransform || '').toLowerCase();
  const textCase: SceneTextData['textCase'] =
    textTransform === 'uppercase'
      ? 'UPPER'
      : textTransform === 'lowercase'
        ? 'LOWER'
        : textTransform === 'capitalize'
          ? 'TITLE'
          : 'ORIGINAL';

  // Text decoration
  const textDec = (primaryRun?.textDecoration || '').toLowerCase();
  const textDecoration: SceneTextData['textDecoration'] =
    textDec.includes('underline')
      ? 'UNDERLINE'
      : textDec.includes('line-through')
        ? 'STRIKETHROUGH'
        : 'NONE';

  // Auto resize
  const textAutoResize: SceneTextData['textAutoResize'] =
    node.layoutHints.isInline || !combinedText.includes('\n')
      ? 'WIDTH_AND_HEIGHT'
      : 'HEIGHT';

  return {
    text: combinedText,
    fontSize,
    fontWeight: resolved.quantizedWeight,
    fontFamily: resolved.resolvedFamily,
    fontStyle: resolved.fontStyle,
    lineHeight,
    letterSpacing,
    textAlign,
    textAutoResize,
    textCase,
    textDecoration,
    sourceFont: resolved.sourceFamily,
    resolvedFont: resolved.resolvedFamily,
    rawVariationSettings: resolved.variationAxes
  };
}

/**
 * Collapses purely structural, unstyled single-child wrapper frames
 * while preserving hierarchy, geometry, and semantics.
 */
export function collapseStructuralWrappers(nodes: Map<string, SceneNode>): void {
  const nodesToCollapse: string[] = [];

  for (const [id, node] of nodes.entries()) {
    // Only consider non-root FRAME nodes with exactly one child
    if (node.type !== 'FRAME' || node.childIds.length !== 1 || !node.parentId) {
      continue;
    }

    // Must have no visible fills, strokes, or effects
    const hasFills = node.fills.some((f) => f.visible && f.opacity > 0);
    const hasStrokes = node.strokes.some((s) => s.visible && s.weight > 0);
    const hasEffects = node.effects.some((e) => e.visible);

    if (hasFills || hasStrokes || hasEffects || node.clipsContent) {
      continue;
    }

    // Must be a generic Container or Group (not semantic Section, Header, etc.)
    if (node.name !== 'Container' && node.name !== 'Group' && node.name !== 'Div') {
      continue;
    }

    const singleChildId = node.childIds[0]!;
    const singleChild = nodes.get(singleChildId);
    if (!singleChild) {
      continue;
    }

    nodesToCollapse.push(id);
  }

  for (const wrapperId of nodesToCollapse) {
    const wrapper = nodes.get(wrapperId);
    if (!wrapper || !wrapper.parentId) continue;

    const singleChildId = wrapper.childIds[0]!;
    const singleChild = nodes.get(singleChildId);
    const parent = nodes.get(wrapper.parentId);

    if (singleChild && parent) {
      // Re-link parent to singleChild
      parent.childIds = parent.childIds.map((cid) => (cid === wrapperId ? singleChildId : cid));
      singleChild.parentId = parent.id;
      // Remove wrapper
      nodes.delete(wrapperId);
    }
  }
}
