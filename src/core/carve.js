// Voxel removal for each tool. This module does not use three.js or the DOM.

import { EMPTY, PEDESTAL } from './grid.js';

export const TOOLS = {
  hammer: { kind: 'sphere', radius: 3 },
  chisel: { kind: 'sphere', radius: 1 },
  // The file looks in this radius for voxels that stick out.
  file: { kind: 'file', radius: 2.5, maxNeighbors: 3 },
};

export const TOOL_NAMES = Object.keys(TOOLS);

const FACE_STEPS = [
  [1, 0, 0], [-1, 0, 0],
  [0, 1, 0], [0, -1, 0],
  [0, 0, 1], [0, 0, -1],
];

function removable(value) {
  return value !== EMPTY && value !== PEDESTAL;
}

// Return the indices of the stone voxels in a sphere around (cx, cy, cz).
// Pedestal voxels are never in the result.
export function sphereCells(grid, cx, cy, cz, radius) {
  const out = [];
  const r = Math.ceil(radius);
  const r2 = radius * radius;
  for (let dz = -r; dz <= r; dz++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy + dz * dz > r2) continue;
        const x = cx + dx, y = cy + dy, z = cz + dz;
        if (!grid.inside(x, y, z)) continue;
        const i = grid.index(x, y, z);
        if (removable(grid.cells[i])) out.push(i);
      }
    }
  }
  return out;
}

// Count the solid face neighbors of a voxel. Pedestal voxels are solid.
export function faceNeighbors(grid, x, y, z) {
  let n = 0;
  for (const [dx, dy, dz] of FACE_STEPS) {
    if (grid.isSolid(x + dx, y + dy, z + dz)) n++;
  }
  return n;
}

// Return the indices of the stone voxels near (cx, cy, cz) that stick out.
// A voxel sticks out when it has `maxNeighbors` or fewer solid face
// neighbors. A voxel on a flat surface has 5 neighbors, so the file does
// not dig into flat surfaces.
export function fileCells(grid, cx, cy, cz, radius = 2.5, maxNeighbors = 3) {
  const out = [];
  const xyz = [0, 0, 0];
  for (const i of sphereCells(grid, cx, cy, cz, radius)) {
    grid.coords(i, xyz);
    if (faceNeighbors(grid, xyz[0], xyz[1], xyz[2]) <= maxNeighbors) out.push(i);
  }
  return out;
}

// Return the indices of the voxels that the tool hits at (x, y, z).
// In the easy mode, the hammer and the chisel are one voxel larger.
export function toolTargets(grid, toolName, x, y, z, easy = false) {
  const tool = TOOLS[toolName];
  if (!tool) throw new Error(`Unknown tool: ${toolName}`);
  if (tool.kind === 'sphere') return sphereCells(grid, x, y, z, tool.radius + (easy ? 1 : 0));
  return fileCells(grid, x, y, z, tool.radius, tool.maxNeighbors);
}

// Tell what a hit will do, but do not change the grid.
// `removed` holds the voxels that will break.
// `cracked` holds the voxels that will only get cracks.
export function planHit(grid, toolName, x, y, z, easy = false) {
  const removed = [];
  const cracked = [];
  for (const i of toolTargets(grid, toolName, x, y, z, easy)) {
    if (grid.cells[i] <= 1) removed.push(i);
    else cracked.push(i);
  }
  return { removed, cracked };
}

// Hit the grid at (x, y, z). Each target voxel loses one hit point.
// A voxel with no hit points left becomes empty.
export function applyHit(grid, toolName, x, y, z, easy = false) {
  const plan = planHit(grid, toolName, x, y, z, easy);
  for (const i of plan.removed) grid.cells[i] = EMPTY;
  for (const i of plan.cracked) grid.cells[i] -= 1;
  return plan;
}
