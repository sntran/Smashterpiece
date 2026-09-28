import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBlock, EMPTY, PEDESTAL } from '../src/core/grid.js';
import { matchScore, countOutside, starsFor, STAR_LIMITS, limitsFor } from '../src/core/score.js';
import { buildGhost } from '../src/core/shapes.js';

function carveToGhost(grid, mask) {
  for (let i = 0; i < grid.cells.length; i++) {
    if (grid.cells[i] !== PEDESTAL && !mask[i]) grid.cells[i] = EMPTY;
  }
}

test('the full block has a score of 0', () => {
  const ghost = buildGhost('heart');
  const grid = createBlock({ box: ghost.box });
  const outside = countOutside(grid, ghost.mask);
  const result = matchScore(grid, ghost.mask, outside);
  assert.equal(result.keep, 1);
  assert.equal(result.clear, 0);
  assert.equal(result.score, 0);
  assert.equal(result.stars, 1);
});

test('a perfect carving has a score of 1 and 3 stars', () => {
  const ghost = buildGhost('star');
  const grid = createBlock({ box: ghost.box });
  const outside = countOutside(grid, ghost.mask);
  carveToGhost(grid, ghost.mask);
  const result = matchScore(grid, ghost.mask, outside);
  assert.equal(result.score, 1);
  assert.equal(result.stars, 3);
});

test('an empty stone has a score of 0', () => {
  const ghost = buildGhost('fish');
  const grid = createBlock({ box: ghost.box });
  const outside = countOutside(grid, ghost.mask);
  for (let i = 0; i < grid.cells.length; i++) if (grid.cells[i] !== PEDESTAL) grid.cells[i] = EMPTY;
  const result = matchScore(grid, ghost.mask, outside);
  assert.equal(result.keep, 0);
  assert.equal(result.score, 0);
});

test('half of the extra stone gives a score of 0.5', () => {
  const ghost = buildGhost('duck');
  const grid = createBlock({ box: ghost.box });
  const outside = countOutside(grid, ghost.mask);
  let removed = 0;
  for (let i = 0; i < grid.cells.length && removed < outside / 2; i++) {
    if (grid.cells[i] !== PEDESTAL && grid.cells[i] !== EMPTY && !ghost.mask[i]) {
      grid.cells[i] = EMPTY;
      removed++;
    }
  }
  const result = matchScore(grid, ghost.mask, outside);
  assert.ok(Math.abs(result.score - 0.5) < 0.001);
  assert.equal(result.stars, 1);
});

test('starsFor gives 1, 2 or 3 stars', () => {
  assert.equal(starsFor(0), 1);
  assert.equal(starsFor(STAR_LIMITS[0] - 0.01), 1);
  assert.equal(starsFor(STAR_LIMITS[0]), 2);
  assert.equal(starsFor(STAR_LIMITS[1]), 3);
  assert.equal(starsFor(1), 3);
});

test('the easy challenges give stars sooner', () => {
  assert.equal(starsFor(0.45), 1);
  assert.equal(starsFor(0.45, true), 2);
  assert.equal(starsFor(0.7, true), 3);
  assert.ok(limitsFor(true).finish < limitsFor(false).finish);
});
