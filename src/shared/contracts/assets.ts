/**
 * Asset contracts representing captured images, icons, web fonts, and backgrounds.
 */

export type AssetKind =
  | 'image-bitmap'
  | 'image-svg'
  | 'font-woff2'
  | 'font-ttf'
  | 'css-background'
  | 'canvas';

export type FetchState = 'pending' | 'fetched' | 'cached' | 'failed' | 'skipped';

export type EmbeddingState = 'embedded-base64' | 'blob-reference' | 'external-url' | 'omitted';

export interface AssetRecord {
  assetId: string;
  url: string;
  kind: AssetKind;
  mimeType: string;
  byteLength: number;
  contentHash: string;
  dimensions?: {
    width: number;
    height: number;
  } | undefined;
  fetchState: FetchState;
  embeddingState: EmbeddingState;
  diagnostic?: string | undefined;
  blobRef?: string | undefined;
}
