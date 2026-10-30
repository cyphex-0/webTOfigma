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
  textData?: {
    text: string;
    fontSize: number;
    fontWeight: number;
    fontFamily: string;
    lineHeight?: number | undefined;
    letterSpacing?: number | undefined;
    textAlign: 'LEFT' | 'CENTER' | 'RIGHT' | 'JUSTIFIED';
  } | undefined;
  layoutMetadata?: {
    layoutMode: 'NONE' | 'HORIZONTAL' | 'VERTICAL';
    primaryAxisAlign: 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN';
    counterAxisAlign: 'MIN' | 'CENTER' | 'MAX';
    itemSpacing: number;
    padding: {
      top: number;
      right: number;
      bottom: number;
      left: number;
    };
  } | undefined;
}

export interface FigmaSceneDocument {
  schemaVersion: number;
  exportTitle: string;
  sourceSite: string;
  exportedAt: number;
  pageFrames: SceneNode[];
  sections: SceneNode[];
  metadata: {
    totalNodes: number;
    totalAssets: number;
    totalPages: number;
    devicePixelRatio: number;
  };
}
