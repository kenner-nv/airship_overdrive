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
    this.world = world;               // referência (o Game altera o mesmo objeto ao redimensionar)
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
    this.sinceHit = 0;                // tempo sem levar dano (s) — a regeneração só começa depois de Config.ship.regenDelay
    this.regenAcc = 0;                // fração de vida acumulada (a vida é inteira)
    this.regenOn = false;             // true enquanto está regenerando (HUD)
    this.regenPulse = false;          // true no quadro em que recuperou vida (efeito visual; quem lê zera)
    this.prevX = this.x; this.prevY = this.y;   // posição no passo anterior (colisão da esquiva)
    this.dashSweep = null;            // esquiva deste passo (ainda vale no passo em que ela termina) — ver CollisionSystem.dashVsEnemies
    this.recompute(true);
    this.hp = this.stats.maxHp;
  }

  get hitRadius() { return this.def.hitRadius; }
  get regenRate() { return (this.def.regenPct ?? 0) * this.stats.maxHp; }   // vida/s = % da vida máxima (Ships.js: regenPct), não melhora na partida

  /* Recalcula os atributos a partir da classe + melhorias. Aumentar a vida máxima também cura a diferença. */
  recompute(initial = false) {
    const d = this.def, dg = d.dodge ?? { cooldown: 1, duration: 0.1, speed: 0, iframes: 0 };
    const base = {
      maxHp: d.hp, speed: d.speed, dodgeCooldown: dg.cooldown, dodgeDuration: dg.duration,
      dodgeSpeed: dg.speed, dodgeIframes: dg.iframes, dodgeDamage: 0, dmgReduction: 0, ...d.specialBase,
    };
    const limits = {
      speed: [60, d.speed * SHIP_LIMITS.speedMaxMul],
      dodgeCooldown: [SHIP_LIMITS.dodgeCooldownMin, 99],
      dodgeDuration: [0.05, dg.duration * SHIP_LIMITS.dodgeDurationMaxMul],
      dodgeIframes: [0, SHIP_LIMITS.dodgeIframesMax],
      dodgeDamage: [0, SHIP_LIMITS.dodgeDamageMax],
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
    const glen = Math.hypot(dx, dy);
    if (glen < 1) return false;
    const s = this.stats, c = CONFIG.ship, w = this.world;
    // Direção: da nave até o ponto para onde o jogador aponta (alvo). Assim a esquiva termina ONDE o ponteiro está, sem passar
    // dele e voltar. Se o alvo estiver colado na nave ou "para trás" do gesto, vale a direção do gesto.
    let ux = this.tx - this.x, uy = this.ty - this.y, want = Math.hypot(ux, uy);
    if (want < c.dodgeMinDistance || ux * dx + uy * dy <= 0) { ux = dx; uy = dy; want = c.dodgeMinDistance; }
    const ul = Math.hypot(ux, uy), nx = ux / ul, ny = uy / ul;
    // Distância: até o alvo, no máximo o alcance da esquiva (velocidade × duração) e no máximo `dodgeMaxScreen` da tela
    // (da largura e da altura) na direção do movimento.
    const capX = Math.abs(nx) > 1e-6 ? (c.dodgeMaxScreen * w.width) / Math.abs(nx) : Infinity;
    const capY = Math.abs(ny) > 1e-6 ? (c.dodgeMaxScreen * w.height) / Math.abs(ny) : Infinity;
    const dist = Math.max(c.dodgeMinDistance, Math.min(want, s.dodgeSpeed * s.dodgeDuration, capX, capY));
    const dur = Math.min(s.dodgeDuration, Math.max(0.1, dist / s.dodgeSpeed));    // esquivas curtas não ficam rápidas demais
    this.dash = { dx: nx, dy: ny, t: 0, dur, speed: dist / dur, left: dist, hit: new Set() };   // hit: inimigos já atingidos nesta esquiva
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
    this.prevX = this.x; this.prevY = this.y;
    this.dashSweep = null;
    if (this.dodgeCd > 0) this.dodgeCd = Math.max(0, this.dodgeCd - dt);
    if (this.iframes > 0) this.iframes = Math.max(0, this.iframes - dt);
    if (this.hurtFlash > 0) this.hurtFlash = Math.max(0, this.hurtFlash - dt);

    if (this.dash) {
      this.dashSweep = this.dash;
      const d = this.dash;
      d.t += dt;
      const step = Math.min(d.left, d.speed * dt);        // nunca anda mais que a distância que falta (para exatamente no destino)
      this.x += d.dx * step; this.y += d.dy * step; d.left -= step;
      this.trail.push({ x: this.x, y: this.y, a: 0.5 });
      if (this.trail.length > 6) this.trail.shift();
      if (d.left <= 1e-3 || d.t >= d.dur + 0.05) this.dash = null;
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

    // Regeneração: depois de ~10 s sem levar dano a nave recupera vida continuamente (taxa fixa da classe)
    this.sinceHit += dt;
    this.regenOn = this.regenRate > 0 && this.hp < this.stats.maxHp && this.sinceHit >= CONFIG.ship.regenDelay;
    if (this.regenOn) {
      this.regenAcc += this.regenRate * dt;
      if (this.regenAcc >= 1) {
        const n = Math.floor(this.regenAcc);
        this.regenAcc -= n;
        if (this.heal(n) > 0) this.regenPulse = true;
      }
    } else this.regenAcc = 0;

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
    this.sinceHit = 0; this.regenAcc = 0;      // levar dano zera a contagem da regeneração
    if (this.hp <= 0) { this.hp = 0; this.alive = false; }
    return dealt;
  }
}
