/**
 * Deterministic 2D Canvas Arranger Engine.
 * 
 * Arranges multi-page exports onto one active Figma canvas:
 * - Dynamic 2D grid accommodating mixed page dimensions (short, tall, desktop, mobile)
 * - Computes next x-coordinate using previous frame's actual right edge + gap
 * - Computes next row y-coordinate using the actual maximum frame height in that row + gap
 * - Top-left Site Directory board (00 - Site Directory)
 * - Category boards in ordered vertical sections with pages in left-to-right rows
 * - Co-locates external metadata headers cleanly above their parent page frames
 * - Automated AABB collision verification ensuring zero bounding box overlap
 */

import type { SceneNode, FigmaSceneDocument } from '../../shared/contracts/scene';
import type { ExportDiagnostic } from '../../shared/contracts/diagnostics';
import type { StructuredPageMetadata } from './page-metadata';
import {
  groupPagesByCategory,
  buildCategorySection,
  PageCategoryGroup
} from './section-builder';
import {
  buildSiteDirectoryBoard,
  SiteDirectoryInput
} from './site-directory-builder';
import {
  checkCanvasCollisions,
  CanvasCollision
} from './canvas-collision-check';

export interface CanvasArrangerOptions {
  pageFrameGap?: number | undefined; // Default 180 (within 160-200)
  categoryGap?: number | undefined; // Default 280 (within 240-320)
  maxPagesPerRow?: number | undefined; // Default 4
  maxRowWidth?: number | undefined; // Max row width before wrapping, default 6500px
  includeSiteDirectory?: boolean | undefined; // Default true
  useNativeSections?: boolean | undefined; // Default false (clipboard compatibility)
}

export interface CanvasArrangementResult {
  document: FigmaSceneDocument & {
    allNodes: SceneNode[];
    pageMetadata: Record<string, StructuredPageMetadata>;
  };
  diagnostics: ExportDiagnostic[];
  totalCanvasWidth: number;
  totalCanvasHeight: number;
  hasCollisions: boolean;
  collisions: CanvasCollision[];
}

export class CanvasArranger {
  private readonly options: CanvasArrangerOptions;

  constructor(options: CanvasArrangerOptions = {}) {
    this.options = {
      pageFrameGap: options.pageFrameGap ?? 180,
      categoryGap: options.categoryGap ?? 280,
      maxPagesPerRow: options.maxPagesPerRow ?? 4,
      maxRowWidth: options.maxRowWidth ?? 6500,
      includeSiteDirectory: options.includeSiteDirectory ?? true,
      useNativeSections: options.useNativeSections ?? false
    };
  }

  /**
   * Arranges all page frames, sections, and directory boards onto a 2D canvas grid.
   */
  public arrange(
    document: FigmaSceneDocument & {
      allNodes: SceneNode[];
      pageMetadata: Record<string, StructuredPageMetadata>;
    },
    siteDirectoryInput?: SiteDirectoryInput | undefined
  ): CanvasArrangementResult {
    const pageFrameGap = this.options.pageFrameGap ?? 180;
    const categoryGap = this.options.categoryGap ?? 280;
    const maxPagesPerRow = this.options.maxPagesPerRow ?? 4;
    const maxRowWidth = this.options.maxRowWidth ?? 6500;
    const includeDirectory = this.options.includeSiteDirectory ?? true;
    const useNativeSections = this.options.useNativeSections ?? false;

    const diagnostics: ExportDiagnostic[] = [];
    const topLevelBoards: SceneNode[] = [];
    const nodesById = new Map<string, SceneNode>();

    for (const node of document.allNodes) {
      nodesById.set(node.id, node);
    }

    let currentY = 0;
    let maxCanvasWidth = 0;

    // -------------------------------------------------------------
    // Step 1: Site Directory Board (00 - Site Directory)
    // -------------------------------------------------------------
    if (includeDirectory && document.pageFrames.length > 0) {
      const dirInput: SiteDirectoryInput = siteDirectoryInput ?? {
        siteHostname: document.sourceSite,
        exportTimestamp: document.exportedAt,
        batchId: document.pageMetadata[document.pageFrames[0]!.id]?.batchId ?? `batch_${document.exportedAt}`,
        totalDiscovered: document.pageFrames.length,
        totalSelected: document.pageFrames.length,
        pages: document.pageFrames.map((frame) => {
          const meta = document.pageMetadata[frame.id];
          return {
            index: meta?.routeIndex ?? 1,
            title: meta?.title ?? frame.name,
            pathname: meta?.pathname ?? '/',
            category: meta?.category,
            status: meta?.status ?? 'completed',
            dimensions: { width: frame.width, height: frame.height },
            warningCount: meta?.warningCount ?? 0
          };
        })
      };

      const { boardNode, childNodes: dirChildNodes } = buildSiteDirectoryBoard(dirInput, {
        x: 0,
        y: 0,
        width: 1080
      });

      boardNode.x = 0;
      boardNode.y = currentY;

      // Update positions of child nodes relative to board
      topLevelBoards.push(boardNode);
      document.allNodes.push(boardNode, ...dirChildNodes);

      currentY += boardNode.height + categoryGap;
      maxCanvasWidth = Math.max(maxCanvasWidth, boardNode.width);
    }

    // -------------------------------------------------------------
    // Step 2: Group Pages by Category
    // -------------------------------------------------------------
    const categoryGroups = groupPagesByCategory(document.pageFrames, document.pageMetadata);

    // -------------------------------------------------------------
    // Step 3: Layout Each Category Group
    // -------------------------------------------------------------
    for (const group of categoryGroups) {
      if (group.frames.length === 0) continue;

      if (useNativeSections) {
        // Native Section mode: calculate grid of frames inside section
        const sectionPadding = 100;
        const sectionHeaderSpace = 80;

        let gridX = sectionPadding;
        let gridY = sectionHeaderSpace + sectionPadding;
        let rowMaxHeight = 0;
        let rowCount = 0;
        let sectionMaxRowWidth = 0;

        for (let i = 0; i < group.frames.length; i++) {
          const frame = group.frames[i]!;
          if (rowCount >= maxPagesPerRow || (gridX + frame.width > maxRowWidth && rowCount > 0)) {
            gridX = sectionPadding;
            gridY += rowMaxHeight + pageFrameGap;
            rowMaxHeight = 0;
            rowCount = 0;
          }

          frame.x = gridX;
          frame.y = gridY;

          this.repositionHeaderIfExists(frame, document.allNodes, nodesById);

          gridX += frame.width + pageFrameGap;
          rowMaxHeight = Math.max(rowMaxHeight, frame.height);
          rowCount++;
          sectionMaxRowWidth = Math.max(sectionMaxRowWidth, gridX);
        }

        const sectionWidth = sectionMaxRowWidth + sectionPadding - pageFrameGap;
        const sectionHeight = gridY + rowMaxHeight + sectionPadding;

        const { node: sectionNode, isNativeSection, diagnostics: secDiag } = buildCategorySection(group, {
          useNativeSections: true,
          x: 0,
          y: currentY,
          width: sectionWidth,
          height: sectionHeight
        });

        diagnostics.push(...secDiag);

        // Adjust frame coordinates to be canvas-absolute (or section-relative depending on target)
        for (const frame of group.frames) {
          frame.x += sectionNode.x;
          frame.y += sectionNode.y;
          this.repositionHeaderIfExists(frame, document.allNodes, nodesById);
        }

        topLevelBoards.push(sectionNode);
        document.sections.push(sectionNode);
        document.allNodes.push(sectionNode);

        currentY += sectionNode.height + categoryGap;
        maxCanvasWidth = Math.max(maxCanvasWidth, sectionWidth);
      } else {
        // Compatibility mode: Category Heading Frame followed by page frames grid
        // 1. First pre-calculate maximum row width for this category
        let tempX = 0;
        let tempCount = 0;
        let maxCategoryWidth = 1440;

        for (const frame of group.frames) {
          if (tempCount >= maxPagesPerRow || (tempX + frame.width > maxRowWidth && tempCount > 0)) {
            tempX = 0;
            tempCount = 0;
          }
          tempX += frame.width + pageFrameGap;
          tempCount++;
          maxCategoryWidth = Math.max(maxCategoryWidth, tempX);
        }
        maxCategoryWidth = Math.max(maxCategoryWidth - pageFrameGap, 1440);

        // 2. Build Category Header Frame
        const { node: headingFrame, childNodes: headingChildNodes, diagnostics: secDiag } = buildCategorySection(group, {
          useNativeSections: false,
          x: 0,
          y: currentY,
          width: maxCategoryWidth
        });

        diagnostics.push(...secDiag);
        topLevelBoards.push(headingFrame);
        document.allNodes.push(headingFrame, ...(headingChildNodes ?? []));

        // Advance below heading frame + space for per-page metadata headers
        const headerClearance = 80; // Clearance for metadata headers above first page row
        currentY += headingFrame.height + headerClearance;

        // 3. Grid placement for page frames
        let rowX = 0;
        let rowMaxHeight = 0;
        let rowCount = 0;

        for (let i = 0; i < group.frames.length; i++) {
          const frame = group.frames[i]!;

          if (rowCount >= maxPagesPerRow || (rowX + frame.width > maxRowWidth && rowCount > 0)) {
            // Wrap to next row
            rowX = 0;
            // Next row y must include previous row max height + vertical gap + header clearance
            currentY += rowMaxHeight + pageFrameGap + headerClearance;
            rowMaxHeight = 0;
            rowCount = 0;
          }

          frame.x = rowX;
          frame.y = currentY;

          this.repositionHeaderIfExists(frame, document.allNodes, nodesById);
          topLevelBoards.push(frame);

          rowX += frame.width + pageFrameGap;
          rowMaxHeight = Math.max(rowMaxHeight, frame.height);
          rowCount++;
          maxCanvasWidth = Math.max(maxCanvasWidth, rowX - pageFrameGap);
        }

        currentY += rowMaxHeight + categoryGap;
      }
    }

    // -------------------------------------------------------------
    // Step 4: Strict Collision Verification
    // -------------------------------------------------------------
    const collisionCheck = checkCanvasCollisions(topLevelBoards);
    if (collisionCheck.hasCollisions) {
      for (const col of collisionCheck.collisions) {
        diagnostics.push({
          severity: 'error',
          code: 'CANVAS_PLACEMENT_COLLISION',
          message: `Canvas placement collision between '${col.nodeA.name}' and '${col.nodeB.name}' (overlap area: ${Math.round(col.overlapArea)}px²).`,
          phase: 'scene-conversion',
          timestamp: Date.now()
        });
      }
    }

    return {
      document,
      diagnostics,
      totalCanvasWidth: maxCanvasWidth,
      totalCanvasHeight: currentY,
      hasCollisions: collisionCheck.hasCollisions,
      collisions: collisionCheck.collisions
    };
  }

  /**
   * Co-locates the external metadata header frame directly above its corresponding page frame.
   */
  private repositionHeaderIfExists(
    pageFrame: SceneNode,
    allNodes: SceneNode[],
    nodesById: Map<string, SceneNode>
  ): void {
    // Locate header frame by matching convention: 'Header — [pageFrame.name]'
    const header = allNodes.find(
      (n) => n.name === `Header — ${pageFrame.name}` && n.parentId === null
    );

    if (header) {
      header.x = pageFrame.x;
      header.y = pageFrame.y - (header.height + 16);
      header.width = pageFrame.width;
    }
  }
}
