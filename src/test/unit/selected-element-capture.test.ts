import { describe, it, expect, beforeEach } from 'vitest';
import {
  captureSelectedElement,
  findNearestOpaqueAncestorBackground
} from '../../core/capture/selected-element-capture';

describe('Selected Element Capture Engine', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="site_wrapper" style="background-color: rgb(15, 23, 42); padding: 50px;">
        <div id="middle_container" style="background-color: transparent;">
          <section id="target_card" style="margin: 20px; width: 400px; height: 300px; background-color: transparent;">
            <h2 style="width: 200px; height: 30px;">Card Title</h2>
            <p style="width: 350px; height: 60px;">Card Description</p>
          </section>
        </div>
      </div>
    `;
  });

  describe('findNearestOpaqueAncestorBackground', () => {
    it('discovers nearest ancestor with non-transparent background', () => {
      const target = document.getElementById('target_card')!;
      const ancestor = findNearestOpaqueAncestorBackground(target);

      expect(ancestor).toBeDefined();
      expect(ancestor?.backgroundColor).toBe('rgb(15, 23, 42)');
      expect(ancestor?.ancestorTag).toBe('div');
    });
  });

  describe('captureSelectedElement Execution', () => {
    it('captures only the subtree and rebases root coordinates to local (0, 0)', () => {
      const target = document.getElementById('target_card')!;
      const { capture, diagnostics } = captureSelectedElement(target, {
        includeAncestorBackground: false
      });

      expect(capture.metadata.captureMode).toBe('selected-element');
      expect(capture.metadata.title).toContain('[target_card]');

      const rootNode = capture.nodes[0]!;
      expect(rootNode.parentId).toBeNull();
      expect(rootNode.documentRect.x).toBe(0);
      expect(rootNode.documentRect.y).toBe(0);

      // Verify outer containers (site_wrapper, middle_container) are not included
      const nodeTags = capture.nodes.map((n) => n.sourceTag.toLowerCase());
      expect(nodeTags).not.toContain('site_wrapper');

      // Ancestor background was not inherited
      expect(diagnostics.some((d) => d.code === 'ANCESTOR_BACKGROUND_INHERITED')).toBe(false);
    });

    it('inherits ancestor background when enabled and target is transparent', () => {
      const target = document.getElementById('target_card')!;
      const { capture, diagnostics } = captureSelectedElement(target, {
        includeAncestorBackground: true
      });

      const rootNode = capture.nodes[0]!;
      expect(rootNode.computedStyle.backgroundColor).toBe('rgb(15, 23, 42)');

      expect(diagnostics.some((d) => d.code === 'ANCESTOR_BACKGROUND_INHERITED')).toBe(true);
    });
  });
});
