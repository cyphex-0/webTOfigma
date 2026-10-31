/**
 * Site Directory Board Builder.
 * 
 * Generates the "00 - Site Directory" overview board on the Figma canvas:
 * - High-level site summary: hostname, export timestamp, batch ID
 * - Key metrics counters: discovered, selected, successful, failed/redirected
 * - Complete index table of all routes with stable index, title, path, category,
 *   status indicator, dimensions, and warning counts
 * - Engineered for visual clarity and readability when zoomed out on the Figma canvas
 * - Emits honest text identifiers; never emits fake or broken canvas deep links
 */

import type { SceneNode } from '../../shared/contracts/scene';
import type { RouteExportStatus } from './page-metadata';

export interface SiteDirectoryPageItem {
  index: number;
  title: string;
  pathname: string;
  category?: string | undefined;
  status: RouteExportStatus;
  dimensions: {
    width: number;
    height: number;
  };
  warningCount: number;
}

export interface SiteDirectoryInput {
  siteHostname: string;
  exportTimestamp?: number | undefined;
  batchId?: string | undefined;
  totalDiscovered?: number | undefined;
  totalSelected?: number | undefined;
  pages: readonly SiteDirectoryPageItem[];
}

export interface BuildSiteDirectoryOptions {
  x?: number | undefined;
  y?: number | undefined;
  width?: number | undefined; // Default 1000px
}

export interface BuildSiteDirectoryResult {
  boardNode: SceneNode;
  childNodes: SceneNode[];
}

/**
 * Builds the visual Site Directory frame (00 - Site Directory) and all child layers.
 */
export function buildSiteDirectoryBoard(
  input: SiteDirectoryInput,
  options: BuildSiteDirectoryOptions = {}
): BuildSiteDirectoryResult {
  const width = options.width ?? 1080;
  const x = options.x ?? 0;
  const y = options.y ?? 0;
  const timestamp = input.exportTimestamp ?? Date.now();
  const batchId = input.batchId ?? `batch_${timestamp}`;

  const pages = input.pages;
  const totalDiscovered = input.totalDiscovered ?? pages.length;
  const totalSelected = input.totalSelected ?? pages.length;
  const successCount = pages.filter((p) => p.status === 'completed').length;
  const failedCount = pages.filter((p) => p.status === 'failed' || p.status === 'redirected_to_auth').length;

  const rowHeight = 44;
  const headerHeight = 110;
  const metricsRowHeight = 90;
  const tableHeaderHeight = 36;
  const bottomPadding = 32;

  const totalHeight = headerHeight + metricsRowHeight + tableHeaderHeight + Math.max(1, pages.length) * rowHeight + bottomPadding;

  const boardId = `site_directory_${Math.random().toString(36).slice(2, 7)}`;
  const childNodes: SceneNode[] = [];
  const rootChildIds: string[] = [];

  // 1. Header Title & Subtitle
  const titleId = `${boardId}_title`;
  const subtitleId = `${boardId}_subtitle`;
  rootChildIds.push(titleId, subtitleId);

  const titleNode: SceneNode = {
    id: titleId,
    parentId: boardId,
    childIds: [],
    name: 'Directory Title',
    type: 'TEXT',
    visible: true,
    x: 40,
    y: 36,
    width: width - 80,
    height: 32,
    rotation: 0,
    fills: [{ type: 'SOLID', color: { r: 0.06, g: 0.09, b: 0.16, a: 1 }, opacity: 1, visible: true }],
    strokes: [],
    effects: [],
    clipsContent: false,
    textData: {
      text: 'Site Directory & Route Catalog',
      fontSize: 24,
      fontWeight: 700,
      fontFamily: 'Inter',
      textAlign: 'LEFT',
      textAutoResize: 'NONE'
    }
  };

  const formattedDate = new Date(timestamp).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
  const subtitleText = `Source: ${input.siteHostname}  •  Exported: ${formattedDate}  •  Batch: ${batchId}`;

  const subtitleNode: SceneNode = {
    id: subtitleId,
    parentId: boardId,
    childIds: [],
    name: 'Directory Subtitle',
    type: 'TEXT',
    visible: true,
    x: 40,
    y: 74,
    width: width - 80,
    height: 18,
    rotation: 0,
    fills: [{ type: 'SOLID', color: { r: 0.45, g: 0.52, b: 0.62, a: 1 }, opacity: 1, visible: true }],
    strokes: [],
    effects: [],
    clipsContent: false,
    textData: {
      text: subtitleText,
      fontSize: 12,
      fontWeight: 400,
      fontFamily: 'Inter',
      textAlign: 'LEFT',
      textAutoResize: 'NONE'
    }
  };

  childNodes.push(titleNode, subtitleNode);

  // 2. Metrics Summary Cards Row (4 cards)
  const metricsY = 114;
  const metricCards = [
    { label: 'Discovered Routes', value: String(totalDiscovered), color: { r: 0.2, g: 0.4, b: 0.9, a: 1 } },
    { label: 'Selected for Export', value: String(totalSelected), color: { r: 0.1, g: 0.6, b: 0.8, a: 1 } },
    { label: 'Captured Successfully', value: String(successCount), color: { r: 0.1, g: 0.65, b: 0.3, a: 1 } },
    { label: 'Failed / Redirected', value: String(failedCount), color: failedCount > 0 ? { r: 0.85, g: 0.2, b: 0.2, a: 1 } : { r: 0.5, g: 0.55, b: 0.6, a: 1 } }
  ];

  const cardWidth = Math.floor((width - 80 - 48) / 4);
  for (let i = 0; i < metricCards.length; i++) {
    const card = metricCards[i]!;
    const cardX = 40 + i * (cardWidth + 16);
    const cardId = `${boardId}_metric_${i}`;
    const numId = `${cardId}_val`;
    const lblId = `${cardId}_lbl`;

    const valNode: SceneNode = {
      id: numId,
      parentId: cardId,
      childIds: [],
      name: 'Metric Value',
      type: 'TEXT',
      visible: true,
      x: 16,
      y: 12,
      width: cardWidth - 32,
      height: 24,
      rotation: 0,
      fills: [{ type: 'SOLID', color: card.color, opacity: 1, visible: true }],
      strokes: [],
      effects: [],
      clipsContent: false,
      textData: {
        text: card.value,
        fontSize: 20,
        fontWeight: 700,
        fontFamily: 'Inter',
        textAlign: 'LEFT',
        textAutoResize: 'NONE'
      }
    };

    const lblNode: SceneNode = {
      id: lblId,
      parentId: cardId,
      childIds: [],
      name: 'Metric Label',
      type: 'TEXT',
      visible: true,
      x: 16,
      y: 38,
      width: cardWidth - 32,
      height: 14,
      rotation: 0,
      fills: [{ type: 'SOLID', color: { r: 0.45, g: 0.5, b: 0.58, a: 1 }, opacity: 1, visible: true }],
      strokes: [],
      effects: [],
      clipsContent: false,
      textData: {
        text: card.label,
        fontSize: 10,
        fontWeight: 500,
        fontFamily: 'Inter',
        textAlign: 'LEFT',
        textAutoResize: 'NONE'
      }
    };

    const cardNode: SceneNode = {
      id: cardId,
      parentId: boardId,
      childIds: [numId, lblId],
      name: `Metric Card — ${card.label}`,
      type: 'FRAME',
      visible: true,
      x: cardX,
      y: metricsY,
      width: cardWidth,
      height: 62,
      rotation: 0,
      cornerRadius: 8,
      fills: [{ type: 'SOLID', color: { r: 0.97, g: 0.98, b: 0.99, a: 1 }, opacity: 1, visible: true }],
      strokes: [{ color: { r: 0.88, g: 0.9, b: 0.94, a: 1 }, weight: 1, align: 'INSIDE', visible: true }],
      effects: [],
      clipsContent: true
    };

    rootChildIds.push(cardId);
    childNodes.push(cardNode, valNode, lblNode);
  }

  // 3. Table Header Bar
  const tableHeaderY = 196;
  const thId = `${boardId}_th`;
  const thTextId = `${thId}_txt`;

  const thTextNode: SceneNode = {
    id: thTextId,
    parentId: thId,
    childIds: [],
    name: 'Column Headers',
    type: 'TEXT',
    visible: true,
    x: 20,
    y: 8,
    width: width - 120,
    height: 14,
    rotation: 0,
    fills: [{ type: 'SOLID', color: { r: 0.35, g: 0.4, b: 0.48, a: 1 }, opacity: 1, visible: true }],
    strokes: [],
    effects: [],
    clipsContent: false,
    textData: {
      text: 'INDEX      PAGE TITLE & PATH                                                                      CATEGORY                     STATUS                 DIMENSIONS',
      fontSize: 10,
      fontWeight: 600,
      fontFamily: 'Inter',
      textAlign: 'LEFT',
      textAutoResize: 'NONE'
    }
  };

  const thFrame: SceneNode = {
    id: thId,
    parentId: boardId,
    childIds: [thTextId],
    name: 'Table Header',
    type: 'FRAME',
    visible: true,
    x: 40,
    y: tableHeaderY,
    width: width - 80,
    height: tableHeaderHeight,
    rotation: 0,
    cornerRadius: 4,
    fills: [{ type: 'SOLID', color: { r: 0.94, g: 0.95, b: 0.97, a: 1 }, opacity: 1, visible: true }],
    strokes: [],
    effects: [],
    clipsContent: true
  };

  rootChildIds.push(thId);
  childNodes.push(thFrame, thTextNode);

  // 4. Table Page Rows
  let currentY = tableHeaderY + tableHeaderHeight + 6;
  for (let idx = 0; idx < pages.length; idx++) {
    const page = pages[idx]!;
    const rowId = `${boardId}_row_${idx}`;
    const rowTextId = `${rowId}_txt`;
    const indexStr = String(page.index).padStart(2, '0');
    const dimsStr = `${Math.round(page.dimensions.width)} × ${Math.round(page.dimensions.height)}`;
    const categoryStr = page.category || 'Other';
    const statusStr = page.status === 'completed' ? 'Completed' : page.status === 'redirected_to_auth' ? 'Auth Redirect' : 'Failed';

    const rowSummary = `[${indexStr}]  ${page.title}  (${page.pathname})  —  ${categoryStr}  •  ${statusStr}  •  ${dimsStr}`;

    const rowTextNode: SceneNode = {
      id: rowTextId,
      parentId: rowId,
      childIds: [],
      name: 'Row Summary',
      type: 'TEXT',
      visible: true,
      x: 16,
      y: 12,
      width: width - 112,
      height: 16,
      rotation: 0,
      fills: [{ type: 'SOLID', color: { r: 0.12, g: 0.16, b: 0.22, a: 1 }, opacity: 1, visible: true }],
      strokes: [],
      effects: [],
      clipsContent: false,
      textData: {
        text: rowSummary,
        fontSize: 11,
        fontWeight: 500,
        fontFamily: 'Inter',
        textAlign: 'LEFT',
        textAutoResize: 'NONE'
      }
    };

    const rowBgColor = idx % 2 === 0
      ? { r: 1, g: 1, b: 1, a: 1 }
      : { r: 0.98, g: 0.98, b: 0.99, a: 1 };

    const rowFrame: SceneNode = {
      id: rowId,
      parentId: boardId,
      childIds: [rowTextId],
      name: `Row ${indexStr} — ${page.title}`,
      type: 'FRAME',
      visible: true,
      x: 40,
      y: currentY,
      width: width - 80,
      height: rowHeight - 4,
      rotation: 0,
      cornerRadius: 4,
      fills: [{ type: 'SOLID', color: rowBgColor, opacity: 1, visible: true }],
      strokes: [{ color: { r: 0.9, g: 0.92, b: 0.95, a: 1 }, weight: 1, align: 'INSIDE', visible: true }],
      effects: [],
      clipsContent: true
    };

    rootChildIds.push(rowId);
    childNodes.push(rowFrame, rowTextNode);
    currentY += rowHeight;
  }

  // Root Directory Board Frame
  const boardNode: SceneNode = {
    id: boardId,
    parentId: null,
    childIds: rootChildIds,
    name: '00 - Site Directory',
    type: 'FRAME',
    visible: true,
    x,
    y,
    width,
    height: Math.max(300, totalHeight),
    rotation: 0,
    cornerRadius: 12,
    fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1, visible: true }],
    strokes: [{ color: { r: 0.82, g: 0.86, b: 0.92, a: 1 }, weight: 2, align: 'INSIDE', visible: true }],
    effects: [],
    clipsContent: true
  };

  return {
    boardNode,
    childNodes
  };
}
