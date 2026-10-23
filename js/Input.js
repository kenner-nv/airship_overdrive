/* ==========================================================================
   Input.js — InputController: mouse (PC) e toque (celular).
   - PC: o mouse é a posição da nave. Um clique em QUALQUER ponto da arena abre o menu de construção.
   - Celular: arrastar move a nave (desenhada acima do dedo); toque curto (sem arrastar) abre o menu.
   - Esquiva: movimento rápido do mouse/dedo (velocidade e distância em Config.input.dodge).
   Os listeners ficam no #stage (cliques) e no window (movimento), nunca no menu da plataforma.
   ========================================================================== */
import { CONFIG } from "./data/Config.js";

export class InputController {
  constructor(stage, game) {
    this.stage = stage;
    this.game = game;
    this.rect = stage.getBoundingClientRect();
    this.last = null;            // última posição do ponteiro { x, y, type } (coords lógicas)
    this.samples = [];           // amostras recentes para detectar o gesto de esquiva
    this.touch = null;           // { id, cx, cy, t, dragging }
    this.mouseDown = false;

    this.onMove = this.onMove.bind(this);
    this.onDown = this.onDown.bind(this);
    this.onUp = this.onUp.bind(this);
    this.onCancel = this.onCancel.bind(this);
    window.addEventListener("pointermove", this.onMove, { passive: true });
    stage.addEventListener("pointerdown", this.onDown);
    window.addEventListener("pointerup", this.onUp);
    window.addEventListener("pointercancel", this.onCancel);
    stage.addEventListener("contextmenu", (e) => e.preventDefault());
    stage.addEventListener("dragstart", (e) => e.preventDefault());
  }

  refreshRect() { this.rect = this.stage.getBoundingClientRect(); }

  toLogical(e) {
    const r = this.rect, w = this.game.world;
    return { x: (e.clientX - r.left) * (w.width / r.width), y: (e.clientY - r.top) * (w.height / r.height) };
  }

  // Limpa gestos em andamento (ao pausar, abrir menu, reiniciar...).
  reset() { this.samples.length = 0; this.touch = null; this.mouseDown = false; }

  onDown(e) {
    const g = this.game;
    if (g.state !== "PLAYING") return;
    if (e.pointerType === "mouse") {
      if (e.button !== 0) return;
      this.mouseDown = true;
    } else if (!this.touch) {
      this.touch = { id: e.pointerId, cx: e.clientX, cy: e.clientY, t: performance.now(), dragging: false };
      this.samples.length = 0;
      this.sample(this.toLogical(e));        // o deslize conta desde o instante em que o dedo encosta (não só depois do limiar de arraste)
    }
  }

  onUp(e) {
    const g = this.game;
    if (e.pointerType === "mouse") {
      const was = this.mouseDown;
      this.mouseDown = false;
      if (was && g.state === "PLAYING" && e.button === 0) g.openBuild();   // clique em qualquer lugar da arena
      return;
    }
    const t = this.touch;
    if (!t || t.id !== e.pointerId) return;
    this.touch = null;
    const quick = performance.now() - t.t <= CONFIG.input.tapMaxMs;
    if (!t.dragging && quick && g.state === "PLAYING") g.openBuild();        // toque curto
  }

  onCancel(e) {
    if (this.touch && this.touch.id === e.pointerId) this.touch = null;
    if (e.pointerType === "mouse") this.mouseDown = false;
  }

  onMove(e) {
    const g = this.game;
    const p = this.toLogical(e);
    this.last = { x: p.x, y: p.y, type: e.pointerType };
    if (g.state !== "PLAYING") { this.samples.length = 0; return; }
    const cfg = CONFIG.input;

    if (e.pointerType === "mouse") {
      g.ship.setTarget(p.x, p.y);
      g.ship.clampTarget(g.world);
      this.sample(p);
      this.checkDodge();
      return;
    }
    const t = this.touch;
    if (!t || t.id !== e.pointerId) return;
    if (!t.dragging && Math.hypot(e.clientX - t.cx, e.clientY - t.cy) > cfg.dragThresholdPx) t.dragging = true;
    // usa também os pontos intermediários do gesto (o navegador agrupa vários num único evento em telas de toque)
    const pts = e.getCoalescedEvents ? e.getCoalescedEvents() : null;
    if (pts && pts.length > 1) for (const ce of pts) this.sample(this.toLogical(ce), ce.timeStamp);
    else this.sample(p);
    if (t.dragging) {
      g.ship.setTarget(p.x, p.y - cfg.touchOffsetY * (g.world.width / CONFIG.world.width));      // a nave fica acima do dedo
      g.ship.clampTarget(g.world);
      this.checkDodge("touch");
    }
  }

  sample(p, ts) {
    const now = performance.now(), s = this.samples;
    const t = Number.isFinite(ts) && Math.abs(now - ts) < 500 ? Math.min(ts, now) : now;   // carimbo do próprio ponto (se confiável)
    s.push({ t, x: p.x, y: p.y });
    const win = Math.max(CONFIG.input.dodge.windowMs, CONFIG.input.dodgeTouch.windowMs);
    while (s.length && now - s[0].t > win) s.shift();
  }

  // Mouse: gesto longo e muito rápido · Toque: deslize curto (Config.input.dodgeTouch).
  checkDodge(kind = "mouse") {
    const d = kind === "touch" ? CONFIG.input.dodgeTouch : CONFIG.input.dodge;
    const now = performance.now();
    const s = this.samples.filter((q) => now - q.t <= d.windowMs);
    if (s.length < 2) return;
    const a = s[0], b = s[s.length - 1];
    const dt = (b.t - a.t) / 1000;
    if (dt < 0.008) return;
    const dx = b.x - a.x, dy = b.y - a.y;
    const dist = Math.hypot(dx, dy);
    if (dist >= d.minDistance && dist / dt >= d.minSpeed) {
      if (this.game.requestDodge(dx, dy)) this.samples.length = 0;
    }
  }
}
