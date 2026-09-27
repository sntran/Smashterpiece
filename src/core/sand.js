// Sand. This module does not use three.js or the DOM.
//
// Sand cannot make thin parts that hang in the air. After a hit, a sand
// voxel crumbles when the cell below it is empty and it has fewer than two
// side neighbors. When a voxel crumbles, the voxel above it can lose its
// support too, so the check runs again until nothing changes.

import { EMPTY, PEDESTAL } from './grid.js';

const SIDE_STEPS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

function isStone(value) {
  return value !== EMPTY && value !== PEDESTAL;
}

// Return true when the voxel at (x, y, z) must crumble.
export function isLoose(grid, x, y, z) {
  if (!isStone(grid.get(x, y, z))) return false;
  if (grid.isSolid(x, y - 1, z)) return false;
  let sides = 0;
  for (const [dx, dz] of SIDE_STEPS) {
    if (grid.isSolid(x + dx, y, z + dz)) sides++;
  }
  return sides < 2;
}

// Remove the loose sand voxels in a box around (cx, cy, cz).
// Return the indices of the removed voxels.
export function crumbleSand(grid, cx, cy, cz, reach = 8, maxPasses = 32) {
  const removed = [];
  const s = grid.size;
  const x0 = Math.max(0, cx - reach), x1 = Math.min(s - 1, cx + reach);
  const y0 = Math.max(1, cy - reach), y1 = s - 1;
  const z0 = Math.max(0, cz - reach), z1 = Math.min(s - 1, cz + reach);
  for (let pass = 0; pass < maxPasses; pass++) {
    const loose = [];
    for (let z = z0; z <= z1; z++) {
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          if (isLoose(grid, x, y, z)) loose.push(grid.index(x, y, z));
        }
      }
    }
    if (loose.length === 0) break;
    for (const i of loose) grid.cells[i] = EMPTY;
    removed.push(...loose);
  }
  return removed;
}
