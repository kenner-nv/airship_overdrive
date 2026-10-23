/* ==========================================================================
   PickupSystem.js — estrelas (moedas da partida) e itens de vida derrubados pelos inimigos.
   O jogador coleta passando a nave por cima. Itens caem devagar e somem se não forem pegos.
   Tudo avança com o tempo de jogo (congela no menu/pausa).
   ========================================================================== */
import { CONFIG } from "./data/Config.js";
import { Pool } from "./Pool.js";
import { Sound } from "./Audio.js";

const make = () => ({ kind: "star", x: 0, y: 0, vx: 0, vy: 0, fall: 0, life: 0, max: 0, value: 0, t: 0, pull: 0 });
const PULL_START = 160;   // velocidade inicial (px/s) de um item puxado pelo módulo Ímã

export class PickupSystem {
  constructor(game) {
    this.game = game;
    this.items = new Pool(make, 90);
  }

  clear() { this.items.clear(); }

  spawn(kind, x, y, value = 0, scatter = 0) {
    const p = this.items.acquire();
    if (!p) return;
    const c = CONFIG.pickups, a = Math.random() * Math.PI * 2;
    p.kind = kind; p.x = x; p.y = y; p.value = value; p.t = Math.random() * 6; p.pull = 0;
    p.vx = Math.cos(a) * scatter; p.vy = Math.sin(a) * scatter - (scatter ? 30 : 0);
    p.fall = kind === "star" ? c.starFall : c.heartFall;
    p.life = p.max = kind === "star" ? c.starLife : c.heartLife;
  }

  update(dt) {
    const g = this.game, ship = g.ship, w = g.world, c = CONFIG.pickups;
    const mg = ship.alive ? g.supports.magnet : null;      // módulo Ímã ativo: puxa estrelas e vida para a nave
    this.items.update((p) => {
      p.life -= dt; p.t += dt;
      if (p.life <= 0) return false;
      let pulled = false;
      if (mg) {
        const dx = ship.x - p.x, dy = ship.y - p.y, d = Math.hypot(dx, dy);
        if (d > 1 && d <= mg.range) {
          p.pull = Math.min(mg.maxSpeed, Math.max(p.pull, PULL_START) + mg.accel * dt);   // acelera aos poucos
          const v = Math.min(p.pull, d / dt);                                              // nunca passa da nave
          p.vx = (dx / d) * v; p.vy = (dy / d) * v;
          p.x += p.vx * dt; p.y += p.vy * dt;
          p.life = Math.max(p.life, 1);                                                    // não some no meio do caminho
          pulled = true;
        }
      }
      if (!pulled) {
        p.pull = 0;
        p.vx *= 1 - 3 * dt; p.vy += (p.fall - p.vy) * Math.min(1, 2.5 * dt);   // espalha e passa a cair
        p.x += p.vx * dt + Math.sin(p.t * 3) * 6 * dt; p.y += p.vy * dt;
      }
      if (p.y > w.height + 20) return false;
      p.x = Math.min(w.width - 8, Math.max(8, p.x));
      if (ship.alive) {
        const rr = c.radius + ship.hitRadius, dx = p.x - ship.x, dy = p.y - ship.y;
        if (dx * dx + dy * dy <= rr * rr) { this.collect(p); return false; }
      }
    });
  }

  collect(p) {
    const g = this.game;
    if (p.kind === "star") {
      g.currency.add(p.value);
      g.vfx.text(p.x, p.y - 10, `+${p.value}`, "#ffd24a");
      Sound.play("coin");
    } else {
      const healed = g.ship.heal(Math.round(g.ship.stats.maxHp * CONFIG.heal.percent));
      g.vfx.text(p.x, p.y - 10, `+${healed} vida`, "#7cffb2");
      g.vfx.ring(g.ship.x, g.ship.y, 10, 44, "#7cffb2", 0.35, 3);
      Sound.play("heal");
    }
  }
}
