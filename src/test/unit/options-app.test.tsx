import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { OptionsApp } from '../../options/OptionsApp';
import { browser } from '../../shared/browser/browser-api';
import { settingsStore, DEFAULT_EXTENSION_SETTINGS } from '../../core/settings/settings-store';

describe('OptionsApp Component', () => {
  beforeEach(async () => {
    await browser.storage.local.clear();
    await settingsStore.resetToDefaults();
  });

  it('renders preferences header, target badge, and default tab', async () => {
    render(<OptionsApp />);

    expect(await screen.findByText(/Web to Figma Preferences/i)).toBeDefined();
    expect(screen.getByRole('tab', { name: /Capture Profiles/i })).toBeDefined();
    expect(screen.getByRole('tab', { name: /General/i })).toBeDefined();
    expect(screen.getByRole('tab', { name: /Domain Overrides/i })).toBeDefined();
    expect(screen.getByRole('tab', { name: /Reset/i })).toBeDefined();
  });

  it('switches between navigation tabs', async () => {
    render(<OptionsApp />);

    await screen.findByRole('tab', { name: /Capture Profiles/i });

    // Switch to General tab
    const generalTab = screen.getByRole('tab', { name: /General/i });
    fireEvent.click(generalTab);
    expect(await screen.findByRole('heading', { name: /General Preferences/i })).toBeDefined();
    expect(screen.getByText(/Default Export Mode/i)).toBeDefined();

    // Switch to Domain Overrides tab
    const domainTab = screen.getByRole('tab', { name: /Domain Overrides/i });
    fireEvent.click(domainTab);
    expect(await screen.findByRole('heading', { name: /Per-Domain Overrides/i })).toBeDefined();

    // Switch to Reset tab
    const resetTab = screen.getByRole('tab', { name: /Reset/i });
    fireEvent.click(resetTab);
    expect(await screen.findByRole('heading', { name: /Reset All Settings/i })).toBeDefined();
  });

  it('allows selecting active capture profile', async () => {
    render(<OptionsApp />);

    await screen.findByRole('tab', { name: /Capture Profiles/i });

    // Click Desktop Compact profile card
    const compactCard = screen.getByRole('radio', { name: /Desktop Compact/i });
    fireEvent.click(compactCard);

    await waitFor(async () => {
      const active = await settingsStore.getActiveProfile();
      expect(active.id).toBe('desktop-compact');
    });
  });

  it('allows adding and removing domain overrides', async () => {
    render(<OptionsApp />);

    const domainTab = await screen.findByRole('tab', { name: /Domain Overrides/i });
    fireEvent.click(domainTab);

    // Add new domain override
    const domainInput = screen.getByLabelText(/Domain/i);
    fireEvent.change(domainInput, { target: { value: 'github.com' } });

    const fontInput = screen.getByLabelText(/Font Fallback/i);
    fireEvent.change(fontInput, { target: { value: 'Mona Sans' } });

    const submitBtn = screen.getByRole('button', { name: /Add Override/i });
    fireEvent.click(submitBtn);

    expect(await screen.findByText('github.com')).toBeDefined();
    expect(screen.getByText('Mona Sans')).toBeDefined();

    // Verify stored
    const override = await settingsStore.getDomainOverride('github.com');
    expect(override).not.toBeNull();
    expect(override?.customFontFallback).toBe('Mona Sans');

    // Remove rule
    const deleteBtn = screen.getByRole('button', { name: /Delete/i });
    fireEvent.click(deleteBtn);

    await waitFor(async () => {
      const removed = await settingsStore.getDomainOverride('github.com');
      expect(removed).toBeNull();
    });
  });

  it('resets settings to factory defaults with confirmation', async () => {
    // First modify a setting
    await settingsStore.update({ defaultMode: 'select-element' });

    render(<OptionsApp />);

    const resetTab = await screen.findByRole('tab', { name: /Reset/i });
    fireEvent.click(resetTab);

    const initialResetBtn = screen.getByRole('button', { name: /Reset to Factory Defaults/i });
    fireEvent.click(initialResetBtn);

    // Confirmation button appears
    const confirmBtn = screen.getByRole('button', { name: /Yes, Confirm Reset/i });
    fireEvent.click(confirmBtn);

    await waitFor(async () => {
      const current = await settingsStore.getSettings();
      expect(current.defaultMode).toBe(DEFAULT_EXTENSION_SETTINGS.defaultMode);
    });
  });
});
