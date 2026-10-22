/* ==========================================================================
   Renderer.js — desenha a arena no Canvas 2D (coordenadas LÓGICAS: largura fixa de 540).
   Só lê o estado do jogo; nunca altera a simulação. O fundo (estrelas) rola só quando o jogo avança.
   ========================================================================== */
import { Art, PALETTE } from "./Art.js";
import { WEAPONS } from "./data/Weapons.js";
import { CONFIG } from "./data/Config.js";

const LAYERS = [
  { count: 38, speed: 16, size: 1.1, alpha: 0.35 },
  { count: 24, speed: 42, size: 1.6, alpha: 0.5 },
  { count: 12, speed: 90, size: 2.2, alpha: 0.7 },
];

export class Renderer {
  constructor(canvas, game) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false });
    this.game = game;
    this.s = 1;                 // pixels de tela por unidade lógica
    this.stars = [];
    this.bg = null;
    this.bgH = 0;
    this.side = document.getElementById("side");       // fundo borrado nas laterais (telas largas)
    this.sctx = this.side ? this.side.getContext("2d", { alpha: false }) : null;
    this.sideStars = [];
    this.sideOn = false;
    this.k = 1;                                         // px de tela por unidade lógica (CSS)
  }

  resize(cssW, cssH, dpr) {
    const w = this.game.world;
    this.canvas.width = Math.max(1, Math.round(cssW * dpr));
    this.canvas.height = Math.max(1, Math.round(cssH * dpr));
    this.s = this.canvas.width / w.width;
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = "high";
    this.k = cssW / w.width;
    this.buildBackground();
    this.resizeSide(cssW, cssH);
  }

  // Laterais: em telas mais largas que a arena, o fundo continua (estrelas + degradê) com blur.
  // É só visual: a arena e a jogabilidade são idênticas em qualquer tela.
  resizeSide(stageW) {
    if (!this.side) return;
    const vw = window.innerWidth, vh = window.innerHeight;
    this.sideOn = vw - stageW > 4;
    this.side.style.display = this.sideOn ? "block" : "none";
    if (!this.sideOn) return;
    this.side.width = Math.round(vw / 2); this.side.height = Math.round(vh / 2);
    this.sideStars = [];
    const factor = vw / stageW;
    for (const [li, L] of LAYERS.entries()) {
      for (let i = 0; i < Math.round(L.count * factor); i++) this.sideStars.push({ x: Math.random() * vw, y: Math.random() * vh, l: li });
    }
    this.sideH = vh; this.sideW = vw;
  }

  drawSide() {
    const c = this.sctx, W = this.sideW, H = this.sideH;
    c.setTransform(0.5, 0, 0, 0.5, 0, 0);
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, PALETTE.bgTop); g.addColorStop(1, PALETTE.bgBottom);
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.fillStyle = PALETTE.star;
    for (const st of this.sideStars) {
      const L = LAYERS[st.l];
      c.globalAlpha = L.alpha;
      c.fillRect(st.x, st.y, L.size * this.k * 1.6, L.size * this.k * 1.6 * (1 + st.l * 0.8));
    }
    c.globalAlpha = 1;
  }

  buildBackground() {
    const w = this.game.world;
    this.bg = this.ctx.createLinearGradient(0, 0, 0, w.height);
    this.bg.addColorStop(0, PALETTE.bgTop);
    this.bg.addColorStop(1, PALETTE.bgBottom);
    this.stars = [];
    for (const [li, L] of LAYERS.entries()) {
      for (let i = 0; i < L.count; i++) this.stars.push({ x: Math.random() * w.width, y: Math.random() * w.height, l: li });
    }
  }

  // Avança o fundo (chamado só quando a simulação roda ou, mais devagar, nos menus).
  scroll(dt) {
    const h = this.game.world.height;
    for (const st of this.stars) {
      st.y += LAYERS[st.l].speed * dt;
      if (st.y > h) st.y -= h;
    }
    if (this.sideOn) {
      for (const st of this.sideStars) {
        st.y += LAYERS[st.l].speed * this.k * dt;
        if (st.y > this.sideH) st.y -= this.sideH;
      }
    }
  }

  blit(key, x, y, ang, k = 1) {
    const sp = Art.get(key), S = this.s * k, ctx = this.ctx;
    const c = Math.cos(ang) * S, s = Math.sin(ang) * S;
    ctx.setTransform(c, s, -s, c, x * this.s, y * this.s);
    ctx.drawImage(sp.img, -sp.w / 2, -sp.h / 2, sp.w, sp.h);
  }

  draw() {
    const g = this.game, ctx = this.ctx, w = g.world, S = this.s;
    if (this.sideOn) this.drawSide();
    ctx.setTransform(S, 0, 0, S, 0, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = this.bg;
    ctx.fillRect(0, 0, w.width, w.height);
    for (const st of this.stars) {
      const L = LAYERS[st.l];
      ctx.globalAlpha = L.alpha; ctx.fillStyle = PALETTE.star;
      ctx.fillRect(st.x, st.y, L.size, L.size * (1 + st.l * 0.8));
    }
    ctx.globalAlpha = 1;

    const inGame = g.inScene;
    if (!inGame) return;

    // coletáveis (pequenos, atrás dos inimigos); piscam quando estão quase sumindo
    for (const p of g.pickups.items.active) {
      if (p.life < 2.2 && Math.floor(g.clock * 9) % 2) continue;
      this.blit(p.kind === "star" ? "pickup.star" : "pickup.heart", p.x, p.y, p.kind === "star" ? Math.sin(p.t * 3) * 0.3 : 0, p.kind === "star" ? 1 : 1 + Math.sin(p.t * 5) * 0.08);
    }

    // tiros do jogador (o disparo carregado da Vanguarda é maior e tem um halo dourado)
    for (const s of g.weapons.shots.active) {
      if (s.special) {
        ctx.setTransform(S, 0, 0, S, 0, 0);
        ctx.globalAlpha = 0.35; ctx.fillStyle = "#ffd24a";
        ctx.beginPath(); ctx.arc(s.x, s.y, 11, 0, 6.2832); ctx.fill(); ctx.globalAlpha = 1;
        this.blit(`shot.${s.kind}`, s.x, s.y, s.ang, 1.7);
      } else this.blit(`shot.${s.kind}`, s.x, s.y, s.ang);
    }
    ctx.setTransform(S, 0, 0, S, 0, 0);

    this.drawEnemies(ctx);
    this.drawBeams(ctx);

    // tiros inimigos (por cima, para leitura)
    for (const b of g.enemies.shots.active) {
      if (b.kind === "missile") this.blit("shot.emissile", b.x, b.y, Math.atan2(b.vy, b.vx) + Math.PI / 2);
      else this.blit("shot.enemy", b.x, b.y, 0);
    }
    ctx.setTransform(S, 0, 0, S, 0, 0);

    if (g.ship.alive) this.drawShip(ctx);
    g.vfx.draw(ctx);

    if (g.ship.hurtFlash > 0) {
      ctx.globalAlpha = Math.min(0.6, g.ship.hurtFlash * 1.6);
      ctx.strokeStyle = "#ff3355"; ctx.lineWidth = 22;
      ctx.strokeRect(0, 0, w.width, w.height);
      ctx.globalAlpha = 1;
    }
  }

  // Lasers inimigos: aviso (linha fina tracejada piscando) → feixe ativo (coluna brilhante até o fim da tela)
  drawBeams(ctx) {
    const g = this.game, H = g.world.height;
    for (const b of g.enemies.beams) {
      ctx.setTransform(this.s, 0, 0, this.s, 0, 0);
      if (!b.fired) {
        const k = b.t / b.warn;
        ctx.globalAlpha = 0.35 + 0.4 * Math.abs(Math.sin(k * 14));
        ctx.strokeStyle = "#ff4d6d"; ctx.lineWidth = 2 + k * 3; ctx.setLineDash([10, 8]);
        ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x, H); ctx.stroke(); ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      } else {
        const f = 1 - (b.t - b.warn) / b.dur, w = b.w * (0.7 + 0.3 * f);
        ctx.globalAlpha = 0.35 * f + 0.25; ctx.fillStyle = "#ff4d6d"; ctx.fillRect(b.x - w * 0.9, b.y, w * 1.8, H - b.y);
        ctx.globalAlpha = 0.9; ctx.fillStyle = "#ffb3c1"; ctx.fillRect(b.x - w / 2, b.y, w, H - b.y);
        ctx.fillStyle = "#fff"; ctx.fillRect(b.x - w * 0.18, b.y, w * 0.36, H - b.y);
        ctx.globalAlpha = 1;
      }
    }
  }

  drawEnemies(ctx) {
    const g = this.game, S = this.s;
    for (const e of g.enemies.list) {
      if (e.dead) continue;
      Art.draw(ctx, e.def.sprite, e.x, e.y);
      if (e.flash > 0) Art.drawFlash(ctx, e.def.sprite, e.x, e.y, Math.min(0.85, (e.flash / 0.08) * 0.85));
      if (e.carriesHeal) this.blit("pickup.heart", e.x, e.y - e.r - 12, 0, 0.75 + Math.sin(g.clock * 6) * 0.06);   // este inimigo derruba vida
      ctx.setTransform(S, 0, 0, S, 0, 0);
      if (e.charge > 0) {                                  // aviso: vai atirar
        ctx.globalAlpha = 0.35 + 0.5 * e.charge;
        ctx.strokeStyle = PALETTE.enemyShot; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 5 + (1 - e.charge) * 8, 0, 6.2832); ctx.stroke();
        ctx.globalAlpha = 1;
      }
      if (e.maxHp >= 60 && e.hp < e.maxHp) {              // barra de vida dos resistentes e elites
        const bw = e.r * 1.8, by = e.y - e.r - 10;
        ctx.fillStyle = "rgba(0,0,0,.6)"; ctx.fillRect(e.x - bw / 2, by, bw, 4);
        ctx.fillStyle = PALETTE.hpLow; ctx.fillRect(e.x - bw / 2, by, bw * Math.max(0, e.hp / e.maxHp), 4);
      }
    }
  }

  drawShip(ctx) {
    const g = this.game, ship = g.ship, def = ship.def, t = g.clock;
    for (const tr of ship.trail) Art.draw(ctx, def.sprite, tr.x, tr.y, 0, 1, Math.max(0, tr.a) * 0.6);   // rastro da esquiva

    ctx.save();
    ctx.translate(ship.x, ship.y);
    // inclinação em PERSPECTIVA (asas): achata um pouco a largura e desnivela as asas, sem girar a nave
    const ln = ship.lean || 0;
    ctx.transform(1 - CONFIG.ship.leanSqueeze * Math.abs(ln), -ln * CONFIG.ship.leanTilt, 0, 1, 0, 0);
    const flip = ship.flip;
    if (flip) {                                    // flip visual: giro em torno do eixo do deslocamento
      const rot = Math.atan2(flip.dy, flip.dx);
      ctx.rotate(rot); ctx.scale(1, Math.cos(flip.p * Math.PI * 2)); ctx.rotate(-rot);
    }
    // chamas dos motores
    ctx.fillStyle = "#ffb347";
    for (const en of def.engines) {
      const len = 9 + Math.sin(t * 40 + en.x) * 3 + Math.random() * 3;
      ctx.beginPath(); ctx.moveTo(en.x - 3.5, en.y); ctx.lineTo(en.x + 3.5, en.y); ctx.lineTo(en.x, en.y + len); ctx.closePath(); ctx.fill();
    }
    let alpha = 1;
    if (ship.dash) alpha = 0.85;
    else if (ship.iframes > 0) alpha = Math.floor(t * 18) % 2 ? 0.35 : 1;   // pisca ao levar dano
    Art.draw(ctx, def.sprite, 0, 0, 0, 1, alpha);

    // pontos dos slots: vazio = anel tracejado, ocupado = ponto com a cor da arma
    for (const slot of g.weapons.slotList) {
      const sd = slot.def;
      ctx.globalAlpha = alpha;
      if (slot.weaponId) {
        // arma acoplada: só o ícone da arma, no slot, com tamanho/rotação ajustáveis (CONFIG.slotIcon)
        const ic = Art.get(`icon.${slot.weaponId}`), cfg = CONFIG.slotIcon;
        const o = { ...cfg, ...(cfg.perWeapon[slot.weaponId] ?? {}), ...(cfg.perSlot[`${def.id}.${sd.id}`] ?? {}) };
        ctx.save(); ctx.translate(sd.x, sd.y);
        ctx.rotate((o.followSlotAngle ? sd.angle || 0 : 0) + ((o.rotationDeg || 0) * Math.PI) / 180);
        ctx.drawImage(ic.img, -o.size / 2, -o.size / 2, o.size, o.size);
        ctx.restore();
      } else {
        ctx.setLineDash([2, 2.4]); ctx.strokeStyle = "rgba(255,255,255,.6)"; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(sd.x, sd.y, 4.2, 0, 6.2832); ctx.stroke(); ctx.setLineDash([]);
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }
}
