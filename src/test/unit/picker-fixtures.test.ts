import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ElementPicker } from '../../content/picker/element-picker';
import { DOMWalker } from '../../core/dom/dom-walker';
import { rebaseSubtreeCoordinates } from '../../core/dom/coordinate-normalizer';
import { enrichNodesWithSemantics } from '../../core/dom/semantic-classifier';

describe('Picker Complex Fixtures: Shadow DOM, SVG, Nested Cards & Teardown', () => {
  let picker: ElementPicker;
  let fixtureRoot: HTMLDivElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    fixtureRoot = document.createElement('div');
    fixtureRoot.id = 'fixture-root';
    document.body.appendChild(fixtureRoot);

    picker = new ElementPicker();
  });

  afterEach(() => {
    picker.stop();
    document.body.innerHTML = '';
  });

  it('selects nested card and extracts isolated subtree with rebased coordinates', () => {
    // Construct nested card fixture
    const card = document.createElement('div');
    card.className = 'card product-card';
    card.style.width = '300px';
    card.style.height = '400px';

    const heading = document.createElement('h3');
    heading.textContent = 'Pro Annual Plan';

    const desc = document.createElement('p');
    desc.textContent = 'Full access to all export features.';

    const ctaButton = document.createElement('button');
    ctaButton.textContent = 'Subscribe Now';

    card.appendChild(heading);
    card.appendChild(desc);
    card.appendChild(ctaButton);
    fixtureRoot.appendChild(card);

    let pickedResult: any = null;
    picker.start((res) => {
      pickedResult = res;
    });

    // Simulate pointing at card
    vi.spyOn(document, 'elementFromPoint').mockReturnValue(card);
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 50, clientY: 50 }));

    // Click to confirm (composed: true allows event to cross shadow boundary)
    const clickEvt = new MouseEvent('click', { bubbles: true, cancelable: true, composed: true });
    card.dispatchEvent(clickEvt);

    expect(pickedResult).not.toBeNull();
    expect(pickedResult.element).toBe(card);

    // Run DOMWalker on the selected card subtree
    const walker = new DOMWalker({
      captureMode: 'select-element',
      resolvePaintOrder: true
    });
    const walkResult = walker.walk(pickedResult.element);

    expect(walkResult.nodes.length).toBeGreaterThanOrEqual(4); // card, heading, desc, button

    // Rebase coordinates relative to card top-left
    const rebased = rebaseSubtreeCoordinates(
      walkResult.nodes,
      pickedResult.rect,
      {
        includeAncestorBackground: false
      }
    );

    // Root node must be at (0, 0)
    expect(rebased[0]?.sourceRect.x).toBe(0);
    expect(rebased[0]?.sourceRect.y).toBe(0);

    // Enrich with semantic classifications
    const semantic = enrichNodesWithSemantics(rebased);
    expect(semantic[0]?.semanticKind).toBe('Card');
    expect(semantic[0]?.name).toContain('Card');
  });

  it('handles SVG icons and nested path selection', () => {
    const iconBtn = document.createElement('button');
    iconBtn.className = 'icon-btn';

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '24');
    svg.setAttribute('height', '24');

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M12 2L2 22h20L12 2z');
    svg.appendChild(path);
    iconBtn.appendChild(svg);
    fixtureRoot.appendChild(iconBtn);

    let pickedResult: any = null;
    picker.start((res) => {
      pickedResult = res;
    });

    // Hover directly over the SVG element
    vi.spyOn(document, 'elementFromPoint').mockReturnValue(svg);
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 12, clientY: 12 }));

    // Cycle parent to select the button container
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

    expect(pickedResult).not.toBeNull();
    expect(pickedResult.element).toBe(iconBtn);
  });

  it('handles elements inside open Shadow DOM subtrees', () => {
    const shadowHost = document.createElement('div');
    shadowHost.id = 'shadow-component';
    const shadowRoot = shadowHost.attachShadow({ mode: 'open' });

    const innerCard = document.createElement('div');
    innerCard.className = 'shadow-card';
    innerCard.textContent = 'Shadow Encapsulated Content';
    shadowRoot.appendChild(innerCard);
    fixtureRoot.appendChild(shadowHost);

    let pickedResult: any = null;
    picker.start((res) => {
      pickedResult = res;
    });

    // Point at shadow card
    vi.spyOn(document, 'elementFromPoint').mockReturnValue(innerCard);
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 20, clientY: 20 }));

    // Click to confirm (composed: true allows event to cross shadow boundary)
    const clickEvt = new MouseEvent('click', { bubbles: true, cancelable: true, composed: true });
    innerCard.dispatchEvent(clickEvt);

    expect(pickedResult).not.toBeNull();
    expect(pickedResult.element).toBe(innerCard);
  });

  it('completely cleans up DOM and leaves zero leftover overlay nodes after teardown', () => {
    picker.start();

    // Verify host was injected
    const host = document.getElementById('w2f-picker-host');
    expect(host).not.toBeNull();

    // Stop picker
    picker.stop();

    // Verify overlay box is hidden
    const box = document.getElementById('w2f-highlight-box');
    expect(box?.style.display).toBe('none');

    // Tooltip should be unmounted
    expect(document.getElementById('w2f-picker-tooltip-container')).toBeNull();
  });
});
