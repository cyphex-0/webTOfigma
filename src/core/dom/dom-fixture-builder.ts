/**
 * Programmatic DOM Test Fixture Generator.
 * Constructs rich, realistic HTML DOM trees covering flexbox, grid, sticky headers,
 * 3D transforms, open and closed shadow roots, pseudo-elements, iframes, and privacy fields.
 */

export interface TestDomFixture {
  container: HTMLDivElement;
  stickyHeader: HTMLElement;
  flexContainer: HTMLElement;
  gridContainer: HTMLElement;
  transform3dCard: HTMLElement;
  openShadowHost: HTMLElement;
  closedShadowHost: HTMLElement;
  sameOriginIframe: HTMLIFrameElement;
  privacyForm: HTMLFormElement;
  excludedOverlay: HTMLElement;
  cleanup: () => void;
}

/**
 * Builds a comprehensive test DOM tree mounted on document.body.
 */
export function buildComplexTestDomFixture(): TestDomFixture {
  const container = document.createElement('div');
  container.id = 'test-dom-fixture-root';
  container.style.width = '1200px';
  container.style.minHeight = '2000px';
  container.style.position = 'relative';

  // 1. Sticky Header
  const stickyHeader = document.createElement('header');
  stickyHeader.id = 'fixture-sticky-header';
  stickyHeader.style.position = 'sticky';
  stickyHeader.style.top = '0px';
  stickyHeader.style.zIndex = '100';
  stickyHeader.style.height = '60px';
  stickyHeader.style.backgroundColor = '#ffffff';
  stickyHeader.innerHTML = `
    <nav style="display: flex; align-items: center; justify-content: space-between; height: 100%;">
      <span class="brand-title" style="font-weight: 700; font-size: 18px;">Acme Design</span>
      <ul style="display: flex; gap: 16px; list-style: none;">
        <li><a href="#features">Features</a></li>
        <li><a href="#pricing">Pricing</a></li>
      </ul>
    </nav>
  `;
  container.appendChild(stickyHeader);

  // 2. Flex Container with Actions
  const flexContainer = document.createElement('section');
  flexContainer.id = 'fixture-flex-section';
  flexContainer.style.display = 'flex';
  flexContainer.style.flexDirection = 'row';
  flexContainer.style.gap = '12px';
  flexContainer.style.padding = '24px 0';
  flexContainer.innerHTML = `
    <button type="button" class="btn btn-primary" style="padding: 10px 20px; background-color: #2563eb; color: #fff;">Get Started</button>
    <button type="button" class="btn btn-secondary" style="padding: 10px 20px; background-color: #f1f5f9; color: #334155;">Documentation</button>
  `;
  container.appendChild(flexContainer);

  // 3. Grid Container with Cards
  const gridContainer = document.createElement('section');
  gridContainer.id = 'fixture-grid-section';
  gridContainer.style.display = 'grid';
  gridContainer.style.gridTemplateColumns = 'repeat(3, 1fr)';
  gridContainer.style.gap = '16px';
  gridContainer.innerHTML = `
    <article class="card" style="padding: 16px; border: 1px solid #e2e8f0; border-radius: 8px;">
      <h3 style="font-size: 16px; margin-bottom: 8px;">Vector Engine</h3>
      <p style="color: #64748b;">Converts DOM to high-fidelity vector scenes.</p>
    </article>
    <article class="card" style="padding: 16px; border: 1px solid #e2e8f0; border-radius: 8px;">
      <h3 style="font-size: 16px; margin-bottom: 8px;">CSS Stacking</h3>
      <p style="color: #64748b;">Full Appendix E paint layer resolution.</p>
    </article>
    <article class="card" style="padding: 16px; border: 1px solid #e2e8f0; border-radius: 8px;">
      <h3 style="font-size: 16px; margin-bottom: 8px;">Zero-I/O Copy</h3>
      <p style="color: #64748b;">Local-first instant clipboard transfer.</p>
    </article>
  `;
  container.appendChild(gridContainer);

  // 4. 3D Transformed Card
  const transform3dCard = document.createElement('div');
  transform3dCard.id = 'fixture-3d-card';
  transform3dCard.style.width = '300px';
  transform3dCard.style.height = '180px';
  transform3dCard.style.transform = 'matrix3d(1, 0, 0, 0, 0, 0.7071, 0.7071, 0, 0, -0.7071, 0.7071, 0, 0, 0, 50, 1)';
  transform3dCard.innerHTML = `<span style="font-weight: 600;">Perspective Card</span>`;
  container.appendChild(transform3dCard);

  // 5. Open Shadow DOM Component
  const openShadowHost = document.createElement('mock-open-card');
  openShadowHost.id = 'fixture-open-shadow-host';
  const openShadow = openShadowHost.attachShadow({ mode: 'open' });
  openShadow.innerHTML = `
    <div class="shadow-inner-card" style="padding: 12px; background-color: #f8fafc; border: 1px solid #cbd5e1;">
      <h4 style="font-size: 14px; color: #0f172a;">Shadow DOM Root</h4>
      <p style="font-size: 12px; color: #475569;">Encapsulated inner content.</p>
    </div>
  `;
  container.appendChild(openShadowHost);

  // 6. Closed Shadow DOM Custom Element with slotted light-DOM children
  const closedShadowHost = document.createElement('mock-closed-player');
  closedShadowHost.id = 'fixture-closed-shadow-host';
  closedShadowHost.innerHTML = `
    <span class="slotted-title" style="font-weight: 500;">Slotted Light DOM Heading</span>
    <button type="button" class="slotted-btn">Play Video</button>
  `;
  container.appendChild(closedShadowHost);

  // 7. Same-Origin Iframe
  const sameOriginIframe = document.createElement('iframe');
  sameOriginIframe.id = 'fixture-same-origin-iframe';
  sameOriginIframe.style.width = '400px';
  sameOriginIframe.style.height = '200px';
  sameOriginIframe.srcdoc = `<!DOCTYPE html><html><body><h2 id="iframe-inner-h2">Iframe Content</h2></body></html>`;
  container.appendChild(sameOriginIframe);

  // 8. Privacy Sanitizer Form
  const privacyForm = document.createElement('form');
  privacyForm.id = 'fixture-privacy-form';
  privacyForm.innerHTML = `
    <label for="fixture-username">User Name</label>
    <input type="text" id="fixture-username" value="sensitive_username" placeholder="Enter username" />

    <label for="fixture-password">Password</label>
    <input type="password" id="fixture-password" value="super_secret_pw_999!" placeholder="Enter password" />

    <textarea id="fixture-notes" placeholder="Private notes">My confidential diary entry</textarea>
  `;
  container.appendChild(privacyForm);

  // 9. Extension UI Excluded Overlay
  const excludedOverlay = document.createElement('div');
  excludedOverlay.id = 'fixture-excluded-minibar';
  excludedOverlay.setAttribute('data-w2f-exclude', 'true');
  excludedOverlay.innerHTML = `<span>In-Page Minibar Overlay</span>`;
  container.appendChild(excludedOverlay);

  // Mount fixture to document.body
  document.body.appendChild(container);

  return {
    container,
    stickyHeader,
    flexContainer,
    gridContainer,
    transform3dCard,
    openShadowHost,
    closedShadowHost,
    sameOriginIframe,
    privacyForm,
    excludedOverlay,
    cleanup: () => {
      if (container.parentNode) {
        container.parentNode.removeChild(container);
      }
    }
  };
}
