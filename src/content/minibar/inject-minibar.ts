/**
 * In-Page Minibar Host Injector & Shadow DOM Isolator.
 * Creates an isolated container adhering to CSS isolation standards (all: initial !important)
 * and marks the host element with data-w2f-exclude="true" for DOM extraction pruning.
 */

import { MINIBAR_HOST_ID, teardownMinibar, registerMinibarCleanup } from './teardown';

export const MINIBAR_ROOT_ID = 'minibar-root';

export const ISOLATION_CSS = `
:host {
  all: initial !important;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif !important;
  font-size: 13px !important;
  color: #0f172a !important;
  line-height: 1.4 !important;
  text-transform: none !important;
  letter-spacing: normal !important;
  direction: ltr !important;
  box-sizing: border-box !important;
  contain: layout style !important;
}

*, *::before, *::after {
  box-sizing: border-box !important;
}
`;

export interface MinibarMountResult {
  host: HTMLElement;
  shadow: ShadowRoot;
  container: HTMLElement;
  alreadyExisted: boolean;
}

/**
 * Injects the minibar host element into the document with Shadow DOM encapsulation.
 * Idempotent: returns existing elements if already injected.
 */
export function injectMinibarHost(): MinibarMountResult {
  if (typeof document === 'undefined') {
    throw new Error('injectMinibarHost requires a browser DOM environment');
  }

  // 1. Check if host already exists
  const existingHost = document.getElementById(MINIBAR_HOST_ID);
  if (existingHost && existingHost.shadowRoot) {
    const container = existingHost.shadowRoot.getElementById(MINIBAR_ROOT_ID);
    if (container) {
      return {
        host: existingHost,
        shadow: existingHost.shadowRoot,
        container,
        alreadyExisted: true
      };
    }
  }

  // 2. Create fresh isolated host element
  const host = document.createElement('div');
  host.id = MINIBAR_HOST_ID;
  host.setAttribute('data-w2f-exclude', 'true');
  host.setAttribute('data-web-to-figma-minibar', 'true');

  // Enforce host container isolation styles
  host.style.setProperty('position', 'fixed', 'important');
  host.style.setProperty('z-index', '2147483647', 'important');
  host.style.setProperty('pointer-events', 'auto', 'important');
  host.style.setProperty('top', '24px', 'important');
  host.style.setProperty('right', '24px', 'important');
  host.style.setProperty('left', 'auto', 'important');
  host.style.setProperty('bottom', 'auto', 'important');
  host.style.setProperty('margin', '0', 'important');
  host.style.setProperty('padding', '0', 'important');
  host.style.setProperty('border', 'none', 'important');
  host.style.setProperty('background', 'transparent', 'important');

  // 3. Attach open Shadow DOM
  const shadow = host.attachShadow({ mode: 'open' });

  // 4. Inject base isolation styles
  const styleEl = document.createElement('style');
  styleEl.id = 'w2f-isolation-style';
  styleEl.textContent = ISOLATION_CSS;
  shadow.appendChild(styleEl);

  // 5. Create container for React rendering
  const container = document.createElement('div');
  container.id = MINIBAR_ROOT_ID;
  shadow.appendChild(container);

  // 6. Attach host to DOM (prefer document.body, fallback to documentElement)
  const targetParent = document.body || document.documentElement;
  targetParent.appendChild(host);

  return {
    host,
    shadow,
    container,
    alreadyExisted: false
  };
}
