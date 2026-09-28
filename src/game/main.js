// Smashterpiece: the start of the game. This module connects the screens,
// the input, the 3D views and the game logic.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import { createBlock, PEDESTAL, EMPTY } from '../core/grid.js';
import { hardnessOf, crumblesOf, hasHoles, STONE_NAMES } from '../core/stones.js';
import { addHoles } from '../core/holes.js';
import { makeRandom, randomInt } from '../core/random.js';
import { placeTreasures, collectUncovered, loadCollection } from '../core/treasures.js';
import { crumbleSand } from '../core/sand.js';
import { applyHit, planHit } from '../core/carve.js';
import { removeFloating } from '../core/connect.js';
import { raycastGrid } from '../core/raycast.js';
import { History } from '../core/history.js';
import { buildGhost, SHAPE_NAMES } from '../core/shapes.js';
import { matchScore, countOutside, FINISH_LIMIT, STAR_LIMITS } from '../core/score.js';
import { addStatue } from '../core/codec.js';
import { clearProgress } from '../core/save.js';

import { createRenderer, createWorkshop, floorAt } from './scene.js';
import { StoneView, linearColors } from './stone-view.js';
import { Particles } from './particles.js';
import { FallingPieces } from './pieces.js';
import { ToolView } from './tools-view.js';
import { MuseumView } from './museum-view.js';
import { Sounds } from './audio.js';
import { Confetti } from './confetti.js';
import { TreasureView } from './treasures-view.js';
import { ICONS, SHAPE_EMOJI, starSvg } from './icons.js';
import { STONE_LOOKS, stoneColors, isClear } from './palette.js';
import { drawStoneSwatch } from './textures.js';
import { $, $$, safeStorage } from './dom.js';
import { saveMethods } from './save-ui.js';
import { shareMethods } from './share-ui.js';
import { museumMethods } from './museum-ui.js';
import { collectionMethods, RARITY } from './collection-ui.js';

// A pointer that moves less than this number of pixels makes a hit.
const TAP_LIMIT = 8;
const MUTE_KEY = 'smashterpiece.muted';
const STONE_LABELS = {
  sand: 'Sand', sandstone: 'Sandstone', chocolate: 'Chocolate', cheese: 'Cheese', ice: 'Ice',
  wood: 'Wood', marble: 'Marble', glass: 'Glass', granite: 'Granite',
};
const SHAPE_LABELS = { star: 'Star', fish: 'Fish', heart: 'Heart', duck: 'Duck', smiley: 'Smiley', rocket: 'Rocket' };
const WORKSHOP_TARGET = new THREE.Vector3(0, 13, 0);

class Game {
  constructor() {
    this.storage = safeStorage();
    this.canvas = $('#view');
    this.renderer = createRenderer(this.canvas);
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.5, 900);
    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enablePan = false;
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.12;
    this.controls.rotateSpeed = 0.8;
    this.controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };

    const workshop = createWorkshop();
    this.workshop = workshop;
    this.stoneView = new StoneView();
    this.toolView = new ToolView();
    this.particles = new Particles(floorAt, (p) => this.solidAtWorld(p));
    this.sounds = new Sounds();
    this.pieces = new FallingPieces({
      stoneView: this.stoneView,
      particles: this.particles,
      sounds: this.sounds,
      floorAt,
      solidAt: (p) => this.solidAtWorld(p),
      colorOf: (i) => this.colorOf(i),
    });
    this.treasureView = new TreasureView();
    workshop.scene.add(this.stoneView.root, this.toolView.group, this.particles.group, this.pieces.group, this.treasureView.group);
    this.museum = new MuseumView();
    this.confetti = new Confetti($('#confetti'));

    this.screen = 'loading';
    this.mode = 'free';
    this.stone = 'sandstone';
    this.shape = null;
    this.tool = 'hammer';
    this.grid = null;
    this.ghost = null;
    this.history = new History();
    this.unsaved = false;
    this.lastScore = null;
    this.ghostVisible = true;
    this.treasures = [];
    this.hintClock = 0;

    this.pointers = new Map();
    this.tap = null;
    this.aim = null;
    this.hideToolAt = 0;
    this.wobble = 0;
    this.shake = 0;
    this.focusGoal = null;
    this.frameTimes = [];
    this.clock = new THREE.Clock();

    this.sounds.setMuted(this.storage.getItem(MUTE_KEY) === '1');
    // Ask the browser to keep the saved data, also when space is low.
    navigator.storage?.persist?.().catch(() => undefined);
    this.buildUi();
    this.bindInput();
    this.onResize();
    window.addEventListener('resize', () => this.onResize());
    this.showDemo();
    this.show('menu');
    this.renderer.setAnimationLoop(() => this.frame());
  }

  // ---------------------------------------------------------------- UI

  buildUi() {
    for (const el of $$('[data-action]')) {
      const icon = {
        free: 'free', challenge: 'challenge', museum: 'museum', back: 'left', home: 'home',
        undo: 'undo', save: 'museum', new: 'newStone', ghost: 'ghost', finish: 'trophy',
        keep: 'play', prev: 'left', next: 'right', delete: 'trash', yes: 'check', no: 'cross',
        treasures: 'chest', continue: 'play', parents: 'gear', export: 'download', import: 'upload',
        close: 'cross', 'close-share': 'cross', share: 'share', 'send-link': 'share', 'copy-link': 'link',
        'add-shared': 'addMuseum',
      }[el.dataset.action];
      if (icon) el.innerHTML = ICONS[icon] + el.innerHTML;
      if (el.dataset.label) el.insertAdjacentHTML('beforeend', `<span class="label">${el.dataset.label}</span>`);
    }
    for (const el of $$('[data-icon]')) el.innerHTML = ICONS[el.dataset.icon];
    for (const el of $$('[data-tool]')) el.innerHTML = ICONS[el.dataset.tool];
    this.updateSoundButton();

    const shapeTiles = $('#shape-tiles');
    const shapeColors = ['yellow', 'cyan', 'pink', 'orange', 'green', 'purple'];
    SHAPE_NAMES.forEach((name, k) => {
      const button = document.createElement('button');
      button.className = `tile ${shapeColors[k]}`;
      button.dataset.shape = name;
      button.setAttribute('aria-label', name);
      button.innerHTML = `<span class="emoji">${SHAPE_EMOJI[name]}</span><span class="label">${SHAPE_LABELS[name]}</span>`;
      shapeTiles.appendChild(button);
    });

    const stoneTiles = $('#stone-tiles');
    for (const name of STONE_NAMES) {
      const button = document.createElement('button');
      button.className = 'tile stone';
      button.style.background = STONE_LOOKS[name].swatch;
      button.dataset.stone = name;
      button.setAttribute('aria-label', name);
      const canvas = document.createElement('canvas');
      canvas.width = 160;
      canvas.height = 120;
      const colors = stoneColors(name, 32);
      drawStoneSwatch(canvas, name, (x, y, z) => {
        const i = (x + 32 * (y + 32 * z)) * 3;
        return [colors[i], colors[i + 1], colors[i + 2]];
      });
      const hits = document.createElement('div');
      hits.className = 'hits';
      hits.innerHTML = ICONS.hammer.repeat(hardnessOf(name));
      const label = document.createElement('span');
      label.className = 'label';
      label.textContent = STONE_LABELS[name];
      button.append(canvas, label, hits);
      stoneTiles.appendChild(button);
    }

    const meterStars = $('#meter-stars');
    for (let k = 0; k < 3; k++) {
      const star = document.createElement('div');
      star.className = 'star';
      star.innerHTML = `${starSvg(false)}<div class="fill">${starSvg(true)}</div>`;
      meterStars.appendChild(star);
    }
    const resultStars = $('#result-stars');
    for (let k = 0; k < 3; k++) {
      const star = document.createElement('div');
      star.className = 'star';
      resultStars.appendChild(star);
    }

    this.updateTreasureBadge();
    this.updateContinue();
    $('#import-file').addEventListener('change', (e) => this.importBackup(e.target));
    document.addEventListener('click', (e) => this.onClick(e));
    // Save the game when the player leaves the page or the app.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.saveNow();
    });
    window.addEventListener('pagehide', () => this.saveNow());
    document.addEventListener('keydown', (e) => this.onKey(e));
  }

  show(name) {
    this.screen = name;
    for (const el of $$('.screen')) el.classList.toggle('show', el.id === name);
    $('#museum').classList.remove('shared');
    const inWorkshop = name !== 'museum';
    this.controls.autoRotate = ['menu', 'shapes', 'stones', 'treasures'].includes(name);
    this.controls.autoRotateSpeed = 0.8;
    this.controls.enabled = name === 'play' || name === 'museum';
    if (inWorkshop) {
      this.controls.minDistance = 25;
      this.controls.maxDistance = Math.max(140, this.fitDistance() * 1.4);
      this.controls.maxPolarAngle = 1.52;
      this.controls.minPolarAngle = 0.05;
    } else {
      this.controls.minDistance = 7;
      this.controls.maxDistance = 34;
      this.controls.maxPolarAngle = 1.45;
      this.controls.minPolarAngle = 0.2;
    }
    this.hideAim();
  }

  async onClick(e) {
    const button = e.target.closest('button');
    if (!button) return;
    this.sounds.unlock();
    if (button.dataset.tool) return this.setTool(button.dataset.tool);
    if (button.dataset.shape) {
      this.sounds.select();
      this.shape = button.dataset.shape;
      this.mode = 'challenge';
      return this.show('stones');
    }
    if (button.dataset.treasure) {
      button.classList.remove('wiggle');
      void button.offsetWidth;
      button.classList.add('wiggle');
      return this.sounds.treasure(RARITY[button.dataset.treasure]);
    }
    if (button.dataset.stone) {
      this.sounds.select();
      return this.startGame(button.dataset.stone);
    }
    const action = button.dataset.action;
    if (!action) return;
    if (action !== 'sound') this.sounds.pop();
    switch (action) {
      case 'free':
        if (!(await this.confirmNewGame())) return undefined;
        this.mode = 'free';
        this.shape = null;
        return this.show('stones');
      case 'challenge':
        if (!(await this.confirmNewGame())) return undefined;
        return this.show('shapes');
      case 'continue':
        return this.resumeGame();
      case 'parents':
        $('#backup-result').textContent = '';
        return $('#backup').classList.add('show');
      case 'close':
        return $('#backup').classList.remove('show');
      case 'share':
        return this.shareStatue();
      case 'close-share':
        return $('#share').classList.remove('show');
      case 'send-link':
        return this.sendLink();
      case 'copy-link':
        return this.copyLink();
      case 'add-shared':
        return this.addShared();
      case 'export':
        return this.exportBackup();
      case 'import':
        return $('#import-file').click();
      case 'museum':
        return this.openMuseum();
      case 'treasures':
        return this.openTreasures();
      case 'back':
        return this.show(this.screen === 'stones' && this.mode === 'challenge' ? 'shapes' : 'menu');
      case 'home':
        return this.goHome();
      case 'sound':
        this.sounds.setMuted(!this.sounds.muted);
        this.storage.setItem(MUTE_KEY, this.sounds.muted ? '1' : '0');
        this.updateSoundButton();
        return this.sounds.pop();
      case 'undo':
        return this.undo();
      case 'save':
        return this.save();
      case 'new':
        return this.newStone();
      case 'ghost':
        return this.toggleGhost();
      case 'finish':
        return this.finish();
      case 'keep':
        return $('#celebrate').classList.remove('show');
      case 'prev':
        return this.selectStatue(this.museum.selected - 1);
      case 'next':
        return this.selectStatue(this.museum.selected + 1);
      case 'delete':
        return this.deleteStatue();
      default:
        return undefined;
    }
  }

  onKey(e) {
    if (this.screen !== 'play') return;
    this.sounds.unlock();
    if (e.key === '1') this.setTool('hammer');
    if (e.key === '2') this.setTool('chisel');
    if (e.key === '3') this.setTool('file');
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      this.undo();
    }
  }

  updateSoundButton() {
    $('[data-action="sound"]').innerHTML = this.sounds.muted ? ICONS.soundOff : ICONS.soundOn;
  }

  setTool(name) {
    this.tool = name;
    this.toolView.setTool(name);
    for (const el of $$('[data-tool]')) el.classList.toggle('selected', el.dataset.tool === name);
    this.sounds.select();
    this.refreshAim();
  }

  updateButtons() {
    $('[data-action="undo"]').disabled = !this.history.canUndo();
    $('[data-action="new"]').style.display = this.mode === 'free' ? '' : 'none';
    $('#meter').style.display = this.mode === 'challenge' ? '' : 'none';
    $('[data-action="ghost"]').innerHTML = this.ghostVisible ? ICONS.ghost : ICONS.ghostOff;
  }

  // Ask a yes or no question with an icon. Return a promise.
  ask(icon) {
    const box = $('#confirm');
    $('#confirm-icon').innerHTML = ICONS[icon] + ICONS.question.replace('<svg', '<svg style="width:45%;height:45%;margin-left:55%;margin-top:-45%"');
    box.classList.add('show');
    return new Promise((resolve) => {
      const done = (e) => {
        const button = e.target.closest('button');
        if (!button || !['yes', 'no'].includes(button.dataset.action)) return;
        box.removeEventListener('click', done);
        box.classList.remove('show');
        resolve(button.dataset.action === 'yes');
      };
      box.addEventListener('click', done);
    });
  }

  flash(icon, white = false) {
    const el = $('#flash');
    el.innerHTML = ICONS[icon];
    el.classList.remove('go');
    void el.offsetWidth;
    el.classList.add('go');
    if (white) {
      document.body.classList.remove('flashwhite');
      void document.body.offsetWidth;
      document.body.classList.add('flashwhite');
      setTimeout(() => document.body.classList.remove('flashwhite'), 450);
    }
  }

  // ---------------------------------------------------------------- Game

  showDemo() {
    // The menu shows a marble heart.
    const ghost = buildGhost('heart');
    const grid = createBlock({ hardness: 2, box: ghost.box });
    for (let i = 0; i < grid.cells.length; i++) {
      if (grid.cells[i] !== PEDESTAL && !ghost.mask[i]) grid.cells[i] = EMPTY;
    }
    this.grid = grid;
    this.stone = 'marble';
    this.hardness = 2;
    this.stoneView.setStone(grid, 'marble', 2, null);
    this.resetCamera();
  }

  startGame(stone) {
    const hardness = hardnessOf(stone);
    this.stone = stone;
    this.hardness = hardness;
    this.ghost = this.mode === 'challenge' ? buildGhost(this.shape) : null;
    this.grid = createBlock({ hardness, box: this.ghost ? this.ghost.box : null });
    const rand = makeRandom(Date.now());
    const avoidMask = this.ghost ? this.ghost.mask : null;
    if (hasHoles(stone)) {
      addHoles(this.grid, { count: randomInt(rand, 10, 16), rand, avoidMask });
      // A hole can cut off a small part. That part is not in the block.
      removeFloating(this.grid);
    }
    this.treasures = placeTreasures(this.grid, {
      count: randomInt(rand, 2, 3),
      rand,
      avoidMask,
      collected: loadCollection(this.storage),
    });
    this.treasureView.clear();
    this.outsideStart = this.ghost ? countOutside(this.grid, this.ghost.mask) : 0;
    this.playing = true;
    clearProgress(this.storage);
    this.history.clear();
    this.pieces.clear();
    this.particles.clear();
    this.ghostVisible = true;
    this.stoneView.setStone(this.grid, stone, hardness, this.ghost);
    this.unsaved = false;
    this.finished = false;
    this.lastScore = null;
    this.resetCamera();
    this.show('play');
    this.setTool(this.tool);
    this.updateButtons();
    this.updateScore(true);
  }

  async goHome() {
    $('#celebrate').classList.remove('show');
    if (this.screen === 'play') this.saveNow();
    this.updateContinue();
    this.pieces.clear();
    this.particles.clear();
    this.treasureView.clear();
    if (this.screen === 'museum') this.focusGoal = null;
    this.resetCamera();
    this.show('menu');
  }

  async newStone() {
    if (this.history.canUndo() && !(await this.ask('newStone'))) return;
    this.show('stones');
  }

  // The camera distance that shows all of the stone on this screen.
  fitDistance() {
    const aspect = this.camera.aspect || 1;
    const halfFov = THREE.MathUtils.degToRad(this.camera.fov / 2);
    const fitHeight = 31 / Math.tan(halfFov);
    const fitWidth = 30 / (Math.tan(halfFov) * aspect);
    return Math.max(fitHeight, fitWidth);
  }

  resetCamera() {
    this.controls.target.copy(WORKSHOP_TARGET);
    const distance = this.fitDistance();
    this.controls.maxDistance = Math.max(140, distance * 1.4);
    this.camera.position.set(distance * 0.38, WORKSHOP_TARGET.y + distance * 0.34, distance * 0.88);
    this.camera.lookAt(this.controls.target);
    this.controls.update();
  }

  solidAtWorld(p) {
    if (!this.grid || this.screen === 'museum') return false;
    const half = this.grid.size / 2;
    return this.grid.isSolid(Math.floor(p.x + half), Math.floor(p.y), Math.floor(p.z + half));
  }

  colorOf(i) {
    const colors = linearColors(this.stone, this.grid.size);
    return [colors[i * 3], colors[i * 3 + 1], colors[i * 3 + 2]];
  }

  // Find the voxel under a screen point.
  pick(clientX, clientY) {
    if (!this.grid) return null;
    const ndc = new THREE.Vector2((clientX / window.innerWidth) * 2 - 1, -(clientY / window.innerHeight) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    const inner = this.stoneView.inner;
    inner.updateWorldMatrix(true, false);
    const a = inner.worldToLocal(ray.ray.origin.clone());
    const b = inner.worldToLocal(ray.ray.origin.clone().addScaledVector(ray.ray.direction, 100));
    const dir = b.sub(a);
    return raycastGrid(this.grid, [a.x, a.y, a.z], [dir.x, dir.y, dir.z]);
  }

  updateAim(clientX, clientY) {
    this.aimPoint = { x: clientX, y: clientY };
    const hit = this.pick(clientX, clientY);
    if (!hit) {
      this.hideAim();
      this.aimPoint = { x: clientX, y: clientY };
      return;
    }
    const plan = planHit(this.grid, this.tool, hit.x, hit.y, hit.z);
    this.stoneView.showPreview(plan);
    const n = new THREE.Vector3(...hit.normal);
    const point = this.stoneView.toWorld(hit.x + 0.5 + n.x * 0.5, hit.y + 0.5 + n.y * 0.5, hit.z + 0.5 + n.z * 0.5);
    const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0);
    this.toolView.place(point, n, right);
    this.aim = { hit, plan };
  }

  refreshAim() {
    if (this.aimPoint && this.screen === 'play' && (this.mouseInside || this.tap)) {
      this.updateAim(this.aimPoint.x, this.aimPoint.y);
    }
  }

  hideAim() {
    this.aim = null;
    this.aimPoint = null;
    this.stoneView.hidePreview();
    this.toolView.hide();
  }

  hitAt(clientX, clientY, pointerType) {
    this.updateAim(clientX, clientY);
    const aim = this.aim;
    if (!aim) return;
    const { hit } = aim;
    this.toolView.strike(() => this.impact(hit));
    if (pointerType !== 'mouse') this.hideToolAt = performance.now() + 450;
  }

  impact(hit) {
    const grid = this.grid;
    const before = grid.cells.slice();
    const result = applyHit(grid, this.tool, hit.x, hit.y, hit.z);
    const n = new THREE.Vector3(...hit.normal);
    const point = this.stoneView.toWorld(hit.x + 0.5 + n.x * 0.5, hit.y + 0.5 + n.y * 0.5, hit.z + 0.5 + n.z * 0.5);
    if (result.removed.length === 0 && result.cracked.length === 0) {
      this.sounds.thud();
      this.particles.puff(point, new THREE.Vector3(0, 2, 0), 1.2, [1, 1, 1]);
      this.shake = Math.max(this.shake, 0.15);
      return;
    }
    this.history.push(before);
    const crumbled = crumblesOf(this.stone) && result.removed.length > 0 ? crumbleSand(grid, hit.x, hit.y, hit.z) : [];
    const pieces = result.removed.length > 0 ? removeFloating(grid) : [];
    this.stoneView.markCells(result.removed);
    this.stoneView.markCells(crumbled);
    this.stoneView.markCells(result.cracked);
    for (const piece of pieces) this.stoneView.markCells(piece.map((c) => c.index));
    this.stoneView.flush();
    for (const piece of pieces) this.pieces.add(piece, grid, this.stone, this.hardness);
    for (const t of collectUncovered(grid, this.treasures)) this.findTreasure(t);

    this.effects(result, point, n, before);
    if (crumbled.length > 0) this.pourSand(crumbled);
    this.unsaved = true;
    this.scheduleSave();
    this.updateButtons();
    this.updateScore();
    this.refreshAim();
  }

  // Loose sand pours down as small grains.
  pourSand(cells) {
    const xyz = [0, 0, 0];
    const step = Math.max(1, Math.floor(cells.length / 60));
    for (let k = 0; k < cells.length; k += step) {
      const i = cells[k];
      this.grid.coords(i, xyz);
      const p = this.stoneView.toWorld(xyz[0] + 0.5, xyz[1] + 0.5, xyz[2] + 0.5);
      const vel = new THREE.Vector3((Math.random() - 0.5) * 2, -Math.random() * 3, (Math.random() - 0.5) * 2);
      this.particles.chip(p, vel, 0.2 + Math.random() * 0.2, this.colorOf(i), 1.5 + Math.random());
    }
    this.sounds.pour(Math.min(1.2, 0.3 + cells.length / 40));
  }

  effects(result, point, normal, before) {
    const { removed, cracked } = result;
    // Sand makes small grains. Wood makes thin shavings. Other stones make
    // larger chips.
    const grain = this.stone === 'sand' ? 0.4 : 1;
    const stretch = this.stone === 'wood' ? [1.9, 0.25, 0.7] : null;
    const xyz = [0, 0, 0];
    const dust = STONE_LOOKS[this.stone].dust;
    const tangent = new THREE.Vector3(normal.y, normal.z, normal.x);
    const bitangent = new THREE.Vector3().crossVectors(normal, tangent);
    const rand = (a, b) => a + Math.random() * (b - a);
    const cellPoint = (i) => {
      this.grid.coords(i, xyz);
      return this.stoneView.toWorld(xyz[0] + 0.5, xyz[1] + 0.5, xyz[2] + 0.5);
    };
    const sample = (list, count) => {
      const out = [];
      for (let k = 0; k < count && list.length > 0; k++) out.push(list[Math.floor(Math.random() * list.length)]);
      return out;
    };
    const spray = (speed, spread, up) =>
      normal.clone().multiplyScalar(speed)
        .addScaledVector(tangent, rand(-spread, spread))
        .addScaledVector(bitangent, rand(-spread, spread))
        .add(new THREE.Vector3(0, up, 0));

    if (this.tool === 'hammer') {
      const chips = removed.length > 0 ? Math.min(28, 8 + Math.floor(removed.length / 5)) : 4;
      for (const i of sample(removed.length ? removed : cracked, chips)) {
        this.particles.chip(cellPoint(i), spray(rand(8, 18), 9, rand(4, 12)), rand(0.4, 0.95) * grain, this.colorOf(i), undefined, stretch);
      }
      for (let k = 0; k < (removed.length ? 7 : 3); k++) {
        this.particles.puff(point, spray(rand(4, 9), 6, rand(0, 3)), rand(0.9, 2.1), dust);
      }
      this.sounds.hammer(this.stone, removed.length);
      this.wobble = 1;
      this.shake = Math.max(this.shake, removed.length > 60 ? 0.6 : 0.35);
    } else if (this.tool === 'chisel') {
      for (const i of sample(removed.length ? removed : cracked, removed.length ? 7 : 3)) {
        this.particles.chip(cellPoint(i), spray(rand(14, 24), 5, rand(2, 8)), rand(0.25, 0.45) * grain, this.colorOf(i), undefined, stretch);
      }
      for (let k = 0; k < 7; k++) {
        this.particles.spark(point, spray(rand(10, 22), 12, rand(0, 8)), rand(0.25, 0.45), [1, 0.85, 0.3]);
      }
      for (let k = 0; k < 3; k++) this.particles.puff(point, spray(rand(2, 5), 3, 1), rand(0.6, 1.1), dust);
      this.sounds.chisel(this.stone);
      this.wobble = Math.max(this.wobble, 0.3);
      this.shake = Math.max(this.shake, 0.1);
    } else {
      for (const i of sample(removed, 2)) {
        this.particles.chip(cellPoint(i), spray(rand(3, 6), 4, 3), rand(0.2, 0.35), this.colorOf(i));
      }
      const swirl = Math.random() < 0.5 ? 1 : -1;
      for (let k = 0; k < 12; k++) {
        const vel = tangent.clone().multiplyScalar(swirl * rand(5, 10)).addScaledVector(normal, rand(1, 4)).add(new THREE.Vector3(0, rand(0, 2), 0));
        this.particles.puff(point.clone().addScaledVector(tangent, rand(-1.5, 1.5)), vel, rand(0.5, 1.1), dust, rand(0.5, 1));
      }
      this.sounds.file(this.stone);
    }
    if (isClear(this.stone) && removed.length > 0) {
      // Glass breaks into shiny pieces.
      const shards = Math.min(24, 6 + Math.floor(removed.length / 6));
      for (const i of sample(removed, shards)) {
        const color = Math.random() < 0.4 ? [1, 1, 1] : [0.55, 0.9, 1];
        this.particles.spark(cellPoint(i), spray(rand(8, 20), 10, rand(4, 12)), rand(0.3, 0.7), color, rand(0.5, 0.9));
      }
    }
    if (cracked.length > 0 && removed.length === 0) this.sounds.crack();
    if (removed.length > 0 && before && this.hardness > 1) {
      // A voxel that breaks in hard stone gives a small crack sound too.
      if (Math.random() < 0.5) this.sounds.crack();
    }
  }

  undo() {
    const cells = this.history.undo();
    if (!cells) return;
    this.grid.copyFrom(cells);
    this.stoneView.markAll();
    this.stoneView.flush();
    this.sounds.undo();
    this.particles.puff(new THREE.Vector3(0, 16, 0), new THREE.Vector3(0, 3, 0), 3, [1, 1, 1]);
    this.unsaved = this.history.canUndo();
    this.scheduleSave();
    this.updateButtons();
    this.updateScore();
    this.refreshAim();
  }

  toggleGhost() {
    this.ghostVisible = !this.ghostVisible;
    this.stoneView.setGhostVisible(this.ghostVisible);
    this.updateButtons();
  }

  // Update the star meter of the challenge.
  updateScore(silent = false) {
    if (this.mode !== 'challenge' || !this.ghost) return;
    const result = matchScore(this.grid, this.ghost.mask, this.outsideStart);
    const limits = [0, FINISH_LIMIT, STAR_LIMITS[0], STAR_LIMITS[1]];
    const stars = $$('#meter-stars .star');
    stars.forEach((star, k) => {
      const part = (result.score - limits[k]) / (limits[k + 1] - limits[k]);
      const fill = Math.max(0, Math.min(1, part));
      star.querySelector('.fill').style.clipPath = `inset(${(1 - fill) * 100}% 0 0 0)`;
      const full = fill >= 1;
      if (full && !star.classList.contains('full') && !silent) this.sounds.star(k);
      star.classList.toggle('full', full);
    });
    $('[data-action="finish"]').style.display = result.score >= FINISH_LIMIT ? '' : 'none';
    this.lastScore = result;
  }

  finish() {
    if (!this.lastScore) return;
    this.finished = true;
    const stars = this.lastScore.stars;
    const box = $('#celebrate');
    box.classList.add('show');
    $$('#result-stars .star').forEach((el, k) => {
      el.innerHTML = starSvg(k < stars);
      el.classList.remove('pop');
      setTimeout(() => {
        el.classList.add('pop');
        if (k < stars) this.sounds.star(k);
      }, 450 + k * 350);
    });
    this.sounds.hooray();
    this.confetti.burst(200);
    setTimeout(() => this.confetti.burst(120), 900);
  }

  save() {
    if (!this.grid || this.screen !== 'play') return;
    const stars = this.mode === 'challenge' && this.lastScore ? this.lastScore.stars : 0;
    try {
      addStatue(this.storage, {
        size: this.grid.size,
        cells: this.grid.cells,
        stone: this.stone,
        shape: this.mode === 'challenge' ? this.shape : null,
        stars,
        created: Date.now(),
      });
    } catch {
      // The storage is full.
      this.flash('cross');
      this.sounds.thud();
      return;
    }
    this.unsaved = false;
    $('#celebrate').classList.remove('show');
    this.flash('museum', true);
    this.sounds.snap();
    this.confetti.burst(90);
  }

  // ---------------------------------------------------------------- Input

  bindInput() {
    const canvas = this.canvas;
    canvas.addEventListener('pointerdown', (e) => {
      this.sounds.unlock();
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pointers.size === 1) {
        this.tap = { id: e.pointerId, x: e.clientX, y: e.clientY, type: e.pointerType };
        if (this.screen === 'play') this.updateAim(e.clientX, e.clientY);
      } else {
        // Two fingers: this is a pinch, not a hit.
        this.tap = null;
        this.hideAim();
      }
    });
    canvas.addEventListener('pointermove', (e) => {
      if (this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.tap && this.tap.id === e.pointerId) {
        if (Math.hypot(e.clientX - this.tap.x, e.clientY - this.tap.y) > TAP_LIMIT) {
          this.tap = null;
          this.hideAim();
        }
      } else if (e.pointerType === 'mouse' && this.pointers.size === 0 && this.screen === 'play') {
        this.mouseInside = true;
        this.updateAim(e.clientX, e.clientY);
      }
    });
    const end = (e) => {
      const tap = this.tap;
      this.pointers.delete(e.pointerId);
      if (!tap || tap.id !== e.pointerId) return;
      this.tap = null;
      if (e.type !== 'pointerup') return this.hideAim();
      if (Math.hypot(e.clientX - tap.x, e.clientY - tap.y) > TAP_LIMIT) return this.hideAim();
      if (this.screen === 'play') this.hitAt(e.clientX, e.clientY, e.pointerType);
      else if (this.screen === 'museum') this.tapMuseum(e.clientX, e.clientY);
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
    canvas.addEventListener('pointerleave', (e) => {
      if (e.pointerType === 'mouse') {
        this.mouseInside = false;
        if (!this.tap) this.hideAim();
      }
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    // Stop the page zoom on iPad.
    document.addEventListener('gesturestart', (e) => e.preventDefault());
    document.addEventListener('dblclick', (e) => e.preventDefault());
  }

  // ---------------------------------------------------------------- Loop

  onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const before = this.fitDistance();
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.screen !== 'museum' && this.screen !== 'loading') {
      // When the phone turns, keep all of the stone on the screen.
      const after = this.fitDistance();
      this.controls.maxDistance = Math.max(140, after * 1.4);
      const offset = this.camera.position.clone().sub(this.controls.target);
      this.camera.position.copy(this.controls.target).addScaledVector(offset, after / before);
    }
  }

  frame() {
    const dt = Math.min(0.05, this.clock.getDelta());
    const time = this.clock.elapsedTime;
    this.adaptQuality(dt);

    if (this.focusGoal) {
      // Move the camera smoothly to the selected statue.
      const step = this.focusGoal.clone().sub(this.controls.target).multiplyScalar(Math.min(1, dt * 6));
      this.controls.target.add(step);
      this.camera.position.add(step);
      if (step.lengthSq() < 1e-6) this.focusGoal = null;
    }
    this.controls.update();

    let scene;
    if (this.screen === 'museum') {
      scene = this.museum.scene;
      this.museum.update(time);
    } else {
      scene = this.workshop.scene;
      this.workshop.update(time);
      this.stoneView.update(time);
      this.toolView.update(dt);
      if (this.hideToolAt && performance.now() > this.hideToolAt && !this.toolView.busy) {
        this.hideToolAt = 0;
        if (!this.tap) this.hideAim();
      }
      this.pieces.update(dt);
      this.particles.update(dt);
      this.treasureView.update(dt);
      if (this.screen === 'play') this.showHints(dt);
      // The stone wobbles like jelly after a hit.
      this.wobble = Math.max(0, this.wobble - dt * 3);
      const s = this.wobble * Math.sin(time * 45) * 0.03;
      this.stoneView.root.scale.set(1 + s, 1 - s, 1 + s);
    }

    // Shake the camera only for this frame.
    this.shake = Math.max(0, this.shake - dt * 2.5);
    const offset = new THREE.Vector3(
      (Math.random() - 0.5) * this.shake,
      (Math.random() - 0.5) * this.shake,
      (Math.random() - 0.5) * this.shake,
    );
    this.camera.position.add(offset);
    this.renderer.render(scene, this.camera);
    this.camera.position.sub(offset);
  }

  // Make the picture smaller when the device is too slow for 60 fps.
  adaptQuality(dt) {
    this.frameTimes.push(dt);
    if (this.frameTimes.length < 90) return;
    const average = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    this.frameTimes.length = 0;
    const ratio = this.renderer.getPixelRatio();
    if (average > 1 / 45 && ratio > 1) {
      this.renderer.setPixelRatio(Math.max(1, ratio - 0.25));
      this.onResize();
    }
  }
}

Object.assign(Game.prototype, saveMethods, shareMethods, museumMethods, collectionMethods);

function start() {
  try {
    // Keep a reference to the game for the browser console.
    window.game = new Game();
    $('#loading').classList.remove('show');
    window.game.openSharedLink();
    window.addEventListener('hashchange', () => window.game.openSharedLink());
  } catch (error) {
    console.error(error);
    $('#loading .spinner').style.display = 'none';
  }
}

start();

// Keep the game files for offline play and for the installed app.
if ('serviceWorker' in navigator && window.isSecureContext) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => undefined);
  });
}
