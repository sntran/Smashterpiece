// The renderer and the workshop scene around the stone.

import * as THREE from 'three';
import { floorTexture, skyTexture, sunTexture, toonGradient } from './textures.js';

export const FLOOR_Y = -8;
// The stand is a little larger than the pedestal (32 x 32).
export const STAND_HALF = 18;

export function createRenderer(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: dpr < 2, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(dpr, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  return renderer;
}

export function addLights(scene) {
  const hemi = new THREE.HemisphereLight(0xffffff, 0x9a7fc4, 1.2);
  const sun = new THREE.DirectionalLight(0xffffff, 2.8);
  sun.position.set(25, 80, 50);
  const fill = new THREE.DirectionalLight(0xc9e7ff, 0.8);
  fill.position.set(-40, 20, -30);
  scene.add(hemi, sun, fill);
}

function makeCloud() {
  const cloud = new THREE.Group();
  const material = new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: toonGradient() });
  const geometry = new THREE.SphereGeometry(1, 12, 10);
  const parts = [[0, 0, 0, 7], [7, -1, 0, 5.5], [-7, -1.5, 0, 5], [3, 3.5, 0, 5], [-3, 2.5, 1, 4.5]];
  for (const [x, y, z, r] of parts) {
    const ball = new THREE.Mesh(geometry, material);
    ball.position.set(x, y, z);
    ball.scale.setScalar(r);
    cloud.add(ball);
  }
  return cloud;
}

// Make the workshop: sky, floor, stand, clouds and a happy sun.
export function createWorkshop() {
  const scene = new THREE.Scene();
  scene.background = skyTexture();
  addLights(scene);

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(160, 64),
    new THREE.MeshToonMaterial({ map: floorTexture(), gradientMap: toonGradient() }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = FLOOR_Y;
  scene.add(floor);

  const stand = new THREE.Mesh(
    new THREE.BoxGeometry(STAND_HALF * 2, -FLOOR_Y, STAND_HALF * 2),
    new THREE.MeshToonMaterial({ color: 0x4cc9f0, gradientMap: toonGradient() }),
  );
  stand.position.y = FLOOR_Y / 2;
  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(STAND_HALF * 2 + 0.4, 1.6, STAND_HALF * 2 + 0.4),
    new THREE.MeshToonMaterial({ color: 0xffd35c, gradientMap: toonGradient() }),
  );
  stripe.position.y = FLOOR_Y / 2;
  scene.add(stand, stripe);

  const clouds = [];
  for (let k = 0; k < 7; k++) {
    const cloud = makeCloud();
    const angle = (k / 7) * Math.PI * 2 + Math.random() * 0.4;
    // The clouds are far away, so that they never come between the
    // camera and the stone.
    const r = 280 + Math.random() * 60;
    cloud.position.set(Math.cos(angle) * r, 90 + Math.random() * 70, Math.sin(angle) * r);
    cloud.scale.setScalar(2 + Math.random() * 1.2);
    cloud.userData.angle = angle;
    cloud.userData.radius = r;
    scene.add(cloud);
    clouds.push(cloud);
  }

  const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunTexture(), fog: false }));
  sun.scale.set(70, 70, 1);
  sun.position.set(-160, 200, -280);
  scene.add(sun);

  const update = (time) => {
    for (const cloud of clouds) {
      const a = cloud.userData.angle + time * 0.01;
      cloud.position.x = Math.cos(a) * cloud.userData.radius;
      cloud.position.z = Math.sin(a) * cloud.userData.radius;
    }
    sun.material.rotation = Math.sin(time * 0.8) * 0.12;
  };

  return { scene, update };
}

// The floor height at a point: the top of the stand or the floor.
export function floorAt(x, z) {
  return Math.abs(x) < STAND_HALF && Math.abs(z) < STAND_HALF ? 0 : FLOOR_Y;
}
