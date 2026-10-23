/* ==========================================================================
   SupportSystem.js — MÓDULO DE SUPORTE (slot traseiro de cada nave).
   Ciclo: o módulo cria o seu efeito (escudo / drone / ímã) → o efeito dura até acabar (destruído, esgotado ou fim do tempo) →
   só então começa a recarga (SUPPORTS[id].cooldown, 15 s) → cria o efeito de novo. Sem módulo instalado, nada acontece.
   Os tipos (KINDS) são registros: para um novo módulo basta adicionar uma entrada em data/Supports.js e um KIND aqui.
   A colisão do escudo/drones com os ataques inimigos é chamada pelo CollisionSystem (shield*, collide).
   ========================================================================== */
import { CONFIG } from "./data/Config.js";
import { WEAPONS } from "./data/Weapons.js";
import { SUPPORTS } from "./data/Supports.js";
import { Art } from "./Art.js";
import { Sound } from "./Audio.js";

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const FIRST_LAUNCH = 1.0;     // atraso (s) entre instalar o módulo e o primeiro lançamento

/* Comportamento de cada tipo. launch() devolve a "entidade" ativa; update() a atualiza (chame sys.end() para terminar). */
const KINDS = {
  shield: {
    launch(sys, def) {
      const ship = sys.game.ship, sp = Art.get(ship.def.sprite);
      const r = Math.max(Math.max(sp.w, sp.h) * 0.55, ship.hitRadius * CONFIG.ship.hitWidthMul + 10);   // sempre envolve a área de acerto
      Sound.play("shield_up");
      return { kind: "shield", hp: sys.stats.charges, max: sys.stats.charges, t: 0, flash: 0, r };
    },
    update(sys, e, dt) { e.t += dt; if (e.flash > 0) e.flash -= dt; },
    progress: (e) => e.hp / e.max,
  },

  attackDrone: {
    launch(sys, def) {
      const d = sys.newDrone("attackDrone", 0.7);
      d.fireCd = 0.5; d.aim = 0;
      Sound.play("drone_launch");
      return d;
    },
    update(sys, d, dt) {
      const g = sys.game, st = sys.stats;
      sys.moveDrone(d, dt);
      // alvo: inimigo vivo, dentro da tela, mais próximo do drone e ao alcance
      let best = null, bd = st.range * st.range;
      for (const e of g.enemies.list) {
        if (e.dead || e.y < 8) continue;
        const dx = e.x - d.x, dy = e.y - d.y, q = dx * dx + dy * dy;
        if (q < bd) { bd = q; best = e; }
      }
      if (best) d.aim = Math.atan2(best.x - d.x, -(best.y - d.y));
      else d.aim += (0 - d.aim) * Math.min(1, 6 * dt);     // sem alvo: volta a apontar para a frente
      d.fireCd -= dt;
      if (best && d.fireCd <= 0 && d.t > 0.35) {
        d.fireCd = st.interval;
        const s = g.weapons.shots.acquire();
        if (s) {
          s.x = d.x; s.y = d.y; s.ang = d.aim; s.accel = false; s.maxSp = s.sp = st.speed; s.life = st.life;
          s.dmg = st.damage; s.r = 4; s.pierce = 0; s.homing = 0; s.blast = 0; s.kind = "basic"; s.color = sys.def.color;
          s.hitN = 0; s.special = false; s.cancel = false; s.cancelLeft = 0; s.redirect = 0;
          Sound.play("drone_shot");
        }
      }
    },
    progress: () => 1,
  },

  healDrone: {
    launch(sys, def) {
      const d = sys.newDrone("healDrone", -0.8);
      d.healed = 0; d.acc = 0; d.healing = false; d.fxT = 0;
      Sound.play("drone_launch");
      return d;
    },
    canLaunch: (sys) => sys.game.ship.hp < sys.game.ship.stats.maxHp,     // só é lançado com a nave ferida (<100% da vida)
    update(sys, d, dt) {
      const g = sys.game, ship = g.ship, st = sys.stats;
      sys.moveDrone(d, dt);
      const cap = st.healCap * ship.stats.maxHp;          // total (em PONTOS de vida) que este drone ainda pode recuperar
      d.healing = d.t > 0.5 && ship.hp < ship.stats.maxHp;
      if (d.healing) {
        d.acc += st.healPerSec * ship.stats.maxHp * dt;
        const n = Math.min(Math.floor(d.acc), Math.ceil(cap - d.healed));
        if (n >= 1) {
          d.acc -= n;
          d.healed += ship.heal(n);                       // só conta a vida de fato recuperada (não a "vida atual")
        }
        d.fxT -= dt;
        if (d.fxT <= 0) { d.fxT = 0.22; g.vfx.spark(ship.x + (Math.random() - 0.5) * 24, ship.y + (Math.random() - 0.5) * 24, sys.def.color, 2, 34, 2.4, 0.6); }
      } else d.acc = 0;
      if (d.healed >= cap - 1e-6) {                       // cumpriu a cota: vai embora
        g.vfx.ring(d.x, d.y, 6, 30, sys.def.color, 0.35, 2.5);
        Sound.play("heal");
        sys.end();
      } else if (ship.hp >= ship.stats.maxHp) {           // vida cheia (curou, coração, regeneração…): vai embora e a recarga começa
        g.vfx.ring(d.x, d.y, 6, 30, sys.def.color, 0.35, 2.5);
        sys.end();
      }
    },
    progress: (d, sys) => 1 - Math.min(1, d.healed / (sys.stats.healCap * sys.game.ship.stats.maxHp)),
  },

  // Ímã: por `duration` segundos, as estrelas e os itens de vida da arena são puxados para a nave. A atração em si é aplicada
  // pelo PickupSystem (lê sys.magnet); o desenho (anel fino + rastro curto nos itens puxados) fica no Renderer.
  magnet: {
    launch(sys, def) {
      const st = sys.stats;
      Sound.play("drone_launch");
      return { kind: "magnet", t: 0, left: st.duration, max: st.duration, range: st.range, accel: st.accel, maxSpeed: st.pullSpeed };
    },
    update(sys, e, dt) { e.t += dt; e.left -= dt; if (e.left <= 0) sys.end(); },
    progress: (e) => e.left / e.max,
  },
};

const DRONE_KINDS = new Set(["attackDrone", "healDrone"]);

export class SupportSystem {
  constructor(game) { this.game = game; this.reset(null); }

  reset(shipDef) {
    this.slotDef = shipDef?.support ?? null;     // { id, label, x, y, menuDir } — o slot traseiro desta nave
    this.moduleId = null;
    this.stats = null;
    this.cd = 0;                                 // recarga restante (s)
    this.fx = null;                              // efeito ativo: escudo ou drone
  }

  get def() { return this.moduleId ? SUPPORTS[this.moduleId] : null; }
  get shield() { return this.fx?.kind === "shield" && this.fx.hp > 0 ? this.fx : null; }
  get drone() { return this.fx && DRONE_KINDS.has(this.fx.kind) ? this.fx : null; }
  get magnet() { return this.fx?.kind === "magnet" ? this.fx : null; }

  /* ------------------------------ instalar / remover ------------------------------ */
  // Custo = Config.economy.supportCostMul × custo médio das armas (arredondado a múltiplos de 5).
  installCost() {
    const costs = Object.values(WEAPONS).map((w) => w.cost);
    const avg = costs.reduce((a, b) => a + b, 0) / costs.length;
    return Math.round((avg * CONFIG.economy.supportCostMul) / 5) * 5;
  }

  install(id) {
    if (!this.slotDef || !SUPPORTS[id]) return { ok: false, reason: "invalid" };
    if (this.moduleId) return { ok: false, reason: "occupied" };
    const cost = this.installCost(id);
    if (!this.game.currency.spend(cost)) return { ok: false, reason: "coins", cost };
    this.moduleId = id;
    this.stats = { ...SUPPORTS[id].base };
    this.cd = FIRST_LAUNCH; this.fx = null;
    return { ok: true, cost };
  }

  // Remove o módulo (sem reembolso). O escudo/drone ativo some junto.
  remove() {
    if (!this.moduleId) return { ok: false };
    this.moduleId = null; this.stats = null; this.fx = null; this.cd = 0;
    return { ok: true };
  }

  /* ------------------------------ ciclo ------------------------------ */
  update(dt) {
    if (!this.moduleId || !this.game.ship.alive) return;
    if (!this.fx) {
      this.cd = Math.max(0, this.cd - dt);
      const kind = KINDS[this.def.kind];
      // recarga pronta: lança (alguns módulos esperam uma condição — ex.: o drone de reparo só sai com a nave ferida)
      if (this.cd <= 0 && (!kind.canLaunch || kind.canLaunch(this))) this.fx = kind.launch(this, this.def);
      return;
    }
    KINDS[this.fx.kind].update(this, this.fx, dt);
  }

  end() { this.fx = null; this.cd = this.def.cooldown; }

  // Para o HUD: { id, color, active, p } — p = vida restante do efeito (ativo) ou progresso da recarga (0..1)
  hud() {
    const def = this.def;
    if (!def) return null;
    if (this.fx) return { id: def.id, color: def.color, active: true, p: clamp(KINDS[this.fx.kind].progress(this.fx, this), 0, 1) };
    return { id: def.id, color: def.color, active: false, p: clamp(1 - this.cd / def.cooldown, 0, 1) };
  }

  /* ------------------------------ drones ------------------------------ */
  newDrone(kind, dir) {
    const ship = this.game.ship, sd = this.slotDef;
    return { kind, x: ship.x + sd.x, y: ship.y + sd.y, vx: 0, vy: 0, t: 0, ang: Math.PI / 2, dir, r: 9, hp: 1, aim: 0, bob: Math.random() * 6 };
  }

  // Segue a nave em órbita (começa no slot traseiro e "voa" até a órbita).
  // Movimento por MOLA AMORTECIDA: o drone acelera aos poucos em direção ao ponto de órbita, então um movimento rápido da nave
  // não o arrasta de imediato — ele vai atrás suavemente e desacelera ao chegar (sem tranco). `follow` controla a suavidade.
  moveDrone(d, dt) {
    const ship = this.game.ship, w = this.game.world, st = this.stats;
    d.t += dt; d.bob += dt;
    d.ang += st.orbitSpeed * d.dir * dt;
    const tx = ship.x + Math.cos(d.ang) * st.orbit, ty = ship.y + Math.sin(d.ang) * st.orbit * 0.75 - 4;
    const wn = st.follow, damp = 2 * 0.85 * wn;               // frequência natural e amortecimento (0,85 = quase crítico)
    d.vx += ((tx - d.x) * wn * wn - damp * d.vx) * dt;
    d.vy += ((ty - d.y) * wn * wn - damp * d.vy) * dt;
    const sp = Math.hypot(d.vx, d.vy);
    if (sp > st.maxSpeed) { d.vx *= st.maxSpeed / sp; d.vy *= st.maxSpeed / sp; }
    d.x += d.vx * dt; d.y += d.vy * dt;
    if (d.x < 8 || d.x > w.width - 8) { d.x = clamp(d.x, 8, w.width - 8); d.vx = 0; }
    if (d.y < 8 || d.y > w.height - 8) { d.y = clamp(d.y, 8, w.height - 8); d.vy = 0; }
  }

  destroyDrone() {
    const g = this.game, d = this.drone;
    if (!d) return;
    g.vfx.explosion(d.x, d.y, 14, this.def.color);
    Sound.play("explode");
    this.end();
  }

  /* ------------------------------ colisões (chamadas pelo CollisionSystem) ------------------------------ */
  // Escudo: devolvem true se ABSORVERAM o ataque (a nave não leva dano). Durante a esquiva o escudo "atravessa" tudo.
  hitShield(sh, cost, x, y) {
    const g = this.game;
    sh.hp -= cost; sh.flash = 0.25;
    g.vfx.spark(x, y, this.def.color, 5, 150, 2.2, 0.3);
    if (sh.hp <= 0) {
      g.vfx.ring(g.ship.x, g.ship.y, sh.r * 0.8, sh.r * 1.5, this.def.color, 0.4, 3);
      Sound.play("shield_break");
      this.end();
    } else Sound.play("shield_hit");
  }

  shieldShot(b) {
    const sh = this.shield, ship = this.game.ship;
    if (!sh || ship.dash) return false;
    const rr = sh.r + b.r, dx = b.x - ship.x, dy = b.y - ship.y;
    if (dx * dx + dy * dy > rr * rr) return false;
    b.life = 0;
    this.hitShield(sh, 1, b.x, b.y);
    return true;
  }

  // Feixe: custa 1 carga e o escudo cobre o resto DESSE feixe (b.shielded), mesmo que quebre.
  shieldBeam(b) {
    if (b.shielded) return true;
    const sh = this.shield, ship = this.game.ship;
    if (!sh || ship.dash) return false;
    if (Math.abs(ship.x - b.x) > b.w / 2 + sh.r || ship.y + sh.r < b.y) return false;
    b.shielded = true;
    this.hitShield(sh, 1, ship.x, ship.y - sh.r * 0.6);
    return true;
  }

  // Colisão com inimigo: derruba o escudo (ramCost) e dá um instante de invulnerabilidade à nave.
  shieldRam(e) {
    const sh = this.shield, ship = this.game.ship;
    if (!sh || ship.dash) return false;
    const rr = e.r * 0.85 + sh.r, dx = e.x - ship.x, dy = e.y - ship.y;
    if (dx * dx + dy * dy > rr * rr) return false;
    this.hitShield(sh, this.stats.ramCost, ship.x + dx * 0.6, ship.y + dy * 0.6);
    ship.iframes = Math.max(ship.iframes, CONFIG.ship.hitIframes);
    return true;
  }

  // Drones: somem com 1 tiro inimigo, 1 feixe ou 1 colisão. O drone de reparo é invulnerável.
  collide() {
    const d = this.drone, g = this.game;
    if (!d || d.kind === "healDrone") return;
    for (const b of g.enemies.shots.active) {
      if (b.life <= 0) continue;
      const rr = d.r + b.r, dx = b.x - d.x, dy = b.y - d.y;
      if (dx * dx + dy * dy > rr * rr) continue;
      b.life = 0;
      return this.destroyDrone();
    }
    for (const b of g.enemies.beams) {
      if (b.fired && Math.abs(d.x - b.x) <= b.w / 2 + d.r && d.y + d.r >= b.y) return this.destroyDrone();
    }
    for (const e of g.enemies.list) {
      if (e.dead) continue;
      const rr = e.r * 0.85 + d.r, dx = e.x - d.x, dy = e.y - d.y;
      if (dx * dx + dy * dy <= rr * rr) return this.destroyDrone();
    }
  }
}
