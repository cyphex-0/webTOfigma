import { z } from 'zod';

export const AssetKindSchema = z.enum([
  'image-bitmap',
  'image-svg',
  'font-woff2',
  'font-ttf',
  'css-background',
  'canvas'
]);

export const FetchStateSchema = z.enum(['pending', 'fetched', 'cached', 'failed', 'skipped']);

export const EmbeddingStateSchema = z.enum([
  'embedded-base64',
  'blob-reference',
  'external-url',
  'omitted'
]);

export const AssetRecordSchema = z.object({
  assetId: z.string().min(1),
  url: z.string(),
  kind: AssetKindSchema,
  mimeType: z.string(),
  byteLength: z.number().int().nonnegative(),
  contentHash: z.string(),
  dimensions: z
    .object({
      width: z.number().positive().finite(),
      height: z.number().positive().finite()
    })
    .optional(),
  fetchState: FetchStateSchema,
  embeddingState: EmbeddingStateSchema,
  diagnostic: z.string().optional(),
  blobRef: z.string().optional()
});
