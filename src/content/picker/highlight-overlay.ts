/**
 * Highlight Overlay for Element Picker.
 * Draws an outline over targeted DOM elements with zero host layout shift.
 * Excluded from DOM extraction via data-w2f-exclude="true".
 */

export interface HighlightRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const PICKER_HOST_ID = 'w2f-picker-host';
const HIGHLIGHT_BOX_ID = 'w2f-highlight-box';

export class HighlightOverlay {
  private host: HTMLElement | null = null;
  private box: HTMLDivElement | null = null;

  constructor() {
    this.ensureHost();
  }

  getHost(): HTMLElement {
    if (!this.host) {
      this.ensureHost();
    }
    return this.host!;
  }

  private ensureHost(): HTMLElement {
    let existingHost = document.getElementById(PICKER_HOST_ID);
    if (!existingHost) {
      existingHost = document.createElement('div');
      existingHost.id = PICKER_HOST_ID;
      existingHost.setAttribute('data-w2f-exclude', 'true');
      existingHost.className = 'w2f-picker-host';
      (document.body || document.documentElement).appendChild(existingHost);
    }
    this.host = existingHost;

    let existingBox = existingHost.querySelector<HTMLDivElement>(`#${HIGHLIGHT_BOX_ID}`);
    if (!existingBox) {
      existingBox = document.createElement('div');
      existingBox.id = HIGHLIGHT_BOX_ID;
      existingBox.setAttribute('data-w2f-exclude', 'true');
      existingBox.className = 'w2f-highlight-box';
      existingBox.style.display = 'none';
      existingHost.appendChild(existingBox);
    }
    this.box = existingBox;

    return this.host;
  }

  show(rect: HighlightRect, isSelected = false): void {
    this.ensureHost();
    if (!this.box) return;

    this.box.style.display = 'block';
    this.box.style.left = `${Math.round(rect.x)}px`;
    this.box.style.top = `${Math.round(rect.y)}px`;
    this.box.style.width = `${Math.round(rect.width)}px`;
    this.box.style.height = `${Math.round(rect.height)}px`;

    if (isSelected) {
      this.box.className = 'w2f-highlight-box selected';
    } else {
      this.box.className = 'w2f-highlight-box hovered';
    }
  }

  hide(): void {
    if (this.box) {
      this.box.style.display = 'none';
    }
  }

  destroy(): void {
    if (this.host && this.host.parentElement) {
      this.host.parentElement.removeChild(this.host);
    }
    this.host = null;
    this.box = null;
  }
}
