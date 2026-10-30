/**
 * Picker State Machine.
 * Manages element picker phases, target tracking, parent/child hierarchy navigation,
 * and export option toggles.
 */

export type PickerPhase =
  | 'idle'
  | 'active'
  | 'hovered'
  | 'selected'
  | 'cancelled'
  | 'confirmed';

export interface PickerState {
  phase: PickerPhase;
  hoveredElement: Element | null;
  selectedElement: Element | null;
  hierarchyChain: Element[];
  hierarchyIndex: number;
  includeAncestorBackground: boolean;
}

export type PickerListener = (state: PickerState) => void;

/**
 * Builds the ancestor chain from target element up to document.body,
 * filtering out any extension elements tagged with data-w2f-exclude="true".
 */
export function buildHierarchyChain(target: Element): Element[] {
  const chain: Element[] = [];
  let curr: Element | null = target;

  while (curr && curr !== document.documentElement) {
    if (!curr.hasAttribute('data-w2f-exclude')) {
      chain.unshift(curr);
    }
    curr = curr.parentElement;
  }

  return chain;
}

export class PickerStateMachine {
  private state: PickerState;
  private listeners: Set<PickerListener> = new Set();

  constructor() {
    this.state = {
      phase: 'idle',
      hoveredElement: null,
      selectedElement: null,
      hierarchyChain: [],
      hierarchyIndex: -1,
      includeAncestorBackground: false
    };
  }

  getState(): Readonly<PickerState> {
    return this.state;
  }

  subscribe(listener: PickerListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  activate(): void {
    this.state = {
      ...this.state,
      phase: 'active',
      hoveredElement: null,
      selectedElement: null,
      hierarchyChain: [],
      hierarchyIndex: -1
    };
    this.notify();
  }

  setHovered(el: Element | null): void {
    if (this.state.phase !== 'active' && this.state.phase !== 'hovered') {
      return;
    }

    if (!el) {
      this.state = {
        ...this.state,
        phase: 'active',
        hoveredElement: null,
        hierarchyChain: [],
        hierarchyIndex: -1
      };
      this.notify();
      return;
    }

    const chain = buildHierarchyChain(el);
    this.state = {
      ...this.state,
      phase: 'hovered',
      hoveredElement: el,
      hierarchyChain: chain,
      hierarchyIndex: chain.length - 1
    };
    this.notify();
  }

  getCurrentTarget(): Element | null {
    if (this.state.hierarchyIndex >= 0 && this.state.hierarchyChain[this.state.hierarchyIndex]) {
      return this.state.hierarchyChain[this.state.hierarchyIndex] ?? null;
    }
    return this.state.selectedElement ?? this.state.hoveredElement;
  }

  cycleParent(): Element | null {
    if (this.state.hierarchyIndex > 0) {
      this.state = {
        ...this.state,
        hierarchyIndex: this.state.hierarchyIndex - 1
      };
      this.notify();
      return this.getCurrentTarget();
    }
    return this.getCurrentTarget();
  }

  cycleChild(): Element | null {
    if (this.state.hierarchyIndex < this.state.hierarchyChain.length - 1) {
      this.state = {
        ...this.state,
        hierarchyIndex: this.state.hierarchyIndex + 1
      };
      this.notify();
      return this.getCurrentTarget();
    }
    return this.getCurrentTarget();
  }

  select(el?: Element): Element | null {
    const target = el ?? this.getCurrentTarget();
    if (!target) return null;

    const chain = buildHierarchyChain(target);
    this.state = {
      ...this.state,
      phase: 'selected',
      selectedElement: target,
      hierarchyChain: chain,
      hierarchyIndex: chain.length - 1
    };
    this.notify();
    return target;
  }

  toggleAncestorBackground(force?: boolean): boolean {
    const newVal = typeof force === 'boolean' ? force : !this.state.includeAncestorBackground;
    this.state = {
      ...this.state,
      includeAncestorBackground: newVal
    };
    this.notify();
    return newVal;
  }

  confirm(): { element: Element; includeAncestorBackground: boolean } | null {
    const target = this.getCurrentTarget() || this.state.selectedElement;
    if (!target) return null;

    this.state = {
      ...this.state,
      phase: 'confirmed',
      selectedElement: target
    };
    this.notify();

    return {
      element: target,
      includeAncestorBackground: this.state.includeAncestorBackground
    };
  }

  cancel(): void {
    this.state = {
      phase: 'cancelled',
      hoveredElement: null,
      selectedElement: null,
      hierarchyChain: [],
      hierarchyIndex: -1,
      includeAncestorBackground: false
    };
    this.notify();
  }

  reset(): void {
    this.state = {
      phase: 'idle',
      hoveredElement: null,
      selectedElement: null,
      hierarchyChain: [],
      hierarchyIndex: -1,
      includeAncestorBackground: false
    };
    this.notify();
  }
}
