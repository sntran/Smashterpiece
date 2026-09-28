import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBlock, EMPTY } from '../src/core/grid.js';
import { applyHit } from '../src/core/carve.js';
import { applyPaint, faceOf } from '../src/core/decorate.js';
import { encodeStatue, decodeStatue } from '../src/core/codec.js';
import { encodeProgress, decodeProgress, SAVED_UNDO_STEPS } from '../src/core/save.js';
import { encodeShare, decodeShare, toBase64Url, deflate } from '../src/core/share.js';
import { History } from '../src/core/history.js';

function decorated() {
  const grid = createBlock({ size: 16, hardness: 1 });
  applyHit(grid, 'hammer', 8, 15, 15);
  applyPaint(grid, 4, 10, 15, 3);
  applyPaint(grid, 12, 12, 15, 7);
  const stickers = [
    { type: 'eye', x: 5, y: 9, z: 15, face: faceOf([0, 0, 1]) },
    { type: 'hat', x: 2, y: 15, z: 3, face: faceOf([0, 1, 0]) },
  ];
  return { grid, stickers };
}

test('a Museum statue keeps its paint and its stickers', () => {
  const { grid, stickers } = decorated();
  const record = encodeStatue({ id: 'p', size: 16, cells: grid.cells, paint: grid.paint, stickers, stone: 'wood' });
  const statue = decodeStatue(JSON.parse(JSON.stringify(record)));
  assert.deepEqual(statue.paint, grid.paint);
  assert.deepEqual(statue.stickers, stickers);
});

test('an old Museum statue has no paint and no stickers', () => {
  const grid = createBlock({ size: 4 });
  const record = encodeStatue({ id: 'o', size: 4, cells: grid.cells, stone: 'marble' });
  assert.equal(record.paint, undefined);
  assert.equal(record.stickers, undefined);
  const statue = decodeStatue(record);
  assert.ok(statue.paint.every((v) => v === 0));
  assert.deepEqual(statue.stickers, []);
});

test('bad stickers in a record are removed', () => {
  const grid = createBlock({ size: 4 });
  const record = encodeStatue({ id: 'b', size: 4, cells: grid.cells, stone: 'marble' });
  record.stickers = [{ type: 'eye', x: 1, y: 1, z: 1, face: 2 }, { type: 'bomb', x: 1, y: 1, z: 1, face: 2 }, { type: 'eye', x: 9, y: 1, z: 1, face: 2 }];
  assert.equal(decodeStatue(record).stickers.length, 1);
});

test('the saved game keeps paint, stickers and the last undo steps', () => {
  const { grid, stickers } = decorated();
  const undo = [];
  for (let k = 0; k < SAVED_UNDO_STEPS + 4; k++) {
    const cells = grid.cells.slice();
    cells[k] = EMPTY;
    undo.push({ cells, paint: grid.paint.slice(), stickers: stickers.slice(0, k % 2) });
  }
  const record = encodeProgress({ mode: 'free', stone: 'wood', size: 16, cells: grid.cells, paint: grid.paint, stickers, undo });
  const state = decodeProgress(JSON.parse(JSON.stringify(record)));
  assert.deepEqual(state.paint, grid.paint);
  assert.deepEqual(state.stickers, stickers);
  assert.equal(state.undo.length, SAVED_UNDO_STEPS);
  assert.deepEqual(state.undo.at(-1).cells, undo.at(-1).cells);
  assert.deepEqual(state.undo.at(-1).stickers, undo.at(-1).stickers);
});

test('a link keeps paint and stickers', async () => {
  const { grid, stickers } = decorated();
  const text = await encodeShare({ size: 16, cells: grid.cells, paint: grid.paint, stickers, stone: 'ice', shape: 'cat', stars: 1 });
  const back = await decodeShare(text);
  const stone = (v) => v !== 0 && v !== 255;
  for (let i = 0; i < grid.cells.length; i++) {
    assert.equal(stone(back.cells[i]), stone(grid.cells[i]));
    assert.equal(back.paint[i], stone(grid.cells[i]) ? grid.paint[i] : 0);
  }
  assert.deepEqual(back.stickers, stickers);
  assert.equal(back.shape, 'cat');
});

test('a link without paint and stickers stays in the short format', async () => {
  const grid = createBlock({ size: 8 });
  const plain = await encodeShare({ size: 8, cells: grid.cells, stone: 'sand' });
  const withEmptyPaint = await encodeShare({ size: 8, cells: grid.cells, paint: new Uint8Array(512), stickers: [], stone: 'sand' });
  assert.equal(plain, withEmptyPaint);
  // An old version 1 link still opens.
  const old = new Uint8Array(5 + Math.ceil((8 * 8 * 7) / 8));
  old.set([1, 0, 255, 0, 8]);
  const back = await decodeShare(toBase64Url(await deflate(old)));
  assert.equal(back.stickers.length, 0);
  assert.ok(back.paint.every((v) => v === 0));
});

test('a link with extra bytes is rejected', async () => {
  const bytes = new Uint8Array(5 + 1 + 1);
  bytes.set([1, 0, 255, 0, 2]);
  await assert.rejects(decodeShare(toBase64Url(await deflate(bytes))));
});

test('the history keeps objects and gives the last steps', () => {
  const history = new History(5);
  for (let k = 0; k < 7; k++) history.push({ n: k });
  assert.deepEqual(history.last(2).map((s) => s.n), [5, 6]);
  history.load([{ n: 'a' }, { n: 'b' }]);
  assert.equal(history.undo().n, 'b');
});
