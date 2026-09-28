// The hints for the first game: a hand shows how to hit and how to turn
// the stone. Each hint shows one time. These methods belong to the Game
// class (see main.js).

import * as THREE from 'three';
import { $ } from './dom.js';

const HINTS_KEY = 'smashterpiece.hints';
const DRAG_HINT_TIME = 6;

export const hintMethods = {
  hintsDone() {
    try {
      return JSON.parse(this.storage.getItem(HINTS_KEY) || '{}') || {};
    } catch {
      return {};
    }
  },

  markHint(name) {
    const done = this.hintsDone();
    done[name] = true;
    try {
      this.storage.setItem(HINTS_KEY, JSON.stringify(done));
    } catch {
      // The storage is full. The hint can show again next time.
    }
  },

  // Show the first hint that the player did not see yet.
  startHints() {
    const done = this.hintsDone();
    if (!done.tap) this.showHint('tap');
    else if (!done.drag) this.showHint('drag');
  },

  showHint(name) {
    this.hint = { name, age: 0 };
    const el = $('#hint');
    el.className = `hint ${name}`;
    el.hidden = false;
    const pad = this.settings.easyControls;
    const words = this.t(`hint.${name}${pad ? 'Pad' : ''}`);
    $('.hint-words', el).textContent = words;
    this.announce(words, true);
  },

  hideHint() {
    this.hint = null;
    $('#hint').hidden = true;
  },

  // The player hit the stone: the tap hint is done.
  hintAfterHit() {
    if (this.hint?.name !== 'tap') return;
    this.markHint('tap');
    this.hideHint();
    if (!this.hintsDone().drag) setTimeout(() => { if (this.screen === 'play') this.showHint('drag'); }, 1200);
  },

  // The player turned the camera: the drag hint is done.
  hintAfterDrag() {
    if (this.hint?.name !== 'drag') return;
    this.markHint('drag');
    this.hideHint();
  },

  // Keep the hand on the middle of the stone.
  updateHint(dt) {
    if (!this.hint) return;
    if (this.screen !== 'play') return this.hideHint();
    this.hint.age += dt;
    if (this.hint.name === 'drag' && this.hint.age > DRAG_HINT_TIME) {
      this.markHint('drag');
      return this.hideHint();
    }
    const p = new THREE.Vector3(0, 16, 0).project(this.camera);
    const x = (p.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-p.y * 0.5 + 0.5) * window.innerHeight;
    $('#hint').style.transform = `translate(${x}px, ${y}px)`;
    return undefined;
  },
};
