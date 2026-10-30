/**
 * Background Export Job Controller.
 * 
 * Coordinates the full lifecycle of export jobs:
 * - Initializes jobs in JobRegistry and tracks durable state.
 * - Manages AbortControllers for responsive cancellation.
 * - Persists generated FigmaSceneDocuments in CaptureStorage (IndexedDB / memory).
 * - Transitions job states to 'ready_to_copy' upon successful scene generation.
 * - Handles retry and storage TTL cleanup.
 */

import { jobRegistry } from './job-registry';
import { getCaptureStorage, CaptureStorage } from '../core/storage/capture-database';
import { JobRecord, JobState } from '../shared/contracts/messages';
import { PageScene, FigmaSceneDocument } from '../shared/contracts/scene';
import { buildFigmaSceneDocument } from '../core/scene/scene-builder';
import { executeExportPipeline, ExportPipelineRequest, ExportPipelineResult } from '../core/export/export-pipeline';

export interface StartExportParams {
  tabId: number;
  url: string;
  origin: string;
  mode: 'viewport' | 'selected-element' | 'full-page';
  options?: ExportPipelineRequest['options'] | undefined;
  targetElement?: Element | undefined;
}

export class ExportJobController {
  private abortControllers = new Map<string, AbortController>();
  private storagePromise: Promise<CaptureStorage>;

  constructor(storage?: CaptureStorage) {
    this.storagePromise = storage ? Promise.resolve(storage) : getCaptureStorage();
  }

  /**
   * Starts a new export job, coordinates pipeline execution, and handles durable transitions.
   */
  async startExport(params: StartExportParams): Promise<JobRecord> {
    const job = await jobRegistry.createJob({
      tabId: params.tabId,
      url: params.url,
      origin: params.origin,
      mode: 'single-page'
    });

    const abortController = new AbortController();
    this.abortControllers.set(job.jobId, abortController);

    // Initial state: capturing
    await jobRegistry.updateJobState(job.jobId, 'capturing', {
      currentStep: 'Starting capture pipeline'
    });

    // Run pipeline asynchronously
    this.runPipeline(job.jobId, params, abortController.signal).catch(async (err) => {
      await jobRegistry.updateJobState(job.jobId, 'failed', {
        currentStep: `Export failed: ${err.message}`
      });
    });

    return (await jobRegistry.getJob(job.jobId)) ?? job;
  }

  /**
   * Executes the pipeline for a job and persists the resulting scene document.
   */
  async runPipeline(
    jobId: string,
    params: StartExportParams,
    signal: AbortSignal
  ): Promise<ExportPipelineResult> {
    const pipelineResult = await executeExportPipeline({
      jobId,
      mode: params.mode,
      targetElement: params.targetElement,
      options: params.options,
      signal,
      onStageChange: async (stage, message) => {
        let jobState: JobState = 'capturing';
        if (stage === 'analyzing_layout' || stage === 'building_scene') {
          jobState = 'processing';
        } else if (stage === 'ready_to_copy') {
          jobState = 'ready_to_copy';
        } else if (stage === 'failed') {
          jobState = 'failed';
        } else if (stage === 'cancelled') {
          jobState = 'cancelled';
        }

        await jobRegistry.updateJobState(jobId, jobState, {
          currentStep: message
        });
      }
    });

    if (pipelineResult.stage === 'ready_to_copy' && pipelineResult.scene) {
      // Build FigmaSceneDocument and persist under jobId
      const figmaDoc = buildFigmaSceneDocument([pipelineResult.scene], {
        exportTitle: pipelineResult.scene.metadata.title,
        sourceSite: params.origin
      });

      const storage = await this.storagePromise;
      await storage.saveSceneDocument({
        ...figmaDoc,
        jobId
      });

      await jobRegistry.updateJobState(jobId, 'ready_to_copy', {
        currentStep: 'Scene ready to copy to clipboard',
        nodeCount: pipelineResult.scene.nodes.length
      });
    }

    return pipelineResult;
  }

  /**
   * Cancels an active export job.
   */
  async cancelJob(jobId: string): Promise<void> {
    const controller = this.abortControllers.get(jobId);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(jobId);
    }

    await jobRegistry.updateJobState(jobId, 'cancelled', {
      currentStep: 'Export cancelled by user'
    });

    // Cleanup stored job data
    const storage = await this.storagePromise;
    await storage.deleteJobData(jobId);
  }

  /**
   * Retrieves the stored FigmaSceneDocument for a job.
   */
  async getStoredScene(jobId: string): Promise<FigmaSceneDocument | null> {
    const storage = await this.storagePromise;
    return storage.getSceneDocument(jobId);
  }

  /**
   * Marks a job as successfully copied and completed.
   */
  async markCompleted(jobId: string): Promise<JobRecord | null> {
    this.abortControllers.delete(jobId);
    return jobRegistry.updateJobState(jobId, 'completed', {
      currentStep: 'Copied to Figma'
    });
  }

  /**
   * Retries a failed or cancelled job without duplicating asset blobs.
   */
  async retryJob(jobId: string, params: StartExportParams): Promise<JobRecord> {
    await this.cancelJob(jobId);
    return this.startExport(params);
  }
}

export const exportJobController = new ExportJobController();
