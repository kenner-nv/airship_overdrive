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
    this.stall = 0; this.spawned = {}; this.escortWait = 0;
    // vida: a cada 2–3 ondas um inimigo aleatório carrega um item de cura
    this.nextHeal = CONFIG.heal.everyMin + Math.floor(Math.random() * (CONFIG.heal.everyMax - CONFIG.heal.everyMin + 1));
  }

  budget(wave) { const c = CONFIG.waves; return c.budgetBase + c.budgetPerWave * Math.pow(wave - 1, c.budgetExp); }
  spawnInterval(wave) { const c = CONFIG.waves; return Math.max(c.spawnIntervalMin, c.spawnIntervalBase * Math.pow(c.spawnIntervalDecay, wave - 1)); }

  eliteId(wave) { return CONFIG.waves.eliteSchedule[wave] ?? null; }

  // Inimigo "novo" nesta onda: estreia (onda de entrada) ou a seguinte.
  isNew(def, wave) { return !!def.intro && wave >= def.minWave && wave <= def.minWave + 1; }

  // A fila é uma lista de GRUPOS { wait, list:[{id,x,heal?}] }: uma formação nasce junta e é tratada como uma unidade.
  buildQueue(wave) {
    const c = CONFIG.waves, w = this.game.world;
    const allowed = Object.values(ENEMIES).filter((d) => !d.special && d.minWave <= wave && wave <= (d.maxWave ?? 9999));
    const gap = this.spawnInterval(wave);
    const units = [];
    let budget = this.budget(wave);
    while (budget > 0.5 && units.length < c.maxSpawnsPerWave) {
      const pool = allowed.filter((d) => d.threat <= budget + 0.01);
      if (!pool.length) break;
      let r = Math.random() * pool.reduce((s, d) => s + d.weight, 0), def = pool[0];
      for (const d of pool) { r -= d.weight; if (r <= 0) { def = d; break; } }

      const f = def.formation;
      let n = 1;
      if (f && wave >= 3 && Math.random() < 0.5) n = Math.min(f.min + Math.floor(Math.random() * (f.max - f.min + 1)), Math.floor(budget / def.threat));
      if (n >= 2) {                                  // formação em linha, todos juntos
        const x0 = rand(50, Math.max(51, w.width - 50 - (n - 1) * f.spacing));
        units.push({ wait: gap * rand(0.7, 1.3), list: Array.from({ length: n }, (_, i) => ({ id: def.id, x: x0 + i * f.spacing })) });
      } else {
        n = 1;
        units.push({ wait: gap * rand(0.7, 1.3), list: [{ id: def.id, x: rand(40, w.width - 40) }] });
      }
      budget -= def.threat * n;
    }
    // garante que cada inimigo novo desta onda apareça ao menos uma vez
    for (const d of allowed) {
      if (d.intro && d.minWave === wave && !units.some((u) => u.list.some((ev) => ev.id === d.id))) {
        units.splice(Math.floor(Math.random() * (units.length + 1)), 0, { wait: gap, list: [{ id: d.id, x: rand(40, w.width - 40) }] });
      }
    }
    this.orderForEscort(units, wave);
    const eid = this.eliteId(wave);
    if (eid) units.splice(Math.floor(units.length / 2), 0, { wait: gap * 2, strict: true, elite: true, list: [{ id: eid, x: w.width / 2 }] });
    if (wave >= this.nextHeal) {
      const cand = units.flatMap((u) => u.list).filter((ev) => !ENEMIES[ev.id].special);
      if (cand.length) cand[Math.floor(Math.random() * cand.length)].heal = true;
      this.nextHeal = wave + CONFIG.heal.everyMin + Math.floor(Math.random() * (CONFIG.heal.everyMax - CONFIG.heal.everyMin + 1));
    }
    return units;
  }

  startWave() {
    this.wave++;
    this.queue = this.buildQueue(this.wave);
    this.spawnTimer = 0.4;
    this.waveTime = 0;
    this.stall = 0;
    this.spawned = {};
    this.escortWait = 0;
    this.phase = "spawning";
    this.game.onWaveStart(this.wave);
  }

  /* ------------------------------ regras de aparição ------------------------------ */
  aliveOf(id) { let n = 0; for (const e of this.game.enemies.list) if (!e.dead && e.def.id === id) n++; return n; }

  /* ------------------------------ escolta ------------------------------ */
  // Drones e ceifadores (de qualquer geração) formam grupos de escolta; "tanque" = inimigo pesado que não é atirador.
  isSwarm(d) { return d.id === "basic" || d.id === "fast" || d.id === "ghost" || d.id === "dodger"; }
  isTank(d) { return !!d.heavy && !d.ranged && !d.special && d.behavior !== "shooter"; }
  // Precisa de escolta: estreia de inimigo novo (que não seja drone/ceifador) ou qualquer atirador.
  needsEscort(d, wave) {
    if (d.special || this.isSwarm(d)) return false;
    if (this.isNew(d, wave) && d.minWave === wave) return true;
    return d.behavior === "shooter" || !!d.ranged || d.fire.length > 0;
  }
  // Devolve o inimigo-âncora da escolta (o tanque mais à frente, ou o centro do grupo de drones/ceifadores) ou null.
  escortFor(alive) {
    const R = CONFIG.waves.rules;
    let best = null;
    for (const e of alive) if (this.isTank(e.def) && e.y > -10 && (!best || e.y > best.y)) best = e;
    if (best) return best;
    const sw = alive.filter((e) => this.isSwarm(e.def) && e.y > -10);
    if (sw.length >= R.escortGroup) {
      const cx = sw.reduce((s, e) => s + e.x, 0) / sw.length;
      return { x: cx, y: Math.max(...sw.map((e) => e.y)) };
    }
    return null;
  }
  // Na fila: o primeiro grupo que precisa de escolta nunca vem antes do primeiro grupo que a oferece.
  orderForEscort(units, wave) {
    if (wave < CONFIG.waves.rules.escortFromWave) return;
    const needs = (u) => u.list.some((ev) => this.needsEscort(ENEMIES[ev.id], wave));
    const gives = (u) => u.list.every((ev) => this.isSwarm(ENEMIES[ev.id]) || this.isTank(ENEMIES[ev.id])) && (u.list.length >= CONFIG.waves.rules.escortGroup || u.list.some((ev) => this.isTank(ENEMIES[ev.id])));
    const iN = units.findIndex(needs);
    if (iN < 0) return;
    const iG = units.findIndex(gives);
    if (iG > iN) units.splice(iN, 0, units.splice(iG, 1)[0]);
    else if (iG < 0) {      // nenhum grupo de escolta na fila: acrescenta um grupo de drones/ceifadores antes do primeiro atirador
      const id = wave >= 21 ? "dodger" : "fast", d = ENEMIES[id], w = this.game.world, f = d.formation;
      const x0 = rand(50, Math.max(51, w.width - 50 - 2 * f.spacing));
      units.splice(iN, 0, { wait: this.spawnInterval(wave), list: Array.from({ length: 3 }, (_, i) => ({ id, x: x0 + i * f.spacing })) });
    }
  }

  // Pode este grupo nascer agora? (limites de quantidade, estreia de inimigo novo, chefe na tela…)
  canSpawn(unit) {
    const g = this.game, R = CONFIG.waves.rules, wave = this.wave, list = g.enemies.list;
    const alive = list.filter((e) => !e.dead);
    const defs = unit.list.map((ev) => ENEMIES[ev.id]);
    if (alive.length + unit.list.length > CONFIG.limits.maxEnemiesAlive) return false;
    if (unit.elite) return alive.length + 1 <= R.maxAlive || wave < R.capsFromWave;
    const bossAlive = alive.some((e) => e.def.special);
    if (bossAlive && alive.length + unit.list.length > R.bossMaxAlive) return false;

    if (wave >= R.capsFromWave) {
      if (alive.length + unit.list.length > R.maxAlive) return false;
      const count = (fn) => alive.filter((e) => fn(e.def)).length;
      const add = (fn) => defs.filter(fn).length;
      const heavy = (d) => d.threat >= R.heavyThreat;
      if (count(heavy) + add(heavy) > R.maxHeavy) return false;
      const ranged = (d) => !!d.ranged;
      if (count(ranged) + add(ranged) > R.maxRanged) return false;
      for (const d of defs) {
        if (d.cap && this.aliveOf(d.id) + defs.filter((x) => x === d).length > d.cap) return false;
        if (d.group && R.groupCap[d.group]) {
          const same = (x) => x.group === d.group;
          if (count(same) + add(same) > R.groupCap[d.group]) return false;
        }
      }
    }

    // estreia de inimigo novo: só com inimigos já conhecidos na tela e depois de alguns segundos de onda
    const news = defs.filter((d) => this.isNew(d, wave) && !d.introFree);   // introFree (Drone Fantasma): entra desde o início, sem a espera
    const debut = news.some((d) => d.minWave === wave);
    const known = alive.filter((e) => !this.isNew(e.def, wave) && !e.def.special).length;
    if (news.length && (this.waveTime < R.introDelay || known < R.introMinKnown)) return false;
    if (debut && alive.length >= R.introMaxAlive) return false;

    // escolta (a partir da onda 20): estreias e atiradores só entram atrás de um tanque ou de um grupo de drones/ceifadores
    if (wave >= R.escortFromWave && defs.some((d) => this.needsEscort(d, wave)) && !this.escortFor(alive)) return false;
    return true;
  }

  spawnUnit(unit) {
    const g = this.game, R = CONFIG.waves.rules;
    const escort = this.wave >= R.escortFromWave && !unit.elite && unit.list.some((ev) => this.needsEscort(ENEMIES[ev.id], this.wave)) ? this.escortFor(g.enemies.list.filter((e) => !e.dead)) : null;
    unit.list.forEach((ev, i) => {
      let x = ev.x;
      if (escort && this.needsEscort(ENEMIES[ev.id], this.wave)) x = escort.x + (i - (unit.list.length - 1) / 2) * 44 + rand(-24, 24);   // nasce "atrás" da escolta (mais acima na tela, no mesmo corredor)
      g.enemies.spawn(ev.id, x, this.wave, { heal: ev.heal });
      this.spawned[ev.id] = (this.spawned[ev.id] ?? 0) + 1;
    });
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
    // tela quase vazia com grupos esperando: depois de alguns segundos libera o próximo (a onda nunca trava)
    this.stall = this.phase === "spawning" && this.queue.length && this.game.enemies.aliveCount <= 2 ? this.stall + dt : 0;
    if (this.phase === "spawning") {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0 && this.queue.length) {
        // primeiro grupo liberado pelas regras (um chefe "strict" não pode ser ultrapassado)
        let idx = -1, force = false;
        force = this.stall > CONFIG.waves.rules.stallSecs;        // tela quase vazia e nada liberado: não deixa a onda travar
        for (let i = 0; i < this.queue.length; i++) {
          const u = this.queue[i];
          if (force ? this.game.enemies.aliveCount + u.list.length <= CONFIG.limits.maxEnemiesAlive : this.canSpawn(u)) { idx = i; break; }
          if (u.strict) break;
        }
        if (idx >= 0) {
          const [u] = this.queue.splice(idx, 1);
          this.spawnUnit(u);
          this.stall = 0;
          this.spawnTimer = this.queue.length ? this.queue[0].wait : 0;
        } else {
          this.spawnTimer = 0.25;                            // espera (o orçamento da onda não muda)
          // só restam grupos que pedem escolta e a escolta já foi destruída: chama um reforço de drones/ceifadores
          const R = CONFIG.waves.rules;
          if (this.wave >= R.escortFromWave && !this.queue[0]?.strict && !this.escortFor(this.game.enemies.list.filter((e) => !e.dead))) {
            this.escortWait += 0.25;
            if (this.escortWait >= 2.5) {
              this.escortWait = 0;
              const id = this.wave >= 21 ? "ghost" : "basic", w = this.game.world;
              for (let i = 0; i < R.escortGroup; i++) this.game.enemies.spawn(id, w.width * (0.25 + 0.25 * i) + rand(-20, 20), this.wave);
            }
          }
        }
      }
      if (!this.queue.length) this.phase = "clearing";
    } else if (this.phase === "clearing") {
      // a próxima onda só vem quando não resta nenhum inimigo vivo (mortos ou que já saíram da tela — EnemySystem os remove)
      if (g.enemies.aliveCount === 0) this.completeWave();
    }
  }
}
