import { describe, it, expect, beforeEach } from 'vitest';
import { executeExportPipeline, ExportPipelineStage } from '../../core/export/export-pipeline';

describe('Fixed-Order Export Pipeline', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <header id="site_header" style="width: 1440px; height: 70px; background-color: #ffffff;">
        <h1 style="width: 200px; height: 30px;">Acme Platform</h1>
      </header>
      <main id="main_content" style="width: 1440px; height: 600px; background-color: #f8fafc;">
        <section id="hero_card" style="width: 500px; height: 300px; padding: 24px; background-color: #ffffff;">
          <h2 style="width: 250px; height: 28px;">Hero Title</h2>
          <button id="cta_btn" style="width: 120px; height: 40px; background-color: #2563eb; color: #ffffff;">Get Started</button>
        </section>
      </main>
    `;
  });

  it('executes viewport export and transitions through stages in strict sequential order', async () => {
    const stagesVisited: ExportPipelineStage[] = [];

    const result = await executeExportPipeline({
      jobId: 'job_viewport_test',
      mode: 'viewport',
      onStageChange: (stage) => {
        stagesVisited.push(stage);
      }
    });

    expect(stagesVisited).toEqual([
      'capturing_dom',
      'validating_semantics',
      'fetching_assets',
      'analyzing_layout',
      'building_scene',
      'ready_to_copy'
    ]);

    expect(result.stage).toBe('ready_to_copy');
    expect(result.scene).toBeDefined();
    expect(result.scene?.pageFrame).toBeDefined();
    expect(result.scene?.nodes.length).toBeGreaterThan(0);
  });

  it('executes selected-element export on targeted element', async () => {
    const target = document.getElementById('hero_card')!;
    const stagesVisited: ExportPipelineStage[] = [];

    const result = await executeExportPipeline({
      jobId: 'job_selected_test',
      mode: 'selected-element',
      targetElement: target,
      onStageChange: (stage) => {
        stagesVisited.push(stage);
      }
    });

    expect(result.stage).toBe('ready_to_copy');
    expect(result.scene).toBeDefined();
    expect(result.scene?.pageFrame.name).toContain('[hero_card]');
  });

  it('fails gracefully when selected-element target is missing', async () => {
    const result = await executeExportPipeline({
      jobId: 'job_fail_test',
      mode: 'selected-element'
      // missing targetElement
    });

    expect(result.stage).toBe('failed');
    expect(result.error).toContain('requires a targetElement');
  });

  it('aborts execution when signal is cancelled', async () => {
    const controller = new AbortController();
    controller.abort();

    const result = await executeExportPipeline({
      jobId: 'job_cancel_test',
      mode: 'viewport',
      signal: controller.signal
    });

    expect(result.stage).toBe('cancelled');
    expect(result.error).toContain('cancelled');
  });
});
