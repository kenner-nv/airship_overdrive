/* ==========================================================================
   CollisionSystem.js — colisões por círculos (rápido e justo para um shooter arcade).
   1) tiros do jogador × inimigos   2) tiros inimigos × nave   3) inimigos × nave (contato)
   Invulnerável (esquiva ou dano recente) = atravessa, sem consumir o projétil.
   ========================================================================== */
import { Sound } from "./Audio.js";
import { CONFIG } from "./data/Config.js";

const RAM_SELF_DAMAGE = 40;   // dano que o inimigo leva ao bater na nave

export class CollisionSystem {
  constructor(game) { this.game = game; }

  update() {
    const g = this.game;
    this.playerShotsVsEnemies(g);
    if (g.ship.def.special === "cancel") this.playerShotsVsEnemyShots(g);
    if (g.state !== "PLAYING" || !g.ship.alive) return;
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
      if (Math.abs(ship.x - b.x) > b.w / 2 + hr * CONFIG.ship.hitWidthMul || ship.y + hr < b.y) continue;
      const dealt = ship.damage(b.dmg);
      if (dealt > 0) { g.onShipHit(dealt, ship.x, ship.y); if (!ship.alive) return; }
    }
  }

  enemiesVsShip(g) {
    const ship = g.ship, hr = ship.hitRadius;
    for (const e of g.enemies.list) {
      if (e.dead) continue;
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
