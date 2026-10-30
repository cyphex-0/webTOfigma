import { describe, it, expect, beforeEach } from 'vitest';
import { ExportJobController } from '../../background/export-job-controller';
import { MemoryCaptureStorage } from '../../core/storage/capture-database';
import { jobRegistry } from '../../background/job-registry';

describe('Background ExportJobController', () => {
  let storage: MemoryCaptureStorage;
  let controller: ExportJobController;

  beforeEach(async () => {
    storage = new MemoryCaptureStorage();
    controller = new ExportJobController(storage);
    await jobRegistry.initialize();

    document.body.innerHTML = `
      <header style="width: 1200px; height: 60px; background-color: #fff;">
        <h1 style="width: 200px; height: 30px;">Acme Platform</h1>
      </header>
      <main style="width: 1200px; height: 500px; background-color: #f1f5f9;">
        <p style="width: 300px; height: 20px;">Welcome</p>
      </main>
    `;
  });

  it('coordinates export lifecycle and saves FigmaSceneDocument upon ready_to_copy', async () => {
    const job = await controller.startExport({
      tabId: 1,
      url: 'https://acme.io/landing',
      origin: 'https://acme.io',
      mode: 'viewport'
    });

    expect(job).toBeDefined();
    expect(job.jobId).toBeDefined();

    // Run pipeline synchronously for test verification
    const abortController = new AbortController();
    const result = await controller.runPipeline(
      job.jobId,
      {
        tabId: 1,
        url: 'https://acme.io/landing',
        origin: 'https://acme.io',
        mode: 'viewport'
      },
      abortController.signal
    );

    expect(result.stage).toBe('ready_to_copy');

    // Verify document was persisted in storage
    const storedDoc = await controller.getStoredScene(job.jobId);
    expect(storedDoc).toBeDefined();
    expect(storedDoc?.pageFrames).toHaveLength(1);
    expect(storedDoc?.sourceSite).toBe('https://acme.io');

    const updatedJob = await jobRegistry.getJob(job.jobId);
    expect(updatedJob?.state).toBe('ready_to_copy');
  });

  it('cancels active job and removes stored data', async () => {
    const job = await controller.startExport({
      tabId: 2,
      url: 'https://acme.io/pricing',
      origin: 'https://acme.io',
      mode: 'viewport'
    });

    await controller.cancelJob(job.jobId);

    const cancelledJob = await jobRegistry.getJob(job.jobId);
    expect(cancelledJob?.state).toBe('cancelled');

    const storedDoc = await controller.getStoredScene(job.jobId);
    expect(storedDoc).toBeNull();
  });

  it('marks job completed after successful clipboard copy', async () => {
    const job = await controller.startExport({
      tabId: 3,
      url: 'https://acme.io/blog',
      origin: 'https://acme.io',
      mode: 'viewport'
    });

    await controller.markCompleted(job.jobId);

    const completedJob = await jobRegistry.getJob(job.jobId);
    expect(completedJob?.state).toBe('completed');
    expect(completedJob?.currentStep).toBe('Copied to Figma');
  });
});
