/**
 * Web-to-Figma Injected Content Script.
 * Runs in authorized web pages (HTTP/HTTPS).
 * Communicates with the background worker via one-off messages and a streaming Port
 * with a 20-second keepalive heartbeat to prevent background service-worker termination.
 */

import { browser } from '../shared/browser/browser-api';
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
  }
  return undefined;
});

console.log('[WebToFigma] Content script loaded with streaming transport & keepalive.');
