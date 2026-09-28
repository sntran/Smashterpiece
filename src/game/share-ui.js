// The statue link: the Share panel and the screen for a shared statue.
// These methods belong to the Game class (see main.js).

import { addStatue, loadMuseum, decodeStatue, encodeStatue } from '../core/codec.js';
import { encodeShare, decodeShare, shareTextFrom, shareId, SHARE_PREFIX } from '../core/share.js';
import { makeQr } from '../core/qr.js';
import { statueToStl } from '../core/stl.js';
import { $, offerFile } from './dom.js';

// Draw a QR code on a canvas, with a white border of 4 modules. Each
// module gets the same whole number of pixels, so that the code is sharp.
export function drawQr(canvas, qr) {
  const cells = qr.size + 8;
  const room = Math.min(window.innerWidth * 0.62, window.innerHeight * 0.42, 320);
  const cssScale = Math.max(2, Math.floor(room / cells));
  const dpr = Math.ceil(Math.min(3, window.devicePixelRatio || 1));
  const scale = cssScale * dpr;
  canvas.style.width = `${cssScale * cells}px`;
  canvas.style.height = `${cssScale * cells}px`;
  canvas.width = scale * cells;
  canvas.height = scale * cells;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#000000';
  for (let y = 0; y < qr.size; y++) {
    for (let x = 0; x < qr.size; x++) {
      if (qr.dark(x, y)) ctx.fillRect((x + 4) * scale, (y + 4) * scale, scale, scale);
    }
  }
}

export const shareMethods = {
  // Make a link for the selected statue, and show it with a QR code.
  async shareStatue() {
    const id = this.museum.selectedId();
    const record = loadMuseum(this.storage).find((r) => r.id === id);
    if (!record) return;
    const statue = decodeStatue(record);
    const text = await encodeShare(statue);
    this.shareUrl = `${location.origin}${location.pathname}${SHARE_PREFIX}${text}`;
    // A phone camera reads small QR codes best. Show the code only when
    // the link is short enough.
    const qr = makeQr(this.shareUrl, { maxVersion: 25 });
    const canvas = $('#share-qr');
    canvas.hidden = !qr;
    if (qr) drawQr(canvas, qr);
    $('#share-text').textContent = qr
      ? 'Scan the code with a phone, or send the link.'
      : 'This statue has a lot of detail. Send the link.';
    $('[data-action="send-link"]').style.display = navigator.share ? '' : 'none';
    $('#share-result').textContent = '';
    $('#share').classList.add('show');
  },

  // Save a photo of the selected statue in the Museum, with a frame.
  async savePhoto() {
    $('#share').classList.remove('show');
    this.renderer.render(this.museum.scene, this.camera);
    const shot = this.renderer.domElement;
    const border = Math.round(Math.min(shot.width, shot.height) * 0.05);
    const canvas = document.createElement('canvas');
    canvas.width = shot.width + border * 2;
    canvas.height = shot.height + border * 3;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffd35c';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(shot, border, border);
    ctx.fillStyle = '#3b2a52';
    ctx.font = `900 ${Math.round(border * 1.1)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('My Smashterpiece', canvas.width / 2, canvas.height - border);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    this.sounds.snap();
    this.flash('camera', true);
    if (blob) await offerFile(new File([blob], 'my-smashterpiece.png', { type: 'image/png' }), 'My Smashterpiece');
  },

  // Save a file for a 3D printer (STL). One voxel is 2 millimeters.
  async savePrint() {
    const id = this.museum.selectedId();
    const record = loadMuseum(this.storage).find((r) => r.id === id);
    if (!record) return;
    const statue = decodeStatue(record);
    const file = new File([statueToStl(statue.size, statue.cells)], 'my-smashterpiece.stl', { type: 'model/stl' });
    const result = await offerFile(file, 'My Smashterpiece');
    $('#share-result').textContent = result === 'closed' ? '' : 'The 3D print file is ready. A 3D printer app can open it.';
  },

  async sendLink() {
    try {
      await navigator.share({ title: 'My Smashterpiece', url: this.shareUrl });
    } catch {
      // The player closed the share sheet.
    }
  },

  async copyLink() {
    const result = $('#share-result');
    try {
      await navigator.clipboard.writeText(this.shareUrl);
      result.textContent = 'The link is copied.';
      this.sounds.select();
    } catch {
      // Without the clipboard, show the link so that a parent can copy it.
      result.textContent = this.shareUrl;
    }
  },

  // Open a link with a shared statue. The statue shows in the Museum
  // room, with a button to add it to the Museum.
  async openSharedLink() {
    const text = shareTextFrom(location.hash);
    if (!text) return;
    // Remove the statue from the address, so that a reload does not open
    // it again.
    history.replaceState(null, '', `${location.pathname}${location.search}`);
    let statue;
    try {
      statue = await decodeShare(text);
    } catch {
      this.flash('cross');
      this.sounds.thud();
      return;
    }
    this.sharedStatue = { ...statue, id: shareId(text), created: Date.now() };
    this.museum.selected = 0;
    this.museum.load([encodeStatue(this.sharedStatue)]);
    this.show('museum');
    $('#museum').classList.add('shared');
    this.focusMuseumCamera();
    this.sounds.select();
  },

  addShared() {
    const statue = this.sharedStatue;
    if (!statue) return;
    const known = loadMuseum(this.storage).some((r) => r.id === statue.id);
    try {
      if (!known) addStatue(this.storage, statue);
    } catch {
      // The storage is full.
      this.flash('cross');
      this.sounds.thud();
      return;
    }
    this.sharedStatue = null;
    this.openMuseum();
    const index = loadMuseum(this.storage).findIndex((r) => r.id === statue.id);
    if (index >= 0) this.selectStatue(index);
    this.flash('museum', true);
    this.sounds.snap();
    this.confetti.burst(90);
  },
};
