/**
 * Category Section Builder and Compatibility Fallback Engine.
 * 
 * Groups exported website pages into standardized, numbered categories:
 * - 00 - Site Directory
 * - 01 - Main / Marketing
 * - 02 - Products / Services
 * - 03 - Blog / Content
 * - 04 - Documentation / Help
 * - 05 - Application / Dashboard
 * - 06 - Authentication / Account
 * - 07 - Other Pages
 * - 08 - Design System
 * - 09 - Capture Diagnostics
 * 
 * Generates either:
 * 1. Native Figma Section nodes (type: 'SECTION') when native section support is enabled.
 * 2. Clearly named category-heading Frames (type: 'FRAME') with an explicit diagnostic
 *    when running in fallback compatibility mode. NEVER mislabels a normal Frame as a Section.
 */

import type { SceneNode } from '../../shared/contracts/scene';
import type { ExportDiagnostic } from '../../shared/contracts/diagnostics';
import type { StructuredPageMetadata } from './page-metadata';

export interface CategoryGroupDefinition {
  code: string;
  title: string;
  matchedCategories: readonly string[];
}

export const STANDARD_CATEGORY_DEFINITIONS: readonly CategoryGroupDefinition[] = [
  {
    code: '01',
    title: '01 - Main / Marketing',
    matchedCategories: ['Main/Marketing']
  },
  {
    code: '02',
    title: '02 - Products / Services',
    matchedCategories: ['Products/Services']
  },
  {
    code: '03',
    title: '03 - Blog / Content',
    matchedCategories: ['Blog/Articles']
  },
  {
    code: '04',
    title: '04 - Documentation / Help',
    matchedCategories: ['Documentation/Help']
  },
  {
    code: '05',
    title: '05 - Application / Dashboard',
    matchedCategories: ['Dashboard/Application']
  },
  {
    code: '06',
    title: '06 - Authentication / Account',
    matchedCategories: ['Authentication/Account']
  },
  {
    code: '07',
    title: '07 - Other Pages',
    matchedCategories: ['Store/Catalog', 'Other/Unclassified']
  },
  {
    code: '08',
    title: '08 - Design System',
    matchedCategories: ['Design System', 'Design-System']
  },
  {
    code: '09',
    title: '09 - Capture Diagnostics',
    matchedCategories: ['Capture Diagnostics', 'Diagnostics']
  }
];

export interface PageCategoryGroup {
  definition: CategoryGroupDefinition;
  frames: SceneNode[];
  metadata: StructuredPageMetadata[];
}

/**
 * Groups an array of page frames into ordered category buckets based on structured metadata.
 */
export function groupPagesByCategory(
  pageFrames: readonly SceneNode[],
  pageMetadata: Record<string, StructuredPageMetadata>
): PageCategoryGroup[] {
  const groupsMap = new Map<string, { definition: CategoryGroupDefinition; frames: SceneNode[]; metadata: StructuredPageMetadata[] }>();

  // Initialize ordered groups
  for (const def of STANDARD_CATEGORY_DEFINITIONS) {
    groupsMap.set(def.code, {
      definition: def,
      frames: [],
      metadata: []
    });
  }

  // Assign page frames into their respective category bucket
  for (const frame of pageFrames) {
    const meta = pageMetadata[frame.id];
    const categoryStr = meta?.category;

    let matchedCode = '07'; // Fallback to '07 - Other Pages'
    if (categoryStr) {
      for (const def of STANDARD_CATEGORY_DEFINITIONS) {
        if (def.matchedCategories.includes(categoryStr)) {
          matchedCode = def.code;
          break;
        }
      }
    }

    const group = groupsMap.get(matchedCode)!;
    group.frames.push(frame);
    if (meta) {
      group.metadata.push(meta);
    }
  }

  // Filter out empty groups to avoid cluttering canvas with empty sections
  const populatedGroups: PageCategoryGroup[] = [];
  for (const def of STANDARD_CATEGORY_DEFINITIONS) {
    const group = groupsMap.get(def.code);
    if (group && group.frames.length > 0) {
      populatedGroups.push(group);
    }
  }

  return populatedGroups;
}

export interface BuildSectionOptions {
  useNativeSections?: boolean | undefined;
  x?: number | undefined;
  y?: number | undefined;
  width?: number | undefined;
  height?: number | undefined;
  padding?: number | undefined; // Padding for native section enclosing frames
}

export interface BuildSectionResult {
  node: SceneNode;
  childNodes?: SceneNode[] | undefined;
  isNativeSection: boolean;
  diagnostics: ExportDiagnostic[];
}

/**
 * Builds either a native Figma Section (type: 'SECTION') or an honest category heading Frame (type: 'FRAME').
 */
export function buildCategorySection(
  group: PageCategoryGroup,
  options: BuildSectionOptions = {}
): BuildSectionResult {
  const useNativeSections = options.useNativeSections ?? false;
  const padding = options.padding ?? 80;
  const diagnostics: ExportDiagnostic[] = [];

  const sectionId = `cat_sec_${group.definition.code}_${Math.random().toString(36).slice(2, 7)}`;

  if (useNativeSections) {
    // -------------------------------------------------------------
    // Option 1: Native Figma Section Node (type: 'SECTION')
    // -------------------------------------------------------------
    const x = options.x ?? 0;
    const y = options.y ?? 0;
    const width = options.width ?? 1600;
    const height = options.height ?? 1000;

    const sectionNode: SceneNode = {
      id: sectionId,
      parentId: null,
      childIds: group.frames.map((f) => f.id),
      name: group.definition.title,
      type: 'SECTION',
      visible: true,
      x,
      y,
      width,
      height,
      rotation: 0,
      fills: [
        {
          type: 'SOLID',
          color: { r: 0.96, g: 0.97, b: 0.98, a: 1 },
          opacity: 1,
          visible: true
        }
      ],
      strokes: [
        {
          color: { r: 0.88, g: 0.9, b: 0.94, a: 1 },
          weight: 1,
          align: 'INSIDE',
          visible: true
        }
      ],
      effects: [],
      clipsContent: false
    };

    return {
      node: sectionNode,
      isNativeSection: true,
      diagnostics
    };
  }

  // -------------------------------------------------------------
  // Option 2: Fallback Category Heading Frame (type: 'FRAME')
  // -------------------------------------------------------------
  diagnostics.push({
    severity: 'info',
    code: 'SECTION_COMPATIBILITY_FALLBACK',
    message: `Using category-heading Frame fallback for '${group.definition.title}' instead of native Figma Section (clipboard compatibility mode).`,
    phase: 'scene-conversion',
    timestamp: Date.now()
  });

  const width = options.width ?? 1440;
  const height = 64;
  const x = options.x ?? 0;
  const y = options.y ?? 0;

  const titleNodeId = `${sectionId}_title`;
  const countBadgeId = `${sectionId}_badge`;
  const countTextId = `${countBadgeId}_text`;

  const titleTextNode: SceneNode = {
    id: titleNodeId,
    parentId: sectionId,
    childIds: [],
    name: 'Category Title',
    type: 'TEXT',
    visible: true,
    x: 24,
    y: 20,
    width: Math.max(300, width - 200),
    height: 24,
    rotation: 0,
    fills: [{ type: 'SOLID', color: { r: 0.08, g: 0.12, b: 0.2, a: 1 }, opacity: 1, visible: true }],
    strokes: [],
    effects: [],
    clipsContent: false,
    textData: {
      text: group.definition.title,
      fontSize: 18,
      fontWeight: 700,
      fontFamily: 'Inter',
      textAlign: 'LEFT',
      textAutoResize: 'NONE'
    }
  };

  const countBadgeText: SceneNode = {
    id: countTextId,
    parentId: countBadgeId,
    childIds: [],
    name: 'Count Label',
    type: 'TEXT',
    visible: true,
    x: 8,
    y: 4,
    width: 60,
    height: 14,
    rotation: 0,
    fills: [{ type: 'SOLID', color: { r: 0.35, g: 0.4, b: 0.48, a: 1 }, opacity: 1, visible: true }],
    strokes: [],
    effects: [],
    clipsContent: false,
    textData: {
      text: `${group.frames.length} ${group.frames.length === 1 ? 'page' : 'pages'}`,
      fontSize: 11,
      fontWeight: 600,
      fontFamily: 'Inter',
      textAlign: 'CENTER',
      textAutoResize: 'NONE'
    }
  };

  const countBadge: SceneNode = {
    id: countBadgeId,
    parentId: sectionId,
    childIds: [countTextId],
    name: 'Page Count Badge',
    type: 'FRAME',
    visible: true,
    x: width - 120,
    y: 18,
    width: 76,
    height: 26,
    rotation: 0,
    cornerRadius: 13,
    fills: [{ type: 'SOLID', color: { r: 0.92, g: 0.94, b: 0.97, a: 1 }, opacity: 1, visible: true }],
    strokes: [],
    effects: [],
    clipsContent: true
  };

  const headingFrame: SceneNode = {
    id: sectionId,
    parentId: null,
    childIds: [titleNodeId, countBadgeId],
    name: `Category Heading — ${group.definition.title}`,
    type: 'FRAME',
    visible: true,
    x,
    y,
    width,
    height,
    rotation: 0,
    cornerRadius: 8,
    fills: [
      {
        type: 'SOLID',
        color: { r: 0.97, g: 0.98, b: 1, a: 1 },
        opacity: 1,
        visible: true
      }
    ],
    strokes: [
      {
        color: { r: 0.85, g: 0.88, b: 0.93, a: 1 },
        weight: 1,
        align: 'INSIDE',
        visible: true
      }
    ],
    effects: [],
    clipsContent: true
  };

  return {
    node: headingFrame,
    childNodes: [titleTextNode, countBadge, countBadgeText],
    isNativeSection: false,
    diagnostics
  };
}
