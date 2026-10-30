import type { FigmaMessage } from '../figma-types';

/**
 * Fixture 4: Auto Layout container with horizontal flex, gap, padding,
 * and 3 chip/tag child elements.
 */
export const autoLayoutBoxFixture: FigmaMessage = {
  sessionIDs: [0],
  nodeChanges: [
    // 1. Auto Layout Flex Container
    {
      guid: { sessionID: 0, localID: 1 },
      type: 'FRAME',
      name: 'Tags Auto-Layout Bar',
      visible: true,
      parentIndex: { guid: { sessionID: 0, localID: 0 }, position: 0 },
      transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 },
      size: { x: 480, y: 80 },
      layoutMode: 1, // HORIZONTAL
      primaryAxisAlignItems: 0, // MIN
      counterAxisAlignItems: 1, // CENTER
      itemSpacing: 12,
      paddingTop: 16,
      paddingRight: 20,
      paddingBottom: 16,
      paddingLeft: 20,
      backgroundColor: { r: 1, g: 1, b: 1, a: 1 },
      fillPaints: [
        {
          type: 'SOLID',
          color: { r: 1, g: 1, b: 1, a: 1 },
          opacity: 1,
          visible: true
        }
      ],
      strokePaints: [
        {
          type: 'SOLID',
          color: { r: 0.9, g: 0.92, b: 0.95, a: 1 },
          opacity: 1,
          visible: true
        }
      ],
      strokeWeight: 1,
      cornerRadius: 12,
      clipsContent: true
    },
    // 2. Chip 1
    {
      guid: { sessionID: 0, localID: 2 },
      type: 'FRAME',
      name: 'Chip - Fast',
      visible: true,
      parentIndex: { guid: { sessionID: 0, localID: 1 }, position: 1 },
      transform: { m00: 1, m01: 0, m02: 20, m10: 0, m11: 1, m12: 24 },
      size: { x: 80, y: 32 },
      backgroundColor: { r: 0.9, g: 0.96, b: 0.9, a: 1 },
      fillPaints: [
        {
          type: 'SOLID',
          color: { r: 0.9, g: 0.96, b: 0.9, a: 1 },
          opacity: 1,
          visible: true
        }
      ],
      strokePaints: [],
      strokeWeight: 0,
      cornerRadius: 16
    },
    // 3. Chip 2
    {
      guid: { sessionID: 0, localID: 3 },
      type: 'FRAME',
      name: 'Chip - Secure',
      visible: true,
      parentIndex: { guid: { sessionID: 0, localID: 1 }, position: 2 },
      transform: { m00: 1, m01: 0, m02: 112, m10: 0, m11: 1, m12: 24 },
      size: { x: 92, y: 32 },
      backgroundColor: { r: 0.9, g: 0.93, b: 1, a: 1 },
      fillPaints: [
        {
          type: 'SOLID',
          color: { r: 0.9, g: 0.93, b: 1, a: 1 },
          opacity: 1,
          visible: true
        }
      ],
      strokePaints: [],
      strokeWeight: 0,
      cornerRadius: 16
    },
    // 4. Chip 3
    {
      guid: { sessionID: 0, localID: 4 },
      type: 'FRAME',
      name: 'Chip - Local',
      visible: true,
      parentIndex: { guid: { sessionID: 0, localID: 1 }, position: 3 },
      transform: { m00: 1, m01: 0, m02: 216, m10: 0, m11: 1, m12: 24 },
      size: { x: 86, y: 32 },
      backgroundColor: { r: 0.98, g: 0.92, b: 0.9, a: 1 },
      fillPaints: [
        {
          type: 'SOLID',
          color: { r: 0.98, g: 0.92, b: 0.9, a: 1 },
          opacity: 1,
          visible: true
        }
      ],
      strokePaints: [],
      strokeWeight: 0,
      cornerRadius: 16
    }
  ]
};
