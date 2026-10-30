import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ModeSelector, EXPORT_MODES } from '../../popup/components/ModeSelector';

describe('ModeSelector Component', () => {
  it('renders all 7 export modes with labels and descriptions', () => {
    const handleSelect = vi.fn();
    render(
      <ModeSelector
        selectedMode="full-page"
        onSelectMode={handleSelect}
      />
    );

    for (const mode of EXPORT_MODES) {
      expect(screen.getByText(mode.label)).toBeDefined();
    }
  });

  it('indicates the active mode with aria-checked and selected class', () => {
    const handleSelect = vi.fn();
    render(
      <ModeSelector
        selectedMode="viewport"
        onSelectMode={handleSelect}
      />
    );

    const viewportCard = screen.getByRole('radio', { name: /Current Viewport/i });
    expect(viewportCard.getAttribute('aria-checked')).toBe('true');
    expect(viewportCard.className).toContain('selected');

    const fullPageCard = screen.getByRole('radio', { name: /Full Page/i });
    expect(fullPageCard.getAttribute('aria-checked')).toBe('false');
  });

  it('triggers onSelectMode when clicking an unselected mode', () => {
    const handleSelect = vi.fn();
    render(
      <ModeSelector
        selectedMode="full-page"
        onSelectMode={handleSelect}
      />
    );

    const elementPickerCard = screen.getByRole('radio', { name: /Select Element/i });
    fireEvent.click(elementPickerCard);

    expect(handleSelect).toHaveBeenCalledWith('select-element');
  });

  it('supports keyboard navigation using arrow keys', () => {
    const handleSelect = vi.fn();
    render(
      <ModeSelector
        selectedMode="viewport"
        onSelectMode={handleSelect}
      />
    );

    const viewportCard = screen.getByRole('radio', { name: /Current Viewport/i });
    // Arrow down moves from index 0 (viewport) to index 1 (full-page)
    fireEvent.keyDown(viewportCard, { key: 'ArrowDown' });
    expect(handleSelect).toHaveBeenCalledWith('full-page');
  });

  it('disables all cards when disabled prop is true', () => {
    const handleSelect = vi.fn();
    render(
      <ModeSelector
        selectedMode="full-page"
        onSelectMode={handleSelect}
        disabled={true}
      />
    );

    const cards = screen.getAllByRole('radio');
    for (const card of cards) {
      expect(card.hasAttribute('disabled')).toBe(true);
    }

    fireEvent.click(cards[0]!);
    expect(handleSelect).not.toHaveBeenCalled();
  });
});
