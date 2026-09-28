import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBlock, EMPTY } from '../src/core/grid.js';
import { applyHit } from '../src/core/carve.js';
import { findFloating } from '../src/core/connect.js';
import {
  faceOf, planClay, addClay, planPaint, applyPaint, cleanPaint, placeSticker, pruneStickers,
  stickerHolds, isStickerValid, MAX_STICKERS, PAINT_COLORS,
} from '../src/core/decorate.js';

test('clay adds a small ball on the face and stays connected', () => {
  const grid = createBlock({ size: 8, box: { x0: 0, x1: 7, y0: 1, y1: 2, z0: 0, z1: 7 } });
  const before = grid.countStone();
  grid.paint[grid.index(4, 3, 4)] = 5;
  const added = addClay(grid, 4, 2, 4, [0, 1, 0], 2);
  // A ball with radius 1 has 7 cells. The cell below the middle is stone already.
  assert.equal(added.length, 6);
  assert.equal(grid.countStone(), before + 6);
  assert.equal(grid.get(4, 3, 4), 2);
  assert.equal(grid.paint[grid.index(4, 3, 4)], 0);
  assert.equal(findFloating(grid).length, 0);
});

test('clay does not go into the pedestal layer or out of the grid', () => {
  const grid = createBlock({ size: 4, box: { x0: 0, x1: -1, y0: 1, y1: 1, z0: 0, z1: 0 } });
  const cells = planClay(grid, 0, 0, 0, [0, 1, 0]);
  const xyz = [0, 0, 0];
  for (const i of cells) {
    grid.coords(i, xyz);
    assert.ok(xyz[1] >= 1);
  }
  // Out of the grid, there is nothing to fill.
  assert.deepEqual(planClay(createBlock({ size: 4 }), 3, 3, 3, [1, 0, 0]), []);
});

test('paint colors only the surface', () => {
  const grid = createBlock({ size: 8 });
  const changed = applyPaint(grid, 4, 7, 4, 3);
  assert.ok(changed.length > 0);
  for (const i of planPaint(grid, 4, 7, 4)) assert.equal(grid.paint[i], 3);
  // An inner voxel has no open face and gets no paint.
  assert.equal(grid.paint[grid.index(4, 6, 4)], 0);
  // The same paint again changes nothing. Paint 0 removes it.
  assert.equal(applyPaint(grid, 4, 7, 4, 3).length, 0);
  assert.equal(applyPaint(grid, 4, 7, 4, 0).length, changed.length);
  assert.throws(() => applyPaint(grid, 4, 7, 4, PAINT_COLORS + 1));
});

test('cleanPaint removes the paint of removed voxels', () => {
  const grid = createBlock({ size: 8 });
  applyPaint(grid, 4, 7, 4, 2);
  applyHit(grid, 'hammer', 4, 7, 4);
  assert.ok(cleanPaint(grid) > 0);
  for (let i = 0; i < grid.cells.length; i++) if (grid.cells[i] === EMPTY) assert.equal(grid.paint[i], 0);
});

test('stickers hold on open faces and fall off when the voxel goes', () => {
  const grid = createBlock({ size: 8 });
  let stickers = placeSticker([], { type: 'eye', x: 3, y: 4, z: 7, face: faceOf([0, 0, 1]) });
  stickers = placeSticker(stickers, { type: 'hat', x: 3, y: 7, z: 3, face: faceOf([0, 1, 0]) });
  // The same face gets a new sticker.
  stickers = placeSticker(stickers, { type: 'bow', x: 3, y: 4, z: 7, face: faceOf([0, 0, 1]) });
  assert.equal(stickers.length, 2);
  assert.ok(stickers.every((s) => stickerHolds(grid, s)));
  grid.set(3, 4, 7, EMPTY);
  const { keep, fallen } = pruneStickers(grid, stickers);
  assert.deepEqual(fallen.map((s) => s.type), ['bow']);
  assert.deepEqual(keep.map((s) => s.type), ['hat']);
});

test('a covered face drops its sticker', () => {
  const grid = createBlock({ size: 8 });
  grid.set(3, 7, 3, EMPTY);
  const s = { type: 'star', x: 3, y: 6, z: 3, face: faceOf([0, 1, 0]) };
  assert.equal(stickerHolds(grid, s), true);
  addClay(grid, 3, 6, 3, [0, 1, 0], 1);
  assert.equal(stickerHolds(grid, s), false);
});

test('the sticker list has a limit and bad stickers are found', () => {
  let list = [];
  for (let i = 0; i < MAX_STICKERS + 5; i++) list = placeSticker(list, { type: 'star', x: i % 8, y: 1, z: Math.floor(i / 8), face: 2 });
  assert.equal(list.length, MAX_STICKERS);
  const grid = createBlock({ size: 8 });
  assert.equal(isStickerValid(grid, { type: 'star', x: 1, y: 1, z: 1, face: 2 }), true);
  assert.equal(isStickerValid(grid, { type: 'cake', x: 1, y: 1, z: 1, face: 2 }), false);
  assert.equal(isStickerValid(grid, { type: 'star', x: 1, y: 1, z: 99, face: 2 }), false);
  assert.equal(isStickerValid(grid, { type: 'star', x: 1, y: 1, z: 1, face: 6 }), false);
});

test('faceOf finds the face of a normal', () => {
  assert.equal(faceOf([1, 0, 0]), 0);
  assert.equal(faceOf([0, 0, -1]), 5);
  assert.equal(faceOf([1, 1, 0]), -1);
});
