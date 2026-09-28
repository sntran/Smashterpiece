// Accessibility: the settings, the spoken words, the messages for screen
// readers, the keyboard, and the easy controls. These methods belong to
// the Game class (see main.js).

import * as THREE from 'three';
import { loadSettings, saveSettings } from '../core/settings.js';
import { $, $$ } from './dom.js';
import { ICONS } from './icons.js';

// The step of the aim cursor, in pixels.
const AIM_STEP = 18;
// The time between two repeats when a player holds a pad button.
const REPEAT_TIME = 110;
const TURN_STEP = 0.12;
const TILT_STEP = 0.08;
const ZOOM_STEP = 1.1;

// The switches in the settings panel.
export const SETTING_LOOKS = [
  { name: 'speak', icon: '🗣️', label: 'Talk', help: 'Say the names of the buttons and the news.' },
  { name: 'easyControls', icon: '🎮', label: 'Easy controls', help: 'Big buttons to aim, hit and turn. Good for switches.' },
  { name: 'easyMode', icon: '⭐', label: 'Easy challenges', help: 'Bigger tools. Stars come sooner.' },
  { name: 'reduceMotion', icon: '🌙', label: 'Less motion', help: 'No shaking and less movement.' },
  { name: 'contrast', icon: '🌗', label: 'Strong colors', help: 'Darker lines and a clearer preview.' },
  { name: 'bigButtons', icon: '🔍', label: 'Big buttons', help: 'Make all the buttons larger.' },
  { name: 'music', icon: '🎵', label: 'Music', help: 'Soft music in the background.' },
  { name: 'vibrate', icon: '📳', label: 'Vibration', help: 'The device shakes a little on each hit (Android).' },
  { name: 'showFps', icon: '⏱️', label: 'Frame rate', help: 'Show the frames each second, to check the speed.' },
];

// The words for each screen, for screen readers and for the Talk setting.
const SCREEN_WORDS = {
  menu: 'Smashterpiece. Pick what to do.',
  shapes: 'Pick a shape.',
  letters: 'Pick a letter.',
  stones: 'Pick a material.',
  play: 'Hit the stone!',
  museum: 'The Museum.',
  treasures: 'Your treasures and badges.',
};

function deviceSettings() {
  const query = (q) => typeof window.matchMedia === 'function' && window.matchMedia(q).matches;
  return { reduceMotion: query('(prefers-reduced-motion: reduce)'), contrast: query('(prefers-contrast: more)') };
}

export const accessMethods = {
  initAccess() {
    this.settings = loadSettings(this.storage, deviceSettings());
    this.keyboardUser = false;
    this.buildSettingsPanel();
    this.applySettings();
    this.bindPad();
    document.addEventListener('keydown', (e) => this.onKey(e));
    // The focus ring shows only for the keyboard.
    document.addEventListener('pointerdown', () => { this.keyboardUser = false; }, true);
  },

  buildSettingsPanel() {
    const box = $('#setting-toggles');
    box.innerHTML = '';
    for (const look of SETTING_LOOKS) {
      const button = document.createElement('button');
      button.className = 'toggle';
      button.dataset.setting = look.name;
      button.setAttribute('aria-pressed', 'false');
      button.setAttribute('aria-label', look.label);
      button.innerHTML = `<span class="toggle-icon" aria-hidden="true">${look.icon}</span>`
        + `<span class="toggle-text"><b>${look.label}</b><small>${look.help}</small></span>`
        + '<span class="toggle-switch" aria-hidden="true"></span>';
      box.appendChild(button);
    }
  },

  toggleSetting(name) {
    this.settings[name] = !this.settings[name];
    try {
      saveSettings(this.storage, this.settings);
    } catch {
      // The storage is full. The setting stays for this visit.
    }
    this.applySettings();
    const look = SETTING_LOOKS.find((l) => l.name === name);
    this.announce(`${look.label}: ${this.settings[name] ? 'on' : 'off'}.`);
  },

  applySettings() {
    const s = this.settings;
    for (const el of $$('[data-setting]')) el.setAttribute('aria-pressed', String(!!s[el.dataset.setting]));
    const body = document.body.classList;
    body.toggle('reduce-motion', s.reduceMotion);
    body.toggle('contrast', s.contrast);
    body.toggle('big-buttons', s.bigButtons);
    body.toggle('easy-controls', s.easyControls);
    this.easyMode = s.easyMode;
    this.stoneView.setStrong(s.contrast);
    this.confetti.reduced = s.reduceMotion;
    $('#easy-pad').hidden = !s.easyControls;
    $('#fps').hidden = !s.showFps;
    if (this.music) this.music.setEnabled(s.music && !this.sounds.muted);
    if (!s.speak && window.speechSynthesis) window.speechSynthesis.cancel();
    this.show(this.screen);
    if (this.screen === 'play') this.updateScore(true);
  },

  // ---------------------------------------------------------------- Words

  // Tell the news to screen readers, and say it when Talk is on.
  announce(text, important = false) {
    const box = $(important ? '#announce-now' : '#announce');
    box.textContent = '';
    // A new text node makes the screen reader read the same words again.
    setTimeout(() => { box.textContent = text; }, 30);
    this.say(text);
  },

  say(text) {
    if (!this.settings?.speak || !window.speechSynthesis || typeof window.SpeechSynthesisUtterance !== 'function') return;
    const synth = window.speechSynthesis;
    synth.cancel();
    const words = new window.SpeechSynthesisUtterance(text);
    words.lang = 'en-US';
    words.rate = 0.95;
    words.pitch = 1.15;
    synth.speak(words);
  },

  // Say the name of a button when the player pushes it.
  sayButton(button) {
    const name = button.getAttribute('aria-label') || button.textContent.trim();
    if (name) this.say(name);
  },

  // ---------------------------------------------------------------- Screens

  // Move the focus to the new screen, for keyboard and switch users, and
  // tell screen readers what the screen is.
  afterShow(name) {
    const canvas = this.canvas;
    const words = SCREEN_WORDS[name] ?? '';
    canvas.setAttribute('aria-label', name === 'play' ? this.stoneWords() : words);
    if (this.lastScreen !== name) {
      this.lastScreen = name;
      if (words) this.announce(words);
      if (this.keyboardUser) {
        // Start on the first choice. The Back and Home buttons come after.
        const first = $(`#${name} button:not([disabled]):not([hidden]):not([data-action="back"]):not([data-action="home"])`)
          ?? $(`#${name} button:not([disabled]):not([hidden])`);
        if (first) first.focus();
      }
    }
  },

  stoneWords() {
    const shape = this.mode === 'challenge' && this.shape ? ` Make a ${this.shape.replace('letter-', 'letter ')}.` : '';
    return `A block of ${this.stone}.${shape} Use the arrow keys to aim, and Enter to hit.`;
  },

  // ---------------------------------------------------------------- Keyboard

  onKey(e) {
    this.unlockAudio();
    if (e.key === 'Tab') this.keyboardUser = true;
    const open = $('.overlay.show');
    if (e.key === 'Escape') {
      e.preventDefault();
      if (open?.id === 'confirm') return $('#confirm [data-action="no"]').click();
      if (open) return open.classList.remove('show');
      if (this.screen === 'play' || this.screen === 'museum' || this.screen === 'treasures') return this.goHome();
      if (this.screen !== 'menu') return $(`#${this.screen} [data-action="back"]`)?.click();
      return undefined;
    }
    if (open || this.screen !== 'play') return undefined;
    // Keys on a focused button work as usual.
    const onButton = document.activeElement && document.activeElement.tagName === 'BUTTON';
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    const tools = { 1: 'hammer', 2: 'chisel', 3: 'file', 4: 'clay', 5: 'brush', 6: 'sticker' };
    if (tools[key]) return this.setTool(tools[key]);
    if ((e.ctrlKey || e.metaKey) && key === 'z') {
      e.preventDefault();
      return this.undo();
    }
    const moves = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (moves[key] && !onButton) {
      e.preventDefault();
      if (e.shiftKey) return this.orbitBy(-moves[key][0] * TURN_STEP, -moves[key][1] * TILT_STEP);
      return this.moveAim(moves[key][0], moves[key][1]);
    }
    if ((key === 'Enter' || key === ' ') && !onButton) {
      e.preventDefault();
      return this.hitAtAim();
    }
    if (key === 'a') return this.orbitBy(TURN_STEP, 0);
    if (key === 'd') return this.orbitBy(-TURN_STEP, 0);
    if (key === 'w') return this.orbitBy(0, TILT_STEP);
    if (key === 's') return this.orbitBy(0, -TILT_STEP);
    if (key === '+' || key === '=') return this.zoomBy(1 / ZOOM_STEP);
    if (key === '-' || key === '_') return this.zoomBy(ZOOM_STEP);
    if (key === 'g') return this.toggleGhost();
    if (key === 'u') return this.undo();
    return undefined;
  },

  // ---------------------------------------------------------------- Aim cursor

  aimCenter() {
    if (!this.cursor) this.cursor = { x: window.innerWidth / 2, y: window.innerHeight * 0.45 };
    return this.cursor;
  },

  moveAim(dx, dy) {
    const c = this.aimCenter();
    c.x = Math.max(8, Math.min(window.innerWidth - 8, c.x + dx * AIM_STEP));
    c.y = Math.max(8, Math.min(window.innerHeight - 8, c.y + dy * AIM_STEP));
    this.showCursor();
  },

  showCursor() {
    const c = this.aimCenter();
    const el = $('#aim-cursor');
    el.hidden = false;
    el.style.transform = `translate(${c.x}px, ${c.y}px)`;
    this.cursorActive = true;
    this.updateAim(c.x, c.y);
    const hit = this.aim?.hit;
    el.classList.toggle('on-stone', !!hit);
  },

  hideCursor() {
    $('#aim-cursor').hidden = true;
    this.cursorActive = false;
  },

  hitAtAim() {
    const c = this.aimCenter();
    this.showCursor();
    if (!this.aim) {
      this.sounds.thud();
      return this.announce('Aim at the stone first.');
    }
    this.hitAt(c.x, c.y, 'keyboard');
    return undefined;
  },

  // ---------------------------------------------------------------- Camera

  // Turn the camera around the target. `dAz` turns left or right. `dPolar`
  // tilts up or down.
  orbitBy(dAz, dPolar) {
    const offset = this.camera.position.clone().sub(this.controls.target);
    const s = new THREE.Spherical().setFromVector3(offset);
    s.theta += dAz;
    s.phi = Math.max(this.controls.minPolarAngle, Math.min(this.controls.maxPolarAngle, s.phi - dPolar));
    offset.setFromSpherical(s);
    this.camera.position.copy(this.controls.target).add(offset);
    this.controls.update();
    if (this.cursorActive) this.showCursor();
  },

  zoomBy(factor) {
    const offset = this.camera.position.clone().sub(this.controls.target);
    const length = Math.max(this.controls.minDistance, Math.min(this.controls.maxDistance, offset.length() * factor));
    offset.setLength(length);
    this.camera.position.copy(this.controls.target).add(offset);
    this.controls.update();
    if (this.cursorActive) this.showCursor();
  },

  // ---------------------------------------------------------------- Easy pad

  // The buttons of the easy pad repeat while the player holds them. A
  // click from a keyboard or a switch does the action one time.
  bindPad() {
    const actions = {
      up: () => this.moveAim(0, -1),
      down: () => this.moveAim(0, 1),
      left: () => this.moveAim(-1, 0),
      right: () => this.moveAim(1, 0),
      hit: () => this.hitAtAim(),
      'turn-left': () => this.orbitBy(TURN_STEP, 0),
      'turn-right': () => this.orbitBy(-TURN_STEP, 0),
      'tilt-up': () => this.orbitBy(0, TILT_STEP),
      'tilt-down': () => this.orbitBy(0, -TILT_STEP),
      'zoom-in': () => this.zoomBy(1 / ZOOM_STEP),
      'zoom-out': () => this.zoomBy(ZOOM_STEP),
    };
    $('#easy-pad [data-pad="hit"]').innerHTML = ICONS.hammer;
    for (const button of $$('#easy-pad [data-pad]')) {
      const run = actions[button.dataset.pad];
      let timer = null;
      const stop = () => {
        clearInterval(timer);
        timer = null;
      };
      button.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this.unlockAudio();
        run();
        if (button.dataset.pad !== 'hit') timer = setInterval(run, REPEAT_TIME);
      });
      for (const type of ['pointerup', 'pointerleave', 'pointercancel']) button.addEventListener(type, stop);
      button.addEventListener('click', (e) => {
        // A pointer click was handled on pointerdown.
        if (e.detail === 0) run();
      });
    }
  },

  // ---------------------------------------------------------------- Frame rate

  updateFps(dt) {
    if (!this.settings.showFps) return;
    this.fpsTime = (this.fpsTime ?? 0) + dt;
    this.fpsFrames = (this.fpsFrames ?? 0) + 1;
    if (this.fpsTime >= 0.5) {
      $('#fps').textContent = `${Math.round(this.fpsFrames / this.fpsTime)} fps`;
      this.fpsTime = 0;
      this.fpsFrames = 0;
    }
  },

  vibrate(ms) {
    if (this.settings.vibrate && typeof navigator.vibrate === 'function') navigator.vibrate(ms);
  },
};
