// The Museum: a small 3D room with the saved statues on pedestals.

import * as THREE from 'three';
import { buildMesh } from '../core/mesher.js';
import { decodeStatue } from '../core/codec.js';
import { STONES } from '../core/stones.js';
import { voxelMeshOptions, geometryFrom, stoneMaterial } from './stone-view.js';
import { addLights } from './scene.js';
import { checkerTexture, wallTexture, toonGradient } from './textures.js';
import { SHAPE_EMOJI } from './icons.js';

const SPACING = 11;
const STATUE_SCALE = 0.14;
const PEDESTAL_TOP = 3;
const PEDESTAL_COLORS = [0xb388ff, 0x4cc9f0, 0xff8fa3, 0x4ade80, 0xffd35c];

function toon(color) {
  return new THREE.MeshToonMaterial({ color, gradientMap: toonGradient() });
}

function drawStar(ctx, cx, cy, r) {
  ctx.beginPath();
  for (let k = 0; k < 10; k++) {
    const a = -Math.PI / 2 + (k * Math.PI) / 5;
    const rr = k % 2 === 0 ? r : r * 0.45;
    ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  ctx.closePath();
}

// A small sign with the shape and the stars.
function badge(shape, stars) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#3b2a52';
  ctx.lineWidth = 6;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(6, 6, 244, 116, 30);
  else ctx.rect(6, 6, 244, 116);
  ctx.fill();
  ctx.stroke();
  ctx.font = '64px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(SHAPE_EMOJI[shape] ?? '', 58, 68);
  for (let k = 0; k < 3; k++) {
    drawStar(ctx, 128 + k * 44, 64, 20);
    ctx.fillStyle = k < stars ? '#ffd35c' : '#e6e0ee';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture }));
  sprite.scale.set(4, 2, 1);
  return sprite;
}

export class MuseumView {
  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xfff1f7);
    addLights(this.scene);
    this.room = new THREE.Group();
    this.scene.add(this.room);
    this.items = [];
    this.selected = 0;
    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(4.2, 5.2, 40),
      new THREE.MeshBasicMaterial({ color: 0xffd35c, side: THREE.DoubleSide }),
    );
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.05;
    this.scene.add(this.ring);
  }

  // Build the room for a list of saved records.
  load(records) {
    this.dispose();
    const count = Math.max(1, records.length);
    const length = count * SPACING + 12;
    const left = -SPACING / 2 - 6;

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(length, 34),
      new THREE.MeshToonMaterial({ map: checkerTexture(), gradientMap: toonGradient() }),
    );
    floor.material.map.repeat.set(length / 4, 34 / 4);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(left + length / 2, 0, 0);
    this.room.add(floor);

    const wallMap = wallTexture();
    wallMap.repeat.set(length / 16, 1);
    const wallMaterial = new THREE.MeshToonMaterial({ map: wallMap, gradientMap: toonGradient() });
    const back = new THREE.Mesh(new THREE.PlaneGeometry(length, 16), wallMaterial);
    back.position.set(left + length / 2, 8, -12);
    this.room.add(back);
    const sideMap = wallTexture();
    sideMap.repeat.set(34 / 16, 1);
    const sideMaterial = new THREE.MeshToonMaterial({ map: sideMap, gradientMap: toonGradient() });
    for (const [x, turn] of [[left, Math.PI / 2], [left + length, -Math.PI / 2]]) {
      const wall = new THREE.Mesh(new THREE.PlaneGeometry(34, 16), sideMaterial);
      wall.position.set(x, 8, 5);
      wall.rotation.y = turn;
      this.room.add(wall);
    }

    records.forEach((record, k) => {
      let statue;
      try {
        statue = decodeStatue(record);
      } catch {
        return;
      }
      const x = k * SPACING;
      const pedestal = new THREE.Mesh(
        new THREE.CylinderGeometry(3.4, 3.8, PEDESTAL_TOP, 28),
        toon(PEDESTAL_COLORS[k % PEDESTAL_COLORS.length]),
      );
      pedestal.position.set(x, PEDESTAL_TOP / 2, 0);
      this.room.add(pedestal);

      const mesh = this.statueMesh(statue);
      const half = (statue.size / 2) * STATUE_SCALE;
      mesh.position.set(x - half, PEDESTAL_TOP, -half);
      mesh.scale.setScalar(STATUE_SCALE);
      this.room.add(mesh);

      if (statue.shape) {
        const sign = badge(statue.shape, statue.stars);
        sign.position.set(x, PEDESTAL_TOP + statue.size * STATUE_SCALE + 1.8, 0);
        this.room.add(sign);
      }
      this.items.push({ id: record.id, x, mesh, height: statue.size * STATUE_SCALE });
    });
    this.selected = Math.min(this.selected, Math.max(0, this.items.length - 1));
    this.updateRing();
  }

  statueMesh(statue) {
    const { size, cells, stone } = statue;
    const hardness = STONES[stone]?.hardness ?? 1;
    const options = voxelMeshOptions({
      valueAt: (x, y, z) =>
        x < 0 || y < 0 || z < 0 || x >= size || y >= size || z >= size ? 0 : cells[x + size * (y + size * z)],
      size,
      stone: STONES[stone] ? stone : 'sandstone',
      hardness,
    });
    const data = buildMesh({ x0: 0, y0: 0, z0: 0, x1: size, y1: size, z1: size, ...options });
    const mesh = new THREE.Mesh(geometryFrom(data), stoneMaterial(STONES[stone] ? stone : 'sandstone'));
    mesh.userData.shared = true;
    return mesh;
  }

  get count() {
    return this.items.length;
  }

  select(index) {
    if (this.items.length === 0) return;
    this.selected = (index + this.items.length) % this.items.length;
    this.updateRing();
  }

  updateRing() {
    const item = this.items[this.selected];
    this.ring.visible = !!item;
    if (item) this.ring.position.x = item.x;
  }

  // The point for the camera to look at.
  focusPoint(out = new THREE.Vector3()) {
    const item = this.items[this.selected];
    if (!item) return out.set(0, 3, 0);
    return out.set(item.x, PEDESTAL_TOP + item.height * 0.45, 0);
  }

  selectedId() {
    return this.items[this.selected]?.id ?? null;
  }

  // Return the index of the statue under the ray, or -1.
  pick(raycaster) {
    const meshes = this.items.map((item) => item.mesh);
    const hits = raycaster.intersectObjects(meshes, false);
    if (hits.length === 0) return -1;
    return meshes.indexOf(hits[0].object);
  }

  update(time) {
    this.ring.material.color.setHSL(0.13, 1, 0.6 + 0.1 * Math.sin(time * 4));
  }

  dispose() {
    for (const child of [...this.room.children]) {
      this.room.remove(child);
      child.geometry?.dispose();
      // The stone materials are shared. Do not dispose them.
      if (child.material && !child.userData.shared) {
        child.material.map?.dispose();
        child.material.dispose();
      }
    }
    this.items = [];
  }
}
