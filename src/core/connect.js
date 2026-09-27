// The connection check. This module does not use three.js or the DOM.
//
// A voxel stays in place only when a path of face neighbors connects it
// to the pedestal. All other voxels fall.

import { EMPTY, PEDESTAL } from './grid.js';

// Return a mask. The mask value is 1 for each solid voxel that connects
// to a pedestal voxel.
export function connectedMask(grid) {
  const s = grid.size;
  const cells = grid.cells;
  const seen = new Uint8Array(cells.length);
  const queue = new Int32Array(cells.length);
  let head = 0;
  let tail = 0;
  for (let i = 0; i < cells.length; i++) {
    if (cells[i] === PEDESTAL) {
      seen[i] = 1;
      queue[tail++] = i;
    }
  }
  const layer = s * s;
  while (head < tail) {
    const i = queue[head++];
    const x = i % s;
    const y = Math.floor(i / s) % s;
    const z = Math.floor(i / layer);
    // Look at the six face neighbors.
    if (x > 0) tail = visit(i - 1, cells, seen, queue, tail);
    if (x < s - 1) tail = visit(i + 1, cells, seen, queue, tail);
    if (y > 0) tail = visit(i - s, cells, seen, queue, tail);
    if (y < s - 1) tail = visit(i + s, cells, seen, queue, tail);
    if (z > 0) tail = visit(i - layer, cells, seen, queue, tail);
    if (z < s - 1) tail = visit(i + layer, cells, seen, queue, tail);
  }
  return seen;
}

function visit(j, cells, seen, queue, tail) {
  if (seen[j] || cells[j] === EMPTY) return tail;
  seen[j] = 1;
  queue[tail] = j;
  return tail + 1;
}

// Return the indices of the solid voxels that do not connect to the pedestal.
export function findFloating(grid) {
  const mask = connectedMask(grid);
  const out = [];
  const cells = grid.cells;
  for (let i = 0; i < cells.length; i++) {
    if (cells[i] !== EMPTY && !mask[i]) out.push(i);
  }
  return out;
}

// Divide a set of voxel indices into groups of connected voxels.
export function groupPieces(grid, indices) {
  const s = grid.size;
  const layer = s * s;
  const open = new Set(indices);
  const pieces = [];
  for (const start of indices) {
    if (!open.has(start)) continue;
    open.delete(start);
    const piece = [start];
    for (let k = 0; k < piece.length; k++) {
      const i = piece[k];
      const x = i % s;
      const y = Math.floor(i / s) % s;
      const z = Math.floor(i / layer);
      const around = [];
      if (x > 0) around.push(i - 1);
      if (x < s - 1) around.push(i + 1);
      if (y > 0) around.push(i - s);
      if (y < s - 1) around.push(i + s);
      if (z > 0) around.push(i - layer);
      if (z < s - 1) around.push(i + layer);
      for (const j of around) {
        if (open.has(j)) {
          open.delete(j);
          piece.push(j);
        }
      }
    }
    pieces.push(piece);
  }
  return pieces;
}

// Remove all voxels that do not connect to the pedestal.
// Return the pieces. Each piece is a list of { index, value } items.
export function removeFloating(grid) {
  const floating = findFloating(grid);
  if (floating.length === 0) return [];
  const pieces = groupPieces(grid, floating).map((piece) =>
    piece.map((index) => ({ index, value: grid.cells[index] })),
  );
  for (const i of floating) grid.cells[i] = EMPTY;
  return pieces;
}
