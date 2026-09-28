// The Museum screen. These methods belong to the Game class (see main.js).

import * as THREE from 'three';
import { loadMuseum, removeStatue, isReplayData } from '../core/codec.js';
import { $ } from './dom.js';

export const museumMethods = {
  openMuseum() {
    const records = loadMuseum(this.storage);
    this.museum.selected = records.length - 1;
    this.museum.load(records);
    const empty = this.museum.count === 0;
    $('#museum-empty').classList.toggle('show', empty);
    $('#museum-bar').style.display = empty ? 'none' : '';
    this.show('museum');
    this.focusMuseumCamera();
    this.updateMuseumButtons();
  },

  focusMuseumCamera() {
    const focus = this.museum.focusPoint();
    // A narrow screen needs a camera that is farther away.
    const far = Math.max(1, 0.8 / this.camera.aspect);
    this.controls.maxDistance = 34 * far;
    this.controls.target.copy(focus);
    this.camera.position.set(focus.x + 5 * far, focus.y + 6 * far, focus.z + 23 * far);
    this.controls.update();
    this.focusGoal = null;
  },

  updateMuseumButtons() {
    const many = this.museum.count > 1;
    $('[data-action="prev"]').disabled = !many;
    $('[data-action="next"]').disabled = !many;
    // A statue from an older version of the game has no time-lapse.
    const id = this.museum.selectedId();
    const record = loadMuseum(this.storage).find((r) => r.id === id);
    $('[data-action="replay"]').disabled = !isReplayData(record?.replay);
  },

  selectStatue(index) {
    if (this.museum.count === 0) return;
    this.museum.select(index);
    this.focusGoal = this.museum.focusPoint();
    this.updateMuseumButtons();
  },

  async deleteStatue() {
    const id = this.museum.selectedId();
    if (!id) return;
    if (!(await this.ask('trash'))) return;
    removeStatue(this.storage, id);
    this.sounds.poof();
    const keep = this.museum.selected;
    const records = loadMuseum(this.storage);
    this.museum.selected = Math.min(keep, records.length - 1);
    this.museum.load(records);
    const empty = this.museum.count === 0;
    $('#museum-empty').classList.toggle('show', empty);
    $('#museum-bar').style.display = empty ? 'none' : '';
    this.focusGoal = this.museum.focusPoint();
    this.updateMuseumButtons();
  },

  tapMuseum(clientX, clientY) {
    const ndc = new THREE.Vector2((clientX / window.innerWidth) * 2 - 1, -(clientY / window.innerHeight) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    const index = this.museum.pick(ray);
    if (index >= 0 && index !== this.museum.selected) {
      this.sounds.select();
      this.selectStatue(index);
    }
  },
};
