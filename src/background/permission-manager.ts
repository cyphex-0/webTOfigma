/**
 * Permission Manager for Web-to-Figma Extension.
 * Enforces least-privilege architecture: requests optional host permissions strictly
 * on-demand upon explicit user gesture (e.g. initiating a multi-page crawl).
 */

import { browser } from '../shared/browser/browser-api';
import { PermissionDeniedError } from '../shared/errors/extension-errors';

/**
 * Converts a URL or origin into a canonical WebExtension origin pattern.
 * e.g., "https://example.com/sub/page" -> "https://example.com/*"
 */
export function normalizeOriginPattern(urlOrOrigin: string): string {
  try {
    const parsed = new URL(urlOrOrigin);
    return `${parsed.protocol}//${parsed.hostname}${parsed.port ? `:${parsed.port}` : ''}/*`;
  } catch {
    // If already in pattern format
    if (urlOrOrigin.endsWith('/*')) {
      return urlOrOrigin;
    }
    return `${urlOrOrigin}/*`;
  }
}

/**
 * Checks whether optional host permission is already granted for the specified origin.
 */
export async function hasOriginPermission(urlOrOrigin: string): Promise<boolean> {
  const pattern = normalizeOriginPattern(urlOrOrigin);
  try {
    return await browser.permissions.contains({
      origins: [pattern]
    });
  } catch {
    return false;
  }
}

/**
 * Requests optional host permission for an origin with a documented user reason.
 * MUST be invoked directly from a user action/click in the popup or extension document.
 */
export async function requestOriginPermission(
  urlOrOrigin: string,
  userReason: string
): Promise<boolean> {
  const pattern = normalizeOriginPattern(urlOrOrigin);

  try {
    const granted = await browser.permissions.request({
      origins: [pattern]
    });

    if (!granted) {
      throw new PermissionDeniedError(pattern, userReason);
    }
    return true;
  } catch (err: unknown) {
    if (err instanceof PermissionDeniedError) {
      throw err;
    }
    throw new PermissionDeniedError(pattern, userReason);
  }
}

/**
 * Revokes optional host permission for an origin when no longer needed.
 */
export async function removeOriginPermission(urlOrOrigin: string): Promise<boolean> {
  const pattern = normalizeOriginPattern(urlOrOrigin);
  try {
    return await browser.permissions.remove({
      origins: [pattern]
    });
  } catch {
    return false;
  }
}

/**
 * Returns all currently granted optional host origins.
 */
export async function getAllGrantedOrigins(): Promise<string[]> {
  try {
    const permissions = await browser.permissions.getAll();
    return permissions.origins ?? [];
  } catch {
    return [];
  }
}
