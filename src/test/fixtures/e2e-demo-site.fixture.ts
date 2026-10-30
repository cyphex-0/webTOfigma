/**
 * End-to-End Demo Fixture Site.
 * 
 * Provides a realistic complete website layout mounted in DOM:
 * - Header & Navigation
 * - Hero section with H1, paragraph, CTA button, and image
 * - Feature Cards grid with icons, borders, corner radii, and box shadows
 * - Form fields to verify privacy sanitization (no credentials captured)
 * - Footer with legal links
 */

export interface E2EDemoFixture {
  container: HTMLDivElement;
  header: HTMLElement;
  heroSection: HTMLElement;
  cardsGrid: HTMLElement;
  featureCard1: HTMLElement;
  feedbackForm: HTMLFormElement;
  footer: HTMLElement;
  cleanup: () => void;
}

export function buildE2EDemoSiteFixture(): E2EDemoFixture {
  const container = document.createElement('div');
  container.id = 'e2e-demo-site-root';
  container.style.width = '1440px';
  container.style.minHeight = '2200px';
  container.style.backgroundColor = '#f8fafc';
  container.style.position = 'relative';

  // 1. Header
  const header = document.createElement('header');
  header.id = 'demo-header';
  header.style.position = 'sticky';
  header.style.top = '0px';
  header.style.width = '1440px';
  header.style.height = '64px';
  header.style.backgroundColor = '#ffffff';
  header.style.borderBottom = '1px solid #e2e8f0';
  header.innerHTML = `
    <nav style="display: flex; align-items: center; justify-content: space-between; height: 100%; padding: 0 40px;">
      <span class="logo" style="width: 150px; height: 28px; font-weight: 700; font-size: 20px; color: #1e293b;">Acme Platform</span>
      <ul style="display: flex; gap: 20px; list-style: none; width: 200px; height: 24px;">
        <li><a href="#features" style="width: 80px; height: 20px; color: #475569; text-decoration: none;">Features</a></li>
        <li><a href="#pricing" style="width: 80px; height: 20px; color: #475569; text-decoration: none;">Pricing</a></li>
      </ul>
    </nav>
  `;
  container.appendChild(header);

  // 2. Hero Section
  const heroSection = document.createElement('section');
  heroSection.id = 'demo-hero';
  heroSection.style.padding = '60px 40px';
  heroSection.style.width = '1440px';
  heroSection.style.height = '600px';
  heroSection.style.display = 'flex';
  heroSection.style.flexDirection = 'column';
  heroSection.style.alignItems = 'flex-start';
  heroSection.style.gap = '20px';
  heroSection.style.backgroundColor = '#ffffff';
  heroSection.innerHTML = `
    <h1 style="width: 800px; height: 60px; font-size: 40px; font-weight: 800; color: #0f172a; margin: 0;">Automate Web to Design Workflows</h1>
    <p style="width: 600px; height: 50px; font-size: 18px; color: #64748b; margin: 0;">
      Turn any production website into pixel-perfect, editable Figma components in seconds.
    </p>
    <button id="cta-button" type="button" style="width: 160px; height: 48px; padding: 12px 28px; background-color: #2563eb; color: #ffffff; border-radius: 8px; border: none; font-weight: 600;">
      Get Started Free
    </button>
    <img id="hero-banner-img" src="https://example.com/hero.png" alt="Platform Dashboard" style="width: 800px; height: 400px; border-radius: 12px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);" />
  `;
  container.appendChild(heroSection);

  // 3. Feature Cards Grid
  const cardsGrid = document.createElement('section');
  cardsGrid.id = 'demo-cards-grid';
  cardsGrid.style.width = '1440px';
  cardsGrid.style.height = '400px';
  cardsGrid.style.display = 'grid';
  cardsGrid.style.gridTemplateColumns = 'repeat(3, 1fr)';
  cardsGrid.style.gap = '24px';
  cardsGrid.style.padding = '40px';

  const featureCard1 = document.createElement('article');
  featureCard1.id = 'demo-feature-card-1';
  featureCard1.className = 'feature-card';
  featureCard1.style.width = '400px';
  featureCard1.style.height = '200px';
  featureCard1.style.padding = '24px';
  featureCard1.style.backgroundColor = '#ffffff';
  featureCard1.style.borderRadius = '12px';
  featureCard1.style.border = '1px solid #e2e8f0';
  featureCard1.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.05)';
  featureCard1.innerHTML = `
    <h3 style="width: 300px; height: 28px; font-size: 20px; font-weight: 700; color: #1e293b; margin: 0 0 12px 0;">Auto Layout Synthesis</h3>
    <p style="width: 350px; height: 40px; font-size: 14px; color: #64748b; margin: 0;">Recognizes CSS Flexbox and 1D Grids and translates them directly to Figma Auto Layout.</p>
  `;
  cardsGrid.appendChild(featureCard1);

  const featureCard2 = document.createElement('article');
  featureCard2.id = 'demo-feature-card-2';
  featureCard2.className = 'feature-card';
  featureCard2.style.padding = '24px';
  featureCard2.style.backgroundColor = '#ffffff';
  featureCard2.style.borderRadius = '12px';
  featureCard2.style.border = '1px solid #e2e8f0';
  featureCard2.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.05)';
  featureCard2.innerHTML = `
    <h3 style="font-size: 20px; font-weight: 700; color: #1e293b; margin: 0 0 12px 0;">Editable Typography</h3>
    <p style="font-size: 14px; color: #64748b; margin: 0;">Preserves font fallbacks, discrete weights, line heights, and rich text runs.</p>
  `;
  cardsGrid.appendChild(featureCard2);

  const featureCard3 = document.createElement('article');
  featureCard3.id = 'demo-feature-card-3';
  featureCard3.className = 'feature-card';
  featureCard3.style.padding = '24px';
  featureCard3.style.backgroundColor = '#ffffff';
  featureCard3.style.borderRadius = '12px';
  featureCard3.style.border = '1px solid #e2e8f0';
  featureCard3.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.05)';
  featureCard3.innerHTML = `
    <h3 style="font-size: 20px; font-weight: 700; color: #1e293b; margin: 0 0 12px 0;">Vector & Asset Safety</h3>
    <p style="font-size: 14px; color: #64748b; margin: 0;">Deduplicates assets and sanitizes SVG vectors without security compromises.</p>
  `;
  cardsGrid.appendChild(featureCard3);

  container.appendChild(cardsGrid);

  // 4. Privacy Form
  const feedbackForm = document.createElement('form');
  feedbackForm.id = 'demo-feedback-form';
  feedbackForm.style.padding = '40px';
  feedbackForm.style.backgroundColor = '#ffffff';
  feedbackForm.innerHTML = `
    <label for="demo-email" style="font-size: 14px; font-weight: 600;">Work Email</label>
    <input id="demo-email" type="email" value="confidential@enterprise.com" style="margin-bottom: 12px; width: 300px; padding: 8px;" />
    <label for="demo-pass" style="font-size: 14px; font-weight: 600;">Secret Token</label>
    <input id="demo-pass" type="password" value="SuperSecretToken123" style="width: 300px; padding: 8px;" />
  `;
  container.appendChild(feedbackForm);

  // 5. Footer
  const footer = document.createElement('footer');
  footer.id = 'demo-footer';
  footer.style.padding = '30px 40px';
  footer.style.backgroundColor = '#0f172a';
  footer.style.color = '#94a3b8';
  footer.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center;">
      <span>© 2026 Acme Corp. All rights reserved.</span>
      <div style="display: flex; gap: 16px;">
        <a href="#privacy" style="color: #cbd5e1; text-decoration: none;">Privacy</a>
        <a href="#terms" style="color: #cbd5e1; text-decoration: none;">Terms</a>
      </div>
    </div>
  `;
  container.appendChild(footer);

  document.body.appendChild(container);

  return {
    container,
    header,
    heroSection,
    cardsGrid,
    featureCard1,
    feedbackForm,
    footer,
    cleanup: () => {
      container.remove();
    }
  };
}
