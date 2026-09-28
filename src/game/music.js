// Gentle background music. The Web Audio API makes each note, so the game
// does not load music files. The tune changes a little each time: it uses
// only the notes of a happy scale, over four slow chords.

const SCALE = [0, 2, 4, 7, 9]; // A pentatonic scale: every note sounds good with the others.
const CHORDS = [
  { root: 48, notes: [0, 4, 7] }, // C
  { root: 45, notes: [0, 3, 7] }, // A minor
  { root: 41, notes: [0, 4, 7] }, // F
  { root: 43, notes: [0, 4, 7] }, // G
];
const BEAT = 0.34; // Seconds for one step.
const STEPS_PER_CHORD = 8;
const LOOK_AHEAD = 0.6;

const midiToHz = (m) => 440 * 2 ** ((m - 69) / 12);

export class Music {
  constructor(sounds) {
    this.sounds = sounds;
    this.enabled = false;
    this.timer = null;
    this.step = 0;
    this.nextTime = 0;
    this.melody = 2;
  }

  setEnabled(on) {
    this.enabled = on;
    if (on) this.start();
    else this.stop();
  }

  start() {
    const ctx = this.sounds.ctx;
    if (!this.enabled || !ctx || this.timer) return;
    this.out = ctx.createGain();
    this.out.gain.value = 0.0001;
    this.out.gain.exponentialRampToValueAtTime(0.09, ctx.currentTime + 1.5);
    this.out.connect(this.sounds.master);
    this.nextTime = ctx.currentTime + 0.1;
    this.timer = setInterval(() => this.schedule(), 150);
  }

  stop() {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
    const ctx = this.sounds.ctx;
    const out = this.out;
    out.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.2);
    setTimeout(() => out.disconnect(), 1500);
  }

  schedule() {
    const ctx = this.sounds.ctx;
    while (this.nextTime < ctx.currentTime + LOOK_AHEAD) {
      this.playStep(this.step, this.nextTime);
      this.step++;
      this.nextTime += BEAT;
    }
  }

  playStep(step, t) {
    const chord = CHORDS[Math.floor(step / STEPS_PER_CHORD) % CHORDS.length];
    const inChord = step % STEPS_PER_CHORD;
    // A soft bass note at the start of each chord, and a softer one in the middle.
    if (inChord === 0 || inChord === 4) this.note(midiToHz(chord.root), t, BEAT * 3.5, inChord === 0 ? 0.5 : 0.3, 'sine');
    // A quiet chord note on some steps.
    if (inChord === 2 || inChord === 6) {
      const n = chord.notes[1 + (step % 2)];
      this.note(midiToHz(chord.root + 12 + n), t, BEAT * 1.5, 0.12, 'triangle');
    }
    // The melody moves up or down a little, and rests sometimes.
    if (Math.random() < 0.62) {
      this.melody = Math.max(0, Math.min(9, this.melody + Math.floor(Math.random() * 5) - 2));
      const octave = Math.floor(this.melody / SCALE.length);
      const midi = 72 + octave * 12 + SCALE[this.melody % SCALE.length];
      this.note(midiToHz(midi), t, BEAT * 0.9, 0.22, 'triangle');
    }
  }

  // A note like a soft marimba: a quick start and a slow end.
  note(freq, t, dur, gain, type) {
    const ctx = this.sounds.ctx;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(gain, t + 0.02);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(env).connect(this.out);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }
}
