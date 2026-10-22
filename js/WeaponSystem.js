/* ==========================================================================
   WeaponSystem.js — slots, instalação, disparo automático e projéteis do jogador.
   Cada slot é independente: tem a sua arma, as suas melhorias e o seu temporizador.
   Os projéteis nascem na posição E na orientação do slot (angle: 0 = para cima).
   ========================================================================== */
import { CONFIG } from "./data/Config.js";
import { WEAPONS } from "./data/Weapons.js";
import { WEAPON_TREES, applyEffects, effectsOf } from "./data/Upgrades.js";
import { Pool } from "./Pool.js";
import { Sound } from "./Audio.js";

const BURST_GAP = 0.09;

function makeShot() {
  return { x: 0, y: 0, ang: 0, sp: 0, maxSp: 0, accel: false, life: 0, dmg: 0, r: 4, pierce: 0, homing: 0, blast: 0, kind: "basic", color: "#fff", hitN: 0, hits: new Int32Array(16), special: false, cancel: false, cancelLeft: 0, redirect: 0 };
}

export class WeaponSystem {
  constructor(game) {
    this.game = game;
    this.slots = new Map();      // slotId -> estado do slot
    this.slotList = [];
    this.shots = new Pool(makeShot, CONFIG.limits.maxPlayerShots);
  }

  reset(shipDef) {
    this.shots.clear();
    this.slots.clear();
    this.slotList = [];
    shipDef.slots.forEach((def, i) => {
      const slot = { def, weaponId: null, owned: new Set(), stats: null, cd: 0.05 * i, burstLeft: 0, burstT: 0, shotCount: 0 };
      this.slots.set(def.id, slot);
      this.slotList.push(slot);
    });
    // A partida começa SEM arma: o jogador escolhe a primeira (o dinheiro inicial cobre uma das 3 mais baratas).
  }

  setWeapon(slot, weaponId) {
    slot.weaponId = weaponId;
    slot.owned.clear();
    slot.cd = 0.15; slot.burstLeft = 0; slot.shotCount = 0;
    this.recompute(slot);
  }

  recompute(slot) {
    const w = WEAPONS[slot.weaponId];
    const base = { ...w.base };
    base.damage *= this.game.ship.def.damageMod;
    slot.stats = applyEffects(base, effectsOf(WEAPON_TREES[slot.weaponId], slot.owned), w.limits);
  }

  get equippedCount() { let n = 0; for (const s of this.slotList) if (s.weaponId) n++; return n; }

  // Remove a arma do slot (sem reembolso): o slot volta a ficar vazio e as melhorias dela se perdem.
  remove(slotId) {
    const slot = this.slots.get(slotId);
    if (!slot || !slot.weaponId) return { ok: false };
    slot.weaponId = null; slot.owned.clear(); slot.stats = null;
    slot.burstLeft = 0; slot.shotCount = 0; slot.cd = 0.15;
    return { ok: true };
  }

  // Custo de instalar um módulo: cresce com as cópias do mesmo tipo já instaladas (GDD 7.5).
  installCost(weaponId) {
    const copies = this.slotList.filter((s) => s.weaponId === weaponId).length;
    return Math.round((WEAPONS[weaponId].cost * Math.pow(CONFIG.economy.slotCostGrowth, copies)) / 5) * 5;
  }

  // Instala (compra + aplica) como UMA operação: sem moedas ou slot ocupado, nada muda.
  install(slotId, weaponId) {
    const slot = this.slots.get(slotId);
    if (!slot || !WEAPONS[weaponId]) return { ok: false, reason: "invalid" };
    if (slot.weaponId) return { ok: false, reason: "occupied" };
    const cost = this.installCost(weaponId);
    if (!this.game.currency.spend(cost)) return { ok: false, reason: "coins", cost };
    this.setWeapon(slot, weaponId);
    return { ok: true, cost };
  }

  /* ------------------------------ disparo ------------------------------ */
  update(dt) {
    for (const slot of this.slotList) {
      if (!slot.weaponId) continue;       // slot vazio não dispara
      const st = slot.stats;
      slot.cd -= dt;
      if (slot.cd <= 0 && slot.burstLeft === 0) {
        slot.cd = Math.max(st.interval, (st.burst - 1) * BURST_GAP + 0.03);
        slot.burstLeft = st.burst; slot.burstT = 0;
      }
      if (slot.burstLeft > 0) {
        slot.burstT -= dt;
        if (slot.burstT <= 0) { this.volley(slot); slot.burstLeft--; slot.burstT = BURST_GAP; }
      }
    }
  }

  volley(slot) {
    const ship = this.game.ship, w = WEAPONS[slot.weaponId], st = slot.stats, sd = slot.def;
    const ox = ship.x + sd.x, oy = ship.y + sd.y;
    Sound.play(w.sound);

    // Vanguarda: a cada N disparos DESTA arma sai um disparo carregado (vale para qualquer arma equipada).
    let special = false;
    if (ship.def.special === "overcharge" && sd.id === ship.def.specialSlot) {   // só a arma do slot principal
      slot.shotCount++;
      if (slot.shotCount >= ship.stats.specialEvery) { slot.shotCount = 0; special = true; Sound.play("special"); }
    }
    const dmg = special ? st.damage * ship.stats.specialMult : st.damage;

    if (w.kind === "pulse") {
      this.game.vfx.ring(ox, oy, 12, st.blast, w.color, 0.35, 4);
      for (const e of this.game.enemies.list) {
        if (e.y < -10) continue;
        if (Math.hypot(e.x - ox, e.y - oy) <= st.blast + e.r) this.game.damageEnemy(e, dmg);
      }
      return;
    }

    const n = st.count, spreadRad = (st.spread * Math.PI) / 180;
    for (let i = 0; i < n; i++) {
      let ang = sd.angle, ox2 = ox, oy2 = oy;
      if (n > 1) {
        const k = i - (n - 1) / 2;
        if (spreadRad > 0.001) ang += k * (spreadRad / (n - 1));
        else { ox2 += Math.cos(sd.angle) * k * 9; oy2 += Math.sin(sd.angle) * k * 9; }   // sem abertura: feixes paralelos
      }
      const s = this.shots.acquire();
      if (!s) return;
      s.x = ox2; s.y = oy2; s.ang = ang;
      s.accel = w.kind === "missile";
      s.maxSp = st.speed; s.sp = s.accel ? st.speed * 0.45 : st.speed;
      s.life = st.life; s.dmg = dmg; s.r = st.size + (special ? 3 : 2);
      s.special = special;
      s.cancel = ship.def.special === "cancel"; s.cancelLeft = ship.stats.cancelPierce; s.redirect = ship.stats.redirect;
      s.pierce = st.pierce; s.homing = st.homing; s.blast = st.blast;
      s.kind = w.id; s.color = w.color; s.hitN = 0;
    }
  }

  // Progresso (0..1) do próximo disparo carregado da Vanguarda (arma do slot principal).
  specialProgress() {
    const need = this.game.ship.stats.specialEvery;
    const s = this.slots.get(this.game.ship.def.specialSlot);
    return s?.weaponId ? Math.min(1, s.shotCount / need) : 0;
  }

  /* ------------------------------ projéteis ------------------------------ */
  updateShots(dt) {
    const world = this.game.world, enemies = this.game.enemies.list;
    this.shots.update((s) => {
      s.life -= dt;
      if (s.life <= 0) return false;
      if (s.accel) s.sp = Math.min(s.maxSp, s.sp + s.maxSp * 2.4 * dt);
      if (s.homing > 0) {
        let best = null, bd = 640 * 640;
        for (const e of enemies) {
          if (e.y < -10) continue;
          const dx = e.x - s.x, dy = e.y - s.y, d = dx * dx + dy * dy;
          // só mira em inimigos à frente do míssil (dentro de um cone amplo)
          const fwd = dx * Math.sin(s.ang) - dy * Math.cos(s.ang);
          if (fwd > -20 && d < bd) { bd = d; best = e; }
        }
        if (best) {
          const want = Math.atan2(best.x - s.x, -(best.y - s.y));
          let diff = want - s.ang;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          const maxTurn = s.homing * dt;
          s.ang += Math.max(-maxTurn, Math.min(maxTurn, diff));
        }
      }
      s.x += Math.sin(s.ang) * s.sp * dt;
      s.y -= Math.cos(s.ang) * s.sp * dt;
      return !(s.x < -60 || s.x > world.width + 60 || s.y < -80 || s.y > world.height + 60);
    });
  }
}
