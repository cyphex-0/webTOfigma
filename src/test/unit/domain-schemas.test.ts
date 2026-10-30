import { describe, it, expect } from 'vitest';
import {
  SourceNodeSchema,
  SourceRectSchema,
  VisibilityFlagsSchema,
  TextRunSchema
} from '../../shared/schemas/source-node.schema';
import {
  ExportJobSchema,
  JobResultManifestSchema
} from '../../shared/schemas/export-job.schema';
import {
  PageCaptureMetadataSchema,
  PageRequestSchema
} from '../../shared/schemas/page-capture.schema';
import {
  FigmaSceneDocumentSchema,
  SceneNodeSchema
} from '../../shared/schemas/scene.schema';
import {
  ExtensionSettingsSchema,
  CaptureProfileSchema
} from '../../shared/schemas/settings.schema';
import { ExportDiagnosticSchema } from '../../shared/schemas/diagnostics.schema';
import {
  landingPageNodes,
  nestedFlexCardNodes,
  gridPageNodes,
  longArticleNodes,
  svgIconNodes,
  mockPageCaptureMetadata,
  mockExportJob,
  mockSceneDocument
} from '../fixtures';

describe('Domain Zod Schemas Validation', () => {
  describe('SourceNodeSchema & Sub-schemas', () => {
    it('validates landing page fixture nodes successfully', () => {
      expect(landingPageNodes.length).toBeGreaterThan(0);
      for (const node of landingPageNodes) {
        const result = SourceNodeSchema.safeParse(node);
        expect(result.success, `Failed on node ${node.nodeId}: ${JSON.stringify(result.error)}`).toBe(true);
      }
    });

    it('validates nested flex card fixture nodes successfully', () => {
      expect(nestedFlexCardNodes.length).toBeGreaterThan(0);
      for (const node of nestedFlexCardNodes) {
        const result = SourceNodeSchema.safeParse(node);
        expect(result.success, `Failed on node ${node.nodeId}`).toBe(true);
      }
    });

    it('validates grid catalog fixture nodes successfully', () => {
      expect(gridPageNodes.length).toBeGreaterThan(0);
      for (const node of gridPageNodes) {
        const result = SourceNodeSchema.safeParse(node);
        expect(result.success, `Failed on node ${node.nodeId}`).toBe(true);
      }
    });

    it('validates long article typography nodes successfully', () => {
      expect(longArticleNodes.length).toBeGreaterThan(0);
      for (const node of longArticleNodes) {
        const result = SourceNodeSchema.safeParse(node);
        expect(result.success, `Failed on node ${node.nodeId}`).toBe(true);
      }
    });

    it('validates svg vector icon nodes successfully', () => {
      expect(svgIconNodes.length).toBeGreaterThan(0);
      for (const node of svgIconNodes) {
        const result = SourceNodeSchema.safeParse(node);
        expect(result.success, `Failed on node ${node.nodeId}`).toBe(true);
      }
    });

    it('rejects rects with negative dimensions or non-finite values', () => {
      expect(SourceRectSchema.safeParse({ x: 0, y: 0, width: -10, height: 100 }).success).toBe(false);
      expect(SourceRectSchema.safeParse({ x: 0, y: 0, width: 100, height: -5 }).success).toBe(false);
      expect(SourceRectSchema.safeParse({ x: NaN, y: 0, width: 100, height: 100 }).success).toBe(false);
      expect(SourceRectSchema.safeParse({ x: 0, y: Infinity, width: 100, height: 100 }).success).toBe(false);
      expect(SourceRectSchema.safeParse({ x: 10, y: 20, width: 100, height: 200 }).success).toBe(true);
    });

    it('validates opacity boundaries in VisibilityFlagsSchema', () => {
      expect(VisibilityFlagsSchema.safeParse({
        isVisible: true,
        isClipped: false,
        isOffscreen: false,
        opacity: 0.5
      }).success).toBe(true);

      expect(VisibilityFlagsSchema.safeParse({
        isVisible: true,
        isClipped: false,
        isOffscreen: false,
        opacity: -0.1
      }).success).toBe(false);

      expect(VisibilityFlagsSchema.safeParse({
        isVisible: true,
        isClipped: false,
        isOffscreen: false,
        opacity: 1.05
      }).success).toBe(false);
    });

    it('validates TextRun font styling constraints', () => {
      const validTextRun = {
        text: 'Hello World',
        fontFamily: 'Inter',
        fontWeight: 400,
        fontStyle: 'normal' as const,
        fontSize: 16,
        lineHeight: 24,
        letterSpacing: 0,
        color: '#000000',
        textDecoration: 'none',
        textAlign: 'left' as const,
        textTransform: 'none'
      };

      expect(TextRunSchema.safeParse(validTextRun).success).toBe(true);

      // Invalid font weight (< 100 or > 900)
      expect(TextRunSchema.safeParse({ ...validTextRun, fontWeight: 50 }).success).toBe(false);
      expect(TextRunSchema.safeParse({ ...validTextRun, fontWeight: 1000 }).success).toBe(false);

      // Invalid font style
      expect(TextRunSchema.safeParse({ ...validTextRun, fontStyle: 'condensed' }).success).toBe(false);

      // Non-positive font size
      expect(TextRunSchema.safeParse({ ...validTextRun, fontSize: 0 }).success).toBe(false);
      expect(TextRunSchema.safeParse({ ...validTextRun, fontSize: -12 }).success).toBe(false);
    });
  });

  describe('ExportJobSchema & Manifest', () => {
    it('validates mockExportJob successfully', () => {
      const result = ExportJobSchema.safeParse(mockExportJob);
      expect(result.success).toBe(true);
    });

    it('enforces schemaVersion literal 1', () => {
      const invalidVersion = { ...mockExportJob, schemaVersion: 2 };
      expect(ExportJobSchema.safeParse(invalidVersion).success).toBe(false);
    });

    it('rejects invalid export modes and statuses', () => {
      expect(ExportJobSchema.safeParse({ ...mockExportJob, mode: 'magic_ai' }).success).toBe(false);
      expect(ExportJobSchema.safeParse({ ...mockExportJob, status: 'thinking' }).success).toBe(false);
    });

    it('validates JobResultManifestSchema non-negative counts', () => {
      const validManifest = {
        pageCount: 3,
        totalNodes: 120,
        totalAssets: 15,
        totalAssetBytes: 524288
      };
      expect(JobResultManifestSchema.safeParse(validManifest).success).toBe(true);
      expect(JobResultManifestSchema.safeParse({ ...validManifest, totalNodes: -1 }).success).toBe(false);
    });
  });

  describe('PageCaptureMetadataSchema', () => {
    it('validates mockPageCaptureMetadata successfully', () => {
      const result = PageCaptureMetadataSchema.safeParse(mockPageCaptureMetadata);
      expect(result.success).toBe(true);
    });

    it('rejects malformed URLs in metadata', () => {
      const invalidUrl = { ...mockPageCaptureMetadata, finalUrl: 'not_a_valid_url' };
      expect(PageCaptureMetadataSchema.safeParse(invalidUrl).success).toBe(false);
    });

    it('validates PageRequestSchema origin and depth', () => {
      const validReq = {
        url: 'https://example.com/docs',
        discoveryIndex: 0,
        crawlDepth: 1,
        originMetadata: { origin: 'https://example.com' }
      };
      expect(PageRequestSchema.safeParse(validReq).success).toBe(true);
      expect(PageRequestSchema.safeParse({ ...validReq, crawlDepth: -1 }).success).toBe(false);
    });
  });

  describe('FigmaSceneDocumentSchema', () => {
    it('validates mockSceneDocument successfully', () => {
      const result = FigmaSceneDocumentSchema.safeParse(mockSceneDocument);
      expect(result.success).toBe(true);
    });

    it('validates SceneNode geometry and hierarchy bounds', () => {
      const validNode = mockSceneDocument.pageFrames[0];
      expect(SceneNodeSchema.safeParse(validNode).success).toBe(true);

      const negativeDimNode = { ...validNode, width: -100 };
      expect(SceneNodeSchema.safeParse(negativeDimNode).success).toBe(false);
    });
  });

  describe('ExtensionSettingsSchema', () => {
    it('validates standard extension settings structure', () => {
      const standardSettings = {
        schemaVersion: 1 as const,
        defaultMode: 'full-page',
        activeProfileId: 'desktop-default',
        profiles: [
          {
            id: 'desktop-default',
            name: 'Desktop Standard (1440px)',
            viewportWidth: 1440,
            viewportHeight: 900,
            devicePixelRatio: 2,
            fullPageScrollLimit: 15000,
            scrollDelayMs: 200,
            includeFixedElements: true,
            waitStrategy: 'networkidle' as const,
            maxAssetsPerJob: 200,
            maxNodesPerJob: 15000
          }
        ],
        domainOverrides: {},
        autoCopyClipboard: true,
        notifyOnComplete: true
      };

      expect(ExtensionSettingsSchema.safeParse(standardSettings).success).toBe(true);
    });

    it('validates CaptureProfileSchema positive viewport sizes', () => {
      const profile = {
        id: 'mobile-portrait',
        name: 'Mobile Portrait',
        viewportWidth: 390,
        viewportHeight: 844,
        devicePixelRatio: 3,
        fullPageScrollLimit: 10000,
        scrollDelayMs: 150,
        includeFixedElements: true,
        waitStrategy: 'load' as const,
        maxAssetsPerJob: 100,
        maxNodesPerJob: 8000
      };
      expect(CaptureProfileSchema.safeParse(profile).success).toBe(true);
      expect(CaptureProfileSchema.safeParse({ ...profile, viewportWidth: 0 }).success).toBe(false);
    });
  });

  describe('ExportDiagnosticSchema', () => {
    it('validates diagnostic error and warning entries', () => {
      const validDiagnostic = {
        severity: 'warning' as const,
        code: 'CSS_PROPERTY_CLAMPED',
        message: 'Font size 0.5px was clamped to minimum readable size',
        phase: 'style-resolution' as const,
        nodeId: 'p0_n_0_1',
        timestamp: Date.now()
      };
      expect(ExportDiagnosticSchema.safeParse(validDiagnostic).success).toBe(true);

      const invalidSeverity = { ...validDiagnostic, severity: 'catastrophic' };
      expect(ExportDiagnosticSchema.safeParse(invalidSeverity).success).toBe(false);
    });
  });
});
