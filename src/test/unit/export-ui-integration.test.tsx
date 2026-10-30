import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ExportProgress } from '../../popup/components/ExportProgress';
import { CopyToFigma } from '../../popup/components/CopyToFigma';
import type { FigmaSceneDocument } from '../../shared/contracts/scene';

describe('UI Integration — ExportProgress & CopyToFigma', () => {
  describe('ExportProgress Component', () => {
    it('renders all stage steps and highlights the active stage', () => {
      render(
        <ExportProgress
          stage="analyzing_layout"
          currentStep="Translating flexbox and grid layouts..."
        />
      );

      expect(screen.getByText('DOM Snapshot')).toBeDefined();
      expect(screen.getByText('Styles & Layout')).toBeDefined();
      expect(screen.getByText('Translating flexbox and grid layouts...')).toBeDefined();

      const activeStep = document.querySelector('.step-active');
      expect(activeStep?.textContent).toContain('Styles & Layout');
    });

    it('triggers onCancel when Cancel Export button is clicked', () => {
      const handleCancel = vi.fn();
      render(
        <ExportProgress
          stage="capturing_dom"
          currentStep="Extracting DOM..."
          onCancel={handleCancel}
        />
      );

      const cancelBtn = screen.getByText('Cancel Export');
      fireEvent.click(cancelBtn);
      expect(handleCancel).toHaveBeenCalledTimes(1);
    });
  });

  describe('CopyToFigma Component', () => {
    const mockSceneDoc: FigmaSceneDocument = {
      schemaVersion: 1,
      exportTitle: 'Acme Test',
      sourceSite: 'https://acme.io',
      exportedAt: Date.now(),
      pageFrames: [],
      sections: [],
      metadata: { totalNodes: 5, totalAssets: 0, totalPages: 1, devicePixelRatio: 2 }
    };

    beforeEach(() => {
      // Mock navigator.clipboard
      Object.assign(navigator, {
        clipboard: {
          write: vi.fn().mockResolvedValue(undefined),
          writeText: vi.fn().mockResolvedValue(undefined)
        }
      });
    });

    it('triggers clipboard copy on user click and displays paste instructions', async () => {
      const handleSuccess = vi.fn();
      render(
        <CopyToFigma
          jobId="job_copy_test"
          sceneDocument={mockSceneDoc}
          onCopySuccess={handleSuccess}
        />
      );

      const copyBtn = screen.getByText('Copy to Figma');
      fireEvent.click(copyBtn);

      await waitFor(() => {
        expect(screen.getByText('Copied to Clipboard!')).toBeDefined();
        expect(screen.getByText(/Paste into Figma/i)).toBeDefined();
        expect(handleSuccess).toHaveBeenCalledTimes(1);
      });
    });

    it('displays error and fallback download button when clipboard write fails', async () => {
      Object.assign(navigator, {
        clipboard: {
          write: vi.fn().mockRejectedValue(new Error('Clipboard permission denied'))
        }
      });

      render(
        <CopyToFigma
          jobId="job_copy_fail"
          sceneDocument={mockSceneDoc}
        />
      );

      const copyBtn = screen.getByText('Copy to Figma');
      fireEvent.click(copyBtn);

      await waitFor(() => {
        expect(screen.getByText(/Clipboard permission denied/i)).toBeDefined();
        expect(screen.getByText(/Download Scene JSON Fallback/i)).toBeDefined();
      });
    });
  });
});
