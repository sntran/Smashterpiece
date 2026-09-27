import { test } from 'node:test';
import assert from 'node:assert/strict';
import { History, UNDO_STEPS } from '../src/core/history.js';

test('the history keeps at least 20 steps', () => {
  assert.ok(UNDO_STEPS >= 20);
  const history = new History();
  for (let i = 0; i < 25; i++) history.push(Uint8Array.from([i]));
  assert.equal(history.size, 25);
  for (let i = 24; i >= 0; i--) assert.equal(history.undo()[0], i);
  assert.equal(history.undo(), null);
  assert.equal(history.canUndo(), false);
});

test('the history forgets the oldest step when it is full', () => {
  const history = new History(3);
  for (let i = 0; i < 5; i++) history.push(Uint8Array.from([i]));
  assert.equal(history.size, 3);
  assert.equal(history.undo()[0], 4);
  assert.equal(history.undo()[0], 3);
  assert.equal(history.undo()[0], 2);
  assert.equal(history.undo(), null);
});

test('the history keeps a copy of the cells', () => {
  const history = new History();
  const cells = Uint8Array.from([1, 2, 3]);
  history.push(cells);
  cells[0] = 9;
  assert.equal(history.undo()[0], 1);
});

test('clear removes all steps', () => {
  const history = new History();
  history.push(new Uint8Array(2));
  history.clear();
  assert.equal(history.canUndo(), false);
});
