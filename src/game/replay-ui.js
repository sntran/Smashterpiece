// The time-lapse: the game plays back how a statue was made, in a few
// seconds. These methods belong to the Game class (see main.js).

import * as THREE from 'three';
import { createBlock } from '../core/grid.js';
import { hardnessOf } from '../core/stones.js';
import { loadMuseum, decodeStatue } from '../core/codec.js';
import { applyStep, decodeReplay, OPS } from '../core/replay.js';
import { $ } from './dom.js';

// The time before the first step, and after the last step.
const START_WAIT = 0.8;
const END_WAIT = 2.2;
// The time-lapse takes from 4 to 12 seconds.
const MIN_TIME = 4;
const MAX_TIME = 12;
const SECONDS_PER_STEP = 0.08;
// The time between two sounds, so that a fast time-lapse is not too loud.
const SOUND_GAP = 0.16;

export const replayMethods = {
  // Play the time-lapse of the selected statue in the Museum.
  startReplay() {
    const id = this.museum.selectedId();
    const record = loadMuseum(this.storage).find((r) => r.id === id);
    if (!record) return;
    const statue = decodeStatue(record);
    const replay = decodeReplay(statue.replay, statue.size);
    if (!replay) {
      this.flash('cross');
      this.sounds.thud();
      this.announce(this.t('replay.none'));
      return;
    }
    // The time-lapse must not replace the saved game.
    this.saveNow();
    this.playing = false;
    this.stone = statue.stone;
    this.hardness = hardnessOf(statue.stone);
    this.ghost = null;
    this.grid = createBlock({ size: statue.size, hardness: this.hardness });
    this.grid.cells.set(replay.start);
    this.stickers = [];
    this.stickerView.clear();
    this.pieces.clear();
    this.particles.clear();
    this.treasureView.clear();
    this.stoneView.setStone(this.grid, this.stone, this.hardness, null);
    const duration = Math.min(MAX_TIME, Math.max(MIN_TIME, replay.steps.length * SECONDS_PER_STEP));
    this.replay = {
      id,
      steps: replay.steps,
      next: 0,
      time: -START_WAIT,
      rate: replay.steps.length / duration,
      soundClock: 0,
      endTime: 0,
    };
    this.resetCamera();
    // A little farther away, so that the turning stone stays on the screen.
    this.camera.position.sub(this.controls.target).multiplyScalar(1.2).add(this.controls.target);
    this.controls.update();
    this.show('replay');
    $('#replay-bar').style.width = '0%';
  },

  stopReplay() {
    const id = this.replay?.id;
    this.replay = null;
    this.pieces.clear();
    this.particles.clear();
    this.stickerView.clear();
    this.openMuseum();
    const index = loadMuseum(this.storage).findIndex((r) => r.id === id);
    if (index >= 0) {
      this.museum.select(index);
      this.focusMuseumCamera();
      this.updateMuseumButtons();
    }
  },

  updateReplay(dt) {
    const r = this.replay;
    if (!r || this.screen !== 'replay') return;
    r.time += dt;
    r.soundClock -= dt;
    const target = Math.min(r.steps.length, Math.floor(Math.max(0, r.time) * r.rate) + (r.time >= 0 ? 1 : 0));
    let changedStickers = false;
    while (r.next < target) {
      const step = r.steps[r.next++];
      const result = applyStep(this.grid, this.stickers, step, this.stone);
      if (result.stickers !== this.stickers) changedStickers = true;
      this.stickers = result.stickers;
      this.showStep(step, result);
    }
    this.stoneView.flush();
    if (changedStickers) this.stickerView.set(this.stickers);
    $('#replay-bar').style.width = `${Math.round((r.next / Math.max(1, r.steps.length)) * 100)}%`;
    if (r.next >= r.steps.length) {
      if (r.endTime === 0) {
        this.sounds.star(2);
        this.confetti.burst(100);
      }
      r.endTime += dt;
      if (r.endTime > END_WAIT) this.stopReplay();
    }
  },

  // The chips, the dust and the sound of one step.
  showStep(step, result) {
    const name = OPS[step.op];
    const cells = [
      ...result.removed, ...result.cracked, ...result.crumbled, ...result.added, ...result.painted,
    ];
    for (const piece of result.pieces) cells.push(...piece.map((c) => c.index));
    this.stoneView.markCells(cells);
    for (const piece of result.pieces) this.pieces.add(piece, this.grid, this.stone, this.hardness);
    if (result.fallen.length) this.stickerView.drop(result.fallen);
    const xyz = [0, 0, 0];
    const point = (i) => {
      this.grid.coords(i, xyz);
      return this.stoneView.toWorld(xyz[0] + 0.5, xyz[1] + 0.5, xyz[2] + 0.5);
    };
    for (let k = 0; k < Math.min(3, result.removed.length); k++) {
      const i = result.removed[Math.floor(Math.random() * result.removed.length)];
      const vel = new THREE.Vector3((Math.random() - 0.5) * 14, 6 + Math.random() * 8, (Math.random() - 0.5) * 14);
      this.particles.chip(point(i), vel, 0.3 + Math.random() * 0.4, this.colorOf(i));
    }
    if (result.added.length > 0) this.particles.puff(point(result.added[0]), new THREE.Vector3(0, 3, 0), 0.8, [1, 1, 1]);
    if (this.replay.soundClock > 0) return;
    this.replay.soundClock = SOUND_GAP;
    if (name.startsWith('hammer')) this.sounds.hammer(this.stone, result.removed.length);
    else if (name.startsWith('chisel')) this.sounds.chisel(this.stone);
    else if (name === 'file') this.sounds.file(this.stone);
    else if (name === 'clay') this.sounds.plop();
    else if (name === 'paint') this.sounds.swish();
    else this.sounds.stickerPop();
  },
};
