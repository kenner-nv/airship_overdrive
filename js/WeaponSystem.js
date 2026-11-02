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
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
// Efeitos do ramo Especial (todos 0 por padrão; as melhorias ligam). Ver data/Upgrades.js.
const EXTRA = { killChain: 0, killRedirect: 0, killDiag: 0, wallBounce: 0, frag: 0, pierceAll: 0, knock: 0, slow: 0, echo: 0 };
const LASER_SCREEN = 0.65;   // alcance inicial do laser = 65% da altura da tela

function makeShot() {
  return { x: 0, y: 0, ang: 0, sp: 0, maxSp: 0, accel: false, life: 0, dmg: 0, r: 4, pierce: 0, homing: 0, blast: 0, kind: "basic", color: "#fff", hitN: 0, hits: new Int32Array(16), special: false, cancel: false, cancelLeft: 0, redirect: 0, src: "basic", baseDmg: 0, kc: 0, kr: 0, kd: 0, bounce: 0, frag: 0, knock: 0, sc: 1, mini: false, ang0: 0 };
}

export class WeaponSystem {
  constructor(game) {
    this.game = game;
    this.slots = new Map();      // slotId -> estado do slot
    this.slotList = [];
    this.shots = new Pool(makeShot, CONFIG.limits.maxPlayerShots);
    this.echoes = [];                // 2º pulso do Eco (Pulso de Área)
  }

  // Pega um projétil do pool com TODOS os campos no padrão (o pool reaproveita objetos).
  acquire() {
    const s = this.shots.acquire();
    if (!s) return null;
    s.hitN = 0; s.special = false; s.cancel = false; s.cancelLeft = 0; s.redirect = 0; s.pierce = 0; s.homing = 0; s.blast = 0; s.accel = false;
    s.src = "basic"; s.baseDmg = 0; s.kc = 0; s.kr = 0; s.kd = 0; s.bounce = 0; s.frag = 0; s.knock = 0; s.sc = 1; s.mini = false;
    return s;
  }

  reset(shipDef) {
    this.shots.clear();
    this.echoes.length = 0;
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
    const base = { ...EXTRA, ...w.base };
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
    const copies = this.equippedCount;      // cresce com QUALQUER arma já instalada (a 2ª arma é mais cara mesmo sendo de outro tipo)
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
    for (const slot of this.slotList) this.tickSlot(slot, slot, dt, null);
    for (let i = this.echoes.length - 1; i >= 0; i--) {                 // Eco: segundo pulso, menor
      const q = this.echoes[i];
      q.t -= dt;
      if (q.t > 0) continue;
      this.echoes.splice(i, 1);
      if (!q.slot.weaponId) continue;
      const ship = this.game.ship, sd = q.slot.def;
      this.pulse(q.slot, q.clone ? q.x : ship.x + sd.x, q.clone ? q.y : ship.y + sd.y, q.dmg, 0.5);
    }
  }

  // Pulso de Área: dano (+ empurrão e lentidão, se melhorado) em todos ao redor do ponto.
  pulse(slot, x, y, dmg, rMul) {
    const w = WEAPONS[slot.weaponId], st = slot.stats, r = st.blast * rMul;
    this.game.vfx.ring(x, y, 12 * rMul, r, w.color, 0.35, 4 * (rMul < 1 ? 0.7 : 1));
    this.game.areaHit(x, y, r, dmg, { kind: "area", knock: st.knock ? 70 : 0, slow: st.slow || 0 });
  }

  // Temporizador de disparo da arma de `slot`. `state` = { cd, burstLeft, burstT }: o próprio slot (nave) ou o estado
  // de uma arma do clone holográfico (que usa a arma/atributos do slot, mas tem seus próprios tempos). `o` = opções do clone (volley).
  tickSlot(slot, state, dt, o) {
    if (!slot.weaponId) return;       // slot vazio não dispara
    const st = slot.stats;
    state.cd -= dt;
    if (state.cd <= 0 && state.burstLeft === 0) {
      state.cd = Math.max(st.interval, (st.burst - 1) * BURST_GAP + 0.03);
      state.burstLeft = st.burst; state.burstT = 0;
    }
    if (state.burstLeft > 0) {
      state.burstT -= dt;
      if (state.burstT <= 0) { this.volley(slot, o); state.burstLeft--; state.burstT = BURST_GAP; }
    }
  }

  // Um disparo da arma do slot. `o` (só o clone holográfico): { x, y (centro do clone), dmgMul } — sai da posição do slot
  // relativa ao clone, sem som e sem o disparo carregado da Vanguarda.
  volley(slot, o = null) {
    const ship = this.game.ship, w = WEAPONS[slot.weaponId], st = slot.stats, sd = slot.def;
    const ox = (o ? o.x : ship.x) + sd.x, oy = (o ? o.y : ship.y) + sd.y;
    if (!o) Sound.play(w.sound);

    // Vanguarda: a cada N disparos DESTA arma sai um disparo carregado (vale para qualquer arma equipada).
    let special = false;
    if (!o && ship.def.special === "overcharge" && sd.id === ship.def.specialSlot) {   // só a arma do slot principal
      slot.shotCount++;
      if (slot.shotCount >= ship.stats.specialEvery) { slot.shotCount = 0; special = true; Sound.play("special"); }
    }
    const dmg = (special ? st.damage * ship.stats.specialMult : st.damage) * (o ? o.dmgMul : 1);

    if (w.kind === "pulse") {
      this.pulse(slot, ox, oy, dmg, 1);
      if (st.echo > 0) this.echoes.push({ t: 0.3, slot, clone: !!o, x: ox, y: oy, dmg: dmg * 0.5 });
      return;
    }

    const n = st.count, spreadRad = (st.spread * Math.PI) / 180;
    const lifeK = w.kind === "laser" ? (LASER_SCREEN * this.game.world.height) / (w.base.speed * w.base.life) : 1;   // laser: alcance ≈ 65% da tela
    for (let i = 0; i < n; i++) {
      let ang = sd.angle, ox2 = ox, oy2 = oy;
      if (n > 1) {
        const k = i - (n - 1) / 2;
        if (spreadRad > 0.001) ang += k * (spreadRad / (n - 1));
        else { ox2 += Math.cos(sd.angle) * k * 9; oy2 += Math.sin(sd.angle) * k * 9; }   // sem abertura: feixes paralelos
      }
      const s = this.acquire();
      if (!s) return;
      s.x = ox2; s.y = oy2; s.ang = ang; s.ang0 = ang;
      s.accel = w.kind === "missile";
      s.maxSp = st.speed; s.sp = s.accel ? st.speed * 0.45 : st.speed;
      s.life = st.life * lifeK; s.dmg = dmg; s.baseDmg = dmg; s.r = st.size + (special ? 3 : 2);
      s.special = special;
      s.cancel = ship.def.special === "cancel"; s.cancelLeft = ship.stats.cancelPierce; s.redirect = ship.stats.redirect;
      s.pierce = st.pierceAll ? 999 : st.pierce; s.homing = st.homing; s.blast = st.blast;
      s.kc = st.killChain; s.kr = st.killRedirect; s.kd = st.killDiag; s.bounce = st.wallBounce; s.frag = st.frag; s.knock = st.knock;
      s.kind = w.id; s.src = w.id; s.color = w.color; s.hitN = 0;
    }
  }

  // Chumbo fragmentado: ao acertar, solta 2 mini-chumbos nas diagonais (30% do dano), que não acertam de novo o mesmo alvo.
  spawnFrags(s, targetId) {
    for (const side of [-1, 1]) {
      const m = this.acquire();
      if (!m) return;
      m.x = s.x; m.y = s.y; m.ang = s.ang + side * Math.PI / 4;
      m.maxSp = m.sp = 520; m.life = 0.35; m.dmg = m.baseDmg = s.baseDmg * 0.3; m.r = 2.6; m.sc = 0.55; m.mini = true;
      m.kind = s.kind; m.src = s.src; m.color = s.color; m.hitN = 1; m.hits[0] = targetId;
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
        // Só rastreia inimigos dentro de um leque a partir do CENTRO DA NAVE, em torno da direção do disparo:
        // ±15° (leque total de 30°) com o sensor básico e ±22,5° (45° no total) no sensor avançado (homing ≥ 4).
        let best = null, bd = 640 * 640;
        const ship = this.game.ship, cone = (s.homing >= 4 ? 22.5 : 15) * Math.PI / 180;
        for (const e of enemies) {
          if (e.y < -10 || e.intangible) continue;
          const dx = e.x - s.x, dy = e.y - s.y, d = dx * dx + dy * dy;
          if (d >= bd) continue;
          let da = Math.atan2(e.x - ship.x, -(e.y - ship.y)) - s.ang0;
          while (da > Math.PI) da -= Math.PI * 2;
          while (da < -Math.PI) da += Math.PI * 2;
          if (Math.abs(da) <= cone) { bd = d; best = e; }
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
      if (s.bounce > 0 && ((s.x < 0 && Math.sin(s.ang) < 0) || (s.x > world.width && Math.sin(s.ang) > 0))) {   // Chumbo elástico: reflete na lateral
        s.ang = -s.ang; s.x = clamp(s.x, 0, world.width); s.bounce--;
      }
      return !(s.x < -60 || s.x > world.width + 60 || s.y < -80 || s.y > world.height + 60);
    });
  }
}
