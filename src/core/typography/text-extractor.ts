/**
 * Visible Text Extractor and Semantic Role Naming.
 * 
 * Extracts text content strictly from direct text nodes and line breaks (<br>),
 * preventing duplicate text emission from descendant elements.
 * Generates concise semantic layer names.
 */

/**
 * Determines whether a given element or computed style indicates invisible text.
 */
export function isTextVisible(style: CSSStyleDeclaration | Record<string, string>): boolean {
  const s = style as any;
  if (s.display === 'none' || s.visibility === 'hidden' || s.visibility === 'collapse') {
    return false;
  }
  const fontSize = parseFloat(s.fontSize || '16');
  if (fontSize <= 0) return false;
  return true;
}

/**
 * Derives a clean, concise semantic layer name from element tag, role, and attributes.
 */
export function getSemanticTextLayerName(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const role = el.getAttribute('role')?.toLowerCase();

  // Headings
  if (tag === 'h1' || (role === 'heading' && el.getAttribute('aria-level') === '1')) {
    return 'Heading — H1';
  }
  if (tag === 'h2' || (role === 'heading' && el.getAttribute('aria-level') === '2')) {
    return 'Heading — H2';
  }
  if (tag === 'h3' || (role === 'heading' && el.getAttribute('aria-level') === '3')) {
    return 'Heading — H3';
  }
  if (tag === 'h4' || (role === 'heading' && el.getAttribute('aria-level') === '4')) {
    return 'Heading — H4';
  }
  if (tag === 'h5' || (role === 'heading' && el.getAttribute('aria-level') === '5')) {
    return 'Heading — H5';
  }
  if (tag === 'h6' || (role === 'heading' && el.getAttribute('aria-level') === '6')) {
    return 'Heading — H6';
  }

  // Interactive controls
  if (tag === 'button' || role === 'button') {
    return 'Button Label';
  }
  if (tag === 'a' || role === 'link') {
    return 'Navigation Link';
  }
  if (tag === 'label') {
    return 'Field Label';
  }

  // Code & structured text
  if (tag === 'code' || tag === 'pre' || tag === 'kbd' || tag === 'samp') {
    return 'Code Snippet';
  }
  if (tag === 'blockquote') {
    return 'Blockquote';
  }
  if (tag === 'figcaption' || tag === 'caption') {
    return 'Caption';
  }
  if (tag === 'li') {
    return 'List Item';
  }
  if (tag === 'p') {
    return 'Body Text';
  }

  return 'Text';
}

/**
 * Extracts visible direct text from an Element without including text
 * already encapsulated in child element nodes.
 * Synthesizes line breaks from <br> tags.
 */
export function extractDirectElementText(
  el: Element,
  whiteSpace = 'normal'
): string {
  let result = '';
  const isPre = whiteSpace.startsWith('pre') || whiteSpace === 'break-spaces';

  for (let i = 0; i < el.childNodes.length; i++) {
    const child = el.childNodes[i];
    if (!child) continue;

    if (child.nodeType === 3) {
      // TEXT_NODE: direct text
      const content = child.textContent ?? '';
      result += content;
    } else if (child.nodeType === 1) {
      // ELEMENT_NODE: only process <br> tags directly
      const childEl = child as Element;
      if (childEl.tagName.toLowerCase() === 'br') {
        result += '\n';
      }
      // Other element children are intentionally NOT extracted here,
      // preventing duplicate text in the Figma node hierarchy!
    }
  }

  if (isPre) {
    return result;
  }

  // Collapse consecutive whitespace and trim outside lines
  return result
    .replace(/[ \t]+/g, ' ')
    .replace(/^[ \t]+|[ \t]+$/gm, '')
    .trim();
}

/**
 * Checks whether an element contains direct renderable text.
 */
export function hasDirectText(el: Element): boolean {
  for (let i = 0; i < el.childNodes.length; i++) {
    const child = el.childNodes[i];
    if (child?.nodeType === 3 && child.textContent?.trim().length) {
      return true;
    }
  }
  return false;
}
