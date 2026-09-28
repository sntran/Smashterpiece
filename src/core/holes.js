// Air holes, for example the holes in cheese. This module does not use
// three.js or the DOM.

import { EMPTY, PEDESTAL } from './grid.js';

// Make `count` round holes in the stone. The holes do not touch the
// pedestal layer or the cells in `avoidMask`. Return the number of cells
// that became empty.
export function addHoles(grid, { count, rand, avoidMask = null, minRadius = 1.5, maxRadius = 3.2 }) {
  const s = grid.size;
  let removed = 0;
  for (let k = 0; k < count; k++) {
    const cx = rand() * s;
    const cy = 3 + rand() * (s - 3);
    const cz = rand() * s;
    const r = minRadius + rand() * (maxRadius - minRadius);
    const r2 = r * r;
    for (let z = Math.floor(cz - r); z <= Math.ceil(cz + r); z++) {
      for (let y = Math.max(2, Math.floor(cy - r)); y <= Math.ceil(cy + r); y++) {
        for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
          if (!grid.inside(x, y, z)) continue;
          const dx = x + 0.5 - cx, dy = y + 0.5 - cy, dz = z + 0.5 - cz;
          if (dx * dx + dy * dy + dz * dz > r2) continue;
          const i = grid.index(x, y, z);
          const v = grid.cells[i];
          if (v === EMPTY || v === PEDESTAL) continue;
          if (avoidMask && avoidMask[i]) continue;
          grid.cells[i] = EMPTY;
          removed++;
        }
      }
    }
  }
  return removed;
}
