/**
 * Strict Message Contracts and Types for Web-to-Figma Extension Runtime.
 * Shared across popup, background worker, options, and content scripts.
 */

import type { SerializedExtensionError } from '../errors/extension-errors';

export type JobState =
  | 'created'
  | 'permission_check'
  | 'injecting'
  | 'capturing'
  | 'processing'
  | 'ready_to_copy'
  | 'copying'
  | 'completed'
  | 'partial'
  | 'failed'
  | 'cancelled';

export interface JobRecord {
  jobId: string;
  tabId: number;
  url: string;
  origin: string;
  mode: 'single-page' | 'multi-page';
  state: JobState;
  createdAt: number;
  updatedAt: number;
  progressPercent: number;
  currentStep: string;
  nodeCount?: number;
  warnings: string[];
  error?: SerializedExtensionError;
}

// -------------------------------------------------------------
// Base Message Envelope
// -------------------------------------------------------------
export interface MessageEnvelope<T = unknown> {
  id: string; // Unique Request UUID
  type: string;
  payload: T;
  timestamp: number;
}

export interface MessageResponse<T = unknown> {
  id: string;
  success: boolean;
  payload?: T;
  error?: SerializedExtensionError;
}

// -------------------------------------------------------------
// 1. GET_ACTIVE_TAB_CONTEXT
// -------------------------------------------------------------
export interface GetActiveTabContextRequest {
  includeFavicon?: boolean;
}

export interface ActiveTabContext {
  tabId: number;
  url: string;
  title: string;
  favIconUrl?: string;
  isInjectable: boolean;
  restrictionReason?: string;
}

export interface GetActiveTabContextResponse {
  tab: ActiveTabContext | null;
}

// -------------------------------------------------------------
// 2. INJECT_CONTENT_SCRIPT
// -------------------------------------------------------------
export interface InjectContentScriptRequest {
  tabId: number;
}

export interface InjectContentScriptResponse {
  tabId: number;
  injected: boolean;
  version: string;
}

// -------------------------------------------------------------
// 3. START_CAPTURE
// -------------------------------------------------------------
export interface StartCaptureRequest {
  tabId: number;
  mode: 'single-page' | 'multi-page';
  options?: {
    maxDepth?: number;
    captureImages?: boolean;
    includeShadowDom?: boolean;
  };
}

export interface StartCaptureResponse {
  job: JobRecord;
}

// -------------------------------------------------------------
// 4. CANCEL_JOB
// -------------------------------------------------------------
export interface CancelJobRequest {
  jobId: string;
  reason?: string;
}

export interface CancelJobResponse {
  job: JobRecord;
}

// -------------------------------------------------------------
// 5. GET_JOB_STATUS
// -------------------------------------------------------------
export interface GetJobStatusRequest {
  jobId?: string; // If omitted, returns active in-flight job if any
}

export interface GetJobStatusResponse {
  job: JobRecord | null;
}

// -------------------------------------------------------------
// 6. REQUEST_ORIGIN_PERMISSION
// -------------------------------------------------------------
export interface RequestOriginPermissionRequest {
  origin: string;
  reason: string;
}

export interface RequestOriginPermissionResponse {
  origin: string;
  granted: boolean;
}

// -------------------------------------------------------------
// 7. PING
// -------------------------------------------------------------
export interface PingRequest {
  timestamp?: number;
}

export interface PingResponse {
  pong: boolean;
  workerTime: number;
  version: string;
}

// -------------------------------------------------------------
// Streaming Port Contracts (connect name: 'STREAM_SNAPSHOT')
// -------------------------------------------------------------
export interface PageSnapshotChunk {
  type: 'PAGE_SNAPSHOT_CHUNK';
  jobId: string;
  seq: number;
  totalChunks: number;
  chunkData: string; // JSON or base64 chunk
  byteCount: number;
  checksum?: string;
}

export interface SnapshotAck {
  type: 'SNAPSHOT_ACK';
  jobId: string;
  receivedSeq: number;
  nextExpectedSeq: number;
}

export interface PortHeartbeatPing {
  type: 'PORT_HEARTBEAT_PING';
  timestamp: number;
  jobId?: string;
}

export interface PortHeartbeatPong {
  type: 'PORT_HEARTBEAT_PONG';
  clientTimestamp: number;
  workerTimestamp: number;
}

export type PortStreamMessage =
  | PageSnapshotChunk
  | SnapshotAck
  | PortHeartbeatPing
  | PortHeartbeatPong;
