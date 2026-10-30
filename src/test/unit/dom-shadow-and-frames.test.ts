import { describe, it, expect } from 'vitest';
import {
  inspectShadowRoot,
  isCustomElementTag
} from '../../core/dom/shadow-dom';
import { inspectIframe } from '../../core/dom/iframe-handler';
import { buildComplexTestDomFixture } from '../../core/dom/dom-fixture-builder';

describe('Shadow DOM Inspection Engine', () => {
  it('detects custom element tag names', () => {
    expect(isCustomElementTag('user-profile')).toBe(true);
    expect(isCustomElementTag('custom-button-card')).toBe(true);
    expect(isCustomElementTag('div')).toBe(false);
    expect(isCustomElementTag('span')).toBe(false);
  });

  it('inspects open shadow roots and returns accessible shadowRoot', () => {
    const host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'open' });
    const inner = document.createElement('p');
    inner.textContent = 'Inside Shadow';
    shadow.appendChild(inner);

    const res = inspectShadowRoot(host, 'node_open_1');
    expect(res.hasShadowRoot).toBe(true);
    expect(res.isOpen).toBe(true);
    expect(res.shadowRoot).toBe(shadow);
    expect(res.diagnostic).toBeUndefined();
  });

  it('handles closed shadow roots on custom elements with diagnostics and slotted children', () => {
    const customHost = document.createElement('media-player-widget');
    const slottedTitle = document.createElement('span');
    slottedTitle.textContent = 'Track Title';
    customHost.appendChild(slottedTitle);

    const res = inspectShadowRoot(customHost, 'node_custom_closed_1');
    expect(res.hasShadowRoot).toBe(true);
    expect(res.isOpen).toBe(false);
    expect(res.shadowRoot).toBeNull();
    expect(res.slottedElements).toHaveLength(1);
    expect(res.slottedElements[0]?.textContent).toBe('Track Title');

    expect(res.diagnostic).toBeDefined();
    expect(res.diagnostic?.code).toBe('CLOSED_SHADOW_ROOT_ENCAPSULATED');
    expect(res.diagnostic?.severity).toBe('warning');
    expect(res.diagnostic?.nodeId).toBe('node_custom_closed_1');
  });

  it('returns false for ordinary elements without shadow root', () => {
    const div = document.createElement('div');
    const res = inspectShadowRoot(div);
    expect(res.hasShadowRoot).toBe(false);
    expect(res.isOpen).toBe(false);
    expect(res.shadowRoot).toBeNull();
  });
});

describe('Iframe Boundary Inspection Engine', () => {
  it('returns isIframe: false for non-iframe elements', () => {
    const el = document.createElement('div');
    const res = inspectIframe(el);
    expect(res.isIframe).toBe(false);
    expect(res.isSameOrigin).toBe(false);
  });

  it('detects same-origin iframes with accessible contentDocument', () => {
    const iframe = document.createElement('iframe');
    document.body.appendChild(iframe);

    const res = inspectIframe(iframe, 'node_iframe_1');
    expect(res.isIframe).toBe(true);
    // In jsdom document.createElement('iframe') attached to body has an accessible contentDocument
    expect(res.isSameOrigin).toBe(true);
    expect(res.contentDocument).not.toBeNull();
    expect(res.diagnostic).toBeUndefined();

    document.body.removeChild(iframe);
  });

  it('detects cross-origin protected iframes and generates diagnostic without crashing', () => {
    const iframe = document.createElement('iframe');
    // Simulate cross-origin security restriction where contentDocument access throws
    Object.defineProperty(iframe, 'contentDocument', {
      get() {
        throw new DOMException('Blocked a frame with origin "https://evil.com" from accessing a cross-origin frame.', 'SecurityError');
      }
    });

    const res = inspectIframe(iframe, 'node_cross_frame_1');
    expect(res.isIframe).toBe(true);
    expect(res.isSameOrigin).toBe(false);
    expect(res.contentDocument).toBeNull();

    expect(res.diagnostic).toBeDefined();
    expect(res.diagnostic?.code).toBe('CROSS_ORIGIN_IFRAME_OPAQUE');
    expect(res.diagnostic?.severity).toBe('info');
    expect(res.diagnostic?.nodeId).toBe('node_cross_frame_1');
  });
});

describe('Complex Test DOM Fixture Builder', () => {
  it('builds full DOM hierarchy and cleans up completely', () => {
    const fixture = buildComplexTestDomFixture();

    expect(document.getElementById('test-dom-fixture-root')).not.toBeNull();
    expect(fixture.stickyHeader).not.toBeNull();
    expect(fixture.flexContainer).not.toBeNull();
    expect(fixture.gridContainer).not.toBeNull();
    expect(fixture.transform3dCard).not.toBeNull();
    expect(fixture.openShadowHost).not.toBeNull();
    expect(fixture.closedShadowHost).not.toBeNull();
    expect(fixture.sameOriginIframe).not.toBeNull();
    expect(fixture.privacyForm).not.toBeNull();
    expect(fixture.excludedOverlay).not.toBeNull();

    // Verify open shadow root has inner elements
    expect(fixture.openShadowHost.shadowRoot).not.toBeNull();
    expect(fixture.openShadowHost.shadowRoot?.querySelector('.shadow-inner-card')).not.toBeNull();

    // Cleanup
    fixture.cleanup();
    expect(document.getElementById('test-dom-fixture-root')).toBeNull();
  });
});
