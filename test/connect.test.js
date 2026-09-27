import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBlock, EMPTY } from '../src/core/grid.js';
import { applyHit } from '../src/core/carve.js';
import { findFloating, groupPieces, removeFloating, connectedMask } from '../src/core/connect.js';

function column(size = 8) {
  // A column of stone on the pedestal: x = 3, z = 3, y = 1 to 6.
  return createBlock({ size, box: { x0: 3, x1: 3, y0: 1, y1: 6, z0: 3, z1: 3 } });
}

test('a full block has no floating voxels', () => {
  const grid = createBlock();
  assert.equal(findFloating(grid).length, 0);
});

test('a cut column makes the top part fall', () => {
  const grid = column();
  grid.set(3, 3, 3, EMPTY);
  const floating = findFloating(grid);
  assert.equal(floating.length, 3);
  const pieces = removeFloating(grid);
  assert.equal(pieces.length, 1);
  assert.equal(pieces[0].length, 3);
  assert.equal(pieces[0][0].value, 1);
  assert.equal(grid.get(3, 4, 3), EMPTY);
  assert.equal(grid.get(3, 2, 3), 1);
});

test('two separate floating parts become two pieces', () => {
  const grid = createBlock({ size: 8, box: { x0: 0, x1: 0, y0: 1, y1: 1, z0: 0, z1: 0 } });
  grid.set(1, 4, 1, 1);
  grid.set(1, 5, 1, 1);
  grid.set(6, 6, 6, 2);
  const pieces = groupPieces(grid, findFloating(grid));
  assert.equal(pieces.length, 2);
  assert.deepEqual(pieces.map((p) => p.length).sort(), [1, 2]);
});

test('voxels that touch only at an edge are not connected', () => {
  const grid = createBlock({ size: 8, box: { x0: 2, x1: 2, y0: 1, y1: 1, z0: 2, z1: 2 } });
  // This voxel touches the column only at an edge.
  grid.set(3, 2, 2, 1);
  assert.equal(findFloating(grid).length, 1);
});

test('the mask marks the pedestal and the connected stone', () => {
  const grid = column();
  const mask = connectedMask(grid);
  assert.equal(mask[grid.index(0, 0, 0)], 1);
  assert.equal(mask[grid.index(3, 6, 3)], 1);
  assert.equal(mask[grid.index(4, 6, 3)], 0);
});

test('a hammer hit through a thin wall drops the top', () => {
  const grid = createBlock({ size: 16, box: { x0: 0, x1: 15, y0: 1, y1: 15, z0: 7, z1: 8 } });
  // Cut the wall along a line with the hammer.
  for (let x = 0; x < 16; x += 2) applyHit(grid, 'hammer', x, 5, 7);
  const pieces = removeFloating(grid);
  assert.equal(pieces.length, 1);
  assert.equal(grid.get(8, 12, 7), EMPTY);
  assert.equal(grid.get(8, 1, 7), 1);
});
