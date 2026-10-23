/* ==========================================================================
   Upgrades.js — árvores de evolução (uma por arma + uma por nave) e o cálculo de atributos.

   Cada árvore tem 4 RAMOS, cada ramo com 3 NÍVEIS em sequência. Um nível só depende do nível
   anterior do PRÓPRIO ramo (nunca de outro ramo). O nível 1 é o ponto de entrada do ramo.
     Armas: Cadência · Dispersão · Potência · Especial
     Nave:  Casco · Motores · Blindagem · Especial (evolui a habilidade especial da classe)
   Nó: { id, name, desc, effects[{stat, op:"add"|"mul", value}], cost, requires[ids], branch, col, row }
   A lógica de bloqueio usa SOMENTE `requires`; col/row são só a referência visual.

   ECONOMIA (ritmo): ~1 compra a cada 2–3 ondas; níveis máximos só em estágios bem avançados.
   O custo de um nível = LEVEL_COST[nível] × fator do ramo × multiplicador da arma/nave.
   ========================================================================== */

const fx = (stat, op, value) => ({ stat, op, value });
const r5 = (n) => Math.max(5, Math.round(n / 5) * 5);

const WEAPON_LEVEL_COST = [130, 330, 750];
const SHIP_LEVEL_COST = [110, 280, 650];
const BRANCH_FACTOR = { cad: 1, dis: 0.9, pot: 1.1, esp: 1.2, hull: 1, eng: 0.9, arm: 1.1, spe: 1.2 };

// spec = [[nome, descrição, [efeitos]], ×3]
function branch(id, name, spec, levelCost, mult) {
  return {
    id, name,
    nodes: spec.map(([n, desc, effects], i) => ({
      id: `${id}${i}`, name: n, desc, effects,
      cost: r5(levelCost[i] * BRANCH_FACTOR[id] * mult),
      requires: i ? [`${id}${i - 1}`] : [],
    })),
  };
}

function buildTree(title, branches) {
  const all = [];
  const out = branches.map((b, ci) => ({
    id: b.id, name: b.name,
    nodes: b.nodes.map((n, ri) => { const node = { ...n, branch: b.id, col: ci, row: ri }; all.push(node); return node; }),
  }));
  const byId = Object.fromEntries(all.map((n) => [n.id, n]));
  for (const n of all) for (const r of n.requires) {
    if (!byId[r]) throw new Error(`Árvore "${title}": ${n.id} requer "${r}", que não existe`);
    if (byId[r].branch !== n.branch) throw new Error(`Árvore "${title}": ${n.id} só pode depender do próprio ramo`);
  }
  if (out.length !== 4 || out.some((b) => b.nodes.length !== 3)) throw new Error(`Árvore "${title}": precisa de 4 ramos × 3 níveis`);
  return { title, branches: out, byId, all };
}

/* ------------------------------ ramos padrão das armas ------------------------------ */
const CAD = (m) => branch("cad", "Cadência", [
  ["Ritmo", "−12% no intervalo entre disparos", [fx("interval", "mul", 0.88)]],
  ["Ritmo II", "−12% no intervalo entre disparos", [fx("interval", "mul", 0.88)]],
  ["Frenesi", "−20% no intervalo entre disparos", [fx("interval", "mul", 0.8)]],
], WEAPON_LEVEL_COST, m);

const POT = (m) => branch("pot", "Potência", [
  ["Calibre pesado", "+25% de dano", [fx("damage", "mul", 1.25)]],
  ["Impacto reforçado", "+30% de dano", [fx("damage", "mul", 1.3)]],
  ["Impacto devastador", "+50% de dano", [fx("damage", "mul", 1.5)]],
], WEAPON_LEVEL_COST, m);

// Dispersão: só o ÚLTIMO nível acrescenta 1 projétil (e cada arma só pode ter 1 a mais que o padrão).
const DIS_SINGLE = (m, extra = []) => branch("dis", "Dispersão", [
  ["Projétil largo", "+30% na largura do projétil", [fx("size", "mul", 1.3)]],
  ["Projétil maior", "+25% na largura do projétil" + (extra.length ? " e na explosão" : ""), [fx("size", "mul", 1.25), ...extra]],
  ["Disparo duplo", "+1 projétil", [fx("count", "add", 1), fx("spread", "add", 8)]],
], WEAPON_LEVEL_COST, m);

const DIS_SPREAD = (m) => branch("dis", "Dispersão", [
  ["Leque aberto", "+20% na abertura do leque", [fx("spread", "mul", 1.2)]],
  ["Leque largo", "+20% na abertura e na largura", [fx("spread", "mul", 1.2), fx("size", "mul", 1.2)]],
  ["Projétil extra", "+1 projétil", [fx("count", "add", 1)]],
], WEAPON_LEVEL_COST, m);

const DIS_AREA = (m) => branch("dis", "Dispersão", [
  ["Onda larga", "+15% no raio do pulso", [fx("blast", "mul", 1.15)]],
  ["Onda ampla", "+20% no raio do pulso", [fx("blast", "mul", 1.2)]],
  ["Maré de choque", "+25% no raio do pulso", [fx("blast", "mul", 1.25)]],
], WEAPON_LEVEL_COST, m);

const ESP = (m, spec) => branch("esp", "Especial", spec, WEAPON_LEVEL_COST, m);

export const WEAPON_TREES = {
  basic: buildTree("Canhão Básico", [CAD(1), DIS_SINGLE(1), POT(1), ESP(1, [
    ["Munição perfurante", "+1 de perfuração", [fx("pierce", "add", 1)]],
    ["Núcleo energético", "+30% de dano e +15% de velocidade", [fx("damage", "mul", 1.3), fx("speed", "mul", 1.15)]],
    ["Sobrecarga", "+1 de perfuração e +25% de dano", [fx("pierce", "add", 1), fx("damage", "mul", 1.25)]],
  ])]),

  spread: buildTree("Disparo Múltiplo", [CAD(1.15), DIS_SPREAD(1.15), POT(1.15), ESP(1.15, [
    ["Chumbo afiado", "+1 de perfuração", [fx("pierce", "add", 1)]],
    ["Choque de curta", "+30% de dano", [fx("damage", "mul", 1.3)]],
    ["Tempestade", "+30% de alcance e +20% de velocidade", [fx("life", "mul", 1.3), fx("speed", "mul", 1.2)]],
  ])]),

  laser: buildTree("Laser", [CAD(1.3), DIS_SINGLE(1.3), POT(1.3), ESP(1.3, [
    ["Feixe estendido", "+50% de alcance", [fx("life", "mul", 1.5)]],
    ["Feixe largo", "+1 de perfuração e +30% de largura", [fx("pierce", "add", 1), fx("size", "mul", 1.3)]],
    ["Lança de plasma", "+3 de perfuração e +30% de dano", [fx("pierce", "add", 3), fx("damage", "mul", 1.3)]],
  ])]),

  missile: buildTree("Míssil", [CAD(1.4), DIS_SINGLE(1.4, [fx("blast", "mul", 1.15)]), POT(1.4), ESP(1.4, [
    ["Sensor de calor", "O míssil passa a rastrear inimigos", [fx("homing", "add", 2.4)]],
    ["Sensor avançado", "Rastreio melhor e +15% de velocidade", [fx("homing", "add", 2.6), fx("speed", "mul", 1.15)]],
    ["Ogiva de fragmentação", "+50% de explosão e +25% de dano", [fx("blast", "mul", 1.5), fx("damage", "mul", 1.25)]],
  ])]),

  area: buildTree("Pulso de Área", [CAD(1.5), DIS_AREA(1.5), POT(1.5), ESP(1.5, [
    ["Onda amplificada", "+25% de dano", [fx("damage", "mul", 1.25)]],
    ["Onda carregada", "+20% de dano e −10% no intervalo", [fx("damage", "mul", 1.2), fx("interval", "mul", 0.9)]],
    ["Colapso", "+50% de dano e −15% no intervalo", [fx("damage", "mul", 1.5), fx("interval", "mul", 0.85)]],
  ])]),
};

/* ------------------------------ árvores das naves ------------------------------ */
const SB = (id, name, spec) => branch(id, name, spec, SHIP_LEVEL_COST, 1);

const COMMON = () => [
  SB("hull", "Casco", [
    ["Liga reforçada", "+20 de vida máxima", [fx("maxHp", "add", 20)]],
    ["Casco duplo", "+30 de vida máxima", [fx("maxHp", "add", 30)]],
    ["Núcleo blindado", "+45 de vida máxima", [fx("maxHp", "add", 45)]],
  ]),
  SB("eng", "Motores", [
    ["Turbinas", "+8% de velocidade", [fx("speed", "mul", 1.08)]],
    ["Turbinas II", "+8% de velocidade", [fx("speed", "mul", 1.08)]],
    ["Pós-combustor", "+10% de velocidade", [fx("speed", "mul", 1.1)]],
  ]),
  SB("arm", "Blindagem", [
    ["Escudo cinético", "−8% de dano recebido", [fx("dmgReduction", "add", 0.08)]],
    ["Escudo cinético II", "−8% de dano recebido", [fx("dmgReduction", "add", 0.08)]],
    ["Escudo cinético III", "−9% de dano recebido", [fx("dmgReduction", "add", 0.09)]],
  ]),
];

// Esquiva no nível máximo: inimigos comuns no caminho são destruídos (qualquer onda); os "pesados" (heavy: Couraçado,
// elites) levam apenas este dano fixo por esquiva.
export const DASH_HEAVY_DAMAGE = 40;

const SPECIAL = {
  dodge: () => SB("spe", "Esquiva", [
    ["Recarga rápida", "−20% na recuperação da esquiva", [fx("dodgeCooldown", "mul", 0.8)]],
    ["Impulso longo", "+20% na duração e +0,08 s de invulnerabilidade", [fx("dodgeDuration", "mul", 1.2), fx("dodgeIframes", "add", 0.08)]],
    ["Fantasma", "−20% na recuperação, +0,1 s de invulnerabilidade e a esquiva destrói inimigos no caminho (pesados só sofrem dano)", [fx("dodgeCooldown", "mul", 0.8), fx("dodgeIframes", "add", 0.1), fx("dodgeDamage", "add", DASH_HEAVY_DAMAGE)]],
  ]),
  overcharge: () => SB("spe", "Carga", [
    ["Gatilho rápido", "Disparo carregado a cada 8 disparos", [fx("specialEvery", "add", -2)]],
    ["Ogiva reforçada", "Dano do disparo carregado ×2,5", [fx("specialMult", "add", 0.5)]],
    ["Sobrecarga total", "A cada 6 disparos e dano ×3", [fx("specialEvery", "add", -2), fx("specialMult", "add", 0.5)]],
  ]),
  cancel: () => SB("spe", "Escudo", [
    ["Tiro persistente", "O disparo continua após cancelar 1 tiro inimigo", [fx("cancelPierce", "add", 1)]],
    ["Tiro perfurante", "O disparo continua após cancelar 2 tiros inimigos", [fx("cancelPierce", "add", 1)]],
    ["Tiro guiado", "Após cancelar um tiro, o disparo muda de direção e vai ao inimigo mais próximo", [fx("redirect", "add", 1)]],
  ]),
};

export const SHIP_TREES = {
  vanguarda: buildTree("Vanguarda", [...COMMON(), SPECIAL.overcharge()]),
  tanque: buildTree("Tanque", [...COMMON(), SPECIAL.cancel()]),
  espectro: buildTree("Espectro", [...COMMON(), SPECIAL.dodge()]),
};

/* limites dos atributos da nave (multiplicadores sobre o valor inicial da classe, ou valores absolutos) */
export const SHIP_LIMITS = {
  speedMaxMul: 1.6,
  dodgeCooldownMin: 0.45,
  dodgeDurationMaxMul: 1.8,
  dodgeIframesMax: 0.45,
  dodgeDamageMax: 999,
  dmgReductionMax: 0.5,
  specialEvery: [3, 99],
  specialMult: [1, 6],
  cancelPierce: [0, 6],
  redirect: [0, 1],
};

/* ------------------------------ cálculo de atributos ------------------------------ */
// valor final = (base + Σadd) × Πmul, depois limitado por `limits` ([mín, máx] por atributo).
export function applyEffects(base, effects, limits = {}) {
  const add = {}, mul = {};
  for (const e of effects) {
    if (e.op === "add") add[e.stat] = (add[e.stat] ?? 0) + e.value;
    else mul[e.stat] = (mul[e.stat] ?? 1) * e.value;
  }
  const out = { ...base };
  for (const k of Object.keys(base)) {
    let v = (base[k] + (add[k] ?? 0)) * (mul[k] ?? 1);
    const lim = limits[k];
    if (lim) v = Math.min(lim[1], Math.max(lim[0], v));
    out[k] = v;
  }
  for (const k of ["count", "pierce", "burst", "specialEvery", "cancelPierce", "redirect"]) if (k in out) out[k] = Math.round(out[k]);
  return out;
}

export function effectsOf(tree, ownedIds) {
  const list = [];
  for (const id of ownedIds) { const n = tree.byId[id]; if (n) list.push(...n.effects); }
  return list;
}

// Níveis já comprados de um ramo e o próximo nível disponível (null = ramo no máximo).
export function branchLevel(branch, owned) { return branch.nodes.filter((n) => owned.has(n.id)).length; }
export function nextNode(branch, owned) { return branch.nodes.find((n) => !owned.has(n.id)) ?? null; }
