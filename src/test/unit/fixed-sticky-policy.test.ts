import { describe, it, expect } from 'vitest';
import {
  evaluateFixedStickyNode,
  applyFixedStickyPolicy
} from '../../core/capture/fixed-sticky-policy';
import { SourceNode } from '../../shared/contracts/source-node';

function createMockSourceNode(overrides: Partial<SourceNode> = {}): SourceNode {
  return {
    nodeId: 'node_1',
    parentId: null,
    childIds: [],
    sourceTag: 'div',
    classHints: [],
    textRuns: [],
    sourceRect: { x: 0, y: 0, width: 200, height: 100 },
    documentRect: { x: 0, y: 0, width: 200, height: 100 },
    visibility: { isVisible: true, isClipped: false, isOffscreen: false, opacity: 1 },
    stacking: { createsStackingContext: false, zIndex: 'auto' },
    computedStyle: {
      display: 'block',
      position: 'static',
      overflow: 'visible',
      boxSizing: 'border-box',
      backgroundColor: 'transparent',
      color: 'rgb(0, 0, 0)',
      fontSize: '16px',
      fontFamily: 'Inter',
      fontWeight: '400',
      lineHeight: '24px',
      letterSpacing: '0px',
      textAlign: 'left',
      borderRadius: '0px',
      borderWidth: '0px',
      borderColor: 'transparent',
      borderStyle: 'none',
      boxShadow: 'none',
      transform: 'none',
      padding: '0px',
      margin: '0px'
    },
    layoutHints: {
      isFlexContainer: false,
      isGridContainer: false,
      isInline: false,
      isBlock: true
    },
    assetRefs: [],
    ...overrides
  };
}

describe('Fixed and Sticky Element Policy', () => {
  describe('evaluateFixedStickyNode', () => {
    it('classifies top sticky navigation header as top-nav', () => {
      const header = createMockSourceNode({
        sourceTag: 'header',
        sourceRect: { x: 0, y: 0, width: 1440, height: 60 },
        computedStyle: {
          ...createMockSourceNode().computedStyle,
          position: 'sticky'
        }
      });

      const res = evaluateFixedStickyNode(header);
      expect(res.isFixedOrSticky).toBe(true);
      expect(res.isTopNavigation).toBe(true);
      expect(res.category).toBe('top-nav');
      expect(res.shouldExclude).toBe(false);
    });

    it('classifies persistent floating chat bubble as overlay-widget', () => {
      const chat = createMockSourceNode({
        sourceTag: 'div',
        classHints: ['intercom-chat-widget'],
        sourceRect: { x: 1380, y: 840, width: 60, height: 60 },
        computedStyle: {
          ...createMockSourceNode().computedStyle,
          position: 'fixed'
        }
      });

      const res = evaluateFixedStickyNode(chat, { excludeChatWidgets: true });
      expect(res.isFixedOrSticky).toBe(true);
      expect(res.category).toBe('overlay-widget');
      expect(res.shouldExclude).toBe(true);
    });

    it('classifies cookie banner and marks for exclusion when configured', () => {
      const banner = createMockSourceNode({
        sourceTag: 'div',
        classHints: ['cookie-consent-notice'],
        sourceRect: { x: 0, y: 800, width: 1440, height: 100 },
        computedStyle: {
          ...createMockSourceNode().computedStyle,
          position: 'fixed'
        }
      });

      const res = evaluateFixedStickyNode(banner, { excludeCookieBanners: true });
      expect(res.shouldExclude).toBe(true);
    });
  });

  describe('applyFixedStickyPolicy', () => {
    it('deduplicates repeated sticky navigation bars and filters excluded overlays', () => {
      const root = createMockSourceNode({
        nodeId: 'root',
        childIds: ['nav_1', 'nav_2', 'chat']
      });

      const nav1 = createMockSourceNode({
        nodeId: 'nav_1',
        parentId: 'root',
        sourceTag: 'header',
        sourceRect: { x: 0, y: 0, width: 1440, height: 64 },
        computedStyle: { ...createMockSourceNode().computedStyle, position: 'sticky' }
      });

      // Simulated repeated nav bar from scroll checkpoint
      const nav2 = createMockSourceNode({
        nodeId: 'nav_2',
        parentId: 'root',
        sourceTag: 'header',
        sourceRect: { x: 0, y: 0, width: 1440, height: 64 },
        computedStyle: { ...createMockSourceNode().computedStyle, position: 'sticky' }
      });

      const chat = createMockSourceNode({
        nodeId: 'chat',
        parentId: 'root',
        classHints: ['drift-chat-widget'],
        computedStyle: { ...createMockSourceNode().computedStyle, position: 'fixed' }
      });

      const { nodes, diagnostics } = applyFixedStickyPolicy(
        [root, nav1, nav2, chat],
        { excludeChatWidgets: true }
      );

      const nodeIds = nodes.map((n) => n.nodeId);
      expect(nodeIds).toContain('nav_1');
      expect(nodeIds).not.toContain('nav_2'); // deduplicated
      expect(nodeIds).not.toContain('chat'); // excluded

      expect(diagnostics.some((d) => d.code === 'STICKY_NAV_DEDUPLICATED')).toBe(true);

      const rootNode = nodes.find((n) => n.nodeId === 'root');
      expect(rootNode?.childIds).toEqual(['nav_1']);
    });
  });
});
