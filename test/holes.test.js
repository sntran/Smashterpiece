import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBlock, PEDESTAL } from '../src/core/grid.js';
import { addHoles } from '../src/core/holes.js';
import { makeRandom, randomInt } from '../src/core/random.js';
import { buildGhost } from '../src/core/shapes.js';
import { hasHoles, STONE_NAMES, hardnessOf } from '../src/core/stones.js';

test('only cheese has holes', () => {
  assert.deepEqual(STONE_NAMES.filter(hasHoles), ['cheese']);
  for (const name of STONE_NAMES) assert.ok([1, 2, 3].includes(hardnessOf(name)));
});

test('holes remove stone but not the pedestal or the ghost shape', () => {
  const ghost = buildGhost('duck');
  const grid = createBlock({ box: ghost.box });
  const before = grid.countStone();
  const removed = addHoles(grid, { count: 12, rand: makeRandom(3), avoidMask: ghost.mask });
  assert.ok(removed > 0);
  assert.equal(grid.countStone(), before - removed);
  for (let i = 0; i < grid.cells.length; i++) {
    if (ghost.mask[i]) assert.notEqual(grid.cells[i], 0);
  }
  for (let z = 0; z < 32; z++) for (let x = 0; x < 32; x++) assert.equal(grid.get(x, 0, z), PEDESTAL);
});

test('the random numbers stay in range', () => {
  const rand = makeRandom(9);
  for (let k = 0; k < 1000; k++) {
    const r = rand();
    assert.ok(r >= 0 && r < 1);
    const n = randomInt(rand, 2, 3);
    assert.ok(n === 2 || n === 3);
  }
});
