import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  DragController,
  STORAGE_KEY_MINIBAR_POS,
  type MinibarPosition
} from '../../content/minibar/drag-controller';
import { browser } from '../../shared/browser/browser-api';

describe('DragController & Boundary Clamping', () => {
  beforeEach(async () => {
    await browser.storage.local.clear();
  });

  describe('clampPosition', () => {
    it('clamps negative coordinates to 0', () => {
      const clamped = DragController.clampPosition(
        { x: -50, y: -20 },
        300,
        50,
        1440,
        900
      );
      expect(clamped.x).toBe(0);
      expect(clamped.y).toBe(0);
    });

    it('clamps coordinates exceeding screen boundaries', () => {
      // Screen 1440x900, minibar 300x50 -> max X is 1140, max Y is 850
      const clamped = DragController.clampPosition(
        { x: 1300, y: 950 },
        300,
        50,
        1440,
        900
      );
      expect(clamped.x).toBe(1140);
      expect(clamped.y).toBe(850);
    });

    it('preserves valid coordinates within boundaries', () => {
      const valid = { x: 500, y: 300 };
      const clamped = DragController.clampPosition(valid, 300, 50, 1440, 900);
      expect(clamped).toEqual(valid);
    });
  });

  describe('Interactive pointer dragging', () => {
    let host: HTMLDivElement;
    let handle: HTMLDivElement;
    let childButton: HTMLButtonElement;

    beforeEach(() => {
      host = document.createElement('div');
      handle = document.createElement('div');
      childButton = document.createElement('button');
      handle.appendChild(childButton);
      host.appendChild(handle);
      document.body.appendChild(host);

      // Mock bounding rects for jsdom
      host.getBoundingClientRect = () => ({
        x: 100,
        y: 100,
        width: 300,
        height: 50,
        top: 100,
        left: 100,
        right: 400,
        bottom: 150,
        toJSON: () => {}
      });
      handle.setPointerCapture = vi.fn();
      handle.releasePointerCapture = vi.fn();
      handle.hasPointerCapture = vi.fn().mockReturnValue(true);
    });

    it('initializes and applies starting position', () => {
      const controller = new DragController(host, handle, {
        defaultPosition: { x: 100, y: 150 }
      });

      expect(host.style.position).toBe('fixed');
      expect(host.style.left).toBe('100px');
      expect(host.style.top).toBe('150px');
      controller.destroy();
    });

    it('moves host element during drag', () => {
      const onMove = vi.fn();
      const controller = new DragController(host, handle, {
        defaultPosition: { x: 50, y: 50 },
        onPositionChange: onMove
      });

      // Pointer down at (100, 100)
      handle.dispatchEvent(
        new PointerEvent('pointerdown', {
          clientX: 100,
          clientY: 100,
          button: 0,
          pointerId: 1
        })
      );

      // Pointer move to (150, 120) -> delta (+50, +20)
      handle.dispatchEvent(
        new PointerEvent('pointermove', {
          clientX: 150,
          clientY: 120,
          pointerId: 1
        })
      );

      const pos = controller.getPosition();
      expect(pos.x).toBe(100); // 50 + 50
      expect(pos.y).toBe(70); // 50 + 20
      expect(host.style.left).toBe('100px');
      expect(host.style.top).toBe('70px');
      expect(onMove).toHaveBeenCalledWith(pos);

      // Pointer up finishes drag
      handle.dispatchEvent(
        new PointerEvent('pointerup', {
          clientX: 150,
          clientY: 120,
          pointerId: 1
        })
      );

      controller.destroy();
    });

    it('ignores drag if clicked on a button inside handle', () => {
      const controller = new DragController(host, handle, {
        defaultPosition: { x: 50, y: 50 }
      });

      childButton.dispatchEvent(
        new PointerEvent('pointerdown', {
          clientX: 100,
          clientY: 100,
          button: 0,
          pointerId: 1,
          bubbles: true
        })
      );

      // Moving pointer should not move host
      handle.dispatchEvent(
        new PointerEvent('pointermove', {
          clientX: 200,
          clientY: 200,
          pointerId: 1
        })
      );

      expect(controller.getPosition()).toEqual({ x: 50, y: 50 });
      controller.destroy();
    });

    it('persists and restores position from storage', async () => {
      const savedPos: MinibarPosition = { x: 250, y: 180 };
      await browser.storage.local.set({
        [STORAGE_KEY_MINIBAR_POS]: savedPos
      });

      const controller = new DragController(host, handle);
      const restored = await controller.restorePosition();

      expect(restored.x).toBe(250);
      expect(restored.y).toBe(180);
      expect(host.style.left).toBe('250px');
      expect(host.style.top).toBe('180px');

      controller.destroy();
    });
  });
});
