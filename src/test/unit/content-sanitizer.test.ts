import { describe, it, expect } from 'vitest';
import {
  isSensitiveField,
  redactSensitiveValue,
  escapeTextForDisplay,
  isValidMessageEnvelope
} from '../../core/security/content-sanitizer';

describe('Content Sanitizer & Sensitive Data Redaction (Phase 22)', () => {
  it('detects password fields and sensitive autocomplete tokens', () => {
    expect(isSensitiveField({ tagName: 'input', type: 'password' })).toBe(true);
    expect(isSensitiveField({ tagName: 'input', autocomplete: 'current-password' })).toBe(true);
    expect(isSensitiveField({ tagName: 'input', autocomplete: 'cc-number' })).toBe(true);
    expect(isSensitiveField({ tagName: 'input', name: 'user_api_key' })).toBe(true);
    expect(isSensitiveField({ tagName: 'input', id: 'security_pin' })).toBe(true);
    expect(isSensitiveField({ tagName: 'input', name: 'search_query' })).toBe(false);
  });

  it('redacts sensitive values with uniform mask', () => {
    const masked = redactSensitiveValue({
      tagName: 'input',
      type: 'password',
      value: 'SuperSecret123!'
    });
    expect(masked).toBe('••••••••');
    expect(masked).not.toContain('SuperSecret123!');

    const regular = redactSensitiveValue({
      tagName: 'input',
      type: 'text',
      value: 'Hello World'
    });
    expect(regular).toBe('Hello World');
  });

  it('escapes text for safe display preventing HTML injection', () => {
    const escaped = escapeTextForDisplay('<script>alert("xss")</script>');
    expect(escaped).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    expect(escaped).not.toContain('<script>');
  });

  it('validates message envelopes at extension boundaries', () => {
    expect(isValidMessageEnvelope({ id: 'msg_1', type: 'CAPTURE', timestamp: 12345 })).toBe(true);
    expect(isValidMessageEnvelope({ id: 123, type: 'CAPTURE' })).toBe(false);
    expect(isValidMessageEnvelope(null)).toBe(false);
  });
});
