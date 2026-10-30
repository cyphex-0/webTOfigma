/**
 * Long-Page and Lazy-Loading DOM Fixture.
 * 
 * Multi-section long page (3600px height) containing:
 * - Sticky Header
 * - Hero content
 * - Below-the-fold content section (y = 1800px)
 * - Deep footer section (y = 3000px)
 * - Lazy-loading image requiring scroll hydration
 * - Persistent floating chat widget
 */

export interface LongPageFixture {
  container: HTMLDivElement;
  stickyHeader: HTMLElement;
  lazyImage: HTMLImageElement;
  deepSection: HTMLElement;
  chatWidget: HTMLElement;
  cleanup: () => void;
}

export function buildLongPageFixture(): LongPageFixture {
  const container = document.createElement('div');
  container.id = 'long-page-fixture-root';
  container.style.width = '1440px';
  container.style.minHeight = '3600px';
  container.style.position = 'relative';

  // 1. Sticky Header
  const stickyHeader = document.createElement('header');
  stickyHeader.id = 'long-sticky-header';
  stickyHeader.style.position = 'sticky';
  stickyHeader.style.top = '0px';
  stickyHeader.style.width = '1440px';
  stickyHeader.style.height = '64px';
  stickyHeader.style.backgroundColor = '#ffffff';
  stickyHeader.innerHTML = `
    <nav style="display: flex; align-items: center; justify-content: space-between; height: 100%; padding: 0 40px;">
      <span style="width: 160px; height: 28px; font-weight: 700;">Acme Enterprise</span>
    </nav>
  `;
  container.appendChild(stickyHeader);

  // 2. Hero Section
  const hero = document.createElement('section');
  hero.id = 'long-hero';
  hero.style.width = '1440px';
  hero.style.height = '600px';
  hero.style.padding = '40px';
  hero.innerHTML = `
    <h1 style="width: 600px; height: 48px; font-size: 36px; font-weight: 700;">Full Document Architecture</h1>
    <p style="width: 500px; height: 24px; font-size: 16px;">Top of page visible content</p>
  `;
  container.appendChild(hero);

  // 3. Middle Section with Lazy Image
  const middle = document.createElement('section');
  middle.id = 'long-middle';
  middle.style.width = '1440px';
  middle.style.height = '800px';
  middle.style.margin = '400px 0';
  middle.style.padding = '40px';

  const lazyImage = document.createElement('img');
  lazyImage.id = 'lazy-asset-img';
  lazyImage.src = 'https://example.com/placeholder-lazy.jpg';
  lazyImage.style.width = '600px';
  lazyImage.style.height = '350px';
  middle.appendChild(lazyImage);
  container.appendChild(middle);

  // 4. Deep Section below the fold
  const deepSection = document.createElement('section');
  deepSection.id = 'long-deep-section';
  deepSection.style.width = '1440px';
  deepSection.style.height = '600px';
  deepSection.style.margin = '800px 0';
  deepSection.style.padding = '40px';
  deepSection.innerHTML = `
    <h2 style="width: 400px; height: 32px; font-size: 28px; font-weight: 700;">Deep Page Section</h2>
    <p style="width: 450px; height: 24px; font-size: 16px;">Content revealed strictly after vertical scrolling</p>
  `;
  container.appendChild(deepSection);

  // 5. Persistent Chat Widget
  const chatWidget = document.createElement('div');
  chatWidget.id = 'persistent-chat';
  chatWidget.className = 'crisp-chat-widget';
  chatWidget.style.position = 'fixed';
  chatWidget.style.bottom = '20px';
  chatWidget.style.right = '20px';
  chatWidget.style.width = '60px';
  chatWidget.style.height = '60px';
  container.appendChild(chatWidget);

  document.body.appendChild(container);

  return {
    container,
    stickyHeader,
    lazyImage,
    deepSection,
    chatWidget,
    cleanup: () => {
      container.remove();
    }
  };
}
