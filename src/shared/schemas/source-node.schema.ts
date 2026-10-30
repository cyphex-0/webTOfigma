import { z } from 'zod';

export const SourceRectSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  width: z.number().nonnegative().finite(),
  height: z.number().nonnegative().finite()
});

export const VisibilityFlagsSchema = z.object({
  isVisible: z.boolean(),
  isClipped: z.boolean(),
  isOffscreen: z.boolean(),
  opacity: z.number().min(0).max(1).finite()
});

export const StackingContextHintsSchema = z.object({
  createsStackingContext: z.boolean(),
  zIndex: z.union([z.number().int(), z.literal('auto')]),
  stackingTrigger: z.string().optional()
});

export const ComputedStyleSnapshotSchema = z.object({
  display: z.string(),
  position: z.string(),
  overflow: z.string(),
  boxSizing: z.string(),
  backgroundColor: z.string(),
  color: z.string(),
  fontSize: z.string(),
  fontFamily: z.string(),
  fontWeight: z.string(),
  lineHeight: z.string(),
  letterSpacing: z.string(),
  textAlign: z.string(),
  borderRadius: z.string(),
  borderWidth: z.string(),
  borderColor: z.string(),
  borderStyle: z.string(),
  boxShadow: z.string(),
  transform: z.string(),
  flexDirection: z.string().optional(),
  justifyContent: z.string().optional(),
  alignItems: z.string().optional(),
  gap: z.string().optional(),
  gridTemplateColumns: z.string().optional(),
  gridTemplateRows: z.string().optional(),
  padding: z.string(),
  margin: z.string()
});

export const TextRunSchema = z.object({
  text: z.string(),
  fontFamily: z.string(),
  fontWeight: z.number().int().min(100).max(900),
  fontStyle: z.enum(['normal', 'italic', 'oblique']),
  fontSize: z.number().positive().finite(),
  lineHeight: z.number().nonnegative().finite(),
  letterSpacing: z.number().finite(),
  color: z.string(),
  textDecoration: z.string(),
  textAlign: z.enum(['left', 'center', 'right', 'justify']),
  textTransform: z.string()
});

export const SourceNodeSchema = z.object({
  nodeId: z.string().min(1),
  parentId: z.string().nullable(),
  childIds: z.array(z.string()),
  sourceTag: z.string(),
  role: z.string().optional(),
  accessibleLabel: z.string().optional(),
  classHints: z.array(z.string()),
  textRuns: z.array(TextRunSchema),
  sourceRect: SourceRectSchema,
  documentRect: SourceRectSchema,
  visibility: VisibilityFlagsSchema,
  stacking: StackingContextHintsSchema,
  computedStyle: ComputedStyleSnapshotSchema,
  layoutHints: z.object({
    isFlexContainer: z.boolean(),
    isGridContainer: z.boolean(),
    isInline: z.boolean(),
    isBlock: z.boolean()
  }),
  assetRefs: z.array(z.string())
});
