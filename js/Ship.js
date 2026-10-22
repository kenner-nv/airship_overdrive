/* ==========================================================================
   Ship.js — ShipController: posição, movimento, esquiva, vida e atributos gerais da nave.
   Os atributos finais vêm da classe (Ships.js) + melhorias compradas (SHIP_TREE).
   A posição LÓGICA nunca é alterada pelo menu de construção.
   ========================================================================== */
import { CONFIG } from "./data/Config.js";
import { SHIP_TREES, SHIP_LIMITS, applyEffects, effectsOf } from "./data/Upgrades.js";

export class Ship {
  constructor() {
    this.def = null;
    this.owned = new Set();           // ids de melhorias gerais compradas
    this.x = 0; this.y = 0;
    this.stats = null;
    this.hp = 1;
    this.alive = false;
    this.reset(null, { width: 540, height: 960 });
  }

  reset(def, world) {
    this.def = def;
    this.owned.clear();
    this.alive = !!def;
    if (!def) return;
    this.x = world.width / 2;
    this.y = world.height * CONFIG.ship.spawnYFraction;
    this.tx = this.x; this.ty = this.y;
    this.dash = null;                 // { dx, dy, t, dur, speed }
    this.dodgeCd = 0;                 // tempo restante de recuperação
    this.iframes = 0;                 // invulnerabilidade (esquiva ou dano recente)
    this.hurtFlash = 0;
    this.trail = [];                  // posições recentes durante a esquiva (efeito visual)
    this.lean = 0;                    // inclinação visual (-1 esquerda … 1 direita)
    this.recompute(true);
    this.hp = this.stats.maxHp;
  }

  get hitRadius() { return this.def.hitRadius; }

  /* Recalcula os atributos a partir da classe + melhorias. Aumentar a vida máxima também cura a diferença. */
  recompute(initial = false) {
    const d = this.def, dg = d.dodge ?? { cooldown: 1, duration: 0.1, speed: 0, iframes: 0 };
    const base = {
      maxHp: d.hp, speed: d.speed, dodgeCooldown: dg.cooldown, dodgeDuration: dg.duration,
      dodgeSpeed: dg.speed, dodgeIframes: dg.iframes, dmgReduction: 0, ...d.specialBase,
    };
    const limits = {
      speed: [60, d.speed * SHIP_LIMITS.speedMaxMul],
      dodgeCooldown: [SHIP_LIMITS.dodgeCooldownMin, 99],
      dodgeDuration: [0.05, dg.duration * SHIP_LIMITS.dodgeDurationMaxMul],
      dodgeIframes: [0, SHIP_LIMITS.dodgeIframesMax],
      dmgReduction: [0, SHIP_LIMITS.dmgReductionMax],
      specialEvery: SHIP_LIMITS.specialEvery, specialMult: SHIP_LIMITS.specialMult,
      cancelPierce: SHIP_LIMITS.cancelPierce, redirect: SHIP_LIMITS.redirect,
    };
    const prevMax = this.stats?.maxHp ?? 0;
    this.stats = applyEffects(base, effectsOf(SHIP_TREES[d.id], this.owned), limits);
    if (!initial && this.stats.maxHp > prevMax) this.hp = Math.min(this.stats.maxHp, this.hp + (this.stats.maxHp - prevMax));
  }

  setTarget(x, y) { this.tx = x; this.ty = y; }

  get hasDodge() { return !!this.def.dodge; }

  // Gesto rápido (dx, dy = direção do movimento do ponteiro). Devolve true se a esquiva começou.
  tryDodge(dx, dy) {
    if (!this.alive || !this.def.dodge || this.dodgeCd > 0 || this.dash) return false;   // só o Espectro esquiva
    const len = Math.hypot(dx, dy);
    if (len < 1) return false;
    const s = this.stats;
    this.dash = { dx: dx / len, dy: dy / len, t: 0, dur: s.dodgeDuration, speed: s.dodgeSpeed };
    this.dodgeCd = s.dodgeCooldown;
    this.iframes = Math.max(this.iframes, s.dodgeIframes);
    return true;
  }

  // 0..1 da animação de flip (null se não estiver esquivando) e a direção do flip.
  get flip() { return this.dash ? { p: Math.min(1, this.dash.t / this.dash.dur), dx: this.dash.dx, dy: this.dash.dy } : null; }
  get dodgeReady() { return this.dodgeCd <= 0 ? 1 : 1 - this.dodgeCd / this.stats.dodgeCooldown; }

  update(dt, world) {
    if (!this.alive) return;
    const c = CONFIG.ship;
    const px = this.x;
    if (this.dodgeCd > 0) this.dodgeCd = Math.max(0, this.dodgeCd - dt);
    if (this.iframes > 0) this.iframes = Math.max(0, this.iframes - dt);
    if (this.hurtFlash > 0) this.hurtFlash = Math.max(0, this.hurtFlash - dt);

    if (this.dash) {
      this.dash.t += dt;
      this.x += this.dash.dx * this.dash.speed * dt;
      this.y += this.dash.dy * this.dash.speed * dt;
      this.trail.push({ x: this.x, y: this.y, a: 0.5 });
      if (this.trail.length > 6) this.trail.shift();
      if (this.dash.t >= this.dash.dur) this.dash = null;
    } else {
      const dx = this.tx - this.x, dy = this.ty - this.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 0.01) {
        const v = Math.min(dist * c.followGain, this.stats.speed);   // suavização, limitada pela velocidade da classe
        const step = Math.min(dist, v * dt);
        this.x += (dx / dist) * step; this.y += (dy / dist) * step;
      }
    }
    for (const t of this.trail) t.a -= dt * 3;
    while (this.trail.length && this.trail[0].a <= 0) this.trail.shift();

    this.clampToArena(world);
    // inclinação para o lado em que a nave se move (só visual)
    const vx = dt > 0 ? (this.x - px) / dt : 0;
    const want = Math.max(-1, Math.min(1, vx / Math.max(200, this.stats.speed * 0.7)));
    this.lean += (want - this.lean) * Math.min(1, 12 * dt);
  }

  clampToArena(world) {
    const c = CONFIG.ship;
    this.x = Math.min(world.width - c.sideMargin, Math.max(c.sideMargin, this.x));
    this.y = Math.min(world.height - c.bottomMargin, Math.max(world.height * c.minYFraction, this.y));
  }

  clampTarget(world) {
    const c = CONFIG.ship;
    this.tx = Math.min(world.width - c.sideMargin, Math.max(c.sideMargin, this.tx));
    this.ty = Math.min(world.height - c.bottomMargin, Math.max(world.height * c.minYFraction, this.ty));
  }

  // Aplica dano. Devolve o dano efetivamente aplicado (0 se invulnerável).
  heal(amount) {
    if (!this.alive) return 0;
    const before = this.hp;
    this.hp = Math.min(this.stats.maxHp, this.hp + amount);
    return this.hp - before;
  }

  damage(amount) {
    if (!this.alive || this.iframes > 0) return 0;
    const dealt = Math.max(1, Math.round(amount * (1 - this.stats.dmgReduction)));
    this.hp -= dealt;
    this.iframes = CONFIG.ship.hitIframes;
    this.hurtFlash = 0.35;
    if (this.hp <= 0) { this.hp = 0; this.alive = false; }
    return dealt;
  }
}
