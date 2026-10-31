/**
 * Structured Page Metadata and Visual Header Frame Generator.
 * 
 * Enforces:
 * - Structured metadata model for all exported routes.
 * - Non-destructive visual metadata headers placed strictly outside the page content frame.
 * - Separation of diagnostics from design layers.
 * - Strict preservation of measured visual content height and width.
 */

import type { RouteCategory } from '../crawler/route-categorizer';
import type { ExportDiagnostic } from '../../shared/contracts/diagnostics';
import type { SceneNode, ScenePaint } from '../../shared/contracts/scene';

export type RouteExportStatus = 'completed' | 'partial' | 'failed' | 'redirected_to_auth';

export interface StructuredPageMetadata {
  routeIndex: number; // 1-based stable global sequence number
  name: string; // Sanitized frame name
  title: string; // Original title
  originalUrl: string;
  canonicalUrl: string;
  pathname: string;
  category?: RouteCategory | undefined; // Must not be guessed if unclassified
  batchId: string;
  captureDimensions: {
    width: number;
    height: number;
  };
  capturedAt: number;
  status: RouteExportStatus;
  warningCount: number;
  diagnostics?: ExportDiagnostic[] | undefined;
  failureReason?: string | undefined;
}

export interface BuildMetadataHeaderOptions {
  metadata: StructuredPageMetadata;
  pageFrameX?: number | undefined;
  pageFrameY?: number | undefined;
  pageFrameWidth?: number | undefined;
  headerHeight?: number | undefined; // Default 52px
  marginBelow?: number | undefined; // Default 16px gap above page frame
}

/**
 * Creates a structured page metadata record.
 */
export function createStructuredPageMetadata(
  input: {
    routeIndex: number;
    name: string;
    title: string;
    originalUrl: string;
    canonicalUrl: string;
    pathname: string;
    category?: RouteCategory | undefined;
    batchId: string;
    width: number;
    height: number;
    capturedAt?: number | undefined;
    status?: RouteExportStatus | undefined;
    diagnostics?: ExportDiagnostic[] | undefined;
    failureReason?: string | undefined;
  }
): StructuredPageMetadata {
  const diagnostics = input.diagnostics ?? [];
  const warningCount = diagnostics.filter((d) => d.severity === 'warning').length;

  return {
    routeIndex: Math.max(1, input.routeIndex),
    name: input.name,
    title: input.title,
    originalUrl: input.originalUrl,
    canonicalUrl: input.canonicalUrl,
    pathname: input.pathname,
    category: input.category,
    batchId: input.batchId,
    captureDimensions: {
      width: Math.max(0, input.width),
      height: Math.max(0, input.height)
    },
    capturedAt: input.capturedAt ?? Date.now(),
    status: input.status ?? 'completed',
    warningCount,
    diagnostics,
    failureReason: input.failureReason
  };
}

/**
 * Generates an external visual metadata header Frame placed strictly above the source page frame.
 * 
 * Crucially, because this frame is an external sibling, the source page frame's visual dimensions
 * (width and height) remain 100% faithful to the captured webpage.
 */
export function buildMetadataHeaderFrame(
  options: BuildMetadataHeaderOptions
): { headerFrame: SceneNode; childNodes: SceneNode[] } {
  const { metadata } = options;
  const headerHeight = options.headerHeight ?? 52;
  const marginBelow = options.marginBelow ?? 16;
  const x = options.pageFrameX ?? 0;
  const targetWidth = Math.max(400, options.pageFrameWidth ?? metadata.captureDimensions.width);
  const y = (options.pageFrameY ?? 0) - (headerHeight + marginBelow);

  const headerId = `meta_hdr_${metadata.routeIndex}_${Math.random().toString(36).slice(2, 7)}`;
  const titleNodeId = `${headerId}_title`;
  const urlNodeId = `${headerId}_url`;
  const badgeContainerId = `${headerId}_badges`;

  const childNodes: SceneNode[] = [];

  // 1. Title + Path text node
  const categoryLabel = metadata.category ? ` [${metadata.category}]` : '';
  const titleText = `${metadata.name}${categoryLabel}`;
  const titleNode: SceneNode = {
    id: titleNodeId,
    parentId: headerId,
    childIds: [],
    name: 'Page Title & Path',
    type: 'TEXT',
    visible: true,
    x: 16,
    y: 10,
    width: Math.max(200, targetWidth - 280),
    height: 16,
    rotation: 0,
    fills: [{ type: 'SOLID', color: { r: 0.08, g: 0.11, b: 0.16, a: 1 }, opacity: 1, visible: true }],
    strokes: [],
    effects: [],
    clipsContent: false,
    textData: {
      text: titleText,
      fontSize: 12,
      fontWeight: 600,
      fontFamily: 'Inter',
      textAlign: 'LEFT',
      textAutoResize: 'NONE'
    }
  };
  childNodes.push(titleNode);

  // 2. Full URL text node
  const urlNode: SceneNode = {
    id: urlNodeId,
    parentId: headerId,
    childIds: [],
    name: 'Full Source URL',
    type: 'TEXT',
    visible: true,
    x: 16,
    y: 28,
    width: Math.max(200, targetWidth - 280),
    height: 14,
    rotation: 0,
    fills: [{ type: 'SOLID', color: { r: 0.45, g: 0.52, b: 0.62, a: 1 }, opacity: 1, visible: true }],
    strokes: [],
    effects: [],
    clipsContent: false,
    textData: {
      text: metadata.originalUrl,
      fontSize: 10,
      fontWeight: 400,
      fontFamily: 'Inter',
      textAlign: 'LEFT',
      textAutoResize: 'NONE'
    }
  };
  childNodes.push(urlNode);

  // 3. Status Badge Frame
  const statusColors = getStatusBadgeColors(metadata.status);
  const statusBadgeId = `${headerId}_status_badge`;
  const statusBadgeTextId = `${statusBadgeId}_text`;

  const statusBadgeText: SceneNode = {
    id: statusBadgeTextId,
    parentId: statusBadgeId,
    childIds: [],
    name: 'Status Label',
    type: 'TEXT',
    visible: true,
    x: 8,
    y: 4,
    width: 70,
    height: 12,
    rotation: 0,
    fills: [{ type: 'SOLID', color: statusColors.text, opacity: 1, visible: true }],
    strokes: [],
    effects: [],
    clipsContent: false,
    textData: {
      text: formatStatusLabel(metadata.status),
      fontSize: 9,
      fontWeight: 600,
      fontFamily: 'Inter',
      textAlign: 'CENTER',
      textAutoResize: 'NONE'
    }
  };

  const statusBadge: SceneNode = {
    id: statusBadgeId,
    parentId: headerId,
    childIds: [statusBadgeTextId],
    name: 'Status Badge',
    type: 'FRAME',
    visible: true,
    x: targetWidth - 240,
    y: 15,
    width: 86,
    height: 20,
    rotation: 0,
    cornerRadius: 4,
    fills: [{ type: 'SOLID', color: statusColors.bg, opacity: 1, visible: true }],
    strokes: [],
    effects: [],
    clipsContent: true
  };

  childNodes.push(statusBadge, statusBadgeText);

  // 4. Dimensions & Diagnostic Badge
  const dimsBadgeId = `${headerId}_dims_badge`;
  const dimsBadgeTextId = `${dimsBadgeId}_text`;
  const dimsText = `${Math.round(metadata.captureDimensions.width)} × ${Math.round(metadata.captureDimensions.height)} px`;

  const dimsBadgeText: SceneNode = {
    id: dimsBadgeTextId,
    parentId: dimsBadgeId,
    childIds: [],
    name: 'Dimensions Label',
    type: 'TEXT',
    visible: true,
    x: 6,
    y: 4,
    width: 100,
    height: 12,
    rotation: 0,
    fills: [{ type: 'SOLID', color: { r: 0.3, g: 0.35, b: 0.42, a: 1 }, opacity: 1, visible: true }],
    strokes: [],
    effects: [],
    clipsContent: false,
    textData: {
      text: dimsText,
      fontSize: 9,
      fontWeight: 500,
      fontFamily: 'Inter',
      textAlign: 'CENTER',
      textAutoResize: 'NONE'
    }
  };

  const dimsBadge: SceneNode = {
    id: dimsBadgeId,
    parentId: headerId,
    childIds: [dimsBadgeTextId],
    name: 'Dimensions Badge',
    type: 'FRAME',
    visible: true,
    x: targetWidth - 140,
    y: 15,
    width: 116,
    height: 20,
    rotation: 0,
    cornerRadius: 4,
    fills: [{ type: 'SOLID', color: { r: 0.94, g: 0.96, b: 0.98, a: 1 }, opacity: 1, visible: true }],
    strokes: [
      {
        color: { r: 0.85, g: 0.88, b: 0.92, a: 1 },
        weight: 1,
        align: 'INSIDE',
        visible: true
      }
    ],
    effects: [],
    clipsContent: true
  };

  childNodes.push(dimsBadge, dimsBadgeText);

  // Root Header Frame
  const headerFrame: SceneNode = {
    id: headerId,
    parentId: null,
    childIds: [titleNodeId, urlNodeId, statusBadgeId, dimsBadgeId],
    name: `Header — ${metadata.name}`,
    type: 'FRAME',
    visible: true,
    x,
    y,
    width: targetWidth,
    height: headerHeight,
    rotation: 0,
    cornerRadius: 6,
    fills: [
      {
        type: 'SOLID',
        color: { r: 0.98, g: 0.99, b: 1, a: 1 },
        opacity: 1,
        visible: true
      }
    ],
    strokes: [
      {
        color: { r: 0.88, g: 0.91, b: 0.95, a: 1 },
        weight: 1,
        align: 'INSIDE',
        visible: true
      }
    ],
    effects: [],
    clipsContent: true
  };

  return {
    headerFrame,
    childNodes
  };
}

function formatStatusLabel(status: RouteExportStatus): string {
  switch (status) {
    case 'completed':
      return 'Completed';
    case 'partial':
      return 'Partial';
    case 'redirected_to_auth':
      return 'Auth Redirect';
    case 'failed':
      return 'Failed';
  }
}

function getStatusBadgeColors(status: RouteExportStatus): {
  bg: { r: number; g: number; b: number; a: number };
  text: { r: number; g: number; b: number; a: number };
} {
  switch (status) {
    case 'completed':
      // Green
      return {
        bg: { r: 0.86, g: 0.98, b: 0.89, a: 1 },
        text: { r: 0.09, g: 0.45, b: 0.22, a: 1 }
      };
    case 'partial':
    case 'redirected_to_auth':
      // Amber
      return {
        bg: { r: 1.0, g: 0.95, b: 0.78, a: 1 },
        text: { r: 0.58, g: 0.35, b: 0.04, a: 1 }
      };
    case 'failed':
      // Red
      return {
        bg: { r: 0.99, g: 0.88, b: 0.88, a: 1 },
        text: { r: 0.65, g: 0.12, b: 0.12, a: 1 }
      };
  }
}
