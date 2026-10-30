/**
 * Drag Controller for In-Page Minibar.
 * Implements smooth, constraint-bounded dragging using standard Pointer Events and setPointerCapture.
 * Clamps position within the visible viewport bounds and persists coordinates across sessions.
 */

import { browser } from '../../shared/browser/browser-api';

export const STORAGE_KEY_MINIBAR_POS = 'web_to_figma_minibar_pos';

export interface MinibarPosition {
  x: number;
  y: number;
}

export interface DragControllerOptions {
  onPositionChange?: (pos: MinibarPosition) => void;
  defaultPosition?: MinibarPosition;
}

export class DragController {
  private readonly host: HTMLElement;
  private readonly handle: HTMLElement;
  private readonly options: DragControllerOptions;

  private isDragging = false;
  private activePointerId: number | null = null;
  private dragStartPointer: MinibarPosition = { x: 0, y: 0 };
  private dragStartPos: MinibarPosition = { x: 0, y: 0 };
  private currentPos: MinibarPosition = { x: 20, y: 20 };
  private originalUserSelect = '';

  private readonly boundPointerDown: (e: PointerEvent) => void;
  private readonly boundPointerMove: (e: PointerEvent) => void;
  private readonly boundPointerUp: (e: PointerEvent) => void;
  private readonly boundPointerCancel: (e: PointerEvent) => void;

  constructor(host: HTMLElement, handle: HTMLElement, options: DragControllerOptions = {}) {
    this.host = host;
    this.handle = handle;
    this.options = options;

    if (options.defaultPosition) {
      this.currentPos = { ...options.defaultPosition };
    }

    this.boundPointerDown = this.handlePointerDown.bind(this);
    this.boundPointerMove = this.handlePointerMove.bind(this);
    this.boundPointerUp = this.handlePointerUp.bind(this);
    this.boundPointerCancel = this.handlePointerCancel.bind(this);

    this.attach();
  }

  /**
   * Pure geometry helper to clamp coordinates strictly within screen bounds.
   */
  static clampPosition(
    pos: MinibarPosition,
    elementWidth: number,
    elementHeight: number,
    viewportWidth: number,
    viewportHeight: number
  ): MinibarPosition {
    const maxX = Math.max(0, viewportWidth - elementWidth);
    const maxY = Math.max(0, viewportHeight - elementHeight);

    return {
      x: Math.round(Math.min(maxX, Math.max(0, pos.x))),
      y: Math.round(Math.min(maxY, Math.max(0, pos.y)))
    };
  }

  /**
   * Initializes listeners and applies initial position.
   */
  private attach(): void {
    this.handle.addEventListener('pointerdown', this.boundPointerDown);
    this.handle.addEventListener('pointermove', this.boundPointerMove);
    this.handle.addEventListener('pointerup', this.boundPointerUp);
    this.handle.addEventListener('pointercancel', this.boundPointerCancel);

    // Initial positioning
    this.applyPosition(this.currentPos);
  }

  /**
   * Loads persisted position from storage and clamps to current screen dimensions.
   */
  async restorePosition(): Promise<MinibarPosition> {
    try {
      if (typeof browser !== 'undefined' && browser.storage?.local) {
        const data = await browser.storage.local.get(STORAGE_KEY_MINIBAR_POS);
        const stored = data[STORAGE_KEY_MINIBAR_POS] as MinibarPosition | undefined;
        if (stored && typeof stored.x === 'number' && typeof stored.y === 'number') {
          const rect = this.host.getBoundingClientRect();
          const clamped = DragController.clampPosition(
            stored,
            rect.width || 300,
            rect.height || 48,
            window.innerWidth,
            window.innerHeight
          );
          this.currentPos = clamped;
          this.applyPosition(clamped);
          return clamped;
        }
      }
    } catch (err) {
      console.warn('[WebToFigma] Failed to restore minibar position:', err);
    }

    // Default: Top-right corner with 24px margin
    const defaultX = Math.max(0, window.innerWidth - (this.host.offsetWidth || 300) - 24);
    const defaultY = 24;
    const initial = { x: defaultX, y: defaultY };
    this.currentPos = initial;
    this.applyPosition(initial);
    return initial;
  }

  /**
   * Persists position coordinates to storage.
   */
  async savePosition(pos: MinibarPosition): Promise<void> {
    try {
      if (typeof browser !== 'undefined' && browser.storage?.local) {
        await browser.storage.local.set({
          [STORAGE_KEY_MINIBAR_POS]: pos
        });
      }
    } catch (err) {
      console.warn('[WebToFigma] Failed to persist minibar position:', err);
    }
  }

  private handlePointerDown(e: PointerEvent): void {
    // Only drag with primary mouse button / touch
    if (e.button !== 0) return;

    // Do not initiate drag if user clicked an interactive control inside handle
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'BUTTON' || target.closest('button') || target.tagName === 'INPUT')) {
      return;
    }

    this.isDragging = true;
    this.activePointerId = e.pointerId;

    try {
      this.handle.setPointerCapture(e.pointerId);
    } catch {
      // Ignore if setPointerCapture fails in synthetic test environments
    }

    this.dragStartPointer = { x: e.clientX, y: e.clientY };
    this.dragStartPos = { ...this.currentPos };

    // Prevent text selection across host page while dragging
    if (typeof document !== 'undefined' && document.body) {
      this.originalUserSelect = document.body.style.userSelect;
      document.body.style.userSelect = 'none';
    }
  }

  private handlePointerMove(e: PointerEvent): void {
    if (!this.isDragging || e.pointerId !== this.activePointerId) return;

    const deltaX = e.clientX - this.dragStartPointer.x;
    const deltaY = e.clientY - this.dragStartPointer.y;

    const rawPos: MinibarPosition = {
      x: this.dragStartPos.x + deltaX,
      y: this.dragStartPos.y + deltaY
    };

    const hostRect = this.host.getBoundingClientRect();
    const clamped = DragController.clampPosition(
      rawPos,
      hostRect.width || 300,
      hostRect.height || 48,
      window.innerWidth,
      window.innerHeight
    );

    this.currentPos = clamped;
    this.applyPosition(clamped);

    if (this.options.onPositionChange) {
      this.options.onPositionChange(clamped);
    }
  }

  private handlePointerUp(e: PointerEvent): void {
    if (!this.isDragging || e.pointerId !== this.activePointerId) return;
    this.finishDrag(e.pointerId);
  }

  private handlePointerCancel(e: PointerEvent): void {
    if (!this.isDragging || e.pointerId !== this.activePointerId) return;
    this.finishDrag(e.pointerId);
  }

  private finishDrag(pointerId: number): void {
    this.isDragging = false;
    this.activePointerId = null;

    try {
      if (this.handle.hasPointerCapture(pointerId)) {
        this.handle.releasePointerCapture(pointerId);
      }
    } catch {
      // Ignore
    }

    if (typeof document !== 'undefined' && document.body) {
      document.body.style.userSelect = this.originalUserSelect;
    }

    void this.savePosition(this.currentPos);
  }

  /**
   * Applies CSS coordinates to the fixed-position host element.
   */
  private applyPosition(pos: MinibarPosition): void {
    this.host.style.position = 'fixed';
    this.host.style.left = `${pos.x}px`;
    this.host.style.top = `${pos.y}px`;
    this.host.style.right = 'auto';
    this.host.style.bottom = 'auto';
  }

  /**
   * Returns current active position.
   */
  getPosition(): MinibarPosition {
    return { ...this.currentPos };
  }

  /**
   * Manually sets position with boundary clamping.
   */
  setPosition(pos: MinibarPosition): void {
    const hostRect = this.host.getBoundingClientRect();
    const clamped = DragController.clampPosition(
      pos,
      hostRect.width || 300,
      hostRect.height || 48,
      window.innerWidth,
      window.innerHeight
    );
    this.currentPos = clamped;
    this.applyPosition(clamped);
    void this.savePosition(clamped);
  }

  /**
   * Cleans up event listeners and restores styles.
   */
  destroy(): void {
    this.handle.removeEventListener('pointerdown', this.boundPointerDown);
    this.handle.removeEventListener('pointermove', this.boundPointerMove);
    this.handle.removeEventListener('pointerup', this.boundPointerUp);
    this.handle.removeEventListener('pointercancel', this.boundPointerCancel);

    if (this.isDragging && typeof document !== 'undefined' && document.body) {
      document.body.style.userSelect = this.originalUserSelect;
    }
    this.isDragging = false;
    this.activePointerId = null;
  }
}
