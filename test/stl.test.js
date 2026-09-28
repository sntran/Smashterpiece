import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VoxelGrid, createBlock } from '../src/core/grid.js';
import { statueToStl, readStl, VOXEL_MM } from '../src/core/stl.js';

test('one voxel makes 12 triangles', () => {
  const grid = new VoxelGrid(4);
  grid.set(1, 2, 3, 1);
  const buffer = statueToStl(4, grid.cells);
  assert.equal(buffer.byteLength, 84 + 12 * 50);
  const triangles = readStl(buffer);
  assert.equal(triangles.length, 12);
  // The game Y (2) becomes the STL Z, and Z (3) becomes Y.
  const xs = triangles.flatMap((t) => [t.a[0], t.b[0], t.c[0]]);
  const ys = triangles.flatMap((t) => [t.a[1], t.b[1], t.c[1]]);
  const zs = triangles.flatMap((t) => [t.a[2], t.b[2], t.c[2]]);
  assert.deepEqual([Math.min(...xs), Math.max(...xs)], [1 * VOXEL_MM, 2 * VOXEL_MM]);
  assert.deepEqual([Math.min(...ys), Math.max(...ys)], [3 * VOXEL_MM, 4 * VOXEL_MM]);
  assert.deepEqual([Math.min(...zs), Math.max(...zs)], [2 * VOXEL_MM, 3 * VOXEL_MM]);
});

test('each triangle faces out, the same way as its normal', () => {
  const grid = createBlock({ size: 4, box: { x0: 1, x1: 2, y0: 1, y1: 2, z0: 1, z1: 1 } });
  for (const t of readStl(statueToStl(4, grid.cells))) {
    const e1 = t.b.map((v, k) => v - t.a[k]);
    const e2 = t.c.map((v, k) => v - t.a[k]);
    const cross = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const dot = cross[0] * t.normal[0] + cross[1] * t.normal[1] + cross[2] * t.normal[2];
    assert.ok(dot > 0);
  }
});

test('the surface is closed: each edge is in two triangles', () => {
  const grid = createBlock({ size: 6, box: { x0: 1, x1: 3, y0: 1, y1: 3, z0: 1, z1: 3 } });
  grid.set(2, 3, 2, 0);
  const edges = new Map();
  for (const t of readStl(statueToStl(6, grid.cells))) {
    for (const [p, q] of [[t.a, t.b], [t.b, t.c], [t.c, t.a]]) {
      const key = [p.join(','), q.join(',')].sort().join('|');
      edges.set(key, (edges.get(key) ?? 0) + 1);
    }
  }
  for (const count of edges.values()) assert.equal(count, 2);
});
