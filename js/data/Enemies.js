/* ==========================================================================
   Enemies.js — arquétipos de inimigos (GDD 11.2). Tudo configurável aqui.
   behavior: zigzag | dive | shooter | sine | boss   (funções em EnemySystem.js)
   fire[]: padrões de ataque. pattern: "aimed" (mira na nave) | "ring" (anel) | "missile" (teleguiado)
     | "beam" (laser em linha até o fim da tela) | "spiral" (rajadas em espiral)
     interval (s) · count · spreadDeg (aimed) · bulletSpeed · damage · telegraph (aviso antes do tiro, s)
   threat = "custo" no orçamento da onda · weight = chance relativa · minWave = onda em que aparece
   heavy: true = inimigo "pesado" (como os de elite): a esquiva do Espectro no nível máximo só causa dano, não destrói.
   ========================================================================== */
export const ENEMIES = {
  basic: {
    id: "basic", name: "Drone", sprite: "enemy.basic", behavior: "zigzag",
    hp: 10, speed: 95, radius: 16, ramDamage: 18, score: 10, coins: 3,
    threat: 1, weight: 10, minWave: 1, fire: [],
  },
  fast: {
    id: "fast", name: "Ceifador", sprite: "enemy.fast", behavior: "dive",
    hp: 6, speed: 235, radius: 12, ramDamage: 15, score: 15, coins: 3,
    threat: 1.5, weight: 6, minWave: 2, fire: [],
    formation: { min: 3, max: 5, spacing: 48 },
  },
  shooter: {
    id: "shooter", name: "Artilheiro", sprite: "enemy.shooter", behavior: "shooter",
    hp: 22, speed: 85, radius: 20, ramDamage: 20, score: 30, coins: 6,
    threat: 2.5, weight: 5, minWave: 3, holdY: [110, 260],
    fire: [{ pattern: "aimed", interval: 1.9, count: 1, spreadDeg: 0, bulletSpeed: 230, damage: 10, telegraph: 0.35 }],
  },
  tough: {
    id: "tough", name: "Couraçado", sprite: "enemy.tough", behavior: "zigzag",
    hp: 70, speed: 48, radius: 26, ramDamage: 35, score: 45, coins: 11,
    threat: 4, weight: 3, minWave: 4, fire: [], heavy: true,
  },
  weaver: {
    id: "weaver", name: "Tecelão", sprite: "enemy.weaver", behavior: "sine",
    hp: 28, speed: 75, radius: 15, ramDamage: 20, score: 40, coins: 9,
    threat: 3.5, weight: 3, minWave: 6,
    fire: [{ pattern: "ring", interval: 3.2, count: 8, bulletSpeed: 150, damage: 9, telegraph: 0.5 }],
  },
  launcher: {
    id: "launcher", name: "Lançador", sprite: "enemy.launcher", behavior: "shooter",
    hp: 34, speed: 80, radius: 22, ramDamage: 22, score: 60, coins: 10,
    threat: 3.5, weight: 3, minWave: 11, holdY: [100, 220],
    fire: [{ pattern: "missile", interval: 3.4, count: 1, bulletSpeed: 150, turn: 1.5, damage: 14, telegraph: 0.5 }],
  },
  beamer: {
    id: "beamer", name: "Atirador de Feixe", sprite: "enemy.beamer", behavior: "shooter",
    hp: 40, speed: 70, radius: 20, ramDamage: 24, score: 80, coins: 13,
    threat: 4.5, weight: 3, minWave: 16, holdY: [90, 200],
    fire: [{ pattern: "beam", interval: 5, count: 1, aim: false, warn: 1.0, dur: 0.55, width: 26, damage: 22, telegraph: 0 }],
  },
  elite: {
    id: "elite", name: "Comandante", sprite: "enemy.elite", behavior: "boss",
    hp: 520, speed: 35, radius: 40, ramDamage: 40, score: 300, coins: 60,
    threat: 0, weight: 0, minWave: 5, special: true, holdY: [150, 190],
    fire: [
      { pattern: "aimed", interval: 1.7, count: 3, spreadDeg: 14, bulletSpeed: 250, damage: 12, telegraph: 0.4 },
      { pattern: "ring", interval: 4.2, count: 14, bulletSpeed: 160, damage: 10, telegraph: 0.6 },
    ],
  },
  elite2: {
    id: "elite2", name: "Soberano", sprite: "enemy.elite2", behavior: "boss",
    hp: 900, speed: 35, radius: 45, ramDamage: 45, score: 600, coins: 100,
    threat: 0, weight: 0, minWave: 21, special: true, holdY: [150, 190],
    fire: [
      // rajadas em espiral: 3,2 s ligado / 2,2 s desligado
      { pattern: "spiral", interval: 0.13, arms: 2, step: 0.32, on: 3.2, off: 2.2, bulletSpeed: 175, damage: 9, telegraph: 0 },
      // dois feixes em linha até o fim da tela, travados perto da posição da nave
      { pattern: "beam", interval: 6.5, count: 2, spacing: 120, aim: true, warn: 1.2, dur: 0.6, width: 28, damage: 26, telegraph: 0 },
    ],
  },
};
