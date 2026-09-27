import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VoxelGrid } from '../src/core/grid.js';
import { buildMesh, AO_LEVELS } from '../src/core/mesher.js';

function meshOf(grid, extra = {}) {
  return buildMesh({
    x0: 0, y0: 0, z0: 0, x1: grid.size, y1: grid.size, z1: grid.size,
    solid: (x, y, z) => grid.isSolid(x, y, z),
    color: (x, y, z, out) => { out[0] = 1; out[1] = 0.5; out[2] = 0.25; },
    ...extra,
  });
}

test('one voxel has 6 faces', () => {
  const grid = new VoxelGrid(4);
  grid.set(1, 1, 1, 1);
  const mesh = meshOf(grid);
  assert.equal(mesh.faces, 6);
  assert.equal(mesh.positions.length, 6 * 4 * 3);
  assert.equal(mesh.indices.length, 6 * 6);
  // One voxel alone has no ambient occlusion.
  assert.ok(mesh.colors.every((c, i) => Math.abs(c - [1, 0.5, 0.25][i % 3]) < 1e-6));
});

test('two voxels side by side have 10 faces', () => {
  const grid = new VoxelGrid(4);
  grid.set(1, 1, 1, 1);
  grid.set(2, 1, 1, 1);
  assert.equal(meshOf(grid).faces, 10);
});

test('a full 4 x 4 x 4 block has only outer faces', () => {
  const grid = new VoxelGrid(4);
  grid.cells.fill(1);
  assert.equal(meshOf(grid).faces, 6 * 16);
});

test('the normals point out of the voxel', () => {
  const grid = new VoxelGrid(3);
  grid.set(1, 1, 1, 1);
  const mesh = meshOf(grid);
  const p = mesh.positions;
  const n = mesh.normals;
  for (let t = 0; t < mesh.indices.length; t += 3) {
    const [a, b, c] = [mesh.indices[t], mesh.indices[t + 1], mesh.indices[t + 2]];
    const e1 = [0, 1, 2].map((k) => p[b * 3 + k] - p[a * 3 + k]);
    const e2 = [0, 1, 2].map((k) => p[c * 3 + k] - p[a * 3 + k]);
    const cross = [
      e1[1] * e2[2] - e1[2] * e2[1],
      e1[2] * e2[0] - e1[0] * e2[2],
      e1[0] * e2[1] - e1[1] * e2[0],
    ];
    const dot = cross[0] * n[a * 3] + cross[1] * n[a * 3 + 1] + cross[2] * n[a * 3 + 2];
    assert.ok(dot > 0, 'the triangle faces out');
  }
});

test('an inner corner is darker', () => {
  const grid = new VoxelGrid(4);
  grid.set(1, 1, 1, 1);
  grid.set(2, 1, 1, 1);
  grid.set(1, 2, 1, 1);
  const mesh = meshOf(grid);
  const darkest = Math.min(...mesh.colors.filter((_, i) => i % 3 === 0));
  assert.ok(darkest < 1);
  assert.ok(darkest >= AO_LEVELS[3]);
});

test('skipFace and tiles work', () => {
  const grid = new VoxelGrid(2);
  grid.set(0, 0, 0, 1);
  const mesh = meshOf(grid, { skipFace: (x, y, z, f) => f === 3, tile: () => 3, tiles: 2 });
  assert.equal(mesh.faces, 5);
  for (let i = 0; i < mesh.uvs.length; i += 2) {
    assert.ok(mesh.uvs[i] >= 0.5 && mesh.uvs[i] <= 1);
    assert.ok(mesh.uvs[i + 1] >= 0 && mesh.uvs[i + 1] <= 0.5);
  }
});
