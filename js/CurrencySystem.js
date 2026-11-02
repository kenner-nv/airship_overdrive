/* CurrencySystem.js — moedas da TENTATIVA ATUAL. Zeradas a cada nova partida; nunca persistidas. */
export class CurrencySystem {
  constructor() { this.coins = 0; }
  reset(start = 0) { this.coins = start; }
  add(n) { if (n > 0) this.coins += Math.floor(n); }
  canAfford(n) { return this.coins >= n; }
  // Debita se houver saldo. Devolve true/false (a compra e o efeito são uma operação só — ver UpgradeSystem).
  spend(n) {
    if (!(n >= 0) || this.coins < n) return false;
    this.coins -= n;
    return true;
  }
}
