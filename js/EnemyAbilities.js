/* ==========================================================================
   EnemyAbilities.js — habilidades especiais dos inimigos novos (ondas 21+) e dos chefes (Colosso, Singularidade, Hegemon).
   Cada habilidade é um objeto em ABILITIES, referenciado por `ability` em data/Enemies.js (parâmetros em `ap`):
     init(e, g, p, sc)        ao criar o inimigo (sc = escalonamento da onda)
     update(e, dt, g, p)      todo passo (dt já considera a lentidão do Pulso lento)
     gate(e, i, g)            (opcional) liga/desliga o padrão de tiro `fire[i]` (fases dos chefes)
     filter(e, dmg, kind, g, p)  (opcional) altera o dano recebido (escudo adaptativo)
     onPartDead(e, part, g, p)   (opcional) uma torre/satélite foi destruída
     onKill(e, g, p)          (opcional) o inimigo foi destruído
   Estado de cada inimigo: e.ab (livre) · e.parts (torres/satélites) · e.invuln / e.intangible / e.alpha ·
   e.aims (linhas de mira) e e.rings (anéis de aviso) — os dois últimos são refeitos a cada passo e só desenhados pelo Renderer.
   ========================================================================== */
import { Sound } from "./Audio.js";

const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const dmgOf = (e, base) => Math.max(1, Math.round(base * e.dmgMul));
const aimAt = (g, x, y) => Math.atan2(g.ship.y - y, g.ship.x - x);
const DEG = Math.PI / 180;

// Parte (torre / satélite) de um inimigo. As partes são alvos próprios: os tiros do jogador as acertam antes do corpo.
function mkPart(e, idx, o) {
  return { id: -(e.id * 16 + idx + 1), kind: o.kind, ox: o.ox ?? 0, oy: o.oy ?? 0, x: e.x + (o.ox ?? 0), y: e.y + (o.oy ?? 0), r: o.r, hp: o.hp, maxHp: o.hp, dead: false, flash: 0, ang: o.ang ?? 0, cd: o.cd ?? 0, glow: 0, fired: false, aimAng: Math.PI / 2 };
}

// Vida total de um chefe (corpo + partes vivas) para a barra do topo.
export function bossHp(e) {
  let hp = Math.max(0, e.hp), max = e.maxHp;
  if (e.parts) for (const p of e.parts) { max += p.maxHp; if (!p.dead) hp += Math.max(0, p.hp); }
  return { hp, max };
}

function phaseStart(e, g, text) {
  g.pickups.spawn("heart", e.x, e.y + 24, 0, 40);          // coração a cada mudança de fase
  g.ui.banner(e.def.name.toUpperCase(), text);
  Sound.play("wave");
}

/* ------------------------------ escudo adaptativo (Adaptador e Hegemon) ------------------------------ */
// Considera a arma que mais causou dano nos últimos `window` segundos (dano bruto, sem contar o próprio escudo).
function adaptDominant(e, now, window) {
  const h = e.hist;
  if (!h) return null;
  while (h.length && h[0].t < now - window) h.shift();
  if (!h.length) return null;
  const sum = {};
  let best = null, bv = 0;
  for (const x of h) { sum[x.k] = (sum[x.k] ?? 0) + x.d; if (sum[x.k] > bv) { bv = sum[x.k]; best = x.k; } }
  return best;
}
function adaptFilter(e, dmg, kind, g, resist, window) {
  if (kind === "ram" || kind === "dash") return dmg;
  const now = g.run.time, dom = adaptDominant(e, now, window);
  (e.hist ??= []).push({ t: now, k: kind, d: dmg });
  return dom && kind === dom ? dmg * (1 - resist) : dmg;
}
function adaptTick(e, g, window) {
  e.ab.dom = adaptDominant(e, g.run.time, window);
}

/* ------------------------------ utilidades de ataque ------------------------------ */
function snipeShot(e, g, x, y, ang, speed, dmg) {
  g.enemies.bullet(x, y, ang, speed * e.shotMul, dmg, { kind: "snipe", r: 4.5, life: 3 });
  Sound.play("enemy_shoot");
}

function microVolley(e, g, p, count, dmg) {
  const base = aimAt(g, e.x, e.y);
  for (let i = 0; i < count; i++) {
    const a = base + (count > 1 ? (i / (count - 1) - 0.5) * 120 * DEG : 0);
    g.enemies.bullet(e.x + Math.cos(a) * e.r * 0.5, e.y + Math.sin(a) * e.r * 0.5, a, p.microSpeed * e.shotMul ?? 150, dmg, { kind: "micro", homing: p.microTurn, r: 4.5, life: 7, homingT: 4.5 });
  }
  Sound.play("enemy_missile");
}

// Marca zonas de impacto orbital perto da nave: a 1ª quase em cima dela, as demais espalhadas em volta.
function markZones(e, g, n, o) {
  const ship = g.ship;
  for (let i = 0; i < n; i++) {
    const a = rand(0, TAU), d = i === 0 ? rand(0, 28) : rand(o.near * 0.45, o.near);
    g.enemies.addZone(ship.x + Math.cos(a) * d, ship.y + Math.sin(a) * d, { r: o.r, warn: o.warn, dmg: o.dmg });
  }
  Sound.play("beam_warn");
}

/* Campo de repulsão (Gravitacional e Singularidade): durante a onda (wave s) empurra a nave para longe e desvia os tiros do jogador
   para os lados (um tiro reto nele nunca chega); depois, `rest` s de descanso — é quando ele pode ser acertado. st = { mode, t }. */
function pushField(e, g, p, st, dt, color, radius, push) {
  const ship = g.ship;
  st.t -= dt;
  if (st.mode === "rest") {
    e.rings.push({ r: radius, color, a: 0.1, w: 1.2, dash: true });
    if (st.t <= 0) { st.mode = "wave"; st.t = p.wave; Sound.play("beam_warn"); }
    return false;
  }
  const k = clamp(1 - st.t / p.wave, 0, 1), rc = Math.max(8, radius * k);   // a onda cresce do centro até o raio máximo; só vale dentro dela
  e.rings.push({ r: radius, color, a: 0.3, w: 1.8, dash: true });
  e.rings.push({ r: rc, color, a: 0.8 - 0.35 * k, w: 3, fillA: 0.06 });
  if (ship.alive && !ship.dash) {
    const dx = ship.x - e.x, dy = ship.y - e.y, d = Math.hypot(dx, dy) || 1;
    if (d < rc) {
      const sp = push * (0.4 + 0.6 * (1 - d / rc));
      ship.x += (dx / d) * sp * dt; ship.y += (dy / d) * sp * dt;
      ship.tx += (dx / d) * sp * dt; ship.ty += (dy / d) * sp * dt;
      ship.clampToArena(g.world); ship.clampTarget(g.world);
    }
  }
  const r2 = rc * rc, lat = p.deflect * 100;
  for (const s of g.weapons.shots.active) {
    if (s.life <= 0) continue;
    const dx = s.x - e.x, dy = s.y - e.y, d2 = dx * dx + dy * dy;
    if (d2 > r2) continue;
    s.x += (dx >= 0 ? 1 : -1) * lat * (1 - 0.55 * Math.sqrt(d2) / rc) * dt;
  }
  if (st.t <= 0) { st.mode = "rest"; st.t = p.rest; g.vfx.ring(e.x, e.y, 6, 40, color, 0.3, 2); }
  return true;
}

function randBossX(e, g, p) {
  const w = g.world.width, m = Math.min(w / 2 - 10, e.r + 150);
  return rand(m, w - m);
}

export const ABILITIES = {
  /* ===== Drone Fantasma: some (intangível) e reaparece mais adiante, com um brilho de aviso ===== */
  ghost: {
    init(e) { e.ab = { state: "vis", t: 0 }; },
    update(e, dt, g, p) {
      const a = e.ab;
      if (e.y < 20) return;
      a.t += dt;
      if (a.state === "vis") {
        e.intangible = false; e.alpha = Math.min(1, 0.25 + a.t / 0.25);
        if (a.t >= p.visible) { a.state = "hid"; a.t = 0; g.vfx.ring(e.x, e.y, 6, 26, "#b79bff", 0.3, 2); }
      } else {
        e.intangible = true; e.alpha = Math.max(0.07, 1 - a.t / 0.25);
        const k = clamp((a.t - (p.hidden - p.warn)) / p.warn, 0, 1);
        const dy = e.y + p.jump < g.world.height - 40 ? p.jump : 0;
        if (k > 0) e.rings.push({ x: e.x, y: e.y + dy, r: 12 + 16 * (1 - k), color: "#c9b6ff", a: 0.35 + 0.5 * k, w: 2.5, fillA: 0.22 * k });
        if (a.t >= p.hidden) {
          e.y += dy; a.state = "vis"; a.t = 0; e.alpha = 0.3; e.intangible = false;
          g.vfx.ring(e.x, e.y, 4, 30, "#c9b6ff", 0.3, 2.5);
        }
      }
    },
  },

  /* ===== Ceifador Esquivo: desvia suavemente dos tiros do jogador ===== */
  dodge: {
    init(e) { e.ab = { cd: 0, dur: 0, dir: 0 }; },
    update(e, dt, g, p) {
      const a = e.ab;
      a.cd -= dt;
      if (a.dur > 0) {
        a.dur -= dt;
        const bell = Math.sin(Math.PI * clamp(1 - a.dur / p.dur, 0, 1));
        e.x += a.dir * p.speed * (0.25 + 0.75 * bell) * dt;
      }
      if (a.cd > 0 || e.y < 10) return;
      const s2 = p.sense * p.sense;
      for (const s of g.weapons.shots.active) {
        if (s.life <= 0) continue;
        const dx = e.x - s.x, dy = e.y - s.y;
        if (dx * dx + dy * dy > s2) continue;
        const vx = Math.sin(s.ang), vy = -Math.cos(s.ang);
        if (vx * dx + vy * dy <= 0) continue;                                // o tiro está se afastando
        const lateral = Math.abs(dx * vy - dy * vx);                          // distância do inimigo até a linha do tiro
        if (lateral > e.r + s.r + 14) continue;                               // não vai acertar: não desvia
        let dir = dx >= 0 ? 1 : -1;
        if (e.x < 34) dir = 1; else if (e.x > g.world.width - 34) dir = -1;
        a.dir = dir; a.dur = p.dur; a.cd = p.cooldown;
        break;
      }
    },
  },

  /* ===== Couraçado Explosivo: ao ser destruído (ou ao tocar a nave) acende o pavio e explode ===== */
  explosive: {
    init(e) { e.ab = { contact: false }; },
    onKill(e, g, p) {
      g.enemies.bombs.push({ x: e.x, y: e.y, t: 0, fuse: e.ab?.contact ? 0.05 : p.fuse, r: p.radius, dmg: dmgOf(e, p.dmg), sprite: e.def.sprite });
    },
  },

  /* ===== Franco-atirador: mira com uma linha, trava e dispara um tiro rápido ===== */
  sniper: {
    init(e) { e.ab = { state: "idle", cd: rand(0.4, 0.9), t: 0, ang: Math.PI / 2 }; },
    update(e, dt, g, p) {
      const a = e.ab;
      if (e.y < 16 || !g.ship.alive) { a.state = "idle"; return; }
      if (a.state === "idle") {
        a.cd -= dt;
        if (a.cd <= 0) { a.state = "aim"; a.t = 0; Sound.play("beam_warn"); }
        return;
      }
      a.t += dt;
      if (a.t < p.aim - p.lock) a.ang = aimAt(g, e.x, e.y);                   // a mira acompanha a nave e trava no fim
      e.aims.push({ x: e.x, y: e.y + e.r * 0.5, ang: a.ang, k: a.t / p.aim, locked: a.t >= p.aim - p.lock });
      if (a.t >= p.aim) {
        snipeShot(e, g, e.x, e.y + e.r * 0.5, a.ang, p.speed, dmgOf(e, p.dmg));
        a.state = "idle"; a.cd = p.every * e.rateMul;
      }
    },
  },

  /* ===== Interferidor: uma onda amarela cresce até o raio máximo (demarcado); quem a tocar enquanto cresce leva dano e interferência ===== */
  jammer: {
    init(e) { e.ab = { state: "rest", t: rand(0.2, 0.6), hit: false }; },
    update(e, dt, g, p) {
      const a = e.ab, ship = g.ship, col = "#ffd24a";
      if (e.y < 16 || !ship.alive) return;
      a.t -= dt;
      if (a.state === "rest") {
        if (a.t <= 0) { a.state = "wave"; a.t = p.grow; a.hit = false; Sound.play("beam_warn"); }
        return;
      }
      const k = clamp(1 - a.t / p.grow, 0, 1), rc = p.radius * k;
      e.rings.push({ r: p.radius, color: col, a: 0.3, w: 1.8, dash: true });
      e.rings.push({ r: Math.max(6, rc), color: col, a: 0.85 - 0.4 * k, w: 2.8, fillA: 0.07 });
      if (!a.hit && !ship.dash && Math.hypot(ship.x - e.x, ship.y - e.y) <= rc) {     // o jogador entrou na onda em crescimento
        a.hit = true;
        g.jam(p.off);
        g.hurtArea(e.x, e.y, rc + 40, dmgOf(e, p.dmg));
        g.vfx.ring(ship.x, ship.y, 8, 46, col, 0.3, 3);
        Sound.play("shield_break");
      }
      if (a.t <= 0) { a.state = "rest"; a.t = p.rest * e.rateMul; g.vfx.ring(e.x, e.y, 6, 30, col, 0.3, 2); }     // onda no raio máximo: descanso até o próximo ciclo
    },
  },

  /* ===== Varredor: feixe giratório (aviso → varredura de 70°) ===== */
  sweeper: {
    init(e) { e.ab = { cd: rand(0.5, 1.0) }; },
    update(e, dt, g, p) {
      const a = e.ab;
      if (e.y < 16 || !g.ship.alive) return;
      a.cd -= dt;
      if (a.cd > 0) return;
      // todos os Varredores vivos varrem para o MESMO lado (o sentido só é sorteado de novo quando há um só)
      const en = g.enemies, others = en.list.some((o) => o !== e && !o.dead && o.def.ability === "sweeper");
      if (!others || en.sweepSign === undefined) en.sweepSign = Math.random() < 0.5 ? -1 : 1;
      const sign = en.sweepSign, mid = aimAt(g, e.x, e.y), half = (p.arc * DEG) / 2;
      g.enemies.addRay(e, { a0: mid - sign * half, rot: (sign * p.arc * DEG) / p.sweep, w: p.width, dmg: dmgOf(e, p.dmg), warn: p.warn, dur: p.sweep, color: "#6ec6ff" });
      Sound.play("beam_warn");
      a.cd = Math.max(p.cycle * e.rateMul, p.warn + p.sweep + 0.6);
    },
  },

  /* ===== Gravitacional: onda de repulsão (3 s) que empurra a nave e desvia os tiros; só é vulnerável no descanso (2 s) ===== */
  gravity: {
    init(e) { e.ab = { mode: "rest", t: 0.4 }; },
    update(e, dt, g, p) {
      if (e.y < 0) return;
      pushField(e, g, p, e.ab, dt, "#b79bff", p.radius, p.push);
    },
  },

  /* ===== Guardião Orbital: invulnerável enquanto o satélite vive ===== */
  guardian: {
    init(e, g, p, sc) {
      e.parts = [mkPart(e, 0, { kind: "sat", r: p.satR, hp: Math.round(p.satHp * sc.hp), ang: rand(0, TAU) })];
      e.parts[0].cd = rand(0.5, 1.0);
      e.invuln = true;
      e.ab = { respawn: 0 };
    },
    update(e, dt, g, p) {
      const a = e.ab, sat = e.parts[0];
      if (sat.dead) {
        e.invuln = false;
        a.respawn -= dt;
        if (a.respawn <= 0) {                                                  // o satélite renasce
          sat.dead = false; sat.hp = sat.maxHp; sat.cd = 1.2; e.invuln = true;
          g.vfx.ring(e.x, e.y, 8, 42, "#7cf3ff", 0.4, 2.5);
        }
        return;
      }
      e.invuln = true;
      sat.ang += p.spin * dt;
      sat.ox = Math.cos(sat.ang) * p.orbit; sat.oy = Math.sin(sat.ang) * p.orbit * 0.8;
      if (e.y < 16 || !g.ship.alive) return;
      sat.cd -= dt;
      sat.glow = clamp(1 - sat.cd / 0.4, 0, 1);
      if (sat.cd <= 0) {
        const x = e.x + sat.ox, y = e.y + sat.oy;
        g.enemies.bullet(x, y, aimAt(g, x, y), p.speed * e.shotMul, dmgOf(e, p.dmg));
        Sound.play("enemy_shoot");
        sat.cd = p.every * e.rateMul;
      }
    },
    onPartDead(e, part, g, p) { e.invuln = false; e.ab.respawn = p.respawn; },
  },

  /* ===== Rede de Feixes: feixes em X que giram devagar ===== */
  net: {
    init(e) { e.ab = { cd: rand(0.5, 1.0) }; },
    update(e, dt, g, p) {
      const a = e.ab;
      if (e.y < 16 || !g.ship.alive) return;
      a.cd -= dt;
      if (a.cd > 0) return;
      const base = rand(30, 60) * DEG, sign = Math.random() < 0.5 ? -1 : 1;
      for (let i = 0; i < 4; i++) g.enemies.addRay(e, { a0: base + (i * Math.PI) / 2, rot: sign * p.rot, w: p.width, dmg: dmgOf(e, p.dmg), warn: p.warn, dur: p.dur, color: "#ff7ad9" });
      Sound.play("beam_warn");
      a.cd = Math.max(p.every * e.rateMul, p.warn + p.dur + 0.6);
    },
  },

  /* ===== Lançador de Micromísseis: salva de mísseis teleguiados frágeis ===== */
  micro: {
    init(e) { e.ab = { state: "idle", t: rand(0.4, 0.9) }; },
    update(e, dt, g, p) {
      const a = e.ab;
      if (e.y < 16 || !g.ship.alive) { return; }
      a.t -= dt;
      if (a.state === "idle") { if (a.t <= 0) { a.state = "warn"; a.t = p.warn; Sound.play("beam_warn"); } return; }
      const k = clamp(1 - a.t / p.warn, 0, 1);
      e.rings.push({ r: e.r + 4 + (1 - k) * 12, color: "#ff9d5c", a: 0.35 + 0.5 * k, w: 2.5 });
      if (a.t <= 0) {
        microVolley(e, g, { microSpeed: p.speed, microTurn: p.turn }, p.count, dmgOf(e, p.dmg));
        a.state = "idle"; a.t = p.every * e.rateMul;
      }
    },
  },

  /* ===== Adaptador: o escudo se adapta à arma que mais o feriu nos últimos segundos ===== */
  adaptive: {
    init(e) { e.ab = { dom: null }; },
    update(e, dt, g, p) { adaptTick(e, g, p.window); },
    filter(e, dmg, kind, g, p) { return adaptFilter(e, dmg, kind, g, p.resist, p.window); },
  },

  /* ===== Designador: marca zonas perto da nave e chama um raio orbital ===== */
  designator: {
    init(e) { e.ab = { cd: rand(0.6, 1.1) }; },
    update(e, dt, g, p) {
      const a = e.ab;
      if (e.y < 16 || !g.ship.alive) return;
      a.cd -= dt;
      if (a.cd > 0) return;
      const n = Math.random() < 0.5 ? p.zones[0] : p.zones[1];
      markZones(e, g, n, { near: p.near, r: p.r, warn: p.warn, dmg: dmgOf(e, p.dmg) });
      a.cd = p.every * e.rateMul;
    },
  },

  /* ===================================== CHEFES ===================================== */

  /* ===== Colosso: 2 torres (tiros de franco-atirador em sequência) → núcleo → pulso que desliga sistemas ===== */
  colossus: {
    init(e, g, p, sc) {
      e.invuln = true;
      e.parts = [-1, 1].map((sx, i) => mkPart(e, i, { kind: "turret", ox: sx * p.turretX, oy: p.turretY, r: p.turretR, hp: Math.round(p.turretHp * sc.hp) }));
      e.ab = { phase: 1, state: "charge", t: p.charge * 0.3, pulse: "idle", pt: 1.5 };
    },
    gate(e) { return e.ab.phase >= 2; },
    update(e, dt, g, p) {
      const a = e.ab, ship = g.ship;
      if (e.y < 60 || !ship.alive) return;
      const alive = e.parts.filter((t) => !t.dead);
      if (a.phase === 1) {
        e.invuln = true;
        a.t += dt;
        if (a.state === "charge") {
          for (const tr of alive) tr.glow = clamp(a.t / p.charge, 0, 1);
          if (a.t >= p.charge) { a.state = "fire"; a.t = 0; for (const tr of alive) { tr.fired = false; tr.glow = 0; } }
        } else {
          let pending = 0;
          alive.forEach((tr, i) => {
            const ti = a.t - i * p.gap;
            if (ti <= 0) { pending++; return; }
            if (!tr.fired) {
              pending++;
              if (ti < p.aim - p.lock) tr.aimAng = aimAt(g, tr.x, tr.y);
              e.aims.push({ x: tr.x, y: tr.y, ang: tr.aimAng, k: ti / p.aim, locked: ti >= p.aim - p.lock });
              if (ti >= p.aim) { snipeShot(e, g, tr.x, tr.y, tr.aimAng, p.shotSpeed, dmgOf(e, p.shotDmg)); tr.fired = true; }
            }
          });
          if (!pending) { a.state = "charge"; a.t = 0; }
        }
        return;
      }
      // fases 2 e 3: núcleo exposto
      e.invuln = false;
      if (a.phase === 2 && e.hp < e.maxHp * p.phase3) { a.phase = 3; a.pulse = "idle"; a.pt = 1.2; phaseStart(e, g, "Fase 3 · Pulso de interferência"); }
      if (a.phase === 3) {
        const pr = Math.max(p.pulseRadius, g.world.height * p.pulseRadiusH);   // metade da altura da tela: só a parte de baixo é segura
        a.pt -= dt;
        if (a.pulse === "idle") {
          if (a.pt <= 0) { a.pulse = "warn"; a.pt = p.pulseWarn; Sound.play("beam_warn"); }
        } else {
          const k = clamp(1 - a.pt / p.pulseWarn, 0, 1);
          e.rings.push({ r: pr, color: "#ffd24a", a: 0.3, w: 1.8, dash: true });
          e.rings.push({ r: pr * k, color: "#ffd24a", a: 0.35 + 0.5 * k, w: 3, fillA: 0.06 * k });
          if (a.pt <= 0) {
            g.vfx.ring(e.x, e.y, 10, pr, "#ffd24a", 0.45, 5);
            Sound.play("shield_break");
            if (!ship.dash && Math.hypot(ship.x - e.x, ship.y - e.y) <= pr) g.jam(p.off);
            a.pulse = "idle"; a.pt = p.pulseEvery - p.pulseWarn;
          }
        }
      }
    },
    onPartDead(e, part, g, p) {
      if (e.parts.every((t) => t.dead) && e.ab.phase === 1) {
        e.ab.phase = 2; e.invuln = false;
        phaseStart(e, g, "Fase 2 · Núcleo exposto");
      }
    },
  },

  /* ===== Singularidade: repulsão + some/reaparece → satélites (invulnerável) → teia de lasers ===== */
  singularity: {
    init(e) { e.ab = { field: { mode: "rest", t: 1.5 }, phase: 1, hidden: false, cy: 0, destX: 0, web: 2.2, webWarn: false, sats: false }; },
    gate(e) {
      const a = e.ab;
      return a.phase !== 3 && !a.hidden && !(a.phase === 2 && e.parts?.some((t) => !t.dead));   // fase 3: só os feixes da teia, sem tiros normais
    },
    update(e, dt, g, p) {
      const a = e.ab, ship = g.ship;
      if (e.y < 60 || !ship.alive) return;
      const hpf = e.hp / e.maxHp;
      if (a.phase === 1 && hpf < p.phase2) {
        a.phase = 2; a.hidden = false; e.intangible = false; e.alpha = 1;
        e.parts = [0, 1, 2].map((i) => mkPart(e, i, { kind: "sat", r: p.satR, hp: Math.round(p.satHp * e.hpMul), ang: (i * TAU) / 3, cd: 0.6 + i * 0.8 }));
        e.invuln = true;
        phaseStart(e, g, "Fase 2 · Satélites");
      }
      const satsAlive = !!e.parts && e.parts.some((t) => !t.dead);
      if (a.phase === 2 && !satsAlive && hpf < p.phase3) { a.phase = 3; a.web = 1.4; phaseStart(e, g, "Fase 3 · Teia de lasers"); }

      // satélites: orbitam e atiram em turnos
      if (e.parts) for (const sat of e.parts) {
        if (sat.dead) continue;
        sat.ang += p.satSpin * dt;
        sat.ox = Math.cos(sat.ang) * p.satOrbit; sat.oy = Math.sin(sat.ang) * p.satOrbit * 0.8;
        sat.cd -= dt; sat.glow = clamp(1 - sat.cd / 0.4, 0, 1);
        if (sat.cd <= 0) {
          const x = e.x + sat.ox, y = e.y + sat.oy;
          g.enemies.bullet(x, y, aimAt(g, x, y), p.satSpeed * e.shotMul, dmgOf(e, p.satDmg));
          Sound.play("enemy_shoot");
          sat.cd = p.satEvery * e.rateMul;
        }
      }

      // gravidade (fases 1 e 3, ou depois dos satélites) e ciclo some/reaparece (fase 1 e fase 2 sem satélites)
      if (!satsAlive && !a.hidden) {
        pushField(e, g, p, a.field, dt, "#ff7ad9", p.pushRadius, p.push);
      }
      if (a.phase !== 3 && !satsAlive) {
        a.cy += dt;
        if (!a.hidden) {
          e.alpha = Math.min(1, e.alpha + dt * 3); e.intangible = false;
          if (a.cy >= 2.2 * p.vanishEvery) { a.hidden = true; a.cy = 0; a.destX = randBossX(e, g, p); e.intangible = true; g.vfx.ring(e.x, e.y, 8, 60, "#ff7ad9", 0.35, 3); Sound.play("shield_up"); }
        } else {
          e.alpha = Math.max(0.06, e.alpha - dt * 4);
          const k = clamp((a.cy - 0.9) / 0.5, 0, 1);
          if (k > 0) e.rings.push({ x: a.destX, y: e.y, r: 20 + 40 * (1 - k), color: "#ff7ad9", a: 0.3 + 0.5 * k, w: 3, fillA: 0.18 * k });
          if (a.cy >= 1.4) {
            a.hidden = false; a.cy = 0; e.baseX = a.destX; e.hold = 0; e.x = a.destX; e.alpha = 0.3; e.intangible = false;
            g.vfx.ring(e.x, e.y, 6, 70, "#ff7ad9", 0.35, 3);
          }
        }
      } else if (a.phase === 3) { e.alpha = 1; e.intangible = false; }

      // fase 3: teia de lasers com corredores seguros entre os feixes
      if (a.phase === 3) {
        a.web -= dt;
        if (a.web <= 0) {
          const sign = Math.random() < 0.5 ? -1 : 1;
          for (let i = 0; i < 6; i++) g.enemies.addRay(e, { a0: (90 + (i - 2.5) * 28) * DEG, rot: sign * 0.3, w: p.beamWidth, dmg: dmgOf(e, p.beamDmg), warn: p.webWarn, dur: p.webDur, color: "#ff7ad9" });
          Sound.play("beam_warn");
          a.web = Math.max(p.webEvery * e.rateMul, p.webWarn + p.webDur + 0.9);   // nunca duas teias ao mesmo tempo (os corredores seguros ficariam ilegíveis)
        }
      }
    },
    onPartDead(e, part, g, p) {
      if (e.parts.every((t) => t.dead)) { e.invuln = false; g.vfx.ring(e.x, e.y, 10, 90, "#ff7ad9", 0.4, 4); }
    },
  },

  /* ===== Hegemon: salvas de micromísseis, escudo adaptativo e designação orbital ===== */
  hegemon: {
    init(e) { e.ab = { phase: 1, state: "idle", t: 1.2, zt: 2, dom: null }; },
    update(e, dt, g, p) {
      const a = e.ab, ship = g.ship;
      if (e.y < 60 || !ship.alive) return;
      const hpf = e.hp / e.maxHp;
      if (a.phase === 1 && hpf < p.phase2) { a.phase = 2; a.t = Math.max(a.t, 2.5); phaseStart(e, g, "Fase 2 · Escudo adaptativo"); }
      if (a.phase === 2 && hpf < p.phase3) { a.phase = 3; a.zt = 1.6; phaseStart(e, g, "Fase 3 · Designação orbital"); }
      if (a.phase >= 2) adaptTick(e, g, p.window);

      const count = a.phase === 3 ? Math.round(p.micro * 0.7) : p.micro;
      const every = a.phase === 1 ? p.microEvery : p.microEvery2;
      a.t -= dt;
      if (a.state === "idle") { if (a.t <= 0) { a.state = "warn"; a.t = p.microWarn; Sound.play("beam_warn"); } }
      else {
        const k = clamp(1 - a.t / p.microWarn, 0, 1);
        e.rings.push({ r: e.r + 6 + (1 - k) * 14, color: "#ff9d5c", a: 0.35 + 0.5 * k, w: 3 });
        if (a.t <= 0) { microVolley(e, g, p, count, dmgOf(e, p.microDmg)); a.state = "idle"; a.t = every * e.rateMul; }
      }
      if (a.phase === 3) {
        a.zt -= dt;
        if (a.zt <= 0) { markZones(e, g, p.zones, { near: p.zoneNear, r: p.zoneR, warn: p.zoneWarn, dmg: dmgOf(e, p.zoneDmg) }); a.zt = p.zoneEvery * e.rateMul; }
      }
    },
    filter(e, dmg, kind, g, p) {
      if (e.ab.phase < 2) return dmg;
      return adaptFilter(e, dmg, kind, g, e.ab.phase === 3 ? p.resist3 : p.resist, p.window);
    },
  },
};
