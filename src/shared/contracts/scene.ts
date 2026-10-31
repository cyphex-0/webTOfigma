import type { PageCaptureMetadata } from './page-capture';
import type { SourceNode } from './source-node';
import type { ExportDiagnostic } from './diagnostics';

/**
 * Intermediate Scene Graph contracts representing target-independent layout nodes,
 * vectors, text, styles, and full scene documents.
 */

export type SceneNodeType =
  | 'FRAME'
  | 'SECTION'
  | 'RECTANGLE'
  | 'TEXT'
  | 'IMAGE'
  | 'VECTOR'
  | 'GROUP';

export interface ScenePaint {
  type: 'SOLID' | 'GRADIENT_LINEAR' | 'GRADIENT_RADIAL' | 'GRADIENT_ANGULAR' | 'IMAGE';
  color?: {
    r: number;
    g: number;
    b: number;
    a: number;
  } | undefined;
  opacity: number;
  visible: boolean;
  imageRef?: string | undefined;
  gradientStops?: Array<{
    position: number;
    color: { r: number; g: number; b: number; a: number };
  }> | undefined;
  gradientTransform?: [[number, number, number], [number, number, number]] | undefined;
}

export interface SceneStroke {
  color: {
    r: number;
    g: number;
    b: number;
    a: number;
  };
  weight: number;
  align: 'INSIDE' | 'OUTSIDE' | 'CENTER';
  visible: boolean;
}

export interface SceneEffect {
  type: 'DROP_SHADOW' | 'INNER_SHADOW' | 'LAYER_BLUR' | 'BACKGROUND_BLUR';
  color?: {
    r: number;
    g: number;
    b: number;
    a: number;
  } | undefined;
  offset?: {
    x: number;
    y: number;
  } | undefined;
  radius: number;
  spread?: number | undefined;
  visible: boolean;
}

export interface SceneTextData {
  text: string;
  fontSize: number;
  fontWeight: number;
  fontFamily: string;
  fontStyle?: 'normal' | 'italic' | 'oblique' | undefined;
  lineHeight?: number | { unit: 'PIXELS' | 'PERCENT' | 'AUTO'; value?: number | undefined } | undefined;
  letterSpacing?: number | { unit: 'PIXELS' | 'PERCENT'; value: number } | undefined;
  textAlign: 'LEFT' | 'CENTER' | 'RIGHT' | 'JUSTIFIED';
  textAutoResize?: 'NONE' | 'WIDTH_AND_HEIGHT' | 'HEIGHT' | undefined;
  textCase?: 'ORIGINAL' | 'UPPER' | 'LOWER' | 'TITLE' | undefined;
  textDecoration?: 'NONE' | 'UNDERLINE' | 'STRIKETHROUGH' | undefined;
  sourceFont?: string | undefined;
  resolvedFont?: string | undefined;
  rawVariationSettings?: Record<string, number> | string | undefined;
}

export interface SceneLayoutMetadata {
  layoutMode: 'NONE' | 'HORIZONTAL' | 'VERTICAL';
  primaryAxisAlign?: 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN' | undefined;
  counterAxisAlign?: 'MIN' | 'CENTER' | 'MAX' | undefined;
  itemSpacing?: number | undefined;
  padding?: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  } | undefined;
  layoutSizingHorizontal?: 'FIXED' | 'HUG' | 'FILL' | undefined;
  layoutSizingVertical?: 'FIXED' | 'HUG' | 'FILL' | undefined;
  decisionRecord?: 'auto-layout-exact' | 'auto-layout-approximate' | 'positioned-fallback' | undefined;
}

export interface SceneNode {
  id: string;
  parentId: string | null;
  childIds: string[];
  name: string;
  type: SceneNodeType;
  visible: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  cornerRadius?: number | undefined;
  cornerRadii?: [number, number, number, number] | undefined;
  strokeWeights?: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  } | undefined;
  fills: ScenePaint[];
  strokes: SceneStroke[];
  effects: SceneEffect[];
  clipsContent: boolean;
  textData?: SceneTextData | undefined;
  layoutMetadata?: SceneLayoutMetadata | undefined;
  sourceNodeId?: string | undefined;
}

export interface PageCapture {
  metadata: PageCaptureMetadata;
  nodes: SourceNode[];
  assetRefs?: string[] | undefined;
  diagnostics?: ExportDiagnostic[] | undefined;
}

export interface PageScene {
  metadata: PageCaptureMetadata & {
    totalNodes: number;
  };
  pageFrame: SceneNode;
  nodes: SceneNode[];
  diagnostics: ExportDiagnostic[];
}

export interface SceneBuilderOptions {
  includeVisualSnapshot?: boolean | undefined;
  collapseStructuralWrappers?: boolean | undefined;
  exportProfile?: string | undefined;
}

export interface FigmaSceneDocument {
  schemaVersion: number;
  exportTitle: string;
  sourceSite: string;
  exportedAt: number;
  pageFrames: SceneNode[];
  sections: SceneNode[];
  allNodes?: SceneNode[] | undefined;
  metadata: {
    totalNodes: number;
    totalAssets: number;
    totalPages: number;
    devicePixelRatio: number;
  };
}
