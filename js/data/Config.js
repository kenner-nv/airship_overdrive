/* ==========================================================================
   Config.js — TODOS os números gerais de balanceamento ficam aqui.
   (Naves: Ships.js · Armas: Weapons.js · Árvores: Upgrades.js · Inimigos: Enemies.js)
   ========================================================================== */
export const GAME_ID = "starship-overdrive";      // = slug. Prefixo de TODA chave do localStorage.
export const GAME_TITLE = "Starship Overdrive";

export const CONFIG = {
  world: {
    width: 540,            // largura lógica MÁXIMA da arena (a altura varia conforme a tela)
    minWidth: 380,         // largura lógica mínima
    minScale: 0.95,        // escala mínima desejada (px de tela por unidade lógica): em telas estreitas (celular)
                           // a arena fica mais estreita, então nave e inimigos aparecem MAIORES. 0 = sempre 540.
  },

  loop: {
    maxFrameDt: 0.05,      // um quadro nunca simula mais que isso (evita salto ao voltar de outra aba)
    maxStep: 1 / 60,       // passo máximo de simulação (sub-passos para colisões estáveis)
    deathAnim: 1.25,       // duração da animação de destruição antes do Game Over (s)
  },

  input: {
    tapMaxMs: 320,         // toque mais longo que isso não abre o menu
    dragThresholdPx: 12,   // deslocamento (px de tela) a partir do qual o toque vira arraste
    touchOffsetY: 91,      // nave desenhada acima do dedo (px lógicos)
    dodge: {               // MOUSE
      windowMs: 110,       // janela em que se mede a velocidade do gesto
      minDistance: 150,    // deslocamento mínimo (px lógicos) dentro da janela
      minSpeed: 2300,      // velocidade mínima do gesto (px lógicos / s)
    },
    dodgeTouch: {          // TOQUE (celular): um deslize curto e rápido já basta
      windowMs: 130,
      minDistance: 60,
      minSpeed: 1000,
    },
  },

  ship: {
    followGain: 16,        // quão "colada" a nave fica no ponteiro (suavização)
    sideMargin: 22,
    bottomMargin: 40,
    minYFraction: 0.15,    // a nave não sobe além dessa fração da altura
    spawnYFraction: 0.82,
    leanTilt: 0.07,        // inclinação máxima das asas (perspectiva); 0 = sem efeito
    leanSqueeze: 0.04,     // achatamento máximo da largura ao inclinar
    hitWidthMul: 2.5,      // área de acerto dos tiros inimigos: largura = hitRadius × este valor (cobre as asas); altura = hitRadius
    hitIframes: 0.9,       // invulnerabilidade curta após levar dano (s)
    regenDelay: 10,        // segundos sem levar dano até a nave começar a regenerar (a taxa de cada nave fica em Ships.js: regenPct)
    dodgeMaxScreen: 0.625,   // distância MÁXIMA da esquiva (Espectro): fração da largura/altura da tela, na direção da esquiva
    dodgeMinDistance: 30,  // distância mínima (px lógicos) de uma esquiva
  },

  // Ícone da arma sobre a nave na partida: usa a imagem "icon.<arma>" (Art.js ou Assets.js). Ajuste aqui.
  //   size: lado em px lógicos · rotationDeg: giro extra em graus (somado à direção do slot se followSlotAngle)
  //   perWeapon: { missile: { size: 22 } } · perSlot: { "tanque.esq": { rotationDeg: 90 } }  (id da nave + "." + id do slot)
  slotIcon: {
    size: 35,
    rotationDeg: 0,
    followSlotAngle: true,
    perWeapon: {},
    perSlot: {
      "vanguarda.nariz": {size: 25},
      "vanguarda.casco": {size: 30},
      "espectro.centro": {size: 25},
      "espectro.asa_e": {size: 30},
      "espectro.asa_d": {size: 30},
    },
    supportSize: 17,       // tamanho do ícone do módulo de suporte (slot traseiro) sobre a nave
  },

  economy: {
    supportCostMul: 1.5,   // módulo de suporte custa isto × o custo médio de uma arma (Weapons.js)
    startCoins: 180,       // dinheiro inicial: dá para escolher UMA entre canhão básico (110), disparo múltiplo (140) ou laser (180)
    slotCostGrowth: 1.6,   // custo da arma × 1.6 por arma JÁ instalada (de qualquer tipo): a 2ª arma custa 1,6×, a 3ª 2,56×…
    waveCoinBonusBase: 6,  // bônus de moedas ao concluir uma onda = base + perWave × onda
    waveCoinBonusPerWave: 2,
    coinWaveScale: 0.04,   // recompensa de moedas de cada inimigo × (1 + 0.04 × (onda-1))
  },

  score: {
    killWaveBonus: 0.05,   // cada onda acrescenta 5% à pontuação de uma eliminação
    waveClearBase: 50,     // pontos ao concluir a onda = base × número da onda
  },

  waves: {
    startDelay: 1.3,
    intermission: 2.4,      // a próxima onda só começa depois que TODOS os inimigos da atual morrerem ou saírem da tela
    budgetBase: 8,         // "orçamento de ameaça" da onda = base + perWave × (onda-1)^exp
    budgetPerWave: 3.4,
    budgetExp: 1.0,
    maxSpawnsPerWave: 60,
    spawnIntervalBase: 0.85,
    spawnIntervalMin: 0.2,
    spawnIntervalDecay: 0.965,
    hpPerWave: 0.0675,     // vida dos inimigos × (1 + 0.0675 × (onda-1)); depois da onda softCap cresce pela metade
    hpSoftCapWave: 25,
    shotSpeedPerWave: 0.012, shotSpeedMax: 1.45,
    fireRatePerWave: 0.02,  fireRateMin: 0.55,   // multiplicador do intervalo de tiro
    damagePerWave: 0.02625, damageMax: 2.8,   // dano dos inimigos × (1 + 0.02625 × (onda-1)), até damageMax
    // Elites: onda → tipo (Enemies.js). Fora desta tabela não há elite.
    eliteSchedule: { 5: "elite", 10: "elite", 15: "elite2", 20: "elite2", 30: "colossus", 40: "singularity", 50: "hegemon" },
    // Regras de aparição (WaveSystem): evitam inimigos novos "chegando junto" com muitos outros e a tela poluída.
    rules: {
      capsFromWave: 20,     // a partir desta onda valem os limites de quantidade abaixo
      maxAlive: 18,         // inimigos vivos ao mesmo tempo
      maxHeavy: 3,          // inimigos com ameaça ≥ 4 vivos ao mesmo tempo
      heavyThreat: 4,
      maxRanged: 3,         // inimigos "de longe" (franco-atirador, interferidor, feixes…) ao mesmo tempo
      groupCap: { beam: 2, snipe: 2 },   // limite por grupo (Enemies.js → group)
      bossMaxAlive: 7,      // com um elite na tela, no máximo isto de inimigos vivos (contando o elite)
      introMinKnown: 2,     // inimigo novo só entra com pelo menos N inimigos já conhecidos na tela…
      introDelay: 2,        // …e depois de N segundos de onda
      introMaxAlive: 8,     // na onda de estreia, no máximo isto de inimigos vivos
      stallSecs: 6,         // spawner "travado" por tanto tempo com a tela quase vazia: libera o próximo
      escortFromWave: 20,   // a partir desta onda: estreias e atiradores só entram atrás de um tanque ou de um grupo de drones/ceifadores
      escortGroup: 3,       // quantos drones/ceifadores vivos formam um "grupo" de escolta
    },
  },

  limits: {
    maxPlayerShots: 420,
    maxEnemyShots: 260,
    maxParticles: 200,
    maxTexts: 24,
    maxEnemiesAlive: 26,
  },

  // Coletáveis que os inimigos derrubam (o jogador passa por cima para pegar)
  pickups: {
    starLife: 10.8,          // segundos até a estrela sumir
    starFall: 70,          // velocidade de queda (px/s)
    heartLife: 11,
    heartFall: 55,
    radius: 22,            // raio de coleta somado ao raio da nave
    eliteStars: 5,         // o Comandante derruba várias estrelas (o valor total é dividido)
  },

  // Vida: a cada 2 ou 3 ondas, um inimigo aleatório (marcado com uma cruz verde) derruba um item de cura.
  heal: { everyMin: 2, everyMax: 3, percent: 0.3 },

  records: { maxStored: 50, showTop: 10 },

  audio: { defaultVolume: 0.6 },
};
