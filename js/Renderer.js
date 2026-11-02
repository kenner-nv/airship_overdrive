/* ==========================================================================
   Renderer.js — desenha a arena no Canvas 2D (coordenadas LÓGICAS: largura fixa de 540).
   Só lê o estado do jogo; nunca altera a simulação. O fundo (estrelas) rola só quando o jogo avança.
   ========================================================================== */
import { Art, PALETTE } from "./Art.js";
import { WEAPONS } from "./data/Weapons.js";
import { SUPPORTS } from "./data/Supports.js";
import { CONFIG } from "./data/Config.js";
import { centerSlot } from "./SupportSystem.js";
import { bossHp } from "./EnemyAbilities.js";

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
      if (p.pull > 0) {                                   // item puxado pelo Ímã: rastro curto e discreto atrás dele
        const sp = Math.hypot(p.vx, p.vy) || 1, len = Math.min(16, p.pull * 0.03);
        ctx.setTransform(S, 0, 0, S, 0, 0);
        ctx.globalAlpha = 0.3; ctx.strokeStyle = SUPPORTS.magnet.color; ctx.lineWidth = 1.5; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - (p.vx / sp) * len, p.y - (p.vy / sp) * len); ctx.stroke();
        ctx.globalAlpha = 1; ctx.lineCap = "butt";
      }
      this.blit(p.kind === "star" ? "pickup.star" : "pickup.heart", p.x, p.y, p.kind === "star" ? Math.sin(p.t * 3) * 0.3 : 0, p.kind === "star" ? 1 : 1 + Math.sin(p.t * 5) * 0.08);
    }

    // tiros do jogador (o disparo carregado da Vanguarda é maior e tem um halo dourado)
    for (const s of g.weapons.shots.active) {
      if (s.special) {
        ctx.setTransform(S, 0, 0, S, 0, 0);
        ctx.globalAlpha = 0.35; ctx.fillStyle = "#ffd24a";
        ctx.beginPath(); ctx.arc(s.x, s.y, 11, 0, 6.2832); ctx.fill(); ctx.globalAlpha = 1;
        this.blit(`shot.${s.kind}`, s.x, s.y, s.ang, 1.7);
      } else this.blit(`shot.${s.kind}`, s.x, s.y, s.ang, s.sc);
    }
    ctx.setTransform(S, 0, 0, S, 0, 0);

    this.drawBombs(ctx);
    this.drawEnemies(ctx);
    this.drawBeams(ctx);
    this.drawRays(ctx);
    this.drawZones(ctx);

    // tiros inimigos (por cima, para leitura)
    for (const b of g.enemies.shots.active) {
      const ang = Math.atan2(b.vy, b.vx) + Math.PI / 2;
      if (b.kind === "missile") this.blit("shot.emissile", b.x, b.y, ang);
      else if (b.kind === "micro") this.blit("shot.micro", b.x, b.y, ang);
      else if (b.kind === "snipe") {                          // tiro de franco-atirador: traço longo e brilhante
        ctx.setTransform(S, 0, 0, S, 0, 0);
        const sp = Math.hypot(b.vx, b.vy) || 1, ux = b.vx / sp, uy = b.vy / sp;
        ctx.lineCap = "round"; ctx.strokeStyle = "rgba(255,77,109,.45)"; ctx.lineWidth = 8;
        ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - ux * 26, b.y - uy * 26); ctx.stroke();
        ctx.strokeStyle = "#fff"; ctx.lineWidth = 3.2;
        ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - ux * 18, b.y - uy * 18); ctx.stroke();
        ctx.lineCap = "butt";
      } else this.blit("shot.enemy", b.x, b.y, 0);
      if (b.slowT > 0) { ctx.setTransform(S, 0, 0, S, 0, 0); ctx.globalAlpha = 0.5; ctx.strokeStyle = "#ffe03a"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 4, 0, 6.2832); ctx.stroke(); ctx.globalAlpha = 1; }
    }
    ctx.setTransform(S, 0, 0, S, 0, 0);

    if (g.ship.alive) { this.drawShip(ctx); this.drawSupports(ctx); }
    g.vfx.draw(ctx);

    this.drawBossBar(ctx);
    if (g.jamT > 0) {                                      // sistemas desligados: contorno amarelo tremulante + aviso
      const sh = g.ship;
      ctx.globalAlpha = 0.45 + 0.35 * Math.sin(g.clock * 30); ctx.strokeStyle = "#ffd24a"; ctx.lineWidth = 2; ctx.setLineDash([6, 5]);
      ctx.beginPath(); ctx.arc(sh.x, sh.y, 40, 0, 6.2832); ctx.stroke(); ctx.setLineDash([]);
      ctx.globalAlpha = 1; ctx.fillStyle = "#ffd24a"; ctx.font = "800 12px system-ui, sans-serif"; ctx.textAlign = "center";
      ctx.fillText(`Interferência ${g.jamT.toFixed(1)}s`, sh.x, sh.y - 52);
    }
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

  // Cor do escudo adaptativo = arma que mais feriu o inimigo nos últimos segundos.
  adaptColor(kind) { return kind === "drone" ? SUPPORTS.attackDrone.color : WEAPONS[kind]?.color ?? "#ffffff"; }

  drawAim(ctx, a) {
    const H = this.game.world.height + 200, k = Math.min(1, a.k);
    ctx.globalAlpha = a.locked ? 0.95 : 0.25 + 0.4 * k;
    ctx.strokeStyle = a.locked ? "#ffffff" : "#ff4d6d"; ctx.lineWidth = a.locked ? 2 : 1.4;
    if (!a.locked) ctx.setLineDash([8, 6]);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(a.x + Math.cos(a.ang) * H * 2, a.y + Math.sin(a.ang) * H * 2); ctx.stroke();
    ctx.setLineDash([]); ctx.globalAlpha = 1;
  }

  drawEnemies(ctx) {
    const g = this.game, S = this.s;
    for (const e of g.enemies.list) {
      if (e.dead) continue;
      ctx.setTransform(S, 0, 0, S, 0, 0);
      for (const a of e.aims) this.drawAim(ctx, a);
      for (const r of e.rings) {                           // anéis de aviso das habilidades
        const x = r.x ?? e.x, y = r.y ?? e.y;
        if (r.fillA) { ctx.globalAlpha = r.fillA; ctx.fillStyle = r.color; ctx.beginPath(); ctx.arc(x, y, r.r, 0, 6.2832); ctx.fill(); }
        ctx.globalAlpha = r.a; ctx.strokeStyle = r.color; ctx.lineWidth = r.w;
        if (r.dash) ctx.setLineDash([8, 7]);
        ctx.beginPath(); ctx.arc(x, y, r.r, 0, 6.2832); ctx.stroke(); ctx.setLineDash([]);
      }
      ctx.globalAlpha = 1;
      const al = e.alpha ?? 1;
      if (al < 1) ctx.globalAlpha = al;
      Art.draw(ctx, e.def.sprite, e.x, e.y, 0, 1, al);
      if (e.flash > 0) Art.drawFlash(ctx, e.def.sprite, e.x, e.y, Math.min(0.85, (e.flash / 0.08) * 0.85) * al);
      ctx.globalAlpha = 1;
      if (e.carriesHeal) this.blit("pickup.heart", e.x, e.y - e.r - 12, 0, 0.75 + Math.sin(g.clock * 6) * 0.06);   // este inimigo derruba vida
      ctx.setTransform(S, 0, 0, S, 0, 0);
      if (e.slowT > 0) { ctx.globalAlpha = 0.55; ctx.strokeStyle = "#ffe03a"; ctx.lineWidth = 1.6; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 3, 0, 6.2832); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1; }
      if (e.invuln) {                                      // invulnerável: casca hexagonal
        const k = 0.45 + 0.15 * Math.sin(g.clock * 5) + (e.ping > 0 ? 0.4 : 0);
        ctx.globalAlpha = Math.min(1, k); ctx.strokeStyle = "#7cf3ff"; ctx.lineWidth = 2.4; ctx.fillStyle = "rgba(124,243,255,.10)";
        ctx.beginPath();
        for (let i = 0; i < 6; i++) { const a = (i / 6) * 6.2832 + g.clock * 0.4, px = e.x + Math.cos(a) * (e.r + 6), py = e.y + Math.sin(a) * (e.r + 6); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
        ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.globalAlpha = 1;
      }
      const dom = e.ab?.dom;
      if (dom) {                                           // escudo adaptativo: a cor mostra a arma à qual ele resiste
        const col = this.adaptColor(dom);
        ctx.globalAlpha = 0.5 + 0.2 * Math.sin(g.clock * 6); ctx.strokeStyle = col; ctx.lineWidth = 3.4;
        ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 7, 0, 6.2832); ctx.stroke();
        ctx.globalAlpha = 0.12; ctx.fillStyle = col; ctx.fill(); ctx.globalAlpha = 1;
      }
      if (e.parts) for (const pt of e.parts) {             // torres / satélites
        if (pt.dead) continue;
        const key = pt.kind === "turret" ? "part.turret" : "part.sat";
        if (pt.glow > 0) { ctx.globalAlpha = 0.25 + 0.4 * pt.glow; ctx.fillStyle = "#ff4d6d"; ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.r + 4 + 4 * pt.glow, 0, 6.2832); ctx.fill(); ctx.globalAlpha = 1; }
        Art.draw(ctx, key, pt.x, pt.y);
        if (pt.flash > 0) { Art.drawFlash(ctx, key, pt.x, pt.y, 0.8); }
        ctx.setTransform(S, 0, 0, S, 0, 0);
        if (pt.hp < pt.maxHp) {
          const bw = pt.r * 2, by = pt.y - pt.r - 7;
          ctx.fillStyle = "rgba(0,0,0,.6)"; ctx.fillRect(pt.x - bw / 2, by, bw, 3.5);
          ctx.fillStyle = "#ffae3d"; ctx.fillRect(pt.x - bw / 2, by, bw * Math.max(0, pt.hp / pt.maxHp), 3.5);
        }
      }
      if (e.charge > 0) {                                  // aviso: vai atirar
        ctx.globalAlpha = 0.35 + 0.5 * e.charge;
        ctx.strokeStyle = PALETTE.enemyShot; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 5 + (1 - e.charge) * 8, 0, 6.2832); ctx.stroke();
        ctx.globalAlpha = 1;
      }
      if (!e.def.special && e.maxHp >= 60 && e.hp < e.maxHp) {   // barra de vida dos resistentes (os chefes têm a barra do topo)
        const bw = e.r * 1.8, by = e.y - e.r - 10;
        ctx.fillStyle = "rgba(0,0,0,.6)"; ctx.fillRect(e.x - bw / 2, by, bw, 4);
        ctx.fillStyle = PALETTE.hpLow; ctx.fillRect(e.x - bw / 2, by, bw * Math.max(0, e.hp / e.maxHp), 4);
      }
    }
  }

  // Barra de vida do chefe (corpo + torres/satélites vivos), no topo da arena.
  drawBossBar(ctx) {
    const g = this.game, boss = g.enemies.list.find((e) => e.def.special && !e.dead && e.y > 0);
    if (!boss) return;
    const { hp, max } = bossHp(boss), w = g.world.width, bw = w * 0.62, x = (w - bw) / 2, y = 74;
    ctx.setTransform(this.s, 0, 0, this.s, 0, 0);
    ctx.globalAlpha = 0.9; ctx.fillStyle = "rgba(0,0,0,.65)"; ctx.fillRect(x - 2, y - 2, bw + 4, 12);
    ctx.fillStyle = "#ff5470"; ctx.fillRect(x, y, bw * Math.max(0, hp / max), 8);
    ctx.fillStyle = "#fff"; ctx.font = "800 10px system-ui, sans-serif"; ctx.textAlign = "center";
    ctx.fillText(boss.def.name.toUpperCase() + (boss.invuln ? " · INVULNERÁVEL" : ""), w / 2, y - 5);
    ctx.globalAlpha = 1;
  }

  drawRays(ctx) {
    const g = this.game, L = Math.hypot(g.world.width, g.world.height) * 1.5;
    ctx.setTransform(this.s, 0, 0, this.s, 0, 0);
    for (const r of g.enemies.rays) {
      const ex = r.x + Math.cos(r.ang) * L, ey = r.y + Math.sin(r.ang) * L;
      if (!r.fired) {
        const k = r.t / r.warn;
        ctx.globalAlpha = 0.3 + 0.4 * Math.abs(Math.sin(k * 14)); ctx.strokeStyle = r.color; ctx.lineWidth = 1.5 + k * 2; ctx.setLineDash([10, 8]);
        ctx.beginPath(); ctx.moveTo(r.x, r.y); ctx.lineTo(ex, ey); ctx.stroke(); ctx.setLineDash([]);
      } else {
        const f = 1 - (r.t - r.warn) / r.dur;
        ctx.lineCap = "butt";
        ctx.globalAlpha = 0.3 * f + 0.2; ctx.strokeStyle = r.color; ctx.lineWidth = r.w * 1.9;
        ctx.beginPath(); ctx.moveTo(r.x, r.y); ctx.lineTo(ex, ey); ctx.stroke();
        ctx.globalAlpha = 0.9; ctx.strokeStyle = "#ffe3f2"; ctx.lineWidth = r.w;
        ctx.beginPath(); ctx.moveTo(r.x, r.y); ctx.lineTo(ex, ey); ctx.stroke();
        ctx.strokeStyle = "#fff"; ctx.lineWidth = r.w * 0.34;
        ctx.beginPath(); ctx.moveTo(r.x, r.y); ctx.lineTo(ex, ey); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  }

  // Zonas de impacto orbital: anel que se fecha (aviso) → coluna de luz.
  drawZones(ctx) {
    const g = this.game;
    ctx.setTransform(this.s, 0, 0, this.s, 0, 0);
    for (const z of g.enemies.zones) {
      if (!z.fired) {
        const k = z.t / z.warn;
        ctx.globalAlpha = 0.12 + 0.18 * k; ctx.fillStyle = "#ff3d8b"; ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, 6.2832); ctx.fill();
        ctx.globalAlpha = 0.5 + 0.4 * Math.abs(Math.sin(k * 12)); ctx.strokeStyle = "#ff7ad9"; ctx.lineWidth = 2.4; ctx.setLineDash([7, 6]);
        ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, 6.2832); ctx.stroke(); ctx.setLineDash([]);
        ctx.globalAlpha = 0.8; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(z.x, z.y, z.r * (1 - k), 0, 6.2832); ctx.stroke();
      } else {
        const f = Math.max(0, z.flash / 0.35);
        ctx.globalAlpha = 0.8 * f; ctx.fillStyle = "#ffd0f0"; ctx.fillRect(z.x - z.r * 0.7, 0, z.r * 1.4, z.y);
        ctx.globalAlpha = 0.4 * f; ctx.fillStyle = "#ff3d8b"; ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, 6.2832); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  // Couraçado Explosivo destruído: sprite piscando + raio da explosão.
  drawBombs(ctx) {
    const g = this.game;
    for (const b of g.enemies.bombs) {
      ctx.setTransform(this.s, 0, 0, this.s, 0, 0);
      const k = Math.min(1, b.t / b.fuse), blink = Math.floor(b.t * (8 + 14 * k)) % 2;
      ctx.globalAlpha = 0.12 + 0.2 * k; ctx.fillStyle = "#ff7a2e"; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 6.2832); ctx.fill();
      ctx.globalAlpha = 0.6; ctx.strokeStyle = "#ffb347"; ctx.lineWidth = 2; ctx.setLineDash([8, 6]); ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 6.2832); ctx.stroke(); ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      Art.draw(ctx, b.sprite, b.x, b.y);
      if (blink) Art.drawFlash(ctx, b.sprite, b.x, b.y, 0.7);
      ctx.globalAlpha = 1;
    }
  }

  drawShip(ctx) {
    const g = this.game, ship = g.ship, def = ship.def, t = g.clock;
    for (const tr of ship.trail) Art.draw(ctx, def.sprite, tr.x, tr.y, 0, 1, Math.max(0, tr.a) * 0.6);   // rastro da esquiva

    ctx.save();
    ctx.translate(ship.x, ship.y);
    // inclinação em PERSPECTIVA (asas): achata um pouco a largura e desnivela as asas, sem girar a nave
    const flip = ship.flip;
    const ln = flip ? 0 : ship.lean || 0;           // durante a esquiva não há inclinação (ela somava uma rotação estranha antes do giro)
    ctx.transform(1 - CONFIG.ship.leanSqueeze * Math.abs(ln), -ln * CONFIG.ship.leanTilt, 0, 1, 0, 0);
    if (flip) {                                    // flip visual: gira só em torno do eixo dominante (horizontal ou vertical), sem apontar para a diagonal
      const c = Math.cos(flip.p * Math.PI * 2);
      if (Math.abs(flip.dx) >= Math.abs(flip.dy)) ctx.scale(1, c); else ctx.scale(c, 1);
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

    // slots: só os OCUPADOS aparecem (ícone da arma acoplada). Slot vazio não desenha nada durante a partida.
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
      }
    }
    // módulo de suporte (slot traseiro): ícone pequeno; fica apagado enquanto recarrega
    const sup = g.supports;
    if (sup.moduleId && sup.slotDef) {
      const ic = Art.get(`icon.${sup.moduleId}`), sz = CONFIG.slotIcon.supportSize;
      ctx.globalAlpha = alpha * (sup.fx ? 1 : 0.45);
      ctx.drawImage(ic.img, sup.slotDef.x - sz / 2, sup.slotDef.y - sz / 2, sz, sz);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // Escudo (bolha em volta da nave) e drones. Só leitura do estado de g.supports.
  drawSupports(ctx) {
    const g = this.game, sup = g.supports, ship = g.ship, S = this.s;
    ctx.setTransform(S, 0, 0, S, 0, 0);

    const sh = sup.shield;
    if (sh) {
      const col = sup.def.color, k = Math.min(1, sh.t / 0.3), r = sh.r * (0.55 + 0.45 * (1 - (1 - k) * (1 - k)));
      const low = sh.hp < sh.max, flick = low ? (0.75 + 0.25 * Math.sin(g.clock * 22)) : 1;     // última carga: tremula
      const base = (ship.dash ? 0.35 : 1) * flick;
      const gr = ctx.createRadialGradient(ship.x, ship.y, r * 0.35, ship.x, ship.y, r);
      gr.addColorStop(0, "rgba(95,243,255,0)"); gr.addColorStop(0.75, `rgba(95,243,255,${0.10 * base})`); gr.addColorStop(1, `rgba(95,243,255,${0.34 * base})`);
      ctx.fillStyle = gr;
      ctx.beginPath(); ctx.arc(ship.x, ship.y, r, 0, 6.2832); ctx.fill();
      ctx.globalAlpha = (0.55 + 0.25 * Math.sin(g.clock * 3)) * base;
      ctx.strokeStyle = low ? "#9fe9ff" : col; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(ship.x, ship.y, r - 1, 0, 6.2832); ctx.stroke();
      ctx.globalAlpha = 0.5 * base; ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 2.2;      // brilho no canto
      ctx.beginPath(); ctx.arc(ship.x, ship.y, r - 4, Math.PI * 1.12, Math.PI * 1.45); ctx.stroke();
      if (sh.flash > 0) { ctx.globalAlpha = Math.min(0.5, sh.flash * 2.4); ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.arc(ship.x, ship.y, r, 0, 6.2832); ctx.fill(); }
      ctx.globalAlpha = 1;
    }

    // Ímã: UM único anel fino que se fecha em direção à nave a cada ~1 s (bem discreto, para não poluir a tela)
    const mg = sup.magnet;
    if (mg) {
      const fade = Math.min(1, mg.t / 0.3) * Math.min(1, mg.left / 0.4), ph = (mg.t % 1.1) / 1.1;
      ctx.globalAlpha = 0.28 * fade * Math.sin(ph * Math.PI);
      ctx.strokeStyle = sup.def.color; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(ship.x, ship.y, 14 + 54 * (1 - ph), 0, 6.2832); ctx.stroke();
      ctx.globalAlpha = 1;
    }

    for (const d of sup.drones) {
      const col = sup.def.color, key = `support.${d.kind}`, k = Math.min(1, d.t / 0.35);
      const bob = Math.sin(d.bob * 5) * 1.6;
      if (d.kind === "healDrone" && d.healing) {                     // raio de cura até a nave
        ctx.globalAlpha = 0.35 + 0.3 * Math.sin(g.clock * 14);
        ctx.strokeStyle = col; ctx.lineWidth = 2.4; ctx.setLineDash([5, 5]); ctx.lineDashOffset = -g.clock * 40;
        ctx.beginPath(); ctx.moveTo(d.x, d.y + bob); ctx.lineTo(ship.x, ship.y); ctx.stroke();
        ctx.setLineDash([]); ctx.lineDashOffset = 0; ctx.globalAlpha = 1;
      }
      ctx.globalAlpha = 0.28; ctx.fillStyle = d.kind === "attackDrone" ? "#9b5cff" : col;     // halo (drone de ataque: roxo)
      ctx.beginPath(); ctx.arc(d.x, d.y + bob, 15 * k, 0, 6.2832); ctx.fill(); ctx.globalAlpha = 1;
      ctx.globalAlpha = d.flash > 0 && Math.floor(g.clock * 30) % 2 ? 0.4 : 1;                // pisca ao levar dano
      Art.draw(ctx, key, d.x, d.y + bob, d.kind === "attackDrone" ? d.aim : 0, 0.35 + 0.65 * k, ctx.globalAlpha);
      ctx.globalAlpha = 1;
      ctx.setTransform(S, 0, 0, S, 0, 0);
    }
    if (sup.clone) this.drawClone(ctx, sup.clone);
  }

  // Versão "holograma" do sprite da nave (cache): tingido de azul, com linhas de varredura e contorno brilhante.
  holoSprite(key, color) {
    this.holo ??= new Map();
    let cv = this.holo.get(key);
    if (cv) return cv;
    const sp = Art.get(key), K = 2, pad = 3;
    cv = document.createElement("canvas");
    cv.width = Math.ceil(sp.w * K) + pad * 2; cv.height = Math.ceil(sp.h * K) + pad * 2;
    const c = cv.getContext("2d");
    c.drawImage(sp.img, pad, pad, sp.w * K, sp.h * K);
    c.globalCompositeOperation = "source-atop";
    c.fillStyle = color; c.globalAlpha = 0.72; c.fillRect(0, 0, cv.width, cv.height);     // tinge tudo de azul
    c.globalAlpha = 0.25; c.fillStyle = "#ffffff"; c.fillRect(0, 0, cv.width, cv.height);
    c.globalCompositeOperation = "destination-out"; c.globalAlpha = 0.5;                  // linhas de varredura
    for (let y = 0; y < cv.height; y += 4) c.fillRect(0, y, cv.width, 1.6);
    c.globalAlpha = 1; c.globalCompositeOperation = "source-over";
    cv.pad = pad / K;
    this.holo.set(key, cv);
    return cv;
  }

  // Clone holográfico: nave azul translúcida, com cintilação, faixa de varredura, falhas (glitch) e a(s) arma(s) acopladas.
  drawClone(ctx, c) {
    const g = this.game, ship = g.ship, def = ship.def, sup = g.supports, col = sup.def.color, t = g.clock;
    const sp = Art.get(def.sprite), cv = this.holoSprite(def.sprite, col), pad = cv.pad;
    const appear = Math.min(1, c.t / 0.45), flick = 0.62 + 0.18 * Math.sin(t * 17 + 1.3) + (Math.sin(t * 53) > 0.93 ? -0.25 : 0);
    let alpha = Math.max(0.25, flick) * appear;
    if (c.iframes > 0) alpha *= Math.floor(t * 18) % 2 ? 0.5 : 1;
    const w = sp.w + pad * 2, h = sp.h + pad * 2;
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.transform(1 - CONFIG.ship.leanSqueeze * Math.abs(c.lean), -c.lean * CONFIG.ship.leanTilt, 0, 1, 0, 0);
    ctx.scale(1, 0.4 + 0.6 * appear);                                                       // "liga" verticalmente ao aparecer
    // chamas dos motores (azuis)
    ctx.fillStyle = col; ctx.globalAlpha = alpha * 0.8;
    for (const en of def.engines) {
      const len = 8 + Math.sin(t * 40 + en.x) * 3;
      ctx.beginPath(); ctx.moveTo(en.x - 3, en.y); ctx.lineTo(en.x + 3, en.y); ctx.lineTo(en.x, en.y + len); ctx.closePath(); ctx.fill();
    }
    // brilho externo (cópia maior e fraca) + corpo
    ctx.globalAlpha = alpha * 0.28;
    ctx.drawImage(cv, -w * 0.54, -h * 0.54, w * 1.08, h * 1.08);
    ctx.globalAlpha = alpha;
    const glitch = Math.sin(t * 7.3) > 0.9 ? Math.sin(t * 91) * 3 : 0;                      // às vezes, uma fatia desliza de lado
    if (glitch) {
      const y0 = -h / 2 + ((t * 40) % 1) * h * 0.6, hh = h * 0.18;
      ctx.drawImage(cv, 0, (y0 + h / 2) * 2, cv.width, hh * 2, -w / 2 + glitch, y0, w, hh);
    }
    ctx.drawImage(cv, -w / 2, -h / 2, w, h);
    // faixa de varredura que sobe e desce
    const band = ((t * 0.9) % 1) * h - h / 2;
    ctx.save(); ctx.beginPath(); ctx.rect(-w, band, w * 2, 5); ctx.clip();
    ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = alpha * 0.9;
    ctx.drawImage(cv, -w / 2, -h / 2, w, h);
    ctx.restore();
    // armas do clone: só o ícone de cada slot ativo, em azul
    const st = sup.stats, slots = st.allSlots ? g.weapons.slotList : [centerSlot(g.weapons.slotList)];
    ctx.globalCompositeOperation = "source-over";
    for (const slot of slots) {
      if (!slot?.weaponId) continue;
      const sd = slot.def, ic = Art.get(`icon.${slot.weaponId}`), cfg = CONFIG.slotIcon;
      const o = { ...cfg, ...(cfg.perWeapon[slot.weaponId] ?? {}), ...(cfg.perSlot[`${def.id}.${sd.id}`] ?? {}) };
      ctx.save(); ctx.translate(sd.x, sd.y);
      ctx.rotate((o.followSlotAngle ? sd.angle || 0 : 0) + ((o.rotationDeg || 0) * Math.PI) / 180);
      ctx.globalAlpha = alpha * 0.85;
      ctx.drawImage(ic.img, -o.size / 2, -o.size / 2, o.size, o.size);
      ctx.restore();
    }
    ctx.restore();
    // barra de vida do clone NÃO é mostrada (só no HUD, pela barra do módulo); dano = flash branco
    if (c.flash > 0) {
      ctx.globalAlpha = Math.min(0.5, c.flash * 1.6);
      ctx.drawImage(Art.flashOf(def.sprite), c.x - sp.w / 2, c.y - sp.h / 2, sp.w, sp.h);
      ctx.globalAlpha = 1;
    }
    ctx.globalAlpha = 1;
  }
}
