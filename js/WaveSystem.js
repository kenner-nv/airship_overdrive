/* ==========================================================================
   WaveSystem.js — ondas infinitas. Cada onda recebe um "orçamento de ameaça" crescente
   que é gasto em inimigos sorteados entre os tipos já liberados (Enemies.minWave).
   Não há tabela finita: a fórmula (Config.waves) continua gerando ondas válidas para sempre,
   com limites de quantidade para não sobrecarregar o navegador.
   ========================================================================== */
import { CONFIG } from "./data/Config.js";
import { ENEMIES } from "./data/Enemies.js";
import { Sound } from "./Audio.js";

const rand = (a, b) => a + Math.random() * (b - a);

export class WaveSystem {
  constructor(game) { this.game = game; this.reset(); }

  reset() {
    this.wave = 0;
    this.phase = "delay";           // delay → spawning → clearing → delay …
    this.timer = CONFIG.waves.startDelay;
    this.queue = [];
    this.spawnTimer = 0;
    this.waveTime = 0;
    // vida: a cada 2–3 ondas um inimigo aleatório carrega um item de cura
    this.nextHeal = CONFIG.heal.everyMin + Math.floor(Math.random() * (CONFIG.heal.everyMax - CONFIG.heal.everyMin + 1));
  }

  budget(wave) { const c = CONFIG.waves; return c.budgetBase + c.budgetPerWave * Math.pow(wave - 1, c.budgetExp); }
  spawnInterval(wave) { const c = CONFIG.waves; return Math.max(c.spawnIntervalMin, c.spawnIntervalBase * Math.pow(c.spawnIntervalDecay, wave - 1)); }

  // A partir da onda 21 o Soberano alterna com o Comandante (ondas 25, 35… = Soberano).
  eliteId(wave) { return wave > 20 && (wave / CONFIG.waves.eliteEvery) % 2 === 1 ? "elite2" : "elite"; }

  buildQueue(wave) {
    const c = CONFIG.waves, w = this.game.world;
    const allowed = Object.values(ENEMIES).filter((d) => !d.special && d.minWave <= wave);
    const gap = this.spawnInterval(wave);
    const events = [];
    let budget = this.budget(wave);
    while (budget > 0.5 && events.length < c.maxSpawnsPerWave) {
      const pool = allowed.filter((d) => d.threat <= budget + 0.01);
      if (!pool.length) break;
      let r = Math.random() * pool.reduce((s, d) => s + d.weight, 0), def = pool[0];
      for (const d of pool) { r -= d.weight; if (r <= 0) { def = d; break; } }

      const f = def.formation;
      let n = 1;
      if (f && wave >= 3 && Math.random() < 0.5) n = Math.min(f.min + Math.floor(Math.random() * (f.max - f.min + 1)), Math.floor(budget / def.threat));
      if (n >= 2) {                                  // formação em linha, todos juntos
        const x0 = rand(50, Math.max(51, w.width - 50 - (n - 1) * f.spacing));
        for (let i = 0; i < n; i++) events.push({ id: def.id, x: x0 + i * f.spacing, wait: i === 0 ? gap * rand(0.7, 1.3) : 0 });
      } else {
        n = 1;
        events.push({ id: def.id, x: rand(40, w.width - 40), wait: gap * rand(0.7, 1.3) });
      }
      budget -= def.threat * n;
    }
    if (c.eliteEvery && wave % c.eliteEvery === 0) {
      events.splice(Math.floor(events.length / 2), 0, { id: this.eliteId(wave), x: w.width / 2, wait: gap * 2 });
    }
    if (wave >= this.nextHeal) {
      const cand = events.filter((ev) => ev.id !== "elite");
      if (cand.length) cand[Math.floor(Math.random() * cand.length)].heal = true;
      this.nextHeal = wave + CONFIG.heal.everyMin + Math.floor(Math.random() * (CONFIG.heal.everyMax - CONFIG.heal.everyMin + 1));
    }
    return events;
  }

  startWave() {
    this.wave++;
    this.queue = this.buildQueue(this.wave);
    this.spawnTimer = 0.4;
    this.waveTime = 0;
    this.phase = "spawning";
    this.game.onWaveStart(this.wave);
  }

  completeWave() {
    const g = this.game, e = CONFIG.economy;
    g.score.addWaveClear(this.wave);
    const bonus = e.waveCoinBonusBase + e.waveCoinBonusPerWave * this.wave;
    g.currency.add(bonus);
    g.onWaveClear(this.wave, bonus);
    this.phase = "delay";
    this.timer = CONFIG.waves.intermission;
  }

  update(dt) {
    const g = this.game;
    if (this.wave === 0 && g.weapons.equippedCount === 0) return;   // a 1ª onda só começa depois da primeira arma
    if (this.phase === "delay") {
      this.timer -= dt;
      if (this.timer <= 0) this.startWave();
      return;
    }
    this.waveTime += dt;
    if (this.phase === "spawning") {
      this.spawnTimer -= dt;
      while (this.queue.length && this.spawnTimer <= 0 && g.enemies.aliveCount < CONFIG.limits.maxEnemiesAlive) {
        const ev = this.queue.shift();
        g.enemies.spawn(ev.id, ev.x, this.wave, { heal: ev.heal });
        this.spawnTimer = this.queue.length ? this.queue[0].wait : 0;
      }
      if (!this.queue.length) this.phase = "clearing";
    } else if (this.phase === "clearing") {
      // a próxima onda só vem quando não resta nenhum inimigo vivo (mortos ou que já saíram da tela — EnemySystem os remove)
      if (g.enemies.aliveCount === 0) this.completeWave();
    }
  }
}
