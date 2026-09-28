// The undo history. This module does not use three.js or the DOM.
// Each step is the state before a change: a copy of the grid cells, or an
// object that the caller copied (for example cells, paint and stickers).

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

  // Keep a step. A typed array is copied. When the history is full,
  // forget the oldest step.
  push(state) {
    this.steps.push(typeof state.slice === 'function' ? state.slice() : state);
    if (this.steps.length > this.limit) this.steps.shift();
  }

  // Return the cells of the last step, or null when there are no steps.
  undo() {
    return this.steps.pop() ?? null;
  }

  clear() {
    this.steps.length = 0;
  }

  // Return the newest `count` steps, the oldest first.
  last(count) {
    return this.steps.slice(-count);
  }

  // Replace the steps.
  load(steps) {
    this.steps = steps.slice(-this.limit);
  }
}
