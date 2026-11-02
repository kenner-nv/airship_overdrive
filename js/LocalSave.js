/* ==========================================================================
   LocalSave.js — recordes e preferências no localStorage (ranking SOMENTE local).
   Regra K101: toda chave começa com o slug do jogo. Tudo em try/catch: sem storage o jogo roda igual.
   ========================================================================== */
import { GAME_ID, CONFIG } from "./data/Config.js";

const K_RECORDS = `${GAME_ID}:records`;
const K_AUDIO = `${GAME_ID}:audio`;

function read(key) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
}

const num = (v, d = 0) => (Number.isFinite(v) ? v : d);

function sanitizeRecord(r) {
  if (!r || typeof r !== "object") return null;
  const score = Math.floor(num(r.score, NaN));
  if (!Number.isFinite(score) || score < 0) return null;
  return {
    score,
    time: Math.max(0, num(r.time)),
    wave: Math.max(1, Math.floor(num(r.wave, 1))),
    ship: typeof r.ship === "string" ? r.ship : "?",
    date: typeof r.date === "string" ? r.date : null,
  };
}

export const LocalSave = {
  getRecords() {
    const raw = read(K_RECORDS);
    if (!Array.isArray(raw)) return [];
    return raw.map(sanitizeRecord).filter(Boolean).sort((a, b) => b.score - a.score).slice(0, CONFIG.records.maxStored);
  },

  // Registra a tentativa. Devolve { rank (1 = melhor), isBest, saved }. O saldo de moedas NÃO entra no registro.
  addRecord({ score, time, wave, ship }) {
    const rec = sanitizeRecord({ score, time, wave, ship, date: new Date().toISOString() });
    if (!rec) return { rank: null, isBest: false, saved: false };
    const list = this.getRecords();
    const bestBefore = list.length ? list[0].score : -1;
    list.push(rec);
    list.sort((a, b) => b.score - a.score);   // sort estável: empate fica atrás do mais antigo
    const rank = list.indexOf(rec) + 1;
    const saved = write(K_RECORDS, list.slice(0, CONFIG.records.maxStored));
    return { rank, isBest: rec.score > bestBefore && rec.score > 0, saved };
  },

  getAudio() {
    const a = read(K_AUDIO);
    const vol = a && Number.isFinite(a.volume) ? Math.min(1, Math.max(0, a.volume)) : CONFIG.audio.defaultVolume;
    return { volume: vol, muted: !!(a && a.muted) };
  },
  setAudio(a) { write(K_AUDIO, { volume: a.volume, muted: !!a.muted }); },
};
