/* ==========================================================================
   Weapons.js — definição das armas (módulos). Para criar uma arma nova:
   1) adicione uma entrada aqui; 2) crie sua árvore em Upgrades.js (WEAPON_TREES);
   3) (opcional) sprite/ícone em Art.js e som em Audio.js. Nenhum outro arquivo precisa mudar.

   Atributos (stats) usados pelo WeaponSystem:
     damage   dano por acerto            interval  segundos entre ciclos de disparo
     speed    velocidade do projétil     life      duração do projétil (s)  → alcance = speed × life
     count    projéteis por volley       spread    abertura total do leque (graus)
     pierce   inimigos atravessados      homing    giro de rastreamento (rad/s)
     blast    raio de explosão/pulso     size      raio do projétil
     burst    volleys por ciclo
   kind: "bullet" (projétil reto) · "laser" · "missile" · "pulse" (área ao redor do slot)
   limits: [mín, máx] por atributo e por arma (GDD 9.8). count: cada arma pode ter no máximo 1 projétil a mais que o padrão.
   ========================================================================== */
export const WEAPONS = {
  basic: {
    id: "basic",
    name: "Canhão Básico",
    role: "Tiro reto e confiável",
    diff: "Cadência alta, dano baixo",
    kind: "bullet",
    cost: 110,
    color: "#5ff3ff",
    sound: "shoot_basic",
    base: { damage: 8, interval: 0.28, speed: 720, life: 1.4, count: 1, spread: 0, pierce: 0, homing: 0, blast: 0, size: 4, burst: 1 },
    limits: { interval: [0.07, 9], count: [1, 2], pierce: [0, 6], speed: [100, 1400], burst: [1, 4], spread: [0, 90], size: [3, 9] },
  },
  laser: {
    id: "laser",
    name: "Laser",
    role: "Feixe preciso que atravessa",
    diff: "Perfura vários inimigos, cadência média",
    kind: "laser",
    cost: 180,
    color: "#b6ff5a",
    sound: "shoot_laser",
    base: { damage: 14, interval: 0.55, speed: 1500, life: 0.75, count: 1, spread: 0, pierce: 3, homing: 0, blast: 0, size: 3, burst: 1 },
    limits: { interval: [0.14, 9], count: [1, 2], pierce: [0, 12], speed: [200, 2200], burst: [1, 3], spread: [0, 40], size: [3, 10] },
  },
  missile: {
    id: "missile",
    name: "Míssil",
    role: "Explode no impacto",
    diff: "Dano alto em área, cadência lenta, pode rastrear",
    kind: "missile",
    cost: 200,
    color: "#ffd24a",
    sound: "shoot_missile",
    base: { damage: 30, interval: 1.0, speed: 560, life: 2.4, count: 1, spread: 0, pierce: 0, homing: 0, blast: 46, size: 6, burst: 1 },
    limits: { interval: [0.3, 9], count: [1, 2], blast: [0, 130], homing: [0, 9], speed: [200, 900], burst: [1, 3], spread: [0, 70] },
  },
  spread: {
    id: "spread",
    name: "Disparo Múltiplo",
    role: "Leque de projéteis",
    diff: "Cobertura ampla, curto alcance",
    kind: "bullet",
    cost: 140,
    color: "#7cffb2",
    sound: "shoot_spread",
    base: { damage: 6, interval: 0.55, speed: 560, life: 0.8, count: 3, spread: 36, pierce: 0, homing: 0, blast: 0, size: 4, burst: 1 },
    limits: { interval: [0.15, 9], count: [3, 4], pierce: [0, 5], speed: [100, 1000], burst: [1, 3], spread: [10, 120], size: [3, 8] },
  },
  area: {
    id: "area",
    name: "Pulso de Área",
    role: "Onda de choque ao redor do slot",
    diff: "Atinge grupos próximos, não precisa mirar",
    kind: "pulse",
    cost: 230,
    color: "#9b8cff",
    sound: "shoot_pulse",
    base: { damage: 18, interval: 1.7, speed: 0, life: 0.4, count: 1, spread: 0, pierce: 0, homing: 0, blast: 105, size: 0, burst: 1 },
    limits: { interval: [0.45, 9], blast: [40, 240], burst: [1, 3] },
  },
};

export const WEAPON_ORDER = ["basic", "spread", "laser", "missile", "area"];
