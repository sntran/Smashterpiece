import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBlock, VoxelGrid, PEDESTAL, EMPTY } from '../src/core/grid.js';
import { isLoose, crumbleSand } from '../src/core/sand.js';
import { crumblesOf } from '../src/core/stones.js';

function emptyWithPedestal(size = 8) {
  const grid = new VoxelGrid(size);
  for (let z = 0; z < size; z++) for (let x = 0; x < size; x++) grid.set(x, 0, z, PEDESTAL);
  return grid;
}

test('only sand crumbles', () => {
  assert.equal(crumblesOf('sand'), true);
  assert.equal(crumblesOf('sandstone'), false);
  assert.equal(crumblesOf('glass'), false);
});

test('a column of sand on the pedestal stays', () => {
  const grid = emptyWithPedestal();
  for (let y = 1; y < 6; y++) grid.set(3, y, 3, 1);
  assert.equal(crumbleSand(grid, 3, 3, 3).length, 0);
  assert.equal(grid.countStone(), 5);
});

test('a thin part that hangs in the air crumbles', () => {
  const grid = emptyWithPedestal();
  // A wall with a thin arm that hangs down from the top.
  for (let y = 1; y < 7; y++) grid.set(1, y, 3, 1);
  grid.set(2, 6, 3, 1);
  grid.set(3, 6, 3, 1);
  grid.set(3, 5, 3, 1);
  grid.set(3, 4, 3, 1);
  assert.equal(isLoose(grid, 3, 4, 3), true);
  const removed = crumbleSand(grid, 3, 4, 3);
  // The arm crumbles from the bottom up: (3,4), (3,5), (3,6), then (2,6).
  assert.equal(removed.length, 4);
  assert.equal(grid.get(2, 6, 3), EMPTY);
  assert.equal(grid.get(1, 6, 3), 1);
});

test('a thick part that hangs in the air stays', () => {
  const grid = createBlock({ size: 8 });
  // Dig a tunnel under the top layers. The roof has many side neighbors.
  for (let z = 0; z < 8; z++) for (let x = 2; x < 6; x++) for (let y = 1; y < 4; y++) grid.set(x, y, z, EMPTY);
  assert.equal(crumbleSand(grid, 4, 4, 4).length, 0);
});
