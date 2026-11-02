/* ==========================================================================
   UpgradeSystem.js — consulta e compra de melhorias (árvores das armas e da nave).
   `target` = { type: "slot", slotId } | { type: "ship" }.
   O estado de cada nó vem SEMPRE dos pré-requisitos explícitos (node.requires), nunca da interface.
   ========================================================================== */
import { WEAPON_TREES, SHIP_TREES } from "./data/Upgrades.js";

export class UpgradeSystem {
  constructor(game) { this.game = game; }

  slotOf(target) { return target.type === "slot" ? this.game.weapons.slots.get(target.slotId) : null; }

  treeOf(target) {
    if (target.type === "ship") return SHIP_TREES[this.game.ship.def.id];
    const slot = this.slotOf(target);
    return slot?.weaponId ? WEAPON_TREES[slot.weaponId] : null;
  }

  ownedOf(target) { return target.type === "ship" ? this.game.ship.owned : this.slotOf(target)?.owned ?? new Set(); }

  missing(target, nodeId) {
    const tree = this.treeOf(target), owned = this.ownedOf(target);
    return tree.byId[nodeId].requires.filter((r) => !owned.has(r)).map((r) => tree.byId[r].name);
  }

  // "owned" | "locked" | "poor" (sem moedas) | "available"
  stateOf(target, nodeId) {
    const tree = this.treeOf(target);
    const node = tree?.byId[nodeId];
    if (!node) return "locked";
    if (this.ownedOf(target).has(nodeId)) return "owned";
    if (this.missing(target, nodeId).length) return "locked";
    return this.game.currency.canAfford(node.cost) ? "available" : "poor";
  }

  // Compra = verificar pré-requisitos + saldo, debitar e aplicar o efeito, tudo junto.
  buy(target, nodeId) {
    const tree = this.treeOf(target);
    const node = tree?.byId[nodeId];
    if (!node) return { ok: false, reason: "invalid" };
    const owned = this.ownedOf(target);
    if (owned.has(nodeId)) return { ok: false, reason: "owned" };
    if (this.missing(target, nodeId).length) return { ok: false, reason: "locked" };
    if (!this.game.currency.spend(node.cost)) return { ok: false, reason: "coins" };
    try {
      owned.add(nodeId);
      if (target.type === "ship") this.game.ship.recompute();
      else this.game.weapons.recompute(this.slotOf(target));
    } catch (err) {                                   // nunca cobrar sem aplicar
      owned.delete(nodeId);
      this.game.currency.add(node.cost);
      console.error(err);
      return { ok: false, reason: "error" };
    }
    return { ok: true, node };
  }
}
