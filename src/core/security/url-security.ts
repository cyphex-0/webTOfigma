/**
 * URL Security and Navigation Boundary Validator.
 * 
 * Enforces strict URL scheme and network safety policies:
 * - Only permits standard 'http:' and 'https:' schemes.
 * - Rejects dangerous protocols: chrome:, chrome-extension:, about:, file:,
 *   javascript:, data:, blob:, view-source:.
 * - Blocks cloud instance metadata endpoints (169.254.169.254) and SSRF targets.
 * - Verifies origin adherence before and after redirects.
 * - Detects protocol downgrade (https -> http).
 */

const BLOCKED_SCHEMES: ReadonlySet<string> = new Set([
  'chrome:',
  'chrome-extension:',
  'moz-extension:',
  'about:',
  'file:',
  'javascript:',
  'data:',
  'blob:',
  'view-source:',
  'vbscript:'
]);

// Cloud metadata IP addresses commonly targeted in SSRF attacks
const METADATA_IP_ADDRESSES: ReadonlySet<string> = new Set([
  '169.254.169.254',
  '169.254.170.2',
  'metadata.google.internal',
  'metadata'
]);

export interface UrlSecurityValidationResult {
  isValid: boolean;
  sanitizedUrl: string | null;
  reason?: string | undefined;
  isPrivateNetwork?: boolean | undefined;
}

/**
 * Checks if a hostname corresponds to loopback or private IPv4 address.
 */
export function isPrivateOrLoopbackHost(hostname: string): boolean {
  const cleanHost = hostname.toLowerCase().trim();

  if (cleanHost === 'localhost' || cleanHost === '127.0.0.1' || cleanHost === '::1') {
    return true;
  }

  // IPv4 regex check
  const ipv4Match = cleanHost.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const octet1 = Number(ipv4Match[1]);
    const octet2 = Number(ipv4Match[2]);

    // 10.0.0.0/8
    if (octet1 === 10) return true;
    // 172.16.0.0/12 (172.16 - 172.31)
    if (octet1 === 172 && octet2 >= 16 && octet2 <= 31) return true;
    // 192.168.0.0/16
    if (octet1 === 192 && octet2 === 168) return true;
    // 127.0.0.0/8
    if (octet1 === 127) return true;
    // 169.254.0.0/16 (Link-local / cloud metadata)
    if (octet1 === 169 && octet2 === 254) return true;
    // 0.0.0.0
    if (octet1 === 0) return true;
  }

  return false;
}

/**
 * Validates a target URL before crawler navigation, asset fetch, or sitemap retrieval.
 */
export function validateTargetUrl(
  inputUrl: string,
  options: {
    allowPrivateNetwork?: boolean | undefined;
    expectedOrigin?: string | undefined;
  } = {}
): UrlSecurityValidationResult {
  const allowPrivate = options.allowPrivateNetwork ?? false;

  let parsed: URL;
  try {
    parsed = new URL(inputUrl);
  } catch {
    return {
      isValid: false,
      sanitizedUrl: null,
      reason: 'Malformed URL format.'
    };
  }

  const protocol = parsed.protocol.toLowerCase();

  // 1. Block dangerous or browser-internal schemes
  if (BLOCKED_SCHEMES.has(protocol) || (protocol !== 'http:' && protocol !== 'https:')) {
    return {
      isValid: false,
      sanitizedUrl: null,
      reason: `Blocked URL protocol '${protocol}'. Only 'http:' and 'https:' are permitted.`
    };
  }

  const hostname = parsed.hostname.toLowerCase();

  // 2. Block cloud metadata endpoints
  if (METADATA_IP_ADDRESSES.has(hostname)) {
    return {
      isValid: false,
      sanitizedUrl: null,
      reason: `Blocked target host '${hostname}' (cloud metadata endpoint prohibited).`
    };
  }

  // 3. Private network check
  const isPrivate = isPrivateOrLoopbackHost(hostname);
  if (isPrivate && !allowPrivate) {
    return {
      isValid: false,
      sanitizedUrl: null,
      isPrivateNetwork: true,
      reason: `Target host '${hostname}' is a private/loopback network address. Enable private network access in settings to crawl local development sites.`
    };
  }

  // 4. Expected Origin validation (e.g. following redirects)
  if (options.expectedOrigin) {
    try {
      const expected = new URL(options.expectedOrigin);
      // Disallow protocol downgrade (https -> http)
      if (expected.protocol === 'https:' && parsed.protocol === 'http:') {
        return {
          isValid: false,
          sanitizedUrl: null,
          reason: `Insecure protocol downgrade detected: redirect from '${expected.protocol}' to '${parsed.protocol}' is prohibited.`
        };
      }

      if (parsed.origin !== expected.origin) {
        return {
          isValid: false,
          sanitizedUrl: null,
          reason: `Redirect to cross-origin '${parsed.origin}' outside of original crawl scope '${expected.origin}'.`
        };
      }
    } catch {
      // Ignore origin parse error
    }
  }

  return {
    isValid: true,
    sanitizedUrl: parsed.href,
    isPrivateNetwork: isPrivate
  };
}
