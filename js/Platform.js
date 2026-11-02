/* ==========================================================================
   Platform.js — integração com a plataforma K101 (SDK em /shared/k101.js, OPCIONAL).
   Contrato (Documento Técnico, seções 7.4 e 8): o jogo ouve eventos no window com prefixo "k101:".
   Se o SDK não carregar, nada aqui quebra: tudo usa window.K101?.…
   ========================================================================== */
import { Sound } from "./Audio.js";

export function installPlatform(game) {
  const on = (name, fn) => window.addEventListener(`k101:${name}`, fn);

  // Anúncio e popup de saída pedem silêncio ao mesmo tempo: guardamos as ORIGENS, e o áudio só
  // volta quando ninguém mais pede silêncio. (Não altera a preferência salva do jogador.)
  const muteSources = new Set();
  const mute = (src, active) => {
    if (active) muteSources.add(src); else muteSources.delete(src);
    Sound.setExternalMute(muteSources.size > 0);
  };

  on("ad:start", () => { game.pauseExternal(); mute("ad", true); });        // (obrigatório) pausa e silencia
  on("ad:end", () => mute("ad", false));                                   // segue pausado até o jogador voltar
  on("exit:open", () => { game.pauseExternal(); mute("exit", true); });     // (obrigatório) popup "Deseja sair?"
  on("exit:cancel", () => mute("exit", false));                            // segue pausado até o jogador voltar
  // on("exit:confirm", …): nada a salvar — o recorde é gravado no instante do Game Over (código síncrono).
  on("fullscreen:change", () => game.resize());
  // "menu:open"/"menu:close": o menu flutuante NÃO pausa o jogo (decisão igual à do Defesa do Castelo).
}

// true enquanto algo da plataforma está na frente do jogo (reforço no loop principal).
export const platformBlocked = () => !!window.K101?.blocked;
