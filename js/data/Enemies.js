/* ==========================================================================
   Enemies.js — arquétipos de inimigos (GDD 11.2). Tudo configurável aqui.
   behavior: zigzag | dive | shooter | sine | boss   (funções em EnemySystem.js)
   fire[]: padrões de ataque. pattern: "aimed" (mira na nave) | "ring" (anel) | "missile" (teleguiado)
     | "beam" (laser em linha até o fim da tela) | "spiral" (rajadas em espiral)
     interval (s) · count · spreadDeg (aimed) · bulletSpeed · damage · telegraph (aviso antes do tiro, s)
   threat = "custo" no orçamento da onda · weight = chance relativa · minWave = onda em que aparece
   heavy: true = inimigo "pesado" (como os de elite): a esquiva do Espectro no nível máximo só causa dano, não destrói.
   maxWave: última onda em que o tipo aparece (o substituto entra na onda seguinte e o antigo some de vez).
   intro: true = inimigo NOVO: na onda em que entra (e na seguinte) só aparece com outros inimigos já conhecidos na tela, um de cada vez
          (regras em Config.waves.rules / WaveSystem.js).  cap/group/ranged: limites de quantidade na tela (a partir da onda 20).
   evade: impulso lateral (px/s) ao ser atingido pelo jogador — o inimigo sai da linha de tiro · enter: multiplicador da velocidade de entrada (atiradores).
   ability: habilidade especial (EnemyAbilities.js) · ap: parâmetros dessa habilidade (dano "base" é multiplicado pelo escalonamento da onda).
   ========================================================================== */
export const ENEMIES = {
  basic: {
    id: "basic", name: "Drone", sprite: "enemy.basic", behavior: "zigzag",
    hp: 10, speed: 95, radius: 16, ramDamage: 18, score: 10, coins: 3,
    threat: 1, weight: 10, minWave: 1, maxWave: 20, fire: [],
  },
  fast: {
    id: "fast", name: "Ceifador", sprite: "enemy.fast", behavior: "dive",
    hp: 6, speed: 235, radius: 12, ramDamage: 15, score: 15, coins: 3,
    threat: 1.5, weight: 6, minWave: 2, maxWave: 20, fire: [],
    formation: { min: 3, max: 5, spacing: 48 },
  },
  shooter: {
    id: "shooter", name: "Artilheiro", sprite: "enemy.shooter", behavior: "shooter",
    hp: 22, speed: 85, radius: 20, ramDamage: 20, score: 30, coins: 6,
    threat: 2.5, weight: 5, minWave: 3, maxWave: 25, holdY: [110, 260],
    fire: [{ pattern: "aimed", interval: 1.9, count: 1, spreadDeg: 0, bulletSpeed: 230, damage: 10, telegraph: 0.35 }],
  },
  tough: {
    id: "tough", name: "Couraçado", sprite: "enemy.tough", behavior: "zigzag",
    hp: 70, speed: 48, radius: 26, ramDamage: 35, score: 45, coins: 11,
    threat: 4, weight: 3, minWave: 4, maxWave: 22, fire: [], heavy: true,
  },
  weaver: {
    id: "weaver", name: "Tecelão", sprite: "enemy.weaver", behavior: "sine",
    hp: 28, speed: 75, radius: 15, ramDamage: 20, score: 40, coins: 9,
    threat: 3.5, weight: 3, minWave: 6, maxWave: 27,
    fire: [{ pattern: "ring", interval: 3.2, count: 8, bulletSpeed: 150, damage: 9, telegraph: 0.5 }],
  },
  launcher: {
    id: "launcher", name: "Lançador", sprite: "enemy.launcher", behavior: "shooter",
    hp: 34, speed: 80, radius: 22, ramDamage: 22, score: 60, coins: 10,
    threat: 3.5, weight: 3, minWave: 11, maxWave: 33, holdY: [100, 220],
    fire: [{ pattern: "missile", interval: 3.4, count: 1, bulletSpeed: 150, turn: 1.5, damage: 14, telegraph: 0.5 }],
  },
  beamer: {
    id: "beamer", name: "Atirador de Feixe", sprite: "enemy.beamer", behavior: "shooter",
    hp: 40, speed: 70, radius: 20, ramDamage: 24, score: 80, coins: 13,
    threat: 4.5, weight: 3, minWave: 13, maxWave: 31, ranged: true, group: "beam", holdY: [90, 200],
    fire: [{ pattern: "beam", interval: 5, count: 1, aim: false, warn: 1.0, dur: 0.55, width: 19.5, damage: 22, telegraph: 0 }],
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
    hp: 900, speed: 35, radius: 54, ramDamage: 45, score: 600, coins: 100,
    threat: 0, weight: 0, minWave: 15, special: true, holdY: [150, 190],
    fire: [
      // rajadas em espiral: 3,2 s ligado / 2,2 s desligado
      { pattern: "spiral", interval: 0.13, arms: 2, step: 0.32, on: 3.2, off: 2.2, bulletSpeed: 175, damage: 9, telegraph: 0 },
      // dois feixes em linha até o fim da tela, travados perto da posição da nave
      { pattern: "beam", interval: 6.5, count: 2, spacing: 120, aim: true, warn: 1.2, dur: 0.6, width: 21, damage: 26, telegraph: 0 },
    ],
  },

  /* ===================== NOVOS INIMIGOS (substituem os antigos a partir da onda 21) ===================== */
  // onda 21 — substitui o Drone
  ghost: {
    id: "ghost", name: "Drone Fantasma", sprite: "enemy.ghost", behavior: "zigzag",
    hp: 16, speed: 100, radius: 16, ramDamage: 22, score: 25, coins: 4,
    threat: 1.5, weight: 10, minWave: 21, intro: true, introFree: true, fire: [],
    ability: "ghost", ap: { visible: 2.2, hidden: 1.0, jump: 140, warn: 0.4 },
  },
  // onda 21 — substitui o Ceifador
  dodger: {
    id: "dodger", name: "Ceifador Esquivo", sprite: "enemy.dodger", behavior: "dive",
    hp: 12, speed: 220, radius: 12, ramDamage: 18, score: 30, coins: 5,
    threat: 2.5, weight: 6, minWave: 21, intro: true, fire: [],
    formation: { min: 3, max: 5, spacing: 48 },
    ability: "dodge", ap: { sense: 140, speed: 120, cooldown: 1.2, dur: 0.5 },
  },
  // onda 23 — substitui o Couraçado
  explosive: {
    id: "explosive", name: "Couraçado Explosivo", sprite: "enemy.explosive", behavior: "zigzag",
    hp: 158, speed: 48, radius: 28, ramDamage: 40, score: 90, coins: 14,
    threat: 5, weight: 3, minWave: 23, maxWave: 36, intro: true, heavy: true, fire: [],
    evade: 110,
    ability: "explosive", ap: { dmg: 30, radius: 85, fuse: 0.6 },
  },
  // onda 26 — substitui o Artilheiro
  sniper: {
    id: "sniper", name: "Franco-atirador", sprite: "enemy.sniper", behavior: "shooter",
    hp: 70, speed: 80, radius: 20, ramDamage: 24, score: 100, coins: 14,
    threat: 4.5, weight: 5, minWave: 26, maxWave: 41, intro: true, ranged: true, cap: 2, holdY: [90, 210], fire: [],
    evade: 320, enter: 2.2,
    ability: "sniper", ap: { dmg: 26, speed: 520, aim: 0.9, lock: 0.25, every: 3.8 },
  },
  // onda 28 — substitui o Tecelão
  jammer: {
    id: "jammer", name: "Interferidor", sprite: "enemy.jammer", behavior: "sine",
    hp: 84, speed: 70, radius: 18, ramDamage: 22, score: 100, coins: 14,
    threat: 5, weight: 3, minWave: 28, maxWave: 43, intro: true, ranged: true, cap: 1, fire: [],
    evade: 300, enter: 2.2,
    ability: "jammer", ap: { grow: 2.5, radius: 250, rest: 3.2, off: 2, dmg: 18 },
  },
  // onda 32 — substitui o Atirador de Feixe
  sweeper: {
    id: "sweeper", name: "Varredor", sprite: "enemy.sweeper", behavior: "shooter",
    hp: 96, speed: 70, radius: 22, ramDamage: 26, score: 120, coins: 18,
    threat: 6, weight: 3, minWave: 32, maxWave: 38, intro: true, ranged: true, group: "beam", heavy: true, holdY: [90, 190], fire: [],
    evade: 280, enter: 2.2,
    ability: "sweeper", ap: { dmg: 22, width: 18, warn: 1.2, sweep: 2.2, arc: 70, cycle: 6 },
  },
  // onda 34 — substitui o Lançador
  gravity: {
    id: "gravity", name: "Gravitacional", sprite: "enemy.gravity", behavior: "shooter",
    hp: 105, speed: 75, radius: 22, ramDamage: 26, score: 120, coins: 18,
    threat: 6, weight: 3, minWave: 34, intro: true, ranged: true, cap: 1, heavy: true, holdY: [100, 220],
    fire: [{ pattern: "aimed", interval: 2.2, count: 1, spreadDeg: 0, bulletSpeed: 230, damage: 12, telegraph: 0.35 }],
    // onda gravitacional (3 s, encolhe até ele) empurra a nave e desvia os tiros do jogador; depois 2 s de descanso: janela para acertá-lo
    evade: 260, enter: 2.2,
    ability: "gravity", ap: { radius: 250, push: 90, wave: 3, rest: 2, deflect: 5 },
  },
  // onda 37 — substitui o Couraçado Explosivo
  guardian: {
    id: "guardian", name: "Guardião Orbital", sprite: "enemy.guardian", behavior: "zigzag",
    hp: 245, speed: 50, radius: 24, ramDamage: 40, score: 150, coins: 22,
    threat: 7, weight: 3, minWave: 37, maxWave: 46, intro: true, heavy: true, fire: [],
    evade: 110,
    ability: "guardian", ap: { satHp: 70, satR: 11, orbit: 62, spin: 1.7, dmg: 9, every: 2.4, respawn: 10, speed: 240 },
  },
  // onda 39 — substitui o Varredor
  net: {
    id: "net", name: "Rede de Feixes", sprite: "enemy.net", behavior: "shooter",
    hp: 122, speed: 70, radius: 24, ramDamage: 28, score: 180, coins: 24,
    threat: 8, weight: 3, minWave: 39, intro: true, ranged: true, group: "beam", heavy: true, holdY: [90, 190], fire: [],
    evade: 280, enter: 2.2,
    ability: "net", ap: { dmg: 24, width: 17, warn: 1.2, dur: 1.4, rot: 0.35, every: 5.5 },
  },
  // onda 42 — substitui o Franco-atirador
  micro: {
    id: "micro", name: "Lançador de Micromísseis", sprite: "enemy.micro", behavior: "shooter",
    hp: 122, speed: 70, radius: 22, ramDamage: 28, score: 150, coins: 18,
    threat: 6, weight: 3, minWave: 42, intro: true, ranged: true, group: "snipe", cap: 2, heavy: true, holdY: [90, 200], fire: [],
    evade: 280, enter: 2.2,
    ability: "micro", ap: { dmg: 7, count: 6, every: 5, warn: 0.6, speed: 150, turn: 1.9 },
  },
  // onda 44 — substitui o Interferidor
  adaptive: {
    id: "adaptive", name: "Adaptador", sprite: "enemy.adaptive", behavior: "shooter",
    hp: 149, speed: 70, radius: 21, ramDamage: 26, score: 160, coins: 20,
    threat: 6, weight: 3, minWave: 44, intro: true, ranged: true, cap: 1, heavy: true, holdY: [100, 210],
    fire: [{ pattern: "aimed", interval: 2.4, count: 1, spreadDeg: 0, bulletSpeed: 240, damage: 10, telegraph: 0.35 }],
    evade: 120, enter: 2.2,
    ability: "adaptive", ap: { resist: 0.6, window: 3 },
  },
  // onda 47 — substitui o Guardião Orbital
  designator: {
    id: "designator", name: "Designador", sprite: "enemy.designator", behavior: "shooter",
    hp: 175, speed: 70, radius: 22, ramDamage: 30, score: 200, coins: 26,
    threat: 8, weight: 3, minWave: 47, intro: true, ranged: true, cap: 1, heavy: true, holdY: [90, 200], fire: [],
    evade: 280, enter: 2.2,
    ability: "designator", ap: { dmg: 24, zones: [2, 3], r: 55, warn: 1.6, every: 6, near: 110 },
  },

  /* ===================== ELITES NOVOS ===================== */
  // onda 30 — duas torres + núcleo
  colossus: {
    id: "colossus", name: "Colosso", sprite: "enemy.colossus", behavior: "boss",
    hp: 2700, speed: 35, radius: 50, ramDamage: 50, score: 1200, coins: 180,
    threat: 0, weight: 0, minWave: 30, special: true, holdY: [150, 185],
    fire: [
      { pattern: "aimed", interval: 1.7, count: 3, spreadDeg: 14, bulletSpeed: 250, damage: 12, telegraph: 0.4 },
      { pattern: "ring", interval: 4.2, count: 14, bulletSpeed: 160, damage: 10, telegraph: 0.6 },
    ],
    ability: "colossus", ap: {
      turretHp: 900, turretR: 21, turretX: 74, turretY: 8, shotDmg: 20, shotSpeed: 520, aim: 0.9, lock: 0.25, gap: 0.35, charge: 3.2,
      pulseEvery: 4, pulseWarn: 0.9, pulseRadius: 250, pulseRadiusH: 0.5, off: 2, phase3: 0.3,
    },
  },
  // onda 40 — gravidade, satélites e teia de lasers
  singularity: {
    id: "singularity", name: "Singularidade", sprite: "enemy.singularity", behavior: "boss",
    hp: 7000, speed: 35, radius: 44, ramDamage: 55, score: 2000, coins: 300,
    threat: 0, weight: 0, minWave: 40, special: true, holdY: [150, 185],
    fire: [{ pattern: "aimed", interval: 2.2, count: 5, spreadDeg: 12, bulletSpeed: 230, damage: 9, telegraph: 0.4 }],
    ability: "singularity", ap: {
      push: 80, pushRadius: 330, wave: 3, rest: 2, deflect: 5, satHp: 650, satR: 13, satCount: 3, satOrbit: 88, satSpin: 1.1, satEvery: 2.4, satDmg: 9, satSpeed: 240,
      beamDmg: 28, beamWidth: 20, webEvery: 3.6, webWarn: 1.2, webDur: 1.3, vanishEvery: 2, phase2: 0.66, phase3: 0.3,
    },
  },
  // onda 50 — naves de tecnologia avançada: mísseis teleguiados, escudo adaptativo e designação orbital
  hegemon: {
    id: "hegemon", name: "Hegemon", sprite: "enemy.hegemon", behavior: "boss",
    hp: 9500, speed: 35, radius: 52, ramDamage: 50, score: 3000, coins: 450,
    threat: 0, weight: 0, minWave: 50, special: true, holdY: [150, 185],
    fire: [{ pattern: "aimed", interval: 1.7, count: 3, spreadDeg: 12, bulletSpeed: 250, damage: 10, telegraph: 0.4 }],
    ability: "hegemon", ap: {
      microDmg: 7, micro: 8, microEvery: 4.5, microEvery2: 6.5, microWarn: 0.6, microSpeed: 150, microTurn: 1.9,
      resist: 0.6, resist3: 0.3, window: 3, zoneDmg: 26, zones: 3, zoneR: 55, zoneWarn: 1.6, zoneEvery: 5, zoneNear: 120,
      phase2: 0.66, phase3: 0.33,
    },
  },
};
