/* ==========================================================================
   Ui.js — overlays (menu, seleção de nave, recordes, pausa, game over), HUD, avisos.
   O HTML dos overlays está em index.html; aqui só ligamos botões e preenchemos dados.
   ========================================================================== */
import { CONFIG } from "./data/Config.js";
import { SHIPS, SHIP_ORDER } from "./data/Ships.js";
import { Art } from "./Art.js";
import { Sound } from "./Audio.js";
import { LocalSave } from "./LocalSave.js";
import { BuildMenu } from "./BuildMenu.js";

const $ = (id) => document.getElementById(id);
const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

class Hud {
  constructor(game) {
    this.game = game;
    this.root = $("hud");
    this.el = { hp: $("hp-fill"), hpText: $("hp-text"), dodge: $("dodge-fill"), score: $("h-score"), coins: $("h-coins"), wave: $("h-wave"),
      sup: $("sup-meter"), supIco: $("sup-ico"), supFill: $("sup-fill") };
    this.reset();
  }
  reset() { this.c = {}; }
  set(key, val, fn) { if (this.c[key] !== val) { this.c[key] = val; fn(val); } }
  update() {
    const g = this.game, s = g.ship, e = this.el;
    const ratio = Math.max(0, s.hp / s.stats.maxHp);
    this.set("hp", `${s.hp}/${s.stats.maxHp}`, (v) => {
      e.hp.style.width = `${ratio * 100}%`;
      e.hp.classList.toggle("low", ratio < 0.3);
      e.hpText.textContent = v;
    });
    this.set("regen", s.regenOn, (v) => e.hp.parentElement.classList.toggle("regen", v));     // barra pulsa enquanto regenera
    // módulo de suporte: barra = vida do efeito (ativo) ou progresso da recarga
    const sup = g.supports.hud();
    this.set("sup", sup ? `${sup.id}|${sup.active}|${Math.round(sup.p * 60)}` : "", () => {
      e.sup.hidden = !sup;
      if (!sup) return;
      if (e.supIco.dataset.id !== sup.id) { e.supIco.dataset.id = sup.id; e.supIco.src = Art.iconURL(sup.id); }
      e.sup.classList.toggle("active", sup.active);
      e.supFill.style.width = `${Math.round(sup.p * 100)}%`;
      e.supFill.style.background = sup.active ? sup.color : "rgba(255,255,255,.45)";
    });
    // medidor da habilidade especial: Espectro = recarga da esquiva · Vanguarda = disparos até o carregado · Tanque = sem medidor
    const sp = s.def.special;
    const d = sp === "dodge" ? Math.round(s.dodgeReady * 100) : sp === "overcharge" ? Math.round(Math.min(1, g.weapons.specialProgress()) * 100) : -1;
    this.set("special", d, (v) => {
      const m = e.dodge.parentElement;
      m.style.visibility = v < 0 ? "hidden" : "visible";
      e.dodge.style.width = `${Math.max(0, v)}%`;
      m.classList.toggle("ready", v >= 100);
      m.dataset.kind = sp;
    });
    // balão: até equipar a primeira arma, aponta para a nave
    const tip = $("tip"), need = g.weapons.equippedCount === 0 && g.waves.wave === 0 && g.state === "PLAYING";
    if (tip.hidden === need) tip.hidden = !need;
    if (need) {
      const r = g.dom.stage.getBoundingClientRect(), k = r.width / g.world.width;
      tip.style.left = `${Math.min(r.width - 90, Math.max(90, g.ship.x * k))}px`;
      tip.style.top = `${Math.max(60, (g.ship.y - 42) * k)}px`;
    }
    this.set("score", g.score.score, (v) => { e.score.textContent = v.toLocaleString("pt-BR"); });
    this.set("coins", g.currency.coins, (v) => { e.coins.textContent = `${v} ★`; });
    this.set("wave", g.waves.wave, (v) => { e.wave.textContent = `ONDA ${Math.max(1, v)}`; });
  }
}

export class Ui {
  constructor(game) {
    this.game = game;
    this.ov = Object.fromEntries(["loading", "main", "ships", "records", "pause", "build", "end"].map((k) => [k, $(`ov-${k}`)]));
    this.hud = new Hud(game);
    this.build = new BuildMenu(game, this.ov.build);
    this.bannerEl = $("banner");
    this.toastEl = $("toast");
    this.toastT = 0;
    this.bind();
  }

  bind() {
    const g = this.game;
    const on = (id, fn) => $(id).addEventListener("click", fn);
    on("btn-play", () => { Sound.unlock(); this.renderShips(); g.setState("SHIPSELECT"); });
    on("btn-records", () => { this.renderRecords(); g.setState("RECORDS"); });
    on("btn-ships-back", () => g.setState("MAIN"));
    on("btn-records-back", () => g.setState("MAIN"));
    on("btn-resume", () => g.resume());
    // sair da partida: caixa de mensagem no centro da tela ("Deseja voltar ao menu principal?")
    for (const id of ["btn-pause-quit", "b-quit"]) on(id, () => { Sound.play("click"); this.confirm("Deseja voltar ao menu principal?", () => g.abandonRun()); });
    on("dlg-yes", () => { const fn = this.dlgFn; this.closeConfirm(); fn?.(); });
    on("dlg-no", () => { Sound.play("click"); this.closeConfirm(); });
    on("btn-retry", () => g.startRun(g.lastShipId));
    on("btn-change", () => { this.renderShips(); g.setState("SHIPSELECT"); });
    on("btn-menu", () => g.setState("MAIN"));
    on("btn-ship-pick", () => g.startRun(SHIP_ORDER[this.shipIdx]));
    on("ship-prev", () => this.slideShip(-1));
    on("ship-next", () => this.slideShip(1));
    // passar para o lado (arrastar/deslizar) troca de nave; setas do teclado também
    let x0 = null;
    const car = $("carousel");
    car.addEventListener("pointerdown", (e) => { x0 = e.clientX; });
    window.addEventListener("pointerup", (e) => {
      if (x0 === null) return;
      const dx = e.clientX - x0; x0 = null;
      if (Math.abs(dx) > 40 && g.state === "SHIPSELECT") this.slideShip(dx < 0 ? 1 : -1);
    });
    window.addEventListener("keydown", (e) => {
      if (g.state !== "SHIPSELECT") return;
      if (e.key === "ArrowLeft") this.slideShip(-1); else if (e.key === "ArrowRight") this.slideShip(1);
    });
    for (const id of ["btn-mute", "b-mute"]) on(id, () => { Sound.unlock(); Sound.toggleMute(); this.syncAudio(); });
    $("vol").addEventListener("input", (e) => { Sound.unlock(); Sound.setVolume(e.target.value / 100); this.syncAudio(); });
    document.addEventListener("pointerdown", () => Sound.unlock(), { once: true });
    this.syncAudio();
  }

  syncAudio() {
    const label = Sound.muted ? "Som: desligado" : "Som: ligado";
    $("btn-mute").textContent = label;
    $("b-mute").textContent = Sound.muted ? "🔇" : "🔊";
    $("b-mute").setAttribute("aria-label", label);
    $("vol").value = Math.round(Sound.volume * 100);
  }

  // Caixa de confirmação no centro da tela: `onYes` só roda se o jogador tocar em "Sim".
  confirm(msg, onYes) {
    $("dlg-msg").textContent = msg;
    this.dlgFn = onYes;
    $("ov-confirm").hidden = false;
  }

  closeConfirm() { this.dlgFn = null; $("ov-confirm").hidden = true; }

  onState(s, prev) {
    this.closeConfirm();
    const map = { LOADING: "loading", MAIN: "main", SHIPSELECT: "ships", RECORDS: "records", PAUSED: "pause", BUILD: "build", GAMEOVER: "end" };
    for (const [k, el] of Object.entries(this.ov)) el.hidden = map[s] !== k;
    this.hud.root.hidden = !["PLAYING", "PAUSED", "DYING"].includes(s);
    if (s !== "PLAYING") { this.bannerEl.hidden = true; $("tip").hidden = true; }
    if (s === "BUILD") this.build.open();
    if (s === "MAIN") this.syncAudio();
    // trilha: menus = "menu"; partida = "game" (abafada na pausa/construção); morte = silêncio
    Sound.music(["PLAYING", "BUILD", "PAUSED"].includes(s) ? "game" : s === "DYING" ? null : "menu");
    Sound.setMusicDuck(s === "BUILD" || s === "PAUSED");
  }

  onResize() {
    if (this.game.state === "BUILD") this.build.relayout();
    // celular deitado: o jogo é vertical; pausa e mostra o aviso (CSS)
    if (getComputedStyle($("rotate")).display !== "none") this.game.pauseExternal();
  }

  banner(text, sub = "") {
    const b = this.bannerEl;
    b.innerHTML = `<b>${esc(text)}</b>${sub ? `<span>${esc(sub)}</span>` : ""}`;
    b.hidden = false;
    b.classList.remove("show"); void b.offsetWidth; b.classList.add("show");
  }

  toast(text) {
    const t = this.toastEl;
    t.textContent = text; t.hidden = false;
    t.classList.remove("show"); void t.offsetWidth; t.classList.add("show");
    clearTimeout(this.toastT);
    this.toastT = setTimeout(() => { t.hidden = true; }, 1600);
  }

  // Uma nave por vez, em destaque; para ver as outras o jogador passa para o lado.
  renderShips() {
    const bar = (v) => `<i><b style="width:${Math.round(v * 100)}%"></b></i>`;
    if (this.shipIdx === undefined) this.shipIdx = Math.max(0, SHIP_ORDER.indexOf(this.game.lastShipId));
    $("ship-list").innerHTML = SHIP_ORDER.map((id) => {
      const d = SHIPS[id];
      return `<div class="slide" data-ship="${id}">
        <div class="hero"><canvas width="360" height="360" data-sprite="${d.sprite}"></canvas></div>
        <h3>${esc(d.name)} <small>${esc(d.tagline)}</small></h3>
        <div class="stats"><label>Vida${bar(d.hp / 180)}</label><label>Velocidade${bar(d.speed / 780)}</label><label>Dano${bar(d.damageMod / 1.25)}</label><label>Slots para armas<span>${"●".repeat(d.slots.length)}</span></label></div>
        <p class="sp"><b>${esc(d.specialName)}:</b> ${esc(d.specialDesc)}</p>
      </div>`;
    }).join("");
    $("ship-list").querySelectorAll("canvas").forEach((cv) => {
      const sp = Art.get(cv.dataset.sprite), c = cv.getContext("2d");
      const k = Math.min(300 / sp.w, 300 / sp.h);
      const gl = c.createRadialGradient(180, 180, 10, 180, 180, 175);
      gl.addColorStop(0, "rgba(95,243,255,.30)"); gl.addColorStop(1, "rgba(95,243,255,0)");
      c.fillStyle = gl; c.fillRect(0, 0, 360, 360);
      c.imageSmoothingQuality = "high";
      c.drawImage(sp.img, 180 - (sp.w * k) / 2, 180 - (sp.h * k) / 2, sp.w * k, sp.h * k);
    });
    $("ship-dots").innerHTML = SHIP_ORDER.map((_, i) => `<s data-i="${i}"></s>`).join("");
    this.slideShip(0, true);
  }

  slideShip(dir, instant = false) {
    const n = SHIP_ORDER.length;
    this.shipIdx = Math.min(n - 1, Math.max(0, this.shipIdx + dir));
    const tr = $("ship-list");
    tr.style.transition = instant ? "none" : "";
    tr.style.transform = `translateX(${-this.shipIdx * 100}%)`;
    $("ship-dots").querySelectorAll("s").forEach((d, i) => d.classList.toggle("on", i === this.shipIdx));
    $("ship-prev").disabled = this.shipIdx === 0;
    $("ship-next").disabled = this.shipIdx === n - 1;
    if (dir) Sound.play("click");
  }

  renderRecords() {
    const list = LocalSave.getRecords().slice(0, CONFIG.records.showTop);
    const body = $("records-body");
    if (!list.length) { body.innerHTML = `<p class="empty">Nenhuma partida registrada ainda.<br>Os recordes ficam salvos só neste aparelho.</p>`; return; }
    body.innerHTML = `<table><thead><tr><th>#</th><th>Pontos</th><th>Nave</th><th>Onda</th><th>Tempo</th><th>Data</th></tr></thead><tbody>` +
      list.map((r, i) => {
        const d = r.date ? new Date(r.date) : null;
        const ds = d && !isNaN(d) ? d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "—";
        return `<tr><td>${i + 1}</td><td>${r.score.toLocaleString("pt-BR")}</td><td>${esc(SHIPS[r.ship]?.name ?? "—")}</td><td>${r.wave}</td><td>${fmtTime(r.time)}</td><td>${ds}</td></tr>`;
      }).join("") + `</tbody></table><p class="note">Ranking local: vale só para este navegador.</p>`;
  }

  showEnd(r) {
    $("end-score").textContent = r.score.toLocaleString("pt-BR");
    $("end-time").textContent = fmtTime(r.time);
    $("end-wave").textContent = r.wave;
    $("end-kills").textContent = r.kills;
    $("end-rank").textContent = r.rank ? `${r.rank}º no ranking local` : "Sem registro";
    $("end-best").hidden = !r.isBest;
  }
}
