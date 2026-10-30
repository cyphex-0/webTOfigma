/**
 * SourceNode contracts capturing the extracted DOM structure, computed styles,
 * document-space rectangles, and inline typography runs.
 */

export interface SourceRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface VisibilityFlags {
  isVisible: boolean;
  isClipped: boolean;
  isOffscreen: boolean;
  opacity: number;
}

export interface StackingContextHints {
  createsStackingContext: boolean;
  zIndex: number | 'auto';
  stackingTrigger?: string | undefined;
}

export interface ComputedStyleSnapshot {
  display: string;
  position: string;
  overflow: string;
  boxSizing: string;
  backgroundColor: string;
  backgroundImage?: string | undefined;
  backgroundSize?: string | undefined;
  backgroundPosition?: string | undefined;
  backgroundRepeat?: string | undefined;
  color: string;
  fontSize: string;
  fontFamily: string;
  fontWeight: string;
  lineHeight: string;
  letterSpacing: string;
  textAlign: string;
  borderRadius: string;
  borderTopLeftRadius?: string | undefined;
  borderTopRightRadius?: string | undefined;
  borderBottomRightRadius?: string | undefined;
  borderBottomLeftRadius?: string | undefined;
  borderWidth: string;
  borderTopWidth?: string | undefined;
  borderRightWidth?: string | undefined;
  borderBottomWidth?: string | undefined;
  borderLeftWidth?: string | undefined;
  borderColor: string;
  borderTopColor?: string | undefined;
  borderRightColor?: string | undefined;
  borderBottomColor?: string | undefined;
  borderLeftColor?: string | undefined;
  borderStyle: string;
  borderTopStyle?: string | undefined;
  borderRightStyle?: string | undefined;
  borderBottomStyle?: string | undefined;
  borderLeftStyle?: string | undefined;
  outlineWidth?: string | undefined;
  outlineStyle?: string | undefined;
  outlineColor?: string | undefined;
  outlineOffset?: string | undefined;
  boxShadow: string;
  filter?: string | undefined;
  backdropFilter?: string | undefined;
  opacity?: string | undefined;
  mixBlendMode?: string | undefined;
  transform: string;
  flexDirection?: string | undefined;
  justifyContent?: string | undefined;
  alignItems?: string | undefined;
  gap?: string | undefined;
  gridTemplateColumns?: string | undefined;
  gridTemplateRows?: string | undefined;
  padding: string;
  margin: string;
}

export interface TextRun {
  text: string;
  fontFamily: string;
  fontWeight: number;
  fontStyle: 'normal' | 'italic' | 'oblique';
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  color: string;
  textDecoration: string;
  textAlign: 'left' | 'center' | 'right' | 'justify';
  textTransform: string;
}

export interface SourceNode {
  nodeId: string;
  name?: string | undefined;
  semanticKind?: string | undefined;
  parentId: string | null;
  childIds: string[];
  sourceTag: string;
  role?: string | undefined;
  accessibleLabel?: string | undefined;
  classHints: string[];
  textRuns: TextRun[];
  sourceRect: SourceRect; // Viewport-space client rect
  documentRect: SourceRect; // Full document-space rect with scroll
  visibility: VisibilityFlags;
  stacking: StackingContextHints;
  computedStyle: ComputedStyleSnapshot;
  layoutHints: {
    isFlexContainer: boolean;
    isGridContainer: boolean;
    isInline: boolean;
    isBlock: boolean;
  };
  assetRefs: string[];
}
