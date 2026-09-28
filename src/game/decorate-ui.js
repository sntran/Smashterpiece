// The clay, the brush and the stickers. These methods belong to the Game
// class (see main.js).

import * as THREE from 'three';
import { planHit } from '../core/carve.js';
import { planClay, planPaint, faceOf, STICKER_TYPES } from '../core/decorate.js';
import { makeStep, applyStep, encodeReplay, MAX_STEPS } from '../core/replay.js';
import { PAINTS } from './palette.js';
import { STICKER_LOOKS } from './stickers-view.js';
import { ICONS } from './icons.js';
import { $, $$ } from './dom.js';

export const DECOR_TOOLS = ['clay', 'brush', 'sticker'];

export const decorateMethods = {
  // A copy of everything that undo must bring back.
  snapshot() {
    return {
      cells: this.grid.cells.slice(),
      paint: this.grid.paint.slice(),
      stickers: this.stickers.map((s) => ({ ...s })),
    };
  },

  restoreSnapshot(state) {
    this.grid.cells.set(state.cells);
    this.grid.paint.set(state.paint);
    this.stickers = state.stickers.map((s) => ({ ...s }));
    this.stickerView.set(this.stickers);
  },

  // The buttons above the toolbar: the paint colors or the stickers.
  buildToolOptions() {
    const box = $('#tool-options');
    box.innerHTML = '';
    if (this.tool === 'brush') {
      PAINTS.forEach((paint, k) => {
        const button = document.createElement('button');
        button.className = 'option swatch';
        button.style.background = paint.css;
        button.dataset.paint = String(k + 1);
        button.setAttribute('aria-label', this.t('paint.label', { name: this.t(`paint.${paint.key}`) }));
        box.appendChild(button);
      });
      const eraser = document.createElement('button');
      eraser.className = 'option swatch eraser';
      eraser.dataset.paint = '0';
      eraser.setAttribute('aria-label', this.t('paint.remove'));
      eraser.innerHTML = ICONS.cross;
      box.appendChild(eraser);
    } else if (this.tool === 'sticker') {
      for (const type of STICKER_TYPES) {
        const button = document.createElement('button');
        button.className = 'option';
        button.dataset.sticker = type;
        button.setAttribute('aria-label', this.t(`sticker.${type}`));
        const picture = { eye: ICONS.googly, nonla: ICONS.nonla }[type];
        button.innerHTML = picture ?? `<span aria-hidden="true">${STICKER_LOOKS[type].emoji}</span>`;
        box.appendChild(button);
      }
    }
    box.hidden = box.children.length === 0;
    this.markOptions();
  },

  markOptions() {
    for (const el of $$('#tool-options [data-paint]')) {
      const on = Number(el.dataset.paint) === this.paint;
      el.classList.toggle('selected', on);
      el.setAttribute('aria-pressed', String(on));
    }
    for (const el of $$('#tool-options [data-sticker]')) {
      const on = el.dataset.sticker === this.stickerType;
      el.classList.toggle('selected', on);
      el.setAttribute('aria-pressed', String(on));
    }
  },

  setPaint(paint) {
    this.paint = paint;
    this.toolView.setBrushColor(paint ? PAINTS[paint - 1].css : '#ffffff');
    this.markOptions();
    this.sounds.select();
    this.refreshAim();
  },

  setStickerType(type) {
    this.stickerType = type;
    this.toolView.setSticker(type);
    this.markOptions();
    this.sounds.select();
    this.refreshAim();
  },

  // What the tool will change at the hit, for the preview.
  planFor(hit) {
    if (this.tool === 'clay') return { removed: [], cracked: [], added: planClay(this.grid, hit.x, hit.y, hit.z, hit.normal) };
    if (this.tool === 'brush') {
      return { removed: [], cracked: [], painted: planPaint(this.grid, hit.x, hit.y, hit.z), paint: this.paint };
    }
    if (this.tool === 'sticker') return { removed: [], cracked: [] };
    return planHit(this.grid, this.tool, hit.x, hit.y, hit.z, this.easyMode);
  },

  // Use the clay, the brush or a sticker at the hit.
  decorate(hit, point) {
    const before = this.snapshot();
    const grid = this.grid;
    const step = makeStep(this.tool, hit.x, hit.y, hit.z, {
      face: faceOf(hit.normal), paint: this.paint, sticker: this.stickerType,
    });
    const result = applyStep(grid, this.stickers, step, this.stone);
    if (!result.changed) return this.tool === 'brush' ? undefined : this.sounds.thud();
    let changed = [];
    if (this.tool === 'clay') {
      changed = result.added;
      this.updateStickers(result);
      this.sounds.plop();
      for (let k = 0; k < 6; k++) {
        const vel = new THREE.Vector3((Math.random() - 0.5) * 6, 3 + Math.random() * 3, (Math.random() - 0.5) * 6);
        this.particles.puff(point, vel, 0.6 + Math.random() * 0.6, [1, 1, 1]);
      }
      this.wobble = Math.max(this.wobble, 0.4);
    } else if (this.tool === 'brush') {
      changed = result.painted;
      this.sounds.swish();
      const color = this.paint ? PAINTS[this.paint - 1].rgb : [1, 1, 1];
      for (let k = 0; k < 8; k++) {
        const vel = new THREE.Vector3((Math.random() - 0.5) * 10, 4 + Math.random() * 6, (Math.random() - 0.5) * 10);
        this.particles.spark(point, vel, 0.25 + Math.random() * 0.25, color, 0.5);
      }
    } else {
      const sticker = result.placed;
      this.stickers = result.stickers;
      this.stickerView.set(this.stickers);
      this.sounds.stickerPop();
      for (let k = 0; k < 8; k++) {
        const vel = new THREE.Vector3((Math.random() - 0.5) * 12, 4 + Math.random() * 8, (Math.random() - 0.5) * 12);
        this.particles.spark(point, vel, 0.3, [1, 0.85, 0.2], 0.5);
      }
      changed = [grid.index(hit.x, hit.y, hit.z)];
      this.stats.event('sticker', { type: sticker.type });
    }
    this.history.push(before);
    this.recordStep(step);
    if (this.tool !== 'sticker') {
      this.stoneView.markCells(changed);
      this.stoneView.flush();
    }
    if (this.tool === 'brush') this.stats.event('paint', { count: changed.length });
    this.afterChange();
    return undefined;
  },

  // Stickers on removed or covered faces fall off.
  updateStickers(result) {
    this.stickers = result.stickers;
    if (result.fallen.length === 0) return;
    this.stickerView.drop(result.fallen);
    this.sounds.stickerPop();
  },

  // Keep the step for the time-lapse. A very long carving has no
  // time-lapse.
  recordStep(step) {
    if (!this.steps) return;
    this.steps.push(step);
    if (this.steps.length > MAX_STEPS) this.steps = null;
  },

  // The time-lapse data for the saved game and the Museum.
  replayData() {
    return this.steps && this.startCells ? encodeReplay(this.startCells, this.steps) : null;
  },
};
