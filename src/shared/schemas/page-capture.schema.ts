import { z } from 'zod';

export const PageRequestSchema = z.object({
  url: z.string().url(),
  discoveryIndex: z.number().int().nonnegative(),
  crawlDepth: z.number().int().nonnegative(),
  routeCategory: z.string().optional(),
  paginationNumber: z.number().int().positive().optional(),
  originMetadata: z.object({
    origin: z.string(),
    referrer: z.string().optional()
  })
});

export const DocumentReadinessSchema = z.enum(['loading', 'interactive', 'complete']);

export const ViewportDimensionsSchema = z.object({
  width: z.number().positive().finite(),
  height: z.number().positive().finite(),
  devicePixelRatio: z.number().positive().finite(),
  scrollX: z.number().finite(),
  scrollY: z.number().finite()
});

export const PageCaptureMetadataSchema = z.object({
  schemaVersion: z.literal(1),
  pageIndex: z.number().int().nonnegative(),
  requestedUrl: z.string().url(),
  finalUrl: z.string().url(),
  title: z.string(),
  readinessState: DocumentReadinessSchema,
  navigationStatus: z.number().int().optional(),
  capturedAt: z.number().int().positive(),
  viewport: ViewportDimensionsSchema,
  documentDimensions: z.object({
    width: z.number().positive().finite(),
    height: z.number().positive().finite()
  }),
  captureMode: z.string()
});
