import { describe, it, expect, beforeEach } from 'vitest';
import { handlePortConnection, STREAM_PORT_NAME } from '../../background/message-router';
import { jobRegistry } from '../../background/job-registry';
import type { Runtime } from 'webextension-polyfill';

describe('Streaming Port Transport and Keepalive Heartbeat', () => {
  beforeEach(async () => {
    await jobRegistry.clearAll();
  });

  function createMockPort(name = STREAM_PORT_NAME): {
    port: Runtime.Port;
    clientMessages: any[];
    disconnectListener: () => void;
    simulateMessage: (msg: any) => Promise<void>;
  } {
    const clientMessages: any[] = [];
    let messageListener: ((msg: any) => void) | null = null;
    let disconnectListener: (() => void) | null = null;

    const port: any = {
      name,
      postMessage: (msg: any) => {
        clientMessages.push(msg);
      },
      onMessage: {
        addListener: (fn: any) => {
          messageListener = fn;
        },
        removeListener: () => {}
      },
      onDisconnect: {
        addListener: (fn: any) => {
          disconnectListener = fn;
        },
        removeListener: () => {}
      },
      disconnect: () => {
        disconnectListener?.();
      }
    };

    return {
      port,
      clientMessages,
      disconnectListener: () => disconnectListener?.(),
      simulateMessage: async (msg: any) => {
        if (messageListener) {
          await messageListener(msg);
        }
      }
    };
  }

  it('echoes PORT_HEARTBEAT_PONG upon receiving PORT_HEARTBEAT_PING to reset idle timer', async () => {
    const mock = createMockPort();
    handlePortConnection(mock.port);

    const clientTimestamp = Date.now();
    await mock.simulateMessage({
      type: 'PORT_HEARTBEAT_PING',
      timestamp: clientTimestamp
    });

    expect(mock.clientMessages).toHaveLength(1);
    const pong = mock.clientMessages[0];
    expect(pong.type).toBe('PORT_HEARTBEAT_PONG');
    expect(pong.clientTimestamp).toBe(clientTimestamp);
    expect(pong.workerTimestamp).toBeGreaterThanOrEqual(clientTimestamp);
  });

  it('streams snapshot chunks, emits sequential ACKs, and updates job progress', async () => {
    const job = await jobRegistry.createJob({
      tabId: 10,
      url: 'https://stream.test',
      origin: 'https://stream.test',
      mode: 'single-page'
    });

    const mock = createMockPort();
    handlePortConnection(mock.port);

    // Send Chunk 1 of 2
    await mock.simulateMessage({
      type: 'PAGE_SNAPSHOT_CHUNK',
      jobId: job.jobId,
      seq: 1,
      totalChunks: 2,
      chunkData: '{"nodes": [1, 2]}',
      byteCount: 18
    });

    expect(mock.clientMessages).toHaveLength(1);
    expect(mock.clientMessages[0]).toEqual({
      type: 'SNAPSHOT_ACK',
      jobId: job.jobId,
      receivedSeq: 1,
      nextExpectedSeq: 2
    });

    const jobAfterChunk1 = await jobRegistry.getJob(job.jobId);
    expect(jobAfterChunk1?.progressPercent).toBe(50);
    expect(jobAfterChunk1?.state).toBe('capturing');

    // Send Chunk 2 of 2 (Final)
    await mock.simulateMessage({
      type: 'PAGE_SNAPSHOT_CHUNK',
      jobId: job.jobId,
      seq: 2,
      totalChunks: 2,
      chunkData: '{"nodes": [3, 4]}',
      byteCount: 18
    });

    expect(mock.clientMessages).toHaveLength(2);
    expect(mock.clientMessages[1].receivedSeq).toBe(2);

    const jobAfterFinalChunk = await jobRegistry.getJob(job.jobId);
    expect(jobAfterFinalChunk?.progressPercent).toBe(100);
    expect(jobAfterFinalChunk?.state).toBe('processing');
  });

  it('ignores ports with non-matching port names', async () => {
    const mock = createMockPort('SOME_OTHER_PORT');
    handlePortConnection(mock.port);

    await mock.simulateMessage({
      type: 'PORT_HEARTBEAT_PING',
      timestamp: Date.now()
    });

    expect(mock.clientMessages).toHaveLength(0);
  });
});
