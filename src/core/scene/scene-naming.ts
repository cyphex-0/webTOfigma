/**
 * Scene Naming Engine.
 * 
 * Enforces standardized naming policy across page frames and scene layers:
 * - Page Frames: `[two-digit index] — [Page Title] — [Path]`
 * - Child Layers: Semantic role + stable sequence numbers for repeated elements.
 * - Sanitization: Strips control characters, normalizes whitespace, sanitizes paths.
 */

export interface PageNamingOptions {
  is1BasedIndex?: boolean | undefined;
  sanitizeChars?: boolean | undefined;
  maxLength?: number | undefined;
}

export interface ChildNamingInput {
  semanticKind?: string | undefined;
  sourceTag?: string | undefined;
  role?: string | undefined;
  accessibleLabel?: string | undefined;
  name?: string | undefined;
  isText?: boolean | undefined;
  isImage?: boolean | undefined;
  isVector?: boolean | undefined;
}

const SEMANTIC_KIND_LABELS: Record<string, string> = {
  header: 'Header',
  navigation: 'Navigation Bar',
  nav: 'Navigation Bar',
  main: 'Main Content',
  section: 'Section',
  article: 'Article',
  aside: 'Sidebar',
  footer: 'Footer',
  'heading-1': 'Heading — H1',
  h1: 'Heading — H1',
  'heading-2': 'Heading — H2',
  h2: 'Heading — H2',
  'heading-3': 'Heading — H3',
  h3: 'Heading — H3',
  'heading-4': 'Heading — H4',
  h4: 'Heading — H4',
  'heading-5': 'Heading — H5',
  h5: 'Heading — H5',
  'heading-6': 'Heading — H6',
  h6: 'Heading — H6',
  paragraph: 'Paragraph',
  p: 'Paragraph',
  button: 'Button',
  link: 'Link',
  card: 'Card',
  list: 'List',
  'list-item': 'List Item',
  li: 'List Item',
  image: 'Image',
  img: 'Image',
  vector: 'Vector',
  svg: 'Vector',
  table: 'Table',
  dialog: 'Dialog',
  popover: 'Popover',
  tab: 'Tab',
  'tab-panel': 'Tab Panel',
  breadcrumb: 'Breadcrumb',
  input: 'Input Field',
  container: 'Container',
  div: 'Container',
  span: 'Span',
  group: 'Group',
  content: 'Content'
};

/**
 * Sanitizes page title strings by trimming and collapsing whitespace,
 * removing control characters, and falling back to a default when empty.
 */
export function sanitizePageTitle(title: string): string {
  if (!title) return 'Untitled';
  // Remove control characters (0x00-0x1F, 0x7F) and normalize whitespace
  const sanitized = title
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return sanitized || 'Untitled';
}

/**
 * Extracts and normalizes the URL pathname for the page frame name.
 */
export function normalizeUrlPath(rawUrl: string): string {
  if (!rawUrl) return '/';
  try {
    const parsed = new URL(rawUrl);
    let path = parsed.pathname;
    if (!path || path === '') return '/';
    // Remove trailing slash if not root
    if (path.length > 1 && path.endsWith('/')) {
      path = path.slice(0, -1);
    }
    return path;
  } catch {
    // If not a valid full URL, extract path-like segment
    const match = rawUrl.match(/^(?:https?:\/\/[^/]+)?(\/[^?#]*)?/i);
    let path = match && match[1] ? match[1] : '/';
    if (path.length > 1 && path.endsWith('/')) {
      path = path.slice(0, -1);
    }
    return path;
  }
}

/**
 * Generates the standardized top-level Page Frame name:
 * `[two-digit index] — [Page Title] — [Path]`
 * 
 * Example: `01 — Acme Cloud Platform — /landing`
 */
export function generatePageFrameName(
  pageIndex: number,
  title: string,
  url: string,
  options: PageNamingOptions = {}
): string {
  const indexNum = options.is1BasedIndex
    ? Math.max(1, pageIndex)
    : Math.max(1, pageIndex + 1);

  const formattedIndex = String(indexNum).padStart(2, '0');
  const sanitizedTitle = sanitizePageTitle(title);
  const normalizedPath = normalizeUrlPath(url);

  return `${formattedIndex} — ${sanitizedTitle} — ${normalizedPath}`;
}

/**
 * Generates a human-friendly, semantic layer name for a child node.
 * Automatically appends sequence numbers when counter is specified.
 */
export function generateChildNodeName(
  input: ChildNamingInput,
  counter?: number | undefined
): string {
  let baseName = '';

  if (input.name && input.name.trim() !== '') {
    baseName = input.name.trim();
  } else if (input.semanticKind && SEMANTIC_KIND_LABELS[input.semanticKind.toLowerCase()]) {
    baseName = SEMANTIC_KIND_LABELS[input.semanticKind.toLowerCase()]!;
  } else if (input.role && SEMANTIC_KIND_LABELS[input.role.toLowerCase()]) {
    baseName = SEMANTIC_KIND_LABELS[input.role.toLowerCase()]!;
  } else if (input.isText) {
    baseName = 'Text';
  } else if (input.isImage) {
    baseName = 'Image';
  } else if (input.isVector) {
    baseName = 'Vector';
  } else if (input.sourceTag) {
    const tag = input.sourceTag.toLowerCase();
    baseName = SEMANTIC_KIND_LABELS[tag] ?? (tag.charAt(0).toUpperCase() + tag.slice(1));
  } else {
    baseName = 'Container';
  }

  // If accessible label exists and is concise, append it for high-value components
  if (
    input.accessibleLabel &&
    input.accessibleLabel.trim().length > 0 &&
    input.accessibleLabel.trim().length <= 24 &&
    !baseName.includes(input.accessibleLabel.trim()) &&
    (baseName === 'Button' || baseName === 'Link' || baseName.startsWith('Heading'))
  ) {
    baseName = `${baseName} — ${input.accessibleLabel.trim()}`;
  }

  if (counter !== undefined && counter > 0) {
    const formattedCounter = String(counter).padStart(2, '0');
    return `${baseName} ${formattedCounter}`;
  }

  return baseName;
}

/**
 * Sibling name registry that tracks child names within a parent container
 * and assigns stable two-digit sequence numbers to repeated sibling types.
 */
export class SiblingNameRegistry {
  private counts = new Map<string, number>();
  private assigned = new Map<string, string>();

  /**
   * Registers a sibling and returns a unique, sequenced layer name if repeated.
   */
  public register(id: string, input: ChildNamingInput): string {
    const baseName = generateChildNodeName(input);
    const count = (this.counts.get(baseName) ?? 0) + 1;
    this.counts.set(baseName, count);

    // Initial pass: we store baseName
    this.assigned.set(id, baseName);
    return baseName;
  }

  /**
   * Post-processes registered names to add sequence numbers (e.g. Card 01, Card 02)
   * only if the base name was repeated among siblings.
   */
  public resolveName(id: string, baseName: string, siblingIndex: number): string {
    const totalCount = this.counts.get(baseName) ?? 1;
    if (totalCount > 1) {
      return `${baseName} ${String(siblingIndex + 1).padStart(2, '0')}`;
    }
    return baseName;
  }
}
