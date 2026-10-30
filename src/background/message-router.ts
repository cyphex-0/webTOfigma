/**
 * Cross-Browser Message Router and Port Stream Coordinator.
 * Handles one-off RPC messages with schema validation and manages streaming Ports
 * with a 20-second keepalive heartbeat to prevent Chromium MV3 service-worker termination.
 */

import { browser } from '../shared/browser/browser-api';
import type { Runtime } from 'webextension-polyfill';
import { isInjectableUrl } from '../shared/browser/browser-capabilities';
import {
  ExtensionError,
  RestrictedUrlError,
  ScriptInjectionError,
  InvalidPayloadError,
  serializeError
} from '../shared/errors/extension-errors';
import { jobRegistry } from './job-registry';
import { requestOriginPermission } from './permission-manager';
import type {
  MessageEnvelope,
  MessageResponse,
  GetActiveTabContextResponse,
  InjectContentScriptResponse,
  StartCaptureRequest,
  StartCaptureResponse,
  CancelJobRequest,
  CancelJobResponse,
  GetJobStatusRequest,
  GetJobStatusResponse,
  RequestOriginPermissionRequest,
  RequestOriginPermissionResponse,
  PingResponse,
  PortStreamMessage,
  PageSnapshotChunk,
  SnapshotAck,
  PortHeartbeatPong
} from '../shared/contracts/messages';
import {
  StartCaptureRequestSchema,
  CancelJobRequestSchema,
  RequestOriginPermissionRequestSchema,
  PageSnapshotChunkSchema,
  PortHeartbeatPingSchema
} from '../shared/schemas/messages.schema';

export const STREAM_PORT_NAME = 'STREAM_SNAPSHOT';

// In-memory chunk buffer for active stream sessions: jobId -> Map<seq, chunkData>
const chunkBuffers: Map<string, Map<number, string>> = new Map();

/**
 * Dispatches one-off runtime messages based on type.
 */
export async function handleRuntimeMessage(
  message: unknown
): Promise<MessageResponse> {
  // If not an envelope, handle legacy ping or return error
  if (!message || typeof message !== 'object') {
    return {
      id: 'unknown',
      success: false,
      error: serializeError(new InvalidPayloadError('Message must be an object'))
    };
  }

  const envelope = message as Partial<MessageEnvelope>;
  const requestId = envelope.id ?? `req_${Date.now()}`;
  const type = envelope.type;

  try {
    switch (type) {
      // 1. Get Active Tab Context
      case 'GET_ACTIVE_TAB_CONTEXT': {
        const tabs = await browser.tabs.query({ active: true, currentWindow: true });
        const activeTab = tabs[0];
        if (!activeTab || typeof activeTab.id !== 'number') {
          const resp: GetActiveTabContextResponse = { tab: null };
          return { id: requestId, success: true, payload: resp };
        }

        const injectCheck = isInjectableUrl(activeTab.url);
        const resp: GetActiveTabContextResponse = {
          tab: {
            tabId: activeTab.id,
            url: activeTab.url ?? '',
            title: activeTab.title ?? 'Untitled Page',
            favIconUrl: activeTab.favIconUrl,
            isInjectable: injectCheck.injectable,
            restrictionReason: injectCheck.reason
          }
        };
        return { id: requestId, success: true, payload: resp };
      }

      // 2. Inject Content Script
      case 'INJECT_CONTENT_SCRIPT': {
        const payload = (envelope.payload ?? {}) as { tabId?: number };
        const tabId = payload.tabId;
        if (!tabId || typeof tabId !== 'number') {
          throw new InvalidPayloadError('Valid tabId is required for injection');
        }

        const tab = await browser.tabs.get(tabId);
        const injectCheck = isInjectableUrl(tab.url);
        if (!injectCheck.injectable) {
          throw new RestrictedUrlError(tab.url ?? 'unknown');
        }

        try {
          await browser.scripting.executeScript({
            target: { tabId },
            files: ['content.js']
          });

          const resp: InjectContentScriptResponse = {
            tabId,
            injected: true,
            version: '0.1.0'
          };
          return { id: requestId, success: true, payload: resp };
        } catch (injectErr: unknown) {
          const msg = injectErr instanceof Error ? injectErr.message : String(injectErr);
          throw new ScriptInjectionError(tabId, msg);
        }
      }

      // 3. Start Capture
      case 'START_CAPTURE': {
        const parseResult = StartCaptureRequestSchema.safeParse(envelope.payload);
        if (!parseResult.success) {
          throw new InvalidPayloadError(parseResult.error.message);
        }

        const { tabId, mode } = parseResult.data as StartCaptureRequest;
        const tab = await browser.tabs.get(tabId);
        const injectCheck = isInjectableUrl(tab.url);
        if (!injectCheck.injectable) {
          throw new RestrictedUrlError(tab.url ?? '');
        }

        const url = tab.url ?? '';
        const origin = new URL(url).origin;

        const createdJob = await jobRegistry.createJob({
          tabId,
          url,
          origin,
          mode
        });

        const activeJob = await jobRegistry.updateJobState(createdJob.jobId, 'capturing', {
          currentStep: 'Initializing page capture'
        });

        const resp: StartCaptureResponse = { job: activeJob };
        return { id: requestId, success: true, payload: resp };
      }

      // 4. Cancel Job
      case 'CANCEL_JOB': {
        const parseResult = CancelJobRequestSchema.safeParse(envelope.payload);
        if (!parseResult.success) {
          throw new InvalidPayloadError(parseResult.error.message);
        }

        const { jobId, reason } = parseResult.data as CancelJobRequest;
        const job = await jobRegistry.cancelJob(jobId, reason);
        const resp: CancelJobResponse = { job };
        return { id: requestId, success: true, payload: resp };
      }

      // 5. Get Job Status
      case 'GET_JOB_STATUS': {
        const payload = (envelope.payload ?? {}) as GetJobStatusRequest;
        const job = payload.jobId
          ? await jobRegistry.getJob(payload.jobId)
          : await jobRegistry.getActiveJob();

        const resp: GetJobStatusResponse = { job };
        return { id: requestId, success: true, payload: resp };
      }

      // 6. Request Origin Permission
      case 'REQUEST_ORIGIN_PERMISSION': {
        const parseResult = RequestOriginPermissionRequestSchema.safeParse(envelope.payload);
        if (!parseResult.success) {
          throw new InvalidPayloadError(parseResult.error.message);
        }

        const { origin, reason } = parseResult.data as RequestOriginPermissionRequest;
        const granted = await requestOriginPermission(origin, reason);
        const resp: RequestOriginPermissionResponse = { origin, granted };
        return { id: requestId, success: true, payload: resp };
      }

      // 7. Ping
      case 'PING': {
        const resp: PingResponse = {
          pong: true,
          workerTime: Date.now(),
          version: '0.1.0'
        };
        return { id: requestId, success: true, payload: resp };
      }

      default:
        throw new ExtensionError(
          `Unknown message type: "${type}"`,
          'INVALID_MESSAGE_PAYLOAD',
          false
        );
    }
  } catch (err: unknown) {
    return {
      id: requestId,
      success: false,
      error: serializeError(err)
    };
  }
}

/**
 * Handles long-running streaming Ports (STREAM_SNAPSHOT).
 * Implements keepalive heartbeat responses to prevent background service-worker termination.
 */
export function handlePortConnection(port: Runtime.Port): void {
  if (port.name !== STREAM_PORT_NAME) return;

  port.onMessage.addListener(async (msg: unknown) => {
    const streamMsg = msg as PortStreamMessage;

    // 1. Keepalive Heartbeat: Echo PONG to reset worker idle timer
    if (streamMsg.type === 'PORT_HEARTBEAT_PING') {
      const pingResult = PortHeartbeatPingSchema.safeParse(streamMsg);
      if (pingResult.success) {
        const pong: PortHeartbeatPong = {
          type: 'PORT_HEARTBEAT_PONG',
          clientTimestamp: pingResult.data.timestamp,
          workerTimestamp: Date.now()
        };
        try {
          port.postMessage(pong);
        } catch {
          // Port closed
        }
      }
      return;
    }

    // 2. Snapshot Chunk Ingestion
    if (streamMsg.type === 'PAGE_SNAPSHOT_CHUNK') {
      const chunkResult = PageSnapshotChunkSchema.safeParse(streamMsg);
      if (chunkResult.success) {
        const chunk = chunkResult.data as PageSnapshotChunk;
        const jobId = chunk.jobId;

        if (!chunkBuffers.has(jobId)) {
          chunkBuffers.set(jobId, new Map());
        }
        const buffer = chunkBuffers.get(jobId)!;
        buffer.set(chunk.seq, chunk.chunkData);

        // Update progress
        const percent = Math.min(100, Math.round((chunk.seq / chunk.totalChunks) * 100));
        await jobRegistry.updateJobState(jobId, 'capturing', {
          progressPercent: percent,
          currentStep: `Received snapshot chunk ${chunk.seq}/${chunk.totalChunks}`
        });

        // Send ACK
        const ack: SnapshotAck = {
          type: 'SNAPSHOT_ACK',
          jobId,
          receivedSeq: chunk.seq,
          nextExpectedSeq: chunk.seq + 1
        };
        try {
          port.postMessage(ack);
        } catch {
          // Port closed
        }

        // If last chunk received, transition to processing
        if (chunk.seq >= chunk.totalChunks) {
          await jobRegistry.updateJobState(jobId, 'processing', {
            progressPercent: 100,
            currentStep: 'Processing full DOM snapshot'
          });
        }
      }
    }
  });

  port.onDisconnect.addListener(() => {
    // Port disconnected
  });
}

/**
 * Registers background listeners synchronously upon script evaluation.
 */
export function registerMessageListeners(): void {
  browser.runtime.onMessage.addListener((message: unknown) => {
    return handleRuntimeMessage(message);
  });

  browser.runtime.onConnect.addListener((port: Runtime.Port) => {
    handlePortConnection(port);
  });
}
