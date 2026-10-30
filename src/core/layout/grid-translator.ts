/**
 * CSS Grid Recognition and Track Translator.
 * 
 * Analyzes CSS grid-template-columns, grid-template-rows, and child placement.
 * Translates 1D grids and regular uniform grids into Auto Layout structures,
 * and detects spanning/irregular tracks that require positioned-frame fallback.
 */

import { NormalizedLayoutProps } from './layout-analyzer';
import { AutoLayoutConfig } from './flexbox-translator';
import { ExportDiagnostic } from '../../shared/contracts/diagnostics';
import { createGridApproximationDiagnostic } from './layout-diagnostics';

export interface GridTranslationResult {
  isQualified: boolean;
  layoutConfig?: AutoLayoutConfig | undefined;
  gridDimensions?: { columns: number; rows: number } | undefined;
  diagnostics: ExportDiagnostic[];
  fallbackReason?: string | undefined;
}

/**
 * Normalizes CSS grid track definitions (e.g. "repeat(3, 1fr)" -> ["1fr", "1fr", "1fr"]).
 */
export function expandGridTracks(trackStr: string | undefined): string[] {
  if (!trackStr || trackStr === 'none') return [];
  const clean = trackStr.trim();

  // Handle repeat(N, track)
  const repeatRegex = /repeat\(\s*(\d+)\s*,\s*([^)]+)\s*\)/g;
  let expanded = clean;

  expanded = expanded.replace(repeatRegex, (_, countStr, pattern) => {
    const count = parseInt(countStr, 10);
    if (isNaN(count) || count <= 0) return '';
    return Array(count).fill(pattern.trim()).join(' ');
  });

  return expanded.split(/\s+/).filter(Boolean);
}

/**
 * Checks whether an element's style or attributes indicate spanning grid placement.
 */
export function hasGridSpanning(childStyle: any): boolean {
  if (!childStyle) return false;
  const col = (childStyle.gridColumn || '').toLowerCase();
  const row = (childStyle.gridRow || '').toLowerCase();
  const colSpan = (childStyle.gridColumnEnd || '').toLowerCase();
  const rowSpan = (childStyle.gridRowEnd || '').toLowerCase();

  return (
    col.includes('span') ||
    row.includes('span') ||
    colSpan.includes('span') ||
    rowSpan.includes('span')
  );
}

/**
 * Translates CSS Grid into an AutoLayoutConfig or flags for positioned-frame fallback.
 */
export function translateGridToLayout(
  props: NormalizedLayoutProps,
  childrenStyles: any[] = [],
  nodeId?: string
): GridTranslationResult {
  const diagnostics: ExportDiagnostic[] = [];
  const colTracks = expandGridTracks(props.gridTemplateColumns);
  const rowTracks = expandGridTracks(props.gridTemplateRows);

  const colCount = Math.max(1, colTracks.length);
  const rowCount = Math.max(1, rowTracks.length);

  // Check if any child spans multiple columns/rows
  for (const cs of childrenStyles) {
    if (hasGridSpanning(cs)) {
      return {
        isQualified: false,
        diagnostics,
        fallbackReason: 'Contains grid children with column or row span'
      };
    }
  }

  // 1. Single-column 1D grid -> VERTICAL Auto Layout
  if (colCount === 1) {
    const config: AutoLayoutConfig = {
      layoutMode: 'VERTICAL',
      primaryAxisAlign: 'MIN',
      counterAxisAlign: 'MIN',
      itemSpacing: props.gapRow,
      padding: {
        top: props.padding.top,
        right: props.padding.right,
        bottom: props.padding.bottom,
        left: props.padding.left
      }
    };

    return {
      isQualified: true,
      layoutConfig: config,
      gridDimensions: { columns: 1, rows: rowCount },
      diagnostics
    };
  }

  // 2. Single-row 1D grid -> HORIZONTAL Auto Layout
  if (rowCount === 1) {
    const config: AutoLayoutConfig = {
      layoutMode: 'HORIZONTAL',
      primaryAxisAlign: 'MIN',
      counterAxisAlign: 'MIN',
      itemSpacing: props.gapColumn,
      padding: {
        top: props.padding.top,
        right: props.padding.right,
        bottom: props.padding.bottom,
        left: props.padding.left
      }
    };

    return {
      isQualified: true,
      layoutConfig: config,
      gridDimensions: { columns: colCount, rows: 1 },
      diagnostics
    };
  }

  // 3. Multi-track regular uniform grid
  diagnostics.push(
    createGridApproximationDiagnostic({
      detail: `Regular multi-track grid (${colCount} columns x ${rowCount} rows)`,
      nodeId
    })
  );

  return {
    isQualified: true,
    gridDimensions: { columns: colCount, rows: rowCount },
    diagnostics
  };
}
