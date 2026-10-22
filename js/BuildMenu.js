/* ==========================================================================
   BuildMenu.js — menu de construção em LISTA (pausa real; a simulação fica congelada).
   - Abre com clique/toque curto na arena (Input.js chama game.openBuild()).
   - A nave aparece centralizada com os slots; o botão NAVE fica colado no casco.
   - Slot vazio → lista de armas para instalar. Slot ocupado → lista dos 4 ramos da arma.
   - Botão NAVE → lista dos 4 ramos da nave. Cada ramo mostra seus 3 níveis; o próximo nível
     fica disponível para compra e, ao comprar, o seguinte é liberado (UpgradeSystem: requires).
   ========================================================================== */
import { WEAPONS, WEAPON_ORDER } from "./data/Weapons.js";
import { nextNode, branchLevel } from "./data/Upgrades.js";
import { Art } from "./Art.js";
import { Sound } from "./Audio.js";

const $ = (root, sel) => root.querySelector(sel);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const f1 = (n) => (Math.round(n * 10) / 10).toString().replace(".", ",");

export class BuildMenu {
  constructor(game, root) {
    this.game = game;
    this.root = root;
    this.sel = null;          // { type: "slot", slotId } | { type: "ship" } | null
    this.rm = false;          // aguardando confirmação de "remover arma"
    this.el = { coins: $(root, "#b-coins"), box: $(root, "#b-ship"), canvas: $(root, "#b-canvas"), panel: $(root, "#b-panel") };
    $(root, "#b-close").addEventListener("click", () => game.closeBuild());
    this.el.box.addEventListener("click", (e) => {
      if (e.target.closest("[data-ship]")) return this.select({ type: "ship" });
      const b = e.target.closest("[data-slot]");
      if (b) this.select({ type: "slot", slotId: b.dataset.slot });
    });
    this.el.panel.addEventListener("click", (e) => this.onPanelClick(e));
  }

  open() { this.sel = null; this.rm = false; this.relayout(); }

  relayout() { this.layoutShip(); this.refresh(); }

  select(target) {
    this.sel = target; this.rm = false;
    Sound.play("click");
    this.refresh();
    this.el.panel.scrollTop = 0;
  }

  refresh() {
    const keep = this.el.panel.scrollTop;
    this.el.coins.textContent = this.game.currency.coins;
    this.renderSlots();
    this.renderPanel();
    this.el.panel.scrollTop = keep;
  }

  /* ------------------------------ nave em destaque + slots ------------------------------ */
  layoutShip() {
    const def = this.game.ship.def;
    const size = Math.round(Math.min(290, Math.max(150, this.game.dom.stage.clientHeight * 0.28)));
    const box = this.el.box;
    box.style.width = box.style.height = `${size}px`;
    box.style.setProperty("--pvs", size / 290);
    const dpr = Math.min(window.devicePixelRatio || 1, 2), cv = this.el.canvas;
    cv.width = cv.height = Math.round(size * dpr);
    cv.style.width = cv.style.height = `${size}px`;
    const c = cv.getContext("2d");
    c.setTransform(dpr * (size / 290), 0, 0, dpr * (size / 290), 0, 0);
    c.clearRect(0, 0, 290, 290);
    const glow = c.createRadialGradient(145, 145, 10, 145, 145, 140);
    glow.addColorStop(0, "rgba(95,243,255,.28)"); glow.addColorStop(1, "rgba(95,243,255,0)");
    c.fillStyle = glow; c.fillRect(0, 0, 290, 290);
    const sp = Art.get(def.sprite), k = 3;
    c.imageSmoothingQuality = "high";
    c.drawImage(sp.img, 145 - (sp.w * k) / 2, 145 - (sp.h * k) / 2, sp.w * k, sp.h * k);
    this.slotScale = k;
    this.shipHalf = (sp.h * k) / 2;
  }

  renderSlots() {
    const g = this.game, box = this.el.box, k = this.slotScale ?? 3;
    box.querySelectorAll(".slot,.b-shipbtn").forEach((n) => n.remove());
    for (const slot of g.weapons.slotList) {
      const sd = slot.def;
      const b = document.createElement("button");
      b.type = "button";
      b.className = "slot" + (slot.weaponId ? " filled" : " empty") + (this.sel?.slotId === sd.id ? " sel" : "");
      b.dataset.slot = sd.id;
      b.style.left = `${((145 + sd.x * k) / 290) * 100}%`;
      b.style.top = `${((145 + sd.y * k) / 290) * 100}%`;
      b.setAttribute("aria-label", `${sd.label}: ${slot.weaponId ? WEAPONS[slot.weaponId].name : "vazio"}`);
      b.innerHTML = slot.weaponId ? `<img alt="" src="${Art.iconURL(slot.weaponId)}">` : "<span>+</span>";
      box.appendChild(b);
    }
    // NAVE: colado na parte de baixo do casco, bem visível como botão
    const nb = document.createElement("button");
    nb.type = "button"; nb.dataset.ship = "1";
    nb.className = "b-shipbtn" + (this.sel?.type === "ship" ? " sel" : "");
    nb.textContent = "NAVE";
    nb.style.top = `${Math.min(96, ((145 + (this.shipHalf ?? 40) + 4) / 290) * 100)}%`;
    box.appendChild(nb);
  }

  /* ------------------------------ painel ------------------------------ */
  renderPanel() {
    const g = this.game, p = this.el.panel;
    if (!this.sel) {
      p.innerHTML = `<div class="hint"><b>Toque em um slot da nave</b> para instalar módulos ou evoluir a arma.<br>Toque em <b>NAVE</b> para melhorar a própria nave.</div>`;
    } else if (this.sel.type === "ship") {
      p.innerHTML = this.shipHtml();
    } else {
      const slot = g.weapons.slots.get(this.sel.slotId);
      p.innerHTML = slot.weaponId ? this.weaponHtml(slot) : this.installHtml(slot);
    }
  }

  // Armas para instalar: grade de cards em 2 colunas (ícone grande, nome, custo).
  installHtml(slot) {
    const g = this.game;
    const cards = WEAPON_ORDER.map((id) => {
      const w = WEAPONS[id], cost = g.weapons.installCost(id), ok = g.currency.canAfford(cost);
      return `<div class="gcard${ok ? "" : " poor"}">
        <img class="g-ico" alt="" src="${Art.iconURL(id)}">
        <b>${esc(w.name)}</b><span class="g-d">${esc(w.role)}</span><em>${esc(w.diff)}</em>
        <button type="button" class="btn buy" data-install="${id}" ${ok ? "" : "disabled"}>${cost} ★</button>
      </div>`;
    }).join("");
    return `<h3>${esc(slot.def.label)} <small>vazio</small></h3><p class="sub">Escolha uma arma para instalar neste slot.</p><div class="grid2">${cards}</div>`;
  }

  chips(list) { return `<div class="chips">${list.filter(Boolean).map(([k, v]) => `<span><i>${esc(k)}</i>${esc(v)}</span>`).join("")}</div>`; }

  weaponHtml(slot) {
    const w = WEAPONS[slot.weaponId], s = slot.stats;
    const chips = this.chips([
      ["Dano", f1(s.damage)], ["Cadência", `${f1(s.burst / s.interval)}/s`],
      w.kind !== "pulse" ? ["Projéteis", s.count] : ["Pulsos", s.burst],
      s.pierce > 0 ? ["Perfura", s.pierce] : null,
      s.blast > 0 ? [w.kind === "pulse" ? "Raio" : "Explosão", Math.round(s.blast)] : null,
      s.homing > 0 ? ["Rastreio", "sim"] : null,
    ]);
    return `<div class="w-head"><img alt="" src="${Art.iconURL(w.id)}"><div><h3>${esc(w.name)} <small>${esc(slot.def.label)}</small></h3>${chips}</div></div>${this.branchesHtml({ type: "slot", slotId: slot.def.id })}<button type="button" class="btn btn2 small rm${this.rm ? " confirm" : ""}" data-remove>${this.rm ? "Confirmar: perder esta arma" : "Remover arma"}</button>`;
  }

  shipHtml() {
    const s = this.game.ship, def = s.def, st = s.stats;
    const chips = this.chips([
      ["Vida", `${s.hp}/${st.maxHp}`], ["Velocidade", Math.round(st.speed)],
      s.hasDodge ? ["Esquiva", `${f1(st.dodgeCooldown)} s`] : null,
      st.dmgReduction > 0 ? ["Resistência", `${Math.round(st.dmgReduction * 100)}%`] : null,
    ]);
    return `<div class="w-head"><div><h3>${esc(def.name)} <small>nave</small></h3>${chips}<p class="sub"><b class="sp">${esc(def.specialName)}:</b> ${esc(def.specialDesc)}</p></div></div>${this.branchesHtml({ type: "ship" })}`;
  }

  // Ramos de melhoria: grade de cards em 2 colunas. Cada card mostra o PRÓXIMO nível e o botão só com o custo.
  branchesHtml(target) {
    const g = this.game, tree = g.upgrades.treeOf(target), owned = g.upgrades.ownedOf(target);
    const icon = target.type === "slot" ? Art.iconURL(g.weapons.slots.get(target.slotId).weaponId) : "";
    const cards = tree.branches.map((b) => {
      const lv = branchLevel(b, owned), nx = nextNode(b, owned);
      const pips = `<i class="pips">${b.nodes.map((n, i) => `<s class="${i < lv ? "on" : ""}"></s>`).join("")}</i>`;
      let body, btn;
      if (!nx) { body = `<span class="g-d">Nível máximo</span>`; btn = `<div class="maxed">MÁX ✓</div>`; }
      else {
        const ok = g.upgrades.stateOf(target, nx.id) === "available";
        body = `<span class="g-n">${esc(nx.name)}</span><span class="g-d">${esc(nx.desc)}</span>`;
        btn = `<button type="button" class="btn buy" data-buy="${nx.id}" ${ok ? "" : "disabled"}>${nx.cost} ★</button>`;
      }
      return `<div class="gcard branch${nx && g.upgrades.stateOf(target, nx.id) !== "available" ? " poor" : ""}">
        ${icon ? `<img class="g-ico sm" alt="" src="${icon}">` : ""}<b>${esc(b.name)}</b>${pips}${body}${btn}</div>`;
    }).join("");
    return `<div class="grid2">${cards}</div>`;
  }

  /* ------------------------------ ações ------------------------------ */
  onPanelClick(e) {
    const g = this.game;
    const inst = e.target.closest("[data-install]");
    if (inst && this.sel?.type === "slot") {
      const id = inst.dataset.install, r = g.weapons.install(this.sel.slotId, id);
      Sound.play(r.ok ? "install" : "deny");
      if (r.ok) g.ui.toast(`${WEAPONS[id].name} instalado`);
      return this.refresh();
    }
    if (e.target.closest("[data-remove]") && this.sel?.type === "slot") {
      if (!this.rm) { this.rm = true; Sound.play("click"); return this.refresh(); }
      const r = g.weapons.remove(this.sel.slotId);
      this.rm = false;
      Sound.play(r.ok ? "deny" : "click");
      if (r.ok) g.ui.toast("Arma removida");
      return this.refresh();
    }
    const buy = e.target.closest("[data-buy]");
    if (buy && this.sel && !buy.disabled) {
      const r = g.upgrades.buy(this.sel, buy.dataset.buy);
      Sound.play(r.ok ? "buy" : "deny");
      if (r.ok) g.ui.toast(`${r.node.name} adquirido`);
      this.refresh();
    }
  }
}
