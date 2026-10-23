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
    this.playerShotsVsEnemies(g);
    this.dashVsEnemies(g);
    if (g.ship.def.special === "cancel") this.playerShotsVsEnemyShots(g);
    if (g.state !== "PLAYING" || !g.ship.alive) return;
    g.supports.collide();
    this.enemyShotsVsShip(g);
    if (g.state !== "PLAYING" || !g.ship.alive) return;
    this.beamsVsShip(g);
    if (g.state !== "PLAYING" || !g.ship.alive) return;
    this.enemiesVsShip(g);
  }

  playerShotsVsEnemies(g) {
    const enemies = g.enemies.list;
    for (const s of g.weapons.shots.active) {
      if (s.life <= 0) continue;
      for (const e of enemies) {
        if (e.dead) continue;
        const rr = s.r + e.r, dx = s.x - e.x, dy = s.y - e.y;
        if (dx * dx + dy * dy > rr * rr) continue;
        let seen = false;
        for (let i = 0; i < Math.min(s.hitN, 16); i++) if (s.hits[i] === e.id) { seen = true; break; }
        if (seen) continue;                                  // projétil perfurante não acerta o mesmo inimigo 2×
        s.hits[s.hitN++ & 15] = e.id;
        g.damageEnemy(e, s.dmg);
        g.vfx.spark(s.x, s.y, s.color, 3, 110, 2, 0.2);
        if (s.blast > 0) { g.blast(s.x, s.y, s.blast, s.dmg * 0.7, e, s.color); s.life = 0; break; }
        if (s.special && e.dead) continue;                   // Vanguarda: o disparo carregado atravessa quem destruir
        if (s.pierce > 0) { s.pierce--; continue; }
        s.life = 0;
        break;
      }
    }
  }

  // Espectro (esquiva no nível máximo): quem estiver no caminho da esquiva leva dano. Inimigos comuns são destruídos
  // (qualquer onda); os "pesados" (heavy / elite) só levam `dodgeDamage`. Cada inimigo é atingido uma vez por esquiva.
  dashVsEnemies(g) {
    const ship = g.ship, dash = ship.dashSweep, dmg = ship.stats.dodgeDamage;
    if (!dash || !(dmg > 0)) return;
    const ax = ship.prevX, ay = ship.prevY, vx = ship.x - ax, vy = ship.y - ay, L2 = vx * vx + vy * vy;
    const reach = ship.hitRadius + 8;
    for (const e of g.enemies.list) {
      if (e.dead || dash.hit.has(e.id)) continue;
      const t = L2 > 1e-6 ? Math.min(1, Math.max(0, ((e.x - ax) * vx + (e.y - ay) * vy) / L2)) : 0;   // ponto do trajeto mais próximo (evita "atravessar" sem acertar)
      const px = ax + vx * t - e.x, py = ay + vy * t - e.y, rr = e.r * 0.85 + reach;
      if (px * px + py * py > rr * rr) continue;
      dash.hit.add(e.id);
      g.damageEnemy(e, e.def.special || e.def.heavy ? dmg : Math.max(dmg, e.hp));
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
          if (s.blast > 0) g.blast(s.x, s.y, s.blast, s.dmg * 0.7, null, s.color);
          s.life = 0;
          break;
        }
      }
    }
  }

  redirect(g, s) {
    let best = null, bd = Infinity;
    for (const e of g.enemies.list) {
      if (e.dead || e.y < -10) continue;
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

  enemiesVsShip(g) {
    const ship = g.ship, hr = ship.hitRadius;
    for (const e of g.enemies.list) {
      if (e.dead) continue;
      if (g.supports.shieldRam(e)) { g.damageEnemy(e, RAM_SELF_DAMAGE); continue; }   // colisão: o escudo se desfaz e o inimigo também sofre
      const rr = e.r * 0.85 + hr, dx = e.x - ship.x, dy = e.y - ship.y;
      if (dx * dx + dy * dy > rr * rr) continue;
      const dealt = ship.damage(e.def.ramDamage * e.dmgMul);
      if (dealt > 0) {
        g.damageEnemy(e, RAM_SELF_DAMAGE);
        g.onShipHit(dealt, ship.x, ship.y);
        if (!ship.alive) return;
      }
    }
  }
}
