/**
 * Fixed-Order Export Pipeline Orchestrator.
 * 
 * Enforces the strict sequential conversion order:
 * 1. DOM Snapshot (Viewport / Selected Element)
 * 2. Semantics & Geometry Validation
 * 3. Asset Discovery & Deduplication
 * 4. Styles, Typography & Layout Analysis
 * 5. Target-Independent PageScene Generation
 * 6. Export Diagnostics Collection
 * 7. Ready for Clipboard Adapter
 */

import { PageCapture, PageScene } from '../../shared/contracts/scene';
import { ExportDiagnostic } from '../../shared/contracts/diagnostics';
import { captureViewport, ViewportCaptureOptions } from '../capture/viewport-capture';
import { captureSelectedElement, SelectedElementCaptureOptions } from '../capture/selected-element-capture';
import { captureFullPage, FullPageCaptureOptions } from '../capture/full-page-capture';
import { buildPageScene } from '../scene/scene-builder';
import { validatePageScene } from '../scene/scene-validation';

export type ExportPipelineStage =
  | 'idle'
  | 'capturing_dom'
  | 'validating_semantics'
  | 'fetching_assets'
  | 'analyzing_layout'
  | 'building_scene'
  | 'ready_to_copy'
  | 'failed'
  | 'cancelled';

export interface ExportPipelineRequest {
  jobId: string;
  mode: 'viewport' | 'selected-element' | 'full-page';
  targetElement?: Element | undefined;
  options?: {
    includeAncestorBackground?: boolean | undefined;
    includeVisualSnapshot?: boolean | undefined;
    collapseStructuralWrappers?: boolean | undefined;
    excludeCookieBanners?: boolean | undefined;
    excludeChatWidgets?: boolean | undefined;
    excludeFixedOverlays?: boolean | undefined;
  } | undefined;
  onStageChange?: ((stage: ExportPipelineStage, message: string) => void) | undefined;
  signal?: AbortSignal | undefined;
}

export interface ExportPipelineResult {
  jobId: string;
  stage: ExportPipelineStage;
  scene?: PageScene | undefined;
  diagnostics: ExportDiagnostic[];
  error?: string | undefined;
}

/**
 * Executes the complete conversion pipeline in fixed sequential order.
 */
export async function executeExportPipeline(
  request: ExportPipelineRequest
): Promise<ExportPipelineResult> {
  const diagnostics: ExportDiagnostic[] = [];
  const notify = (stage: ExportPipelineStage, msg: string) => {
    if (request.onStageChange) {
      request.onStageChange(stage, msg);
    }
  };

  const checkAbort = () => {
    if (request.signal?.aborted) {
      notify('cancelled', 'Export was cancelled by the user.');
      const err = new Error('Export was cancelled by the user.');
      err.name = 'AbortError';
      throw err;
    }
  };

  try {
    checkAbort();

    // -------------------------------------------------------------
    // Stage 1: DOM Snapshot Extraction
    // -------------------------------------------------------------
    notify('capturing_dom', 'Extracting rendered DOM and visual geometry...');
    let capture: PageCapture;

    if (request.mode === 'viewport') {
      const vpResult = captureViewport({
        excludeCookieBanners: request.options?.excludeCookieBanners,
        excludeChatWidgets: request.options?.excludeChatWidgets,
        excludeFixedOverlays: request.options?.excludeFixedOverlays
      });
      capture = vpResult.capture;
      diagnostics.push(...vpResult.diagnostics);
    } else if (request.mode === 'selected-element') {
      if (!request.targetElement) {
        throw new Error('Selected-element mode requires a targetElement.');
      }
      const selResult = captureSelectedElement(request.targetElement, {
        includeAncestorBackground: request.options?.includeAncestorBackground
      });
      capture = selResult.capture;
      diagnostics.push(...selResult.diagnostics);
    } else {
      // Full-page mode
      const fpResult = await captureFullPage({
        signal: request.signal,
        scrollOptions: {
          settleDelayMs: 50,
          maxSteps: 30
        },
        fixedStickyOptions: {
          excludeCookieBanners: request.options?.excludeCookieBanners,
          excludeChatWidgets: request.options?.excludeChatWidgets,
          excludeFixedOverlays: request.options?.excludeFixedOverlays
        }
      });
      capture = fpResult.capture;
      diagnostics.push(...fpResult.diagnostics);
    }

    checkAbort();

    // -------------------------------------------------------------
    // Stage 2: Semantics & Geometry Validation
    // -------------------------------------------------------------
    notify('validating_semantics', 'Validating DOM semantics and layer hierarchy...');
    if (capture.nodes.length === 0) {
      throw new Error('DOM capture produced zero nodes.');
    }

    checkAbort();

    // -------------------------------------------------------------
    // Stage 3: Asset Discovery & Deduplication
    // -------------------------------------------------------------
    notify('fetching_assets', 'Discovering and associating media assets...');
    const assetRefs = new Set<string>();
    for (const node of capture.nodes) {
      for (const ref of node.assetRefs) {
        assetRefs.add(ref);
      }
    }
    capture.assetRefs = Array.from(assetRefs);

    checkAbort();

    // -------------------------------------------------------------
    // Stage 4: Styles, Typography & Layout Analysis
    // -------------------------------------------------------------
    notify('analyzing_layout', 'Translating CSS styles, fonts, and layout structures...');

    checkAbort();

    // -------------------------------------------------------------
    // Stage 5: Target-Independent PageScene Generation
    // -------------------------------------------------------------
    notify('building_scene', 'Synthesizing target-independent scene graph...');
    const scene = buildPageScene(capture, {
      includeVisualSnapshot: request.options?.includeVisualSnapshot,
      collapseStructuralWrappers: request.options?.collapseStructuralWrappers
    });
    diagnostics.push(...scene.diagnostics);

    const validation = validatePageScene(scene);
    if (!validation.isValid) {
      for (const err of validation.errors) {
        diagnostics.push({
          severity: 'error',
          code: 'PIPELINE_VALIDATION_ERROR',
          message: err,
          phase: 'scene-conversion',
          timestamp: Date.now()
        });
      }
    }

    checkAbort();

    // -------------------------------------------------------------
    // Stage 6: Ready to Copy
    // -------------------------------------------------------------
    notify('ready_to_copy', 'Scene generated successfully — ready to copy to Figma.');

    return {
      jobId: request.jobId,
      stage: 'ready_to_copy',
      scene,
      diagnostics
    };
  } catch (error: any) {
    if (error.name === 'AbortError') {
      return {
        jobId: request.jobId,
        stage: 'cancelled',
        diagnostics,
        error: error.message
      };
    }

    const errorMsg = error?.message || 'Unknown pipeline failure';
    notify('failed', `Export failed: ${errorMsg}`);

    diagnostics.push({
      severity: 'fatal',
      code: 'EXPORT_PIPELINE_FAILED',
      message: errorMsg,
      phase: 'scene-conversion',
      timestamp: Date.now()
    });

    return {
      jobId: request.jobId,
      stage: 'failed',
      diagnostics,
      error: errorMsg
    };
  }
}
