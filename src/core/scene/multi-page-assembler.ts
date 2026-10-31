/**
 * Multi-Page Scene Assembler Engine.
 * 
 * Orchestrates multi-page export documents across:
 * - Deterministic route ordering based on user-reviewed order (not asynchronous completion order)
 * - Stable global indexing (failed pages never shift numbering of subsequent successful pages)
 * - Standardized frame naming: `[Index] - [Page Title] - [Path]`
 * - Duplicate title disambiguation using path and index
 * - Non-destructive external metadata header frames preserving exact visual content dimensions
 * - Failure resilience: retains all successful pages when individual pages fail or redirect
 * - Optional failed-page placeholders (default: omit)
 * - Pre-layout document validation enforcing uniqueness, tree acyclicity, and resource quotas
 */

import type { DiscoveredRoute } from '../crawler/crawl-scope';
import type { PageScene, SceneNode, FigmaSceneDocument } from '../../shared/contracts/scene';
import type { ExportDiagnostic } from '../../shared/contracts/diagnostics';
import {
  formatPageFrameName,
  disambiguatePageNames,
  sanitizeLayerName
} from './name-sanitizer';
import {
  createStructuredPageMetadata,
  buildMetadataHeaderFrame,
  StructuredPageMetadata,
  RouteExportStatus
} from './page-metadata';
import {
  validateSceneDocument,
  SceneDocumentValidationOptions
} from './scene-document-validator';

export interface RouteSceneInput {
  route: DiscoveredRoute;
  status: RouteExportStatus;
  pageScene?: PageScene | undefined;
  error?: string | undefined;
  failureReason?: string | undefined;
}

export interface MultiPageAssemblerOptions extends SceneDocumentValidationOptions {
  batchId?: string | undefined;
  exportTitle?: string | undefined;
  sourceSite?: string | undefined;
  includeMetadataHeaders?: boolean | undefined; // Default true
  includeFailedPlaceholders?: boolean | undefined; // Default false
}

export interface MultiPageAssemblyResult {
  document: FigmaSceneDocument & {
    allNodes: SceneNode[];
    pageMetadata: Record<string, StructuredPageMetadata>;
  };
  summary: {
    totalRoutes: number;
    successfulPages: number;
    failedPages: number;
    redirectedPages: number;
    orderedPageFrameIds: string[];
  };
  diagnostics: ExportDiagnostic[];
  isValid: boolean;
  validationErrors: string[];
}

export class MultiPageSceneAssembler {
  private readonly options: MultiPageAssemblerOptions;

  constructor(options: MultiPageAssemblerOptions = {}) {
    this.options = options;
  }

  /**
   * Assembles an ordered collection of route results into a unified FigmaSceneDocument.
   */
  public assemble(inputs: readonly RouteSceneInput[]): MultiPageAssemblyResult {
    const batchId = this.options.batchId ?? `batch_${Date.now()}`;
    const includeHeaders = this.options.includeMetadataHeaders ?? true;
    const includePlaceholders = this.options.includeFailedPlaceholders ?? false;

    const pageFrames: SceneNode[] = [];
    const allNodes: SceneNode[] = [];
    const pageMetadata: Record<string, StructuredPageMetadata> = {};
    const diagnostics: ExportDiagnostic[] = [];
    const orderedPageFrameIds: string[] = [];

    let successfulCount = 0;
    let failedCount = 0;
    let redirectedCount = 0;

    // 1. Pre-compute formatted, disambiguated frame names for all routes
    // Stable global index is 1-based index (i + 1) according to reviewed order
    const pagesForDisambiguation = inputs.map((input, idx) => ({
      index: idx + 1,
      title: input.route.title || input.route.navigationLabel || 'Untitled',
      url: input.route.pathname || input.route.originalUrl
    }));
    const disambiguatedNames = disambiguatePageNames(pagesForDisambiguation);

    // Determine exportTitle and sourceSite
    const firstRoute = inputs[0]?.route;
    const sourceSite =
      this.options.sourceSite ??
      (firstRoute ? extractOriginSafely(firstRoute.originalUrl) : 'Web Export');
    const exportTitle =
      this.options.exportTitle ??
      (firstRoute?.title || 'Web to Figma Multi-Page Export');

    // 2. Iterate strictly in reviewed route order
    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i]!;
      const route = input.route;
      const routeIndex = i + 1; // 1-based stable global sequence number
      const frameName = disambiguatedNames[i] ?? formatPageFrameName(routeIndex, route.title || 'Untitled', route.originalUrl);

      if (input.status === 'completed' && input.pageScene) {
        successfulCount++;
        const scene = input.pageScene;

        // Clone root frame and assign standardized name
        const pageFrame: SceneNode = {
          ...scene.pageFrame,
          name: frameName
        };

        // Sanitize internal child layer names to suppress class dumps and generic frames
        const sanitizedNodes: SceneNode[] = scene.nodes.map((node) => {
          if (node.id === pageFrame.id) {
            return pageFrame;
          }
          const cleanName = sanitizeLayerName(node.name, node.type === 'TEXT' ? 'Text' : 'Container');
          return {
            ...node,
            name: cleanName
          };
        });

        // Collect page diagnostics
        if (scene.diagnostics) {
          diagnostics.push(...scene.diagnostics);
        }

        // Create structured metadata
        const metadata = createStructuredPageMetadata({
          routeIndex,
          name: frameName,
          title: route.title || route.navigationLabel || 'Untitled',
          originalUrl: route.originalUrl,
          canonicalUrl: route.canonicalUrl,
          pathname: route.pathname,
          category: route.category, // Preserves undefined if unclassified
          batchId,
          width: pageFrame.width,
          height: pageFrame.height,
          status: 'completed',
          diagnostics: scene.diagnostics
        });
        pageMetadata[pageFrame.id] = metadata;

        // Generate external metadata header if enabled
        if (includeHeaders) {
          const { headerFrame, childNodes: headerChildNodes } = buildMetadataHeaderFrame({
            metadata,
            pageFrameX: pageFrame.x,
            pageFrameY: pageFrame.y,
            pageFrameWidth: pageFrame.width
          });

          allNodes.push(headerFrame, ...headerChildNodes);
        }

        pageFrames.push(pageFrame);
        allNodes.push(...sanitizedNodes);
        orderedPageFrameIds.push(pageFrame.id);
      } else {
        // Handle failed or redirected route
        if (input.status === 'redirected_to_auth') {
          redirectedCount++;
        } else {
          failedCount++;
        }

        const failureMsg = input.failureReason || input.error || 'Page capture failed';
        const failureDiagnostic: ExportDiagnostic = {
          severity: 'error',
          code: input.status === 'redirected_to_auth' ? 'AUTH_REDIRECT_SKIPPED' : 'PAGE_CAPTURE_FAILED',
          message: `Route '${route.originalUrl}' (${frameName}) failed: ${failureMsg}`,
          phase: 'scene-conversion',
          timestamp: Date.now()
        };
        diagnostics.push(failureDiagnostic);

        const metadata = createStructuredPageMetadata({
          routeIndex,
          name: frameName,
          title: route.title || route.navigationLabel || 'Untitled',
          originalUrl: route.originalUrl,
          canonicalUrl: route.canonicalUrl,
          pathname: route.pathname,
          category: route.category,
          batchId,
          width: 1440,
          height: 600,
          status: input.status,
          failureReason: failureMsg,
          diagnostics: [failureDiagnostic]
        });

        if (includePlaceholders) {
          // Generate placeholder frame only when explicitly requested
          const placeholder = createFailedPlaceholderFrame(routeIndex, frameName, failureMsg, input.status);
          pageMetadata[placeholder.pageFrame.id] = metadata;

          if (includeHeaders) {
            const { headerFrame, childNodes: headerChildNodes } = buildMetadataHeaderFrame({
              metadata,
              pageFrameX: placeholder.pageFrame.x,
              pageFrameY: placeholder.pageFrame.y,
              pageFrameWidth: placeholder.pageFrame.width
            });
            allNodes.push(headerFrame, ...headerChildNodes);
          }

          pageFrames.push(placeholder.pageFrame);
          allNodes.push(placeholder.pageFrame, ...placeholder.childNodes);
          orderedPageFrameIds.push(placeholder.pageFrame.id);
        } else {
          // Store metadata by routeId for tracking without creating an empty frame
          pageMetadata[`route_${routeIndex}`] = metadata;
        }
      }
    }

    // 3. Assemble full document structure
    let totalAssetsCount = 0;
    for (const node of allNodes) {
      for (const fill of node.fills) {
        if (fill.type === 'IMAGE' && fill.imageRef) {
          totalAssetsCount++;
        }
      }
    }

    const document: FigmaSceneDocument & {
      allNodes: SceneNode[];
      pageMetadata: Record<string, StructuredPageMetadata>;
    } = {
      schemaVersion: 1,
      exportTitle,
      sourceSite,
      exportedAt: Date.now(),
      pageFrames,
      sections: [],
      metadata: {
        totalNodes: allNodes.length,
        totalAssets: totalAssetsCount,
        totalPages: pageFrames.length,
        devicePixelRatio: 1
      },
      allNodes,
      pageMetadata
    };

    // 4. Validate complete scene document
    const validation = validateSceneDocument(document, {
      maxTotalNodes: this.options.maxTotalNodes,
      maxTotalAssets: this.options.maxTotalAssets,
      knownAssetRefs: this.options.knownAssetRefs
    });

    diagnostics.push(...validation.diagnostics);

    return {
      document,
      summary: {
        totalRoutes: inputs.length,
        successfulPages: successfulCount,
        failedPages: failedCount,
        redirectedPages: redirectedCount,
        orderedPageFrameIds
      },
      diagnostics,
      isValid: validation.isValid,
      validationErrors: validation.errors
    };
  }
}

function createFailedPlaceholderFrame(
  routeIndex: number,
  frameName: string,
  reason: string,
  status: RouteExportStatus
): { pageFrame: SceneNode; childNodes: SceneNode[] } {
  const frameId = `placeholder_frame_${routeIndex}`;
  const textId = `${frameId}_text`;

  const statusLabel = status === 'redirected_to_auth' ? 'Authentication Required (Skipped)' : 'Capture Failed';
  const displayText = `${statusLabel}\n${reason}`;

  const textNode: SceneNode = {
    id: textId,
    parentId: frameId,
    childIds: [],
    name: 'Error Message',
    type: 'TEXT',
    visible: true,
    x: 40,
    y: 260,
    width: 1360,
    height: 80,
    rotation: 0,
    fills: [{ type: 'SOLID', color: { r: 0.6, g: 0.2, b: 0.2, a: 1 }, opacity: 1, visible: true }],
    strokes: [],
    effects: [],
    clipsContent: false,
    textData: {
      text: displayText,
      fontSize: 16,
      fontWeight: 500,
      fontFamily: 'Inter',
      textAlign: 'CENTER',
      textAutoResize: 'NONE'
    }
  };

  const pageFrame: SceneNode = {
    id: frameId,
    parentId: null,
    childIds: [textId],
    name: frameName,
    type: 'FRAME',
    visible: true,
    x: 0,
    y: 0,
    width: 1440,
    height: 600,
    rotation: 0,
    cornerRadius: 8,
    fills: [{ type: 'SOLID', color: { r: 0.98, g: 0.98, b: 0.99, a: 1 }, opacity: 1, visible: true }],
    strokes: [
      {
        color: { r: 0.88, g: 0.9, b: 0.94, a: 1 },
        weight: 2,
        align: 'INSIDE',
        visible: true
      }
    ],
    effects: [],
    clipsContent: true
  };

  return {
    pageFrame,
    childNodes: [textNode]
  };
}

function extractOriginSafely(rawUrl: string): string {
  try {
    return new URL(rawUrl).origin;
  } catch {
    return rawUrl;
  }
}
