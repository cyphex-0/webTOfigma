import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ClipboardResult } from '../../popup/components/ClipboardResult';
import type { ClipboardBatch } from '../../core/figma/clipboard/batch-partitioner';
import type { SceneNode } from '../../shared/contracts/scene';

describe('ClipboardResult UI Component (Phase 20)', () => {
  const sampleNodes: SceneNode[] = [
    {
      id: 'f1',
      parentId: null,
      childIds: [],
      name: 'Hero Frame',
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
    }
  ];

  const singleBatch: ClipboardBatch[] = [
    {
      batchId: 'batch_single',
      batchIndex: 1,
      totalBatches: 1,
      pageFrames: sampleNodes,
      metadata: [],
      nodes: sampleNodes,
      status: 'ready',
      estimatedBytes: 2500
    }
  ];

  const multiBatches: ClipboardBatch[] = [
    {
      batchId: 'batch_1',
      batchIndex: 1,
      totalBatches: 3,
      pageFrames: sampleNodes,
      metadata: [],
      nodes: sampleNodes,
      status: 'ready',
      estimatedBytes: 2500
    },
    {
      batchId: 'batch_2',
      batchIndex: 2,
      totalBatches: 3,
      pageFrames: sampleNodes,
      metadata: [],
      nodes: sampleNodes,
      status: 'ready',
      estimatedBytes: 3000
    },
    {
      batchId: 'batch_3',
      batchIndex: 3,
      totalBatches: 3,
      pageFrames: sampleNodes,
      metadata: [],
      nodes: sampleNodes,
      status: 'ready',
      estimatedBytes: 2800
    }
  ];

  it('renders single batch ready state with enabled Copy to Figma button', async () => {
    const handleCopy = vi.fn().mockResolvedValue(undefined);
    render(<ClipboardResult batches={singleBatch} onCopyBatch={handleCopy} />);

    expect(screen.getByText('Scene Ready for Figma')).toBeDefined();
    expect(screen.getByText(/vector nodes ready/i)).toBeDefined();

    const copyBtn = screen.getByRole('button', { name: /Copy to Figma/i }) as HTMLButtonElement;
    expect(copyBtn.disabled).toBe(false);

    await act(async () => {
      fireEvent.click(copyBtn);
    });
    expect(handleCopy).toHaveBeenCalledWith(1);
  });

  it('renders multi-batch stepper with Batch 1 of 3 and pill buttons', () => {
    const handleCopy = vi.fn().mockResolvedValue(undefined);
    const handleSelect = vi.fn();
    render(
      <ClipboardResult
        batches={multiBatches}
        onCopyBatch={handleCopy}
        onSelectBatch={handleSelect}
      />
    );

    expect(screen.getByText('Batch 1 of 3')).toBeDefined();
    const pills = screen.getAllByRole('tab');
    expect(pills).toHaveLength(3);

    // Click pill 2 to switch batch
    fireEvent.click(pills[1]!);
    expect(handleSelect).toHaveBeenCalledWith(2);
    expect(screen.getByText('Batch 2 of 3')).toBeDefined();
  });

  it('displays honest confirmation with paste instructions and non-claim disclaimer on copied state', () => {
    const copiedBatches: ClipboardBatch[] = [
      {
        ...singleBatch[0]!,
        status: 'copied',
        copiedAt: Date.now()
      }
    ];

    render(<ClipboardResult batches={copiedBatches} onCopyBatch={vi.fn()} />);

    expect(screen.getByText('Copied to Clipboard!')).toBeDefined();
    expect(screen.getByText('Next Step: Paste into Figma')).toBeDefined();
    expect(
      screen.getByText(
        /The extension copied the payload to your system clipboard; it does not control Figma or verify paste\./i
      )
    ).toBeDefined();
  });

  it('displays error box and Retry Batch button on failed copy', async () => {
    const failedBatches: ClipboardBatch[] = [
      {
        ...singleBatch[0]!,
        status: 'failed',
        error: 'Clipboard write permission denied by user'
      }
    ];

    const handleRetry = vi.fn().mockResolvedValue(undefined);
    render(
      <ClipboardResult
        batches={failedBatches}
        onCopyBatch={vi.fn()}
        onRetryBatch={handleRetry}
      />
    );

    expect(screen.getByText(/Copy failed for Batch 1/i)).toBeDefined();
    expect(screen.getByText(/Clipboard write permission denied by user/i)).toBeDefined();

    const retryBtn = screen.getByRole('button', { name: /Retry Batch 1/i });
    expect(retryBtn).toBeDefined();

    await act(async () => {
      fireEvent.click(retryBtn);
    });
    expect(handleRetry).toHaveBeenCalledWith(1);
  });

  it('triggers onExportDiagnostics and onStartNew when corresponding buttons are clicked', () => {
    const handleExportDiag = vi.fn();
    const handleStartNew = vi.fn();

    render(
      <ClipboardResult
        batches={singleBatch}
        onCopyBatch={vi.fn()}
        onExportDiagnostics={handleExportDiag}
        onStartNew={handleStartNew}
      />
    );

    const diagBtn = screen.getByRole('button', { name: /Export Diagnostics \(JSON\)/i });
    fireEvent.click(diagBtn);
    expect(handleExportDiag).toHaveBeenCalledWith(1);

    const newBtn = screen.getByRole('button', { name: /Start New Export/i });
    fireEvent.click(newBtn);
    expect(handleStartNew).toHaveBeenCalled();
  });
});
