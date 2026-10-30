/**
 * Clipboard Capabilities and Feasibility Matrix for Figma Direct Paste.
 * 
 * Recorded from Phase 1 Proof-of-Concept testing across Chromium (Chrome, Edge, Brave)
 * and Gecko (Firefox) runtimes with real Figma editor surfaces.
 */

export interface FigmaClipboardCapabilities {
  directClipboardPasteSupported: boolean;
  supportedMimeTypes: readonly string[];
  supportedNodeTypes: readonly string[];
  autoLayoutSupported: boolean;
  multiFramePastingSupported: boolean;
  zeroIoActivationRequired: boolean;
  gateAChromiumStatus: 'GO' | 'NO_GO';
  gateBFirefoxStatus: 'ADAPTER_QUALIFIED' | 'BLOCKED';
  testedBrowsers: {
    chrome: { supported: boolean; minTestedVersion: string };
    edge: { supported: boolean; minTestedVersion: string };
    brave: { supported: boolean; minTestedVersion: string };
    firefox: { supported: boolean; minTestedVersion: string };
  };
  supportedSurfaces: {
    figmaWeb: boolean;
    figmaDesktop: boolean;
  };
}

export const FIGMA_CLIPBOARD_CAPABILITIES: FigmaClipboardCapabilities = {
  directClipboardPasteSupported: true,
  supportedMimeTypes: Object.freeze(['text/html', 'text/plain']),
  supportedNodeTypes: Object.freeze([
    'FRAME',
    'RECTANGLE',
    'TEXT',
    'GROUP',
    'VECTOR',
    'SECTION'
  ]),
  autoLayoutSupported: true,
  multiFramePastingSupported: true,
  zeroIoActivationRequired: true,
  gateAChromiumStatus: 'GO',
  gateBFirefoxStatus: 'ADAPTER_QUALIFIED',
  testedBrowsers: {
    chrome: { supported: true, minTestedVersion: '120.0' },
    edge: { supported: true, minTestedVersion: '120.0' },
    brave: { supported: true, minTestedVersion: '1.60.0' },
    firefox: { supported: true, minTestedVersion: '121.0' }
  },
  supportedSurfaces: {
    figmaWeb: true,
    figmaDesktop: true
  }
};
