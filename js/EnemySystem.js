/* ==========================================================================
   EnemySystem.js — cria inimigos, controla comportamento e ataques (projéteis inimigos).
   Comportamentos (BEHAVIORS) e padrões de tiro (PATTERNS) são registros: para um novo, basta
   adicionar uma função aqui e referenciá-la em data/Enemies.js.
   ========================================================================== */
import { CONFIG } from "./data/Config.js";
import { ENEMIES } from "./data/Enemies.js";
import { Pool } from "./Pool.js";
import { Sound } from "./Audio.js";

const TAU = Math.PI * 2;
const makeBullet = () => ({ x: 0, y: 0, vx: 0, vy: 0, r: 5, dmg: 10, life: 0, kind: "normal", homing: 0, age: 0 });
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// Amplitude lateral de cada comportamento. A posição-base é afastada das paredes por esse valor, para o
// inimigo nunca "grudar" na borda; e o balanço lateral começa suave (rampa), sem teletransporte.
const AMP = { zigzag: 28, sine: 72, shooter: 90, boss: 150, dive: 0 };
const ramp = (t, dur = 1.2) => Math.min(1, t / dur);

const BEHAVIORS = {
  zigzag(e, dt) { e.y += e.def.speed * dt; e.x = e.baseX + Math.sin(e.t * 1.4 + e.phase) * AMP.zigzag; },
  dive(e, dt, g) {
    e.y += e.def.speed * dt;
    if (g.ship.alive && e.y < 340) e.x += Math.sign(g.ship.x - e.x) * Math.min(55 * dt, Math.abs(g.ship.x - e.x));
  },
  shooter(e, dt) {
    if (e.y < e.holdY) { e.y += e.def.speed * dt; e.x = e.baseX; }
    else { e.hold += dt; e.x = e.baseX + Math.sin(e.hold * 0.9 + e.phase) * AMP.shooter * ramp(e.hold); }
  },
  sine(e, dt) { e.y += e.def.speed * dt; e.x = e.baseX + Math.sin(e.t * 1.8 + e.phase) * AMP.sine; },
  boss(e, dt) {
    // `arrived` evita o bug do "teletransporte": durante a oscilação vertical o y chega a ficar ABAIXO de holdY, e o teste
    // antigo (e.y < e.holdY) devolvia o chefe ao modo de entrada, jogando-o para baseX e de volta a cada quadro.
    if (!e.arrived) {
      e.y = Math.min(e.holdY, e.y + e.def.speed * 2.4 * dt); e.x = e.baseX;
      if (e.y >= e.holdY) e.arrived = true;
    } else {
      e.hold += dt;
      const k = ramp(e.hold, 1.5);
      e.x = e.baseX + Math.sin(e.hold * 0.55) * AMP.boss * k;
      e.y = e.holdY + Math.sin(e.hold * 0.8) * 14 * k;
    }
  },
};

const PATTERNS = {
  aimed(e, p, g, speed, dmg) {
    const base = Math.atan2(g.ship.y - e.y, g.ship.x - e.x);
    const spread = ((p.spreadDeg ?? 0) * Math.PI) / 180;
    for (let i = 0; i < p.count; i++) g.enemies.bullet(e.x, e.y + e.r * 0.5, base + (i - (p.count - 1) / 2) * spread, speed, dmg);
    Sound.play("enemy_shoot");
  },
  // míssil teleguiado: gira devagar na direção da nave (só nos primeiros segundos, então dá para escapar)
  missile(e, p, g, speed, dmg) {
    const ang = Math.atan2(g.ship.y - e.y, g.ship.x - e.x);
    g.enemies.bullet(e.x, e.y + e.r * 0.5, ang, speed, dmg, { kind: "missile", homing: p.turn, r: 7, life: 8 });
    Sound.play("enemy_missile");
  },
  // laser em linha reta até o fim da tela: aviso (linha fina) → feixe ativo
  beam(e, p, g, speed, dmg) {
    const w = g.world, c = p.count ?? 1;
    const base = p.aim && g.ship.alive ? g.ship.x : e.x;
    for (let i = 0; i < c; i++) {
      const x = clamp(base + (i - (c - 1) / 2) * (p.spacing ?? 0), 16, w.width - 16);
      g.enemies.beams.push({ x, y: e.y + e.r * 0.4, t: 0, warn: p.warn, dur: p.dur, w: p.width, dmg, owner: e, fired: false });
    }
    Sound.play("beam_warn");
  },
  // rajadas em espiral (ligado/desligado em ciclos); o ângulo gira a cada disparo
  spiral(e, p, g, speed, dmg) {
    e.spin = (e.spin ?? 0) + p.step;
    for (let i = 0; i < p.arms; i++) g.enemies.bullet(e.x, e.y, e.spin + (i * TAU) / p.arms, speed, dmg);
    Sound.play("enemy_spiral");
  },
  ring(e, p, g, speed, dmg) {
    const off = Math.random() * TAU;
    for (let i = 0; i < p.count; i++) g.enemies.bullet(e.x, e.y, off + (i * TAU) / p.count, speed, dmg);
    Sound.play("enemy_ring");
  },
};

export class EnemySystem {
  constructor(game) {
    this.game = game;
    this.list = [];
    this.shots = new Pool(makeBullet, CONFIG.limits.maxEnemyShots);
    this.beams = [];
    this.nextId = 1;
  }

  reset() { this.list.length = 0; this.shots.clear(); this.beams.length = 0; this.nextId = 1; }

  get aliveCount() { let n = 0; for (const e of this.list) if (!e.dead) n++; return n; }

  /* Escalonamento da dificuldade por onda (GDD 12.4): tudo vem de CONFIG.waves. */
  scaling(wave) {
    const c = CONFIG.waves, w = wave - 1;
    const eff = Math.min(w, c.hpSoftCapWave - 1) + Math.max(0, w - (c.hpSoftCapWave - 1)) * 0.5;
    return {
      hp: 1 + c.hpPerWave * eff,
      shotSpeed: Math.min(c.shotSpeedMax, 1 + c.shotSpeedPerWave * w),
      fireRate: Math.max(c.fireRateMin, 1 - c.fireRatePerWave * w),
      damage: Math.min(c.damageMax, 1 + c.damagePerWave * w),
    };
  }

  spawn(defId, x, wave, opts = {}) {
    const def = ENEMIES[defId], sc = this.scaling(wave), w = this.game.world;
    const amp = AMP[def.behavior] ?? 0;
    x = clamp(x, def.radius + amp, w.width - def.radius - amp);
    const hold = def.holdY ? def.holdY[0] + Math.random() * (def.holdY[1] - def.holdY[0]) : 0;
    const e = {
      def, id: this.nextId++, x, y: -def.radius - 12, baseX: x, t: 0, hold: 0, carriesHeal: !!opts.heal, phase: Math.random() * TAU,
      hp: Math.round(def.hp * sc.hp), maxHp: 0, r: def.radius, flash: 0, charge: 0, dead: false,
      holdY: hold, dmgMul: sc.damage, shotMul: sc.shotSpeed, rateMul: sc.fireRate,
      timers: def.fire.map((p) => p.interval * sc.fireRate * (0.5 + Math.random() * 0.6)),
    };
    e.maxHp = e.hp;
    this.list.push(e);
    return e;
  }

  bullet(x, y, ang, speed, dmg, o = {}) {
    const b = this.shots.acquire();
    if (!b) return;
    b.x = x; b.y = y; b.vx = Math.cos(ang) * speed; b.vy = Math.sin(ang) * speed; b.dmg = dmg;
    b.life = o.life ?? 9; b.r = o.r ?? 5; b.kind = o.kind ?? "normal"; b.homing = o.homing ?? 0; b.age = 0;
  }

  update(dt) {
    const g = this.game, w = g.world, list = this.list;
    for (let i = list.length - 1; i >= 0; i--) {
      const e = list[i];
      if (e.dead) { list.splice(i, 1); continue; }
      e.t += dt;
      if (e.flash > 0) e.flash -= dt;
      BEHAVIORS[e.def.behavior](e, dt, g);
      e.x = clamp(e.x, e.r, w.width - e.r);
      this.updateFire(e, dt);
      if (e.y > w.height + e.r + 30) list.splice(i, 1);   // passou direto: sai sem recompensa
    }
  }

  updateFire(e, dt) {
    const g = this.game, fire = e.def.fire;
    e.charge = 0;
    if (!fire.length || e.y < 30 || !g.ship.alive) return;
    for (let i = 0; i < fire.length; i++) {
      const p = fire[i];
      if (p.pattern === "spiral" && e.t % (p.on + p.off) > p.on) continue;     // pausa entre as rajadas
      e.timers[i] -= dt;
      if (p.telegraph > 0 && e.timers[i] < p.telegraph) e.charge = Math.max(e.charge, 1 - Math.max(0, e.timers[i]) / p.telegraph);   // aviso antes do tiro
      if (e.timers[i] <= 0) {
        PATTERNS[p.pattern](e, p, g, p.bulletSpeed * e.shotMul, Math.round(p.damage * e.dmgMul));
        e.timers[i] = p.interval * (p.pattern === "spiral" ? 1 : e.rateMul);
      }
    }
  }

  updateShots(dt) {
    const w = this.game.world, ship = this.game.ship;
    this.shots.update((b) => {
      b.life -= dt; b.age += dt;
      if (b.homing > 0 && b.age < 3.2 && ship.alive) {       // míssil teleguiado
        let cur = Math.atan2(b.vy, b.vx), d = Math.atan2(ship.y - b.y, ship.x - b.x) - cur;
        while (d > Math.PI) d -= TAU;
        while (d < -Math.PI) d += TAU;
        cur += clamp(d, -b.homing * dt, b.homing * dt);
        const sp = Math.hypot(b.vx, b.vy);
        b.vx = Math.cos(cur) * sp; b.vy = Math.sin(cur) * sp;
      }
      b.x += b.vx * dt; b.y += b.vy * dt;
      return b.life > 0 && b.x > -30 && b.x < w.width + 30 && b.y > -30 && b.y < w.height + 30;
    });
  }

  updateBeams(dt) {
    const bs = this.beams;
    for (let i = bs.length - 1; i >= 0; i--) {
      const b = bs[i];
      b.t += dt;
      if (!b.fired && b.t >= b.warn) { b.fired = true; Sound.play("beam_fire"); }
      if (b.t >= b.warn + b.dur || (!b.fired && b.owner.dead)) bs.splice(i, 1);   // se o atirador morrer antes de disparar, o feixe some
    }
  }
}
