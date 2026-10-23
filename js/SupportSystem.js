/* ==========================================================================
   SupportSystem.js — MÓDULO DE SUPORTE (slot traseiro de cada nave).
   Ciclo: o módulo cria o seu efeito (escudo / drone / ímã / clone) → o efeito dura até acabar (destruído, esgotado ou fim do tempo) →
   só então começa a recarga (stats.cooldown) → cria o efeito de novo. Sem módulo instalado, nada acontece.
   Cada módulo tem 3 melhorias (data/Supports.js → levels) que alteram vários atributos de uma vez.
   Os tipos (KINDS) são registros: para um novo módulo basta adicionar uma entrada em data/Supports.js e um KIND aqui.
   A colisão do escudo/drones/clone com os ataques inimigos é chamada pelo CollisionSystem (shield*, collide).
   ========================================================================== */
import { CONFIG } from "./data/Config.js";
import { ENEMIES } from "./data/Enemies.js";
import { SUPPORTS, supportStats, upgradeCost } from "./data/Supports.js";
import { Art } from "./Art.js";
import { Sound } from "./Audio.js";

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const FIRST_LAUNCH = 1.0;     // atraso (s) entre instalar o módulo e o primeiro lançamento
const RAM_SELF_DAMAGE = 40;   // dano que o inimigo leva ao bater no clone (igual ao da nave, CollisionSystem)
const DRONE_RAM_IFRAMES = 0.6;// invulnerabilidade curta do drone de ataque depois de uma colisão/feixe (para não perder toda a vida de uma vez)

// Slot "central" da nave, sem depender do id: entre os slots mais próximos do eixo vertical da nave (|x| mínimo), o mais
// próximo do centro do casco. (Vanguarda → casco · Tanque → frente · Espectro → centro.)
export function centerSlot(slots) {
  let best = null, bx = Infinity, bd = Infinity;
  for (const s of slots) {
    const ax = Math.abs(s.def.x), d = Math.hypot(s.def.x, s.def.y);
    if (!best || ax < bx - 1 || (ax <= bx + 1 && d < bd)) { best = s; bx = ax; bd = d; }
  }
  return best;
}

// Dano por tiro do drone de ataque: acompanha as ondas — metade da vida de um inimigo básico da onda atual (arredondada para
// cima), então 2 tiros eliminam um básico em qualquer onda. Nunca abaixo do dano base; as melhorias multiplicam o resultado.
function droneDamage(sys) {
  const g = sys.game, st = sys.stats, wave = Math.max(1, g.waves.wave);
  const basicHp = Math.round(ENEMIES.basic.hp * g.enemies.scaling(wave).hp);
  return Math.max(st.damage, Math.ceil(basicHp / 2)) * st.damageMul;
}

/* Comportamento de cada tipo. launch() devolve a "entidade" ativa; update() a atualiza (chame sys.end() para terminar).
   onUpgrade() (opcional) ajusta o efeito em andamento quando o jogador compra uma melhoria. */
const KINDS = {
  shield: {
    launch(sys, def) {
      const ship = sys.game.ship, sp = Art.get(ship.def.sprite);
      const r = Math.max(Math.max(sp.w, sp.h) * 0.55, ship.hitRadius * CONFIG.ship.hitWidthMul + 10);   // sempre envolve a área de acerto
      Sound.play("shield_up");
      return { kind: "shield", hp: sys.stats.charges, max: sys.stats.charges, t: 0, flash: 0, r };
    },
    update(sys, e, dt) { e.t += dt; if (e.flash > 0) e.flash -= dt; },
    onUpgrade(sys, e) { const d = sys.stats.charges - e.max; if (d > 0) { e.max += d; e.hp += d; } },
    progress: (e) => e.hp / e.max,
  },

  attackDrone: {
    launch(sys, def) {
      const fx = { kind: "attackDrone", t: 0, drones: [] };
      for (let i = 0; i < sys.stats.drones; i++) fx.drones.push(sys.newDrone("attackDrone", 0.7, i, sys.stats.drones));
      Sound.play("drone_launch");
      return fx;
    },
    update(sys, fx, dt) {
      const g = sys.game, st = sys.stats;
      fx.t += dt;
      for (const d of fx.drones.slice()) {
        sys.moveDrone(d, dt);
        if (d.iframes > 0) d.iframes -= dt;
        if (d.flash > 0) d.flash -= dt;
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
            s.dmg = droneDamage(sys); s.r = 4; s.pierce = 0; s.homing = 0; s.blast = 0; s.kind = "basic"; s.color = sys.def.color;
            s.hitN = 0; s.special = false; s.cancel = false; s.cancelLeft = 0; s.redirect = 0;
            Sound.play("drone_shot");
          }
        }
      }
    },
    onUpgrade(sys, fx) {
      const st = sys.stats;
      for (const d of fx.drones) if (st.hp > d.maxHp) { d.hp += st.hp - d.maxHp; d.maxHp = st.hp; }   // vida extra vale já para o drone em campo
      while (fx.drones.length < st.drones) fx.drones.push(sys.newDrone("attackDrone", 0.7, fx.drones.length, st.drones));
    },
    progress: () => 1,
  },

  healDrone: {
    launch(sys, def) {
      const fx = { kind: "healDrone", t: 0, drones: [] };
      for (let i = 0; i < sys.stats.drones; i++) fx.drones.push(sys.newHealDrone(i, sys.stats.drones));
      Sound.play("drone_launch");
      return fx;
    },
    canLaunch: (sys) => sys.game.ship.hp < sys.game.ship.stats.maxHp,     // só é lançado com a nave ferida (<100% da vida)
    update(sys, fx, dt) {
      const g = sys.game, ship = g.ship, st = sys.stats;
      fx.t += dt;
      const cap = st.healCap * ship.stats.maxHp;          // total (em PONTOS de vida) que cada drone ainda pode recuperar
      for (const d of fx.drones.slice()) {
        sys.moveDrone(d, dt);
        d.healing = d.t > 0.5 && ship.hp < ship.stats.maxHp;
        if (d.healing) {
          d.acc += st.healPerSec * ship.stats.maxHp * dt;
          const n = Math.min(Math.floor(d.acc), Math.ceil(cap - d.healed));
          if (n >= 1) {
            d.acc -= n;
            d.healed += ship.heal(n);                     // só conta a vida de fato recuperada (não a "vida atual")
          }
          d.fxT -= dt;
          if (d.fxT <= 0) { d.fxT = 0.22; g.vfx.spark(ship.x + (Math.random() - 0.5) * 24, ship.y + (Math.random() - 0.5) * 24, sys.def.color, 2, 34, 2.4, 0.6); }
        } else d.acc = 0;
        if (d.healed >= cap - 1e-6) {                     // cumpriu a cota: vai embora
          g.vfx.ring(d.x, d.y, 6, 30, sys.def.color, 0.35, 2.5);
          Sound.play("heal");
          sys.dismissDrone(d);
        } else if (ship.hp >= ship.stats.maxHp) {         // vida cheia (curou, coração, regeneração…): vai embora e a recarga começa
          g.vfx.ring(d.x, d.y, 6, 30, sys.def.color, 0.35, 2.5);
          sys.dismissDrone(d);
        }
      }
    },
    onUpgrade(sys, fx) { while (fx.drones.length < sys.stats.drones) fx.drones.push(sys.newHealDrone(fx.drones.length, sys.stats.drones)); },
    progress: (fx, sys) => {
      if (!fx.drones.length) return 0;
      const cap = sys.stats.healCap * sys.game.ship.stats.maxHp;
      return fx.drones.reduce((a, d) => a + 1 - Math.min(1, d.healed / cap), 0) / fx.drones.length;
    },
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
    onUpgrade(sys, e) { const st = sys.stats; e.left += Math.max(0, st.duration - e.max); e.max = Math.max(e.max, st.duration); e.accel = st.accel; e.maxSpeed = st.pullSpeed; },
    progress: (e) => e.left / e.max,
  },

  // Clone holográfico: espelha a nave em torno do centro da tela (x invertido, y igual), com metade da vida e do dano.
  // Atira com a arma do slot central (nível 3: com as armas de todos os slots), usando os atributos atuais dessas armas.
  // Leva dano como a nave (CollisionSystem não o vê: SupportSystem.collide). Destruído → recarga (45 s, 30 s no nível 2).
  hologram: {
    launch(sys, def) {
      const g = sys.game, ship = g.ship, st = sys.stats;
      const max = Math.max(1, Math.round(ship.stats.maxHp * st.hpMul));
      const c = { kind: "hologram", t: 0, x: g.world.width - ship.x, y: ship.y, lean: 0, hp: max, max, iframes: 0, flash: 0, guns: {} };
      g.vfx.ring(c.x, c.y, 8, 46, def.color, 0.4, 2.5);
      Sound.play("shield_up");
      return c;
    },
    update(sys, c, dt) {
      const g = sys.game, ship = g.ship, st = sys.stats;
      c.t += dt;
      if (c.iframes > 0) c.iframes -= dt;
      if (c.flash > 0) c.flash -= dt;
      c.x = g.world.width - ship.x;       // horizontal invertido em relação ao centro da tela
      c.y = ship.y;                       // vertical igual ao da nave
      c.lean = -ship.lean;
      if (c.t < 0.45) return;             // se materializando: ainda não atira
      const slots = st.allSlots ? g.weapons.slotList : [centerSlot(g.weapons.slotList)];
      const o = { x: c.x, y: c.y, dmgMul: st.dmgMul };
      for (const slot of slots) {
        if (!slot?.weaponId) continue;
        const state = (c.guns[slot.def.id] ??= { cd: 0.15, burstLeft: 0, burstT: 0 });
        g.weapons.tickSlot(slot, state, dt, o);
      }
    },
    onUpgrade(sys, c) {
      const max = Math.max(1, Math.round(sys.game.ship.stats.maxHp * sys.stats.hpMul));
      if (max > c.max) { c.hp += max - c.max; c.max = max; }
    },
    progress: (c) => c.hp / c.max,
  },
};

const DRONE_KINDS = new Set(["attackDrone", "healDrone"]);

export class SupportSystem {
  constructor(game) { this.game = game; this.reset(null); }

  reset(shipDef) {
    this.slotDef = shipDef?.support ?? null;     // { id, label, x, y, menuDir } — o slot traseiro desta nave
    this.moduleId = null;
    this.level = 0;                              // melhorias compradas (0..3)
    this.stats = null;
    this.cd = 0;                                 // recarga restante (s)
    this.fx = null;                              // efeito ativo: escudo, drones, ímã ou clone
  }

  get def() { return this.moduleId ? SUPPORTS[this.moduleId] : null; }
  get shield() { return this.fx?.kind === "shield" && this.fx.hp > 0 ? this.fx : null; }
  get drones() { return this.fx && DRONE_KINDS.has(this.fx.kind) ? this.fx.drones : []; }
  get magnet() { return this.fx?.kind === "magnet" ? this.fx : null; }
  get clone() { return this.fx?.kind === "hologram" ? this.fx : null; }

  /* ------------------------------ instalar / melhorar / remover ------------------------------ */
  installCost(id) { return SUPPORTS[id].cost; }

  install(id) {
    if (!this.slotDef || !SUPPORTS[id]) return { ok: false, reason: "invalid" };
    if (this.moduleId) return { ok: false, reason: "occupied" };
    const cost = this.installCost(id);
    if (!this.game.currency.spend(cost)) return { ok: false, reason: "coins", cost };
    this.moduleId = id;
    this.level = 0;
    this.stats = supportStats(id, 0);
    this.cd = FIRST_LAUNCH; this.fx = null;
    return { ok: true, cost };
  }

  // Custo do próximo nível (null = nível máximo).
  nextUpgradeCost() { return this.moduleId && this.level < 3 ? upgradeCost(this.moduleId, this.level) : null; }

  // Compra o próximo nível (os atributos mudam já, inclusive no efeito em andamento).
  upgrade() {
    if (!this.moduleId) return { ok: false, reason: "invalid" };
    if (this.level >= 3) return { ok: false, reason: "max" };
    const cost = this.nextUpgradeCost();
    if (!this.game.currency.spend(cost)) return { ok: false, reason: "coins", cost };
    this.level++;
    this.stats = supportStats(this.moduleId, this.level);
    if (this.fx) KINDS[this.fx.kind].onUpgrade?.(this, this.fx);
    return { ok: true, cost, node: this.def.levels[this.level - 1] };
  }

  // Remove o módulo (sem reembolso; as melhorias se perdem). O escudo/drone/clone ativo some junto.
  remove() {
    if (!this.moduleId) return { ok: false };
    this.moduleId = null; this.level = 0; this.stats = null; this.fx = null; this.cd = 0;
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

  end() { this.fx = null; this.cd = this.stats.cooldown; }

  // Para o HUD: { id, color, active, p } — p = vida restante do efeito (ativo) ou progresso da recarga (0..1)
  hud() {
    const def = this.def;
    if (!def) return null;
    if (this.fx) return { id: def.id, color: def.color, active: true, p: clamp(KINDS[this.fx.kind].progress(this.fx, this), 0, 1) };
    return { id: def.id, color: def.color, active: false, p: clamp(1 - this.cd / this.stats.cooldown, 0, 1) };
  }

  /* ------------------------------ drones ------------------------------ */
  // i/n: posição do drone no grupo (com 2 drones, ficam em lados opostos da órbita)
  newDrone(kind, dir, i = 0, n = 1) {
    const ship = this.game.ship, sd = this.slotDef, hp = this.stats.hp ?? 1;
    return { kind, x: ship.x + sd.x, y: ship.y + sd.y, vx: 0, vy: 0, t: 0, ang: Math.PI / 2 + (i * Math.PI * 2) / n, dir, r: 9, hp, maxHp: hp, iframes: 0, flash: 0, aim: 0, bob: Math.random() * 6, fireCd: 0.5 };
  }

  newHealDrone(i, n) {
    const d = this.newDrone("healDrone", -0.8, i, n);
    d.healed = 0; d.acc = 0; d.healing = false; d.fxT = 0;
    return d;
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

  // Tira um drone de campo (sem explosão). Quando o último sai, o efeito termina e a recarga começa.
  dismissDrone(d) {
    const list = this.fx?.drones;
    if (!list) return;
    const i = list.indexOf(d);
    if (i >= 0) list.splice(i, 1);
    if (!list.length) this.end();
  }

  destroyDrone(d) {
    const g = this.game;
    g.vfx.explosion(d.x, d.y, 14, this.def.color);
    Sound.play("explode");
    this.dismissDrone(d);
  }

  // Drone de ataque leva dano (vida em pontos). Sobrevivendo, pisca e solta faíscas.
  damageDrone(d, cost, x, y) {
    d.hp -= cost; d.flash = 0.2;
    if (d.hp <= 0) return this.destroyDrone(d);
    this.game.vfx.spark(x, y, this.def.color, 4, 120, 2.2, 0.25);
    Sound.play("shield_hit");
  }

  /* ------------------------------ clone ------------------------------ */
  hurtClone(c, dmg, x, y) {
    const g = this.game, dealt = Math.max(1, Math.round(dmg * (1 - g.ship.stats.dmgReduction)));
    c.hp -= dealt; c.iframes = CONFIG.ship.hitIframes; c.flash = 0.3;
    g.vfx.spark(x, y, this.def.color, 6, 160, 2.4, 0.35);
    if (c.hp <= 0) {
      g.vfx.explosion(c.x, c.y, 34, this.def.color);
      g.vfx.ring(c.x, c.y, 10, 70, "#ffffff", 0.4, 2.5);
      Sound.play("shield_break");
      this.end();
    } else Sound.play("shield_hit");
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

  // Colisão com inimigo: o escudo perde `ramCost` cargas e dá um instante de invulnerabilidade à nave.
  shieldRam(e) {
    const sh = this.shield, ship = this.game.ship;
    if (!sh || ship.dash) return false;
    const rr = e.r * 0.85 + sh.r, dx = e.x - ship.x, dy = e.y - ship.y;
    if (dx * dx + dy * dy > rr * rr) return false;
    this.hitShield(sh, this.stats.ramCost, ship.x + dx * 0.6, ship.y + dy * 0.6);
    ship.iframes = Math.max(ship.iframes, CONFIG.ship.hitIframes);
    return true;
  }

  // Drone de ataque: perde vida (tiro = shotCost, colisão/feixe = ramCost; base: 2 tiros ou 1 colisão). O drone de reparo é invulnerável.
  // Clone: leva dano como a nave (tiros, feixes, colisões), com invulnerabilidade curta depois de cada dano.
  collide() {
    const g = this.game, st = this.stats;
    if (this.fx?.kind === "attackDrone") {
      for (const d of this.fx.drones.slice()) {
        let hit = false;
        for (const b of g.enemies.shots.active) {
          if (b.life <= 0) continue;
          const rr = d.r + b.r, dx = b.x - d.x, dy = b.y - d.y;
          if (dx * dx + dy * dy > rr * rr) continue;
          b.life = 0;
          this.damageDrone(d, st.shotCost, b.x, b.y);
          hit = d.hp <= 0;
          if (hit) break;
        }
        if (hit) continue;
        if (d.iframes > 0) continue;
        let rammed = false;
        for (const b of g.enemies.beams) {
          if (b.fired && Math.abs(d.x - b.x) <= b.w / 2 + d.r && d.y + d.r >= b.y) { rammed = true; break; }
        }
        if (!rammed) for (const e of g.enemies.list) {
          if (e.dead) continue;
          const rr = e.r * 0.85 + d.r, dx = e.x - d.x, dy = e.y - d.y;
          if (dx * dx + dy * dy <= rr * rr) { rammed = true; break; }
        }
        if (rammed) { d.iframes = DRONE_RAM_IFRAMES; this.damageDrone(d, st.ramCost, d.x, d.y); }
      }
    }
    const c = this.clone;
    if (c) this.collideClone(c);
  }

  collideClone(c) {
    const g = this.game, ship = g.ship, hr = ship.hitRadius, wm = CONFIG.ship.hitWidthMul;
    if (c.t < 0.45) return;                                   // ainda se materializando
    for (const b of g.enemies.shots.active) {
      if (b.life <= 0 || c.iframes > 0) continue;
      const rx = b.r + hr * wm, ry = b.r + hr, dx = (b.x - c.x) / rx, dy = (b.y - c.y) / ry;   // mesma área de acerto elíptica da nave
      if (dx * dx + dy * dy > 1) continue;
      b.life = 0;
      this.hurtClone(c, b.dmg, b.x, b.y);
      if (this.clone !== c) return;
    }
    for (const b of g.enemies.beams) {
      if (!b.fired || c.iframes > 0) continue;
      if (Math.abs(c.x - b.x) > b.w / 2 + hr * wm || c.y + hr < b.y) continue;
      this.hurtClone(c, b.dmg, c.x, c.y);
      if (this.clone !== c) return;
    }
    for (const e of g.enemies.list) {
      if (e.dead || c.iframes > 0) continue;
      const rr = e.r * 0.85 + hr, dx = e.x - c.x, dy = e.y - c.y;
      if (dx * dx + dy * dy > rr * rr) continue;
      g.damageEnemy(e, RAM_SELF_DAMAGE);
      this.hurtClone(c, e.def.ramDamage * e.dmgMul, c.x, c.y);
      if (this.clone !== c) return;
    }
  }
}
