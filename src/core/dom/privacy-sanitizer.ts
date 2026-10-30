/**
 * Privacy Sanitizer and Safe Attribute Extractor.
 * Strictly shields sensitive user data (passwords, payment credentials, personal values, tokens)
 * while preserving visual metadata, accessible labels, placeholders, and semantic ARIA roles.
 */

export interface SanitizedElementAttributes {
  sourceTag: string;
  role?: string | undefined;
  accessibleLabel?: string | undefined;
  classHints: string[];
  isFormElement: boolean;
  inputType?: string | undefined;
  placeholder?: string | undefined;
}

/**
 * Patterns matching sensitive attribute names that should never be captured.
 */
const SENSITIVE_ATTR_PATTERN = /(?:password|token|secret|auth|credit-?card|cvv|ssn|api-?key)/i;

/**
 * Safe CSS identifier escape helper supporting environments without global CSS.escape.
 */
export function escapeCssIdentifier(str: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(str);
  }
  return str.replace(/([!"#$%&'()*+,.\/:;<=>?@[\\\]^`{|}~])/g, '\\$1');
}

/**
 * Derives the accessible label for an element following the Accessible Name Computation order:
 * aria-labelledby -> aria-label -> associated <label> -> title.
 */
export function extractAccessibleLabel(el: Element): string | undefined {
  // 1. aria-labelledby
  const labelledBy = el.getAttribute('aria-labelledby');
  if (labelledBy && typeof document !== 'undefined') {
    const ids = labelledBy.split(/\s+/);
    const textPieces: string[] = [];
    for (const id of ids) {
      const target = document.getElementById(id);
      if (target?.textContent?.trim()) {
        textPieces.push(target.textContent.trim());
      }
    }
    if (textPieces.length > 0) {
      return textPieces.join(' ');
    }
  }

  // 2. aria-label
  const ariaLabel = el.getAttribute('aria-label');
  if (ariaLabel?.trim()) {
    return ariaLabel.trim();
  }

  // 3. For form elements, look for <label for="id">
  if (el.id && typeof document !== 'undefined') {
    try {
      const escapedId = escapeCssIdentifier(el.id);
      const labelEl = document.querySelector(`label[for="${escapedId}"]`);
      if (labelEl?.textContent?.trim()) {
        return labelEl.textContent.trim();
      }
    } catch {
      // Fallback
    }
  }

  // 4. Fallback to title
  const title = el.getAttribute('title');
  if (title?.trim()) {
    return title.trim();
  }

  // 5. Image alt attribute
  if (el.tagName === 'IMG') {
    const alt = el.getAttribute('alt');
    if (alt?.trim()) return alt.trim();
  }

  return undefined;
}

/**
 * Extracts class names as concise semantic hints (omitting machine hashes or utility clutter where appropriate).
 */
export function extractClassHints(el: Element, maxHints = 5): string[] {
  if (!el.className || typeof el.className !== 'string') return [];
  const rawClasses = el.className.split(/\s+/).filter(Boolean);
  return rawClasses.slice(0, maxHints);
}

/**
 * Sanitizes element attributes, stripping all user-entered form values, passwords,
 * tokens, and secrets while capturing safe structure and accessibility hints.
 */
export function sanitizeElementPrivacy(el: Element): SanitizedElementAttributes {
  const tagName = el.tagName.toUpperCase();
  const isInput = tagName === 'INPUT';
  const isTextArea = tagName === 'TEXTAREA';
  const isSelect = tagName === 'SELECT';
  const isFormElement = isInput || isTextArea || isSelect;

  const accessibleLabel = extractAccessibleLabel(el);
  const classHints = extractClassHints(el);
  const role = el.getAttribute('role') || undefined;

  let inputType: string | undefined;
  let placeholder: string | undefined;

  if (isInput) {
    const rawType = (el.getAttribute('type') || 'text').toLowerCase();
    inputType = rawType;
    placeholder = el.getAttribute('placeholder') || undefined;

    // Security check: NEVER extract value from password, text, number, email, tel, etc.
    // Inputs are represented strictly by type + placeholder + accessible label.
  } else if (isTextArea) {
    inputType = 'textarea';
    placeholder = el.getAttribute('placeholder') || undefined;
    // Discard any entered text content in textarea to protect user privacy
  } else if (isSelect) {
    inputType = 'select';
  }

  return {
    sourceTag: tagName.toLowerCase(),
    ...(role ? { role } : {}),
    ...(accessibleLabel ? { accessibleLabel } : {}),
    classHints,
    isFormElement,
    ...(inputType ? { inputType } : {}),
    ...(placeholder ? { placeholder } : {})
  };
}

/**
 * Checks if an attribute name contains sensitive patterns.
 */
export function isAttributeSensitive(attrName: string): boolean {
  return SENSITIVE_ATTR_PATTERN.test(attrName);
}
