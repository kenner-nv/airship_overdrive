/* ==========================================================================
   Supports.js — MÓDULOS DE SUPORTE: o slot traseiro de cada nave (Ships.js → support).
   Diferente das armas, o módulo não dispara sozinho: ele cria um efeito (escudo, drone) que dura até acabar
   (destruído / esgotado) e, depois que acaba, só volta após `cooldown` segundos de recarga.
   Para criar um módulo novo: 1) entrada aqui; 2) comportamento em SupportSystem.js (KINDS);
   3) ícone "icon.<id>" em Art.js (e, se tiver sprite próprio, "support.<id>"); nenhum outro arquivo precisa mudar.

   kind:  "shield" (bolha que absorve) · "attackDrone" (drone que atira) · "healDrone" (drone que cura) · "magnet" (ímã que atrai estrelas e vida)
   base:  atributos numéricos de cada tipo (veja o comentário de cada módulo).
   O CUSTO de instalação não fica aqui: é Config.economy.supportCostMul × o custo médio das armas.
   ========================================================================== */
export const SUPPORTS = {
  shield: {
    id: "shield",
    name: "Escudo de energia",
    role: "Bolha de energia ao redor da nave",
    diff: "Absorve 2 tiros inimigos ou 1 colisão",
    kind: "shield",
    color: "#5ff3ff",
    cooldown: 15,                 // recarga (s) contada a partir do momento em que o escudo some
    // charges: tiros inimigos absorvidos · ramCost: cargas perdidas numa colisão com inimigo (≥ charges = destrói de uma vez)
    base: { charges: 2, ramCost: 99 },
  },
  attackDrone: {
    id: "attackDrone",
    name: "Drone de ataque",
    role: "Drone que ajuda a atirar",
    diff: "Mira nos inimigos próximos · some com 1 tiro ou colisão",
    kind: "attackDrone",
    color: "#ffae3d",
    cooldown: 15,
    // damage/interval/speed/life: do tiro do drone · range: distância máxima do alvo (px) · orbit/orbitSpeed: órbita em volta da nave
    // follow: suavidade do seguimento (rad/s da mola amortecida; menor = mais lento/suave) · maxSpeed: velocidade máxima do drone (px/s)
    base: { damage: 7, interval: 0.38, speed: 720, life: 0.9, range: 380, orbit: 60, orbitSpeed: 1.7, follow: 4, maxSpeed: 900 },
  },
  healDrone: {
    id: "healDrone",
    name: "Drone de reparo",
    role: "Drone que recupera a vida da nave",
    diff: "Invulnerável · só é lançado com a nave ferida · some após curar 50% da vida ou ao chegar a 100%",
    kind: "healDrone",
    color: "#7cffb2",
    cooldown: 15,
    // healPerSec: fração da vida MÁXIMA recuperada por segundo · healCap: total que ele cura (fração da vida máxima, só vida
    // realmente recuperada conta) antes de ir embora. Também vai embora se a nave chegar a 100% da vida. Não leva dano.
    // A recarga conta a partir do momento em que ele some; com a recarga pronta, ele sai assim que a nave perde vida.
    base: { healPerSec: 0.04, healCap: 0.5, orbit: 46, orbitSpeed: 1.2, follow: 4, maxSpeed: 900 },
  },
  magnet: {
    id: "magnet",
    name: "Ímã",
    role: "Atrai estrelas e itens de vida",
    diff: "Puxa para a nave as estrelas e os itens de vida da arena por alguns segundos",
    kind: "magnet",
    color: "#c58bff",
    cooldown: 14,                 // recarga (s) contada a partir do momento em que o efeito acaba
    // duration: tempo ativo (s) · range: alcance da atração (px; maior que a diagonal da arena = arena inteira)
    // accel/pullSpeed: aceleração (px/s²) e velocidade máxima (px/s) com que os itens são puxados
    base: { duration: 6, range: 1200, accel: 900, pullSpeed: 700 },
  },
};

export const SUPPORT_ORDER = ["shield", "attackDrone", "healDrone", "magnet"];
