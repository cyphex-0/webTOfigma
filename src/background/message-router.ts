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
import { getCaptureStorage } from '../core/storage/capture-database';
import { buildFigmaSceneDocument } from '../core/scene/scene-builder';
import type { PageScene } from '../shared/contracts/scene';
import type { ExportDiagnostic } from '../shared/contracts/diagnostics';
import type {
  JobState,
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
  ToggleMinibarResponse,
  TeardownMinibarResponse,
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
  message: unknown,
  sender?: Runtime.MessageSender
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
        const rawPayload = (envelope.payload ?? {}) as Record<string, unknown>;
        let targetTabId = typeof rawPayload.tabId === 'number' ? rawPayload.tabId : undefined;
        if (!targetTabId && sender?.tab?.id) {
          targetTabId = sender.tab.id;
        }
        if (!targetTabId) {
          const activeTabs = await browser.tabs.query({ active: true, currentWindow: true });
          if (activeTabs[0]?.id) {
            targetTabId = activeTabs[0].id;
          }
        }
        const payloadWithTab = { ...rawPayload, tabId: targetTabId };
        const parseResult = StartCaptureRequestSchema.safeParse(payloadWithTab);
        if (!parseResult.success) {
          throw new InvalidPayloadError(parseResult.error.message);
        }

        const data = parseResult.data;
        const tabId = data.tabId as number;
        const requestedMode = data.mode;
        const isMulti =
          requestedMode === 'selected-pages' ||
          requestedMode === 'odd-pages' ||
          requestedMode === 'even-pages' ||
          requestedMode === 'entire-site' ||
          requestedMode === 'multi-page';
        const jobMode: 'single-page' | 'multi-page' = isMulti ? 'multi-page' : 'single-page';

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
          mode: jobMode
        });

        const activeJob = await jobRegistry.updateJobState(createdJob.jobId, 'capturing', {
          currentStep: 'Initializing page capture',
          progressPercent: 5
        });

        // Ensure content script is injected in target tab
        try {
          await browser.scripting.executeScript({
            target: { tabId },
            files: ['content.js']
          });
        } catch {
          // Already injected or supported
        }

        // Map mode for execution pipeline
        let pipelineMode: 'viewport' | 'selected-element' | 'full-page' = 'full-page';
        if (requestedMode === 'viewport') {
          pipelineMode = 'viewport';
        } else if (requestedMode === 'select-element') {
          pipelineMode = 'selected-element';
        }

        // Dispatch execution to content script asynchronously
        void browser.tabs
          .sendMessage(tabId, {
            type: 'EXECUTE_CAPTURE',
            payload: {
              jobId: createdJob.jobId,
              mode: pipelineMode,
              options: data.options,
              userOptions: data.userOptions
            }
          })
          .catch(async (sendErr) => {
            console.error('[WebToFigma] Failed to dispatch EXECUTE_CAPTURE to tab:', sendErr);
            await jobRegistry.updateJobState(createdJob.jobId, 'failed', {
              currentStep: `Failed to initiate capture in page: ${sendErr instanceof Error ? sendErr.message : String(sendErr)}`
            });
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

        if (job.tabId) {
          browser.tabs
            .sendMessage(job.tabId, {
              type: 'CANCEL_CAPTURE',
              payload: { jobId, reason }
            })
            .catch(() => {
              // Tab may have navigated or closed
            });
        }

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

      // 8. Toggle In-Page Minibar
      case 'TOGGLE_MINIBAR': {
        const rawPayload = (envelope.payload ?? {}) as { tabId?: number };
        let tabId = rawPayload.tabId;
        if (!tabId && sender?.tab?.id) {
          tabId = sender.tab.id;
        }
        if (!tabId) {
          const activeTabs = await browser.tabs.query({ active: true, currentWindow: true });
          tabId = activeTabs[0]?.id;
        }
        if (!tabId) {
          throw new InvalidPayloadError('No target tab found for minibar toggle');
        }

        try {
          const res = (await browser.tabs.sendMessage(tabId, {
            type: 'TOGGLE_MINIBAR'
          })) as ToggleMinibarResponse;
          return { id: requestId, success: true, payload: res };
        } catch {
          // If content script was not yet injected into this tab, inject it then toggle
          try {
            await browser.scripting.executeScript({
              target: { tabId },
              files: ['content.js']
            });
            const res = (await browser.tabs.sendMessage(tabId, {
              type: 'TOGGLE_MINIBAR'
            })) as ToggleMinibarResponse;
            return { id: requestId, success: true, payload: res };
          } catch (injectErr: unknown) {
            const msg = injectErr instanceof Error ? injectErr.message : String(injectErr);
            throw new ScriptInjectionError(tabId, msg);
          }
        }
      }

      // 9. Teardown In-Page Minibar
      case 'TEARDOWN_MINIBAR': {
        const rawPayload = (envelope.payload ?? {}) as { tabId?: number };
        let tabId = rawPayload.tabId;
        if (!tabId && sender?.tab?.id) {
          tabId = sender.tab.id;
        }
        if (!tabId) {
          const activeTabs = await browser.tabs.query({ active: true, currentWindow: true });
          tabId = activeTabs[0]?.id;
        }
        if (!tabId) {
          return { id: requestId, success: true, payload: { active: false } as TeardownMinibarResponse };
        }

        try {
          const res = (await browser.tabs.sendMessage(tabId, {
            type: 'TEARDOWN_MINIBAR'
          })) as TeardownMinibarResponse;
          return { id: requestId, success: true, payload: res };
        } catch {
          return { id: requestId, success: true, payload: { active: false } as TeardownMinibarResponse };
        }
      }

      // 10. Activate Element Picker
      case 'ACTIVATE_ELEMENT_PICKER': {
        const rawPayload = (envelope.payload ?? {}) as { tabId?: number; options?: unknown };
        let tabId = rawPayload.tabId;
        if (!tabId && sender?.tab?.id) {
          tabId = sender.tab.id;
        }
        if (!tabId) {
          const activeTabs = await browser.tabs.query({ active: true, currentWindow: true });
          tabId = activeTabs[0]?.id;
        }
        if (!tabId) {
          throw new InvalidPayloadError('No target tab found for element picker');
        }

        try {
          const res = (await browser.tabs.sendMessage(tabId, {
            type: 'ACTIVATE_ELEMENT_PICKER',
            payload: rawPayload.options
          })) as { active: boolean };
          return { id: requestId, success: true, payload: res };
        } catch {
          try {
            await browser.scripting.executeScript({
              target: { tabId },
              files: ['content.js']
            });
            const res = (await browser.tabs.sendMessage(tabId, {
              type: 'ACTIVATE_ELEMENT_PICKER',
              payload: rawPayload.options
            })) as { active: boolean };
            return { id: requestId, success: true, payload: res };
          } catch (injectErr: unknown) {
            const msg = injectErr instanceof Error ? injectErr.message : String(injectErr);
            throw new ScriptInjectionError(tabId, msg);
          }
        }
      }

      // 11. Cancel Element Picker
      case 'CANCEL_ELEMENT_PICKER': {
        const rawPayload = (envelope.payload ?? {}) as { tabId?: number };
        let tabId = rawPayload.tabId;
        if (!tabId && sender?.tab?.id) {
          tabId = sender.tab.id;
        }
        if (!tabId) {
          const activeTabs = await browser.tabs.query({ active: true, currentWindow: true });
          tabId = activeTabs[0]?.id;
        }
        if (!tabId) {
          return { id: requestId, success: true, payload: { active: false } };
        }

        try {
          const res = (await browser.tabs.sendMessage(tabId, {
            type: 'CANCEL_ELEMENT_PICKER'
          })) as { active: boolean };
          return { id: requestId, success: true, payload: res };
        } catch {
          return { id: requestId, success: true, payload: { active: false } };
        }
      }

      // 12. Update Job Progress (from Content Script)
      case 'UPDATE_JOB_PROGRESS': {
        const payload = (envelope.payload ?? {}) as {
          jobId?: string;
          stage?: string;
          currentStep?: string;
          progressPercent?: number;
          nodeCount?: number;
          error?: string;
        };
        if (!payload.jobId) {
          throw new InvalidPayloadError('jobId is required for UPDATE_JOB_PROGRESS');
        }

        let jobState: JobState = 'capturing';
        if (payload.stage === 'analyzing_layout' || payload.stage === 'building_scene') {
          jobState = 'processing';
        } else if (payload.stage === 'ready_to_copy') {
          jobState = 'ready_to_copy';
        } else if (payload.stage === 'failed') {
          jobState = 'failed';
        } else if (payload.stage === 'cancelled') {
          jobState = 'cancelled';
        }

        const updated = await jobRegistry.updateJobState(payload.jobId, jobState, {
          ...(payload.currentStep !== undefined ? { currentStep: payload.currentStep } : {}),
          ...(payload.progressPercent !== undefined ? { progressPercent: payload.progressPercent } : {}),
          ...(payload.nodeCount !== undefined ? { nodeCount: payload.nodeCount } : {}),
          ...(payload.error !== undefined
            ? { error: serializeError(new ExtensionError(payload.error, 'UNKNOWN_ERROR', false)) }
            : {})
        });

        return { id: requestId, success: true, payload: { job: updated } };
      }

      // 13. Finish Capture (from Content Script)
      case 'FINISH_CAPTURE': {
        const payload = (envelope.payload ?? {}) as {
          jobId?: string;
          scene?: PageScene;
          diagnostics?: ExportDiagnostic[];
        };
        if (!payload.jobId || !payload.scene) {
          throw new InvalidPayloadError('jobId and scene are required for FINISH_CAPTURE');
        }

        const existingJob = await jobRegistry.getJob(payload.jobId);
        const origin = existingJob?.origin ?? 'Web Export';
        const title = payload.scene.metadata.title || 'Web to Figma Export';

        // Build FigmaSceneDocument
        const figmaDoc = buildFigmaSceneDocument([payload.scene], {
          exportTitle: title,
          sourceSite: origin
        });

        const storage = await getCaptureStorage();
        await storage.saveSceneDocument({
          ...figmaDoc,
          allNodes: payload.scene.nodes,
          jobId: payload.jobId
        });

        const updatedJob = await jobRegistry.updateJobState(payload.jobId, 'ready_to_copy', {
          currentStep: 'Scene ready to copy to clipboard',
          progressPercent: 100,
          nodeCount: payload.scene.nodes.length
        });

        return { id: requestId, success: true, payload: { job: updatedJob } };
      }

      // 14. Get Stored Scene Document
      case 'GET_SCENE_DOCUMENT': {
        const payload = (envelope.payload ?? {}) as { jobId?: string };
        if (!payload.jobId) {
          throw new InvalidPayloadError('jobId is required for GET_SCENE_DOCUMENT');
        }
        const storage = await getCaptureStorage();
        const doc = await storage.getSceneDocument(payload.jobId);
        return { id: requestId, success: true, payload: { document: doc } };
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
  browser.runtime.onMessage.addListener((message: unknown, sender: Runtime.MessageSender) => {
    return handleRuntimeMessage(message, sender);
  });

  browser.runtime.onConnect.addListener((port: Runtime.Port) => {
    handlePortConnection(port);
  });
}
