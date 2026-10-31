import React, { useState, useEffect, useCallback } from 'react';
import { browser, getBrowserTargetName } from '../shared/browser/browser-api';
import { Header } from './components/Header';
import { TabStatusBanner } from './components/TabStatusBanner';
import { ModeSelector } from './components/ModeSelector';
import { ProfileBadge } from './components/ProfileBadge';
import { ActionControls } from './components/ActionControls';
import { JobProgressView } from './components/JobProgressView';
import { ReadyToCopyView } from './components/ReadyToCopyView';
import { HelpModal } from './components/HelpModal';
import { DiagnosticsView } from './components/DiagnosticsView';
import { RouteReview } from './components/RouteReview';
import { discoverSiteRoutes, DiscoveredRoute } from '../core/crawler';
import { settingsStore } from '../core/settings/settings-store';
import type { ExportDiagnostic } from '../shared/contracts/diagnostics';
import type { ExportMode } from '../shared/contracts/export-job';
import type { CaptureProfile, ExtensionSettings } from '../shared/contracts/settings';
import type {
  ActiveTabContext,
  GetActiveTabContextResponse,
  InjectContentScriptResponse,
  StartCaptureResponse,
  ToggleMinibarResponse,
  JobRecord,
  MessageResponse
} from '../shared/contracts/messages';
import {
  prepareClipboardPayload,
  writePreparedClipboardPayload,
  type PreparedClipboardPayload
} from '../core/figma/poc/clipboard-poc';
import { FigmaClipboardAdapter } from '../core/figma/clipboard/figma-clipboard-adapter';
import { POC_FIXTURES } from '../core/figma/poc/fixtures';

export const App: React.FC = () => {
  const targetName = getBrowserTargetName();

  // Settings & Profile State
  const [settings, setSettings] = useState<ExtensionSettings | null>(null);
  const [activeProfile, setActiveProfile] = useState<CaptureProfile | null>(null);
  const [selectedMode, setSelectedMode] = useState<ExportMode>('full-page');

  // Active Tab & Permission State
  const [activeTab, setActiveTab] = useState<ActiveTabContext | null>(null);
  const [tabLoading, setTabLoading] = useState<boolean>(true);

  // Multi-Page Route Review State
  const [showRouteReview, setShowRouteReview] = useState<boolean>(false);
  const [candidateRoutes, setCandidateRoutes] = useState<DiscoveredRoute[]>([]);
  const [isDiscoveringRoutes, setIsDiscoveringRoutes] = useState<boolean>(false);

  // Active Job Execution State
  const [activeJob, setActiveJob] = useState<JobRecord | null>(null);
  const [isStartingExport, setIsStartingExport] = useState<boolean>(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Help Modal & Diagnostics State
  const [isHelpOpen, setIsHelpOpen] = useState<boolean>(false);
  const [showDiagnostics, setShowDiagnostics] = useState<boolean>(false);
  const [isMinibarActive, setIsMinibarActive] = useState<boolean>(false);

  // Phase 1 PoC Verification Accordion State
  const [showPocSection, setShowPocSection] = useState<boolean>(false);
  const [selectedFixtureId, setSelectedFixtureId] = useState<string>('nested-card');
  const [preparedPayload, setPreparedPayload] = useState<PreparedClipboardPayload | null>(null);
  const [isPreparingPoc, setIsPreparingPoc] = useState<boolean>(false);
  const [pocFeedback, setPocFeedback] = useState<{ success: boolean; message: string } | null>(null);

  // Load Settings & Subscribe to Cross-Context Storage Changes
  useEffect(() => {
    let isMounted = true;

    async function initSettings() {
      const loaded = await settingsStore.load();
      if (!isMounted) return;
      setSettings(loaded);
      setSelectedMode(loaded.defaultMode as ExportMode);
      const profile = await settingsStore.getActiveProfile();
      if (!isMounted) return;
      setActiveProfile(profile);
    }

    void initSettings();

    const unsubscribe = settingsStore.subscribe((updated) => {
      setSettings(updated);
      setSelectedMode(updated.defaultMode as ExportMode);
      void settingsStore.getActiveProfile().then((p) => setActiveProfile(p));
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  // Fetch active tab context
  const fetchActiveTabContext = useCallback(async () => {
    setTabLoading(true);
    try {
      const response = (await browser.runtime.sendMessage({
        id: `req_${Date.now()}`,
        type: 'GET_ACTIVE_TAB_CONTEXT',
        payload: {},
        timestamp: Date.now()
      })) as MessageResponse<GetActiveTabContextResponse>;

      if (response.success && response.payload?.tab) {
        setActiveTab(response.payload.tab);
      } else {
        setActiveTab(null);
      }
    } catch {
      setActiveTab(null);
    } finally {
      setTabLoading(false);
    }
  }, []);

  // Fetch active job status
  const fetchActiveJob = useCallback(async () => {
    try {
      const response = (await browser.runtime.sendMessage({
        id: `req_${Date.now()}`,
        type: 'GET_JOB_STATUS',
        payload: {},
        timestamp: Date.now()
      })) as MessageResponse<{ job: JobRecord | null }>;

      if (response.success && response.payload?.job) {
        setActiveJob(response.payload.job);
      } else {
        setActiveJob(null);
      }
    } catch {
      // Ignore
    }
  }, []);

  useEffect(() => {
    void fetchActiveTabContext();
    void fetchActiveJob();
  }, [fetchActiveTabContext, fetchActiveJob]);

  // Execute Capture Job with optional selected routes
  const executeCaptureJob = async (selectedRoutes?: DiscoveredRoute[]) => {
    if (!activeTab || !activeTab.isInjectable) return;
    setIsStartingExport(true);
    setExportError(null);

    try {
      // 1. Inject content script
      const injectRes = (await browser.runtime.sendMessage({
        id: `req_inj_${Date.now()}`,
        type: 'INJECT_CONTENT_SCRIPT',
        payload: { tabId: activeTab.tabId },
        timestamp: Date.now()
      })) as MessageResponse<InjectContentScriptResponse>;

      if (!injectRes.success) {
        throw new Error(injectRes.error?.message ?? 'Failed to inject extraction scripts');
      }

      // 2. Start capture job
      const startRes = (await browser.runtime.sendMessage({
        id: `req_cap_${Date.now()}`,
        type: 'START_CAPTURE',
        payload: {
          mode: selectedMode,
          tabId: activeTab.tabId,
          userOptions: {
            profileId: activeProfile?.id,
            viewportWidth: activeProfile?.viewportWidth,
            viewportHeight: activeProfile?.viewportHeight,
            selectedUrls: selectedRoutes?.map((r) => r.canonicalUrl)
          }
        },
        timestamp: Date.now()
      })) as MessageResponse<StartCaptureResponse>;

      if (startRes.success && startRes.payload?.job) {
        setActiveJob(startRes.payload.job);
      } else {
        throw new Error(startRes.error?.message ?? 'Capture initiation failed');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setExportError(msg);
    } finally {
      setIsStartingExport(false);
    }
  };

  // Handle Export Initiation
  const handleStartExport = async () => {
    if (!activeTab || !activeTab.isInjectable) return;

    const isMultiPageMode =
      selectedMode === 'selected-pages' ||
      selectedMode === 'odd-pages' ||
      selectedMode === 'even-pages' ||
      selectedMode === 'entire-site';

    if (isMultiPageMode && !showRouteReview) {
      setIsDiscoveringRoutes(true);
      setExportError(null);
      try {
        const discovery = await discoverSiteRoutes(document, {
          baseUrl: activeTab.url,
          currentUrl: activeTab.url,
          currentTitle: activeTab.title,
          maxDepth: 1
        });
        setCandidateRoutes(discovery.routes);
        setShowRouteReview(true);
      } catch (err) {
        setExportError(err instanceof Error ? err.message : String(err));
      } finally {
        setIsDiscoveringRoutes(false);
      }
      return;
    }

    await executeCaptureJob();
  };

  // Handle Job Cancellation
  const handleCancelJob = async () => {
    if (!activeJob) return;
    try {
      await browser.runtime.sendMessage({
        id: `req_cancel_${Date.now()}`,
        type: 'CANCEL_JOB',
        payload: { jobId: activeJob.jobId },
        timestamp: Date.now()
      });
      setActiveJob(null);
    } catch (err) {
      console.error('[WebToFigma] Error cancelling job:', err);
    }
  };

  // Handle In-Page Minibar Toggle
  const handleToggleMinibar = async () => {
    if (!activeTab || !activeTab.isInjectable) return;
    try {
      const res = (await browser.runtime.sendMessage({
        id: `toggle_mini_${Date.now()}`,
        type: 'TOGGLE_MINIBAR',
        payload: { tabId: activeTab.tabId },
        timestamp: Date.now()
      })) as MessageResponse<ToggleMinibarResponse>;

      if (res && res.success && res.payload) {
        setIsMinibarActive(res.payload.active);
      }
    } catch (err) {
      console.error('[WebToFigma] Failed to toggle minibar from popup:', err);
    }
  };

  // Handle Copy to Figma for ready-to-copy job
  const handleCopyToFigma = async (): Promise<{ success: boolean; bytesWritten?: number; error?: string }> => {
    try {
      const adapter = new FigmaClipboardAdapter();
      const pastePayload = await adapter.createPasteTestPayload();
      await adapter.writePreparedBatch(pastePayload);
      return { success: true, bytesWritten: pastePayload.binaryBuffer.byteLength };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  };

  // Phase 1 PoC Precompute
  const handlePrecomputePoc = useCallback(async (fixtureId: string) => {
    setIsPreparingPoc(true);
    setPocFeedback(null);
    try {
      const prepared = await prepareClipboardPayload(fixtureId);
      setPreparedPayload(prepared);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setPocFeedback({ success: false, message: `Precomputation failed: ${msg}` });
    } finally {
      setIsPreparingPoc(false);
    }
  }, []);

  const handleCopyPoc = async () => {
    if (!preparedPayload) return;
    try {
      await writePreparedClipboardPayload(preparedPayload);
      setPocFeedback({
        success: true,
        message: `Copied to clipboard (${preparedPayload.htmlBytes} bytes)! Switch to Figma and press Ctrl+V.`
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setPocFeedback({ success: false, message: `Clipboard write error: ${msg}` });
    }
  };

  // Disabled Reason Computation
  const getDisabledReason = (): string | undefined => {
    if (tabLoading) return 'Inspecting tab status...';
    if (!activeTab) return 'No active browser tab found';
    if (!activeTab.isInjectable) {
      return 'Export is unavailable on browser internal pages (chrome://, about:), extension stores, and local PDFs.';
    }
    if (activeJob && (activeJob.state === 'capturing' || activeJob.state === 'processing')) {
      return 'Another capture job is currently running.';
    }
    return undefined;
  };

  const isJobRunning = Boolean(
    activeJob && (activeJob.state === 'capturing' || activeJob.state === 'processing' || activeJob.state === 'injecting')
  );

  const isReadyToCopy = Boolean(
    activeJob && (activeJob.state === 'ready_to_copy' || activeJob.state === 'completed')
  );

  return (
    <div className="popup-container">
      <Header
        hostname={activeTab?.url ? new URL(activeTab.url).hostname : undefined}
        isInjectable={activeTab?.isInjectable}
        onOpenHelp={() => setIsHelpOpen(true)}
        onToggleMinibar={handleToggleMinibar}
        isMinibarActive={isMinibarActive}
      />

      <main className="popup-content">
        <TabStatusBanner
          activeTab={activeTab}
          loading={tabLoading}
        />

        {/* View Switcher based on Job State */}
        {isReadyToCopy && activeJob ? (
          <ReadyToCopyView
            job={activeJob}
            onCopyToClipboard={handleCopyToFigma}
            onStartNew={() => setActiveJob(null)}
          />
        ) : isJobRunning && activeJob ? (
          <JobProgressView
            job={activeJob}
            onCancelJob={handleCancelJob}
          />
        ) : showRouteReview && candidateRoutes.length > 0 ? (
          <RouteReview
            initialRoutes={candidateRoutes}
            baseUrl={activeTab?.url ?? ''}
            onStartExport={(selectedRoutes) => {
              setShowRouteReview(false);
              void executeCaptureJob(selectedRoutes);
            }}
            isExporting={isStartingExport}
          />
        ) : (
          <>
            <ProfileBadge profile={activeProfile} />

            <ModeSelector
              selectedMode={selectedMode}
              onSelectMode={setSelectedMode}
              disabled={!activeTab?.isInjectable || isJobRunning}
            />

            <ActionControls
              selectedMode={selectedMode}
              isInjectable={Boolean(activeTab?.isInjectable)}
              isJobRunning={isJobRunning}
              isLoading={isStartingExport}
              onStartExport={handleStartExport}
              onCancelJob={handleCancelJob}
              disabledReason={getDisabledReason()}
            />

            {exportError && (
              <div
                className="error-banner"
                role="alert"
                onClick={() => setShowDiagnostics(true)}
                style={{ cursor: 'pointer' }}
                title="Click to view detailed diagnostics and recovery options"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span>{exportError}</span>
              </div>
            )}
          </>
        )}

        {/* Phase 1 Clipboard Golden Verification Harness */}
        <section className="poc-accordion">
          <button
            type="button"
            className="poc-accordion-toggle"
            onClick={() => setShowPocSection((prev) => !prev)}
            aria-expanded={showPocSection}
          >
            <span>Clipboard Wire Verification</span>
            <span className="accordion-arrow">{showPocSection ? '▲' : '▼'}</span>
          </button>

          {showPocSection && (
            <div className="poc-accordion-body">
              <label htmlFor="poc-fixture-select" className="poc-label">
                Synthetic Fixture:
              </label>
              <select
                id="poc-fixture-select"
                className="poc-select"
                value={selectedFixtureId}
                onChange={(e) => {
                  const id = e.target.value;
                  setSelectedFixtureId(id);
                  void handlePrecomputePoc(id);
                }}
              >
                {Object.values(POC_FIXTURES).map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.title}
                  </option>
                ))}
              </select>

              <button
                type="button"
                className="btn-poc-copy"
                onClick={handleCopyPoc}
                disabled={isPreparingPoc}
              >
                Copy Fixture to Figma
              </button>

              {pocFeedback && (
                <div className={`feedback-banner ${pocFeedback.success ? 'feedback-success' : 'feedback-error'}`}>
                  {pocFeedback.message}
                </div>
              )}
            </div>
          )}
        </section>
      </main>

      <footer className="popup-footer">
        <span className="footer-target">Target: {targetName} MV3</span>
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            if (typeof browser !== 'undefined' && browser.runtime?.openOptionsPage) {
              void browser.runtime.openOptionsPage();
            }
          }}
        >
          Options
        </a>
      </footer>

      <HelpModal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
      />

      {showDiagnostics && (
        <DiagnosticsView
          diagnostics={
            ((activeJob && 'diagnostics' in activeJob ? (activeJob as { diagnostics?: ExportDiagnostic[] }).diagnostics : null) ??
              (exportError
                ? [
                    {
                      severity: 'error' as const,
                      code: 'EXPORT_ERROR',
                      message: exportError,
                      phase: 'dom-extraction' as const,
                      timestamp: Date.now()
                    }
                  ]
                : []))
          }
          onClose={() => setShowDiagnostics(false)}
        />
      )}
    </div>
  );
};
