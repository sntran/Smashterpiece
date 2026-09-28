// The ghost shapes for the challenge mode. This module does not use
// three.js or the DOM.
//
// Each shape is a flat picture in the (u, v) plane. The values of u and v
// go from -1 to 1. The picture becomes a thick, soft 3D shape: the shape is
// thick in the middle and thin at the edges. A "dent" makes a small hole
// in the front surface, for example the eyes of the smiley face.

import { GRID_SIZE } from './grid.js';

// The block letters for the letter challenges. Each letter has 7 rows of
// 5 columns, from the top row down.
const FONT = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.###.'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '#####'],
  J: ['..###', '...#.', '...#.', '...#.', '#..#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '#.#.#', '.#.#.'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
};

export const LETTERS = Object.keys(FONT);

// The shape names. Add new shapes only at the end: a statue link keeps
// the position of the shape in this list.
export const PICTURE_SHAPES = ['star', 'fish', 'heart', 'duck', 'smiley', 'rocket', 'cat', 'dino', 'car', 'house'];
export const SHAPE_NAMES = [...PICTURE_SHAPES, ...LETTERS.map((l) => `letter-${l}`)];

// Return the letter of a letter shape, or null.
export function letterOf(name) {
  return name.startsWith('letter-') ? name.slice(7) : null;
}

// The front of the shape points to +z.
const MAX_HALF_DEPTH = 5;
const MIN_HALF_DEPTH = 1.5;
const DEPTH_PER_STEP = 0.8;
const DENT_DEPTH = 2;
// The number of empty layers in front of and behind the shape in the
// challenge block.
const BLOCK_MARGIN = 2;

function inEllipse(u, v, cu, cv, ru, rv) {
  const a = (u - cu) / ru;
  const b = (v - cv) / rv;
  return a * a + b * b <= 1;
}

function inPolygon(u, v, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [ui, vi] = points[i];
    const [uj, vj] = points[j];
    if (vi > v !== vj > v && u < ((uj - ui) * (v - vi)) / (vj - vi) + ui) inside = !inside;
  }
  return inside;
}

function starPoints(cu, cv, outer, inner) {
  const points = [];
  for (let k = 0; k < 10; k++) {
    const angle = Math.PI / 2 + (k * Math.PI) / 5;
    const r = k % 2 === 0 ? outer : inner;
    points.push([cu + r * Math.cos(angle), cv + r * Math.sin(angle)]);
  }
  return points;
}

const STAR = starPoints(0, -0.1, 1.02, 0.46);
const FISH_TAIL = [[0.28, 0.12], [0.95, 0.62], [0.95, -0.38]];
const FISH_FIN = [[-0.42, 0.45], [0.1, 0.45], [-0.05, 0.78]];
const DUCK_TAIL = [[0.55, -0.15], [0.97, 0.12], [0.8, -0.5]];
const ROCKET_FIN_LEFT = [[-0.26, -0.1], [-0.26, -0.62], [-0.66, -1.02], [-0.66, -0.5]];
const ROCKET_FIN_RIGHT = ROCKET_FIN_LEFT.map(([u, v]) => [-u, v]);

const CAT_EAR_LEFT = [[-0.44, 0.52], [-0.1, 0.66], [-0.4, 1.0]];
const CAT_EAR_RIGHT = CAT_EAR_LEFT.map(([u, v]) => [-u, v]);
const DINO_NECK = [[-0.28, -0.12], [-0.02, -0.02], [-0.46, 0.66], [-0.66, 0.58]];
const DINO_TAIL = [[0.5, -0.05], [0.55, -0.45], [0.97, -0.52], [0.97, -0.36]];
const CAR_CABIN = [[-0.52, -0.02], [-0.3, 0.42], [0.36, 0.42], [0.58, -0.02]];
const HOUSE_ROOF = [[-0.82, 0.08], [0.82, 0.08], [0, 0.86]];

const SHAPES = {
  star: {
    inside: (u, v) => inPolygon(u, v, STAR),
    dent: () => false,
  },
  fish: {
    inside: (u, v) =>
      inEllipse(u, v, -0.18, 0.12, 0.64, 0.44) ||
      inPolygon(u, v, FISH_TAIL) ||
      inPolygon(u, v, FISH_FIN),
    dent: (u, v) => inEllipse(u, v, -0.52, 0.22, 0.1, 0.1),
  },
  heart: {
    inside: (u, v) => {
      const x = u * 1.18;
      const y = v * 1.2 + 0.12;
      const a = x * x + y * y - 1;
      return a * a * a - x * x * y * y * y <= 0;
    },
    dent: () => false,
  },
  duck: {
    inside: (u, v) =>
      (inEllipse(u, v, 0.1, -0.36, 0.8, 0.46) && v > -0.8) ||
      inEllipse(u, v, -0.36, 0.3, 0.34, 0.34) ||
      inEllipse(u, v, -0.78, 0.22, 0.22, 0.1) ||
      inPolygon(u, v, DUCK_TAIL),
    dent: (u, v) => inEllipse(u, v, -0.44, 0.4, 0.08, 0.08),
  },
  smiley: {
    inside: (u, v) => inEllipse(u, v, 0, 0.02, 0.94, 0.94),
    dent: (u, v) => {
      if (inEllipse(u, v, -0.34, 0.3, 0.12, 0.2)) return true;
      if (inEllipse(u, v, 0.34, 0.3, 0.12, 0.2)) return true;
      const r = Math.hypot(u, v - 0.08);
      return v < -0.12 && r > 0.44 && r < 0.64;
    },
  },
  rocket: {
    inside: (u, v) => {
      if (Math.abs(u) <= 0.27 && v >= -0.66 && v <= 0.35) return true;
      if (v > 0.35 && v <= 1.02) {
        const t = (v - 0.35) / 0.67;
        return Math.abs(u) <= 0.27 * Math.sqrt(Math.max(0, 1 - t * t));
      }
      if (Math.abs(u) <= 0.17 && v >= -0.84 && v < -0.66) return true;
      return inPolygon(u, v, ROCKET_FIN_LEFT) || inPolygon(u, v, ROCKET_FIN_RIGHT);
    },
    dent: (u, v) => inEllipse(u, v, 0, 0.1, 0.14, 0.14),
  },
  cat: {
    inside: (u, v) =>
      inEllipse(u, v, 0, 0.3, 0.44, 0.4) ||
      inEllipse(u, v, 0, -0.45, 0.56, 0.5) ||
      inEllipse(u, v, 0.64, -0.5, 0.14, 0.36) ||
      inPolygon(u, v, CAT_EAR_LEFT) ||
      inPolygon(u, v, CAT_EAR_RIGHT),
    dent: (u, v) =>
      inEllipse(u, v, -0.17, 0.36, 0.08, 0.11) ||
      inEllipse(u, v, 0.17, 0.36, 0.08, 0.11) ||
      inEllipse(u, v, 0, 0.2, 0.07, 0.06),
  },
  dino: {
    inside: (u, v) =>
      inEllipse(u, v, 0.15, -0.25, 0.56, 0.34) ||
      inPolygon(u, v, DINO_NECK) ||
      inEllipse(u, v, -0.62, 0.68, 0.24, 0.15) ||
      inPolygon(u, v, DINO_TAIL) ||
      (u >= -0.26 && u <= 0 && v >= -1.1 && v <= -0.3) ||
      (u >= 0.28 && u <= 0.54 && v >= -1.1 && v <= -0.3),
    dent: () => false,
  },
  car: {
    inside: (u, v) =>
      (Math.abs(u) <= 0.92 && v >= -0.42 && v <= 0) ||
      inPolygon(u, v, CAR_CABIN) ||
      inEllipse(u, v, -0.5, -0.46, 0.25, 0.25) ||
      inEllipse(u, v, 0.5, -0.46, 0.25, 0.25),
    dent: (u, v) => u >= -0.3 && u <= 0.36 && v >= 0.08 && v <= 0.32,
  },
  house: {
    inside: (u, v) =>
      (Math.abs(u) <= 0.62 && v >= -0.92 && v <= 0.1) ||
      inPolygon(u, v, HOUSE_ROOF) ||
      (u >= 0.34 && u <= 0.56 && v >= 0.3 && v <= 0.76),
    dent: (u, v) =>
      (Math.abs(u) <= 0.15 && v <= -0.4) ||
      (Math.abs(Math.abs(u) - 0.36) <= 0.11 && v >= -0.3 && v <= -0.06),
  },
};

// A letter shape: the block letter, larger, with one more voxel around
// each part. Parts that touch only at a corner then touch at a face, so
// that the statue does not fall apart.
function letterShape(letter) {
  const rows = FONT[letter];
  const inside = (u, v) => {
    const col = Math.floor(((u + 0.92) / 1.84) * 5);
    // The bottom row reaches the pedestal, so that the letter stands on
    // its own feet.
    const row = Math.floor(((0.96 - v) / 2.02) * 7);
    return col >= 0 && col < 5 && row >= 0 && row < 7 && rows[row][col] === '#';
  };
  return { inside, dent: () => false, grow: 1 };
}

function shapeOf(name) {
  const letter = letterOf(name);
  const shape = letter && FONT[letter] ? letterShape(letter) : SHAPES[name];
  if (!shape) throw new Error(`Unknown shape: ${name}`);
  return shape;
}

function toU(x, size) {
  return (x + 0.5 - size / 2) / (size * 0.4375);
}

function toV(y, size) {
  return (y + 0.5 - (size / 2 + 0.5)) / (size * 0.453);
}

// Make the flat picture of a shape. The result has size * size cells with
// index x + size * y. Row y = 0 is the pedestal row and is always empty.
// A stem and a base connect the shape to the pedestal.
export function shapeMask2D(name, size = GRID_SIZE) {
  const shape = shapeOf(name);
  const mask = new Uint8Array(size * size);
  for (let y = 1; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (shape.inside(toU(x, size), toV(y, size))) mask[x + size * y] = 1;
    }
  }
  for (let k = 0; k < (shape.grow ?? 0); k++) grow(mask, size);
  addStand(mask, size);
  return mask;
}

// Add one cell around each part of the picture (not in the pedestal row).
function grow(mask, size) {
  const copy = mask.slice();
  for (let y = 1; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (copy[x + size * y]) continue;
      const near = (x > 0 && copy[x - 1 + size * y]) || (x < size - 1 && copy[x + 1 + size * y]) ||
        (y > 1 && copy[x + size * (y - 1)]) || (y < size - 1 && copy[x + size * (y + 1)]);
      if (near) mask[x + size * y] = 1;
    }
  }
}

// Add a stem below the lowest part of the shape and a small base on the
// pedestal row. Then the shape stays on the pedestal after the carving.
function addStand(mask, size) {
  let lowest = -1;
  for (let y = 1; y < size && lowest < 0; y++) {
    for (let x = 0; x < size; x++) {
      if (mask[x + size * y]) {
        lowest = y;
        break;
      }
    }
  }
  // A shape that already stands on the pedestal needs no stand.
  if (lowest < 0 || lowest === 1) return;
  // Find the middle of the voxels in the lowest row.
  let sum = 0;
  let count = 0;
  for (let x = 0; x < size; x++) {
    if (mask[x + size * lowest]) {
      sum += x;
      count++;
    }
  }
  const center = Math.round(sum / count);
  for (let x = center - 2; x <= center + 2; x++) {
    if (x < 0 || x >= size) continue;
    // Fill the column up to the first voxel of the shape.
    for (let y = 1; y < size && !mask[x + size * y]; y++) mask[x + size * y] = 1;
  }
  for (let x = center - 5; x <= center + 5; x++) {
    if (x < 0 || x >= size) continue;
    mask[x + size] = 1;
    mask[x + size * 2] = 1;
  }
}

// For each cell of the picture, find the number of steps to the nearest
// cell out of the picture.
function edgeDistance(mask, size) {
  const dist = new Int32Array(size * size).fill(-1);
  const queue = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = x + size * y;
      if (!mask[i]) {
        dist[i] = 0;
        queue.push(i);
      }
    }
  }
  // Cells at the border of the picture have a free cell outside them.
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = x + size * y;
      if (mask[i] && (x === 0 || y === 0 || x === size - 1 || y === size - 1)) {
        dist[i] = 1;
        queue.push(i);
      }
    }
  }
  for (let k = 0; k < queue.length; k++) {
    const i = queue[k];
    const x = i % size;
    const y = Math.floor(i / size);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
      const j = nx + size * ny;
      if (dist[j] < 0) {
        dist[j] = dist[i] + 1;
        queue.push(j);
      }
    }
  }
  return dist;
}

// Make the 3D ghost shape.
// Return the mask (1 for each voxel in the shape, index as in VoxelGrid),
// the number of voxels in the shape, and the box of the challenge block.
export function buildGhost(name, size = GRID_SIZE) {
  const shape = shapeOf(name);
  const flat = shapeMask2D(name, size);
  const dist = edgeDistance(flat, size);
  const mask = new Uint8Array(size * size * size);
  const middle = size / 2;
  let count = 0;
  let zMin = size;
  let zMax = -1;
  for (let y = 1; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i2 = x + size * y;
      if (!flat[i2]) continue;
      const half = Math.min(MAX_HALF_DEPTH, MIN_HALF_DEPTH + dist[i2] * DEPTH_PER_STEP);
      const dent = shape.dent(toU(x, size), toV(y, size));
      const front = dent ? half - DENT_DEPTH : half;
      for (let z = 0; z < size; z++) {
        const offset = z + 0.5 - middle;
        if (offset < -half || offset > front) continue;
        mask[x + size * (y + size * z)] = 1;
        count++;
        zMin = Math.min(zMin, z);
        zMax = Math.max(zMax, z);
      }
    }
  }
  const box = {
    x0: 0,
    x1: size - 1,
    y0: 1,
    y1: size - 1,
    z0: Math.max(0, zMin - BLOCK_MARGIN),
    z1: Math.min(size - 1, zMax + BLOCK_MARGIN),
  };
  return { name, size, mask, count, box };
}
