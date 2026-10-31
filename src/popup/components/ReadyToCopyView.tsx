import React, { useState } from 'react';
import type { JobRecord } from '../../shared/contracts/messages';
import type { ClipboardBatch } from '../../core/figma/clipboard/batch-partitioner';
import { ClipboardResult } from './ClipboardResult';

export interface ReadyToCopyViewProps {
  job: JobRecord;
  onCopyToClipboard: () => Promise<{ success: boolean; bytesWritten?: number; error?: string }>;
  onStartNew: () => void;
  batches?: ClipboardBatch[] | undefined;
  onCopyBatch?: ((batchIndex: number) => Promise<void>) | undefined;
}

export const ReadyToCopyView: React.FC<ReadyToCopyViewProps> = ({
  job,
  onCopyToClipboard,
  onStartNew,
  batches: externalBatches,
  onCopyBatch
}) => {
  const createDefaultBatch = (): ClipboardBatch => ({
    batchId: `batch_${job.jobId}`,
    batchIndex: 1,
    totalBatches: 1,
    pageFrames: [],
    metadata: [],
    nodes: Array.from({ length: job.nodeCount ?? 1 }, (_, i) => ({
      id: `node_${i}`,
      parentId: null,
      childIds: [],
      name: `Node ${i + 1}`,
      type: 'FRAME',
      visible: true,
      x: 0,
      y: 0,
      width: 1440,
      height: 900,
      rotation: 0,
      fills: [],
      strokes: [],
      effects: [],
      clipsContent: true
    })),
    status: 'ready',
    estimatedBytes: (job.nodeCount ?? 1) * 65
  });

  const [batches, setBatches] = useState<ClipboardBatch[]>(() =>
    externalBatches && externalBatches.length > 0 ? externalBatches : [createDefaultBatch()]
  );

  const handleCopyBatch = async (batchIndex: number) => {
    if (onCopyBatch) {
      await onCopyBatch(batchIndex);
    } else {
      const res = await onCopyToClipboard();
      if (!res.success) {
        throw new Error(res.error ?? 'Failed to write to clipboard');
      }
    }

    setBatches((prev) =>
      prev.map((b) =>
        b.batchIndex === batchIndex
          ? { ...b, status: 'copied', copiedAt: Date.now() }
          : b
      )
    );
  };

  return (
    <div className="ready-to-copy-view" role="region" aria-labelledby="ready-to-copy-title">
      <div className="ready-header">
        <div className="ready-icon-wrap" aria-hidden="true">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="12" fill="#10B981" />
            <path d="M7 12.5L10.5 16L17 8.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div className="ready-titles">
          <h2 id="ready-to-copy-title" className="ready-title">Capture Finished</h2>
          <span className="ready-subtitle">Vector scene graph packaged and ready</span>
        </div>
      </div>

      <div className="ready-stats-card">
        <div className="stat-item">
          <span className="stat-label">Nodes</span>
          <span className="stat-value">{job.nodeCount?.toLocaleString() ?? '1'}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Mode</span>
          <span className="stat-value">{job.mode}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Status</span>
          <span className="stat-value ready-status-badge">Ready to Copy</span>
        </div>
      </div>

      <ClipboardResult
        batches={batches}
        onCopyBatch={handleCopyBatch}
        onStartNew={onStartNew}
      />
    </div>
  );
};
