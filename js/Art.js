/* ==========================================================================
   Art.js — arte PROVISÓRIA desenhada em código + carregamento de imagens definitivas.
   Cada sprite é pedido por chave (ex.: "ship.vanguarda"). Se a chave existir em
   IMAGE_OVERRIDES (data/Assets.js) a imagem é usada; senão, o desenho provisório abaixo.
   Os desenhos são renderizados UMA vez em um canvas fora da tela (rápido de desenhar a cada quadro).
   ========================================================================== */
import { IMAGE_OVERRIDES } from "./data/Assets.js";
import { WEAPONS } from "./data/Weapons.js";

export const PALETTE = {
  bgTop: "#04050d", bgBottom: "#0b1026",
  star: "#cfe6ff",
  enemyShot: "#ff4d6d",
  coin: "#ffd24a",
  hp: "#4dff9a", hpLow: "#ff5470",
  flash: "#ffffff",
};

const TAU = Math.PI * 2;
const SS = 2; // supersampling dos sprites provisórios

function poly(c, pts) {
  c.beginPath();
  c.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
  c.closePath();
}
function lin(c, x0, y0, x1, y1, stops) {
  const g = c.createLinearGradient(x0, y0, x1, y1);
  stops.forEach(([o, col]) => g.addColorStop(o, col));
  return g;
}
function rr(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}
function fillStroke(c, fill, stroke = "rgba(5,10,30,.85)", lw = 1.6) {
  c.fillStyle = fill; c.fill();
  c.strokeStyle = stroke; c.lineWidth = lw; c.lineJoin = "round"; c.stroke();
}

/* ------------------------------ naves ------------------------------ */
function drawVanguarda(c) {
  poly(c, [[0, -32], [8, -14], [30, 16], [30, 25], [12, 19], [8, 29], [0, 23], [-8, 29], [-12, 19], [-30, 25], [-30, 16], [-8, -14]]);
  fillStroke(c, lin(c, 0, -32, 0, 29, [[0, "#7ffaff"], [1, "#1b5cff"]]));
  poly(c, [[0, -27], [4, -8], [0, 16], [-4, -8]]);
  c.fillStyle = "rgba(255,255,255,.35)"; c.fill();
  c.fillStyle = "#ffb347"; rr(c, 21, 16, 5, 7, 1.5); c.fill(); rr(c, -26, 16, 5, 7, 1.5); c.fill();
  c.beginPath(); c.ellipse(0, -8, 4.2, 8, 0, 0, TAU); c.fillStyle = "#0a1a4a"; c.fill();
  c.beginPath(); c.ellipse(-1, -10, 1.4, 3, 0, 0, TAU); c.fillStyle = "rgba(160,240,255,.8)"; c.fill();
}
function drawTanque(c) {
  const dk = "#12493a";
  for (const [x, y, w, h] of [[-8, -40, 16, 14], [-8, 26, 16, 14], [-42, -8, 16, 16], [26, -8, 16, 16]]) {
    rr(c, x, y, w, h, 4); fillStroke(c, "#a8efd2", dk);
  }
  rr(c, -34, -17, 12, 34, 4); fillStroke(c, "#1f6b53", dk);
  rr(c, 22, -17, 12, 34, 4); fillStroke(c, "#1f6b53", dk);
  rr(c, -22, -28, 44, 56, 9); fillStroke(c, lin(c, 0, -28, 0, 28, [[0, "#52e0a8"], [1, "#16805f"]]), dk);
  c.beginPath(); c.arc(0, 0, 12, 0, TAU); fillStroke(c, "#0f3b2f", dk);
  c.beginPath(); c.arc(0, 0, 6.5, 0, TAU); c.strokeStyle = "#7dffcf"; c.lineWidth = 2; c.stroke();
  c.fillStyle = "rgba(255,255,255,.18)"; rr(c, -18, -25, 14, 5, 2); c.fill();
}
function drawEspectro(c) {
  poly(c, [[0, -31], [5, -9], [28, 21], [10, 15], [0, 29], [-10, 15], [-28, 21], [-5, -9]]);
  fillStroke(c, lin(c, 0, -31, 0, 29, [[0, "#ff8ae0"], [1, "#6a35ff"]]));
  poly(c, [[0, -24], [2.6, -6], [0, 12], [-2.6, -6]]);
  c.fillStyle = "rgba(255,255,255,.5)"; c.fill();
  c.beginPath(); c.ellipse(0, -9, 3, 6, 0, 0, TAU); c.fillStyle = "#26104d"; c.fill();
}

/* ------------------------------ inimigos (apontam para baixo) ------------------------------ */
function drawBasic(c) {
  poly(c, [[0, 17], [16, -2], [11, -16], [-11, -16], [-16, -2]]);
  fillStroke(c, lin(c, 0, -16, 0, 17, [[0, "#ff7a55"], [1, "#a8231c"]]));
  c.beginPath(); c.arc(0, -2, 5.5, 0, TAU); c.fillStyle = "#fff"; c.fill();
  c.beginPath(); c.arc(0, 0, 2.6, 0, TAU); c.fillStyle = "#33060a"; c.fill();
}
function drawFast(c) {
  poly(c, [[0, 18], [12, -15], [0, -8], [-12, -15]]);
  fillStroke(c, lin(c, 0, -15, 0, 18, [[0, "#ff7a1a"], [1, "#ffd93a"]]));
  poly(c, [[0, 11], [3, -6], [-3, -6]]);
  c.fillStyle = "#fff6c4"; c.fill();
}
function drawShooter(c) {
  rr(c, -4.5, 9, 9, 13, 2); fillStroke(c, "#ffe9a8", "#2a0b47");
  c.beginPath(); c.arc(0, -1, 16, 0, TAU);
  fillStroke(c, lin(c, 0, -17, 0, 15, [[0, "#d65cff"], [1, "#5a1aa6"]]), "#2a0b47");
  c.beginPath(); c.arc(0, -2, 8, 0, TAU); c.strokeStyle = "rgba(255,255,255,.4)"; c.lineWidth = 2; c.stroke();
  c.beginPath(); c.arc(0, -2, 4.2, 0, TAU); c.fillStyle = "#ffeb7a"; c.fill();
}
function drawTough(c) {
  const pts = []; for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU + TAU / 16; pts.push([Math.cos(a) * 27, Math.sin(a) * 27]); }
  poly(c, pts); fillStroke(c, lin(c, 0, -27, 0, 27, [[0, "#d04a4a"], [1, "#661a26"]]), "#25060b", 2);
  const inner = pts.map(([x, y]) => [x * 0.62, y * 0.62]);
  poly(c, inner); fillStroke(c, "#3b0d16", "#12030a", 1.5);
  c.fillStyle = "#ff9d6a"; for (const [x, y] of inner) { c.beginPath(); c.arc(x, y, 2, 0, TAU); c.fill(); }
  rr(c, -20, 18, 8, 12, 2); fillStroke(c, "#e6c9a8", "#25060b", 1.2);
  rr(c, 12, 18, 8, 12, 2); fillStroke(c, "#e6c9a8", "#25060b", 1.2);
  c.beginPath(); c.arc(0, 0, 6, 0, TAU); c.fillStyle = "#ffd2a6"; c.fill();
}
function drawWeaver(c) {
  poly(c, [[0, 19], [6, 6], [19, 0], [6, -6], [0, -19], [-6, -6], [-19, 0], [-6, 6]]);
  fillStroke(c, lin(c, -19, -19, 19, 19, [[0, "#ff5fe0"], [1, "#7c1cff"]]), "#1d0a3d");
  c.beginPath(); c.arc(0, 0, 5.5, 0, TAU); c.fillStyle = "#fff3a8"; c.fill();
}
function drawElite(c) {
  poly(c, [[0, 47], [34, 15], [47, -20], [23, -42], [-23, -42], [-47, -20], [-34, 15]]);
  fillStroke(c, lin(c, 0, -42, 0, 47, [[0, "#e03a54"], [1, "#4a0d1c"]]), "#1a0309", 2.5);
  poly(c, [[0, 32], [22, 10], [30, -14], [14, -30], [-14, -30], [-30, -14], [-22, 10]]);
  fillStroke(c, "#2a0610", "#ffcf5a", 2);
  for (const x of [-30, 30]) { rr(c, x - 5, 18, 10, 22, 3); fillStroke(c, "#ffdd8a", "#1a0309", 1.5); }
  c.beginPath(); c.arc(0, -2, 11, 0, TAU); c.fillStyle = "#ffcf5a"; c.fill();
  c.beginPath(); c.arc(0, -2, 5.5, 0, TAU); c.fillStyle = "#ff3d5a"; c.fill();
}

function drawLauncher(c) {
  poly(c, [[0, 20], [15, 8], [19, -6], [10, -19], [-10, -19], [-19, -6], [-15, 8]]);
  fillStroke(c, lin(c, 0, -19, 0, 20, [[0, "#ffae3d"], [1, "#9a3b0c"]]), "#2a0f03");
  for (const x of [-11, 11]) { rr(c, x - 4, 4, 8, 17, 3); fillStroke(c, "#3b3f52", "#10121c", 1.4); c.beginPath(); c.arc(x, 20, 3, 0, TAU); c.fillStyle = "#ff4d6d"; c.fill(); }
  c.beginPath(); c.arc(0, -3, 6, 0, TAU); c.fillStyle = "#fff3a8"; c.fill();
}
function drawBeamer(c) {
  poly(c, [[0, 18], [14, 4], [20, -12], [8, -20], [-8, -20], [-20, -12], [-14, 4]]);
  fillStroke(c, lin(c, 0, -20, 0, 18, [[0, "#5a7bff"], [1, "#1c1f6b"]]), "#080a2a");
  rr(c, -4.5, 6, 9, 18, 3); fillStroke(c, "#2b2f5e", "#080a2a", 1.4);
  c.beginPath(); c.arc(0, 23, 4.2, 0, TAU); c.fillStyle = "#ff4d6d"; c.fill();
  c.beginPath(); c.arc(0, -4, 7, 0, TAU); c.fillStyle = "#bfe0ff"; c.fill();
  c.beginPath(); c.arc(0, -4, 3, 0, TAU); c.fillStyle = "#ff4d6d"; c.fill();
}
function drawElite2(c) {
  poly(c, [[0, 50], [30, 26], [50, -8], [38, -34], [14, -48], [-14, -48], [-38, -34], [-50, -8], [-30, 26]]);
  fillStroke(c, lin(c, 0, -48, 0, 50, [[0, "#9b4dff"], [1, "#2a0a5e"]]), "#0d0220", 2.5);
  poly(c, [[0, 34], [20, 16], [32, -6], [20, -26], [-20, -26], [-32, -6], [-20, 16]]);
  fillStroke(c, "#16063a", "#7cf3ff", 2);
  for (const x of [-26, 26]) { rr(c, x - 5, 20, 10, 28, 3); fillStroke(c, "#d6c2ff", "#0d0220", 1.5); }
  c.beginPath(); c.arc(0, -6, 14, 0, TAU); c.fillStyle = "#7cf3ff"; c.fill();
  c.beginPath(); c.arc(0, -6, 7, 0, TAU); c.fillStyle = "#ff3d8b"; c.fill();
}

/* ------------------------------ projéteis (apontam para cima) ------------------------------ */
function drawShotBasic(c) { rr(c, -3.4, -9, 6.8, 18, 3.4); c.fillStyle = "#5ff3ff"; c.fill(); rr(c, -1.3, -6, 2.6, 12, 1.3); c.fillStyle = "#eaffff"; c.fill(); }
function drawShotLaser(c) {
  rr(c, -3.4, -22, 6.8, 44, 3.4); c.fillStyle = "rgba(182,255,90,.35)"; c.fill();
  rr(c, -1.8, -22, 3.6, 44, 1.8); c.fillStyle = "#b6ff5a"; c.fill();
  rr(c, -0.7, -20, 1.4, 40, 0.7); c.fillStyle = "#fff"; c.fill();
}
function drawShotMissile(c) {
  poly(c, [[0, 15], [3.5, 9], [-3.5, 9]]); c.fillStyle = "#ff8a2a"; c.fill();
  rr(c, -3.4, -9, 6.8, 19, 2); c.fillStyle = "#ffd24a"; c.fill();
  poly(c, [[0, -15], [3.4, -9], [-3.4, -9]]); c.fillStyle = "#ff4d4d"; c.fill();
  poly(c, [[-3.4, 4], [-7, 11], [-3.4, 10]]); c.fillStyle = "#ffb347"; c.fill();
  poly(c, [[3.4, 4], [7, 11], [3.4, 10]]); c.fill();
}
function drawShotSpread(c) { c.beginPath(); c.arc(0, 0, 4.6, 0, TAU); c.fillStyle = "#7cffb2"; c.fill(); c.beginPath(); c.arc(0, 0, 2, 0, TAU); c.fillStyle = "#fff"; c.fill(); }
function drawShotEnemy(c) {
  c.beginPath(); c.arc(0, 0, 8.5, 0, TAU); c.fillStyle = "rgba(255,77,109,.28)"; c.fill();
  poly(c, [[0, -8], [7, 0], [0, 8], [-7, 0]]); c.fillStyle = "#ff4d6d"; c.fill();
  poly(c, [[0, -3.6], [3.4, 0], [0, 3.6], [-3.4, 0]]); c.fillStyle = "#fff"; c.fill();
}

function drawShotEnemyMissile(c) {
  poly(c, [[0, -13], [4.5, -5], [4.5, 8], [-4.5, 8], [-4.5, -5]]); fillStroke(c, "#ff4d6d", "#3a0614", 1.2);
  poly(c, [[4.5, 4], [9, 12], [4.5, 11]]); c.fillStyle = "#ffae3d"; c.fill();
  poly(c, [[-4.5, 4], [-9, 12], [-4.5, 11]]); c.fillStyle = "#ffae3d"; c.fill();
  c.beginPath(); c.arc(0, 11, 3.4, 0, TAU); c.fillStyle = "#fff3a8"; c.fill();
}

/* ------------------------------ coletáveis ------------------------------ */
function drawStar(c) {
  const pts = [];
  for (let i = 0; i < 10; i++) { const r = i % 2 ? 3.2 : 7, a = -Math.PI / 2 + (i * Math.PI) / 5; pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
  poly(c, pts); fillStroke(c, "#ffd24a", "rgba(120,70,0,.9)", 1);
  c.beginPath(); c.arc(0, 0, 1.7, 0, TAU); c.fillStyle = "#fff6c4"; c.fill();
}
function drawHeart(c) {                       // ESCUDO verde de cura (não se confunde com tiros vermelhos)
  c.beginPath();
  c.moveTo(0, -10); c.bezierCurveTo(4, -7.5, 8, -7, 9.5, -7); c.lineTo(9.5, 0);
  c.bezierCurveTo(9.5, 6, 4.5, 9, 0, 11); c.bezierCurveTo(-4.5, 9, -9.5, 6, -9.5, 0); c.lineTo(-9.5, -7);
  c.bezierCurveTo(-8, -7, -4, -7.5, 0, -10); c.closePath();
  fillStroke(c, lin(c, 0, -10, 0, 11, [[0, "#5dff9d"], [1, "#0f8f4d"]]), "#eafff3", 1.6);
  c.beginPath(); c.moveTo(0, -6); c.lineTo(5.6, -4.4); c.lineTo(5.6, 0); c.bezierCurveTo(5.6, 3.6, 2.8, 5.6, 0, 7); c.bezierCurveTo(-2.8, 5.6, -5.6, 3.6, -5.6, 0); c.lineTo(-5.6, -4.4); c.closePath();
  c.fillStyle = "rgba(234,255,243,.35)"; c.fill();
}

/* ------------------------------ ícones das armas (menu) ------------------------------ */
function iconFrame(c, color) {
  c.beginPath(); c.arc(0, 0, 21, 0, TAU); c.fillStyle = "rgba(10,14,34,.9)"; c.fill();
  c.strokeStyle = color; c.lineWidth = 2; c.stroke();
}
const ICONS = {
  basic(c, col) { iconFrame(c, col); rr(c, -3.6, -12, 7.2, 24, 3.6); c.fillStyle = col; c.fill(); rr(c, -1.3, -9, 2.6, 18, 1.3); c.fillStyle = "#fff"; c.fill(); },
  laser(c, col) { iconFrame(c, col); rr(c, -2.2, -14, 4.4, 28, 2.2); c.fillStyle = col; c.fill(); rr(c, -0.8, -13, 1.6, 26, 0.8); c.fillStyle = "#fff"; c.fill(); },
  missile(c, col) { iconFrame(c, col); c.save(); c.rotate(0.5); poly(c, [[0, 15], [4, 8], [-4, 8]]); c.fillStyle = "#ff8a2a"; c.fill(); rr(c, -4, -9, 8, 18, 2); c.fillStyle = col; c.fill(); poly(c, [[0, -15], [4, -9], [-4, -9]]); c.fillStyle = "#ff4d4d"; c.fill(); c.restore(); },
  spread(c, col) { iconFrame(c, col); c.fillStyle = col; for (const a of [-0.6, 0, 0.6]) { c.save(); c.rotate(a); rr(c, -2.4, -14, 4.8, 12, 2.4); c.fill(); c.restore(); } c.beginPath(); c.arc(0, 8, 3, 0, TAU); c.fill(); },
  area(c, col) { iconFrame(c, col); c.strokeStyle = col; c.lineWidth = 2.4; for (const r of [4, 9, 14]) { c.globalAlpha = 1 - r / 20; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.stroke(); } c.globalAlpha = 1; c.beginPath(); c.arc(0, 0, 2.5, 0, TAU); c.fillStyle = "#fff"; c.fill(); },
};

/* ------------------------------ tabela de sprites (tamanhos LÓGICOS em px) ------------------------------ */
const ART = {
  "ship.vanguarda": { w: 100, h: 72, draw: drawVanguarda },
  "ship.tanque": { w: 120, h: 120, draw: drawTanque },
  "ship.espectro": { w: 90, h: 60, draw: drawEspectro },
  "enemy.basic": { w: 38, h: 38, draw: drawBasic },
  "enemy.fast": { w: 32, h: 40, draw: drawFast },
  "enemy.shooter": { w: 43, h: 43, draw: drawShooter },
  "enemy.tough": { w: 62, h: 62, draw: drawTough },
  "enemy.weaver": { w: 42, h: 42, draw: drawWeaver },
  "enemy.elite": { w: 110, h: 110, draw: drawElite },
  "shot.basic": { w: 12, h: 22, draw: drawShotBasic },
  "shot.laser": { w: 12, h: 48, draw: drawShotLaser },
  "shot.missile": { w: 18, h: 34, draw: drawShotMissile },
  "shot.spread": { w: 14, h: 14, draw: drawShotSpread },
  "shot.enemy": { w: 22, h: 22, draw: drawShotEnemy },
  "shot.emissile": { w: 16, h: 30, draw: drawShotEnemyMissile },
  "enemy.launcher": { w: 50, h: 60, draw: drawLauncher },
  "enemy.beamer": { w: 46, h: 56, draw: drawBeamer },
  "enemy.elite2": { w: 120, h: 135, draw: drawElite2 },
  "pickup.star": { w: 14, h: 14, draw: drawStar },
  "pickup.heart": { w: 20, h: 20, draw: drawHeart },
};
for (const id of Object.keys(ICONS)) {
  ART[`icon.${id}`] = { w: 48, h: 48, draw: (c) => ICONS[id](c, WEAPONS[id].color) };                 // menu 
}

/* ------------------------------ API ------------------------------ */
const sprites = new Map();   // chave -> { img, w, h }
const flashes = new Map();   // chave -> canvas branco (silhueta de dano)
const iconUrls = new Map();

function proceduralCanvas(def) {
  const cv = document.createElement("canvas");
  cv.width = Math.ceil(def.w * SS); cv.height = Math.ceil(def.h * SS);
  const c = cv.getContext("2d");
  c.scale(SS, SS);
  c.translate(def.w / 2, def.h / 2);
  def.draw(c);
  return cv;
}

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => { console.warn(`[Art] não foi possível carregar ${src}; usando o provisório`); resolve(null); };
    img.src = src;
  });
}

export const Art = {
  // Cria todos os sprites. Imagens definitivas (IMAGE_OVERRIDES) são carregadas daqui; progresso real.
  async preload(onProgress = () => {}) {
    const keys = Object.keys(ART);
    const overrides = keys.filter((k) => IMAGE_OVERRIDES[k]);
    const total = overrides.length || 1;
    let done = 0;
    for (const k of keys) {
      const def = ART[k];
      if (!IMAGE_OVERRIDES[k]) sprites.set(k, { img: proceduralCanvas(def), w: def.w, h: def.h });
    }
    await Promise.all(overrides.map(async (k) => {
      const img = await loadImage(IMAGE_OVERRIDES[k]);
      sprites.set(k, img ? { img, w: ART[k].w, h: ART[k].h } : { img: proceduralCanvas(ART[k]), w: ART[k].w, h: ART[k].h });
      onProgress(++done / total);
    }));
    if (!overrides.length) onProgress(1);
  },

  get(key) { return sprites.get(key); },
  size(key) { const s = sprites.get(key) ?? ART[key]; return { w: s.w, h: s.h }; },

  // Desenha o sprite centrado em (x, y). rot em radianos (0 = como desenhado).
  draw(ctx, key, x, y, rot = 0, scale = 1, alpha = 1) {
    const s = sprites.get(key);
    if (!s) return;
    const w = s.w * scale, h = s.h * scale;
    if (rot === 0 && alpha === 1) { ctx.drawImage(s.img, x - w / 2, y - h / 2, w, h); return; }
    ctx.save();
    ctx.translate(x, y);
    if (rot) ctx.rotate(rot);
    if (alpha !== 1) ctx.globalAlpha = alpha;
    ctx.drawImage(s.img, -w / 2, -h / 2, w, h);
    ctx.restore();
  },

  // Silhueta branca do sprite (efeito de acerto), criada sob demanda.
  flashOf(key) {
    let f = flashes.get(key);
    if (f) return f;
    const s = sprites.get(key);
    f = document.createElement("canvas");
    f.width = Math.ceil(s.w * SS); f.height = Math.ceil(s.h * SS);
    const c = f.getContext("2d");
    c.drawImage(s.img, 0, 0, f.width, f.height);
    c.globalCompositeOperation = "source-in";
    c.fillStyle = "#fff"; c.fillRect(0, 0, f.width, f.height);
    flashes.set(key, f);
    return f;
  },
  drawFlash(ctx, key, x, y, alpha) {
    const s = sprites.get(key);
    ctx.globalAlpha = alpha;
    ctx.drawImage(Art.flashOf(key), x - s.w / 2, y - s.h / 2, s.w, s.h);
    ctx.globalAlpha = 1;
  },

  // URL (data:) de qualquer sprite (ex.: "pickup.star"), em px × px.
  urlOf(key, px = 48) {
    const id = `${key}@${px}`;
    if (iconUrls.has(id)) return iconUrls.get(id);
    const s = sprites.get(key);
    let url = "";
    if (s) {
      const cv = document.createElement("canvas");
      cv.width = cv.height = px;
      const k = Math.min(px / s.w, px / s.h);
      cv.getContext("2d").drawImage(s.img, (px - s.w * k) / 2, (px - s.h * k) / 2, s.w * k, s.h * k);
      try { url = cv.toDataURL("image/png"); } catch { url = ""; }
    }
    iconUrls.set(id, url);
    return url;
  },

  // URL (data:) do ícone de uma arma, para usar em <img> do menu.
  iconURL(weaponId) {
    const key = `icon.${weaponId}`;
    if (iconUrls.has(key)) return iconUrls.get(key);
    const s = sprites.get(key);
    let url = "";
    if (s) {
      const cv = document.createElement("canvas");
      cv.width = 96; cv.height = 96;
      cv.getContext("2d").drawImage(s.img, 0, 0, 96, 96);
      try { url = cv.toDataURL("image/png"); } catch { url = ""; }
    }
    iconUrls.set(key, url);
    return url;
  },
};
