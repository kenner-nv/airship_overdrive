/* ==========================================================================
   Assets.js — PONTO ÚNICO para trocar os elementos provisórios pelos definitivos.

   Toda arte e todo som do jogo é pedido por um NOME (chave). Enquanto a chave não estiver
   aqui, o jogo usa o elemento provisório (desenhado em código / sintetizado). Para substituir:
   coloque o arquivo em assets/img/ ou assets/audio/ e escreva o caminho abaixo.
   Caminhos são relativos à pasta do jogo (não comece com "/").

   IMAGENS (WebP/PNG com fundo transparente). A imagem é desenhada no tamanho lógico da chave
   (veja ART em Art.js) — naves apontam para CIMA, inimigos para BAIXO, projéteis para CIMA.
   Chaves: ship.vanguarda · ship.tanque · ship.espectro
           enemy.basic · enemy.fast · enemy.shooter · enemy.tough · enemy.weaver · enemy.elite · enemy.launcher · enemy.beamer · enemy.elite2
           shot.basic · shot.laser · shot.missile · shot.spread · shot.enemy · shot.emissile
           icon.basic · icon.laser · icon.missile · icon.spread · icon.area

   SONS (.ogg/.mp3/.wav). Chaves: shoot_basic · shoot_laser · shoot_missile · shoot_spread · shoot_pulse
           hit · explode · explode_big · hurt · dodge · install · buy · deny · wave · gameover · click
           enemy_shoot · enemy_ring · enemy_missile · enemy_spiral · beam_warn · beam_fire
   ========================================================================== */
export const IMAGE_OVERRIDES = {
   "ship.vanguarda": "assets/img/ship-vanguarda.svg",
   "ship.tanque": "assets/img/ship-tanque.svg",
   "ship.espectro": "assets/img/ship-espectro.svg",
   "icon.basic": "assets/img/icon-basic.svg",
   "icon.laser": "assets/img/icon-laser.svg",
   "icon.missile": "assets/img/icon-missile.svg",
   "icon.spread": "assets/img/icon-spread.svg",
   "icon.area": "assets/img/icon-area.svg",
   "enemy.basic": "assets/img/enemy-basic.svg",
   "enemy.area": "assets/img/enemy-area.svg",
   "enemy.fast": "assets/img/enemy-fast.svg",
   "enemy.shooter": "assets/img/enemy-shooter.svg",
   "enemy.tough": "assets/img/enemy-tough.svg",
   "enemy.weaver": "assets/img/enemy-weaver.svg",
   "enemy.elite": "assets/img/enemy-elite.svg",
   "enemy.launcher": "assets/img/enemy-launcher.svg",
   "enemy.beamer": "assets/img/enemy-beamer.svg",
   "enemy.elite2": "assets/img/enemy-elite2.svg",
};

// TRILHAS (loop contínuo): "menu" e "game". Sem arquivo, o jogo toca a trilha sintetizada provisória.
export const MUSIC_OVERRIDES = {
  // "menu": "assets/audio/musica-menu.ogg",
  // "game": "assets/audio/musica-partida.ogg",
};

export const SOUND_OVERRIDES = {
  // "shoot_basic": "assets/audio/shoot-basic.ogg",
};
