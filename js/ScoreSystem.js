/* ScoreSystem.js — pontuação da tentativa (independente das moedas). Fórmulas em Config.js. */
import { CONFIG } from "./data/Config.js";

export class ScoreSystem {
  constructor() { this.reset(); }
  reset() { this.score = 0; this.kills = 0; }
  killPoints(def, wave) { return Math.round(def.score * (1 + CONFIG.score.killWaveBonus * (wave - 1))); }
  addKill(def, wave) { this.kills++; this.score += this.killPoints(def, wave); }
  addWaveClear(wave) { this.score += CONFIG.score.waveClearBase * wave; }
}
