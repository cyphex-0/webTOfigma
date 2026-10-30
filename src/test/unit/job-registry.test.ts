import { describe, it, expect, beforeEach } from 'vitest';
import { jobRegistry } from '../../background/job-registry';

describe('Job Registry and Durable State Machine', () => {
  beforeEach(async () => {
    await jobRegistry.clearAll();
  });

  it('creates and persists a new capture job with initial state', async () => {
    const job = await jobRegistry.createJob({
      tabId: 42,
      url: 'https://example.com',
      origin: 'https://example.com',
      mode: 'single-page'
    });

    expect(job.jobId).toMatch(/^job_\d+_[a-z0-9]+$/);
    expect(job.state).toBe('created');
    expect(job.tabId).toBe(42);
    expect(job.progressPercent).toBe(0);
    expect(job.warnings).toHaveLength(0);

    // Retrieve active job
    const active = await jobRegistry.getActiveJob();
    expect(active?.jobId).toBe(job.jobId);
  });

  it('updates job lifecycle state and notifies subscribers', async () => {
    const job = await jobRegistry.createJob({
      tabId: 10,
      url: 'https://test.dev',
      origin: 'https://test.dev',
      mode: 'multi-page'
    });

    const transitions: string[] = [];
    const unsubscribe = jobRegistry.onJobChange((j) => {
      transitions.push(j.state);
    });

    await jobRegistry.updateJobState(job.jobId, 'capturing', {
      progressPercent: 25,
      currentStep: 'Extracting DOM'
    });

    await jobRegistry.updateJobState(job.jobId, 'processing', {
      progressPercent: 75,
      currentStep: 'Converting to Kiwi schema'
    });

    await jobRegistry.updateJobState(job.jobId, 'ready_to_copy', {
      progressPercent: 100,
      currentStep: 'Ready to paste into Figma'
    });

    expect(transitions).toEqual(['capturing', 'processing', 'ready_to_copy']);

    const finalJob = await jobRegistry.getJob(job.jobId);
    expect(finalJob?.state).toBe('ready_to_copy');
    expect(finalJob?.progressPercent).toBe(100);

    unsubscribe();
  });

  it('clears active job pointer when transitioning to terminal states', async () => {
    const job = await jobRegistry.createJob({
      tabId: 5,
      url: 'https://example.org',
      origin: 'https://example.org',
      mode: 'single-page'
    });

    expect(await jobRegistry.getActiveJob()).not.toBeNull();

    // Complete job
    await jobRegistry.updateJobState(job.jobId, 'completed', {
      currentStep: 'Export complete'
    });

    expect(await jobRegistry.getActiveJob()).toBeNull();
  });

  it('cancels active job properly', async () => {
    const job = await jobRegistry.createJob({
      tabId: 99,
      url: 'https://cancel.test',
      origin: 'https://cancel.test',
      mode: 'single-page'
    });

    await jobRegistry.cancelJob(job.jobId, 'User clicked stop');
    const cancelled = await jobRegistry.getJob(job.jobId);

    expect(cancelled?.state).toBe('cancelled');
    expect(cancelled?.currentStep).toContain('User clicked stop');
    expect(await jobRegistry.getActiveJob()).toBeNull();
  });

  it('recovers or prunes stale in-flight jobs after worker restart', async () => {
    const job = await jobRegistry.createJob({
      tabId: 1,
      url: 'https://stale.test',
      origin: 'https://stale.test',
      mode: 'single-page'
    });

    await jobRegistry.updateJobState(job.jobId, 'capturing');

    // Manually backdate updatedAt to simulate background worker suspension > 5 mins ago
    const backdatedJob = {
      ...(await jobRegistry.getJob(job.jobId))!,
      updatedAt: Date.now() - 360_000 // 6 minutes ago
    };
    // Force write backdated job into registry cache
    await jobRegistry.updateJobState(job.jobId, 'capturing');
    (jobRegistry as any).inMemoryCache.set(job.jobId, backdatedJob);

    // Run recovery
    await jobRegistry.recoverOrPruneStaleJobs(300_000);

    const recovered = await jobRegistry.getJob(job.jobId);
    expect(recovered?.state).toBe('failed');
    expect(recovered?.error?.code).toBe('JOB_TIMEOUT');
    expect(await jobRegistry.getActiveJob()).toBeNull();
  });
});
