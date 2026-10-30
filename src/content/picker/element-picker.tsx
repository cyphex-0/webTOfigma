/**
 * Element Picker Orchestrator.
 * Handles mouse pointer hover detection, element highlight overlays,
 * strict event and click suppression, keyboard navigation hierarchy,
 * and subtree export confirmation.
 */

import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { PickerStateMachine } from './picker-state';
import { HighlightOverlay, type HighlightRect } from './highlight-overlay';
import { PickerTooltip } from './picker-tooltip';

export interface ElementPickerResult {
  element: Element;
  rect: HighlightRect;
  includeAncestorBackground: boolean;
  ancestorBackgroundColor?: string | undefined;
}

export type OnPickCallback = (result: ElementPickerResult) => void;
export type OnCancelCallback = () => void;

/**
 * Searches upwards for the nearest ancestor with a non-transparent background color.
 */
export function findAncestorBackgroundColor(el: Element): string | null {
  let curr = el.parentElement;
  while (curr && curr !== document.documentElement) {
    if (curr.hasAttribute('data-w2f-exclude')) {
      curr = curr.parentElement;
      continue;
    }
    const style = window.getComputedStyle(curr);
    const bg = style.backgroundColor;
    if (bg && bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)') {
      return bg;
    }
    curr = curr.parentElement;
  }
  return null;
}

export class ElementPicker {
  private stateMachine: PickerStateMachine;
  private overlay: HighlightOverlay;
  private tooltipHost: HTMLDivElement | null = null;
  private reactRoot: Root | null = null;

  private active = false;
  private onPick: OnPickCallback | null = null;
  private onCancel: OnCancelCallback | null = null;

  // Bound event listeners
  private boundOnPointerMove: (e: PointerEvent) => void;
  private boundOnClick: (e: MouseEvent) => void;
  private boundOnKeyDown: (e: KeyboardEvent) => void;

  constructor() {
    this.stateMachine = new PickerStateMachine();
    this.overlay = new HighlightOverlay();

    this.boundOnPointerMove = this.handlePointerMove.bind(this);
    this.boundOnClick = this.handleClick.bind(this);
    this.boundOnKeyDown = this.handleKeyDown.bind(this);
  }

  isActive(): boolean {
    return this.active;
  }

  start(onPick?: OnPickCallback, onCancel?: OnCancelCallback): void {
    if (this.active) return;
    this.active = true;
    this.onPick = onPick ?? null;
    this.onCancel = onCancel ?? null;

    this.stateMachine.activate();
    this.ensureTooltipMount();

    // Register capture-phase listeners on window
    window.addEventListener('pointermove', this.boundOnPointerMove, { capture: true, passive: true });
    window.addEventListener('click', this.boundOnClick, { capture: true, passive: false });
    window.addEventListener('keydown', this.boundOnKeyDown, { capture: true, passive: false });
  }

  stop(): void {
    if (!this.active) return;
    this.active = false;

    // Remove event listeners
    window.removeEventListener('pointermove', this.boundOnPointerMove, { capture: true });
    window.removeEventListener('click', this.boundOnClick, { capture: true });
    window.removeEventListener('keydown', this.boundOnKeyDown, { capture: true });

    // Hide and teardown overlay
    this.overlay.hide();

    // Teardown tooltip
    if (this.reactRoot) {
      this.reactRoot.unmount();
      this.reactRoot = null;
    }
    if (this.tooltipHost && this.tooltipHost.parentElement) {
      this.tooltipHost.parentElement.removeChild(this.tooltipHost);
      this.tooltipHost = null;
    }

    this.stateMachine.reset();
  }

  private ensureTooltipMount(): void {
    if (!this.tooltipHost) {
      const host = this.overlay.getHost();
      const tooltipContainer = document.createElement('div');
      tooltipContainer.id = 'w2f-picker-tooltip-container';
      tooltipContainer.setAttribute('data-w2f-exclude', 'true');
      host.appendChild(tooltipContainer);
      this.tooltipHost = tooltipContainer;
      this.reactRoot = createRoot(tooltipContainer);
    }
  }

  private renderTooltip(): void {
    if (!this.reactRoot || !this.tooltipHost) return;

    const currentTarget = this.stateMachine.getCurrentTarget();
    if (!currentTarget) {
      this.overlay.hide();
      this.reactRoot.render(null);
      return;
    }

    const domRect = currentTarget.getBoundingClientRect();
    const targetRect: HighlightRect = {
      x: domRect.left,
      y: domRect.top,
      width: domRect.width,
      height: domRect.height
    };

    const isSelected = this.stateMachine.getState().phase === 'selected';
    this.overlay.show(targetRect, isSelected);

    const state = this.stateMachine.getState();

    this.reactRoot.render(
      <PickerTooltip
        targetElement={currentTarget}
        targetRect={targetRect}
        hierarchyIndex={state.hierarchyIndex}
        hierarchyTotal={state.hierarchyChain.length}
        includeAncestorBackground={state.includeAncestorBackground}
        onCycleParent={() => this.cycleParent()}
        onCycleChild={() => this.cycleChild()}
        onToggleBackground={(val) => this.toggleBackground(val)}
        onConfirm={() => this.confirmSelection()}
        onCancel={() => this.cancelSelection()}
      />
    );
  }

  private handlePointerMove(e: PointerEvent): void {
    if (!this.active) return;

    const x = e.clientX;
    const y = e.clientY;

    const element = document.elementFromPoint(x, y);
    if (!element) return;

    // Ignore extension UI elements
    if (typeof (element as any).closest === 'function' && element.closest('[data-w2f-exclude="true"]')) {
      return;
    }

    this.stateMachine.setHovered(element);
    this.renderTooltip();
  }

  private handleClick(e: MouseEvent): void {
    if (!this.active) return;

    const target = e.target as Element | null;
    if (target && typeof (target as any).closest === 'function') {
      if (target.closest('[data-w2f-exclude="true"]')) {
        // Allow user to click tooltip controls
        return;
      }
    }

    // Suppress all host website click events
    if (typeof e.preventDefault === 'function') e.preventDefault();
    if (typeof e.stopPropagation === 'function') e.stopPropagation();
    if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();

    this.confirmSelection();
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (!this.active) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      this.cancelSelection();
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      this.cycleParent();
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      e.stopPropagation();
      this.cycleChild();
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      this.confirmSelection();
      return;
    }
  }

  cycleParent(): void {
    this.stateMachine.cycleParent();
    this.renderTooltip();
  }

  cycleChild(): void {
    this.stateMachine.cycleChild();
    this.renderTooltip();
  }

  toggleBackground(val: boolean): void {
    this.stateMachine.toggleAncestorBackground(val);
    this.renderTooltip();
  }

  confirmSelection(): void {
    const confirmation = this.stateMachine.confirm();
    if (!confirmation) {
      this.cancelSelection();
      return;
    }

    const { element, includeAncestorBackground } = confirmation;
    const domRect = element.getBoundingClientRect();
    const rect: HighlightRect = {
      x: domRect.left,
      y: domRect.top,
      width: domRect.width,
      height: domRect.height
    };

    let ancestorBackgroundColor: string | undefined;
    if (includeAncestorBackground) {
      ancestorBackgroundColor = findAncestorBackgroundColor(element) || undefined;
    }

    const result: ElementPickerResult = {
      element,
      rect,
      includeAncestorBackground,
      ancestorBackgroundColor
    };

    const callback = this.onPick;
    this.stop();

    if (callback) {
      callback(result);
    }
  }

  cancelSelection(): void {
    const callback = this.onCancel;
    this.stop();

    if (callback) {
      callback();
    }
  }
}
