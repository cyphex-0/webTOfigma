import { z } from 'zod';

export const ExportModeSchema = z.enum([
  'viewport',
  'full-page',
  'select-element',
  'selected-pages',
  'odd-pages',
  'even-pages',
  'entire-site'
]);

export const ExportJobStatusSchema = z.enum([
  'created',
  'permission_check',
  'injecting',
  'capturing',
  'processing',
  'ready_to_copy',
  'copying',
  'completed',
  'partial',
  'failed',
  'cancelled'
]);

export const JobResultManifestSchema = z.object({
  pageCount: z.number().int().nonnegative(),
  totalNodes: z.number().int().nonnegative(),
  totalAssets: z.number().int().nonnegative(),
  totalAssetBytes: z.number().int().nonnegative(),
  clipboardBytes: z.number().int().nonnegative().optional(),
  sceneDocumentId: z.string().optional()
});

export const ExportJobSchema = z.object({
  schemaVersion: z.literal(1),
  jobId: z.string().min(1),
  createdAt: z.number().int().positive(),
  updatedAt: z.number().int().positive(),
  mode: ExportModeSchema,
  startUrl: z.string().url(),
  selectedRoutes: z.array(z.string()),
  userOptions: z.record(z.unknown()),
  status: ExportJobStatusSchema,
  progressPercent: z.number().min(0).max(100),
  currentStep: z.string(),
  warnings: z.array(z.string()),
  failures: z.array(z.string()),
  resultManifest: JobResultManifestSchema.optional()
});
