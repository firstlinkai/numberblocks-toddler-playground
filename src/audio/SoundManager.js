/* SoundManager: warm, toddler-friendly audio.
 *  - Spoken lines (numbers, praise) play from natural-sounding WAV files
 *    generated locally with Kokoro TTS (public/audio/*.wav).
 *  - Samples are fetched lazily by phrase id the first time they are needed
 *    and kept in memory, so adding a new .wav needs no code change here.
 *  - If a phrase file is missing, window.speechSynthesis is used instead,
 *    preferring the most natural installed voice.
 *  - SFX are synthesized with the Web Audio API (soft sines + gentle echo).
 *  - Global mute (persisted) silences BOTH sample playback and speech. */

import { numberWord } from '../utils/blocks.js';

const MUTED_KEY = 'nbp_muted';

/* Cap on queued lines: a toddler mashing must not build an endless backlog */
const MAX_QUEUE = 12;

export class SoundManager {
  constructor() {
    this.ctx = null;
    this.master = null;
    this._speechTimers = [];
    this._sayToken = 0;
    this._queue = [];
    this._speaking = false;
    /* Silence left between spoken lines so words never run together */
    this.gapMs = 260;
    this._buffers = new Map();   // id -> AudioBuffer (null = known missing)
    this._loads = new Map();     // id -> in-flight load promise
    this._currentSrc = null;
    this._initGraph();
  }

  _initGraph() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.6;
      this.master.connect(this.ctx.destination);
    } catch (e) {
      this.ctx = null;
    }
  }

  /* May start suspended; a user gesture resumes it (iOS requirement).
   * The first gesture also warms the counting samples in the background so
   * the very first "One! Two!" has no fetch gap. */
  ensure() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    if (!this._warmed) {
      this._warmed = true;
      for (let n = 1; n <= 10; n++) this._loadPhrase('number-' + n);
    }
  }

  get muted() {
    try {
      return localStorage.getItem(MUTED_KEY) === '1';
    } catch (e) {
      return false;
    }
  }

  /* Fetch + decode one phrase sample. Resolves to an AudioBuffer, or null
   * when the file is absent (caller then uses speechSynthesis). Each id is
   * fetched at most once; the result (buffer or null) is cached forever. */
  _loadPhrase(id) {
    if (this._buffers.has(id)) return Promise.resolve(this._buffers.get(id));
    if (this._loads.has(id)) return this._loads.get(id);
    if (!this.ctx) return Promise.resolve(null);

    const p = fetch('audio/' + id + '.wav')
      .then((res) => (res.ok ? res.arrayBuffer() : null))
      .then((arr) => (arr ? this.ctx.decodeAudioData(arr) : null))
      .catch(() => null)
      .then((buf) => {
        this._buffers.set(id, buf || null);
        this._loads.delete(id);
        return buf || null;
      });
    this._loads.set(id, p);
    return p;
  }

  _tone({ f = 440, f2 = null, type = 'sine', dur = 0.15, vol = 0.5, delay = 0 }) {
    if (this.muted || !this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(30, f), t0);
    if (f2) osc.frequency.exponentialRampToValueAtTime(Math.max(30, f2), t0 + dur);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  _noise({ dur = 0.12, vol = 0.4, delay = 0, freq = 800 }) {
    if (this.muted || !this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const flt = this.ctx.createBiquadFilter();
    flt.type = 'lowpass';
    flt.frequency.value = freq;
    const gain = this.ctx.createGain();
    gain.gain.value = vol;
    src.connect(flt);
    flt.connect(gain);
    gain.connect(this.master);
    src.start(t0);
  }

  /* ---- SFX vocabulary (softened: sines, gentle volumes) ---- */
  pick() { this._tone({ f: 640, f2: 860, type: 'sine', dur: 0.07, vol: 0.2 }); }
  pop() { this._tone({ f: 480, f2: 860, type: 'sine', dur: 0.1, vol: 0.4 }); }
  bubble(i = 0) { this._tone({ f: 520 + i * 50, f2: 900 + i * 50, type: 'sine', dur: 0.14, vol: 0.35 }); }
  snap() {
    this._tone({ f: 330, f2: 240, type: 'sine', dur: 0.09, vol: 0.4 });
    this._tone({ f: 660, type: 'triangle', dur: 0.1, vol: 0.28, delay: 0.06 });
  }
  wobble() {
    this._tone({ f: 260, f2: 200, type: 'sine', dur: 0.22, vol: 0.3 });
    this._tone({ f: 200, f2: 160, type: 'sine', dur: 0.24, vol: 0.25, delay: 0.18 });
  }
  munch() {
    this._noise({ dur: 0.1, vol: 0.38, freq: 380 });
    this._tone({ f: 180, f2: 120, type: 'sine', dur: 0.1, vol: 0.22 });
    this._noise({ dur: 0.1, vol: 0.32, freq: 340, delay: 0.14 });
  }
  hop(i = 0) { this._tone({ f: 420 + i * 55, f2: 640 + i * 55, type: 'sine', dur: 0.16, vol: 0.35 }); }
  chime() {
    [523.25, 659.25, 783.99].forEach((f, i) =>
      this._tone({ f, type: 'sine', dur: 0.5, vol: 0.3, delay: i * 0.1 }));
  }
  star() {
    [880, 1108.73, 1318.51].forEach((f, i) =>
      this._tone({ f, type: 'sine', dur: 0.4, vol: 0.28, delay: i * 0.08 }));
  }
  fanfare() {
    const seq = [[523.25, 0], [659.25, 0.12], [783.99, 0.24], [1046.5, 0.38], [783.99, 0.58], [1046.5, 0.72]];
    seq.forEach(([f, d]) => this._tone({ f, type: 'triangle', dur: 0.32, vol: 0.32, delay: d }));
    seq.forEach(([f, d]) => this._tone({ f: f * 2, type: 'sine', dur: 0.32, vol: 0.12, delay: d }));
    this._noise({ dur: 0.55, vol: 0.1, freq: 3200, delay: 0.45 });
  }

  /* ---- Instrument voices (Instruments game) ---------------------------
   * Each instrument plays a short phrase, not a single note, so a tap sounds
   * like someone played something. Built from the oscillator/noise primitives
   * above - no samples.
   *
   * Keep every voiced partial above ~90Hz: tablet and laptop speakers roll off
   * hard below that, which is why the first drum (a 140->55Hz sine under a
   * 180Hz-filtered noise burst) was inaudible on the device it shipped to. */

  /* C major arpeggio, sustained and overlapping like a held pedal */
  piano() {
    [0, 4, 7, 12].forEach((semi, i) => {
      const f = 261.63 * Math.pow(2, semi / 12);
      const d = i * 0.13;
      this._tone({ f, type: 'triangle', dur: 0.8, vol: 0.34, delay: d });
      this._tone({ f: f * 2, type: 'sine', dur: 0.5, vol: 0.1, delay: d });
    });
  }

  /* Kick / snare / kick / snare, all in the audible midrange */
  drum() {
    const kick = (delay) => {
      this._tone({ f: 190, f2: 95, type: 'sine', dur: 0.22, vol: 0.5, delay });
      this._tone({ f: 380, f2: 150, type: 'triangle', dur: 0.1, vol: 0.25, delay });
      this._noise({ dur: 0.05, vol: 0.3, freq: 2200, delay });
    };
    const snare = (delay) => {
      this._noise({ dur: 0.16, vol: 0.4, freq: 3400, delay });
      this._tone({ f: 260, f2: 180, type: 'triangle', dur: 0.12, vol: 0.28, delay });
    };
    kick(0); snare(0.22); kick(0.44); snare(0.62);
  }

  /* Strummed chord: notes fanned a few ms apart, like a pick crossing strings */
  guitarPluck() {
    [0, 4, 7, 11, 16].forEach((semi, i) => {
      const f = 196 * Math.pow(2, semi / 12);
      const d = i * 0.055;
      this._tone({ f, f2: f * 0.99, type: 'sawtooth', dur: 0.75, vol: 0.2, delay: d });
      this._tone({ f: f * 2, type: 'triangle', dur: 0.4, vol: 0.08, delay: d });
    });
  }

  /* Little bugle call - the one phrase everybody recognises as a trumpet */
  trumpetBlast() {
    [[392, 0, 0.18], [523.25, 0.2, 0.18], [659.25, 0.4, 0.45]].forEach(([f, d, dur]) => {
      this._tone({ f, type: 'sawtooth', dur, vol: 0.26, delay: d });
      this._tone({ f: f * 0.5, type: 'square', dur, vol: 0.08, delay: d });
    });
  }

  /* Running scale up the bars, bright and bell-like */
  xylophoneHit() {
    [0, 2, 4, 7, 9, 12].forEach((semi, i) => {
      const f = 523.25 * Math.pow(2, semi / 12);
      const d = i * 0.1;
      this._tone({ f, type: 'sine', dur: 0.34, vol: 0.36, delay: d });
      this._tone({ f: f * 3, type: 'sine', dur: 0.14, vol: 0.12, delay: d });
    });
  }

  /* Shuffle rhythm: paired shakes with an accent, the way maracas are played */
  maracaShake() {
    [0, 0.12, 0.26, 0.38, 0.52, 0.64].forEach((d, i) => {
      const accent = i % 2 === 0;
      this._noise({ dur: 0.07, vol: accent ? 0.34 : 0.2, freq: accent ? 5200 : 6400, delay: d });
    });
  }

  /* Celebration: let the fanfare open, then bring the voice in as it decays.
   * Firing both on the same tick buries the line under six overlapping tones
   * exactly when it is supposed to be the reward. */
  celebrate(text, { id = null, delay = 420 } = {}) {
    this.fanfare();
    const t = setTimeout(() => this.say(text, { id }), delay);
    this._speechTimers.push(t);   // cancelSpeech / scene unmount clears it
  }

  /* ---- Spoken lines ---------------------------------------------------
   * Everything spoken goes through a queue and plays to completion before the
   * next line starts. Previously each call stopped whatever was already
   * playing, so any line longer than the caller timer was cut mid-word:
   * "Thirty-seven!" runs about a second but the tower hopped every 640ms, and
   * the round reset clipped the trailing name off the praise line.
   *
   * Kokoro WAV samples first, speechSynthesis as fallback. */
  say(text, { id = null, onEnd = null, gap = null, interrupt = false } = {}) {
    if (this.muted) { if (onEnd) setTimeout(onEnd, 0); return; }
    /* Direct feedback (tapping a block) must answer now, not queue behind a
     * dozen earlier taps. Sequences and praise lines still wait their turn. */
    if (interrupt) this.cancelSpeech();
    this._enqueue({ text, id, onEnd, gap: gap == null ? this.gapMs : gap });
  }

  /* Speak a list of lines in order, each waiting for the previous to finish.
   * `onStep(item, index)` fires as each line STARTS, so visuals stay locked to
   * the audio instead of to a guessed interval. */
  speakSequence(items, { gap = null, onStep = null, onDone = null } = {}) {
    this.cancelSpeech();
    if (!items.length) { if (onDone) onDone(); return; }
    items.forEach((it, i) => {
      this._enqueue({
        text: it.text,
        id: it.id || null,
        gap: gap == null ? this.gapMs : gap,
        onStart: onStep ? () => onStep(it, i) : null,
        onEnd: i === items.length - 1 ? onDone : null
      });
    });
  }

  _enqueue(job) {
    this._queue.push(job);
    /* A toddler mashing a block must not build an endless backlog; keep the
     * most recent lines and drop the stale ones waiting behind them. */
    while (this._queue.length > MAX_QUEUE) this._queue.shift();
    if (!this._speaking) this._drain();
  }

  _drain() {
    const job = this._queue.shift();
    if (!job) { this._speaking = false; return; }
    this._speaking = true;
    const token = this._sayToken;

    const next = () => {
      if (token !== this._sayToken) { this._speaking = false; return; }
      if (job.onEnd) { try { job.onEnd(); } catch (e) { /* keep draining */ } }
      const t = setTimeout(() => {
        if (token !== this._sayToken) { this._speaking = false; return; }
        this._drain();
      }, job.gap);
      this._speechTimers.push(t);
    };

    if (this.muted) { next(); return; }
    if (job.onStart) { try { job.onStart(); } catch (e) { /* keep playing */ } }

    if (!job.id) { this._speak(job.text, next); return; }

    if (this._buffers.has(job.id)) {
      const buf = this._buffers.get(job.id);
      if (buf) this._playSample(buf, next);
      else this._speak(job.text, next);
      return;
    }

    /* First use of this phrase: load, then play. `_sayToken` drops the result
     * if the scene moved on while the fetch was in flight. */
    this._loadPhrase(job.id).then((buf) => {
      if (this.muted || token !== this._sayToken) { next(); return; }
      if (buf) this._playSample(buf, next);
      else this._speak(job.text, next);
    });
  }

  /* Play one decoded sample and call `done` when it has actually finished */
  _playSample(buf, done) {
    if (!this.ctx || this.muted) { done(); return; }
    try {
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const gain = this.ctx.createGain();
      gain.gain.value = 0.95;
      src.connect(gain);
      gain.connect(this.master);
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        if (this._currentSrc === src) this._currentSrc = null;
        done();
      };
      src.onended = finish;
      this._currentSrc = src;
      src.start();
      /* Safety net: onended does not fire while the context is suspended
       * (tab hidden), and the queue must never wedge. */
      const t = setTimeout(finish, Math.ceil(buf.duration * 1000) + 400);
      this._speechTimers.push(t);
    } catch (e) {
      done();
    }
  }

  /* speechSynthesis fallback - only used when a Kokoro sample is missing */
  _speak(text, done) {
    if (!('speechSynthesis' in window)) { done(); return; }
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 0.92;
      u.pitch = 1.05;
      u.lang = 'en-US';
      u.volume = 1;
      const v = this._pickVoice();
      if (v) u.voice = v;
      let finished = false;
      const finish = () => { if (!finished) { finished = true; done(); } };
      u.onend = finish;
      u.onerror = finish;
      window.speechSynthesis.speak(u);
      /* onend is unreliable across browsers; estimate from the text length */
      const t = setTimeout(finish, 900 + text.length * 70);
      this._speechTimers.push(t);
    } catch (e) { done(); }
  }

  /* Prefer the most natural-sounding installed English voice */
  _pickVoice() {
    if (!('speechSynthesis' in window)) return null;
    const voices = window.speechSynthesis.getVoices();
    if (!voices.length) return null;
    const en = voices.filter((v) => /^en/i.test(v.lang));
    const pool = en.length ? en : voices;
    const PREFERRED = [
      /google uk english female/i, /google us english/i, /natural/i,
      /aria/i, /jenny/i, /libby/i, /sonia/i, /serena/i, /samantha/i,
      /karen/i, /moira/i, /tessa/i, /zira/i, /female/i
    ];
    for (const re of PREFERRED) {
      const v = pool.find((voice) => re.test(voice.name));
      if (v) return v;
    }
    return pool[0];
  }

  /* Speak a single number word (1-50) */
  number(n, opts = {}) { this.say(numberWord(n), { id: 'number-' + n, ...opts }); }

  /* Count 1..n aloud. `onStep(i)` fires as each number starts speaking, so the
   * cube lighting up always matches the number being said. */
  countUp(n, { onStep = null, onDone = null, gap = null } = {}) {
    const items = [];
    for (let i = 1; i <= n; i++) items.push({ text: numberWord(i), id: 'number-' + i, n: i });
    this.speakSequence(items, { gap, onStep: onStep ? (it) => onStep(it.n) : null, onDone });
  }

  cancelSpeech() {
    this._sayToken += 1; // invalidate in-flight loads and pending queue steps
    this._queue = [];
    this._speaking = false;
    this._speechTimers.forEach(clearTimeout);
    this._speechTimers = [];
    if (this._currentSrc) {
      try { this._currentSrc.stop(); } catch (e) { /* ignore */ }
      this._currentSrc = null;
    }
    if ('speechSynthesis' in window) {
      try { window.speechSynthesis.cancel(); } catch (e) { /* ignore */ }
    }
  }
}

export const sound = new SoundManager();

/* Warm the voice list (async on some browsers) */
if ('speechSynthesis' in window) {
  window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
}
