// The 3D tools. A tool shows where the player points, and it swings when
// the player hits.

import * as THREE from 'three';
import { toonGradient } from './textures.js';

const toolMaterials = [];

function toon(color) {
  const material = new THREE.MeshToonMaterial({ color, gradientMap: toonGradient(), transparent: true });
  toolMaterials.push(material);
  return material;
}

// The tool is half clear while the player aims, so that the preview
// stays visible. It is solid when it swings.
function setSolid(solid) {
  for (const material of toolMaterials) material.opacity = solid ? 1 : 0.45;
}

// Each model points its work end to -Y. The origin is the point that
// touches the stone.
function makeHammer() {
  const group = new THREE.Group();
  const head = new THREE.Mesh(new THREE.BoxGeometry(2.6, 4.6, 2.6), toon(0xff5d73));
  head.position.y = 2.3;
  const face = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.5, 16), toon(0xd7dde8));
  face.position.y = 0.2;
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, 11, 12), toon(0xffc94d));
  handle.rotation.z = Math.PI / 2;
  handle.position.set(6.5, 2.3, 0);
  group.add(head, face, handle);
  return group;
}

function makeChisel() {
  const group = new THREE.Group();
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.4, 12), toon(0xaeb8c9));
  tip.rotation.x = Math.PI;
  tip.position.y = 0.7;
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 4, 12), toon(0xd7dde8));
  shaft.position.y = 3.4;
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.8, 4.5, 14), toon(0xff9f43));
  handle.position.y = 7.6;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.6, 14), toon(0x4cc9f0));
  cap.position.y = 10.1;
  group.add(tip, shaft, handle, cap);
  return group;
}

function makeFile() {
  const group = new THREE.Group();
  const blade = new THREE.Mesh(new THREE.BoxGeometry(8, 0.5, 1.8), toon(0xcfd6e3));
  blade.position.set(0, 0.25, 0);
  group.add(blade);
  for (let k = 0; k < 9; k++) {
    const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.2, 1.9), toon(0x8d97aa));
    ridge.position.set(-3.6 + k * 0.9, 0.55, 0);
    group.add(ridge);
  }
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.9, 4, 12), toon(0x4ade80));
  handle.rotation.z = Math.PI / 2;
  handle.position.set(6, 0.6, 0);
  group.add(handle);
  return group;
}

const SWING_TIME = 0.08;
const BACK_TIME = 0.22;

export class ToolView {
  constructor() {
    this.group = new THREE.Group();
    this.models = { hammer: makeHammer(), chisel: makeChisel(), file: makeFile() };
    this.pivot = new THREE.Group();
    for (const model of Object.values(this.models)) {
      model.visible = false;
      this.pivot.add(model);
    }
    this.group.add(this.pivot);
    this.group.visible = false;
    this.tool = 'hammer';
    this.swing = null;
    this.hideAt = 0;
  }

  setTool(name) {
    this.tool = name;
    for (const [key, model] of Object.entries(this.models)) model.visible = key === name;
  }

  // Put the tool at a world point with the given surface normal.
  // `cameraRight` turns the handle to the right side of the screen.
  place(point, normal, cameraRight) {
    const y = normal.clone().normalize();
    const x = cameraRight.clone().addScaledVector(y, -cameraRight.dot(y));
    if (x.lengthSq() < 1e-4) x.set(1, 0, 0).addScaledVector(y, -y.x);
    x.normalize();
    const z = new THREE.Vector3().crossVectors(x, y);
    this.group.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
    this.group.position.copy(point);
    this.group.visible = true;
  }

  hide() {
    if (!this.swing) this.group.visible = false;
  }

  // Start a swing. `onImpact` runs when the tool touches the stone.
  strike(onImpact) {
    if (this.swing && !this.swing.done) this.swing.onImpact();
    this.swing = { t: 0, onImpact, done: false };
  }

  get busy() {
    return !!this.swing;
  }

  update(dt) {
    const pose = (a) => this.pose(a);
    setSolid(!!this.swing);
    if (!this.swing) {
      pose(1);
      return;
    }
    const s = this.swing;
    s.t += dt;
    if (s.t < SWING_TIME) {
      pose(1 - s.t / SWING_TIME);
    } else {
      if (!s.done) {
        s.done = true;
        s.onImpact();
      }
      const back = (s.t - SWING_TIME) / BACK_TIME;
      pose(Math.min(1, back));
      if (back >= 1) this.swing = null;
    }
  }

  // a = 1 is the raised pose. a = 0 is the pose at the moment of the hit.
  pose(a) {
    const p = this.pivot;
    p.position.set(0, 0, 0);
    p.rotation.set(0, 0, 0);
    if (this.tool === 'hammer') {
      // Turn around the end of the handle.
      const angle = a * 0.9;
      p.position.set(12 - 12 * Math.cos(angle), 12 * Math.sin(angle) + 0.4 * a, 0);
      p.rotation.z = -angle;
      p.position.y += 1.2 * a;
    } else if (this.tool === 'chisel') {
      p.position.y = 0.3 + a * 3;
      p.rotation.z = -0.15 * a;
    } else {
      p.position.y = 0.4 + a * 1.2;
      p.position.x = (1 - a) * 2.5 - 1.2 * a;
    }
  }
}
