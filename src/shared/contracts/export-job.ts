/**
 * Canonical ExportJob contract representing the state, configuration,
 * and result manifest of an export session.
 */

export type ExportMode =
  | 'viewport'
  | 'full-page'
  | 'select-element'
  | 'selected-pages'
  | 'odd-pages'
  | 'even-pages'
  | 'entire-site';

export type ExportJobStatus =
  | 'created'
  | 'permission_check'
  | 'injecting'
  | 'capturing'
  | 'processing'
  | 'ready_to_copy'
  | 'copying'
  | 'completed'
  | 'partial'
  | 'failed'
  | 'cancelled';

export interface JobResultManifest {
  pageCount: number;
  totalNodes: number;
  totalAssets: number;
  totalAssetBytes: number;
  clipboardBytes?: number | undefined;
  sceneDocumentId?: string | undefined;
}

export interface ExportJob {
  schemaVersion: number;
  jobId: string;
  createdAt: number;
  updatedAt: number;
  mode: ExportMode;
  startUrl: string;
  selectedRoutes: string[];
  userOptions: Record<string, unknown>;
  status: ExportJobStatus;
  progressPercent: number;
  currentStep: string;
  warnings: string[];
  failures: string[];
  resultManifest?: JobResultManifest | undefined;
}
