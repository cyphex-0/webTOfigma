/**
 * Centralized Hard Safety Limits for Web-to-Figma Exporter.
 * Guards browser memory, extension worker timeouts, and clipboard constraints.
 */

export const SAFETY_LIMITS = {
  MAX_PAGES_PER_CRAWL: 50,
  MAX_NODES_PER_PAGE: 15_000,
  MAX_ASSET_BYTES_PER_FILE: 25 * 1024 * 1024, // 25 MB
  MAX_TOTAL_ASSET_BYTES_PER_JOB: 150 * 1024 * 1024, // 150 MB
  SNAPSHOT_CHUNK_SIZE_BYTES: 64 * 1024, // 64 KB
  MAX_CAPTURE_DURATION_MS: 10 * 60 * 1000, // 10 minutes
  MAX_SERIALIZED_CLIPBOARD_BYTES: 50 * 1024 * 1024, // 50 MB
  STALE_JOB_THRESHOLD_MS: 5 * 60 * 1000, // 5 minutes
  IN_MEMORY_STORAGE_MAX_BYTES: 100 * 1024 * 1024 // 100 MB fallback buffer
} as const;
