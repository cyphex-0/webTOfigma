import type { FigmaMessage } from '../figma-types';

/**
 * Fixture 1: Single clean 1440x900 desktop frame.
 */
export const minimalFrameFixture: FigmaMessage = {
  sessionIDs: [0],
  nodeChanges: [
    {
      guid: { sessionID: 0, localID: 1 },
      type: 'FRAME',
      name: 'Desktop - Minimal 1440x900',
      visible: true,
      parentIndex: { guid: { sessionID: 0, localID: 0 }, position: 0 },
      transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 },
      size: { x: 1440, y: 900 },
      backgroundColor: { r: 1, g: 1, b: 1, a: 1 },
      fillPaints: [
        {
          type: 'SOLID',
          color: { r: 1, g: 1, b: 1, a: 1 },
          opacity: 1,
          visible: true
        }
      ],
      strokePaints: [],
      strokeWeight: 0,
      cornerRadius: 0,
      clipsContent: true
    }
  ]
};
