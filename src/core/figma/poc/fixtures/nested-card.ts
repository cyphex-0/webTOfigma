import type { FigmaMessage } from '../figma-types';

/**
 * Fixture 2: Nested hierarchy containing:
 * - Root Canvas Frame (800x600)
 *   - Card Frame (400x340)
 *     - Banner Rectangle (360x140)
 *     - Title Text ("Web to Figma Exporter")
 *     - Subtitle Text ("Native editable clipboard layers proof of concept")
 *     - Action Button Frame (130x38)
 *       - Button Label Text ("Export Now")
 */
export const nestedCardFixture: FigmaMessage = {
  sessionIDs: [0],
  nodeChanges: [
    // 1. Root Frame
    {
      guid: { sessionID: 0, localID: 1 },
      type: 'FRAME',
      name: 'Component Card Demo',
      visible: true,
      parentIndex: { guid: { sessionID: 0, localID: 0 }, position: 0 },
      transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 },
      size: { x: 800, y: 600 },
      backgroundColor: { r: 0.95, g: 0.96, b: 0.98, a: 1 },
      fillPaints: [
        {
          type: 'SOLID',
          color: { r: 0.95, g: 0.96, b: 0.98, a: 1 },
          opacity: 1,
          visible: true
        }
      ],
      strokePaints: [],
      strokeWeight: 0,
      cornerRadius: 0,
      clipsContent: true
    },
    // 2. Card Container (child of Root Frame)
    {
      guid: { sessionID: 0, localID: 2 },
      type: 'FRAME',
      name: 'Card Container',
      visible: true,
      parentIndex: { guid: { sessionID: 0, localID: 1 }, position: 1 },
      transform: { m00: 1, m01: 0, m02: 40, m10: 0, m11: 1, m12: 40 },
      size: { x: 400, y: 340 },
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
          color: { r: 0.88, g: 0.91, b: 0.94, a: 1 },
          opacity: 1,
          visible: true
        }
      ],
      strokeWeight: 1,
      cornerRadius: 12,
      clipsContent: true
    },
    // 3. Banner Image / Color Block (child of Card Container)
    {
      guid: { sessionID: 0, localID: 3 },
      type: 'RECTANGLE',
      name: 'Hero Thumbnail Block',
      visible: true,
      parentIndex: { guid: { sessionID: 0, localID: 2 }, position: 1 },
      transform: { m00: 1, m01: 0, m02: 20, m10: 0, m11: 1, m12: 20 },
      size: { x: 360, y: 140 },
      fillPaints: [
        {
          type: 'SOLID',
          color: { r: 0.15, g: 0.45, b: 0.95, a: 1 }, // Vibrant Blue
          opacity: 1,
          visible: true
        }
      ],
      strokePaints: [],
      strokeWeight: 0,
      cornerRadius: 8
    },
    // 4. Card Title Text (child of Card Container)
    {
      guid: { sessionID: 0, localID: 4 },
      type: 'TEXT',
      name: 'Title Text Layer',
      visible: true,
      parentIndex: { guid: { sessionID: 0, localID: 2 }, position: 2 },
      transform: { m00: 1, m01: 0, m02: 20, m10: 0, m11: 1, m12: 176 },
      size: { x: 360, y: 28 },
      rawText: 'Web to Figma Exporter',
      fontSize: 20,
      fontWeight: 700,
      fontFamily: 'Inter',
      fillPaints: [
        {
          type: 'SOLID',
          color: { r: 0.06, g: 0.09, b: 0.16, a: 1 },
          opacity: 1,
          visible: true
        }
      ]
    },
    // 5. Card Subtitle Text (child of Card Container)
    {
      guid: { sessionID: 0, localID: 5 },
      type: 'TEXT',
      name: 'Subtitle Text Layer',
      visible: true,
      parentIndex: { guid: { sessionID: 0, localID: 2 }, position: 3 },
      transform: { m00: 1, m01: 0, m02: 20, m10: 0, m11: 1, m12: 210 },
      size: { x: 360, y: 20 },
      rawText: 'Native editable clipboard layers proof of concept',
      fontSize: 14,
      fontWeight: 400,
      fontFamily: 'Inter',
      fillPaints: [
        {
          type: 'SOLID',
          color: { r: 0.39, g: 0.45, b: 0.55, a: 1 },
          opacity: 1,
          visible: true
        }
      ]
    },
    // 6. Action Button Frame (child of Card Container)
    {
      guid: { sessionID: 0, localID: 6 },
      type: 'FRAME',
      name: 'Primary Button',
      visible: true,
      parentIndex: { guid: { sessionID: 0, localID: 2 }, position: 4 },
      transform: { m00: 1, m01: 0, m02: 20, m10: 0, m11: 1, m12: 260 },
      size: { x: 130, y: 38 },
      backgroundColor: { r: 0.15, g: 0.45, b: 0.95, a: 1 },
      fillPaints: [
        {
          type: 'SOLID',
          color: { r: 0.15, g: 0.45, b: 0.95, a: 1 },
          opacity: 1,
          visible: true
        }
      ],
      strokePaints: [],
      strokeWeight: 0,
      cornerRadius: 6,
      clipsContent: true
    },
    // 7. Button Label Text (child of Action Button Frame)
    {
      guid: { sessionID: 0, localID: 7 },
      type: 'TEXT',
      name: 'Button Label',
      visible: true,
      parentIndex: { guid: { sessionID: 0, localID: 6 }, position: 1 },
      transform: { m00: 1, m01: 0, m02: 24, m10: 0, m11: 1, m12: 10 },
      size: { x: 82, y: 18 },
      rawText: 'Export Now',
      fontSize: 14,
      fontWeight: 600,
      fontFamily: 'Inter',
      fillPaints: [
        {
          type: 'SOLID',
          color: { r: 1, g: 1, b: 1, a: 1 },
          opacity: 1,
          visible: true
        }
      ]
    }
  ]
};
