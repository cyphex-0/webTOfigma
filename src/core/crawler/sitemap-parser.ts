/**
 * Robust XML sitemap parser supporting standard urlset and recursive sitemapindex traversal.
 */

import { normalizeCandidateUrl, UrlNormalizeOptions } from './url-normalizer';

export interface SitemapEntry {
  loc: string;
  canonicalUrl: string;
  lastmod?: string | undefined;
  changefreq?: string | undefined;
  priority?: number | undefined;
  sourceSitemapUrl: string;
}

export interface SitemapDiagnostic {
  code: 'SITEMAP_PARSE_ERROR' | 'SITEMAP_FETCH_ERROR' | 'SITEMAP_DEPTH_EXCEEDED' | 'SITEMAP_MAX_REACHED';
  message: string;
  url: string;
}

export interface SitemapParseResult {
  entries: SitemapEntry[];
  subSitemaps: string[];
  diagnostics: SitemapDiagnostic[];
}

export interface SitemapFetchAndParseOptions {
  baseUrl: string;
  sitemapUrl?: string | undefined;
  maxIndexDepth?: number | undefined; // default 3
  maxSitemaps?: number | undefined;   // default 10
  allowSubdomains?: boolean | undefined;
  fetchFn?: ((url: string) => Promise<string>) | undefined;
}

/**
 * Safely parses XML text representing either a <urlset> or <sitemapindex>.
 */
export function parseSitemapXml(
  xmlContent: string,
  sourceUrl: string,
  normalizeOptions: UrlNormalizeOptions
): SitemapParseResult {
  const entries: SitemapEntry[] = [];
  const subSitemaps: string[] = [];
  const diagnostics: SitemapDiagnostic[] = [];

  let xmlDoc: Document;
  try {
    const parser = new DOMParser();
    xmlDoc = parser.parseFromString(xmlContent, 'text/xml');
  } catch (err) {
    diagnostics.push({
      code: 'SITEMAP_PARSE_ERROR',
      message: `XML DOMParser threw an error: ${String(err)}`,
      url: sourceUrl
    });
    return { entries, subSitemaps, diagnostics };
  }

  // Check for parsererror element in standard XML documents
  const parserErrorNode = xmlDoc.getElementsByTagName('parsererror')[0];
  if (parserErrorNode) {
    diagnostics.push({
      code: 'SITEMAP_PARSE_ERROR',
      message: `Malformed sitemap XML: ${parserErrorNode.textContent?.trim().slice(0, 200) ?? 'unknown syntax error'}`,
      url: sourceUrl
    });
    return { entries, subSitemaps, diagnostics };
  }

  // 1. Process standard <urlset>
  const urlNodes = xmlDoc.getElementsByTagName('url');
  for (let i = 0; i < urlNodes.length; i++) {
    const urlNode = urlNodes[i];
    if (!urlNode) continue;

    const locText = getElementText(urlNode, 'loc');
    if (!locText) continue;

    const norm = normalizeCandidateUrl(locText, normalizeOptions);
    if (!norm.isValid || !norm.canonicalUrl) {
      continue;
    }

    const lastmod = getElementText(urlNode, 'lastmod');
    const changefreq = getElementText(urlNode, 'changefreq');
    const priorityText = getElementText(urlNode, 'priority');
    let priority: number | undefined;
    if (priorityText) {
      const p = parseFloat(priorityText);
      if (!isNaN(p) && p >= 0 && p <= 1.0) {
        priority = p;
      }
    }

    entries.push({
      loc: locText,
      canonicalUrl: norm.canonicalUrl,
      lastmod: lastmod || undefined,
      changefreq: changefreq || undefined,
      priority,
      sourceSitemapUrl: sourceUrl
    });
  }

  // 2. Process <sitemapindex>
  const sitemapNodes = xmlDoc.getElementsByTagName('sitemap');
  for (let i = 0; i < sitemapNodes.length; i++) {
    const sitemapNode = sitemapNodes[i];
    if (!sitemapNode) continue;

    const locText = getElementText(sitemapNode, 'loc');
    if (!locText) continue;

    const norm = normalizeCandidateUrl(locText, normalizeOptions);
    // Allow sitemaps on same site even if they end with .xml
    if (norm.isValid || norm.rejectionReason?.includes('.xml') || (norm.isSameSite && !norm.isDownloadFile)) {
      subSitemaps.push(locText);
    }
  }

  return { entries, subSitemaps, diagnostics };
}

/**
 * Traverses a sitemap (or sitemap index tree) up to bounded depth and maximum sitemap count.
 */
export async function fetchAndParseSitemapTree(
  options: SitemapFetchAndParseOptions
): Promise<SitemapParseResult> {
  const maxDepth = options.maxIndexDepth ?? 3;
  const maxSitemaps = options.maxSitemaps ?? 10;
  const initialUrl = options.sitemapUrl ?? resolveDefaultSitemapUrl(options.baseUrl);

  const normalizeOptions: UrlNormalizeOptions = {
    baseUrl: options.baseUrl,
    allowSubdomains: options.allowSubdomains
  };

  const defaultFetch = async (url: string): Promise<string> => {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/xml, text/xml, */*' }
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }
    return response.text();
  };

  const fetchFn = options.fetchFn ?? defaultFetch;

  const allEntries: SitemapEntry[] = [];
  const allSubSitemaps: string[] = [];
  const allDiagnostics: SitemapDiagnostic[] = [];
  const visited = new Set<string>();

  const queue: Array<{ url: string; depth: number }> = [{ url: initialUrl, depth: 0 }];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;

    if (visited.has(current.url)) {
      continue;
    }

    if (visited.size >= maxSitemaps) {
      allDiagnostics.push({
        code: 'SITEMAP_MAX_REACHED',
        message: `Maximum sitemap count of ${maxSitemaps} reached. Skipping remaining sitemaps.`,
        url: current.url
      });
      break;
    }

    visited.add(current.url);

    let xmlText = '';
    try {
      xmlText = await fetchFn(current.url);
    } catch (err) {
      allDiagnostics.push({
        code: 'SITEMAP_FETCH_ERROR',
        message: `Failed to fetch sitemap from ${current.url}: ${String(err)}`,
        url: current.url
      });
      continue;
    }

    const parsed = parseSitemapXml(xmlText, current.url, normalizeOptions);
    allEntries.push(...parsed.entries);
    allSubSitemaps.push(...parsed.subSitemaps);
    allDiagnostics.push(...parsed.diagnostics);

    // Enqueue sub-sitemaps if within depth cap
    if (current.depth + 1 <= maxDepth) {
      for (const subUrl of parsed.subSitemaps) {
        if (!visited.has(subUrl)) {
          queue.push({ url: subUrl, depth: current.depth + 1 });
        }
      }
    } else if (parsed.subSitemaps.length > 0) {
      allDiagnostics.push({
        code: 'SITEMAP_DEPTH_EXCEEDED',
        message: `Sitemap index recursion depth cap of ${maxDepth} exceeded for child sitemaps.`,
        url: current.url
      });
    }
  }

  return {
    entries: allEntries,
    subSitemaps: allSubSitemaps,
    diagnostics: allDiagnostics
  };
}

function getElementText(parent: Element, tagName: string): string {
  // Support namespaced XML tags (e.g. <sitemap:loc> or default namespace)
  const elements = parent.getElementsByTagName(tagName);
  if (elements.length > 0 && elements[0]?.textContent) {
    return elements[0].textContent.trim();
  }
  // Try localName fallback for namespaced documents
  for (let i = 0; i < parent.children.length; i++) {
    const child = parent.children[i];
    if (child && child.localName?.toLowerCase() === tagName.toLowerCase()) {
      return child.textContent?.trim() ?? '';
    }
  }
  return '';
}

function resolveDefaultSitemapUrl(baseUrl: string): string {
  try {
    const parsed = new URL(baseUrl);
    return `${parsed.protocol}//${parsed.host}/sitemap.xml`;
  } catch {
    return `${baseUrl.replace(/\/+$/, '')}/sitemap.xml`;
  }
}
