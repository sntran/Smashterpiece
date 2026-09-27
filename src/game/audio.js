// All sounds of the game. The Web Audio API makes each sound when the game
// needs it. The game does not load sound files.

const STONE_VOICE = {
  sandstone: { pitch: 0.8, bright: 1300 },
  marble: { pitch: 1.1, bright: 2600 },
  granite: { pitch: 1.35, bright: 3800 },
};

function vary(amount = 0.1) {
  return 1 + (Math.random() * 2 - 1) * amount;
}

export class Sounds {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  // Browsers let a page make sound only after the player touches it.
  // Call this in a pointer or key event.
  unlock() {
    if (!this.ctx) {
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) return;
      const ctx = new Context();
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.8;
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -12;
      limiter.ratio.value = 8;
      this.master.connect(limiter).connect(ctx.destination);
      const length = ctx.sampleRate * 2;
      this.noiseBuffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.8;
  }

  get ready() {
    return !!this.ctx && this.ctx.state === 'running' && !this.muted;
  }

  // Play a tone with a quick start and a slow end.
  tone({ type = 'sine', f0, f1 = f0, at = 0, dur, gain = 0.3, attack = 0.004, to = this.master, vibrato = 0 }) {
    const ctx = this.ctx;
    const t = ctx.currentTime + at;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(f1, t + dur);
    if (vibrato > 0) {
      const lfo = ctx.createOscillator();
      const depth = ctx.createGain();
      lfo.frequency.value = 7;
      depth.gain.value = vibrato;
      lfo.connect(depth).connect(osc.frequency);
      lfo.start(t);
      lfo.stop(t + dur + 0.05);
    }
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(gain, t + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(env).connect(to);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  // Play filtered noise.
  noise({ at = 0, dur, gain = 0.3, type = 'lowpass', f0 = 2000, f1 = f0, q = 1, attack = 0.002, to = this.master }) {
    const ctx = this.ctx;
    const t = ctx.currentTime + at;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.Q.value = q;
    filter.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) filter.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(gain, t + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter).connect(env).connect(to);
    src.start(t, Math.random() * 1.5);
    src.stop(t + dur + 0.05);
  }

  hammer(stone, amount) {
    if (!this.ready) return;
    const v = STONE_VOICE[stone] ?? STONE_VOICE.sandstone;
    const r = vary(0.12);
    this.tone({ f0: 170 * v.pitch * r, f1: 45, dur: 0.28, gain: 0.9 });
    this.noise({ dur: 0.22, gain: 0.7, f0: v.bright, f1: v.bright * 0.25 });
    // A silly cartoon "bonk".
    this.tone({ type: 'triangle', f0: 560 * v.pitch * r, f1: 250 * v.pitch * r, dur: 0.13, gain: 0.3 });
    if (amount > 40) this.noise({ at: 0.03, dur: 0.45, gain: 0.35, f0: 500, f1: 120 });
    if (stone === 'granite') this.tone({ f0: 2100 * r, dur: 0.3, gain: 0.06 });
  }

  chisel(stone) {
    if (!this.ready) return;
    const v = STONE_VOICE[stone] ?? STONE_VOICE.sandstone;
    const base = 1500 * v.pitch * vary(0.08);
    this.tone({ f0: base, dur: 0.4, gain: 0.18 });
    this.tone({ f0: base * 2.76, dur: 0.25, gain: 0.1 });
    this.tone({ f0: base * 5.4, dur: 0.14, gain: 0.06 });
    this.noise({ dur: 0.035, gain: 0.45, type: 'highpass', f0: 3500 });
  }

  file(stone) {
    if (!this.ready) return;
    const v = STONE_VOICE[stone] ?? STONE_VOICE.sandstone;
    for (let k = 0; k < 3; k++) {
      const up = k % 2 === 0;
      this.noise({
        at: k * 0.075, dur: 0.07, gain: 0.32, type: 'bandpass', q: 2.5,
        f0: (up ? 1500 : 2800) * v.pitch, f1: (up ? 2800 : 1500) * v.pitch, attack: 0.01,
      });
    }
    this.noise({ dur: 0.24, gain: 0.08, type: 'bandpass', f0: 700, q: 1.5 });
  }

  // Small cracks: marble and granite make this sound when they do not break.
  crack() {
    if (!this.ready) return;
    for (let k = 0; k < 5; k++) {
      this.noise({ at: Math.random() * 0.07, dur: 0.014, gain: 0.5, type: 'highpass', f0: 2500 + Math.random() * 2000 });
    }
    this.tone({ type: 'square', f0: 900, f1: 600, dur: 0.05, gain: 0.05 });
  }

  // The tool hits the pedestal. Nothing breaks.
  thud() {
    if (!this.ready) return;
    this.tone({ f0: 130, f1: 70, dur: 0.16, gain: 0.5 });
    this.tone({ type: 'triangle', f0: 300, f1: 180, dur: 0.1, gain: 0.2 });
  }

  // A falling piece makes a slide whistle sound.
  whee(size) {
    if (!this.ready) return;
    const high = size > 200 ? 900 : 1400;
    this.tone({ f0: high * vary(0.1), f1: high * 0.28, dur: 0.75, gain: 0.16, vibrato: 25 });
  }

  crash(size) {
    if (!this.ready) return;
    const s = Math.min(1, 0.35 + size / 300);
    this.noise({ dur: 0.55, gain: 0.7 * s, f0: 1400, f1: 180 });
    this.tone({ f0: 110, f1: 38, dur: 0.4, gain: 0.8 * s });
    for (let k = 0; k < 5; k++) {
      this.tone({ f0: 1800 + Math.random() * 2600, dur: 0.08, gain: 0.05, at: 0.05 + Math.random() * 0.3 });
    }
  }

  pop() {
    if (!this.ready) return;
    this.tone({ f0: 380, f1: 950, dur: 0.09, gain: 0.3 });
  }

  select() {
    if (!this.ready) return;
    this.tone({ type: 'triangle', f0: 660, dur: 0.12, gain: 0.25 });
    this.tone({ type: 'triangle', f0: 990, dur: 0.16, gain: 0.25, at: 0.06 });
  }

  undo() {
    if (!this.ready) return;
    this.tone({ f0: 1000, f1: 280, dur: 0.2, gain: 0.25 });
    this.tone({ type: 'triangle', f0: 300, f1: 600, dur: 0.14, gain: 0.15, at: 0.12 });
  }

  // The save sound: a camera click and a chime.
  snap() {
    if (!this.ready) return;
    this.noise({ dur: 0.03, gain: 0.5, type: 'highpass', f0: 2500 });
    this.noise({ at: 0.08, dur: 0.04, gain: 0.4, type: 'highpass', f0: 1800 });
    [784, 988, 1175, 1568].forEach((f, k) => {
      this.tone({ type: 'triangle', f0: f, dur: 0.5, gain: 0.14, at: 0.15 + k * 0.08 });
    });
  }

  star(k) {
    if (!this.ready) return;
    const f = [880, 1109, 1319][k] ?? 1319;
    this.tone({ type: 'triangle', f0: f, dur: 0.6, gain: 0.25 });
    this.tone({ f0: f * 2, dur: 0.4, gain: 0.08 });
  }

  poof() {
    if (!this.ready) return;
    this.noise({ dur: 0.5, gain: 0.45, f0: 3000, f1: 200 });
    this.tone({ f0: 500, f1: 140, dur: 0.3, gain: 0.15 });
  }

  // A happy "Hooray": a small choir sings "hoo-RAY", with a fanfare and
  // a cheering crowd.
  hooray() {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + 0.05;
    const voices = [
      { f: 262, delay: 0 },
      { f: 330, delay: 0.025 },
      { f: 392, delay: 0.05 },
      { f: 294, delay: 0.035 },
    ];
    for (const { f, delay } of voices) this.voice(t0 + delay, f * vary(0.02));

    // The breath of the "h".
    this.noise({ dur: 0.12, gain: 0.08, type: 'bandpass', f0: 1200, q: 1 });

    // Fanfare.
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, k) => {
      this.tone({ type: 'square', f0: f, dur: 0.22, gain: 0.07, at: 0.9 + k * 0.1 });
      this.tone({ type: 'triangle', f0: f, dur: 0.3, gain: 0.12, at: 0.9 + k * 0.1 });
    });
    for (const f of [523, 659, 784, 1047]) {
      this.tone({ type: 'triangle', f0: f, dur: 1.1, gain: 0.08, at: 1.35, attack: 0.02 });
    }

    // The crowd cheers and claps.
    this.noise({ dur: 2.2, gain: 0.12, type: 'bandpass', f0: 1500, f1: 1100, q: 0.7, attack: 0.4 });
    for (let k = 0; k < 24; k++) {
      this.noise({ at: 0.3 + Math.random() * 1.8, dur: 0.025, gain: 0.25, type: 'highpass', f0: 1200 });
    }
  }

  // One singer says "hoo-ray". A sawtooth wave goes through three
  // band-pass filters (formants) that move from "oo" to "r" to "ay".
  voice(t, f) {
    const ctx = this.ctx;
    const src = ctx.createOscillator();
    src.type = 'sawtooth';
    src.frequency.setValueAtTime(f * 0.92, t);
    src.frequency.linearRampToValueAtTime(f, t + 0.3);
    src.frequency.linearRampToValueAtTime(f * 1.34, t + 0.46);
    src.frequency.linearRampToValueAtTime(f * 1.5, t + 0.75);
    src.frequency.linearRampToValueAtTime(f * 1.2, t + 1.15);
    const lfo = ctx.createOscillator();
    const depth = ctx.createGain();
    lfo.frequency.value = 5.5;
    depth.gain.setValueAtTime(0, t);
    depth.gain.linearRampToValueAtTime(f * 0.035, t + 0.7);
    lfo.connect(depth).connect(src.frequency);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(0.5, t + 0.07);
    env.gain.setValueAtTime(0.5, t + 0.3);
    env.gain.exponentialRampToValueAtTime(0.25, t + 0.4);
    env.gain.exponentialRampToValueAtTime(0.7, t + 0.52);
    env.gain.setValueAtTime(0.7, t + 0.95);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 1.25);

    const formants = [
      { q: 7, gain: 1.0, path: [[0, 330], [0.33, 330], [0.44, 430], [0.56, 680], [1.0, 480]] },
      { q: 10, gain: 0.6, path: [[0, 800], [0.33, 850], [0.44, 1250], [0.6, 1850], [1.0, 2250]] },
      { q: 12, gain: 0.3, path: [[0, 2400], [0.33, 2300], [0.42, 1700], [0.6, 2600], [1.0, 2800]] },
    ];
    for (const formant of formants) {
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.Q.value = formant.q;
      filter.frequency.setValueAtTime(formant.path[0][1], t);
      for (const [at, hz] of formant.path.slice(1)) filter.frequency.linearRampToValueAtTime(hz, t + at);
      const g = ctx.createGain();
      g.gain.value = formant.gain * 2.2;
      src.connect(filter).connect(g).connect(env);
    }
    env.connect(this.master);
    src.start(t);
    lfo.start(t);
    src.stop(t + 1.3);
    lfo.stop(t + 1.3);
  }
}
