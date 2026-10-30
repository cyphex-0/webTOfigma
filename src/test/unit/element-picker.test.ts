import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ElementPicker, findAncestorBackgroundColor } from '../../content/picker/element-picker';
import { rebaseSubtreeCoordinates } from '../../core/dom/coordinate-normalizer';
import type { SourceNode } from '../../shared/contracts/source-node';

describe('ElementPicker Orchestrator & Coordinate Rebasing', () => {
  let picker: ElementPicker;
  let container: HTMLDivElement;
  let section: HTMLElement;
  let button: HTMLButtonElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    container = document.createElement('div');
    container.style.backgroundColor = '#1e293b';

    section = document.createElement('section');
    section.style.backgroundColor = 'transparent';

    button = document.createElement('button');
    button.textContent = 'Submit Form';

    section.appendChild(button);
    container.appendChild(section);
    document.body.appendChild(container);

    picker = new ElementPicker();
  });

  afterEach(() => {
    picker.stop();
    document.body.innerHTML = '';
  });

  describe('findAncestorBackgroundColor', () => {
    it('traverses upwards and retrieves nearest non-transparent background', () => {
      const bg = findAncestorBackgroundColor(button);
      expect(bg).toContain('30, 41, 59');
    });

    it('returns null if all ancestors are transparent', () => {
      container.style.backgroundColor = 'transparent';
      const bg = findAncestorBackgroundColor(button);
      expect(bg).toBeNull();
    });
  });

  describe('ElementPicker Lifecycle & Event Suppression', () => {
    it('activates and stops correctly', () => {
      expect(picker.isActive()).toBe(false);
      picker.start();
      expect(picker.isActive()).toBe(true);
      picker.stop();
      expect(picker.isActive()).toBe(false);
    });

    it('cancels on Escape keydown', () => {
      const onCancel = vi.fn();
      picker.start(vi.fn(), onCancel);

      const escEvent = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
      window.dispatchEvent(escEvent);

      expect(onCancel).toHaveBeenCalledTimes(1);
      expect(picker.isActive()).toBe(false);
    });

    it('suppresses click events on page elements and confirms selection', () => {
      const onPick = vi.fn();
      picker.start(onPick);

      // Simulate hover over button
      const moveEvent = new PointerEvent('pointermove', {
        clientX: 100,
        clientY: 100,
        bubbles: true
      });
      vi.spyOn(document, 'elementFromPoint').mockReturnValue(button);
      window.dispatchEvent(moveEvent);

      // Simulate click on button
      const clickEvent = new MouseEvent('click', {
        clientX: 100,
        clientY: 100,
        bubbles: true,
        cancelable: true
      });
      const preventDefaultSpy = vi.spyOn(clickEvent, 'preventDefault');
      const stopPropSpy = vi.spyOn(clickEvent, 'stopPropagation');

      button.dispatchEvent(clickEvent);

      expect(preventDefaultSpy).toHaveBeenCalled();
      expect(stopPropSpy).toHaveBeenCalled();
      expect(onPick).toHaveBeenCalledTimes(1);
      expect(onPick.mock.calls[0]?.[0]?.element).toBe(button);
      expect(picker.isActive()).toBe(false);
    });

    it('cycles hierarchy on ArrowUp and confirms via Enter key', () => {
      const onPick = vi.fn();
      picker.start(onPick);

      vi.spyOn(document, 'elementFromPoint').mockReturnValue(button);
      window.dispatchEvent(new PointerEvent('pointermove', { clientX: 10, clientY: 10 }));

      // Press ArrowUp to select parent (section)
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));

      // Press Enter to confirm
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

      expect(onPick).toHaveBeenCalledTimes(1);
      expect(onPick.mock.calls[0]?.[0]?.element).toBe(section);
    });
  });

  describe('rebaseSubtreeCoordinates', () => {
    it('shifts all nodes relative to root top-left origin', () => {
      const mockNodes: SourceNode[] = [
        {
          nodeId: 'root',
          parentId: null,
          childIds: ['child'],
          sourceTag: 'div',
          classHints: [],
          textRuns: [],
          sourceRect: { x: 100, y: 150, width: 400, height: 300 },
          documentRect: { x: 100, y: 550, width: 400, height: 300 },
          visibility: { isVisible: true, isClipped: false, isOffscreen: false, opacity: 1 },
          stacking: { createsStackingContext: false, zIndex: 'auto' },
          computedStyle: { display: 'block', position: 'static', overflow: 'visible', boxSizing: 'border-box', backgroundColor: 'transparent', color: '#000', fontSize: '16px', fontFamily: 'Inter', fontWeight: '400', lineHeight: 'normal', letterSpacing: 'normal', textAlign: 'left', borderRadius: '0', borderWidth: '0', borderColor: 'transparent', borderStyle: 'none', boxShadow: 'none', transform: 'none', padding: '0', margin: '0' },
          layoutHints: { isFlexContainer: false, isGridContainer: false, isInline: false, isBlock: true },
          assetRefs: []
        },
        {
          nodeId: 'child',
          parentId: 'root',
          childIds: [],
          sourceTag: 'span',
          classHints: [],
          textRuns: [],
          sourceRect: { x: 120, y: 180, width: 100, height: 40 },
          documentRect: { x: 120, y: 580, width: 100, height: 40 },
          visibility: { isVisible: true, isClipped: false, isOffscreen: false, opacity: 1 },
          stacking: { createsStackingContext: false, zIndex: 'auto' },
          computedStyle: { display: 'inline', position: 'static', overflow: 'visible', boxSizing: 'content-box', backgroundColor: 'transparent', color: '#000', fontSize: '14px', fontFamily: 'Inter', fontWeight: '400', lineHeight: 'normal', letterSpacing: 'normal', textAlign: 'left', borderRadius: '0', borderWidth: '0', borderColor: 'transparent', borderStyle: 'none', boxShadow: 'none', transform: 'none', padding: '0', margin: '0' },
          layoutHints: { isFlexContainer: false, isGridContainer: false, isInline: true, isBlock: false },
          assetRefs: []
        }
      ];

      const rebased = rebaseSubtreeCoordinates(mockNodes, { x: 100, y: 150, width: 400, height: 300 }, {
        includeAncestorBackground: true,
        ancestorBackgroundColor: '#ffffff'
      });

      // Root node should be at (0, 0)
      expect(rebased[0]?.sourceRect.x).toBe(0);
      expect(rebased[0]?.sourceRect.y).toBe(0);
      // Child node should be shifted by (100, 150) -> x: 20, y: 30
      expect(rebased[1]?.sourceRect.x).toBe(20);
      expect(rebased[1]?.sourceRect.y).toBe(30);

      // Root background should have been synthesized from ancestor
      expect(rebased[0]?.computedStyle.backgroundColor).toBe('#ffffff');
    });
  });
});
