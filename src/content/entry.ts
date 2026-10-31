/**
 * Web-to-Figma Injected Content Script.
 * Runs in authorized web pages (HTTP/HTTPS).
 * Communicates with the background worker via one-off messages and a streaming Port
 * with a 20-second keepalive heartbeat to prevent background service-worker termination.
 */

import { browser } from '../shared/browser/browser-api';
import { toggleMinibar, mountMinibar } from './minibar/inject-minibar';
import { teardownMinibar, isMinibarInjected } from './minibar/teardown';
import { DOMWalker } from '../core/dom/dom-walker';
import { ElementPicker } from './picker/element-picker';
import { rebaseSubtreeCoordinates } from '../core/dom/coordinate-normalizer';
import { enrichNodesWithSemantics } from '../core/dom/semantic-classifier';
import { executeExportPipeline, type ExportPipelineStage } from '../core/export/export-pipeline';

export const elementPicker = new ElementPicker();
const activeCaptureAbortControllers = new Map<string, AbortController>();
import type {
  PortHeartbeatPing,
  PortHeartbeatPong,
  PageSnapshotChunk,
  SnapshotAck,
  PortStreamMessage
} from '../shared/contracts/messages';
import type { Runtime } from 'webextension-polyfill';

export const STREAM_PORT_NAME = 'STREAM_SNAPSHOT';
export const KEEPALIVE_INTERVAL_MS = 20_000;

class StreamSnapshotClient {
  private port: Runtime.Port | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private activeJobId: string | null = null;

  connect(): Runtime.Port {
    if (this.port) return this.port;

    this.port = browser.runtime.connect({ name: STREAM_PORT_NAME });

    // Start 20-second keepalive heartbeat
    this.startHeartbeat();

    this.port.onMessage.addListener((msg: unknown) => {
      const streamMsg = msg as PortStreamMessage;
      if (streamMsg.type === 'PORT_HEARTBEAT_PONG') {
        const pong = streamMsg as PortHeartbeatPong;
        // Heartbeat acknowledged by worker
        void pong;
      }
    });

    this.port.onDisconnect.addListener(() => {
      this.stopHeartbeat();
      this.port = null;
    });

    return this.port;
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.port) {
        try {
          const ping: PortHeartbeatPing = {
            type: 'PORT_HEARTBEAT_PING',
            timestamp: Date.now(),
            ...(this.activeJobId ? { jobId: this.activeJobId } : {})
          };
          this.port.postMessage(ping);
        } catch {
          this.stopHeartbeat();
          this.port = null;
        }
      }
    }, KEEPALIVE_INTERVAL_MS);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Streams snapshot chunks across the Port with sequential acknowledgment.
   */
  async streamChunks(jobId: string, chunks: string[]): Promise<void> {
    this.activeJobId = jobId;
    const port = this.connect();

    for (let i = 0; i < chunks.length; i++) {
      const chunkData = chunks[i]!;
      const chunkMsg: PageSnapshotChunk = {
        type: 'PAGE_SNAPSHOT_CHUNK',
        jobId,
        seq: i + 1,
        totalChunks: chunks.length,
        chunkData,
        byteCount: chunkData.length
      };

      await new Promise<void>((resolve, reject) => {
        const ackHandler = (msg: unknown) => {
          const streamMsg = msg as PortStreamMessage;
          if (
            streamMsg.type === 'SNAPSHOT_ACK' &&
            (streamMsg as SnapshotAck).jobId === jobId &&
            (streamMsg as SnapshotAck).receivedSeq === chunkMsg.seq
          ) {
            port.onMessage.removeListener(ackHandler);
            resolve();
          }
        };

        const disconnectHandler = () => {
          port.onMessage.removeListener(ackHandler);
          port.onDisconnect.removeListener(disconnectHandler);
          reject(new Error(`Port disconnected while streaming chunk ${chunkMsg.seq}`));
        };

        port.onMessage.addListener(ackHandler);
        port.onDisconnect.addListener(disconnectHandler);

        try {
          port.postMessage(chunkMsg);
        } catch (err: unknown) {
          port.onMessage.removeListener(ackHandler);
          port.onDisconnect.removeListener(disconnectHandler);
          reject(err);
        }
      });
    }

    this.activeJobId = null;
  }

  disconnect(): void {
    this.stopHeartbeat();
    if (this.port) {
      try {
        this.port.disconnect();
      } catch {
        // Already disconnected
      }
      this.port = null;
    }
  }
}

// Global client instance in page scope
export const streamClient = new StreamSnapshotClient();

// Register message listeners
browser.runtime.onMessage.addListener((message: unknown) => {
  if (typeof message === 'object' && message !== null) {
    const msg = message as { type?: string };
    if (msg.type === 'CONTENT_PING' || msg.type === 'PING') {
      return Promise.resolve({
        status: 'CONTENT_PONG',
        location: window.location.href,
        title: document.title,
        timestamp: Date.now()
      });
    }

    if (msg.type === 'TOGGLE_MINIBAR') {
      const active = toggleMinibar();
      return Promise.resolve({ active });
    }

    if (msg.type === 'TEARDOWN_MINIBAR') {
      teardownMinibar();
      return Promise.resolve({ active: false });
    }

    if (msg.type === 'IS_MINIBAR_ACTIVE') {
      return Promise.resolve({ active: isMinibarInjected() });
    }

    if (msg.type === 'ACTIVATE_ELEMENT_PICKER') {
      const options = (msg as any).payload || {};
      elementPicker.start(
        (result) => {
          const walker = new DOMWalker({
            captureMode: 'select-element',
            resolvePaintOrder: true
          });
          const walkResult = walker.walk(result.element);

          const rebasedNodes = rebaseSubtreeCoordinates(
            walkResult.nodes,
            result.rect,
            {
              includeAncestorBackground: result.includeAncestorBackground,
              ancestorBackgroundColor: result.ancestorBackgroundColor
            }
          );

          const semanticNodes = enrichNodesWithSemantics(rebasedNodes);

          void browser.runtime.sendMessage({
            type: 'ELEMENT_PICKED',
            payload: {
              nodeCount: semanticNodes.length,
              rootTag: result.element.tagName.toLowerCase(),
              rootName: semanticNodes[0]?.name || 'Selected Element',
              sourceRect: result.rect
            }
          });
        },
        () => {
          console.log('[WebToFigma] Element picker cancelled.');
        }
      );
      return Promise.resolve({ active: true });
    }

    if (msg.type === 'CANCEL_ELEMENT_PICKER') {
      elementPicker.stop();
      return Promise.resolve({ active: false });
    }

    if (msg.type === 'IS_ELEMENT_PICKER_ACTIVE') {
      return Promise.resolve({ active: elementPicker.isActive() });
    }

    if (msg.type === 'EXTRACT_DOM_SNAPSHOT') {
      const payload = (msg as any).payload || {};
      const walker = new DOMWalker({
        maxNodeCount: payload.maxNodeCount,
        maxDepth: payload.maxDepth,
        resolvePaintOrder: payload.resolvePaintOrder ?? true,
        captureMode: payload.captureMode ?? 'full-page'
      });
      const result = walker.walk();
      return Promise.resolve(result);
    }

    if (msg.type === 'EXECUTE_CAPTURE') {
      const payload = (msg as any).payload || {};
      const jobId = payload.jobId as string;
      const mode = (payload.mode || 'full-page') as 'viewport' | 'selected-element' | 'full-page';
      const options = payload.options || {};

      if (!jobId) {
        return Promise.resolve({ success: false, error: 'Missing jobId' });
      }

      const abortController = new AbortController();
      activeCaptureAbortControllers.set(jobId, abortController);

      const progressMap: Record<ExportPipelineStage, number> = {
        idle: 5,
        capturing_dom: 20,
        validating_semantics: 40,
        fetching_assets: 60,
        analyzing_layout: 75,
        building_scene: 90,
        ready_to_copy: 100,
        failed: 100,
        cancelled: 100
      };

      // Notify initial start
      void browser.runtime.sendMessage({
        type: 'UPDATE_JOB_PROGRESS',
        payload: {
          jobId,
          stage: 'capturing_dom',
          currentStep: 'Extracting rendered DOM and visual geometry...',
          progressPercent: 15
        }
      });

      // Run pipeline asynchronously in page DOM context
      executeExportPipeline({
        jobId,
        mode,
        options,
        signal: abortController.signal,
        onStageChange: (stage, message) => {
          void browser.runtime.sendMessage({
            type: 'UPDATE_JOB_PROGRESS',
            payload: {
              jobId,
              stage,
              currentStep: message,
              progressPercent: progressMap[stage] ?? 50
            }
          });
        }
      }).then((result) => {
        activeCaptureAbortControllers.delete(jobId);
        if (result.stage === 'ready_to_copy' && result.scene) {
          void browser.runtime.sendMessage({
            type: 'FINISH_CAPTURE',
            payload: {
              jobId,
              scene: result.scene,
              diagnostics: result.diagnostics
            }
          });
        } else if (result.stage === 'cancelled') {
          void browser.runtime.sendMessage({
            type: 'UPDATE_JOB_PROGRESS',
            payload: {
              jobId,
              stage: 'cancelled',
              currentStep: result.error || 'Capture was cancelled',
              progressPercent: 100
            }
          });
        } else {
          void browser.runtime.sendMessage({
            type: 'UPDATE_JOB_PROGRESS',
            payload: {
              jobId,
              stage: 'failed',
              currentStep: result.error || 'Capture failed',
              progressPercent: 100
            }
          });
        }
      }).catch((err: unknown) => {
        activeCaptureAbortControllers.delete(jobId);
        const errMsg = err instanceof Error ? err.message : String(err);
        void browser.runtime.sendMessage({
          type: 'UPDATE_JOB_PROGRESS',
          payload: {
            jobId,
            stage: 'failed',
            currentStep: `Capture failed: ${errMsg}`,
            progressPercent: 100,
            error: errMsg
          }
        });
      });

      return Promise.resolve({ success: true, jobId });
    }

    if (msg.type === 'CANCEL_CAPTURE') {
      const payload = (msg as any).payload || {};
      const jobId = payload.jobId as string;
      if (jobId && activeCaptureAbortControllers.has(jobId)) {
        activeCaptureAbortControllers.get(jobId)!.abort();
        activeCaptureAbortControllers.delete(jobId);
      }
      return Promise.resolve({ success: true });
    }
  }
  return undefined;
});

// Clean teardown upon navigation / page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    for (const controller of activeCaptureAbortControllers.values()) {
      controller.abort();
    }
    activeCaptureAbortControllers.clear();
    elementPicker.stop();
    teardownMinibar();
    streamClient.disconnect();
  });
}

console.log('[WebToFigma] Content script loaded with streaming transport, keepalive & minibar.');
