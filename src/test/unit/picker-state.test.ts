import { describe, it, expect, beforeEach } from 'vitest';
import {
  PickerStateMachine,
  buildHierarchyChain
} from '../../content/picker/picker-state';

describe('Picker State Machine', () => {
  let sm: PickerStateMachine;
  let section: HTMLElement;
  let card: HTMLDivElement;
  let button: HTMLButtonElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    section = document.createElement('section');
    card = document.createElement('div');
    card.className = 'card';
    button = document.createElement('button');
    button.textContent = 'Click me';

    card.appendChild(button);
    section.appendChild(card);
    document.body.appendChild(section);

    sm = new PickerStateMachine();
  });

  it('initializes in idle state', () => {
    const state = sm.getState();
    expect(state.phase).toBe('idle');
    expect(state.hoveredElement).toBeNull();
    expect(state.selectedElement).toBeNull();
    expect(state.hierarchyChain).toEqual([]);
    expect(state.hierarchyIndex).toBe(-1);
    expect(state.includeAncestorBackground).toBe(false);
  });

  it('activates and clears previous state', () => {
    sm.activate();
    expect(sm.getState().phase).toBe('active');
  });

  it('buildHierarchyChain filters out excluded extension elements', () => {
    const extensionWrapper = document.createElement('div');
    extensionWrapper.setAttribute('data-w2f-exclude', 'true');
    const innerEl = document.createElement('span');
    extensionWrapper.appendChild(innerEl);
    section.appendChild(extensionWrapper);

    const chain = buildHierarchyChain(innerEl);
    expect(chain.includes(extensionWrapper)).toBe(false);
    expect(chain.includes(innerEl)).toBe(true);
    expect(chain.includes(section)).toBe(true);
  });

  it('sets hovered element and initializes hierarchy at deepest leaf', () => {
    sm.activate();
    sm.setHovered(button);

    const state = sm.getState();
    expect(state.phase).toBe('hovered');
    expect(state.hoveredElement).toBe(button);
    expect(state.hierarchyChain.length).toBeGreaterThanOrEqual(3); // body -> section -> card -> button
    expect(state.hierarchyIndex).toBe(state.hierarchyChain.length - 1);
    expect(sm.getCurrentTarget()).toBe(button);
  });

  it('cycles parent and child up and down the DOM tree', () => {
    sm.activate();
    sm.setHovered(button);

    // Initial is button
    expect(sm.getCurrentTarget()).toBe(button);

    // Cycle up to card
    const parentTarget = sm.cycleParent();
    expect(parentTarget).toBe(card);
    expect(sm.getCurrentTarget()).toBe(card);

    // Cycle up to section
    const grandParent = sm.cycleParent();
    expect(grandParent).toBe(section);

    // Cycle back down to card
    const childTarget = sm.cycleChild();
    expect(childTarget).toBe(card);

    // Cycle down to button
    const leafTarget = sm.cycleChild();
    expect(leafTarget).toBe(button);

    // Cannot cycle deeper than leaf
    const boundedLeaf = sm.cycleChild();
    expect(boundedLeaf).toBe(button);
  });

  it('selects current target and transitions to selected phase', () => {
    sm.activate();
    sm.setHovered(button);
    sm.cycleParent(); // targets card

    const selected = sm.select();
    expect(selected).toBe(card);
    expect(sm.getState().phase).toBe('selected');
    expect(sm.getState().selectedElement).toBe(card);
  });

  it('toggles ancestor background option', () => {
    expect(sm.getState().includeAncestorBackground).toBe(false);
    sm.toggleAncestorBackground();
    expect(sm.getState().includeAncestorBackground).toBe(true);
    sm.toggleAncestorBackground(false);
    expect(sm.getState().includeAncestorBackground).toBe(false);
  });

  it('confirms selection and returns element with options', () => {
    sm.activate();
    sm.setHovered(button);
    sm.select();
    sm.toggleAncestorBackground(true);

    const result = sm.confirm();
    expect(result).not.toBeNull();
    expect(result?.element).toBe(button);
    expect(result?.includeAncestorBackground).toBe(true);
    expect(sm.getState().phase).toBe('confirmed');
  });

  it('cancels and resets state cleanly', () => {
    sm.activate();
    sm.setHovered(button);
    sm.cancel();

    expect(sm.getState().phase).toBe('cancelled');
    expect(sm.getState().hoveredElement).toBeNull();
    expect(sm.getCurrentTarget()).toBeNull();

    sm.reset();
    expect(sm.getState().phase).toBe('idle');
  });

  it('notifies subscribers on each state mutation', () => {
    const states: string[] = [];
    const unsub = sm.subscribe((st) => states.push(st.phase));

    sm.activate();
    sm.setHovered(button);
    sm.select();
    sm.cancel();
    unsub();

    expect(states).toEqual(['idle', 'active', 'hovered', 'selected', 'cancelled']);
  });
});
