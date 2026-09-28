import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBlock, VoxelGrid, PEDESTAL, EMPTY } from '../src/core/grid.js';
import { sphereCells, fileCells, applyHit, planHit, toolTargets, faceNeighbors } from '../src/core/carve.js';

test('the hammer removes a sphere with radius 3', () => {
  const grid = createBlock({ hardness: 1 });
  const before = grid.countStone();
  const result = applyHit(grid, 'hammer', 16, 16, 16);
  // A sphere with radius 3 on a grid has 123 voxels.
  assert.equal(result.removed.length, 123);
  assert.equal(grid.countStone(), before - 123);
  assert.equal(grid.get(16, 16, 16), EMPTY);
  assert.equal(grid.get(19, 16, 16), EMPTY);
  assert.equal(grid.get(20, 16, 16), 1);
  assert.equal(grid.get(18, 18, 16), EMPTY);
  assert.equal(grid.get(18, 19, 16), 1);
});

test('the point chisel removes a sphere with radius 1', () => {
  const grid = createBlock({ hardness: 1 });
  const result = applyHit(grid, 'chisel', 10, 10, 10);
  assert.equal(result.removed.length, 7);
  assert.equal(grid.get(10, 10, 10), EMPTY);
  assert.equal(grid.get(11, 10, 10), EMPTY);
  assert.equal(grid.get(11, 11, 10), 1);
});

test('the tools never remove the pedestal', () => {
  const grid = createBlock({ hardness: 1 });
  applyHit(grid, 'hammer', 16, 0, 16);
  for (let z = 0; z < 32; z++) {
    for (let x = 0; x < 32; x++) assert.equal(grid.get(x, 0, z), PEDESTAL);
  }
  assert.equal(grid.get(16, 1, 16), EMPTY);
  assert.equal(sphereCells(grid, 16, 0, 16, 1).length, 0);
});

test('marble needs two hits and granite needs three hits', () => {
  const marble = createBlock({ hardness: 2 });
  let result = applyHit(marble, 'chisel', 5, 5, 5);
  assert.equal(result.removed.length, 0);
  assert.equal(result.cracked.length, 7);
  assert.equal(marble.get(5, 5, 5), 1);
  result = applyHit(marble, 'chisel', 5, 5, 5);
  assert.equal(result.removed.length, 7);
  assert.equal(marble.get(5, 5, 5), EMPTY);

  const granite = createBlock({ hardness: 3 });
  applyHit(granite, 'chisel', 5, 5, 5);
  applyHit(granite, 'chisel', 5, 5, 5);
  assert.equal(granite.get(5, 5, 5), 1);
  applyHit(granite, 'chisel', 5, 5, 5);
  assert.equal(granite.get(5, 5, 5), EMPTY);
});

test('planHit does not change the grid', () => {
  const grid = createBlock({ hardness: 2 });
  const copy = grid.cells.slice();
  const plan = planHit(grid, 'hammer', 8, 8, 8);
  assert.equal(plan.cracked.length, 123);
  assert.deepEqual(grid.cells, copy);
});

test('the file removes a voxel that sticks out of a flat surface', () => {
  const grid = createBlock({ size: 8, box: { x0: 0, x1: 7, y0: 1, y1: 2, z0: 0, z1: 7 } });
  // Put one bump on the top surface.
  grid.set(4, 3, 4, 1);
  assert.equal(faceNeighbors(grid, 4, 3, 4), 1);
  const targets = fileCells(grid, 4, 3, 4);
  assert.deepEqual(targets, [grid.index(4, 3, 4)]);
  applyHit(grid, 'file', 4, 3, 4);
  assert.equal(grid.get(4, 3, 4), EMPTY);
});

test('the file does not dig into a flat surface', () => {
  const grid = createBlock({ size: 8, box: { x0: 0, x1: 7, y0: 1, y1: 2, z0: 0, z1: 7 } });
  const before = grid.countStone();
  const result = applyHit(grid, 'file', 4, 2, 4);
  assert.equal(result.removed.length, 0);
  assert.equal(grid.countStone(), before);
});

test('toolTargets rejects an unknown tool', () => {
  assert.throws(() => toolTargets(new VoxelGrid(4), 'spoon', 1, 1, 1));
});

test('the easy mode makes the hammer one voxel larger', () => {
  const normal = createBlock({ hardness: 1 });
  const easy = createBlock({ hardness: 1 });
  const a = applyHit(normal, 'hammer', 16, 16, 16).removed.length;
  const b = applyHit(easy, 'hammer', 16, 16, 16, true).removed.length;
  assert.equal(a, 123);
  assert.ok(b > a);
  assert.equal(b, sphereCells(createBlock(), 16, 16, 16, 4).length);
});
