import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { buildLongPageFixture, LongPageFixture } from '../fixtures/long-page-lazy.fixture';
import { executeExportPipeline } from '../../core/export/export-pipeline';
import { validatePageScene } from '../../core/scene/scene-validation';
import { jobRegistry } from '../../background/job-registry';

describe('Full-Page Capture & Lazy-Loading End-to-End Workflows', () => {
  let fixture: LongPageFixture;

  beforeEach(async () => {
    fixture = buildLongPageFixture();
    await jobRegistry.initialize();

    Object.defineProperty(document.documentElement, 'scrollHeight', {
      value: 3600,
      configurable: true
    });
    Object.defineProperty(document.documentElement, 'scrollWidth', {
      value: 1440,
      configurable: true
    });

    window.scrollTo = vi.fn();
    window.scrollBy = vi.fn();
  });

  afterEach(() => {
    fixture.cleanup();
    vi.restoreAllMocks();
  });

  it('captures complete vertical page including content below the fold', async () => {
    Object.defineProperty(window, 'scrollY', { value: 120, configurable: true });

    // Mark image complete
    Object.defineProperty(fixture.lazyImage, 'complete', { value: true, configurable: true });

    const result = await executeExportPipeline({
      jobId: 'job_fullpage_e2e',
      mode: 'full-page',
      options: {
        excludeChatWidgets: true
      }
    });

    expect(result.stage).toBe('ready_to_copy');
    expect(result.scene).toBeDefined();

    const scene = result.scene!;

    // 1. Page Frame Dimensions match full document height
    expect(scene.pageFrame.height).toBe(3600);
    expect(scene.pageFrame.width).toBe(1440);

    // 2. Content below the fold is included
    const textContents = scene.nodes.map((n) => n.textData?.text ?? '').join(' ');
    expect(textContents).toContain('Full Document Architecture');
    expect(textContents).toContain('Deep Page Section');

    // 3. Persistent chat widget is pruned according to user option
    const nodeNames = scene.nodes.map((n) => n.name);
    expect(nodeNames.some((name) => /chat/i.test(name))).toBe(false);

    // 4. Single-instance sticky header (not duplicated)
    const headerFrames = scene.nodes.filter((n) => n.name === 'Header');
    expect(headerFrames).toHaveLength(1);

    // 5. User original scroll offset is restored
    expect(window.scrollTo).toHaveBeenCalledWith(0, 120);

    // 6. Scene graph integrity check
    const validation = validatePageScene(scene);
    expect(validation.isValid).toBe(true);
  });

  it('safely bounds infinite scroll and marks export as partial with diagnostic', async () => {
    // Simulate dynamically expanding infinite scroll
    let height = 2000;
    Object.defineProperty(document.documentElement, 'scrollHeight', {
      get: () => {
        height += 800;
        return height;
      },
      configurable: true
    });

    const result = await executeExportPipeline({
      jobId: 'job_infinite_e2e',
      mode: 'full-page'
    });

    expect(result.stage).toBe('ready_to_copy');
    expect(result.diagnostics.some((d) => d.code === 'INFINITE_SCROLL_HALTED')).toBe(true);
  });

  it('handles broken or slow images without hanging pipeline', async () => {
    // Unloaded image
    Object.defineProperty(fixture.lazyImage, 'complete', { value: false, configurable: true });

    const result = await executeExportPipeline({
      jobId: 'job_slow_img_e2e',
      mode: 'full-page'
    });

    expect(result.stage).toBe('ready_to_copy');
    expect(result.scene).toBeDefined();
  });
});
