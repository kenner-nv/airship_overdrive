/* ==========================================================================
   Audio.js — efeitos sonoros SINTETIZADOS (WebAudio), sem arquivos. Provisórios.
   Para usar sons definitivos, preencha SOUND_OVERRIDES em data/Assets.js (mesmas chaves).
   O jogo funciona normalmente sem áudio (sem suporte, bloqueado ou desligado pelo jogador).
   ========================================================================== */
import * as Assets from "./data/Assets.js";

// tolerante: se o Assets.js for de uma versão antiga (sem MUSIC_OVERRIDES), usa as trilhas provisórias
const SOUND_OVERRIDES = Assets.SOUND_OVERRIDES ?? {};
const MUSIC_OVERRIDES = Assets.MUSIC_OVERRIDES ?? {};
import { LocalSave } from "./LocalSave.js";

// camada: { wave, f0, f1, dur, gain, delay, noise (filtro passa-baixa em Hz) }
const RECIPES = {
  // ─── ARMAS ─────────────────────────────────────────

  shoot_basic: [
    { wave: "triangle", f0: 1050, f1: 420, dur: 0.085, gain: 0.022 },
    { wave: "sine", f0: 180, f1: 90, dur: 0.07, gain: 0.035, delay: 0.008 },
  ],

  shoot_laser: [
    { wave: "sawtooth", f0: 1800, f1: 480, dur: 0.13, gain: 0.018 },
    { wave: "sine", f0: 620, f1: 180, dur: 0.16, gain: 0.045, delay: 0.015 },
  ],

  shoot_missile: [
    {wave: "square",f0: 1250, f1: 420, dur: 0.045, gain: 0.025 },
    {wave: "sine", f0: 480, f1: 1750, dur: 0.16, gain: 0.055, delay: 0.015 },
    {noise: 2200, f0: 950, f1: 300, dur: 0.17, gain: 0.04, delay: 0.025 },
    {wave: "triangle", f0: 240, f1: 90, dur: 0.12, gain: 0.035, delay: 0.02},
  ],

  shoot_spread: [
    { wave: "triangle", f0: 760, f1: 260, dur: 0.11, gain: 0.025 },
    { wave: "sine", f0: 260, f1: 100, dur: 0.12, gain: 0.025, delay: 0.015 },
  ],

  shoot_pulse: [
    { wave: "sine", f0: 240, f1: 45, dur: 0.32, gain: 0.075 },
    { wave: "sawtooth", f0: 110, f1: 55, dur: 0.20, gain: 0.018, delay: 0.025 },
  ],

  // ─── IMPACTOS ──────────────────────────────────────

  hit: [
    { wave: "triangle", f0: 260, f1: 95, dur: 0.075, gain: 0.025 },
    { noise: 1800, f0: 500, f1: 180, dur: 0.045, gain: 0.012, delay: 0.005 },
  ],

  hurt: [
    { wave: "sawtooth", f0: 230, f1: 65, dur: 0.30, gain: 0.075 },
    { wave: "sine", f0: 105, f1: 48, dur: 0.26, gain: 0.06, delay: 0.015 },
  ],

  dodge: [
    { wave: "sine", f0: 220, f1: 75, dur: 0.12, gain: 0.10 },
    { wave: "triangle", f0: 420, f1: 160, dur: 0.10, gain: 0.055, delay: 0.008 },
    { wave: "sine", f0: 1450, f1: 850, dur: 0.075, gain: 0.035, delay: 0.005 },
    { noise: 1200, f0: 850, f1: 300, dur: 0.06, gain: 0.025, delay: 0.012 },
  ],

  // ─── EXPLOSÕES ─────────────────────────────────────

  explode: [
    {wave: "triangle", f0: 180, f1: 48, dur: 0.22, gain: 0.10 },
    {noise: 650, f0: 500, f1: 75, dur: 0.38, gain: 0.065, delay: 0.015 },
    {wave: "sine", f0: 95, f1: 28, dur: 0.55, gain: 0.14, delay: 0.025 },
    {wave: "sawtooth", f0: 850, f1: 160, dur: 0.16, gain: 0.018, delay: 0.035 },
  ],
 
  explode_big: [
    {wave: "sine", f0: 105, f1: 26, dur: 1.0, gain: 0.20 },
    {noise: 500, f0: 420, f1: 45, dur: 0.95, gain: 0.11, delay: 0.025 },
    {wave: "triangle", f0: 160, f1: 32, dur: 0.72, gain: 0.065,  delay: 0.045 },
    {wave: "sawtooth", f0: 1200, f1: 110, dur: 0.42, gain: 0.025, delay: 0.06 },
    {wave: "sine", f0: 65, f1: 22,  dur: 1.25, gain: 0.12, delay: 0.12 },
    {noise: 350, f0: 240, f1: 35, dur: 0.75, gain: 0.045, delay: 0.20 },
  ],

  // ─── INTERFACE E PROGRESSÃO ────────────────────────

  install: [
    { wave: "sine", f0: 440, f1: 660, dur: 0.13, gain: 0.045 },
    { wave: "triangle", f0: 660, f1: 990, dur: 0.18, gain: 0.035, delay: 0.09 },
  ],

  buy: [
    { wave: "sine", f0: 620, f1: 830, dur: 0.09, gain: 0.04 },
    { wave: "sine", f0: 830, f1: 1240, dur: 0.15, gain: 0.035, delay: 0.075 },
  ],

  deny: [
    { wave: "triangle", f0: 240, f1: 175, dur: 0.14, gain: 0.045 },
  ],

  coin: [
    { wave: "sine", f0: 1250, f1: 1650, dur: 0.065, gain: 0.028 },
  ],

  cancel: [
    { wave: "triangle", f0: 1050, f1: 720, dur: 0.045, gain: 0.018 },
  ],

  click: [
    { wave: "sine", f0: 850, f1: 620, dur: 0.025, gain: 0.018 },
  ],

  // ─── HABILIDADES ───────────────────────────────────

  wave: [
    { wave: "sine", f0: 260, f1: 520, dur: 0.40, gain: 0.065 },
    { wave: "triangle", f0: 390, f1: 780, dur: 0.34, gain: 0.025, delay: 0.08 },
  ],

  heal: [
    { wave: "sine", f0: 480, f1: 960, dur: 0.24, gain: 0.055 },
    { wave: "sine", f0: 720, f1: 1440, dur: 0.28, gain: 0.035, delay: 0.09 },
  ],

  special: [
    {wave: "triangle", f0: 1500, f1: 700, dur: 0.07, gain: 0.035 },
    {wave: "sawtooth", f0: 1800, f1: 320, dur: 0.22, gain: 0.025, delay: 0.015 },
    {wave: "sine", f0: 520, f1: 100, dur: 0.24, gain: 0.065, delay: 0.025 },
    {wave: "sine", f0: 1100, f1: 240, dur: 0.18, gain: 0.018, delay: 0.06 },
  ],

  // ─── FIM DE JOGO ───────────────────────────────────

  gameover: [
    { wave: "sawtooth", f0: 300, f1: 48, dur: 0.95, gain: 0.075 },
    { wave: "sine", f0: 100, f1: 30, dur: 1.15, gain: 0.11, delay: 0.03 },
    { noise: 650, f0: 350, f1: 65, dur: 0.70, gain: 0.035, delay: 0.06 },
  ],

  // tiros dos inimigos (mais graves/“sujos” que os do jogador, para não confundir)

  enemy_shoot: [{ wave: "square", f0: 300, f1: 170, dur: 0.09, gain: 0.025 }],
  enemy_ring: [{ wave: "triangle", f0: 220, f1: 420, dur: 0.16, gain: 0.04 }],
  enemy_missile: [{ noise: 700, f0: 500, f1: 160, dur: 0.3, gain: 0.05 }, { wave: "sawtooth", f0: 190, f1: 110, dur: 0.22, gain: 0.025 }],
  enemy_spiral: [{ wave: "square", f0: 520, f1: 380, dur: 0.05, gain: 0.015 }],
  beam_warn: [{ wave: "sine", f0: 600, f1: 900, dur: 0.5, gain: 0.04 }, { wave: "sine", f0: 600, f1: 900, dur: 0.4, gain: 0.04, delay: 0.55 }],
  beam_fire: [{ wave: "sawtooth", f0: 140, f1: 60, dur: 0.6, gain: 0.09 }, { noise: 1800, f0: 1800, f1: 300, dur: 0.5, gain: 0.07 }],
};

const MIN_GAP = { enemy_shoot: 0.07, enemy_ring: 0.1, enemy_missile: 0.12, enemy_spiral: 0.1, beam_warn: 0.2, beam_fire: 0.2, coin: 0.04, cancel: 0.05, special: 0.08, hit: 0.045, shoot_basic: 0.05, shoot_laser: 0.06, shoot_spread: 0.07, shoot_missile: 0.08, shoot_pulse: 0.1, explode: 0.05 };
const MAX_VOICES = 18;
const MUSIC_LEVEL = 0.5;

// Trilhas sintetizadas (provisórias). Acordes em notas MIDI; troque por arquivos em MUSIC_OVERRIDES (Assets.js).
const SONGS = {
  // Menu: calma e espacial (Am – F – C – G), pad suave + arpejo lento
  menu: {
    bpm: 78,
    chords: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]],
    pattern(a, t, { i, ch, when, spb }) {
      if (i === 0) for (const n of ch) a.note(t, "sine", n - 12, when, spb * 15, 0.07, 900, 0.5);
      if (i === 0) a.note(t, "sine", ch[0] - 24, when, spb * 15, 0.12, 400, 0.05);
      if (i % 2 === 0) a.note(t, "triangle", ch[(i / 2) % 3] + 12, when, spb * 3, 0.05, 2400, 0.02);
      if (i === 8) a.note(t, "triangle", ch[2] + 24, when, spb * 6, 0.035, 2600, 0.02);
    },
  },
  // Partida: ritmo acelerado e tenso (Am – F – G – E), baixo pulsante + arpejo + bateria
  game: {
    bpm: 136,
    chords: [[57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 56, 59]],
    pattern(a, t, { i, ch, when, spb, bar }) {
      const root = ch[0] - 24;
      if (i % 4 === 0) a.drum(t, when, "kick");
      if (i === 4 || i === 12) a.drum(t, when, "snare");
      if (i % 2 === 1) a.drum(t, when, "hat");
      if (i % 2 === 0) a.note(t, "sawtooth", root + (i % 8 === 6 ? 12 : 0), when, spb * 1.8, 0.11, 520, 0.005);
      const arp = [0, 1, 2, 1, 2, 1, 0, 2][i % 8];
      a.note(t, "square", ch[arp] + (bar % 2 ? 12 : 24), when, spb * 0.9, 0.032, 2800, 0.005);
      if (i === 0) for (const n of ch) a.note(t, "sawtooth", n, when, spb * 15, 0.018, 700, 0.3);
    },
  },
};

class SoundSystem {
  constructor() {
    const s = LocalSave.getAudio();
    this.volume = s.volume;
    this.muted = s.muted;
    this.external = false;     // anúncio/popup de saída (plataforma): silencia sem mexer na preferência do jogador
    this.ctx = null; this.master = null; this.noise = null;
    this.buffers = {};
    this.last = {};
    this.voices = 0;
    this.want = null;          // trilha pedida ("menu" | "game" | null)
    this.cur = null;           // trilha tocando
    this.duck = false;
    this.musicBus = null;
  }

  get audible() { return !this.muted && !this.external && this.volume > 0; }

  // Deve ser chamado dentro de um gesto do jogador (toque em "Jogar") — exigência dos navegadores.
  unlock() {
    if (!this.ctx) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.connect(this.ctx.destination);
        this.musicBus = this.ctx.createGain();                 // trilhas: volume próprio, abafado em menus de pausa
        this.musicBus.gain.value = MUSIC_LEVEL;
        this.musicBus.connect(this.master);
        document.addEventListener("visibilitychange", () => {   // aba oculta: silêncio total
          try { document.hidden ? this.ctx.suspend() : this.ctx.resume(); } catch { /* sem áudio */ }
        });
        const len = this.ctx.sampleRate;
        this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = this.noise.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        this.loadOverrides();
      } catch { this.ctx = null; return; }
    }
    this.applyGain();
    try { this.ctx.resume?.(); } catch { /* sem áudio */ }
    this.syncMusic();
  }

  /* ------------------------------ trilha sonora ------------------------------ */
  // music("menu" | "game" | null): pede a trilha; só toca depois do primeiro gesto do jogador (unlock).
  music(name) { this.want = name; this.syncMusic(); }
  // Abafa a trilha enquanto o menu de construção/pausa está aberto.
  setMusicDuck(on) {
    this.duck = !!on;
    if (this.musicBus) this.musicBus.gain.setTargetAtTime(this.duck ? MUSIC_LEVEL * 0.35 : MUSIC_LEVEL, this.ctx.currentTime, 0.12);
  }

  syncMusic() {
    if (!this.ctx) return;
    this.musicBus.gain.value = this.duck ? MUSIC_LEVEL * 0.35 : MUSIC_LEVEL;
    if (this.cur?.name === this.want) return;
    if (this.cur) this.stopTrack(this.cur);
    this.cur = this.want ? this.startTrack(this.want) : null;
  }

  stopTrack(t) {
    clearInterval(t.timer);
    try { t.out.gain.setTargetAtTime(0, this.ctx.currentTime, 0.25); } catch { /* */ }
    setTimeout(() => { try { t.out.disconnect(); t.src?.stop(); } catch { /* */ } }, 1800);
  }

  startTrack(name) {
    const out = this.ctx.createGain();
    out.gain.setValueAtTime(0.0001, this.ctx.currentTime);
    out.gain.linearRampToValueAtTime(1, this.ctx.currentTime + 0.8);
    out.connect(this.musicBus);
    const t = { name, out, timer: 0, step: 0, next: this.ctx.currentTime + 0.1, src: null };
    const url = MUSIC_OVERRIDES[name];
    if (url) {                                    // trilha definitiva (arquivo) em loop; sem ela, usa a sintetizada
      fetch(url).then((r) => r.arrayBuffer()).then((b) => this.ctx.decodeAudioData(b)).then((buf) => {
        if (this.cur !== t) return;
        clearInterval(t.timer);
        t.src = this.ctx.createBufferSource(); t.src.buffer = buf; t.src.loop = true; t.src.connect(out); t.src.start();
      }).catch(() => console.warn(`[Audio] trilha ${url} indisponível; usando a provisória`));
    }
    const song = SONGS[name];
    const tick = () => {
      const spb = 60 / song.bpm / 4;               // duração de 1/16
      while (t.next < this.ctx.currentTime + 0.3) { this.playStep(song, t, t.step++, t.next, spb); t.next += spb; }
    };
    tick(); t.timer = setInterval(tick, 80);
    return t;
  }

  note(t, type, midi, when, dur, gain, lp = 0, attack = 0.01) {
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.value = 440 * Math.pow(2, (midi - 69) / 12);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(gain, when + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    let node = o;
    if (lp) { const f = this.ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = lp; o.connect(f); node = f; }
    node.connect(g); g.connect(t.out);
    o.start(when); o.stop(when + dur + 0.05);
  }

  drum(t, when, kind) {
    const g = this.ctx.createGain();
    if (kind === "kick") {
      const o = this.ctx.createOscillator();
      o.frequency.setValueAtTime(150, when); o.frequency.exponentialRampToValueAtTime(42, when + 0.12);
      g.gain.setValueAtTime(0.5, when); g.gain.exponentialRampToValueAtTime(0.0001, when + 0.16);
      o.connect(g); g.connect(t.out); o.start(when); o.stop(when + 0.2);
    } else {
      const s = this.ctx.createBufferSource(), f = this.ctx.createBiquadFilter();
      s.buffer = this.noise; f.type = "highpass"; f.frequency.value = kind === "snare" ? 1800 : 7000;
      const d = kind === "snare" ? 0.13 : 0.04;
      g.gain.setValueAtTime(kind === "snare" ? 0.22 : 0.07, when); g.gain.exponentialRampToValueAtTime(0.0001, when + d);
      s.connect(f); f.connect(g); g.connect(t.out); s.start(when, Math.random() * 0.5); s.stop(when + d + 0.02);
    }
  }

  playStep(song, t, step, when, spb) {
    const bar = Math.floor(step / 16) % song.chords.length, i = step % 16, ch = song.chords[bar];
    song.pattern(this, t, { bar, i, ch, when, spb, step });
  }

  applyGain() { if (this.master) this.master.gain.value = this.audible ? this.volume : 0; }
  setVolume(v) { this.volume = Math.min(1, Math.max(0, v)); this.applyGain(); this.save(); }
  setMuted(m) { this.muted = !!m; this.applyGain(); this.save(); }
  toggleMute() { this.setMuted(!this.muted); return this.muted; }
  setExternalMute(on) { this.external = !!on; this.applyGain(); }   // não grava preferência
  save() { LocalSave.setAudio({ volume: this.volume, muted: this.muted }); }

  async loadOverrides() {
    for (const [name, url] of Object.entries(SOUND_OVERRIDES)) {
      try {
        const res = await fetch(url);
        this.buffers[name] = await this.ctx.decodeAudioData(await res.arrayBuffer());
      } catch { console.warn(`[Audio] não foi possível carregar ${url}; usando o provisório`); }
    }
  }

  play(name) {
    if (!this.ctx || !this.audible || this.voices >= MAX_VOICES) return;
    const now = this.ctx.currentTime;
    const gap = MIN_GAP[name] ?? 0;
    if (gap && now - (this.last[name] ?? -9) < gap) return;
    this.last[name] = now;
    try {
      if (this.buffers[name]) this.playBuffer(this.buffers[name]);
      else for (const layer of RECIPES[name] ?? []) this.synth(layer, now);
    } catch { /* áudio é opcional */ }
  }

  playBuffer(buf) {
    const src = this.ctx.createBufferSource();
    src.buffer = buf; src.connect(this.master);
    this.voices++; src.onended = () => { this.voices--; };
    src.start();
  }

  synth(p, now) {
    const t0 = now + (p.delay ?? 0), t1 = t0 + p.dur;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(p.gain, t0 + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t1);
    let src;
    if (p.noise) {
      src = this.ctx.createBufferSource();
      src.buffer = this.noise; src.loop = true;
      const f = this.ctx.createBiquadFilter();
      f.type = p.f1 > p.f0 ? "highpass" : "lowpass";
      f.frequency.setValueAtTime(p.f0, t0);
      f.frequency.exponentialRampToValueAtTime(Math.max(20, p.f1), t1);
      src.connect(f); f.connect(g);
    } else {
      src = this.ctx.createOscillator();
      src.type = p.wave;
      src.frequency.setValueAtTime(p.f0, t0);
      src.frequency.exponentialRampToValueAtTime(Math.max(20, p.f1), t1);
      src.connect(g);
    }
    g.connect(this.master);
    this.voices++; src.onended = () => { this.voices--; };
    src.start(t0); src.stop(t1 + 0.02);
  }
}

export const Sound = new SoundSystem();
