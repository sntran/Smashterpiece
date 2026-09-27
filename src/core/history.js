// The undo history. This module does not use three.js or the DOM.
// Each step is a copy of the grid cells before a hit.

export const UNDO_STEPS = 30;

export class History {
  constructor(limit = UNDO_STEPS) {
    this.limit = limit;
    this.steps = [];
  }

  get size() {
    return this.steps.length;
  }

  canUndo() {
    return this.steps.length > 0;
  }

  // Keep a copy of the cells. When the history is full, forget the oldest step.
  push(cells) {
    this.steps.push(cells.slice());
    if (this.steps.length > this.limit) this.steps.shift();
  }

  // Return the cells of the last step, or null when there are no steps.
  undo() {
    return this.steps.pop() ?? null;
  }

  clear() {
    this.steps.length = 0;
  }
}
