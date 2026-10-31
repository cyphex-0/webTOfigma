/**
 * Content Sanitizer and Sensitive Data Redaction Engine.
 * 
 * Enforces data privacy and prevents security leakage during DOM extraction:
 * - Redacts password, secret, credit card, and token input values with masked placeholders
 * - Strictly encodes extracted text strings to prevent HTML injection in extension UI
 * - Verifies cross-context message payload integrity at extension boundaries
 * - Ensures no user credentials or session tokens are stored or serialized into Figma payloads
 */

const SENSITIVE_FIELD_PATTERNS = [
  /password/i,
  /passwd/i,
  /secret/i,
  /token/i,
  /api[_-]?key/i,
  /auth/i,
  /bearer/i,
  /credit[_-]?card/i,
  /card[_-]?number/i,
  /cvv/i,
  /cvc/i,
  /ssn/i,
  /pin/i
];

const SENSITIVE_AUTOCOMPLETE_VALUES = new Set([
  'current-password',
  'new-password',
  'one-time-code',
  'cc-number',
  'cc-csc',
  'cc-exp',
  'cc-exp-month',
  'cc-exp-year',
  'cc-type'
]);

export interface FormElementDescriptor {
  tagName: string;
  type?: string | undefined;
  name?: string | undefined;
  id?: string | undefined;
  autocomplete?: string | undefined;
  value?: string | undefined;
}

/**
 * Checks whether a form input element represents sensitive or credential data.
 */
export function isSensitiveField(element: FormElementDescriptor): boolean {
  const type = (element.type || '').toLowerCase();
  if (type === 'password') {
    return true;
  }

  const autocomplete = (element.autocomplete || '').toLowerCase().trim();
  if (SENSITIVE_AUTOCOMPLETE_VALUES.has(autocomplete)) {
    return true;
  }

  const name = element.name || '';
  const id = element.id || '';

  for (const pattern of SENSITIVE_FIELD_PATTERNS) {
    if (pattern.test(name) || pattern.test(id)) {
      return true;
    }
  }

  return false;
}

/**
 * Redacts sensitive form field values with a uniform privacy mask.
 */
export function redactSensitiveValue(element: FormElementDescriptor): string {
  if (isSensitiveField(element)) {
    return '••••••••';
  }
  return element.value ?? '';
}

/**
 * Escapes raw strings for safe display in extension text contexts,
 * preventing injection of HTML entities or tags.
 */
export function escapeTextForDisplay(rawText: string): string {
  return rawText
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Validates that an incoming object is a valid structured message envelope.
 */
export function isValidMessageEnvelope(obj: unknown): obj is { id: string; type: string; timestamp: number } {
  if (!obj || typeof obj !== 'object') return false;
  const msg = obj as Record<string, unknown>;
  return (
    typeof msg.id === 'string' &&
    typeof msg.type === 'string' &&
    typeof msg.timestamp === 'number'
  );
}
