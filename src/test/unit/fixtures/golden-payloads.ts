/**
 * Golden reference payloads and constraints for automated test verification.
 */

export const GOLDEN_PAYLOAD_CONSTRAINTS = {
  magicHeader: 'fig-kiwi',
  wireVersion: 15,
  fixtures: {
    'minimal-frame': {
      expectedNodeCount: 1,
      minBinaryBytes: 500,
      maxBinaryBytes: 1200,
      expectedName: 'Desktop - Minimal 1440x900',
      expectedWidth: 1440,
      expectedHeight: 900
    },
    'nested-card': {
      expectedNodeCount: 7,
      minBinaryBytes: 700,
      maxBinaryBytes: 2500,
      expectedRootName: 'Component Card Demo',
      expectedTextSnippet: 'Web to Figma Exporter'
    },
    'sibling-frames': {
      expectedNodeCount: 4,
      minBinaryBytes: 600,
      maxBinaryBytes: 2000,
      frame1X: 0,
      frame2X: 1540,
      frameWidth: 1440,
      gutter: 100
    },
    'auto-layout-box': {
      expectedNodeCount: 4,
      minBinaryBytes: 600,
      maxBinaryBytes: 2000,
      expectedLayoutMode: 1, // HORIZONTAL
      expectedItemSpacing: 12
    }
  }
};
