/* ==========================================================================
   Ships.js — as três classes. Posições (x, y) dos slots são relativas ao centro da nave
   (y negativo = frente). angle: 0 = para cima, π/2 = direita, π = trás, -π/2 = esquerda.
   menuDir (graus, 0 = cima, 90 = direita, 180 = baixo): para onde o menu circular abre ao tocar no slot.
   Vanguarda: 4 slots (limite do GDD — NÃO criar um quinto). Tanque: 4 slots. Espectro: 3 slots.

   special — habilidade especial de cada nave (evolui no 4º ramo da árvore da nave):
     "dodge"      Espectro: esquiva por gesto rápido (único com esquiva)
     "overcharge" Vanguarda: a cada N disparos da arma do slot principal (specialSlot), sai um projétil especial (dano ×, atravessa quem destruir)
     "cancel"     Tanque: os disparos da nave cancelam os tiros inimigos que tocarem
   ========================================================================== */
const PI = Math.PI;

export const SHIPS = {
  vanguarda: {
    id: "vanguarda",
    name: "Vanguarda",
    tagline: "Ofensiva",
    description: "Dano alto e quatro slots frontais. Agilidade equilibrada.",
    specialName: "Disparo carregado",
    specialDesc: "A cada 10 disparos da arma do slot principal (nariz) sai um projétil com o dobro do dano, que atravessa os inimigos que destruir.",
    special: "overcharge",
    specialSlot: "nariz",           // o disparo carregado vale só para a arma deste slot (principal/frontal)
    sprite: "ship.vanguarda",
    hp: 100,
    speed: 620,
    damageMod: 1.25,
    hitRadius: 13,
    dodge: null,
    specialBase: { specialEvery: 10, specialMult: 2 },
    // Disposição PROVISÓRIA (GDD 5.1): nariz, casco e uma asa de cada lado, todos para a frente.
    slots: [
      { id: "nariz", label: "Nariz", x: 0, y: -32, angle: 0, menuDir: 0 },
      { id: "casco", label: "Casco", x: 0, y: 5, angle: 0, menuDir: 180 },
      { id: "asa_e", label: "Asa esq.", x: -36, y: 6, angle: 0, menuDir: -80 },
      { id: "asa_d", label: "Asa dir.", x: 36, y: 6, angle: 0, menuDir: 80 },
    ],
    engines: [{ x: -10, y: 30 }, { x: 10, y: 30 }],
  },

  tanque: {
    id: "tanque",
    name: "Tanque",
    tagline: "Resistência",
    description: "Muita vida, movimento lento e cobertura nas quatro direções.",
    specialName: "Tiros que cancelam",
    specialDesc: "Os disparos da nave destroem os tiros inimigos que atingirem.",
    special: "cancel",
    sprite: "ship.tanque",
    hp: 180,
    speed: 470,
    damageMod: 1.0,
    hitRadius: 23,
    dodge: null,
    specialBase: { cancelPierce: 0, redirect: 0 },
    slots: [
      { id: "frente", label: "Frente", x: 0, y: -48, angle: 0, menuDir: 0 },
      /*{ id: "tras", label: "Traseira", x: 0, y: 26, angle: PI, menuDir: 180 },*/
      { id: "esq", label: "Esquerda", x: -53, y: -6, angle: -PI / 2, menuDir: -90 },
      { id: "dir", label: "Direita", x: 53, y: -6, angle: PI / 2, menuDir: 90 },
    ],
    engines: [{ x: -15, y: 48 }, { x: 15, y: 48 }],
  },

  espectro: {
    id: "espectro",
    name: "Espectro",
    tagline: "Mobilidade",
    description: "Muito ágil e precisa, mas frágil. Três slots frontais.",
    specialName: "Esquiva",
    specialDesc: "Um movimento rápido do mouse ou do dedo faz a nave esquivar, com breve invulnerabilidade.",
    special: "dodge",
    sprite: "ship.espectro",
    hp: 70,
    speed: 780,
    damageMod: 1.0,
    hitRadius: 10,
    dodge: { cooldown: 0.9, duration: 0.19, speed: 1500, iframes: 0.19 },
    specialBase: {},
    slots: [
      { id: "centro", label: "Centro", x: 0, y: -30, angle: 0, menuDir: 0 },
      { id: "asa_e", label: "Asa esq.", x: -35, y: 7, angle: 0, menuDir: -80 },
      { id: "asa_d", label: "Asa dir.", x: 35, y: 7, angle: 0, menuDir: 80 },
    ],
    engines: [{ x: 0, y: 26 }],
  },
};

export const SHIP_ORDER = ["vanguarda", "tanque", "espectro"];
