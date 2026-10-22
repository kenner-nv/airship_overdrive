/* ==========================================================================
   Vfx.js — partículas, anéis de onda e textos flutuantes (com limite fixo e reaproveitamento).
   Tudo avança com o tempo de JOGO (pausa junto com a simulação).
   ========================================================================== */
import { Pool } from "./Pool.js";
import { CONFIG } from "./data/Config.js";

export class Vfx {
  constructor() {
    this.parts = new Pool(() => ({ x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 0, size: 0, color: "#fff" }), CONFIG.limits.maxParticles);
    this.rings = new Pool(() => ({ x: 0, y: 0, r0: 0, r1: 0, life: 0, max: 0, color: "#fff", width: 3 }), 40);
    this.texts = new Pool(() => ({ x: 0, y: 0, vy: -38, life: 0, max: 0.8, str: "", color: "#fff" }), CONFIG.limits.maxTexts);
  }

  clear() { this.parts.clear(); this.rings.clear(); this.texts.clear(); }

  spark(x, y, color, n = 6, speed = 160, size = 2.2, life = 0.35) {
    for (let i = 0; i < n; i++) {
      const p = this.parts.acquire(); if (!p) return;
      const a = Math.random() * Math.PI * 2, s = speed * (0.35 + Math.random() * 0.65);
      p.x = x; p.y = y; p.vx = Math.cos(a) * s; p.vy = Math.sin(a) * s;
      p.life = p.max = life * (0.6 + Math.random() * 0.6); p.size = size; p.color = color;
    }
  }

  explosion(x, y, radius, color) {
    this.spark(x, y, color, Math.min(18, 6 + Math.round(radius / 3)), 120 + radius * 4, 2.6, 0.5);
    this.spark(x, y, "#ffffff", 4, 90, 2, 0.25);
    this.ring(x, y, radius * 0.3, radius * 1.4, color, 0.28, 3);
  }

  ring(x, y, r0, r1, color, dur = 0.3, width = 3) {
    const r = this.rings.acquire(); if (!r) return;
    r.x = x; r.y = y; r.r0 = r0; r.r1 = r1; r.life = r.max = dur; r.color = color; r.width = width;
  }

  text(x, y, str, color = "#ffd24a") {
    const t = this.texts.acquire(); if (!t) return;
    t.x = x; t.y = y; t.str = str; t.color = color; t.life = t.max = 0.8;
  }

  update(dt) {
    this.parts.update((p) => {
      p.life -= dt; if (p.life <= 0) return false;
      p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 1 - 3 * dt; p.vy *= 1 - 3 * dt;
    });
    this.rings.update((r) => { r.life -= dt; return r.life > 0; });
    this.texts.update((t) => { t.life -= dt; t.y += t.vy * dt; return t.life > 0; });
  }

  draw(ctx) {
    for (const r of this.rings.active) {
      const k = 1 - r.life / r.max;
      ctx.globalAlpha = (1 - k) * 0.8;
      ctx.strokeStyle = r.color; ctx.lineWidth = r.width * (1 - k * 0.5);
      ctx.beginPath(); ctx.arc(r.x, r.y, r.r0 + (r.r1 - r.r0) * k, 0, 6.2832); ctx.stroke();
    }
    for (const p of this.parts.active) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color; ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
    if (this.texts.active.length) {
      ctx.font = "700 14px system-ui, sans-serif"; ctx.textAlign = "center";
      for (const t of this.texts.active) {
        ctx.globalAlpha = Math.min(1, (t.life / t.max) * 1.6);
        ctx.fillStyle = t.color; ctx.fillText(t.str, t.x, t.y);
      }
      ctx.globalAlpha = 1;
    }
  }
}
