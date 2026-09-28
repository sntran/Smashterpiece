import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SHAPE_NAMES, buildGhost, shapeMask2D, letterOf } from '../src/core/shapes.js';
import { VoxelGrid, PEDESTAL } from '../src/core/grid.js';
import { findFloating } from '../src/core/connect.js';

test('the shape list keeps the old shapes first', () => {
  // A statue link keeps the position in this list, so old links must stay correct.
  assert.deepEqual(SHAPE_NAMES.slice(0, 6), ['star', 'fish', 'heart', 'duck', 'smiley', 'rocket']);
  assert.deepEqual(SHAPE_NAMES.slice(6, 10), ['cat', 'dino', 'car', 'house']);
  assert.equal(SHAPE_NAMES.length, 10 + 26);
  assert.equal(SHAPE_NAMES[10], 'letter-A');
  assert.equal(letterOf('letter-Q'), 'Q');
  assert.equal(letterOf('cat'), null);
  assert.throws(() => buildGhost('dragon'));
  assert.throws(() => buildGhost('letter-7'));
});

for (const name of SHAPE_NAMES) {
  test(`the ${name} shape fits in its block and stands on the pedestal`, () => {
    const ghost = buildGhost(name);
    const size = ghost.size;
    assert.ok(ghost.count > 600, `the ${name} has ${ghost.count} voxels`);
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
