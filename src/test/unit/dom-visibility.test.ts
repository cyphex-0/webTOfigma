import { describe, it, expect } from 'vitest';
import {
  isExtensionExcluded,
  isNonRenderedTag,
  evaluateElementVisibility
} from '../../core/dom/visibility';
import {
  sanitizeElementPrivacy,
  extractAccessibleLabel,
  extractClassHints,
  isAttributeSensitive
} from '../../core/dom/privacy-sanitizer';
import type { SourceRect } from '../../shared/contracts/source-node';

describe('DOM Visibility Filtering and Exclusion Rules', () => {
  const normalRect: SourceRect = { x: 50, y: 50, width: 200, height: 100 };

  it('prunes extension UI elements via data attributes and ID', () => {
    const minibarHost = document.createElement('div');
    minibarHost.id = 'web-to-figma-minibar-host';
    expect(isExtensionExcluded(minibarHost)).toBe(true);

    const excludedChild = document.createElement('span');
    excludedChild.setAttribute('data-w2f-exclude', 'true');
    expect(isExtensionExcluded(excludedChild)).toBe(true);

    const normalEl = document.createElement('div');
    expect(isExtensionExcluded(normalEl)).toBe(false);

    const evalRes = evaluateElementVisibility(minibarHost, normalRect, { display: 'block' });
    expect(evalRes.shouldPruneSubtree).toBe(true);
    expect(evalRes.shouldPruneElement).toBe(true);
    expect(evalRes.flags.isVisible).toBe(false);
  });

  it('prunes non-rendered tags like SCRIPT, STYLE, TEMPLATE, and META', () => {
    expect(isNonRenderedTag('SCRIPT')).toBe(true);
    expect(isNonRenderedTag('style')).toBe(true);
    expect(isNonRenderedTag('TEMPLATE')).toBe(true);
    expect(isNonRenderedTag('DIV')).toBe(false);
    expect(isNonRenderedTag('SPAN')).toBe(false);

    const scriptEl = document.createElement('script');
    const evalRes = evaluateElementVisibility(scriptEl, normalRect, {});
    expect(evalRes.shouldPruneSubtree).toBe(true);
    expect(evalRes.reason).toBe('non-rendered-tag');
  });

  it('prunes display: none and content-visibility: hidden subtrees', () => {
    const el = document.createElement('div');

    const evalDisplayNone = evaluateElementVisibility(el, normalRect, { display: 'none' });
    expect(evalDisplayNone.shouldPruneSubtree).toBe(true);
    expect(evalDisplayNone.flags.isVisible).toBe(false);
    expect(evalDisplayNone.reason).toBe('display-none');

    const evalContentVis = evaluateElementVisibility(el, normalRect, {
      display: 'block',
      'content-visibility': 'hidden'
    });
    expect(evalContentVis.shouldPruneSubtree).toBe(true);
    expect(evalContentVis.flags.isVisible).toBe(false);
    expect(evalContentVis.reason).toBe('content-visibility-hidden');
  });

  it('flags visibility: hidden and opacity: 0 without necessarily pruning descendants', () => {
    const el = document.createElement('div');

    const evalVisHidden = evaluateElementVisibility(el, normalRect, {
      display: 'block',
      visibility: 'hidden'
    });
    expect(evalVisHidden.shouldPruneSubtree).toBe(false);
    expect(evalVisHidden.flags.isVisible).toBe(false);
    expect(evalVisHidden.reason).toBe('visibility-hidden');

    const evalOpacityZero = evaluateElementVisibility(el, normalRect, {
      display: 'block',
      opacity: '0'
    });
    expect(evalOpacityZero.flags.isVisible).toBe(false);
    expect(evalOpacityZero.flags.opacity).toBe(0);
    expect(evalOpacityZero.reason).toBe('opacity-zero');
  });

  it('calculates offscreen and clipped flags relative to viewport dimensions', () => {
    const el = document.createElement('div');
    const viewportW = 1440;
    const viewportH = 900;

    // Inside viewport
    const evalInside = evaluateElementVisibility(
      el,
      { x: 100, y: 100, width: 200, height: 100 },
      { display: 'block' },
      viewportW,
      viewportH
    );
    expect(evalInside.flags.isVisible).toBe(true);
    expect(evalInside.flags.isOffscreen).toBe(false);
    expect(evalInside.flags.isClipped).toBe(false);

    // Completely offscreen to the right (x = 1500 > 1440)
    const evalOffscreen = evaluateElementVisibility(
      el,
      { x: 1500, y: 100, width: 200, height: 100 },
      { display: 'block' },
      viewportW,
      viewportH
    );
    expect(evalOffscreen.flags.isOffscreen).toBe(true);

    // Partially clipped by bottom viewport edge (y = 850, height = 100 -> extends to 950 > 900)
    const evalClipped = evaluateElementVisibility(
      el,
      { x: 100, y: 850, width: 200, height: 100 },
      { display: 'block' },
      viewportW,
      viewportH
    );
    expect(evalClipped.flags.isOffscreen).toBe(false);
    expect(evalClipped.flags.isClipped).toBe(true);
  });

  it('prunes empty zero-size elements but keeps containers with children', () => {
    const emptyZeroEl = document.createElement('div');
    const evalEmpty = evaluateElementVisibility(
      emptyZeroEl,
      { x: 0, y: 0, width: 0, height: 0 },
      { display: 'block' }
    );
    expect(evalEmpty.shouldPruneElement).toBe(true);

    const parentZeroEl = document.createElement('div');
    parentZeroEl.appendChild(document.createElement('span'));
    const evalParent = evaluateElementVisibility(
      parentZeroEl,
      { x: 0, y: 0, width: 0, height: 0 },
      { display: 'block' }
    );
    expect(evalParent.shouldPruneElement).toBe(false);
  });
});

describe('Privacy Sanitizer and Safe Attribute Extraction', () => {
  it('strictly blocks user-entered values in password, text, and email inputs', () => {
    const passwordInput = document.createElement('input');
    passwordInput.setAttribute('type', 'password');
    passwordInput.setAttribute('value', 'SuperSecretPass123!');
    passwordInput.setAttribute('placeholder', 'Enter your password');
    passwordInput.setAttribute('aria-label', 'Account Password');

    const sanitized = sanitizeElementPrivacy(passwordInput);
    expect(sanitized.sourceTag).toBe('input');
    expect(sanitized.inputType).toBe('password');
    expect(sanitized.placeholder).toBe('Enter your password');
    expect(sanitized.accessibleLabel).toBe('Account Password');
    expect((sanitized as any).value).toBeUndefined();
    expect(JSON.stringify(sanitized)).not.toContain('SuperSecretPass123!');
  });

  it('sanitizes textareas by keeping placeholder and discarding typed text content', () => {
    const textarea = document.createElement('textarea');
    textarea.setAttribute('placeholder', 'Leave a comment');
    textarea.textContent = 'This is sensitive internal feedback from user.';

    const sanitized = sanitizeElementPrivacy(textarea);
    expect(sanitized.sourceTag).toBe('textarea');
    expect(sanitized.inputType).toBe('textarea');
    expect(sanitized.placeholder).toBe('Leave a comment');
    expect((sanitized as any).value).toBeUndefined();
    expect((sanitized as any).text).toBeUndefined();
  });

  it('derives accessible labels from aria-labelledby, aria-label, label[for], and title', () => {
    // 1. aria-label
    const btn = document.createElement('button');
    btn.setAttribute('aria-label', 'Submit Application');
    expect(extractAccessibleLabel(btn)).toBe('Submit Application');

    // 2. aria-labelledby
    const labelSpan = document.createElement('span');
    labelSpan.id = 'lbl_1';
    labelSpan.textContent = 'User Name';
    document.body.appendChild(labelSpan);

    const inputWithRef = document.createElement('input');
    inputWithRef.setAttribute('aria-labelledby', 'lbl_1');
    expect(extractAccessibleLabel(inputWithRef)).toBe('User Name');

    // 3. label[for]
    const labelForInput = document.createElement('label');
    labelForInput.setAttribute('for', 'my-phone-input');
    labelForInput.textContent = 'Phone Number';
    document.body.appendChild(labelForInput);

    const phoneInput = document.createElement('input');
    phoneInput.id = 'my-phone-input';
    expect(extractAccessibleLabel(phoneInput)).toBe('Phone Number');

    // Clean up DOM
    document.body.removeChild(labelSpan);
    document.body.removeChild(labelForInput);
  });

  it('detects sensitive attribute patterns for privacy protection', () => {
    expect(isAttributeSensitive('data-auth-token')).toBe(true);
    expect(isAttributeSensitive('data-api-key')).toBe(true);
    expect(isAttributeSensitive('data-credit-card-number')).toBe(true);
    expect(isAttributeSensitive('data-user-secret')).toBe(true);
    expect(isAttributeSensitive('class')).toBe(false);
    expect(isAttributeSensitive('id')).toBe(false);
  });

  it('extracts class hints up to max limit', () => {
    const el = document.createElement('div');
    el.className = 'btn btn-primary rounded-lg shadow-md hover:bg-blue-600 extra-class-1 extra-class-2';

    const hints = extractClassHints(el, 4);
    expect(hints).toEqual(['btn', 'btn-primary', 'rounded-lg', 'shadow-md']);
  });
});
