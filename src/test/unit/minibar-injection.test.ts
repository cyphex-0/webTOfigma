import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  injectMinibarHost,
  MINIBAR_ROOT_ID,
  ISOLATION_CSS
} from '../../content/minibar/inject-minibar';
import {
  MINIBAR_HOST_ID,
  teardownMinibar,
  isMinibarInjected,
  registerMinibarCleanup
} from '../../content/minibar/teardown';

describe('Minibar Injection, Shadow DOM Isolation, and Teardown', () => {
  beforeEach(() => {
    teardownMinibar();
  });

  afterEach(() => {
    teardownMinibar();
  });

  it('creates host element with extraction exclusion attributes and highest z-index', () => {
    expect(isMinibarInjected()).toBe(false);

    const result = injectMinibarHost();
    expect(result.alreadyExisted).toBe(false);
    expect(isMinibarInjected()).toBe(true);

    const host = document.getElementById(MINIBAR_HOST_ID);
    expect(host).not.toBeNull();
    expect(host?.getAttribute('data-w2f-exclude')).toBe('true');
    expect(host?.getAttribute('data-web-to-figma-minibar')).toBe('true');

    // Inline styles check
    expect(host?.style.position).toBe('fixed');
    expect(host?.style.zIndex).toBe('2147483647');
    expect(host?.style.pointerEvents).toBe('auto');
  });

  it('attaches open Shadow Root with bidirectional CSS isolation', () => {
    const result = injectMinibarHost();
    const shadow = result.shadow;

    expect(shadow).toBeDefined();
    expect(shadow.mode).toBe('open');

    // Check isolation stylesheet
    const styleTag = shadow.getElementById('w2f-isolation-style');
    expect(styleTag).not.toBeNull();
    expect(styleTag?.textContent).toContain('all: initial !important');
    expect(styleTag?.textContent).toContain('font-family: system-ui');

    // Check root container for React
    const container = shadow.getElementById(MINIBAR_ROOT_ID);
    expect(container).not.toBeNull();
  });

  it('is idempotent and prevents duplicate host elements on repeated injection', () => {
    const first = injectMinibarHost();
    expect(first.alreadyExisted).toBe(false);

    const second = injectMinibarHost();
    expect(second.alreadyExisted).toBe(true);
    expect(second.host).toBe(first.host);

    const allHosts = document.querySelectorAll(`#${MINIBAR_HOST_ID}`);
    expect(allHosts).toHaveLength(1);
  });

  it('teardownMinibar cleans up DOM element and invokes registered cleanup callbacks', () => {
    injectMinibarHost();
    expect(isMinibarInjected()).toBe(true);

    let unmountCalled = false;
    let cleanupCalled = false;
    registerMinibarCleanup(
      () => { unmountCalled = true; },
      () => { cleanupCalled = true; }
    );

    const removed = teardownMinibar();
    expect(removed).toBe(true);
    expect(isMinibarInjected()).toBe(false);
    expect(unmountCalled).toBe(true);
    expect(cleanupCalled).toBe(true);

    // Repeated call is safe and returns false
    expect(teardownMinibar()).toBe(false);
  });
});
