import { describe, it, expect } from 'vitest';
import {
  serializeFigmaMessage,
  deserializeFigmaMessage,
  getOrCreateCompiledSchema,
  FIGMA_MAGIC_HEADER,
  FIGMA_WIRE_VERSION
} from '../../core/figma/poc/kiwi-serializer';
import {
  formatFigmaClipboardHtml,
  formatFigmaPlainTextFallback,
  parseFigmaClipboardHtml,
  uint8ArrayToBase64,
  base64ToUint8Array
} from '../../core/figma/poc/clipboard-envelope';
import {
  minimalFrameFixture,
  nestedCardFixture,
  siblingFramesFixture,
  autoLayoutBoxFixture,
  POC_FIXTURES
} from '../../core/figma/poc/fixtures';
import { prepareClipboardPayload } from '../../core/figma/poc/clipboard-poc';
import { GOLDEN_PAYLOAD_CONSTRAINTS } from './fixtures/golden-payloads';

describe('Figma Kiwi Serializer & Proof of Concept Suite', () => {
  it('compiles and caches the minimal Figma Kiwi schema', () => {
    const { compiled, binarySchema } = getOrCreateCompiledSchema();
    expect(compiled).toBeDefined();
    expect(binarySchema).toBeInstanceOf(Uint8Array);
    expect(binarySchema.byteLength).toBeGreaterThan(50);
  });

  describe('Binary Container Serialization & Roundtrip', () => {
    it('serializes minimal-frame fixture into valid "fig-kiwi" binary container', async () => {
      const buffer = await serializeFigmaMessage(minimalFrameFixture);
      const constraints = GOLDEN_PAYLOAD_CONSTRAINTS.fixtures['minimal-frame'];

      expect(buffer).toBeInstanceOf(Uint8Array);
      expect(buffer.byteLength).toBeGreaterThanOrEqual(constraints.minBinaryBytes);
      expect(buffer.byteLength).toBeLessThanOrEqual(constraints.maxBinaryBytes);

      // Verify 8-byte magic header
      const magic = new TextDecoder().decode(buffer.subarray(0, 8));
      expect(magic).toBe(FIGMA_MAGIC_HEADER);

      // Verify uint32 LE wire version
      const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
      const version = view.getUint32(8, true);
      expect(version).toBe(FIGMA_WIRE_VERSION);

      // Roundtrip verification
      const deserialized = await deserializeFigmaMessage(buffer);
      expect(deserialized.nodeChanges).toHaveLength(1);
      const root = deserialized.nodeChanges[0]!;
      expect(root.name).toBe(constraints.expectedName);
      expect(root.type).toBe('FRAME');
      expect(root.size.x).toBe(constraints.expectedWidth);
      expect(root.size.y).toBe(constraints.expectedHeight);
      expect(root.fillPaints).toHaveLength(1);
    });

    it('serializes nested-card fixture with intact parent-child hierarchy', async () => {
      const buffer = await serializeFigmaMessage(nestedCardFixture);
      const constraints = GOLDEN_PAYLOAD_CONSTRAINTS.fixtures['nested-card'];

      expect(buffer.byteLength).toBeGreaterThanOrEqual(constraints.minBinaryBytes);
      expect(buffer.byteLength).toBeLessThanOrEqual(constraints.maxBinaryBytes);

      const deserialized = await deserializeFigmaMessage(buffer);
      expect(deserialized.nodeChanges).toHaveLength(constraints.expectedNodeCount);

      // Verify root frame
      const root = deserialized.nodeChanges[0]!;
      expect(root.guid.localID).toBe(1);
      expect(root.name).toBe(constraints.expectedRootName);

      // Verify card container child of root
      const card = deserialized.nodeChanges.find((n) => n.guid.localID === 2);
      expect(card).toBeDefined();
      expect(card!.parentIndex.guid.localID).toBe(1);

      // Verify title text child of card
      const title = deserialized.nodeChanges.find((n) => n.guid.localID === 4);
      expect(title).toBeDefined();
      expect(title!.type).toBe('TEXT');
      expect(title!.rawText).toBe(constraints.expectedTextSnippet);
      expect(title!.parentIndex.guid.localID).toBe(2);

      // Verify button label child of button frame
      const buttonLabel = deserialized.nodeChanges.find((n) => n.guid.localID === 7);
      expect(buttonLabel).toBeDefined();
      expect(buttonLabel!.parentIndex.guid.localID).toBe(6);
      expect(buttonLabel!.rawText).toBe('Export Now');
    });

    it('verifies sibling-frames fixture maintains non-overlapping geometry', async () => {
      const buffer = await serializeFigmaMessage(siblingFramesFixture);
      const constraints = GOLDEN_PAYLOAD_CONSTRAINTS.fixtures['sibling-frames'];

      const deserialized = await deserializeFigmaMessage(buffer);
      expect(deserialized.nodeChanges).toHaveLength(constraints.expectedNodeCount);

      const frame1 = deserialized.nodeChanges.find((n) => n.name === 'Page 1 - Home');
      const frame2 = deserialized.nodeChanges.find((n) => n.name === 'Page 2 - Pricing');

      expect(frame1).toBeDefined();
      expect(frame2).toBeDefined();

      const f1X = frame1!.transform.m02;
      const f2X = frame2!.transform.m02;
      const f1Width = frame1!.size.x;

      expect(f1X).toBe(constraints.frame1X);
      expect(f2X).toBe(constraints.frame2X);
      // Ensure Frame 2 is placed cleanly beyond Frame 1 with gutter
      expect(f2X).toBeGreaterThanOrEqual(f1X + f1Width + constraints.gutter);
    });

    it('serializes auto-layout attributes properly', async () => {
      const buffer = await serializeFigmaMessage(autoLayoutBoxFixture);
      const constraints = GOLDEN_PAYLOAD_CONSTRAINTS.fixtures['auto-layout-box'];

      const deserialized = await deserializeFigmaMessage(buffer);
      const container = deserialized.nodeChanges[0]!;

      expect(container.layoutMode).toBe(constraints.expectedLayoutMode);
      expect(container.itemSpacing).toBe(constraints.expectedItemSpacing);
      expect(container.paddingTop).toBe(16);
      expect(container.paddingLeft).toBe(20);
      expect(container.cornerRadius).toBe(12);
    });
  });

  describe('HTML Clipboard Envelope & MIME Formatting', () => {
    it('wraps binary buffer and metadata into valid Figma HTML comments', async () => {
      const binary = await serializeFigmaMessage(minimalFrameFixture);
      const html = formatFigmaClipboardHtml(binary, {
        fileKey: 'unit-test-key',
        pasteID: 42,
        dataType: 'scene'
      });

      expect(html).toContain('<meta charset="utf-8">');
      expect(html).toContain('<!--(figmeta)');
      expect(html).toContain('<!--(figma)');

      // Parse back
      const parsed = parseFigmaClipboardHtml(html);
      expect(parsed.meta).toEqual({
        fileKey: 'unit-test-key',
        pasteID: 42,
        dataType: 'scene'
      });
      expect(parsed.binary).toBeDefined();
      expect(parsed.binary!.byteLength).toBe(binary.byteLength);

      // Verify deserializing parsed binary
      const roundtripMessage = await deserializeFigmaMessage(parsed.binary!);
      expect(roundtripMessage.nodeChanges).toHaveLength(1);
    });

    it('generates informative plain text fallback', () => {
      const fallback = formatFigmaPlainTextFallback(7, 'Nested Card');
      expect(fallback).toContain('7 node(s)');
      expect(fallback).toContain('Nested Card');
      expect(fallback).toContain('Ctrl+V');
    });

    it('parses legacy or alternative figma comments without parentheses', () => {
      const dummyData = new Uint8Array([1, 2, 3, 4, 5]);
      const base64 = uint8ArrayToBase64(dummyData);
      const legacyHtml = `<span><!--figma-->${base64}<!--/figma--></span>`;

      const parsed = parseFigmaClipboardHtml(legacyHtml);
      expect(parsed.binary).toBeDefined();
      expect(Array.from(parsed.binary!)).toEqual([1, 2, 3, 4, 5]);
    });
  });

  describe('Zero-I/O Precomputation Pipeline', () => {
    it('precomputes complete ClipboardItem for every POC fixture', async () => {
      for (const [id, descriptor] of Object.entries(POC_FIXTURES)) {
        const prepared = await prepareClipboardPayload(id);
        expect(prepared.fixtureId).toBe(id);
        expect(prepared.title).toBe(descriptor.title);
        expect(prepared.nodeCount).toBe(descriptor.nodeCount);
        expect(prepared.binaryBytes).toBeGreaterThan(0);
        expect(prepared.htmlBytes).toBeGreaterThan(0);
        expect(prepared.item).toBeDefined();
        expect(prepared.item.types).toContain('text/html');
        expect(prepared.item.types).toContain('text/plain');

        const htmlBlob = await prepared.item.getType('text/html');
        expect(htmlBlob.type).toBe('text/html');
        expect(htmlBlob.size).toBeGreaterThan(0);
      }
    });
  });

  describe('Error Handling and Malformed Payloads', () => {
    it('rejects empty or truncated binary buffers', async () => {
      const emptyBuffer = new Uint8Array(0);
      await expect(deserializeFigmaMessage(emptyBuffer)).rejects.toThrow(/too short/);

      const shortBuffer = new Uint8Array(10);
      await expect(deserializeFigmaMessage(shortBuffer)).rejects.toThrow(/too short/);
    });

    it('rejects buffers with invalid magic header', async () => {
      const badBuffer = new Uint8Array(40);
      new TextEncoder().encodeInto('bad-head', badBuffer);
      await expect(deserializeFigmaMessage(badBuffer)).rejects.toThrow(/Invalid figma magic header/);
    });
  });
});
