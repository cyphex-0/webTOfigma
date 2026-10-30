import type { FigmaMessage } from '../figma-types';

/**
 * Fixture 3: Two distinct sibling page frames pasted in a single operation.
 * Placed side-by-side with a 100px gutter without overlap:
 * - Frame 1: Page 1 - Home (1440x900 at x=0, y=0)
 * - Frame 2: Page 2 - Pricing (1440x900 at x=1540, y=0)
 */
export const siblingFramesFixture: FigmaMessage = {
  sessionIDs: [0],
  nodeChanges: [
    // Page 1: Home Frame
    {
      guid: { sessionID: 0, localID: 1 },
      type: 'FRAME',
      name: 'Page 1 - Home',
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
    },
    // Page 1 Header Text
    {
      guid: { sessionID: 0, localID: 2 },
      type: 'TEXT',
      name: 'Home Heading',
      visible: true,
      parentIndex: { guid: { sessionID: 0, localID: 1 }, position: 1 },
      transform: { m00: 1, m01: 0, m02: 80, m10: 0, m11: 1, m12: 80 },
      size: { x: 600, y: 48 },
      rawText: 'Welcome to Homepage',
      fontSize: 36,
      fontWeight: 700,
      fontFamily: 'Inter',
      fillPaints: [
        {
          type: 'SOLID',
          color: { r: 0.1, g: 0.1, b: 0.1, a: 1 },
          opacity: 1,
          visible: true
        }
      ]
    },
    // Page 2: Pricing Frame (offset by 1440 + 100 = 1540px)
    {
      guid: { sessionID: 0, localID: 3 },
      type: 'FRAME',
      name: 'Page 2 - Pricing',
      visible: true,
      parentIndex: { guid: { sessionID: 0, localID: 0 }, position: 1 },
      transform: { m00: 1, m01: 0, m02: 1540, m10: 0, m11: 1, m12: 0 },
      size: { x: 1440, y: 900 },
      backgroundColor: { r: 0.98, g: 0.99, b: 1, a: 1 },
      fillPaints: [
        {
          type: 'SOLID',
          color: { r: 0.98, g: 0.99, b: 1, a: 1 },
          opacity: 1,
          visible: true
        }
      ],
      strokePaints: [],
      strokeWeight: 0,
      cornerRadius: 0,
      clipsContent: true
    },
    // Page 2 Header Text
    {
      guid: { sessionID: 0, localID: 4 },
      type: 'TEXT',
      name: 'Pricing Heading',
      visible: true,
      parentIndex: { guid: { sessionID: 0, localID: 3 }, position: 1 },
      transform: { m00: 1, m01: 0, m02: 80, m10: 0, m11: 1, m12: 80 },
      size: { x: 600, y: 48 },
      rawText: 'Flexible Pricing Plans',
      fontSize: 36,
      fontWeight: 700,
      fontFamily: 'Inter',
      fillPaints: [
        {
          type: 'SOLID',
          color: { r: 0.1, g: 0.1, b: 0.1, a: 1 },
          opacity: 1,
          visible: true
        }
      ]
    }
  ]
};
