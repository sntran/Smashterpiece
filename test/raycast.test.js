import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBlock, VoxelGrid } from '../src/core/grid.js';
import { raycastGrid } from '../src/core/raycast.js';

test('a ray from the front hits the front face', () => {
  const grid = createBlock({ size: 8 });
  const hit = raycastGrid(grid, [4.5, 4.5, 20], [0, 0, -1]);
  assert.deepEqual([hit.x, hit.y, hit.z], [4, 4, 7]);
  assert.deepEqual(hit.normal, [0, 0, 1]);
  assert.ok(Math.abs(hit.distance - 12) < 1e-9);
});

test('a ray from above hits the top face', () => {
  const grid = createBlock({ size: 8 });
  const hit = raycastGrid(grid, [2.5, 30, 3.5], [0, -1, 0]);
  assert.deepEqual([hit.x, hit.y, hit.z], [2, 7, 3]);
  assert.deepEqual(hit.normal, [0, 1, 0]);
});

test('a ray goes through empty cells to the next solid cell', () => {
  const grid = createBlock({ size: 8, box: { x0: 0, x1: 7, y0: 1, y1: 1, z0: 0, z1: 7 } });
  const hit = raycastGrid(grid, [-5, 8, 3.5], [1, -1, 0]);
  assert.equal(hit.y, 1);
  assert.deepEqual(hit.normal, [0, 1, 0]);
});

test('a ray that misses gives null', () => {
  const grid = createBlock({ size: 8 });
  assert.equal(raycastGrid(grid, [4, 20, 4], [0, 1, 0]), null);
  assert.equal(raycastGrid(grid, [-5, 4, 4], [0, 0, 1]), null);
  assert.equal(raycastGrid(new VoxelGrid(8), [4, 4, 20], [0, 0, -1]), null);
});

test('a slanted ray hits the pedestal when the stone is gone', () => {
  const grid = createBlock({ size: 8, box: { x0: 0, x1: -1, y0: 1, y1: 1, z0: 0, z1: 0 } });
  const hit = raycastGrid(grid, [4.2, 10, 20], [0.01, -0.5, -1]);
  assert.equal(hit.y, 0);
});
