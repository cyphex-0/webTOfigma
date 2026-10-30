/**
 * Flexbox to Figma Auto Layout Translator.
 * 
 * Maps normalized flexbox properties into Figma Auto Layout configurations:
 * layoutMode, primaryAxisAlign, counterAxisAlign, itemSpacing, and padding.
 */

import { NormalizedLayoutProps } from './layout-analyzer';
import { ExportDiagnostic } from '../../shared/contracts/diagnostics';
import { createSpaceEvenlyDiagnostic } from './layout-diagnostics';

export interface AutoLayoutConfig {
  layoutMode: 'HORIZONTAL' | 'VERTICAL';
  primaryAxisAlign: 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN';
  counterAxisAlign: 'MIN' | 'CENTER' | 'MAX';
  itemSpacing: number;
  padding: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
}

/**
 * Maps CSS justify-content to Figma primaryAxisAlign.
 */
export function mapPrimaryAxisAlign(
  justifyContent: string
): { align: 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN'; isApproximate: boolean } {
  const clean = justifyContent.trim().toLowerCase();

  switch (clean) {
    case 'center':
      return { align: 'CENTER', isApproximate: false };
    case 'flex-end':
    case 'end':
    case 'right':
      return { align: 'MAX', isApproximate: false };
    case 'space-between':
      return { align: 'SPACE_BETWEEN', isApproximate: false };
    case 'space-around':
    case 'space-evenly':
      return { align: 'SPACE_BETWEEN', isApproximate: true };
    case 'flex-start':
    case 'start':
    case 'left':
    default:
      return { align: 'MIN', isApproximate: false };
  }
}

/**
 * Maps CSS align-items to Figma counterAxisAlign.
 */
export function mapCounterAxisAlign(
  alignItems: string
): 'MIN' | 'CENTER' | 'MAX' {
  const clean = alignItems.trim().toLowerCase();

  switch (clean) {
    case 'center':
      return 'CENTER';
    case 'flex-end':
    case 'end':
      return 'MAX';
    case 'flex-start':
    case 'start':
    case 'stretch':
    case 'baseline':
    default:
      return 'MIN';
  }
}

/**
 * Translates NormalizedLayoutProps for a flex container into an AutoLayoutConfig.
 */
export function translateFlexboxToAutoLayout(
  props: NormalizedLayoutProps,
  nodeId?: string
): { config: AutoLayoutConfig; diagnostics: ExportDiagnostic[] } {
  const diagnostics: ExportDiagnostic[] = [];

  const isRow = props.flexDirection === 'row' || props.flexDirection === 'row-reverse';
  const layoutMode: 'HORIZONTAL' | 'VERTICAL' = isRow ? 'HORIZONTAL' : 'VERTICAL';

  const { align: primaryAxisAlign, isApproximate } = mapPrimaryAxisAlign(props.justifyContent);
  if (isApproximate) {
    diagnostics.push(createSpaceEvenlyDiagnostic({ nodeId }));
  }

  const counterAxisAlign = mapCounterAxisAlign(props.alignItems);
  const itemSpacing = isRow
    ? props.gapColumn > 0 ? props.gapColumn : props.gapRow
    : props.gapRow > 0 ? props.gapRow : props.gapColumn;

  const config: AutoLayoutConfig = {
    layoutMode,
    primaryAxisAlign,
    counterAxisAlign,
    itemSpacing,
    padding: {
      top: props.padding.top,
      right: props.padding.right,
      bottom: props.padding.bottom,
      left: props.padding.left
    }
  };

  return { config, diagnostics };
}
