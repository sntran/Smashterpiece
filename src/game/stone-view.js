// The 3D view of the stone. The stone is a set of chunk meshes. After a
// hit, the game builds again only the chunks that changed.

import * as THREE from 'three';
import { buildMesh } from '../core/mesher.js';
import { PEDESTAL, EMPTY } from '../core/grid.js';
import { stoneColors, hash3, isClear, PAINTS } from './palette.js';
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

// The material of the stone. Glass is half clear, and the player can see
// its inner faces.
export function stoneMaterial(stone) {
  if (!materials.has(stone)) {
    const clear = isClear(stone);
    materials.set(stone, new THREE.MeshToonMaterial({
      map: stoneAtlas(stone),
      gradientMap: toonGradient(),
      vertexColors: true,
      transparent: clear,
      opacity: clear ? 0.55 : 1,
      depthWrite: !clear,
      side: clear ? THREE.DoubleSide : THREE.FrontSide,
    }));
  }
  return materials.get(stone);
}

// The pedestal is never clear.
const pedestalMaterials = new Map();
function pedestalMaterial(stone) {
  if (!pedestalMaterials.has(stone)) {
    pedestalMaterials.set(stone, new THREE.MeshToonMaterial({
      map: stoneAtlas(stone),
      gradientMap: toonGradient(),
      vertexColors: true,
    }));
  }
  return pedestalMaterials.get(stone);
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
const PAINT_LINEAR = PAINTS.map((p) => p.rgb.map(toLinear));

// The linear color of a paint (1 to 8).
export function paintColor(paint) {
  return PAINT_LINEAR[paint - 1];
}

export function voxelMeshOptions({ valueAt, size, stone, hardness, ghostMask = null, paint = null }) {
  const colors = linearColors(stone, size);
  return {
    solid: (x, y, z) => valueAt(x, y, z) !== EMPTY,
    color: (x, y, z, out) => {
      const i = x + size * (y + size * z);
      const p = paint ? paint[i] : 0;
      if (p) {
        const c = PAINT_LINEAR[p - 1];
        out[0] = c[0];
        out[1] = c[1];
        out[2] = c[2];
        return;
      }
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
      // Painted voxels without cracks use the smooth tile.
      if (damage === 0 && paint && paint[x + size * (y + size * z)]) return row * ATLAS_TILES + 3;
      return row * ATLAS_TILES + damage;
    },
    tiles: ATLAS_TILES,
    // The bottom of the pedestal is never visible.
    skipFace: (x, y, z, face) => y === 0 && face === 3,
  };
}

// Make the meshes for the voxels in a box. For a clear stone, the
// pedestal is a separate solid mesh, so that it stays solid.
//   box  { x0, y0, z0, x1, y1, z1 } (x1, y1, z1 are not included)
export function buildVoxelMeshes({ box, valueAt, size, stone, hardness, ghostMask = null, paint = null }) {
  const options = voxelMeshOptions({ valueAt, size, stone, hardness, ghostMask, paint });
  const meshes = [];
  const add = (data, material) => {
    if (data.faces === 0) return;
    const mesh = new THREE.Mesh(geometryFrom(data), material);
    mesh.matrixAutoUpdate = false;
    meshes.push(mesh);
  };
  if (!isClear(stone)) {
    add(buildMesh({ ...box, ...options }), stoneMaterial(stone));
    return meshes;
  }
  add(buildMesh({
    ...box,
    ...options,
    solid: (x, y, z) => valueAt(x, y, z) === PEDESTAL,
  }), pedestalMaterial(stone));
  add(buildMesh({
    ...box,
    ...options,
    skipFace: (x, y, z) => valueAt(x, y, z) === PEDESTAL,
  }), stoneMaterial(stone));
  return meshes;
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
    this.valueAt = (x, y, z) => grid.get(x, y, z);
    const n = Math.ceil(grid.size / CHUNK);
    for (let cz = 0; cz < n; cz++) {
      for (let cy = 0; cy < n; cy++) {
        for (let cx = 0; cx < n; cx++) this.buildChunk(cx, cy, cz);
      }
    }
    if (ghost) this.makeGhost(ghost, isClear(stone) ? 0xff6ad5 : 0x5ff0ff);
  }

  clear() {
    for (const meshes of this.chunks.values()) {
      for (const mesh of meshes) {
        this.inner.remove(mesh);
        mesh.geometry.dispose();
      }
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
    for (const mesh of this.chunks.get(key) ?? []) {
      this.inner.remove(mesh);
      mesh.geometry.dispose();
    }
    this.chunks.delete(key);
    const size = this.grid.size;
    const meshes = buildVoxelMeshes({
      box: {
        x0: cx * CHUNK, y0: cy * CHUNK, z0: cz * CHUNK,
        x1: Math.min(size, (cx + 1) * CHUNK),
        y1: Math.min(size, (cy + 1) * CHUNK),
        z1: Math.min(size, (cz + 1) * CHUNK),
      },
      valueAt: this.valueAt,
      size,
      stone: this.stone,
      hardness: this.hardness,
      ghostMask: this.tint,
      paint: this.grid.paint,
    });
    if (meshes.length === 0) return;
    for (const mesh of meshes) this.inner.add(mesh);
    this.chunks.set(key, meshes);
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

  makeGhost(ghost, color) {
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
      color,
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
    const material = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.55, depthWrite: false });
    const mesh = new THREE.InstancedMesh(geometry, material, 300);
    mesh.count = 0;
    mesh.renderOrder = 5;
    mesh.frustumCulled = false;
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(300 * 3), 3);
    return mesh;
  }

  // Show what the next hit does. The voxels that break are full yellow
  // boxes. The voxels that only crack are smaller orange boxes, so that
  // the size also shows the difference (for players who do not see the
  // colors well). New clay is green. Paint has the color of the paint.
  showPreview(plan) {
    const mesh = this.preview;
    const matrix = new THREE.Matrix4();
    const removeColor = new THREE.Color(0xfff200);
    const crackColor = new THREE.Color(0xff7a00);
    const addColor = new THREE.Color(0x3ddc84);
    const paintColor = new THREE.Color(plan.paint ? PAINTS[plan.paint - 1].css : '#ffffff');
    const xyz = [0, 0, 0];
    let n = 0;
    const put = (i, color, scale) => {
      if (n >= mesh.instanceMatrix.count) return;
      this.grid.coords(i, xyz);
      matrix.makeScale(scale, scale, scale).setPosition(xyz[0] + 0.5, xyz[1] + 0.5, xyz[2] + 0.5);
      mesh.setMatrixAt(n, matrix);
      mesh.setColorAt(n, color);
      n++;
    };
    for (const i of plan.removed) put(i, removeColor, 1);
    for (const i of plan.cracked) put(i, crackColor, 0.7);
    for (const i of plan.added ?? []) put(i, addColor, 0.9);
    for (const i of plan.painted ?? []) put(i, paintColor, 1.02);
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  hidePreview() {
    this.preview.count = 0;
  }

  // Strong colors: a clearer preview and a clearer ghost shape.
  setStrong(strong) {
    this.strong = strong;
  }

  update(time) {
    this.preview.material.opacity = this.strong ? 0.85 : 0.55 + 0.2 * Math.sin(time * 10);
    if (this.ghostMesh) this.ghostMesh.material.opacity = this.strong ? 0.55 : 0.34 + 0.08 * Math.sin(time * 2.5);
  }

  // Change grid coordinates to world coordinates.
  toWorld(x, y, z, out = new THREE.Vector3()) {
    out.set(x, y, z);
    return this.inner.localToWorld(out);
  }
}
