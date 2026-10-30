/**
 * URL normalization, same-site verification, and tracking parameter pruning.
 */

export interface UrlNormalizeOptions {
  baseUrl: string;
  includeHashRoutes?: boolean | undefined;
  allowSubdomains?: boolean | undefined;
  customTrackingParams?: string[] | undefined;
}

export interface NormalizedUrlResult {
  isValid: boolean;
  rawUrl: string;
  canonicalUrl?: string | undefined;
  pathname?: string | undefined;
  search?: string | undefined;
  hash?: string | undefined;
  isSameOrigin: boolean;
  isSameSite: boolean;
  isDownloadFile: boolean;
  rejectionReason?: string | undefined;
}

/**
 * Standard tracking query parameters stripped during canonical URL normalization.
 * Meaningful parameters (id, page, category, slug, etc.) are strictly preserved.
 */
export const DEFAULT_TRACKING_PARAMS: ReadonlySet<string> = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'utm_id',
  'utm_name',
  'utm_reader',
  'fbclid',
  'gclid',
  'gclsrc',
  'dclid',
  'wbraid',
  'gbraid',
  'mc_eid',
  'mc_cid',
  'igshid',
  '_ga',
  '_gl',
  'msclkid',
  'yclid',
  'twclid'
]);

/**
 * File extensions representing binary/download assets that are not web pages.
 */
export const DOWNLOAD_EXTENSIONS: ReadonlySet<string> = new Set([
  'pdf',
  'zip',
  'tar',
  'gz',
  'tgz',
  '7z',
  'rar',
  'bz2',
  'exe',
  'dmg',
  'pkg',
  'deb',
  'rpm',
  'apk',
  'iso',
  'bin',
  'msi',
  'csv',
  'tsv',
  'xlsx',
  'xls',
  'docx',
  'doc',
  'pptx',
  'ppt',
  'mp4',
  'mp3',
  'wav',
  'avi',
  'mov',
  'flac',
  'ogg',
  'webm',
  'mkv'
]);

/**
 * Disallowed URL protocol schemes.
 */
const DISALLOWED_SCHEMES: ReadonlySet<string> = new Set([
  'mailto:',
  'tel:',
  'javascript:',
  'data:',
  'blob:',
  'chrome:',
  'edge:',
  'about:',
  'moz-extension:',
  'chrome-extension:',
  'file:',
  'ftp:'
]);

/**
 * Safely parses and normalizes a candidate URL against the site base URL.
 */
export function normalizeCandidateUrl(
  rawUrl: string,
  options: UrlNormalizeOptions
): NormalizedUrlResult {
  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed === '#' || trimmed.startsWith('#')) {
    return {
      isValid: false,
      rawUrl,
      isSameOrigin: false,
      isSameSite: false,
      isDownloadFile: false,
      rejectionReason: 'Empty or fragment-only link'
    };
  }

  // Fast check for disallowed pseudo-protocols
  const lowerTrimmed = trimmed.toLowerCase();
  for (const scheme of DISALLOWED_SCHEMES) {
    if (lowerTrimmed.startsWith(scheme)) {
      return {
        isValid: false,
        rawUrl,
        isSameOrigin: false,
        isSameSite: false,
        isDownloadFile: false,
        rejectionReason: `Disallowed scheme: ${scheme}`
      };
    }
  }

  let baseUrlParsed: URL;
  try {
    baseUrlParsed = new URL(options.baseUrl);
  } catch {
    return {
      isValid: false,
      rawUrl,
      isSameOrigin: false,
      isSameSite: false,
      isDownloadFile: false,
      rejectionReason: `Invalid base URL: ${options.baseUrl}`
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed, baseUrlParsed.href);
  } catch {
    return {
      isValid: false,
      rawUrl,
      isSameOrigin: false,
      isSameSite: false,
      isDownloadFile: false,
      rejectionReason: 'Malformed URL'
    };
  }

  // Only http and https protocols are supported
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return {
      isValid: false,
      rawUrl,
      isSameOrigin: false,
      isSameSite: false,
      isDownloadFile: false,
      rejectionReason: `Unsupported protocol: ${parsed.protocol}`
    };
  }

  const baseHostname = baseUrlParsed.hostname.toLowerCase();
  const targetHostname = parsed.hostname.toLowerCase();

  const isSameOrigin =
    parsed.protocol === baseUrlParsed.protocol &&
    targetHostname === baseHostname &&
    parsed.port === baseUrlParsed.port;

  // Robust same-site / subdomain check: never use naive endsWith()
  const isSameSite = checkSameSite(targetHostname, baseHostname, Boolean(options.allowSubdomains));

  if (!isSameSite) {
    return {
      isValid: false,
      rawUrl,
      isSameOrigin,
      isSameSite: false,
      isDownloadFile: false,
      rejectionReason: 'External origin / outside allowed site scope'
    };
  }

  // Check for download file extensions
  const lastPathSegment = parsed.pathname.split('/').filter(Boolean).pop() ?? '';
  const dotIndex = lastPathSegment.lastIndexOf('.');
  let isDownloadFile = false;
  if (dotIndex > 0) {
    const ext = lastPathSegment.slice(dotIndex + 1).toLowerCase();
    if (DOWNLOAD_EXTENSIONS.has(ext)) {
      isDownloadFile = true;
      return {
        isValid: false,
        rawUrl,
        isSameOrigin,
        isSameSite: true,
        isDownloadFile: true,
        rejectionReason: `File download extension: .${ext}`
      };
    }
  }

  // Path normalization: normalize trailing slashes on non-root paths without extension
  let normalizedPathname = parsed.pathname;
  if (!normalizedPathname) {
    normalizedPathname = '/';
  } else if (normalizedPathname.length > 1 && normalizedPathname.endsWith('/')) {
    normalizedPathname = normalizedPathname.slice(0, -1);
  }

  // Hash handling: strip unless hash routes are explicitly enabled and present
  let normalizedHash = '';
  if (options.includeHashRoutes && parsed.hash) {
    const hash = parsed.hash.trim();
    if (hash.startsWith('#/') || hash.startsWith('#!/')) {
      normalizedHash = hash;
      // In hash-routing mode, ensure a separating slash precedes the hash route if not at root
      if (!normalizedPathname.endsWith('/')) {
        normalizedPathname += '/';
      }
    }
  }

  // Query parameter normalization: strip tracking parameters, sort remaining deterministically
  const trackingSet = options.customTrackingParams
    ? new Set([...DEFAULT_TRACKING_PARAMS, ...options.customTrackingParams.map((p) => p.toLowerCase())])
    : DEFAULT_TRACKING_PARAMS;

  const searchParams = new URLSearchParams(parsed.search);
  const keysToRemove: string[] = [];
  for (const key of searchParams.keys()) {
    if (trackingSet.has(key.toLowerCase())) {
      keysToRemove.push(key);
    }
  }
  for (const key of keysToRemove) {
    searchParams.delete(key);
  }

  // Sort query parameters alphabetically by key
  searchParams.sort();
  const normalizedSearch = searchParams.toString() ? `?${searchParams.toString()}` : '';

  // Port normalization: omit default ports
  let portPart = '';
  if (
    parsed.port &&
    !(parsed.protocol === 'http:' && parsed.port === '80') &&
    !(parsed.protocol === 'https:' && parsed.port === '443')
  ) {
    portPart = `:${parsed.port}`;
  }

  const canonicalUrl = `${parsed.protocol}//${targetHostname}${portPart}${normalizedPathname}${normalizedSearch}${normalizedHash}`;

  return {
    isValid: true,
    rawUrl,
    canonicalUrl,
    pathname: normalizedPathname,
    search: normalizedSearch || undefined,
    hash: normalizedHash || undefined,
    isSameOrigin,
    isSameSite: true,
    isDownloadFile: false
  };
}

/**
 * Checks whether targetHostname belongs to the same site/domain as baseHostname.
 * Rejects suffix spoofing (e.g. `example.com.evil.test`).
 */
export function checkSameSite(
  targetHostname: string,
  baseHostname: string,
  allowSubdomains: boolean
): boolean {
  if (targetHostname === baseHostname) {
    return true;
  }

  if (!allowSubdomains) {
    return false;
  }

  // Valid subdomain check: target must end with '.' + baseHostname
  // (e.g. `blog.example.com` ends with `.example.com`)
  if (targetHostname.endsWith(`.${baseHostname}`)) {
    return true;
  }

  // Also support base being a subdomain of target or shared apex domain
  const baseParts = baseHostname.split('.');
  const targetParts = targetHostname.split('.');

  // If both share the same registrable apex domain (e.g. sub1.example.com and sub2.example.com)
  if (baseParts.length >= 2 && targetParts.length >= 2) {
    const baseApex = getApexDomain(baseHostname);
    const targetApex = getApexDomain(targetHostname);
    if (baseApex && targetApex && baseApex === targetApex) {
      return true;
    }
  }

  return false;
}

/**
 * Returns the estimated apex domain for standard two-segment or known multi-part TLDs.
 */
function getApexDomain(hostname: string): string {
  const parts = hostname.split('.');
  if (parts.length <= 2) {
    return hostname;
  }

  // Common second-level domains: co.uk, com.au, co.jp, org.uk, gov.uk, etc.
  const secondToLast = parts[parts.length - 2] ?? '';
  const last = parts[parts.length - 1] ?? '';
  const isCctldSecondLevel =
    (secondToLast === 'co' ||
      secondToLast === 'com' ||
      secondToLast === 'org' ||
      secondToLast === 'gov' ||
      secondToLast === 'net' ||
      secondToLast === 'edu') &&
    last.length === 2;

  if (isCctldSecondLevel && parts.length >= 3) {
    return parts.slice(-3).join('.');
  }

  return parts.slice(-2).join('.');
}
