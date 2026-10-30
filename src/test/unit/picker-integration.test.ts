import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { handleRuntimeMessage } from '../../background/message-router';
import { browser } from '../../shared/browser/browser-api';
import { elementPicker } from '../../content/entry';

describe('Picker Integration & Message Handshake', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    elementPicker.stop();
  });

  describe('Background Message Routing for Element Picker', () => {
    it('routes ACTIVATE_ELEMENT_PICKER to the active tab', async () => {
      // Mock active tab
      vi.spyOn(browser.tabs, 'query').mockResolvedValue([
        { id: 42, active: true, currentWindow: true, url: 'https://example.com' } as any
      ]);
      const sendMsgSpy = vi.spyOn(browser.tabs, 'sendMessage').mockResolvedValue({ active: true });

      const response = await handleRuntimeMessage({
        id: 'req_pick_1',
        type: 'ACTIVATE_ELEMENT_PICKER',
        payload: { options: { includeAncestorBackground: true } },
        timestamp: Date.now()
      });

      expect(sendMsgSpy).toHaveBeenCalledWith(42, {
        type: 'ACTIVATE_ELEMENT_PICKER',
        payload: { includeAncestorBackground: true }
      });
      expect(response.success).toBe(true);
      expect((response.payload as any)?.active).toBe(true);
    });

    it('routes CANCEL_ELEMENT_PICKER to the active tab', async () => {
      vi.spyOn(browser.tabs, 'query').mockResolvedValue([
        { id: 42, active: true, currentWindow: true, url: 'https://example.com' } as any
      ]);
      const sendMsgSpy = vi.spyOn(browser.tabs, 'sendMessage').mockResolvedValue({ active: false });

      const response = await handleRuntimeMessage({
        id: 'req_pick_2',
        type: 'CANCEL_ELEMENT_PICKER',
        payload: {},
        timestamp: Date.now()
      });

      expect(sendMsgSpy).toHaveBeenCalledWith(42, {
        type: 'CANCEL_ELEMENT_PICKER'
      });
      expect(response.success).toBe(true);
      expect((response.payload as any)?.active).toBe(false);
    });
  });

  describe('Content Script elementPicker lifecycle', () => {
    it('activates and stops the global elementPicker singleton', () => {
      expect(elementPicker.isActive()).toBe(false);
      elementPicker.start();
      expect(elementPicker.isActive()).toBe(true);
      elementPicker.stop();
      expect(elementPicker.isActive()).toBe(false);
    });
  });
});
