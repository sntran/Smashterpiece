import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SHAPE_NAMES, buildGhost, shapeMask2D } from '../src/core/shapes.js';
import { VoxelGrid, PEDESTAL } from '../src/core/grid.js';
import { findFloating } from '../src/core/connect.js';

test('there are six shapes', () => {
  assert.deepEqual(SHAPE_NAMES, ['star', 'fish', 'heart', 'duck', 'smiley', 'rocket']);
  assert.throws(() => buildGhost('dragon'));
});

for (const name of SHAPE_NAMES) {
  test(`the ${name} shape fits in its block and stands on the pedestal`, () => {
    const ghost = buildGhost(name);
    const size = ghost.size;
    assert.ok(ghost.count > 800, `the ${name} has ${ghost.count} voxels`);
    const grid = new VoxelGrid(size);
    for (let z = 0; z < size; z++) for (let x = 0; x < size; x++) grid.set(x, 0, z, PEDESTAL);
    const xyz = [0, 0, 0];
    for (let i = 0; i < ghost.mask.length; i++) {
      if (!ghost.mask[i]) continue;
      grid.coords(i, xyz);
      const [x, y, z] = xyz;
      assert.ok(y >= 1, 'the shape is not in the pedestal layer');
      assert.ok(z >= ghost.box.z0 && z <= ghost.box.z1, 'the shape is in the block');
      grid.cells[i] = 1;
    }
    // A perfect statue must not fall.
    assert.equal(findFloating(grid).length, 0);
  });
}

test('the shape pictures are different', () => {
  const pictures = SHAPE_NAMES.map((n) => shapeMask2D(n).join(''));
  assert.equal(new Set(pictures).size, SHAPE_NAMES.length);
});
