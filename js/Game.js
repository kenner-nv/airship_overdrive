/* ==========================================================================
   Game.js — GameState + GameLoop: máquina de estados, laço principal e a ligação entre os sistemas.

   Estados: LOADING · MAIN · SHIPSELECT · RECORDS · PLAYING · BUILD · PAUSED · DYING · GAMEOVER
   A simulação (step) só roda em PLAYING. BUILD e PAUSED congelam TUDO (inimigos, tiros, tempo, ondas,
   pontuação): o jogo retoma exatamente do mesmo ponto.
   ========================================================================== */
import { CONFIG } from "./data/Config.js";
import { SHIPS } from "./data/Ships.js";
import { Art } from "./Art.js";
import { Sound } from "./Audio.js";
import { LocalSave } from "./LocalSave.js";
import { Vfx } from "./Vfx.js";
import { Ship } from "./Ship.js";
import { CurrencySystem } from "./CurrencySystem.js";
import { ScoreSystem } from "./ScoreSystem.js";
import { WeaponSystem } from "./WeaponSystem.js";
import { SupportSystem } from "./SupportSystem.js";
import { PickupSystem } from "./PickupSystem.js";
import { EnemySystem } from "./EnemySystem.js";
import { WaveSystem } from "./WaveSystem.js";
import { CollisionSystem } from "./CollisionSystem.js";
import { UpgradeSystem } from "./UpgradeSystem.js";
import { InputController } from "./Input.js";
import { Renderer } from "./Renderer.js";
import { Ui } from "./Ui.js";
import { installPlatform, platformBlocked } from "./Platform.js";

const SCENE_STATES = new Set(["PLAYING", "BUILD", "PAUSED", "DYING", "GAMEOVER"]);

export class Game {
  constructor(dom) {
    this.dom = dom;                       // { stage, canvas }
    this.state = "LOADING";
    this.world = { width: CONFIG.world.width, height: 960 };
    this.clock = 0;
    this.run = null;
    this.result = null;
    this.deathT = 0;
    this.lastShipId = null;
    this.last = 0;

    this.ship = new Ship();
    this.currency = new CurrencySystem();
    this.score = new ScoreSystem();
    this.vfx = new Vfx();
    this.weapons = new WeaponSystem(this);
    this.supports = new SupportSystem(this);
    this.pickups = new PickupSystem(this);
    this.enemies = new EnemySystem(this);
    this.waves = new WaveSystem(this);
    this.collisions = new CollisionSystem(this);
    this.upgrades = new UpgradeSystem(this);
    this.renderer = new Renderer(dom.canvas, this);
    this.input = new InputController(dom.stage, this);
    this.ui = new Ui(this);
    this.frame = this.frame.bind(this);
  }

  get inScene() { return SCENE_STATES.has(this.state); }

  /* ------------------------------ ciclo de vida ------------------------------ */
  async load(onProgress) {
    await Art.preload(onProgress);
    this.resize();
    this.renderer.buildBackground();
    installPlatform(this);
    window.addEventListener("resize", () => this.resize());
    window.addEventListener("orientationchange", () => setTimeout(() => this.resize(), 120));
    document.addEventListener("visibilitychange", () => { if (document.hidden) this.pauseExternal(); });
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if (this.state === "BUILD") { e.preventDefault(); this.closeBuild(); }
        else if (this.state === "SHIPSELECT" || this.state === "RECORDS") this.setState("MAIN");
      }
    });
    requestAnimationFrame((t) => { this.last = t; requestAnimationFrame(this.frame); });
  }

  setState(s) {
    const prev = this.state;
    this.state = s;
    this.dom.stage.dataset.state = s;
    this.ui.onState(s, prev);
  }

  resize() {
    const { stage, canvas } = this.dom;
    const r = stage.getBoundingClientRect();
    if (r.width < 10 || r.height < 10) return;
    const wc = CONFIG.world;                     // celular: arena mais estreita = tudo maior na tela
    this.world.width = wc.minScale > 0 ? Math.round(Math.min(wc.width, Math.max(wc.minWidth, r.width / wc.minScale))) : wc.width;
    this.world.height = Math.max(480, Math.round((this.world.width * r.height) / r.width));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.renderer.resize(r.width, r.height, dpr);
    this.input.refreshRect();
    if (this.ship.alive) this.ship.clampToArena(this.world);
    this.ui.onResize();
  }

  /* ------------------------------ partida ------------------------------ */
  startRun(shipId) {
    const def = SHIPS[shipId];
    Sound.unlock();
    this.resize();
    this.lastShipId = shipId;
    this.currency.reset(CONFIG.economy.startCoins);   // moedas são da tentativa: sempre reiniciadas aqui
    this.score.reset();
    this.vfx.clear();
    this.pickups.clear();
    this.enemies.reset();
    this.waves.reset();
    this.ship.reset(def, this.world);     // antes das armas (o dano da classe entra no cálculo)
    this.weapons.reset(def);
    this.supports.reset(def);
    this.run = { shipId, time: 0 };
    this.result = null;
    this.input.reset();
    this.syncMouseTarget();
    this.ui.hud.reset();
    this.setState("PLAYING");
  }

  // Ao (re)entrar na partida com o mouse, a nave passa a seguir a posição atual do cursor.
  syncMouseTarget() {
    const l = this.input.last;
    if (l && l.type === "mouse") { this.ship.setTarget(l.x, l.y); this.ship.clampTarget(this.world); }
  }

  openBuild() {
    if (this.state !== "PLAYING") return;
    this.input.reset();
    this.setState("BUILD");
    Sound.play("click");
  }

  closeBuild() {
    if (this.state !== "BUILD") return;
    this.input.reset();
    this.syncMouseTarget();
    this.last = performance.now();
    this.setState("PLAYING");
  }

  // Pausa vinda da plataforma (popup de saída, anúncio) ou da aba oculta. Seguro em qualquer estado.
  pauseExternal() {
    if (this.state === "PLAYING") { this.input.reset(); this.setState("PAUSED"); }
  }

  resume() {
    if (this.state !== "PAUSED") return;
    this.input.reset();
    this.syncMouseTarget();
    this.last = performance.now();
    this.setState("PLAYING");
  }

  toMenu() { this.setState("MAIN"); }

  // Sair da partida em andamento (pela pausa ou pelo menu de construção) e voltar ao menu principal.
  // A tentativa é registrada nos recordes (se já tiver pontos), para o jogador não perder a pontuação.
  abandonRun() {
    if (this.state !== "PAUSED" && this.state !== "BUILD") return;
    if (this.run && this.score.score > 0) {
      LocalSave.addRecord({ score: this.score.score, time: this.run.time, wave: Math.max(1, this.waves.wave), ship: this.run.shipId });
    }
    this.input.reset();
    this.setState("MAIN");
  }

  die() {
    if (this.state !== "PLAYING") return;
    const s = this.ship;
    this.deathT = CONFIG.loop.deathAnim;
    this.vfx.explosion(s.x, s.y, 60, "#5ff3ff");
    this.vfx.spark(s.x, s.y, "#ffffff", 14, 260, 3, 0.7);
    Sound.play("explode_big");
    Sound.play("gameover");
    const rec = LocalSave.addRecord({ score: this.score.score, time: this.run.time, wave: Math.max(1, this.waves.wave), ship: this.run.shipId });
    this.result = {
      score: this.score.score, time: this.run.time, wave: Math.max(1, this.waves.wave),
      shipId: this.run.shipId, kills: this.score.kills, rank: rec.rank, isBest: rec.isBest, saved: rec.saved,
    };
    this.setState("DYING");
  }

  /* ------------------------------ eventos de combate ------------------------------ */
  requestDodge(dx, dy) {
    if (this.state !== "PLAYING" || !this.ship.tryDodge(dx, dy)) return false;
    this.vfx.ring(this.ship.x, this.ship.y, 8, 40, "#ffffff", 0.25, 2.5);
    Sound.play("dodge");
    return true;
  }

  damageEnemy(e, dmg) {
    if (e.dead) return;
    e.hp -= dmg;
    e.flash = 0.08;
    Sound.play("hit");
    if (e.hp <= 0) this.killEnemy(e);
  }

  // Recompensa exatamente uma vez (e.dead impede repetição).
  killEnemy(e) {
    if (e.dead) return;
    e.dead = true;
    const def = e.def, wave = Math.max(1, this.waves.wave);
    this.score.addKill(def, wave);
    // O inimigo derruba estrela(s); o dinheiro só entra quando o jogador passa por cima.
    const coins = Math.max(1, Math.round(def.coins * (1 + CONFIG.economy.coinWaveScale * (wave - 1))));
    const n = def.special ? CONFIG.pickups.eliteStars : 1, each = Math.max(1, Math.round(coins / n));
    for (let i = 0; i < n; i++) this.pickups.spawn("star", e.x, e.y, each, n > 1 ? 110 : 0);
    if (e.carriesHeal) this.pickups.spawn("heart", e.x, e.y, 0, 0);
    const big = def.special || def.radius >= 24;
    this.vfx.explosion(e.x, e.y, big ? e.r * 1.6 : e.r * 1.2, "#ff9d5c");
    Sound.play(big ? "explode_big" : "explode");
  }

  blast(x, y, radius, dmg, exclude, color) {
    this.vfx.explosion(x, y, radius, color);
    for (const e of this.enemies.list) {
      if (e === exclude || e.dead) continue;
      if (Math.hypot(e.x - x, e.y - y) <= radius + e.r) this.damageEnemy(e, dmg);
    }
  }

  onShipHit(dealt, x, y) {
    this.vfx.spark(x, y, "#ff5470", 8, 200, 2.6, 0.4);
    Sound.play("hurt");
    if (!this.ship.alive) this.die();
  }

  onWaveStart(wave) {
    Sound.play("wave");
    const e = CONFIG.waves.eliteEvery;
    this.ui.banner(`ONDA ${wave}`, e && wave % e === 0 ? "Comandante a caminho!" : wave === 1 ? "Mova o mouse/dedo · clique/toque para construir" : "");
  }

  onWaveClear(wave, bonus) {
    this.vfx.text(this.world.width / 2, this.world.height * 0.4, `Onda ${wave} concluída  +${bonus}`, "#7cffb2");
  }

  /* ------------------------------ laço principal ------------------------------ */
  step(dt) {
    this.run.time += dt;
    this.ship.update(dt, this.world);
    if (this.ship.regenPulse) { this.ship.regenPulse = false; this.vfx.spark(this.ship.x + (Math.random() - 0.5) * 20, this.ship.y + (Math.random() - 0.5) * 20, "#7cffb2", 1, 36, 2.4, 0.6); }
    this.weapons.update(dt);
    this.supports.update(dt);
    this.waves.update(dt);
    this.enemies.update(dt);
    this.weapons.updateShots(dt);
    this.enemies.updateShots(dt);
    this.enemies.updateBeams(dt);
    this.collisions.update();
    this.pickups.update(dt);
    this.vfx.update(dt);
    this.renderer.scroll(dt);
  }

  frame(ts) {
    requestAnimationFrame(this.frame);
    let dt = (ts - this.last) / 1000;
    this.last = ts;
    if (!(dt > 0)) dt = 0;
    dt = Math.min(dt, CONFIG.loop.maxFrameDt);   // voltar de outra aba não causa salto
    this.clock += dt;

    if (platformBlocked() && this.state === "PLAYING") this.pauseExternal();

    switch (this.state) {
      case "PLAYING": {
        let rem = dt;
        while (rem > 1e-6 && this.state === "PLAYING") {
          const h = Math.min(rem, CONFIG.loop.maxStep);
          this.step(h);
          rem -= h;
        }
        this.ui.hud.update();
        break;
      }
      case "DYING":
        this.deathT -= dt;
        this.vfx.update(dt);
        this.renderer.scroll(dt * 0.3);
        if (this.deathT <= 0) { this.setState("GAMEOVER"); this.ui.showEnd(this.result); }
        break;
      case "BUILD": case "PAUSED": case "GAMEOVER":
        break;                              // congelado: nada avança
      default:
        this.renderer.scroll(dt * 0.4);     // menus: estrelas passando devagar
    }
    this.renderer.draw();
  }
}
