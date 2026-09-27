// The colors of the stones. Each voxel gets its own color, so that the
// stone has bands, veins or spots.

// A small hash that gives a number from 0 to 1 for integer coordinates.
export function hash3(x, y, z, seed = 0) {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647 + seed * 144665) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}

function smooth(t) {
  return t * t * (3 - 2 * t);
}

// Value noise in 3D. The result is from 0 to 1.
export function noise3(x, y, z, seed = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const fx = smooth(x - xi), fy = smooth(y - yi), fz = smooth(z - zi);
  const lerp = (a, b, t) => a + (b - a) * t;
  const c = (dx, dy, dz) => hash3(xi + dx, yi + dy, zi + dz, seed);
  return lerp(
    lerp(lerp(c(0, 0, 0), c(1, 0, 0), fx), lerp(c(0, 1, 0), c(1, 1, 0), fx), fy),
    lerp(lerp(c(0, 0, 1), c(1, 0, 1), fx), lerp(c(0, 1, 1), c(1, 1, 1), fx), fy),
    fz,
  );
}

export const STONE_LOOKS = {
  sand: { swatch: '#f7d99a', dust: [1.0, 0.93, 0.74] },
  sandstone: { swatch: '#f4b860', dust: [1.0, 0.86, 0.62] },
  marble: { swatch: '#f4f1fb', dust: [1.0, 1.0, 1.0] },
  granite: { swatch: '#9d8f99', dust: [0.85, 0.82, 0.86] },
  glass: { swatch: '#bdefff', dust: [0.9, 1.0, 1.0] },
};

// These stones let the light through.
export function isClear(stone) {
  return stone === 'glass';
}

const PEDESTAL_A = [0.56, 0.36, 0.95];
const PEDESTAL_B = [0.68, 0.52, 1.0];

function sand(x, y, z, out) {
  const r = hash3(x, y, z, 9);
  const n = (hash3(x, y, z, 10) - 0.5) * 0.08;
  if (r < 0.015) {
    // A small shell.
    out[0] = 1.0; out[1] = 0.78; out[2] = 0.82;
  } else if (r < 0.08) {
    out[0] = 0.88 + n; out[1] = 0.72 + n; out[2] = 0.5 + n;
  } else {
    out[0] = 0.99 + n; out[1] = 0.87 + n; out[2] = 0.62 + n;
  }
}

function glass(x, y, z, out) {
  const n = noise3(x * 0.2, y * 0.2, z * 0.2, 11) * 0.12;
  if (hash3(x, y, z, 12) < 0.04) {
    // A small air bubble.
    out[0] = 0.95; out[1] = 1.0; out[2] = 1.0;
  } else {
    out[0] = 0.62 + n; out[1] = 0.9 + n * 0.5; out[2] = 1.0;
  }
}

function sandstone(x, y, z, out) {
  const wave = y * 0.9 + noise3(x * 0.12, y * 0.2, z * 0.12, 3) * 3.5;
  const band = 0.5 + 0.5 * Math.sin(wave);
  const n = hash3(x, y, z, 1) * 0.08;
  out[0] = 0.95 - band * 0.05 + n;
  out[1] = 0.66 + band * 0.14 + n;
  out[2] = 0.38 + band * 0.12 + n * 0.5;
}

function marble(x, y, z, out) {
  const turbulence = noise3(x * 0.15, y * 0.15, z * 0.15, 7) * 5 + noise3(x * 0.4, y * 0.4, z * 0.4, 8) * 1.2;
  const vein = Math.abs(Math.sin((x * 0.35 + y * 0.55 + z * 0.25) * 0.55 + turbulence));
  const n = hash3(x, y, z, 2) * 0.03;
  if (vein < 0.14) {
    out[0] = 0.62 + n;
    out[1] = 0.6 + n;
    out[2] = 0.86 + n;
  } else if (vein < 0.3) {
    out[0] = 0.84 + n;
    out[1] = 0.82 + n;
    out[2] = 0.95 + n;
  } else {
    out[0] = 0.97 + n;
    out[1] = 0.96 + n;
    out[2] = 0.99;
  }
}

function granite(x, y, z, out) {
  const r = hash3(x, y, z, 4);
  const n = noise3(x * 0.2, y * 0.2, z * 0.2, 5) * 0.08;
  if (r < 0.07) {
    out[0] = 0.45; out[1] = 0.42; out[2] = 0.5;
  } else if (r < 0.19) {
    out[0] = 0.86; out[1] = 0.66; out[2] = 0.7;
  } else if (r < 0.26) {
    out[0] = 0.86; out[1] = 0.85; out[2] = 0.9;
  } else {
    out[0] = 0.66 + n; out[1] = 0.64 + n; out[2] = 0.7 + n;
  }
}

const PAINTERS = { sand, sandstone, marble, granite, glass };
const cache = new Map();

// Return a Float32Array with 3 color values for each cell of a grid.
// The pedestal cells get a checker pattern.
export function stoneColors(stone, size) {
  const key = `${stone}:${size}`;
  if (cache.has(key)) return cache.get(key);
  const paint = PAINTERS[stone];
  const colors = new Float32Array(size * size * size * 3);
  const rgb = [0, 0, 0];
  for (let z = 0; z < size; z++) {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = x + size * (y + size * z);
        if (y === 0) {
          const c = (x + z) % 2 === 0 ? PEDESTAL_A : PEDESTAL_B;
          rgb[0] = c[0]; rgb[1] = c[1]; rgb[2] = c[2];
        } else {
          paint(x, y, z, rgb);
        }
        colors[i * 3] = rgb[0];
        colors[i * 3 + 1] = rgb[1];
        colors[i * 3 + 2] = rgb[2];
      }
    }
  }
  cache.set(key, colors);
  return colors;
}
