import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildE2EDemoSiteFixture, E2EDemoFixture } from '../fixtures/e2e-demo-site.fixture';
import { executeExportPipeline } from '../../core/export/export-pipeline';
import { ExportJobController } from '../../background/export-job-controller';
import { MemoryCaptureStorage } from '../../core/storage/capture-database';
import { validatePageScene } from '../../core/scene/scene-validation';
import { jobRegistry } from '../../background/job-registry';

describe('End-to-End Export Workflows (Viewport & Selected Element)', () => {
  let fixture: E2EDemoFixture;

  beforeEach(async () => {
    fixture = buildE2EDemoSiteFixture();
    await jobRegistry.initialize();
  });

  afterEach(() => {
    fixture.cleanup();
  });

  describe('Current Viewport Export Workflow', () => {
    it('captures viewport without altering scroll position, extracts editable text, and excludes form secrets', async () => {
      const initialScrollX = window.scrollX;
      const initialScrollY = window.scrollY;

      const result = await executeExportPipeline({
        jobId: 'job_e2e_viewport',
        mode: 'viewport'
      });

      // 1. Verify scroll position was untouched
      expect(window.scrollX).toBe(initialScrollX);
      expect(window.scrollY).toBe(initialScrollY);

      expect(result.stage).toBe('ready_to_copy');
      expect(result.scene).toBeDefined();

      const scene = result.scene!;

      // 2. Structural validation
      const validation = validatePageScene(scene);
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);

      // 3. Verify editable typography
      const textNodes = scene.nodes.filter((n) => n.type === 'TEXT');
      expect(textNodes.length).toBeGreaterThan(0);
      const headline = textNodes.find((t) => t.textData?.text.includes('Automate Web to Design Workflows'));
      expect(headline).toBeDefined();
      expect(headline?.textData?.fontFamily).toBeDefined();
      expect(headline?.textData?.fontWeight).toBe(800);

      // 4. Privacy: confidential form credentials must never be in text layers or scene
      const allText = scene.nodes
        .map((n) => n.textData?.text ?? '')
        .join(' ');
      expect(allText).not.toContain('SuperSecretToken123');
      expect(allText).not.toContain('confidential@enterprise.com');
    });
  });

  describe('Selected-Element Export Workflow', () => {
    it('captures an isolated hero section subtree rebased to origin (0, 0)', async () => {
      const result = await executeExportPipeline({
        jobId: 'job_e2e_selected_hero',
        mode: 'selected-element',
        targetElement: fixture.heroSection
      });

      expect(result.stage).toBe('ready_to_copy');
      expect(result.scene).toBeDefined();

      const scene = result.scene!;

      // Root frame must have local coordinates (0, 0)
      expect(scene.pageFrame.x).toBe(0);
      expect(scene.pageFrame.y).toBe(0);
      expect(scene.pageFrame.name).toContain('[demo-hero]');

      // Must not contain header or footer nodes
      const allNames = scene.nodes.map((n) => n.name);
      expect(allNames.some((n) => n.includes('Header'))).toBe(false);
      expect(allNames.some((n) => n.includes('Footer'))).toBe(false);

      // Validate scene integrity
      const validation = validatePageScene(scene);
      expect(validation.isValid).toBe(true);
    });

    it('captures a feature card with corner radii, borders, and shadows intact', async () => {
      const result = await executeExportPipeline({
        jobId: 'job_e2e_selected_card',
        mode: 'selected-element',
        targetElement: fixture.featureCard1
      });

      expect(result.stage).toBe('ready_to_copy');
      const scene = result.scene!;

      const cardFrame = scene.nodes.find((n) => n.id !== scene.pageFrame.id && n.type === 'FRAME')!;
      expect(cardFrame).toBeDefined();
      expect(cardFrame.type).toBe('FRAME');
      expect(cardFrame.cornerRadius).toBe(12);
      expect(cardFrame.strokes.length).toBeGreaterThanOrEqual(1);
      expect(cardFrame.effects.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Controller and Durable Storage Lifecycle', () => {
    it('runs end-to-end export job and retrieves stored scene document', async () => {
      const storage = new MemoryCaptureStorage();
      const controller = new ExportJobController(storage);

      const job = await controller.startExport({
        tabId: 10,
        url: 'https://acme.io/demo',
        origin: 'https://acme.io',
        mode: 'viewport'
      });

      expect(['capturing', 'ready_to_copy']).toContain(job.state);

      // Verify retrieval from durable storage
      const stored = await controller.getStoredScene(job.jobId);
      expect(stored).toBeDefined();
      expect(stored?.schemaVersion).toBe(1);
      expect(stored?.pageFrames).toHaveLength(1);

      // Mark completed
      const completed = await controller.markCompleted(job.jobId);
      expect(completed?.state).toBe('completed');
    });
  });
});
