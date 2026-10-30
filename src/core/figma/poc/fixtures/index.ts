import type { FigmaMessage } from '../figma-types';
import { minimalFrameFixture } from './minimal-frame';
import { nestedCardFixture } from './nested-card';
import { siblingFramesFixture } from './sibling-frames';
import { autoLayoutBoxFixture } from './auto-layout-box';

export interface FixtureDescriptor {
  id: string;
  title: string;
  description: string;
  fixture: FigmaMessage;
  nodeCount: number;
}

export const POC_FIXTURES: Record<string, FixtureDescriptor> = {
  'minimal-frame': {
    id: 'minimal-frame',
    title: 'Test 1: Minimal Frame (1440x900)',
    description: 'Single top-level artboard frame with 1440x900 dimensions and pure white background.',
    fixture: minimalFrameFixture,
    nodeCount: minimalFrameFixture.nodeChanges.length
  },
  'nested-card': {
    id: 'nested-card',
    title: 'Test 2: Nested Card Hierarchy',
    description: 'Frame containing nested card container, vector rectangle block, editable title/subtitle text, and primary button.',
    fixture: nestedCardFixture,
    nodeCount: nestedCardFixture.nodeChanges.length
  },
  'sibling-frames': {
    id: 'sibling-frames',
    title: 'Test 3: Sibling Page Frames',
    description: 'Two separate full-page frames (Home & Pricing) placed side-by-side without canvas overlap.',
    fixture: siblingFramesFixture,
    nodeCount: siblingFramesFixture.nodeChanges.length
  },
  'auto-layout-box': {
    id: 'auto-layout-box',
    title: 'Test 4: Auto-Layout Flex Container',
    description: 'Horizontal flex container with gap spacing, padding, and nested rounded tag chips.',
    fixture: autoLayoutBoxFixture,
    nodeCount: autoLayoutBoxFixture.nodeChanges.length
  }
};

export { minimalFrameFixture, nestedCardFixture, siblingFramesFixture, autoLayoutBoxFixture };
