import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HighlightOverlay } from '../../content/picker/highlight-overlay';
import { PickerTooltip } from '../../content/picker/picker-tooltip';

describe('Highlight Overlay & Picker Tooltip', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('HighlightOverlay', () => {
    it('creates isolated host element with data-w2f-exclude attribute', () => {
      const overlay = new HighlightOverlay();
      const host = overlay.getHost();

      expect(host).not.toBeNull();
      expect(host.getAttribute('data-w2f-exclude')).toBe('true');
      expect(host.id).toBe('w2f-picker-host');
      overlay.destroy();
    });

    it('positions highlight box at specified rect and sets hovered / selected styles', () => {
      const overlay = new HighlightOverlay();
      overlay.show({ x: 50, y: 100, width: 200, height: 80 }, false);

      const box = document.getElementById('w2f-highlight-box');
      expect(box).not.toBeNull();
      expect(box?.style.display).toBe('block');
      expect(box?.style.left).toBe('50px');
      expect(box?.style.top).toBe('100px');
      expect(box?.style.width).toBe('200px');
      expect(box?.style.height).toBe('80px');
      expect(box?.className).toContain('hovered');

      // Update to selected
      overlay.show({ x: 50, y: 100, width: 200, height: 80 }, true);
      expect(box?.className).toContain('selected');

      // Hide
      overlay.hide();
      expect(box?.style.display).toBe('none');

      overlay.destroy();
      expect(document.getElementById('w2f-picker-host')).toBeNull();
    });
  });

  describe('PickerTooltip', () => {
    it('renders tag badge, dimensions, and semantic title', () => {
      const testElement = document.createElement('button');
      testElement.textContent = 'Save Project';

      render(
        <PickerTooltip
          targetElement={testElement}
          targetRect={{ x: 100, y: 200, width: 150, height: 40 }}
          hierarchyIndex={2}
          hierarchyTotal={3}
          includeAncestorBackground={false}
          onCycleParent={vi.fn()}
          onCycleChild={vi.fn()}
          onToggleBackground={vi.fn()}
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      expect(screen.getByText('<button>')).toBeDefined();
      expect(screen.getByText('150 × 40 px')).toBeDefined();
      expect(screen.getByText('Button — "Save Project"')).toBeDefined();
    });

    it('fires hierarchy cycling and confirmation events', () => {
      const onCycleParent = vi.fn();
      const onCycleChild = vi.fn();
      const onConfirm = vi.fn();
      const onCancel = vi.fn();
      const onToggleBackground = vi.fn();

      const testElement = document.createElement('div');
      testElement.className = 'card';

      render(
        <PickerTooltip
          targetElement={testElement}
          targetRect={{ x: 50, y: 80, width: 300, height: 200 }}
          hierarchyIndex={1}
          hierarchyTotal={3}
          includeAncestorBackground={false}
          onCycleParent={onCycleParent}
          onCycleChild={onCycleChild}
          onToggleBackground={onToggleBackground}
          onConfirm={onConfirm}
          onCancel={onCancel}
        />
      );

      fireEvent.click(screen.getByText('↑ Parent'));
      expect(onCycleParent).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByText('↓ Child'));
      expect(onCycleChild).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByText('Confirm'));
      expect(onConfirm).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByText('Cancel'));
      expect(onCancel).toHaveBeenCalledTimes(1);

      const checkbox = screen.getByRole('checkbox');
      fireEvent.click(checkbox);
      expect(onToggleBackground).toHaveBeenCalledWith(true);
    });

    it('clamps position within viewport boundaries when target is at top-left edge', () => {
      const testElement = document.createElement('div');

      const { container } = render(
        <PickerTooltip
          targetElement={testElement}
          targetRect={{ x: 0, y: 0, width: 50, height: 30 }}
          hierarchyIndex={0}
          hierarchyTotal={1}
          includeAncestorBackground={false}
          onCycleParent={vi.fn()}
          onCycleChild={vi.fn()}
          onToggleBackground={vi.fn()}
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      const tooltip = container.querySelector<HTMLDivElement>('.w2f-picker-tooltip');
      expect(tooltip).not.toBeNull();
      // Should flip to below since y=0 is near top edge
      const topPx = parseInt(tooltip!.style.top, 10);
      expect(topPx).toBeGreaterThanOrEqual(10);
    });
  });
});
