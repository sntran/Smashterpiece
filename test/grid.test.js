import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VoxelGrid, createBlock, GRID_SIZE, PEDESTAL, EMPTY, isStone } from '../src/core/grid.js';
import { hardnessOf, STONE_NAMES } from '../src/core/stones.js';

test('a new grid is empty and has 32 x 32 x 32 cells', () => {
  const grid = new VoxelGrid();
  assert.equal(grid.size, 32);
  assert.equal(grid.cells.length, 32 * 32 * 32);
  assert.equal(grid.countStone(), 0);
});

test('index and coords agree', () => {
  const grid = new VoxelGrid(8);
  for (const [x, y, z] of [[0, 0, 0], [7, 0, 0], [0, 7, 0], [0, 0, 7], [3, 5, 6]]) {
    assert.deepEqual(grid.coords(grid.index(x, y, z)), [x, y, z]);
  }
});

test('cells out of the grid are empty', () => {
  const grid = createBlock({ size: 4 });
  assert.equal(grid.get(-1, 1, 1), EMPTY);
  assert.equal(grid.get(4, 1, 1), EMPTY);
  assert.equal(grid.isSolid(1, 1, 1), true);
  grid.set(9, 9, 9, 1);
  assert.equal(grid.countStone(), 4 * 3 * 4);
});

test('createBlock puts a pedestal in the bottom layer', () => {
  const grid = createBlock({ hardness: 2 });
  for (let z = 0; z < GRID_SIZE; z++) {
    for (let x = 0; x < GRID_SIZE; x++) assert.equal(grid.get(x, 0, z), PEDESTAL);
  }
  assert.equal(grid.get(5, 1, 5), 2);
  assert.equal(grid.countStone(), 32 * 31 * 32);
});

test('createBlock can make a smaller block', () => {
  const grid = createBlock({ size: 8, box: { x0: 2, x1: 3, y0: 1, y1: 2, z0: 4, z1: 4 } });
  assert.equal(grid.countStone(), 2 * 2 * 1);
  assert.equal(grid.get(2, 1, 4), 1);
  assert.equal(grid.get(2, 1, 3), EMPTY);
});

test('clone makes a separate copy', () => {
  const grid = createBlock({ size: 4 });
  const copy = grid.clone();
  copy.set(1, 1, 1, EMPTY);
  assert.equal(grid.get(1, 1, 1), 1);
});

test('isStone is false for empty and pedestal cells', () => {
  assert.equal(isStone(EMPTY), false);
  assert.equal(isStone(PEDESTAL), false);
  assert.equal(isStone(3), true);
});

test('each stone has the correct hardness', () => {
  assert.deepEqual(STONE_NAMES, ['sand', 'sandstone', 'chocolate', 'cheese', 'ice', 'wood', 'marble', 'glass', 'granite']);
  assert.equal(hardnessOf('sand'), 1);
  assert.equal(hardnessOf('glass'), 2);
  assert.equal(hardnessOf('sandstone'), 1);
  assert.equal(hardnessOf('marble'), 2);
  assert.equal(hardnessOf('granite'), 3);
  assert.throws(() => hardnessOf('banana'));
});
