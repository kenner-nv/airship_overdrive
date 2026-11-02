/* ==========================================================================
   EnemySystem.js — cria inimigos, controla comportamento e ataques (projéteis inimigos).
   Comportamentos (BEHAVIORS) e padrões de tiro (PATTERNS) são registros: para um novo, basta
   adicionar uma função aqui e referenciá-la em data/Enemies.js.
   ========================================================================== */
import { CONFIG } from "./data/Config.js";
import { ENEMIES } from "./data/Enemies.js";
import { Pool } from "./Pool.js";
import { Sound } from "./Audio.js";
import { ABILITIES } from "./EnemyAbilities.js";

const TAU = Math.PI * 2;
const makeBullet = () => ({ x: 0, y: 0, vx: 0, vy: 0, r: 5, dmg: 10, life: 0, kind: "normal", homing: 0, age: 0, slowT: 0, slow: 0, homingT: 3.2 });
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
    if (e.y < e.holdY) { e.y += e.def.speed * (e.def.enter ?? 1) * dt; e.x = e.baseX; }
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
    g.enemies.bullet(e.x, e.y + e.r * 0.5, ang, speed, dmg, { kind: "missile", homing: p.turn, r: 5.25, life: 8 });
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
    this.rays = [];      // feixes inclinados/giratórios (Varredor, Rede de Feixes, chefes): { owner, x, y, a0, ang, rot, w, dmg, warn, dur, t, fired }
    this.zones = [];     // zonas de impacto orbital (Designador, Hegemon): { x, y, r, t, warn, dmg, fired, flash }
    this.bombs = [];     // explosões com pavio (Couraçado Explosivo): { x, y, t, fuse, r, dmg, sprite }
    this.nextId = 1;
  }

  reset() { this.list.length = 0; this.shots.clear(); this.beams.length = 0; this.rays.length = 0; this.zones.length = 0; this.bombs.length = 0; this.nextId = 1; }

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
      // estado extra (habilidades): knockback, lentidão, invulnerabilidade, partes (torres/satélites), avisos desenhados pelo Renderer
      pvx: 0, pvy: 0, evx: 0, evT: 0, slowT: 0, slow: 0, alpha: 1, intangible: false, invuln: false, ping: 0, parts: null, aims: [], rings: [],
      ab: null, hpMul: sc.hp, hist: null,
    };
    e.maxHp = e.hp;
    this.list.push(e);
    ABILITIES[def.ability]?.init?.(e, this.game, def.ap, sc);
    return e;
  }

  // Empurra o inimigo para trás (para cima na tela), afastando-o do ponto (cx, cy). dist = deslocamento final em px.
  // Pesados andam menos; elites não se mexem; torres/satélites não existem como alvo de empurrão.
  push(e, cx, cy, dist) {
    const mass = e.def.special ? 0 : e.def.heavy ? 0.45 : 1;
    if (!mass || e.dead) return;
    let nx = e.x - cx, ny = e.y - cy; const d = Math.hypot(nx, ny) || 1; nx /= d; ny /= d;
    let dx = nx * 0.5, dy = ny * 0.5 - 0.85; const L = Math.hypot(dx, dy); dx /= L; dy /= L;
    e.pvx += dx * dist * mass * 6; e.pvy += dy * dist * mass * 6;
  }

  // Ao ser atingido pelo jogador, o inimigo desliza para o lado (para fora da linha dos tiros), no máximo uma vez a cada 0,6 s.
  evade(e, kind) {
    const v = e.def.evade;
    if (!v || e.dead || e.evT > 0 || kind === "ram" || kind === "dash" || e.y < 10) return;
    const ship = this.game.ship, w = this.game.world;
    let dir = e.x >= ship.x ? 1 : -1;
    if (Math.abs(e.x - ship.x) < 8) dir = e.x < w.width / 2 ? 1 : -1;
    if (e.x < 70) dir = 1; else if (e.x > w.width - 70) dir = -1;
    e.evx = dir * v; e.evT = 0.6;
  }

  rayDist(r, px, py) {
    const cx = Math.cos(r.ang), cy = Math.sin(r.ang), dx = px - r.x, dy = py - r.y, t = dx * cx + dy * cy;
    return t < 0 ? Math.hypot(dx, dy) : Math.abs(dx * cy - dy * cx);
  }

  addRay(owner, o) {
    this.rays.push({ owner, x: owner.x, y: owner.y, a0: o.a0, ang: o.a0, rot: o.rot ?? 0, w: o.w, dmg: o.dmg, warn: o.warn, dur: o.dur, t: 0, fired: false, shielded: false, color: o.color ?? "#ff4d6d" });
  }

  addZone(x, y, o) {
    const w = this.game.world;
    this.zones.push({ x: clamp(x, o.r, w.width - o.r), y: clamp(y, o.r, w.height - o.r), r: o.r, t: 0, warn: o.warn, dmg: o.dmg, fired: false, flash: 0 });
  }

  bullet(x, y, ang, speed, dmg, o = {}) {
    const b = this.shots.acquire();
    if (!b) return;
    b.x = x; b.y = y; b.vx = Math.cos(ang) * speed; b.vy = Math.sin(ang) * speed; b.dmg = dmg;
    b.life = o.life ?? 9; b.r = o.r ?? 5; b.kind = o.kind ?? "normal"; b.homing = o.homing ?? 0; b.age = 0;
    b.slowT = 0; b.slow = 0; b.homingT = o.homingT ?? 2;
    return b;
  }

  update(dt) {
    const g = this.game, w = g.world, list = this.list;
    for (let i = list.length - 1; i >= 0; i--) {
      const e = list[i];
      if (e.dead) { list.splice(i, 1); continue; }
      let edt = dt;
      if (e.slowT > 0) { e.slowT -= dt; edt = dt * (1 - e.slow); }      // lentidão (Pulso lento): move, atira e usa habilidades mais devagar
      e.aims.length = 0; e.rings.length = 0;
      e.t += edt;
      if (e.flash > 0) e.flash -= dt;
      if (e.ping > 0) e.ping -= dt;
      BEHAVIORS[e.def.behavior](e, edt, g);
      if (e.pvx || e.pvy) {                                              // empurrão (knockback) que vai perdendo força
        e.x += e.pvx * dt; e.baseX = clamp(e.baseX + e.pvx * dt, e.r, w.width - e.r); e.y += e.pvy * dt;
        if (e.y < -e.r - 12) e.y = -e.r - 12;
        const f = Math.exp(-6 * dt); e.pvx *= f; e.pvy *= f;
        if (Math.abs(e.pvx) < 1 && Math.abs(e.pvy) < 1) e.pvx = e.pvy = 0;
      }
      if (e.evx) {                                                       // esquiva lateral suave ao ser atingido
        e.x += e.evx * dt; e.baseX = clamp(e.baseX + e.evx * dt, e.r, w.width - e.r);
        e.evx *= Math.exp(-3 * dt);
        if (Math.abs(e.evx) < 4) e.evx = 0;
      }
      if (e.evT > 0) e.evT -= dt;
      e.x = clamp(e.x, e.r, w.width - e.r);
      ABILITIES[e.def.ability]?.update?.(e, edt, g, e.def.ap);
      if (e.parts) for (const pt of e.parts) { pt.x = e.x + pt.ox; pt.y = e.y + pt.oy; if (pt.flash > 0) pt.flash -= dt; }
      this.updateFire(e, edt);
      if (e.y > w.height + e.r + 30) list.splice(i, 1);   // passou direto: sai sem recompensa
    }
    this.updateRays(dt);
    this.updateZones(dt);
    this.updateBombs(dt);
  }

  updateFire(e, dt) {
    const g = this.game, fire = e.def.fire;
    e.charge = 0;
    if (!fire.length || e.y < 16 || !g.ship.alive) return;
    const ab = ABILITIES[e.def.ability];
    for (let i = 0; i < fire.length; i++) {
      const p = fire[i];
      if (ab?.gate && !ab.gate(e, i, g)) continue;                              // a habilidade pode ligar/desligar cada padrão (fases dos chefes)
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
      let k = 1;
      if (b.slowT > 0) { b.slowT -= dt; k = 1 - b.slow; }                    // Pulso lento: tiros inimigos mais lentos
      const d = dt * k;
      b.life -= d; b.age += d;
      if (b.homing > 0 && b.age < b.homingT && ship.alive) {                // míssil teleguiado
        let cur = Math.atan2(b.vy, b.vx), da = Math.atan2(ship.y - b.y, ship.x - b.x) - cur;
        while (da > Math.PI) da -= TAU;
        while (da < -Math.PI) da += TAU;
        cur += clamp(da, -b.homing * d, b.homing * d);
        const sp = Math.hypot(b.vx, b.vy);
        b.vx = Math.cos(cur) * sp; b.vy = Math.sin(cur) * sp;
      }
      b.x += b.vx * d; b.y += b.vy * d;
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

  updateRays(dt) {
    const rs = this.rays;
    for (let i = rs.length - 1; i >= 0; i--) {
      const r = rs[i], o = r.owner;
      if (o.dead) { rs.splice(i, 1); continue; }
      r.t += dt;
      r.x = o.x; r.y = o.y;
      if (!r.fired && r.t >= r.warn) { r.fired = true; Sound.play("beam_fire"); }
      r.ang = r.a0 + r.rot * Math.max(0, r.t - r.warn);       // só gira depois de disparado: o aviso mostra onde ele começa
      if (r.t >= r.warn + r.dur) rs.splice(i, 1);
    }
  }

  updateZones(dt) {
    const g = this.game, zs = this.zones;
    for (let i = zs.length - 1; i >= 0; i--) {
      const z = zs[i];
      z.t += dt;
      if (!z.fired && z.t >= z.warn) {
        z.fired = true; z.flash = 0.35;
        g.vfx.explosion(z.x, z.y, z.r * 0.8, "#ff7ad9");
        Sound.play("explode");
        g.hurtArea(z.x, z.y, z.r, z.dmg);
      }
      if (z.fired) { z.flash -= dt; if (z.flash <= 0) zs.splice(i, 1); }
    }
  }

  updateBombs(dt) {
    const g = this.game, bs = this.bombs;
    for (let i = bs.length - 1; i >= 0; i--) {
      const b = bs[i];
      b.t += dt;
      if (b.t < b.fuse) continue;
      bs.splice(i, 1);
      g.vfx.explosion(b.x, b.y, b.r * 0.7, "#ffb347");
      g.vfx.ring(b.x, b.y, 10, b.r, "#fff3a8", 0.3, 3);
      Sound.play("explode_big");
      g.hurtArea(b.x, b.y, b.r, b.dmg);
    }
  }

  // Detona um Couraçado Explosivo (contato com a nave): destrói e explode quase na hora.
  detonate(e) {
    if (e.dead) return;
    if (e.ab) e.ab.contact = true;
    e.hp = 0;
    this.game.killEnemy(e);
  }
}
