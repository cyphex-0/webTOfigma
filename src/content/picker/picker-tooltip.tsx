import React, { useMemo } from 'react';
import type { HighlightRect } from './highlight-overlay';
import { classifyElement } from '../../core/dom/semantic-classifier';

export interface PickerTooltipProps {
  targetElement: Element | null;
  targetRect: HighlightRect | null;
  hierarchyIndex: number;
  hierarchyTotal: number;
  includeAncestorBackground: boolean;
  onCycleParent: () => void;
  onCycleChild: () => void;
  onToggleBackground: (enabled: boolean) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export const PickerTooltip: React.FC<PickerTooltipProps> = ({
  targetElement,
  targetRect,
  hierarchyIndex,
  hierarchyTotal,
  includeAncestorBackground,
  onCycleParent,
  onCycleChild,
  onToggleBackground,
  onConfirm,
  onCancel
}) => {
  if (!targetElement || !targetRect) return null;

  const classification = useMemo(() => {
    return classifyElement(targetElement);
  }, [targetElement]);

  // Compute clamped position
  const tooltipWidth = 280;
  const tooltipHeight = 120;
  const margin = 10;

  const innerWidth = typeof window !== 'undefined' ? window.innerWidth : 1440;
  const innerHeight = typeof window !== 'undefined' ? window.innerHeight : 900;

  let top = targetRect.y - tooltipHeight - margin;
  if (top < margin) {
    top = targetRect.y + targetRect.height + margin;
  }
  if (top + tooltipHeight > innerHeight - margin) {
    top = Math.max(margin, innerHeight - tooltipHeight - margin);
  }

  let left = targetRect.x;
  if (left + tooltipWidth > innerWidth - margin) {
    left = Math.max(margin, innerWidth - tooltipWidth - margin);
  }
  if (left < margin) {
    left = margin;
  }

  const tagName = `<${targetElement.tagName.toLowerCase()}>`;
  const dimensions = `${Math.round(targetRect.width)} × ${Math.round(targetRect.height)} px`;
  const canGoParent = hierarchyIndex > 0;
  const canGoChild = hierarchyIndex < hierarchyTotal - 1;

  return (
    <div
      className="w2f-picker-tooltip"
      data-w2f-exclude="true"
      style={{
        top: `${Math.round(top)}px`,
        left: `${Math.round(left)}px`
      }}
    >
      <div className="w2f-tooltip-header">
        <span className="w2f-tag-badge">{tagName}</span>
        <span className="w2f-dimensions-badge">{dimensions}</span>
      </div>

      <div className="w2f-tooltip-name" title={classification.displayName}>
        {classification.displayName}
      </div>

      <div className="w2f-bg-toggle-row">
        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={includeAncestorBackground}
            onChange={(e) => onToggleBackground(e.target.checked)}
          />
          <span>Include ancestor background</span>
        </label>
      </div>

      <div className="w2f-tooltip-controls">
        <div className="w2f-btn-group">
          <button
            type="button"
            className="w2f-btn-picker"
            disabled={!canGoParent}
            onClick={onCycleParent}
            title="Select parent container (ArrowUp)"
          >
            ↑ Parent
          </button>
          <button
            type="button"
            className="w2f-btn-picker"
            disabled={!canGoChild}
            onClick={onCycleChild}
            title="Select child element (ArrowDown)"
          >
            ↓ Child
          </button>
        </div>

        <div className="w2f-btn-group">
          <button
            type="button"
            className="w2f-btn-picker cancel"
            onClick={onCancel}
            title="Cancel selection (Esc)"
          >
            Cancel
          </button>
          <button
            type="button"
            className="w2f-btn-picker primary"
            onClick={onConfirm}
            title="Confirm export to Figma (Enter)"
          >
            Confirm
          </button>
        </div>
      </div>

      <div className="w2f-shortcuts-hint">
        <span>↑/↓ Hierarchy</span>
        <span>Enter: Confirm</span>
        <span>Esc: Cancel</span>
      </div>
    </div>
  );
};
