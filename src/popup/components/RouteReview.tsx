import React, { useState, useMemo } from 'react';
import { DiscoveredRoute } from '../../core/crawler/crawl-scope';
import { RouteNumberingMode, orderRoutesByMode, moveRouteOrder } from '../../core/crawler/route-order';
import {
  applyParitySelection,
  selectAllRoutes,
  deselectAllRoutes,
  invertRouteSelection,
  toggleRouteSelection,
  applyPageCap,
  addManualRoute,
  removeManualRoute
} from '../../core/crawler/route-selection';
import { filterRoutes, compileSafeUserRegex } from '../../core/crawler/route-filter';
import { RouteFilters } from './RouteFilters';
import { OddEvenSelector } from './OddEvenSelector';

export interface RouteReviewProps {
  initialRoutes: readonly DiscoveredRoute[];
  baseUrl: string;
  onStartExport: (selectedRoutes: DiscoveredRoute[]) => void;
  isExporting?: boolean;
}

export const RouteReview: React.FC<RouteReviewProps> = ({
  initialRoutes,
  baseUrl,
  onStartExport,
  isExporting = false
}) => {
  const [allRoutes, setAllRoutes] = useState<DiscoveredRoute[]>([...initialRoutes]);
  const [mode, setMode] = useState<RouteNumberingMode>('discovery-order');
  const [manualOrderUrls, setManualOrderUrls] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activePresetIds, setActivePresetIds] = useState<string[]>([]);
  const [customRegexPattern, setCustomRegexPattern] = useState('');
  const [excludeDestructive, setExcludeDestructive] = useState(true);
  const [pageCap, setPageCap] = useState(25);
  const [manualInput, setManualInput] = useState('');
  const [manualInputError, setManualInputError] = useState<string | null>(null);
  const [paritySummary, setParitySummary] = useState<string | undefined>(undefined);

  // Validate regex
  const regexValidation = useMemo(
    () => compileSafeUserRegex(customRegexPattern),
    [customRegexPattern]
  );

  // Filter routes
  const filteredRoutes = useMemo(() => {
    return filterRoutes(allRoutes, {
      searchQuery,
      activePresetIds,
      customRegexPattern: regexValidation.isValid ? customRegexPattern : undefined,
      excludeDestructive
    });
  }, [allRoutes, searchQuery, activePresetIds, customRegexPattern, regexValidation, excludeDestructive]);

  // Order routes according to mode
  const orderedRoutes = useMemo(() => {
    return orderRoutesByMode(filteredRoutes, mode, manualOrderUrls);
  }, [filteredRoutes, mode, manualOrderUrls]);

  // Apply page cap
  const cappedResult = useMemo(() => {
    return applyPageCap(orderedRoutes, pageCap);
  }, [orderedRoutes, pageCap]);

  const totalSelected = orderedRoutes.filter((r) => r.isSelected).length;

  // Parity actions
  const handleSelectOdd = () => {
    const res = applyParitySelection(orderedRoutes, 'odd', mode);
    updateSelectedState(res.routes);
    setParitySummary(res.summaryLabel);
  };

  const handleSelectEven = () => {
    const res = applyParitySelection(orderedRoutes, 'even', mode);
    updateSelectedState(res.routes);
    setParitySummary(res.summaryLabel);
  };

  const handleSelectAll = () => {
    const res = selectAllRoutes(orderedRoutes);
    updateSelectedState(res);
    setParitySummary(undefined);
  };

  const handleDeselectAll = () => {
    const res = deselectAllRoutes(orderedRoutes);
    updateSelectedState(res);
    setParitySummary(undefined);
  };

  const handleInvert = () => {
    const res = invertRouteSelection(orderedRoutes);
    updateSelectedState(res);
    setParitySummary(undefined);
  };

  const handleToggleRoute = (canonicalUrl: string) => {
    const res = toggleRouteSelection(allRoutes, canonicalUrl);
    setAllRoutes(res);
    setParitySummary(undefined);
  };

  const updateSelectedState = (subset: DiscoveredRoute[]) => {
    const selectedMap = new Map(subset.map((r) => [r.canonicalUrl, r.isSelected]));
    setAllRoutes((prev) =>
      prev.map((r) => {
        const sel = selectedMap.get(r.canonicalUrl);
        return sel !== undefined ? { ...r, isSelected: sel } : r;
      })
    );
  };

  const handleTogglePreset = (presetId: string) => {
    setActivePresetIds((prev) =>
      prev.includes(presetId) ? prev.filter((id) => id !== presetId) : [...prev, presetId]
    );
  };

  const handleAddManualRoute = (e: React.FormEvent) => {
    e.preventDefault();
    setManualInputError(null);
    const res = addManualRoute(allRoutes, manualInput, baseUrl);
    if (!res.success) {
      setManualInputError(res.error || 'Failed to add route.');
      return;
    }
    setAllRoutes(res.routes);
    setManualInput('');
  };

  const handleRemoveManualRoute = (canonicalUrl: string) => {
    setAllRoutes((prev) => removeManualRoute(prev, canonicalUrl));
  };

  const handleMoveOrder = (canonicalUrl: string, direction: 'up' | 'down') => {
    const currentOrdered = orderRoutesByMode(allRoutes, 'manual-order', manualOrderUrls);
    const moved = moveRouteOrder(currentOrdered, canonicalUrl, direction);
    setManualOrderUrls(moved.map((r) => r.canonicalUrl));
  };

  const handleExportClick = () => {
    const selectedRoutes = cappedResult.routes.filter((r) => r.isSelected);
    onStartExport(selectedRoutes);
  };

  return (
    <div
      className="route-review-panel"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        padding: '12px',
        backgroundColor: '#ffffff',
        borderRadius: '8px',
        fontSize: '12px'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: '#111827' }}>
          Select Pages to Export
        </h3>
        <span style={{ fontSize: '11px', color: '#6b7280' }}>
          {allRoutes.length} route{allRoutes.length === 1 ? '' : 's'} discovered
        </span>
      </div>

      {/* Filters (Search, Presets, Regex, Caps) */}
      <RouteFilters
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        activePresetIds={activePresetIds}
        onTogglePreset={handleTogglePreset}
        customRegexPattern={customRegexPattern}
        onRegexChange={setCustomRegexPattern}
        regexError={regexValidation.error}
        excludeDestructive={excludeDestructive}
        onToggleExcludeDestructive={setExcludeDestructive}
        pageCap={pageCap}
        onPageCapChange={setPageCap}
      />

      {/* Numbering Modes & Odd/Even Parity Controls */}
      <OddEvenSelector
        mode={mode}
        onModeChange={setMode}
        onSelectOdd={handleSelectOdd}
        onSelectEven={handleSelectEven}
        onSelectAll={handleSelectAll}
        onDeselectAll={handleDeselectAll}
        onInvert={handleInvert}
        selectionSummary={paritySummary}
        totalSelected={totalSelected}
        totalRoutes={orderedRoutes.length}
      />

      {/* Manual Route Input Form */}
      <form onSubmit={handleAddManualRoute} style={{ display: 'flex', gap: '6px' }}>
        <input
          type="text"
          placeholder="Add unlinked internal route (e.g. /custom)..."
          value={manualInput}
          onChange={(e) => setManualInput(e.target.value)}
          style={{
            flex: 1,
            padding: '3px 6px',
            fontSize: '11px',
            borderRadius: '4px',
            border: '1px solid #d1d5db'
          }}
        />
        <button
          type="submit"
          style={{
            fontSize: '11px',
            padding: '3px 8px',
            borderRadius: '4px',
            border: '1px solid #d1d5db',
            backgroundColor: '#f3f4f6',
            cursor: 'pointer'
          }}
        >
          Add Route
        </button>
      </form>
      {manualInputError && (
        <div style={{ fontSize: '10px', color: '#b91c1c' }}>{manualInputError}</div>
      )}

      {/* Route List */}
      <div
        style={{
          maxHeight: '220px',
          overflowY: 'auto',
          border: '1px solid #e5e7eb',
          borderRadius: '6px',
          padding: '4px'
        }}
      >
        {orderedRoutes.length === 0 ? (
          <div style={{ padding: '16px', textAlign: 'center', color: '#9ca3af', fontSize: '11px' }}>
            No routes match the current filters.
          </div>
        ) : (
          orderedRoutes.map((route, idx) => (
            <div
              key={route.canonicalUrl}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '4px 6px',
                borderBottom: idx < orderedRoutes.length - 1 ? '1px solid #f3f4f6' : 'none',
                backgroundColor: route.isSelected ? '#f0f9ff' : 'transparent',
                borderRadius: '4px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                <input
                  type="checkbox"
                  checked={route.isSelected}
                  onChange={() => handleToggleRoute(route.canonicalUrl)}
                  aria-label={`Select ${route.pathname}`}
                  style={{ cursor: 'pointer' }}
                />

                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span
                      data-testid="route-item-title"
                      style={{
                        fontSize: '11px',
                        fontWeight: 500,
                        color: '#111827',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                      title={route.title || route.navigationLabel || route.pathname}
                    >
                      {route.title || route.navigationLabel || route.pathname}
                    </span>
                    {route.paginationNumber !== null && (
                      <span
                        data-testid="pagination-badge"
                        style={{
                          fontSize: '9px',
                          padding: '1px 4px',
                          borderRadius: '4px',
                          backgroundColor: '#e0e7ff',
                          color: '#3730a3',
                          fontWeight: 600
                        }}
                      >
                        P.{route.paginationNumber}
                      </span>
                    )}
                  </div>

                  <span
                    data-testid="route-item-path"
                    style={{
                      fontSize: '10px',
                      color: '#6b7280',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                    title={route.canonicalUrl}
                  >
                    {route.pathname}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                <span
                  data-testid="category-badge"
                  style={{
                    fontSize: '9px',
                    padding: '1px 5px',
                    borderRadius: '10px',
                    backgroundColor: '#f3f4f6',
                    color: '#4b5563'
                  }}
                >
                  {route.category.split('/')[0]}
                </span>

                {route.discoverySource === 'manual' && (
                  <button
                    type="button"
                    onClick={() => handleRemoveManualRoute(route.canonicalUrl)}
                    title="Remove manual route"
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#9ca3af',
                      cursor: 'pointer',
                      padding: '0 2px',
                      fontSize: '12px'
                    }}
                  >
                    ×
                  </button>
                )}

                {mode === 'manual-order' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                    <button
                      type="button"
                      onClick={() => handleMoveOrder(route.canonicalUrl, 'up')}
                      disabled={idx === 0}
                      style={{ fontSize: '8px', padding: '0 2px', cursor: 'pointer' }}
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveOrder(route.canonicalUrl, 'down')}
                      disabled={idx === orderedRoutes.length - 1}
                      style={{ fontSize: '8px', padding: '0 2px', cursor: 'pointer' }}
                    >
                      ▼
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Capping Warning */}
      {cappedResult.isCapped && (
        <div
          data-testid="cap-warning"
          style={{
            fontSize: '11px',
            color: '#b45309',
            backgroundColor: '#fffbeb',
            padding: '6px 8px',
            borderRadius: '4px',
            border: '1px solid #fde68a'
          }}
        >
          {cappedResult.warning}
        </div>
      )}

      {/* Action Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
        <span style={{ fontSize: '11px', color: '#4b5563' }}>
          {cappedResult.selectedCount} page{cappedResult.selectedCount === 1 ? '' : 's'} ready
        </span>

        <button
          type="button"
          onClick={handleExportClick}
          disabled={cappedResult.selectedCount === 0 || isExporting}
          style={{
            backgroundColor: cappedResult.selectedCount === 0 || isExporting ? '#9ca3af' : '#2563eb',
            color: '#ffffff',
            fontWeight: 600,
            fontSize: '12px',
            padding: '6px 14px',
            borderRadius: '6px',
            border: 'none',
            cursor: cappedResult.selectedCount === 0 || isExporting ? 'not-allowed' : 'pointer'
          }}
        >
          {isExporting ? 'Exporting...' : `Export ${cappedResult.selectedCount} Pages`}
        </button>
      </div>
    </div>
  );
};
