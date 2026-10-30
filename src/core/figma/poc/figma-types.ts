/**
 * TypeScript interfaces matching Figma's internal Kiwi binary wire schema
 * and clipboard envelope contracts.
 */

export interface FigmaGUID {
  sessionID: number;
  localID: number;
}

export interface FigmaVector {
  x: number;
  y: number;
}

export interface FigmaColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface FigmaMatrix {
  m00: number;
  m01: number;
  m02: number;
  m10: number;
  m11: number;
  m12: number;
}

export interface FigmaParentIndex {
  guid: FigmaGUID;
  position: number;
}

export type FigmaNodeType =
  | 'NONE'
  | 'DOCUMENT'
  | 'CANVAS'
  | 'GROUP'
  | 'FRAME'
  | 'BOOLEAN_OPERATION'
  | 'VECTOR'
  | 'STAR'
  | 'LINE'
  | 'ELLIPSE'
  | 'RECTANGLE'
  | 'REGULAR_POLYGON'
  | 'ROUNDED_RECTANGLE'
  | 'TEXT'
  | 'SECTION';

export type FigmaPaintType =
  | 'SOLID'
  | 'GRADIENT_LINEAR'
  | 'GRADIENT_RADIAL'
  | 'GRADIENT_ANGULAR'
  | 'GRADIENT_DIAMOND'
  | 'IMAGE'
  | 'EMOJI';

export interface FigmaPaint {
  type: FigmaPaintType;
  color: FigmaColor;
  opacity: number;
  visible: boolean;
}

export type FigmaLayoutMode = 'NONE' | 'HORIZONTAL' | 'VERTICAL';

export interface FigmaNodeChange {
  guid: FigmaGUID;
  type: FigmaNodeType;
  name: string;
  visible: boolean;
  parentIndex: FigmaParentIndex;
  transform: FigmaMatrix;
  size: FigmaVector;
  fillPaints?: FigmaPaint[] | null;
  strokePaints?: FigmaPaint[] | null;
  strokeWeight?: number | null;
  cornerRadius?: number | null;
  backgroundColor?: FigmaColor | null;
  rawText?: string | null;
  fontSize?: number | null;
  fontWeight?: number | null;
  fontFamily?: string | null;
  letterSpacing?: number | null;
  lineHeight?: number | null;
  textAlignHorizontal?: number | null;
  textAlignVertical?: number | null;
  layoutMode?: number | null;
  primaryAxisAlignItems?: number | null;
  counterAxisAlignItems?: number | null;
  itemSpacing?: number | null;
  paddingTop?: number | null;
  paddingRight?: number | null;
  paddingBottom?: number | null;
  paddingLeft?: number | null;
  clipsContent?: boolean | null;
  opacity?: number | null;
}

export interface FigmaMessage {
  nodeChanges: FigmaNodeChange[];
  sessionIDs: number[];
}

export interface FigmaClipboardMeta {
  fileKey: string;
  pasteID: number;
  dataType: string;
}
