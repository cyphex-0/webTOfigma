import { z } from 'zod';

export const DiagnosticSeveritySchema = z.enum(['info', 'warning', 'error', 'fatal']);

export const DiagnosticPhaseSchema = z.enum([
  'dom-extraction',
  'asset-fetch',
  'style-resolution',
  'layout-computation',
  'scene-conversion',
  'clipboard-serialization'
]);

export const ExportDiagnosticSchema = z.object({
  severity: DiagnosticSeveritySchema,
  code: z.string().min(1),
  message: z.string(),
  phase: DiagnosticPhaseSchema,
  pageUrl: z.string().optional(),
  nodeId: z.string().optional(),
  assetUrl: z.string().optional(),
  recoveryAction: z.string().optional(),
  timestamp: z.number().int().positive()
});
