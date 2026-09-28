// Clay, paint and stickers. This module does not use three.js or the DOM.

import { EMPTY, PEDESTAL } from './grid.js';

// The six faces of a voxel, in the same order as in the mesher.
export const FACE_NORMALS = [
  [1, 0, 0], [-1, 0, 0],
  [0, 1, 0], [0, -1, 0],
  [0, 0, 1], [0, 0, -1],
];

export function faceOf(normal) {
  return FACE_NORMALS.findIndex((n) => n[0] === normal[0] && n[1] === normal[1] && n[2] === normal[2]);
}

// The number of paint colors. Paint 0 means no paint.
export const PAINT_COLORS = 8;
// Add new stickers only at the end: a statue link keeps the position of
// the sticker in this list.
export const STICKER_TYPES = [
  'eye', 'glasses', 'hat', 'bow', 'flower', 'lips', 'star', 'crown',
  'nonla', 'heart', 'butterfly', 'cap', 'nose', 'ladybug', 'lantern',
];
export const MAX_STICKERS = 60;

function isStone(v) {
  return v !== EMPTY && v !== PEDESTAL;
}

function hasOpenFace(grid, x, y, z) {
  for (const [dx, dy, dz] of FACE_NORMALS) {
    if (!grid.isSolid(x + dx, y + dy, z + dz)) return true;
  }
  return false;
}

// ---------------------------------------------------------------- Clay

// Return the empty cells that the clay fills: a small ball on the face of
// the voxel (x, y, z) that points to `normal`.
export function planClay(grid, x, y, z, normal, radius = 1) {
  const cx = x + normal[0];
  const cy = y + normal[1];
  const cz = z + normal[2];
  const out = [];
  const r = Math.ceil(radius);
  for (let dz = -r; dz <= r; dz++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy + dz * dz > radius * radius) continue;
        const px = cx + dx, py = cy + dy, pz = cz + dz;
        if (py < 1 || !grid.inside(px, py, pz)) continue;
        const i = grid.index(px, py, pz);
        if (grid.cells[i] === EMPTY) out.push(i);
      }
    }
  }
  return out;
}

// Fill the cells of planClay with new stone. The new stone has no paint.
export function addClay(grid, x, y, z, normal, hardness, radius = 1) {
  const added = planClay(grid, x, y, z, normal, radius);
  for (const i of added) {
    grid.cells[i] = hardness;
    grid.paint[i] = 0;
  }
  return added;
}

// ---------------------------------------------------------------- Paint

// Return the stone voxels on the surface near (cx, cy, cz).
export function planPaint(grid, cx, cy, cz, radius = 1.5) {
  const out = [];
  const r = Math.ceil(radius);
  const xyz = [0, 0, 0];
  for (let dz = -r; dz <= r; dz++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy + dz * dz > radius * radius) continue;
        const x = cx + dx, y = cy + dy, z = cz + dz;
        if (!grid.inside(x, y, z)) continue;
        const i = grid.index(x, y, z);
        if (!isStone(grid.cells[i])) continue;
        grid.coords(i, xyz);
        if (hasOpenFace(grid, x, y, z)) out.push(i);
      }
    }
  }
  return out;
}

// Paint the surface near (cx, cy, cz). Color 0 removes the paint.
// Return the indices of the voxels that changed.
export function applyPaint(grid, cx, cy, cz, color, radius = 1.5) {
  if (!Number.isInteger(color) || color < 0 || color > PAINT_COLORS) throw new Error(`Unknown paint: ${color}`);
  const changed = [];
  for (const i of planPaint(grid, cx, cy, cz, radius)) {
    if (grid.paint[i] !== color) {
      grid.paint[i] = color;
      changed.push(i);
    }
  }
  return changed;
}

// Remove the paint from cells that are not stone. Return the number of
// cells that changed.
export function cleanPaint(grid) {
  let n = 0;
  for (let i = 0; i < grid.cells.length; i++) {
    if (grid.paint[i] && !isStone(grid.cells[i])) {
      grid.paint[i] = 0;
      n++;
    }
  }
  return n;
}

// ---------------------------------------------------------------- Stickers

// A sticker is { type, x, y, z, face }: it sits on one face of one voxel.

export function isStickerValid(grid, s) {
  return STICKER_TYPES.includes(s.type) &&
    Number.isInteger(s.face) && s.face >= 0 && s.face < 6 &&
    [s.x, s.y, s.z].every((v) => Number.isInteger(v)) &&
    grid.inside(s.x, s.y, s.z);
}

// Put a sticker on a face. A sticker on the same face is replaced.
// Return the new list.
export function placeSticker(stickers, sticker) {
  const rest = stickers.filter((s) => !(s.x === sticker.x && s.y === sticker.y && s.z === sticker.z && s.face === sticker.face));
  rest.push({ type: sticker.type, x: sticker.x, y: sticker.y, z: sticker.z, face: sticker.face });
  while (rest.length > MAX_STICKERS) rest.shift();
  return rest;
}

// A sticker stays only when its voxel is stone and its face is open.
export function stickerHolds(grid, s) {
  if (!isStone(grid.get(s.x, s.y, s.z))) return false;
  const [dx, dy, dz] = FACE_NORMALS[s.face];
  return !grid.isSolid(s.x + dx, s.y + dy, s.z + dz);
}

// Split the stickers into the ones that hold and the ones that fall off.
export function pruneStickers(grid, stickers) {
  const keep = [];
  const fallen = [];
  for (const s of stickers) (stickerHolds(grid, s) ? keep : fallen).push(s);
  return { keep, fallen };
}
