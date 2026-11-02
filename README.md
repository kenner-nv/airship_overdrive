# Starship Overdrive — v0.1.0 (primeira versão, elementos provisórios)

Pasta do jogo para `jogos/starship-overdrive/` do repositório K101. `game.json` está com `status: "draft"`
(não aparece no catálogo até você mudar para `published` e rodar `node tools/make-catalog.mjs`).

## Onde ajustar cada coisa
| O quê | Arquivo |
|---|---|
| Números gerais (ondas, economia, pontuação, entrada, limites) | `js/data/Config.js` |
| Naves: vida, velocidade, esquiva, posição/ângulo dos slots | `js/data/Ships.js` |
| Armas e atributos base | `js/data/Weapons.js` |
| Árvores de evolução (nós, custos, pré-requisitos) | `js/data/Upgrades.js` |
| Inimigos e padrões de tiro | `js/data/Enemies.js` |
| **Trocar arte/som provisórios pelos definitivos** | `js/data/Assets.js` (lista de chaves no topo do arquivo) |

## Provisório (a trocar na versão final)
- Toda a arte é desenhada em código (`js/Art.js`); todos os sons são sintetizados (`js/Audio.js`).
  Basta apontar a chave em `Assets.js` para um arquivo em `assets/img` ou `assets/audio`.
- `cover.webp`, `icon.webp` e `prints/` foram gerados a partir do próprio jogo.
- Valores de balanceamento são um primeiro chute, a calibrar jogando.

## Teste local
Sirva a RAIZ do site (precisa de `/shared/k101.js` e `/shared/tema.css`), ex.: `npx serve .`
e abra `/jogos/starship-overdrive/`. Com `?debug` na URL, `window.__game` fica disponível (só para testes).

## v0.2.0 — mudanças
- Dinheiro = estrelas (★). Inimigos derrubam estrelas; a nave coleta passando por cima (`js/PickupSystem.js`, `Config.pickups`).
- Itens de vida: a cada 2–3 ondas um inimigo aleatório carrega um (`Config.heal`).
- Árvores: 4 ramos × 3 níveis para armas e naves, cada nível depende só do anterior do mesmo ramo (`js/data/Upgrades.js`). Dispersão dá no máximo +1 projétil, só no último nível.
- Custos: `WEAPON_LEVEL_COST`/`SHIP_LEVEL_COST` em Upgrades.js, `cost` em Weapons.js e `economy` em Config.js. Meta: 1 compra a cada 2–3 ondas.
- Habilidades especiais: Espectro = esquiva; Vanguarda = disparo carregado a cada N tiros de cada arma; Tanque = tiros cancelam tiros inimigos (ramo "Especial" da nave evolui cada uma).
- Menu de construção circular (`js/BuildMenu.js`); direção do leque por slot em `Ships.js` (`menuDir`).
- Laterais de telas largas: fundo borrado (`<canvas id="side">`), só visual.
- Correção do "ghost" dos inimigos grandes (EnemySystem).

## v0.3.0 — mudanças
- Menu de construção volta ao estilo de lista, mantendo os níveis por ramo (compra do próximo nível libera o seguinte).
- Ícone da arma acoplado ao slot durante o jogo (girado conforme o slot; ex.: asas do Tanque).
- Seleção de nave sem frases de descrição.
- Distância toque→nave no celular +20% (`Config.input.touchOffsetY` = 91).
- Identidade visual própria em azul: o CSS do jogo não usa mais as cores do tema do site (aliases `--g-*` no topo de `css/style.css`).

## v0.4.0 — mudanças
- A partida começa sem arma, com ★180 (`Config.economy.startCoins`): dá para escolher canhão básico, disparo múltiplo ou laser. Um balão aponta para a nave e a 1ª onda só começa após a primeira arma.
- Inclinação visual da nave ao se mover (`Ship.lean`, `Renderer.drawShip`).
- Remover arma: botão no menu do slot (confirmação em 2 toques); sem reembolso.
- Vanguarda: disparo carregado só na arma do slot principal (`specialSlot: "nariz"` em Ships.js).
- Seleção de nave em carrossel (uma por vez; setas, deslizar ou teclado) + botão ESCOLHER.
- Novos inimigos (data/Enemies.js): Lançador (míssil teleguiado, onda 11+), Atirador de Feixe (laser em linha, onda 16+), Soberano (elite com espiral + 2 lasers, onda 21+; alterna com o Comandante nas ondas de elite 25, 35…).
- Sons dos tiros inimigos (enemy_*, beam_*) e trilhas sintetizadas "menu" e "game" (Audio.js `SONGS`); troque por arquivos em `MUSIC_OVERRIDES` (data/Assets.js).

## v0.5.0 — mudanças
- `Ships.js` do usuário passa a ser a base (Tanque com 3 slots; slots reposicionados).
- Ícone da arma sobre a nave = o mesmo `icon.<arma>` do Art/Assets. Ajuste tamanho/rotação em `Config.slotIcon` (global, por arma ou por slot).
- Menu de construção: grade de cards em 2 colunas (armas e ramos); botão de melhoria mostra só o custo; "Remover arma" em vermelho.
- Inclinação da nave em perspectiva (achata e desnivela as asas), sem girar o sprite.
- Item de vida agora é um escudo verde.
- Área de acerto dos tiros inimigos elíptica e mais larga (`Config.ship.hitWidthMul`).

## v0.5.2
- Celular: a arena fica mais estreita (largura lógica = largura da tela ÷ `CONFIG.world.minScale`, entre `minWidth` 380 e `width` 540), então nave e inimigos aparecem ~30% maiores. Desktop continua em 540. O deslocamento do toque (`touchOffsetY`) é escalado para manter a mesma distância na tela.
