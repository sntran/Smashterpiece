// The 3D view of the stone. The stone is a set of chunk meshes. After a
// hit, the game builds again only the chunks that changed.

import * as THREE from 'three';
import { buildMesh } from '../core/mesher.js';
import { PEDESTAL, EMPTY } from '../core/grid.js';
import { stoneColors, hash3 } from './palette.js';
import { stoneAtlas, toonGradient, ATLAS_TILES } from './textures.js';

export const CHUNK = 8;
const GHOST_TINT = [1.0, 0.86, 0.35];
const TINT_AMOUNT = 0.3;

// Change sRGB color values to linear values for the renderer.
function toLinear(c) {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

const linearCache = new Map();
export function linearColors(stone, size) {
  const key = `${stone}:${size}`;
  if (!linearCache.has(key)) linearCache.set(key, stoneColors(stone, size).map(toLinear));
  return linearCache.get(key);
}

const materials = new Map();
export function stoneMaterial(stone) {
  if (!materials.has(stone)) {
    materials.set(stone, new THREE.MeshToonMaterial({
      map: stoneAtlas(stone),
      gradientMap: toonGradient(),
      vertexColors: true,
    }));
  }
  return materials.get(stone);
}

export function geometryFrom(data) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(data.normals, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(data.uvs, 2));
  geometry.setAttribute('color', new THREE.BufferAttribute(data.colors, 3));
  geometry.setIndex(new THREE.BufferAttribute(data.indices, 1));
  geometry.computeBoundingSphere();
  return geometry;
}

// Make the mesh options for a set of cells.
//   valueAt(x, y, z)  the cell value (0 for empty)
//   size              the grid size (for the color table)
export function voxelMeshOptions({ valueAt, size, stone, hardness, ghostMask = null }) {
  const colors = linearColors(stone, size);
  return {
    solid: (x, y, z) => valueAt(x, y, z) !== EMPTY,
    color: (x, y, z, out) => {
      const i = x + size * (y + size * z);
      out[0] = colors[i * 3];
      out[1] = colors[i * 3 + 1];
      out[2] = colors[i * 3 + 2];
      if (ghostMask && ghostMask[i]) {
        for (let k = 0; k < 3; k++) out[k] += (GHOST_TINT[k] - out[k]) * TINT_AMOUNT;
      }
    },
    tile: (x, y, z, face) => {
      const v = valueAt(x, y, z);
      const row = Math.floor(hash3(x, y, z, face) * ATLAS_TILES);
      if (v === PEDESTAL) return row * ATLAS_TILES + 3;
      const damage = Math.max(0, Math.min(2, hardness - v));
      return row * ATLAS_TILES + damage;
    },
    tiles: ATLAS_TILES,
    // The bottom of the pedestal is never visible.
    skipFace: (x, y, z, face) => y === 0 && face === 3,
  };
}

export class StoneView {
  constructor() {
    // The root is at the middle of the base of the stone. The game scales
    // the root to make the stone wobble.
    this.root = new THREE.Group();
    this.inner = new THREE.Group();
    this.root.add(this.inner);
    this.chunks = new Map();
    this.dirty = new Set();
    this.grid = null;
    this.ghostMesh = null;
    this.tint = null;
    this.preview = this.makePreview();
    this.inner.add(this.preview);
  }

  // Show a new grid. `ghost` is the ghost shape or null.
  setStone(grid, stone, hardness, ghost = null) {
    this.clear();
    this.grid = grid;
    this.stone = stone;
    this.hardness = hardness;
    this.tint = ghost ? ghost.mask : null;
    const half = grid.size / 2;
    this.inner.position.set(-half, 0, -half);
    this.options = voxelMeshOptions({
      valueAt: (x, y, z) => grid.get(x, y, z),
      size: grid.size,
      stone,
      hardness,
      ghostMask: this.tint,
    });
    this.material = stoneMaterial(stone);
    const n = Math.ceil(grid.size / CHUNK);
    for (let cz = 0; cz < n; cz++) {
      for (let cy = 0; cy < n; cy++) {
        for (let cx = 0; cx < n; cx++) this.buildChunk(cx, cy, cz);
      }
    }
    if (ghost) this.makeGhost(ghost);
  }

  clear() {
    for (const mesh of this.chunks.values()) {
      this.inner.remove(mesh);
      mesh.geometry.dispose();
    }
    this.chunks.clear();
    this.dirty.clear();
    if (this.ghostMesh) {
      this.inner.remove(this.ghostMesh);
      this.ghostMesh.geometry.dispose();
      this.ghostMesh = null;
    }
    this.preview.count = 0;
  }

  buildChunk(cx, cy, cz) {
    const key = `${cx},${cy},${cz}`;
    const old = this.chunks.get(key);
    if (old) {
      this.inner.remove(old);
      old.geometry.dispose();
      this.chunks.delete(key);
    }
    const size = this.grid.size;
    const data = buildMesh({
      x0: cx * CHUNK, y0: cy * CHUNK, z0: cz * CHUNK,
      x1: Math.min(size, (cx + 1) * CHUNK),
      y1: Math.min(size, (cy + 1) * CHUNK),
      z1: Math.min(size, (cz + 1) * CHUNK),
      ...this.options,
    });
    if (data.faces === 0) return;
    const mesh = new THREE.Mesh(geometryFrom(data), this.material);
    mesh.matrixAutoUpdate = false;
    this.inner.add(mesh);
    this.chunks.set(key, mesh);
  }

  // Mark the chunks near the changed cells. A change also changes the
  // faces and the shadows of the cells next to it.
  markCells(indices) {
    const size = this.grid.size;
    const xyz = [0, 0, 0];
    for (const i of indices) {
      this.grid.coords(i, xyz);
      for (let dz = -1; dz <= 1; dz++) {
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const x = xyz[0] + dx, y = xyz[1] + dy, z = xyz[2] + dz;
            if (x < 0 || y < 0 || z < 0 || x >= size || y >= size || z >= size) continue;
            this.dirty.add(`${Math.floor(x / CHUNK)},${Math.floor(y / CHUNK)},${Math.floor(z / CHUNK)}`);
          }
        }
      }
    }
  }

  markAll() {
    const n = Math.ceil(this.grid.size / CHUNK);
    for (let cz = 0; cz < n; cz++) {
      for (let cy = 0; cy < n; cy++) {
        for (let cx = 0; cx < n; cx++) this.dirty.add(`${cx},${cy},${cz}`);
      }
    }
  }

  flush() {
    for (const key of this.dirty) {
      const [cx, cy, cz] = key.split(',').map(Number);
      this.buildChunk(cx, cy, cz);
    }
    this.dirty.clear();
  }

  makeGhost(ghost) {
    const size = ghost.size;
    const mask = ghost.mask;
    const data = buildMesh({
      x0: 0, y0: 0, z0: 0, x1: size, y1: size, z1: size,
      solid: (x, y, z) =>
        x >= 0 && y >= 0 && z >= 0 && x < size && y < size && z < size && mask[x + size * (y + size * z)] === 1,
      color: (x, y, z, out) => { out[0] = 1; out[1] = 1; out[2] = 1; },
      ao: true,
    });
    const material = new THREE.MeshBasicMaterial({
      color: 0x5ff0ff,
      vertexColors: true,
      transparent: true,
      opacity: 0.4,
      depthTest: false,
      depthWrite: false,
    });
    this.ghostMesh = new THREE.Mesh(geometryFrom(data), material);
    this.ghostMesh.renderOrder = 10;
    this.inner.add(this.ghostMesh);
  }

  setGhostVisible(visible) {
    if (this.ghostMesh) this.ghostMesh.visible = visible;
  }

  makePreview() {
    const geometry = new THREE.BoxGeometry(1.08, 1.08, 1.08);
    geometry.translate(0.5, 0.5, 0.5);
    const material = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.55, depthWrite: false });
    const mesh = new THREE.InstancedMesh(geometry, material, 160);
    mesh.count = 0;
    mesh.renderOrder = 5;
    mesh.frustumCulled = false;
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(160 * 3), 3);
    return mesh;
  }

  // Show the voxels that the next hit will remove (yellow) or crack (orange).
  showPreview(plan) {
    const mesh = this.preview;
    const matrix = new THREE.Matrix4();
    const removeColor = new THREE.Color(0xfff200);
    const crackColor = new THREE.Color(0xff7a00);
    const xyz = [0, 0, 0];
    let n = 0;
    const put = (i, color) => {
      if (n >= mesh.instanceMatrix.count) return;
      this.grid.coords(i, xyz);
      matrix.makeTranslation(xyz[0] - 0.04, xyz[1] - 0.04, xyz[2] - 0.04);
      mesh.setMatrixAt(n, matrix);
      mesh.setColorAt(n, color);
      n++;
    };
    for (const i of plan.removed) put(i, removeColor);
    for (const i of plan.cracked) put(i, crackColor);
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  hidePreview() {
    this.preview.count = 0;
  }

  update(time) {
    this.preview.material.opacity = 0.55 + 0.2 * Math.sin(time * 10);
    if (this.ghostMesh) this.ghostMesh.material.opacity = 0.34 + 0.08 * Math.sin(time * 2.5);
  }

  // Change grid coordinates to world coordinates.
  toWorld(x, y, z, out = new THREE.Vector3()) {
    out.set(x, y, z);
    return this.inner.localToWorld(out);
  }
}
