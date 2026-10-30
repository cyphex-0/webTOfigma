import { describe, it, expect, beforeEach } from 'vitest';
import {
  classifyElement,
  assignSiblingSequenceNames,
  enrichNodesWithSemantics
} from '../../core/dom/semantic-classifier';
import type { SourceNode } from '../../shared/contracts/source-node';

describe('Semantic Classifier', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  describe('Explicit Semantic HTML Tags', () => {
    it('classifies header, nav, main, section, article, aside, and footer', () => {
      const header = document.createElement('header');
      const nav = document.createElement('nav');
      const main = document.createElement('main');
      const section = document.createElement('section');
      const article = document.createElement('article');
      const aside = document.createElement('aside');
      const footer = document.createElement('footer');

      expect(classifyElement(header).kind).toBe('Header');
      expect(classifyElement(header).confidence).toBe('explicit_html');

      expect(classifyElement(nav).kind).toBe('Navigation');
      expect(classifyElement(main).kind).toBe('Main');
      expect(classifyElement(section).kind).toBe('Section');
      expect(classifyElement(article).kind).toBe('Article');
      expect(classifyElement(aside).kind).toBe('Aside');
      expect(classifyElement(footer).kind).toBe('Footer');
    });

    it('classifies headings H1 through H6 with text content', () => {
      const h1 = document.createElement('h1');
      h1.textContent = 'Welcome to Web to Figma';
      const c1 = classifyElement(h1);
      expect(c1.kind).toBe('Heading — H1');
      expect(c1.displayName).toBe('Heading — H1 ("Welcome to Web to Figma")');

      const h3 = document.createElement('h3');
      h3.textContent = 'Subheading Item';
      const c3 = classifyElement(h3);
      expect(c3.kind).toBe('Heading — H3');
      expect(c3.displayName).toBe('Heading — H3 ("Subheading Item")');
    });

    it('classifies interactive tags: button, link, and input', () => {
      const btn = document.createElement('button');
      btn.textContent = 'Confirm Order';
      const cBtn = classifyElement(btn);
      expect(cBtn.kind).toBe('Button');
      expect(cBtn.displayName).toBe('Button — "Confirm Order"');

      const link = document.createElement('a');
      link.textContent = 'Read Documentation';
      const cLink = classifyElement(link);
      expect(cLink.kind).toBe('Link');
      expect(cLink.displayName).toBe('Link — "Read Documentation"');

      const input = document.createElement('input');
      input.setAttribute('type', 'email');
      input.setAttribute('placeholder', 'Enter your work email');
      const cInput = classifyElement(input);
      expect(cInput.kind).toBe('Input');
      expect(cInput.displayName).toBe('Input — Enter your work email');
    });

    it('classifies images with alt text, figures, tables, and dialogs', () => {
      const img = document.createElement('img');
      img.setAttribute('alt', 'Company Hero Banner');
      const cImg = classifyElement(img);
      expect(cImg.kind).toBe('Image');
      expect(cImg.displayName).toBe('Image — "Company Hero Banner"');

      const figure = document.createElement('figure');
      expect(classifyElement(figure).kind).toBe('Figure');

      const table = document.createElement('table');
      expect(classifyElement(table).kind).toBe('Table');

      const dialog = document.createElement('dialog');
      expect(classifyElement(dialog).kind).toBe('Dialog');
    });
  });

  describe('ARIA Role Precedence', () => {
    it('overrides generic tag when ARIA role is present', () => {
      const divBtn = document.createElement('div');
      divBtn.setAttribute('role', 'button');
      divBtn.textContent = 'Custom Div Button';

      const c = classifyElement(divBtn);
      expect(c.kind).toBe('Button');
      expect(c.confidence).toBe('aria_role');
      expect(c.displayName).toBe('Button — "Custom Div Button"');
    });

    it('respects ARIA navigation and banner roles', () => {
      const divNav = document.createElement('div');
      divNav.setAttribute('role', 'navigation');
      divNav.setAttribute('aria-label', 'Primary Top Nav');

      const c = classifyElement(divNav);
      expect(c.kind).toBe('Navigation');
      expect(c.confidence).toBe('aria_role');
      expect(c.displayName).toBe('Navigation — "Primary Top Nav"');
    });

    it('supports tab, tabpanel, and heading aria roles with aria-level', () => {
      const tab = document.createElement('div');
      tab.setAttribute('role', 'tab');
      tab.textContent = 'General Settings';
      expect(classifyElement(tab).kind).toBe('Tab');

      const tabpanel = document.createElement('div');
      tabpanel.setAttribute('role', 'tabpanel');
      expect(classifyElement(tabpanel).kind).toBe('Tab Panel');

      const ariaHeading = document.createElement('div');
      ariaHeading.setAttribute('role', 'heading');
      ariaHeading.setAttribute('aria-level', '2');
      ariaHeading.textContent = 'Section Title';
      expect(classifyElement(ariaHeading).kind).toBe('Heading — H2');
    });
  });

  describe('Structural Heuristics: Cards, Breadcrumbs, Popovers', () => {
    it('detects breadcrumb navigation via aria-label or breadcrumb class', () => {
      const ul = document.createElement('ul');
      ul.setAttribute('aria-label', 'Breadcrumb');
      const c = classifyElement(ul);
      expect(c.kind).toBe('Breadcrumb');
      expect(c.confidence).toBe('heuristic');
    });

    it('detects popover elements via popover attribute or aria-haspopup', () => {
      const divPopover = document.createElement('div');
      divPopover.setAttribute('popover', 'auto');
      const c = classifyElement(divPopover);
      expect(c.kind).toBe('Popover');
      expect(c.confidence).toBe('heuristic');
    });

    it('detects card component via class name and visual styles', () => {
      const card = document.createElement('div');
      card.className = 'feature-card';
      const h3 = document.createElement('h3');
      h3.textContent = 'High Speed Sync';
      const p = document.createElement('p');
      p.textContent = 'Sync your web components in real time.';
      card.appendChild(h3);
      card.appendChild(p);

      const c = classifyElement(card, {
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
        borderRadius: '8px',
        backgroundColor: '#ffffff'
      });
      expect(c.kind).toBe('Card');
      expect(c.confidence).toBe('heuristic');
      expect(c.displayName).toBe('Card — "High Speed Sync"');
    });
  });

  describe('Neutral Fallbacks', () => {
    it('assigns Container to multi-child containers without explicit semantic role', () => {
      const div = document.createElement('div');
      div.appendChild(document.createElement('span'));
      div.appendChild(document.createElement('span'));

      const c = classifyElement(div);
      expect(c.kind).toBe('Container');
      expect(c.confidence).toBe('fallback');
    });

    it('assigns Content to single leaf elements with text', () => {
      const span = document.createElement('span');
      span.textContent = 'Just some inline text';

      const c = classifyElement(span);
      expect(c.kind).toBe('Content');
      expect(c.confidence).toBe('fallback');
    });
  });

  describe('Sibling Sequence Numbering', () => {
    it('assigns zero-padded sequence numbers to repeated identical sibling names', () => {
      const siblings = [
        { kind: 'Card', displayName: 'Card' },
        { kind: 'Card', displayName: 'Card' },
        { kind: 'Card', displayName: 'Card' },
        { kind: 'Button', displayName: 'Button' }
      ];

      const sequenced = assignSiblingSequenceNames(siblings);
      expect(sequenced[0]?.displayName).toBe('Card 01');
      expect(sequenced[1]?.displayName).toBe('Card 02');
      expect(sequenced[2]?.displayName).toBe('Card 03');
      // Single button should not get sequence number
      expect(sequenced[3]?.displayName).toBe('Button');
    });
  });

  describe('enrichNodesWithSemantics', () => {
    it('stamps name and semanticKind onto SourceNodes with sibling numbering', () => {
      const mockNodes: SourceNode[] = [
        {
          nodeId: 'card_1',
          parentId: 'root',
          childIds: [],
          sourceTag: 'div',
          classHints: ['card'],
          textRuns: [{ text: 'Card 1', fontFamily: 'Inter', fontWeight: 400, fontStyle: 'normal', fontSize: 16, lineHeight: 20, letterSpacing: 0, color: '#000', textDecoration: 'none', textAlign: 'left', textTransform: 'none' }],
          sourceRect: { x: 0, y: 0, width: 200, height: 200 },
          documentRect: { x: 0, y: 0, width: 200, height: 200 },
          visibility: { isVisible: true, isClipped: false, isOffscreen: false, opacity: 1 },
          stacking: { createsStackingContext: false, zIndex: 'auto' },
          computedStyle: { display: 'block', position: 'static', overflow: 'visible', boxSizing: 'border-box', backgroundColor: '#fff', color: '#000', fontSize: '16px', fontFamily: 'Inter', fontWeight: '400', lineHeight: 'normal', letterSpacing: 'normal', textAlign: 'left', borderRadius: '4px', borderWidth: '1px', borderColor: '#ccc', borderStyle: 'solid', boxShadow: 'none', transform: 'none', padding: '0', margin: '0' },
          layoutHints: { isFlexContainer: false, isGridContainer: false, isInline: false, isBlock: true },
          assetRefs: []
        },
        {
          nodeId: 'card_2',
          parentId: 'root',
          childIds: [],
          sourceTag: 'div',
          classHints: ['card'],
          textRuns: [{ text: 'Card 2', fontFamily: 'Inter', fontWeight: 400, fontStyle: 'normal', fontSize: 16, lineHeight: 20, letterSpacing: 0, color: '#000', textDecoration: 'none', textAlign: 'left', textTransform: 'none' }],
          sourceRect: { x: 220, y: 0, width: 200, height: 200 },
          documentRect: { x: 220, y: 0, width: 200, height: 200 },
          visibility: { isVisible: true, isClipped: false, isOffscreen: false, opacity: 1 },
          stacking: { createsStackingContext: false, zIndex: 'auto' },
          computedStyle: { display: 'block', position: 'static', overflow: 'visible', boxSizing: 'border-box', backgroundColor: '#fff', color: '#000', fontSize: '16px', fontFamily: 'Inter', fontWeight: '400', lineHeight: 'normal', letterSpacing: 'normal', textAlign: 'left', borderRadius: '4px', borderWidth: '1px', borderColor: '#ccc', borderStyle: 'solid', boxShadow: 'none', transform: 'none', padding: '0', margin: '0' },
          layoutHints: { isFlexContainer: false, isGridContainer: false, isInline: false, isBlock: true },
          assetRefs: []
        }
      ];

      const enriched = enrichNodesWithSemantics(mockNodes);
      expect(enriched[0]?.semanticKind).toBe('Card');
      expect(enriched[0]?.name).toBeDefined();
      expect(enriched[1]?.semanticKind).toBe('Card');
      expect(enriched[1]?.name).toBeDefined();
    });
  });
});
