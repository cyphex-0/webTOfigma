import { z } from 'zod';

export const CaptureProfileSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  viewportWidth: z.number().int().positive(),
  viewportHeight: z.number().int().positive(),
  devicePixelRatio: z.number().positive(),
  fullPageScrollLimit: z.number().int().positive(),
  scrollDelayMs: z.number().int().nonnegative(),
  includeFixedElements: z.boolean(),
  waitStrategy: z.enum(['load', 'networkidle', 'domcontentloaded']),
  maxAssetsPerJob: z.number().int().positive(),
  maxNodesPerJob: z.number().int().positive()
});

export const DomainOverrideSchema = z.object({
  domain: z.string().min(1),
  minibarEnabled: z.boolean(),
  maxPages: z.number().int().positive().optional(),
  customFontFallback: z.string().optional()
});

export const ExtensionSettingsSchema = z.object({
  schemaVersion: z.literal(1),
  defaultMode: z.string(),
  activeProfileId: z.string(),
  profiles: z.array(CaptureProfileSchema),
  domainOverrides: z.record(DomainOverrideSchema),
  autoCopyClipboard: z.boolean(),
  notifyOnComplete: z.boolean()
});
