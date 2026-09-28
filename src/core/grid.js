// The voxel grid. This module does not use three.js or the DOM.
//
// Each cell holds one byte:
//   0         the cell is empty.
//   1 to 254  the cell is stone. The value is the number of hits that
//             the cell can take before it breaks.
//   255       the cell is part of the pedestal. The player cannot remove it.
//
// A second array keeps the paint of each cell: 0 for no paint, or the
// number of a paint color.

export const GRID_SIZE = 32;
export const EMPTY = 0;
export const PEDESTAL = 255;

export class VoxelGrid {
  constructor(size = GRID_SIZE, cells = null, paint = null) {
    this.size = size;
    this.cells = cells ?? new Uint8Array(size * size * size);
    this.paint = paint ?? new Uint8Array(size * size * size);
    if (this.cells.length !== size * size * size || this.paint.length !== this.cells.length) {
      throw new Error('The cell data does not agree with the grid size.');
    }
  }

  index(x, y, z) {
    return x + this.size * (y + this.size * z);
  }

  // Write the coordinates of cell index i into out and return out.
  coords(i, out = [0, 0, 0]) {
    const s = this.size;
    out[0] = i % s;
    out[1] = Math.floor(i / s) % s;
    out[2] = Math.floor(i / (s * s));
    return out;
  }

  inside(x, y, z) {
    const s = this.size;
    return x >= 0 && y >= 0 && z >= 0 && x < s && y < s && z < s;
  }

  // Cells outside the grid are empty.
  get(x, y, z) {
    return this.inside(x, y, z) ? this.cells[this.index(x, y, z)] : EMPTY;
  }

  set(x, y, z, value) {
    if (this.inside(x, y, z)) this.cells[this.index(x, y, z)] = value;
  }

  isSolid(x, y, z) {
    return this.get(x, y, z) !== EMPTY;
  }

  clone() {
    return new VoxelGrid(this.size, this.cells.slice(), this.paint.slice());
  }

  copyFrom(cells) {
    this.cells.set(cells);
  }

  // Count the stone cells. Pedestal cells are not stone.
  countStone() {
    let n = 0;
    for (const v of this.cells) if (v !== EMPTY && v !== PEDESTAL) n++;
    return n;
  }
}

export function isStone(value) {
  return value !== EMPTY && value !== PEDESTAL;
}

// Make a grid with a pedestal in the bottom layer (y = 0) and a block of
// stone on it. Each stone cell gets `hardness` hits.
// The box limits are inclusive. The default box fills the grid.
export function createBlock({ size = GRID_SIZE, hardness = 1, box = null } = {}) {
  const grid = new VoxelGrid(size);
  const b = box ?? { x0: 0, x1: size - 1, y0: 1, y1: size - 1, z0: 0, z1: size - 1 };
  for (let z = 0; z < size; z++) {
    for (let x = 0; x < size; x++) grid.set(x, 0, z, PEDESTAL);
  }
  for (let z = Math.max(0, b.z0); z <= Math.min(size - 1, b.z1); z++) {
    for (let y = Math.max(1, b.y0); y <= Math.min(size - 1, b.y1); y++) {
      for (let x = Math.max(0, b.x0); x <= Math.min(size - 1, b.x1); x++) {
        grid.set(x, y, z, hardness);
      }
    }
  }
  return grid;
}
