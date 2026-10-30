/**
 * Zod runtime validation schemas for all Web-to-Figma extension messages.
 */

import { z } from 'zod';

export const JobStateSchema = z.enum([
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

export const SerializedExtensionErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  recoverable: z.boolean(),
  details: z.unknown().optional()
});

export const JobRecordSchema = z.object({
  jobId: z.string(),
  tabId: z.number().int(),
  url: z.string(),
  origin: z.string(),
  mode: z.enum(['single-page', 'multi-page']),
  state: JobStateSchema,
  createdAt: z.number(),
  updatedAt: z.number(),
  progressPercent: z.number().min(0).max(100),
  currentStep: z.string(),
  nodeCount: z.number().optional(),
  warnings: z.array(z.string()),
  error: SerializedExtensionErrorSchema.optional()
});

// -------------------------------------------------------------
// Base Envelope Schema
// -------------------------------------------------------------
export const MessageEnvelopeSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  payload: z.unknown(),
  timestamp: z.number()
});

export const MessageResponseSchema = z.object({
  id: z.string(),
  success: z.boolean(),
  payload: z.unknown().optional(),
  error: SerializedExtensionErrorSchema.optional()
});

// -------------------------------------------------------------
// Request Schemas
// -------------------------------------------------------------
export const GetActiveTabContextRequestSchema = z.object({
  includeFavicon: z.boolean().optional()
});

export const InjectContentScriptRequestSchema = z.object({
  tabId: z.number().int().positive()
});

export const StartCaptureRequestSchema = z.object({
  tabId: z.number().int().positive().optional(),
  mode: z.enum([
    'single-page',
    'multi-page',
    'viewport',
    'full-page',
    'select-element',
    'selected-pages',
    'odd-pages',
    'even-pages',
    'entire-site'
  ]),
  options: z
    .object({
      maxDepth: z.number().int().min(1).max(10).optional(),
      captureImages: z.boolean().optional(),
      includeShadowDom: z.boolean().optional()
    })
    .optional(),
  userOptions: z.record(z.unknown()).optional()
});

export const CancelJobRequestSchema = z.object({
  jobId: z.string().min(1),
  reason: z.string().optional()
});

export const GetJobStatusRequestSchema = z.object({
  jobId: z.string().optional()
});

export const RequestOriginPermissionRequestSchema = z.object({
  origin: z.string().url(),
  reason: z.string().min(5)
});

export const PingRequestSchema = z.object({
  timestamp: z.number().optional()
});

export const ToggleMinibarRequestSchema = z.object({
  tabId: z.number().int().positive().optional()
});

export const TeardownMinibarRequestSchema = z.object({
  tabId: z.number().int().positive().optional()
});

// -------------------------------------------------------------
// Streaming Port Message Schemas
// -------------------------------------------------------------
export const PageSnapshotChunkSchema = z.object({
  type: z.literal('PAGE_SNAPSHOT_CHUNK'),
  jobId: z.string(),
  seq: z.number().int().min(1),
  totalChunks: z.number().int().min(1),
  chunkData: z.string(),
  byteCount: z.number().int().nonnegative(),
  checksum: z.string().optional()
});

export const SnapshotAckSchema = z.object({
  type: z.literal('SNAPSHOT_ACK'),
  jobId: z.string(),
  receivedSeq: z.number().int().min(1),
  nextExpectedSeq: z.number().int().min(1)
});

export const PortHeartbeatPingSchema = z.object({
  type: z.literal('PORT_HEARTBEAT_PING'),
  timestamp: z.number(),
  jobId: z.string().optional()
});

export const PortHeartbeatPongSchema = z.object({
  type: z.literal('PORT_HEARTBEAT_PONG'),
  clientTimestamp: z.number(),
  workerTimestamp: z.number()
});
