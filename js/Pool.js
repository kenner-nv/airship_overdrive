/* Pool.js — reaproveita objetos (projéteis, partículas) para não gerar lixo a cada quadro. */
export class Pool {
  constructor(factory, capacity) {
    this.free = [];
    this.active = [];
    for (let i = 0; i < capacity; i++) this.free.push(factory());
  }
  acquire() {
    const o = this.free.pop();
    if (!o) return null;           // limite atingido: o chamador simplesmente não cria
    this.active.push(o);
    return o;
  }
  // fn(o) devolve false para devolver o objeto ao pool. Percorre de trás para frente (remoção segura).
  update(fn) {
    const a = this.active;
    for (let i = a.length - 1; i >= 0; i--) {
      if (fn(a[i]) === false) {
        this.free.push(a[i]);
        a[i] = a[a.length - 1];
        a.pop();
      }
    }
  }
  clear() {
    while (this.active.length) this.free.push(this.active.pop());
  }
}
