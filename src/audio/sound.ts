/**
 * Música y efectos retro de 8 bits, todo generado con Web Audio (sin archivos).
 * Mismo sonido y mismas claves de localStorage que la versión original.
 */
const MUSIC_KEY = "cp-music";
const SFX_KEY = "cp-sfx";

// 32 pasos de corchea: acordes C, F, G, C | Am, F, G, G
const MEL: (number | null)[] = [
  72, null, 76, 79, 81, null, 79, 76, 77, null, 81, 84, 81, null, 77, 76, 74, null, 77, 81, 79, null, 76, 74, 72, null, 76, 79, 84, null, null, null,
  81, null, 84, 81, 79, null, 76, 72, 77, 76, 77, 81, 84, null, 81, 77, 79, null, 83, 79, 74, null, 79, 83, 84, null, 79, 76, 72, null, null, null,
];
const BASS: (number | null)[] = [
  48, null, 48, null, 48, null, 55, null, 53, null, 53, null, 53, null, 60, null, 55, null, 55, null, 55, null, 62, null, 48, null, 48, null, 55, null, 48, null,
  45, null, 45, null, 45, null, 52, null, 53, null, 53, null, 53, null, 60, null, 55, null, 55, null, 55, null, 62, null, 55, null, 55, null, 55, null, 59, null,
];

const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

class Sound {
  music = true;
  sfx = true;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private step = 0;
  private next = 0;

  constructor() {
    try {
      const m = localStorage.getItem(MUSIC_KEY), s = localStorage.getItem(SFX_KEY);
      if (m !== null) this.music = m === "1";
      if (s !== null) this.sfx = s === "1";
    } catch {
      /* sin almacenamiento */
    }
  }

  save() {
    try {
      localStorage.setItem(MUSIC_KEY, this.music ? "1" : "0");
      localStorage.setItem(SFX_KEY, this.sfx ? "1" : "0");
    } catch {
      /* sin almacenamiento */
    }
  }

  /** Crea o reanuda el contexto de audio (necesita un gesto del usuario). */
  ensure(): boolean {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 1;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 0.1;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noise = buf;
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return true;
  }

  private tone(f: number, t: number, dur: number, type: OscillatorType = "square", vol = 0.06, f2?: number) {
    const c = this.ctx!, o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(this.master!);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private hat(t: number) {
    const c = this.ctx!, s = c.createBufferSource(), g = c.createGain(), hp = c.createBiquadFilter();
    s.buffer = this.noise;
    hp.type = "highpass";
    hp.frequency.value = 6000;
    g.gain.setValueAtTime(0.025, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    s.connect(hp);
    hp.connect(g);
    g.connect(this.master!);
    s.start(t);
    s.stop(t + 0.06);
  }

  startMusic() {
    if (!this.music || this.timer || !this.ensure()) return;
    const ctx = this.ctx!;
    this.next = ctx.currentTime + 0.1;
    this.timer = setInterval(() => {
      while (this.next < ctx.currentTime + 0.25) {
        const i = this.step % MEL.length, t = this.next;
        const m = MEL[i], b = BASS[i];
        if (m) this.tone(hz(m), t, 0.17, "square", 0.028);
        if (b) this.tone(hz(b), t, 0.3, "triangle", 0.07);
        if (i % 2 === 1) this.hat(t);
        this.step++;
        this.next += 0.19;
      }
    }, 50);
  }

  stopMusic() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  get playing() {
    return this.timer !== null;
  }

  private play(notes: number[], gap: number, type: OscillatorType = "square", vol = 0.06) {
    if (!this.sfx || !this.ensure()) return;
    const t0 = this.ctx!.currentTime + 0.01;
    notes.forEach((n, i) => this.tone(hz(n), t0 + i * gap, gap * 1.6, type, vol));
  }

  tick() {
    if (!this.sfx || !this.ensure()) return;
    this.tone(900, this.ctx!.currentTime, 0.04, "square", 0.04);
  }
  blip() { this.play([84], 0.06, "square", 0.05); }
  right() { this.play([72, 76, 79, 84], 0.09); }
  wrong() {
    if (!this.sfx || !this.ensure()) return;
    this.tone(220, this.ctx!.currentTime + 0.01, 0.35, "sawtooth", 0.06, 90);
  }
  beep() { this.play([88], 0.08, "square", 0.04); }
  win() { this.play([72, 72, 72, 76, 79, 76, 79, 84, 88, 91, 96], 0.11); }
  turn() { this.play([64, 67, 72, 76], 0.08, "square", 0.05); }
  wild() { this.play([67, 71, 74, 79, 83, 86], 0.07); }
}

export type { Sound };
export const SND = new Sound();
