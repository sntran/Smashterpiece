// The steps of a carving, for the time-lapse. This module does not use
// three.js or the DOM.
//
// The game makes each change with applyStep(). It also keeps the step in a
// list. To replay a statue, the game starts again from the first block and
// applies the same steps: the result is the same statue, with the same
// falling pieces and the same sand that crumbles.
//
// A step is { op, x, y, z, arg }:
//   op   the number of the action in OPS
//   arg  clay: the face; paint: the color; sticker: face + 8 * type
// A step is 5 bytes in the saved data.

import { EMPTY } from './grid.js';
import { applyHit } from './carve.js';
import { crumbleSand } from './sand.js';
import { removeFloating } from './connect.js';
import { hardnessOf, crumblesOf } from './stones.js';
import {
  addClay, applyPaint, placeSticker, pruneStickers, stickerHolds, FACE_NORMALS, STICKER_TYPES, PAINT_COLORS,
} from './decorate.js';
import { rleEncode, rleDecode, toBase64, fromBase64 } from './codec.js';

// Add new actions only at the end: saved steps keep the position.
export const OPS = ['hammer', 'chisel', 'file', 'hammer-easy', 'chisel-easy', 'clay', 'paint', 'sticker'];
// More steps than this are not kept. The statue then has no time-lapse.
export const MAX_STEPS = 4000;
const STEP_BYTES = 5;

// Make the step for a tool at a voxel.
//   tool    hammer, chisel, file, clay, brush or sticker
//   extra   { easy, face, paint, sticker }
export function makeStep(tool, x, y, z, extra = {}) {
  let op;
  let arg = 0;
  if (tool === 'hammer' || tool === 'chisel') {
    op = OPS.indexOf(extra.easy ? `${tool}-easy` : tool);
  } else if (tool === 'file') {
    op = OPS.indexOf('file');
  } else if (tool === 'clay') {
    op = OPS.indexOf('clay');
    arg = extra.face;
  } else if (tool === 'brush') {
    op = OPS.indexOf('paint');
    arg = extra.paint;
  } else if (tool === 'sticker') {
    op = OPS.indexOf('sticker');
    arg = extra.face + 8 * STICKER_TYPES.indexOf(extra.sticker);
  } else {
    throw new Error(`Unknown tool: ${tool}`);
  }
  return { op, x, y, z, arg };
}

// Apply one step. The grid changes. Return what happened:
//   changed   false when the step did nothing
//   removed, cracked, crumbled, pieces   for the hits
//   added     the new clay; painted: the painted voxels
//   placed    the new sticker; fallen: the stickers that fell off
//   stickers  the new list of stickers
export function applyStep(grid, stickers, step, stone) {
  const name = OPS[step.op];
  const { x, y, z, arg } = step;
  const result = {
    changed: false, removed: [], cracked: [], crumbled: [], pieces: [], added: [], painted: [],
    placed: null, fallen: [], stickers,
  };
  const prune = () => {
    const { keep, fallen } = pruneStickers(grid, stickers);
    result.stickers = keep;
    result.fallen = fallen;
  };
  if (name === 'clay') {
    result.added = addClay(grid, x, y, z, FACE_NORMALS[arg], hardnessOf(stone));
    result.changed = result.added.length > 0;
    if (result.changed) prune();
  } else if (name === 'paint') {
    result.painted = applyPaint(grid, x, y, z, arg);
    result.changed = result.painted.length > 0;
  } else if (name === 'sticker') {
    const sticker = { type: STICKER_TYPES[arg >> 3], x, y, z, face: arg & 7 };
    if (sticker.type && stickerHolds(grid, sticker)) {
      result.placed = sticker;
      result.stickers = placeSticker(stickers, sticker);
      result.changed = true;
    }
  } else if (name) {
    const easy = name.endsWith('-easy');
    const hit = applyHit(grid, name.replace('-easy', ''), x, y, z, easy);
    result.removed = hit.removed;
    result.cracked = hit.cracked;
    result.changed = hit.removed.length > 0 || hit.cracked.length > 0;
    if (hit.removed.length > 0) {
      if (crumblesOf(stone)) result.crumbled = crumbleSand(grid, x, y, z);
      result.pieces = removeFloating(grid);
    }
    if (result.changed) prune();
  }
  return result;
}

export function isValidStep(step, size) {
  const name = OPS[step.op];
  if (!name) return false;
  if (![step.x, step.y, step.z].every((v) => Number.isInteger(v) && v >= 0 && v < size)) return false;
  if (name === 'clay') return step.arg < 6;
  if (name === 'paint') return step.arg <= PAINT_COLORS;
  if (name === 'sticker') return (step.arg & 7) < 6 && (step.arg >> 3) < STICKER_TYPES.length;
  return true;
}

export function encodeSteps(steps) {
  const bytes = new Uint8Array(steps.length * STEP_BYTES);
  steps.forEach((s, k) => bytes.set([s.op, s.x, s.y, s.z, s.arg], k * STEP_BYTES));
  return toBase64(bytes);
}

export function decodeSteps(text, size) {
  const bytes = fromBase64(String(text));
  if (bytes.length % STEP_BYTES !== 0) throw new Error('The saved steps are not correct.');
  const steps = [];
  for (let k = 0; k < bytes.length; k += STEP_BYTES) {
    const step = { op: bytes[k], x: bytes[k + 1], y: bytes[k + 2], z: bytes[k + 3], arg: bytes[k + 4] };
    if (!isValidStep(step, size)) throw new Error('The saved steps are not correct.');
    steps.push(step);
  }
  return steps;
}

// The time-lapse data of a statue: the first block and the steps.
export function encodeReplay(startCells, steps) {
  if (!startCells || !steps || steps.length > MAX_STEPS) return null;
  return { start: toBase64(rleEncode(startCells)), steps: encodeSteps(steps) };
}

export function decodeReplay(data, size) {
  if (!data || typeof data.start !== 'string' || typeof data.steps !== 'string') return null;
  try {
    const start = rleDecode(fromBase64(data.start), size ** 3);
    const steps = decodeSteps(data.steps, size);
    if (steps.length > MAX_STEPS) return null;
    return { start, steps };
  } catch {
    return null;
  }
}

// Return true when the replay gives these cells. A replay that does not
// match (for example after a change of the game rules) is not shown.
export function replayMatches(grid, replay, stone, cells, paint = null) {
  const g = grid;
  g.cells.set(replay.start);
  g.paint.fill(0);
  let stickers = [];
  for (const step of replay.steps) stickers = applyStep(g, stickers, step, stone).stickers;
  const isStone = (v) => v !== EMPTY && v !== 255;
  for (let i = 0; i < cells.length; i++) {
    if (isStone(g.cells[i]) !== isStone(cells[i])) return false;
    if (paint && isStone(cells[i]) && g.paint[i] !== paint[i]) return false;
  }
  return true;
}
