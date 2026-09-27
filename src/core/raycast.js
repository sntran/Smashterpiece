// Find the first solid voxel on a ray. This module does not use three.js
// or the DOM.
//
// The ray uses grid units: voxel (x, y, z) fills the box from (x, y, z)
// to (x + 1, y + 1, z + 1).

// Return { x, y, z, normal, distance } or null.
// `normal` is the direction of the face that the ray hits first.
export function raycastGrid(grid, origin, direction, maxDistance = 1000) {
  const size = grid.size;
  let [ox, oy, oz] = origin;
  const len = Math.hypot(direction[0], direction[1], direction[2]);
  if (len === 0) return null;
  const dx = direction[0] / len;
  const dy = direction[1] / len;
  const dz = direction[2] / len;

  // Move the start point to the edge of the grid box.
  const entry = enterBox(ox, oy, oz, dx, dy, dz, size);
  if (!entry) return null;
  let t = entry.t;
  let normal = entry.normal;
  if (t > maxDistance) return null;
  const px = ox + dx * t;
  const py = oy + dy * t;
  const pz = oz + dz * t;

  const clampCell = (p, d) => {
    let c = Math.floor(p);
    // On the edge of a cell, use the cell in the direction of the ray.
    if (p === c && d < 0) c -= 1;
    return Math.min(size - 1, Math.max(0, c));
  };
  let x = clampCell(px, dx);
  let y = clampCell(py, dy);
  let z = clampCell(pz, dz);

  const stepX = Math.sign(dx);
  const stepY = Math.sign(dy);
  const stepZ = Math.sign(dz);
  const deltaX = stepX !== 0 ? Math.abs(1 / dx) : Infinity;
  const deltaY = stepY !== 0 ? Math.abs(1 / dy) : Infinity;
  const deltaZ = stepZ !== 0 ? Math.abs(1 / dz) : Infinity;
  const next = (p, cell, step) => (step > 0 ? cell + 1 - p : p - cell);
  let maxX = stepX !== 0 ? t + next(px, x, stepX) * deltaX : Infinity;
  let maxY = stepY !== 0 ? t + next(py, y, stepY) * deltaY : Infinity;
  let maxZ = stepZ !== 0 ? t + next(pz, z, stepZ) * deltaZ : Infinity;

  while (t <= maxDistance) {
    if (grid.isSolid(x, y, z)) return { x, y, z, normal, distance: t };
    if (maxX < maxY && maxX < maxZ) {
      x += stepX;
      t = maxX;
      maxX += deltaX;
      normal = [-stepX, 0, 0];
    } else if (maxY < maxZ) {
      y += stepY;
      t = maxY;
      maxY += deltaY;
      normal = [0, -stepY, 0];
    } else {
      z += stepZ;
      t = maxZ;
      maxZ += deltaZ;
      normal = [0, 0, -stepZ];
    }
    if (x < 0 || y < 0 || z < 0 || x >= size || y >= size || z >= size) return null;
  }
  return null;
}

// Find where the ray goes into the box from 0 to size on each axis.
function enterBox(ox, oy, oz, dx, dy, dz, size) {
  let tMin = 0;
  let tMax = Infinity;
  let normal = [0, 0, 0];
  const axes = [
    [ox, dx, 0],
    [oy, dy, 1],
    [oz, dz, 2],
  ];
  for (const [o, d, axis] of axes) {
    if (d === 0) {
      if (o < 0 || o > size) return null;
      continue;
    }
    let t0 = (0 - o) / d;
    let t1 = (size - o) / d;
    let side = -1;
    if (t0 > t1) {
      [t0, t1] = [t1, t0];
      side = 1;
    }
    if (t0 > tMin) {
      tMin = t0;
      normal = [0, 0, 0];
      normal[axis] = side;
    }
    tMax = Math.min(tMax, t1);
    if (tMin > tMax) return null;
  }
  return { t: tMin, normal };
}
