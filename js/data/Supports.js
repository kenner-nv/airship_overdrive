/* ==========================================================================
   Supports.js — MÓDULOS DE SUPORTE: o slot traseiro de cada nave (Ships.js → support).
   Diferente das armas, o módulo não dispara sozinho: ele cria um efeito (escudo, drone, clone) que dura até acabar
   (destruído / esgotado) e, depois que acaba, só volta após `cooldown` segundos de recarga.
   Para criar um módulo novo: 1) entrada aqui; 2) comportamento em SupportSystem.js (KINDS);
   3) ícone "icon.<id>" em Art.js (e, se tiver sprite próprio, "support.<id>"); nenhum outro arquivo precisa mudar.

   kind:  "shield" (bolha que absorve) · "attackDrone" (drone que atira) · "healDrone" (drone que cura) · "magnet" (ímã que atrai
          estrelas e vida) · "hologram" (clone holográfico da nave)
   cost:  custo de instalação (★).
   base:  atributos numéricos de cada tipo (veja o comentário de cada módulo).
   levels: 3 melhorias em sequência (a 2ª só depois da 1ª…). Cada uma: { name, desc, icon, effects[{stat, op:"add"|"mul"|"set", value}] }.
           `icon` = chave de um ícone de ramo (Art.js, branch.<icon>). O custo de cada nível = cost × UPGRADE_COST_MUL[nível].
   ========================================================================== */
export const UPGRADE_COST_MUL = [0.5, 0.8, 1.2];

const fx = (stat, op, value) => ({ stat, op, value });

export const SUPPORTS = {
  shield: {
    id: "shield",
    name: "Escudo de energia",
    role: "Bolha de energia ao redor da nave",
    diff: "Absorve 2 tiros inimigos ou 1 colisão",
    kind: "shield",
    color: "#5ff3ff",
    cost: 260,
    cooldown: 15,                 // recarga (s) contada a partir do momento em que o escudo some
    // charges: tiros inimigos absorvidos · ramCost: cargas perdidas numa colisão com inimigo (≥ charges = destrói de uma vez)
    base: { charges: 2, ramCost: 99 },
    levels: [
      { name: "Campo reforçado", desc: "+1 carga (3 tiros) e −10% de recarga", icon: "arm", effects: [fx("charges", "add", 1), fx("cooldown", "mul", 0.9)] },
      { name: "Campo ágil", desc: "−25% de recarga e colisão custa 2 cargas", icon: "cad", effects: [fx("cooldown", "mul", 0.75), fx("ramCost", "set", 2)] },
      { name: "Barreira cinética", desc: "+1 carga (4 tiros), −15% de recarga e colisão custa 1 carga", icon: "hull", effects: [fx("charges", "add", 1), fx("cooldown", "mul", 0.85), fx("ramCost", "set", 1)] },
    ],
  },
  attackDrone: {
    id: "attackDrone",
    name: "Drone de ataque",
    role: "Drone que ajuda a atirar",
    diff: "Mira nos inimigos próximos · resiste a 2 tiros ou 1 colisão",
    kind: "attackDrone",
    color: "#ffae3d",
    cost: 300,
    cooldown: 15,
    // damage/interval/speed/life: do tiro do drone · range: distância máxima do alvo (px) · orbit/orbitSpeed: órbita em volta da nave
    // follow: suavidade do seguimento (rad/s da mola amortecida; menor = mais lento/suave) · maxSpeed: velocidade máxima do drone (px/s)
    // hp: vida do drone (pontos) · shotCost: vida perdida por tiro inimigo · ramCost: vida perdida por colisão/feixe
    //   (hp 2, tiro 1, colisão 2 = "2 tiros ou 1 colisão") · drones: quantos drones são lançados
    // damage: dano MÍNIMO por tiro; na partida o dano sobe com as ondas (SupportSystem: metade da vida de um inimigo básico da onda
    //   atual = elimina um básico com 2 tiros) · damageMul: bônus das melhorias sobre esse dano
    base: { damage: 7, damageMul: 1, interval: 0.38, speed: 720, life: 0.9, range: 380, orbit: 60, orbitSpeed: 1.7, follow: 4, maxSpeed: 900,
      hp: 2, shotCost: 1, ramCost: 2, drones: 1 },
    levels: [
      { name: "Drone aprimorado", desc: "+20% de dano, +10% de cadência e +15% de velocidade", icon: "pot", effects: [fx("damageMul", "mul", 1.2), fx("interval", "mul", 0.9), fx("maxSpeed", "mul", 1.15), fx("follow", "mul", 1.15)] },
      { name: "Casco reforçado", desc: "Resiste a 4 tiros ou 2 colisões, +25% de dano e +10% de cadência", icon: "hull", effects: [fx("hp", "set", 4), fx("damageMul", "mul", 1.25), fx("interval", "mul", 0.9)] },
      { name: "Drone duplo", desc: "Solta 2 drones, com +15% de dano e de velocidade", icon: "dis", effects: [fx("drones", "set", 2), fx("damageMul", "mul", 1.15), fx("maxSpeed", "mul", 1.15), fx("follow", "mul", 1.15)] },
    ],
  },
  healDrone: {
    id: "healDrone",
    name: "Drone de reparo",
    role: "Drone que recupera a vida da nave",
    diff: "Invulnerável · só é lançado com a nave ferida · some após curar 50% da vida ou ao chegar a 100%",
    kind: "healDrone",
    color: "#7cffb2",
    cost: 300,
    cooldown: 15,
    // healPerSec: fração da vida MÁXIMA recuperada por segundo · healCap: total que ele cura (fração da vida máxima, só vida
    // realmente recuperada conta) antes de ir embora. Também vai embora se a nave chegar a 100% da vida. Não leva dano.
    // A recarga conta a partir do momento em que ele some; com a recarga pronta, ele sai assim que a nave perde vida.
    // drones: quantos drones são lançados (cada um cura a sua cota)
    base: { healPerSec: 0.04, healCap: 0.5, orbit: 46, orbitSpeed: 1.2, follow: 4, maxSpeed: 900, drones: 1 },
    levels: [
      { name: "Reparo ampliado", desc: "Cura até 65% da vida, +15% de cura/s e de velocidade", icon: "hull", effects: [fx("healCap", "set", 0.65), fx("healPerSec", "mul", 1.15), fx("maxSpeed", "mul", 1.15), fx("follow", "mul", 1.15)] },
      { name: "Reparo veloz", desc: "Cura até 80% da vida e +30% de cura por segundo", icon: "pot", effects: [fx("healCap", "set", 0.8), fx("healPerSec", "mul", 1.3)] },
      { name: "Drone duplo", desc: "Solta 2 drones de reparo, com +15% de cura por segundo", icon: "dis", effects: [fx("drones", "set", 2), fx("healPerSec", "mul", 1.15)] },
    ],
  },
  magnet: {
    id: "magnet",
    name: "Ímã",
    role: "Atrai estrelas e itens de vida",
    diff: "Puxa para a nave as estrelas e os itens de vida da arena por alguns segundos",
    kind: "magnet",
    color: "#c58bff",
    cost: 200,
    cooldown: 14,                 // recarga (s) contada a partir do momento em que o efeito acaba
    // duration: tempo ativo (s) · range: alcance da atração (px; maior que a diagonal da arena = arena inteira)
    // accel/pullSpeed: aceleração (px/s²) e velocidade máxima (px/s) com que os itens são puxados
    base: { duration: 6, range: 1200, accel: 900, pullSpeed: 700 },
    levels: [
      { name: "Campo estendido", desc: "+1,5 s de duração e puxa 20% mais rápido", icon: "pot", effects: [fx("duration", "add", 1.5), fx("accel", "mul", 1.2), fx("pullSpeed", "mul", 1.2)] },
      { name: "Campo ágil", desc: "+1,5 s de duração e −25% de recarga", icon: "cad", effects: [fx("duration", "add", 1.5), fx("cooldown", "mul", 0.75)] },
      { name: "Atração intensa", desc: "+2 s de duração, −15% de recarga e puxa 50% mais rápido", icon: "eng", effects: [fx("duration", "add", 2), fx("cooldown", "mul", 0.85), fx("accel", "mul", 1.5), fx("pullSpeed", "mul", 1.5)] },
    ],
  },
  hologram: {
    id: "hologram",
    name: "Clone holográfico",
    role: "Clone holográfico da sua nave",
    diff: "Espelha seus movimentos · usa só a arma do slot central · metade da vida e do dano · recarrega 45 s depois de destruído",
    kind: "hologram",
    color: "#6ec6ff",
    cost: 450,
    cooldown: 45,                 // recarga (s) contada a partir do momento em que o clone é destruído
    // hpMul/dmgMul: vida e dano do clone em relação à nave (vida máxima da nave / dano da arma do slot)
    // allSlots: 0 = só a arma do slot central · 1 = as armas de todos os slots
    base: { hpMul: 0.5, dmgMul: 0.5, allSlots: 0 },
    levels: [
      { name: "Projeção densa", desc: "+15% de vida e de dano do clone", icon: "hull", effects: [fx("hpMul", "mul", 1.15), fx("dmgMul", "mul", 1.15)] },
      { name: "Recarga rápida", desc: "Recarrega em 30 s", icon: "cad", effects: [fx("cooldown", "set", 30)] },
      { name: "Arsenal espelhado", desc: "O clone usa também as armas dos outros slots", icon: "dis", effects: [fx("allSlots", "set", 1)] },
    ],
  },
};

// Ordem de exibição: sempre pelo custo (menor → maior). Empates mantêm a ordem em que aparecem aqui.
export const SUPPORT_ORDER = Object.keys(SUPPORTS).sort((a, b) => SUPPORTS[a].cost - SUPPORTS[b].cost);

// Custo (★) do nível `n` (0 = 1º nível) de um módulo.
export const upgradeCost = (id, n) => Math.max(5, Math.round((SUPPORTS[id].cost * UPGRADE_COST_MUL[n]) / 5) * 5);

// Atributos finais do módulo no nível `level` (0..3): base + efeitos dos níveis comprados.
export function supportStats(id, level) {
  const def = SUPPORTS[id], out = { ...def.base, cooldown: def.cooldown };
  for (let i = 0; i < level; i++) {
    for (const e of def.levels[i].effects) {
      if (e.op === "set") out[e.stat] = e.value;
      else if (e.op === "add") out[e.stat] += e.value;
      else out[e.stat] *= e.value;
    }
  }
  return out;
}
