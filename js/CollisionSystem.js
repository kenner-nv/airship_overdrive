/* ==========================================================================
   CollisionSystem.js — colisões por círculos (rápido e justo para um shooter arcade).
   1) tiros do jogador × inimigos   2) tiros inimigos × nave   3) inimigos × nave (contato)
   Invulnerável (esquiva ou dano recente) = atravessa, sem consumir o projétil.
   Módulo de suporte: o ESCUDO absorve tiros/feixes/colisões antes da nave (SupportSystem.shield*); os DRONES somem ao
   serem atingidos (SupportSystem.collide). Esquiva do Espectro no nível máximo: dano aos inimigos no caminho (dashVsEnemies).
   ========================================================================== */
import { Sound } from "./Audio.js";
import { CONFIG } from "./data/Config.js";

const RAM_SELF_DAMAGE = 40;   // dano que o inimigo leva ao bater na nave

export class CollisionSystem {
  constructor(game) { this.game = game; }

  update() {
    const g = this.game;
    this.playerShotsVsMicros(g);
    this.playerShotsVsEnemies(g);
    this.dashVsEnemies(g);
    if (g.ship.def.special === "cancel") this.playerShotsVsEnemyShots(g);
    if (g.state !== "PLAYING" || !g.ship.alive) return;
    g.supports.collide();
    this.enemyShotsVsShip(g);
    if (g.state !== "PLAYING" || !g.ship.alive) return;
    this.beamsVsShip(g);
    if (g.state !== "PLAYING" || !g.ship.alive) return;
    this.raysVsShip(g);
    if (g.state !== "PLAYING" || !g.ship.alive) return;
    this.enemiesVsShip(g);
  }

  // Micromísseis inimigos têm 1 de vida: qualquer tiro do jogador os destrói.
  playerShotsVsMicros(g) {
    const bullets = g.enemies.shots.active;
    if (!bullets.length) return;
    for (const s of g.weapons.shots.active) {
      if (s.life <= 0) continue;
      for (const b of bullets) {
        if (b.life <= 0 || b.kind !== "micro") continue;
        const rr = s.r + b.r + 2, dx = s.x - b.x, dy = s.y - b.y;
        if (dx * dx + dy * dy > rr * rr) continue;
        b.life = 0;
        g.vfx.spark(b.x, b.y, "#ffb347", 4, 90, 2, 0.2);
        if (s.blast > 0) { g.blast(s.x, s.y, s.blast, s.dmg * 0.7, null, s.color, { kind: s.src, knock: s.knock ? 55 : 0 }); s.life = 0; break; }
        if (s.pierce > 0) { s.pierce--; continue; }
        s.life = 0;
        break;
      }
    }
  }

  // Alvos de um inimigo, na ordem de teste: as partes (torres/satélites) vêm antes do corpo.
  playerShotsVsEnemies(g) {
    const enemies = g.enemies.list;
    for (const s of g.weapons.shots.active) {
      if (s.life <= 0) continue;
      for (const e of enemies) {
        if (e.dead || e.intangible) continue;
        let part = null;
        if (e.parts) {
          for (const pt of e.parts) {
            if (pt.dead) continue;
            const rr = s.r + pt.r, dx = s.x - pt.x, dy = s.y - pt.y;
            if (dx * dx + dy * dy <= rr * rr && !this.seen(s, pt.id)) { part = pt; break; }
          }
        }
        if (!part) {
          const rr = s.r + e.r, dx = s.x - e.x, dy = s.y - e.y;
          if (dx * dx + dy * dy > rr * rr || this.seen(s, e.id)) continue;   // projétil perfurante não acerta o mesmo inimigo 2×
        }
        const id = part ? part.id : e.id;
        s.hits[s.hitN++ & 15] = id;
        if (part) g.damagePart(e, part, s.dmg, s.src); else g.damageEnemy(e, s.dmg, s.src);
        g.vfx.spark(s.x, s.y, s.color, 3, 110, 2, 0.2);
        if (s.frag > 0 && !part) g.weapons.spawnFrags(s, id);
        if (s.blast > 0) {
          if (s.knock && !part && !e.dead) g.enemies.push(e, s.x, s.y, 55);
          g.blast(s.x, s.y, s.blast, s.dmg * 0.7, e, s.color, { kind: s.src, knock: s.knock ? 55 : 0 });
          s.life = 0; break;
        }
        const killed = !part && e.dead;
        if (killed) {
          if (s.special) continue;                           // Vanguarda: o disparo carregado atravessa quem destruir
          if (this.afterKill(g, s, e)) continue;             // Ricochete / Reflexão / perfuração ao destruir
        }
        if (s.pierce > 0) { s.pierce--; continue; }
        s.life = 0;
        break;
      }
    }
  }

  seen(s, id) {
    for (let i = 0; i < Math.min(s.hitN, 16); i++) if (s.hits[i] === id) return true;
    return false;
  }

  // Efeitos do ramo Especial depois de DESTRUIR um inimigo (50% do dano base). Devolve true se o tiro continua.
  afterKill(g, s, e) {
    if (s.kr > 0) {                                           // Ricochete: vai para o inimigo mais próximo
      let best = null, bd = Infinity;
      for (const t of g.enemies.list) {
        if (t.dead || t.intangible || t.y < 0 || t === e || this.seen(s, t.id)) continue;
        const d = (t.x - s.x) ** 2 + (t.y - s.y) ** 2;
        if (d < bd) { bd = d; best = t; }
      }
      if (best) {
        s.kr--; s.dmg = s.baseDmg * 0.5;
        s.ang = Math.atan2(best.x - s.x, -(best.y - s.y));
        s.life = Math.max(s.life, 0.7); s.sp = Math.max(s.sp, s.maxSp);
        return true;
      }
    }
    if (s.kc > 0) { s.kc--; s.dmg = s.baseDmg * 0.5; return true; }   // continua a trajetória
    if (s.kd > 0) {                                           // Reflexão: segue por uma das diagonais
      s.kd--; s.dmg = s.baseDmg * 0.5;
      let side = Math.random() < 0.5 ? -1 : 1, bd = Infinity;
      for (const sd of [-1, 1]) {
        const a = s.ang + sd * Math.PI / 4;
        for (const t of g.enemies.list) {
          if (t.dead || t.intangible || t.y < 0 || t === e) continue;
          const dx = t.x - s.x, dy = t.y - s.y, d = dx * dx + dy * dy;
          let diff = Math.atan2(dx, -dy) - a;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          if (Math.abs(diff) < 0.6 && d < bd) { bd = d; side = sd; }
        }
      }
      s.ang += side * Math.PI / 4;
      s.life = Math.max(s.life, 0.45);
      return true;
    }
    return false;
  }

  // Espectro (esquiva no nível máximo): quem estiver no caminho da esquiva leva dano. Inimigos comuns são destruídos
  // (qualquer onda); os "pesados" (heavy / elite) só levam `dodgeDamage`. Cada inimigo é atingido uma vez por esquiva.
  dashVsEnemies(g) {
    const ship = g.ship, dash = ship.dashSweep, dmg = ship.stats.dodgeDamage;
    if (!dash || !(dmg > 0)) return;
    const ax = ship.prevX, ay = ship.prevY, vx = ship.x - ax, vy = ship.y - ay, L2 = vx * vx + vy * vy;
    const reach = ship.hitRadius + 8;
    for (const e of g.enemies.list) {
      if (e.dead || e.intangible || dash.hit.has(e.id)) continue;
      const t = L2 > 1e-6 ? Math.min(1, Math.max(0, ((e.x - ax) * vx + (e.y - ay) * vy) / L2)) : 0;   // ponto do trajeto mais próximo (evita "atravessar" sem acertar)
      const px = ax + vx * t - e.x, py = ay + vy * t - e.y, rr = e.r * 0.85 + reach;
      if (px * px + py * py > rr * rr) continue;
      dash.hit.add(e.id);
      g.damageEnemy(e, e.def.special || e.def.heavy ? dmg : Math.max(dmg, e.hp), "dash");
      g.vfx.spark(e.x, e.y, "#ff8ae0", 8, 220, 2.6, 0.35);
      g.vfx.ring(e.x, e.y, 6, e.r + 14, "#ffffff", 0.22, 2.5);
    }
  }

  // Tanque: os disparos da nave cancelam tiros inimigos. Melhorias: continua após cancelar 1, 2…
  // e, no nível máximo, muda de direção para o inimigo mais próximo após cancelar.
  playerShotsVsEnemyShots(g) {
    const bullets = g.enemies.shots.active;
    if (!bullets.length) return;
    for (const s of g.weapons.shots.active) {
      if (s.life <= 0 || !s.cancel) continue;
      for (const b of bullets) {
        if (b.life <= 0) continue;
        const rr = s.r + b.r + 2, dx = s.x - b.x, dy = s.y - b.y;
        if (dx * dx + dy * dy > rr * rr) continue;
        b.life = 0;
        g.vfx.spark(b.x, b.y, "#ffffff", 3, 90, 2, 0.18);
        Sound.play("cancel");
        if (s.cancelLeft > 0) {
          s.cancelLeft--;
          if (s.redirect) this.redirect(g, s);
        } else {
          if (s.blast > 0) g.blast(s.x, s.y, s.blast, s.dmg * 0.7, null, s.color, { kind: s.src });
          s.life = 0;
          break;
        }
      }
    }
  }

  redirect(g, s) {
    let best = null, bd = Infinity;
    for (const e of g.enemies.list) {
      if (e.dead || e.intangible || e.y < -10) continue;
      const d = (e.x - s.x) ** 2 + (e.y - s.y) ** 2;
      if (d < bd) { bd = d; best = e; }
    }
    if (best) s.ang = Math.atan2(best.x - s.x, -(best.y - s.y));
  }

  enemyShotsVsShip(g) {
    const ship = g.ship, hr = ship.hitRadius, wm = CONFIG.ship.hitWidthMul;
    for (const b of g.enemies.shots.active) {
      if (b.life <= 0) continue;
      if (g.supports.shieldShot(b)) continue;                // o escudo absorve antes de a nave ser atingida
      // área de acerto elíptica: mais larga na horizontal (cobre as asas)
      const rx = b.r + hr * wm, ry = b.r + hr, dx = (b.x - ship.x) / rx, dy = (b.y - ship.y) / ry;
      if (dx * dx + dy * dy > 1) continue;
      const dealt = ship.damage(b.dmg);
      if (dealt > 0) { b.life = 0; g.onShipHit(dealt, b.x, b.y); if (!ship.alive) return; }
    }
  }

  // Feixe ativo: acerta a nave se ela estiver na coluna dele (da origem até o fim da tela).
  beamsVsShip(g) {
    const ship = g.ship, hr = ship.hitRadius;
    for (const b of g.enemies.beams) {
      if (!b.fired) continue;
      if (g.supports.shieldBeam(b)) continue;
      if (Math.abs(ship.x - b.x) > b.w / 2 + hr * CONFIG.ship.hitWidthMul || ship.y + hr < b.y) continue;
      const dealt = ship.damage(b.dmg);
      if (dealt > 0) { g.onShipHit(dealt, ship.x, ship.y); if (!ship.alive) return; }
    }
  }

  // Feixes inclinados/giratórios (Varredor, Rede de Feixes, chefes): acertam quem estiver perto da linha.
  raysVsShip(g) {
    const ship = g.ship, hr = ship.hitRadius;
    for (const r of g.enemies.rays) {
      if (!r.fired) continue;
      if (r.shielded) continue;                                   // o escudo cobre o resto deste feixe
      const sh = g.supports.shield;
      if (sh && !ship.dash && g.enemies.rayDist(r, ship.x, ship.y) <= r.w / 2 + sh.r) { r.shielded = true; g.supports.shieldHit(r.dmg, ship.x, ship.y - sh.r * 0.6); continue; }
      if (g.enemies.rayDist(r, ship.x, ship.y) > r.w / 2 + hr * 1.3) continue;
      const dealt = ship.damage(r.dmg);
      if (dealt > 0) { g.onShipHit(dealt, ship.x, ship.y); if (!ship.alive) return; }
    }
  }

  enemiesVsShip(g) {
    const ship = g.ship, hr = ship.hitRadius;
    for (const e of g.enemies.list) {
      if (e.dead || e.intangible) continue;
      if (g.supports.shieldRam(e)) {                              // colisão: o escudo absorve e o inimigo também sofre
        if (e.def.ability === "explosive") g.enemies.detonate(e); else g.damageEnemy(e, RAM_SELF_DAMAGE, "ram");
        continue;
      }
      const rr = e.r * 0.85 + hr, dx = e.x - ship.x, dy = e.y - ship.y;
      if (dx * dx + dy * dy > rr * rr) continue;
      const dealt = ship.damage(e.def.ramDamage * e.dmgMul);
      if (dealt > 0) {
        if (e.def.ability === "explosive") g.enemies.detonate(e); else g.damageEnemy(e, RAM_SELF_DAMAGE, "ram");
        g.onShipHit(dealt, ship.x, ship.y);
        if (!ship.alive) return;
      }
    }
  }
}
