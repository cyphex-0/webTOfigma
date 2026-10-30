import { z } from 'zod';

export const SceneNodeTypeSchema = z.enum([
  'FRAME',
  'SECTION',
  'RECTANGLE',
  'TEXT',
  'IMAGE',
  'VECTOR',
  'GROUP'
]);

export const SceneColorSchema = z.object({
  r: z.number().min(0).max(1).finite(),
  g: z.number().min(0).max(1).finite(),
  b: z.number().min(0).max(1).finite(),
  a: z.number().min(0).max(1).finite()
});

export const ScenePaintSchema = z.object({
  type: z.enum(['SOLID', 'GRADIENT_LINEAR', 'GRADIENT_RADIAL', 'IMAGE']),
  color: SceneColorSchema.optional(),
  opacity: z.number().min(0).max(1).finite(),
  visible: z.boolean(),
  imageRef: z.string().optional()
});

export const SceneStrokeSchema = z.object({
  color: SceneColorSchema,
  weight: z.number().nonnegative().finite(),
  align: z.enum(['INSIDE', 'OUTSIDE', 'CENTER']),
  visible: z.boolean()
});

export const SceneEffectSchema = z.object({
  type: z.enum(['DROP_SHADOW', 'INNER_SHADOW', 'LAYER_BLUR']),
  color: SceneColorSchema.optional(),
  offset: z
    .object({
      x: z.number().finite(),
      y: z.number().finite()
    })
    .optional(),
  radius: z.number().nonnegative().finite(),
  spread: z.number().finite().optional(),
  visible: z.boolean()
});

export const SceneNodeSchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    id: z.string().min(1),
    parentId: z.string().nullable(),
    childIds: z.array(z.string()),
    name: z.string(),
    type: SceneNodeTypeSchema,
    visible: z.boolean(),
    x: z.number().finite(),
    y: z.number().finite(),
    width: z.number().nonnegative().finite(),
    height: z.number().nonnegative().finite(),
    rotation: z.number().finite(),
    cornerRadius: z.number().nonnegative().finite().optional(),
    fills: z.array(ScenePaintSchema),
    strokes: z.array(SceneStrokeSchema),
    effects: z.array(SceneEffectSchema),
    clipsContent: z.boolean(),
    textData: z
      .object({
        text: z.string(),
        fontSize: z.number().positive().finite(),
        fontWeight: z.number().int().min(100).max(900),
        fontFamily: z.string(),
        lineHeight: z.number().nonnegative().finite().optional(),
        letterSpacing: z.number().finite().optional(),
        textAlign: z.enum(['LEFT', 'CENTER', 'RIGHT', 'JUSTIFIED'])
      })
      .optional(),
    layoutMetadata: z
      .object({
        layoutMode: z.enum(['NONE', 'HORIZONTAL', 'VERTICAL']),
        primaryAxisAlign: z.enum(['MIN', 'CENTER', 'MAX', 'SPACE_BETWEEN']),
        counterAxisAlign: z.enum(['MIN', 'CENTER', 'MAX']),
        itemSpacing: z.number().finite(),
        padding: z.object({
          top: z.number().nonnegative().finite(),
          right: z.number().nonnegative().finite(),
          bottom: z.number().nonnegative().finite(),
          left: z.number().nonnegative().finite()
        })
      })
      .optional()
  })
);

export const FigmaSceneDocumentSchema = z.object({
  schemaVersion: z.literal(1),
  exportTitle: z.string(),
  sourceSite: z.string(),
  exportedAt: z.number().int().positive(),
  pageFrames: z.array(SceneNodeSchema),
  sections: z.array(SceneNodeSchema),
  metadata: z.object({
    totalNodes: z.number().int().nonnegative(),
    totalAssets: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
    devicePixelRatio: z.number().positive().finite()
  })
});
