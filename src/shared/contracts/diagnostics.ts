/**
 * Diagnostic and error reporting contracts.
 */

export type DiagnosticSeverity = 'info' | 'warning' | 'error' | 'fatal';

export type DiagnosticPhase =
  | 'dom-extraction'
  | 'asset-fetch'
  | 'style-resolution'
  | 'layout-computation'
  | 'scene-conversion'
  | 'clipboard-serialization';

export interface ExportDiagnostic {
  severity: DiagnosticSeverity;
  code: string;
  message: string;
  phase: DiagnosticPhase;
  pageUrl?: string | undefined;
  nodeId?: string | undefined;
  assetUrl?: string | undefined;
  recoveryAction?: string | undefined;
  timestamp: number;
}
