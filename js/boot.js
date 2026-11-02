/* boot.js — carrega os módulos com progresso REAL e então inicia o jogo.
   A tela de carregamento já está no index.html (não depende deste script para aparecer). */
const fill = document.getElementById("loading-fill");
const text = document.getElementById("loading-text");
const setProgress = (p) => { fill.style.width = `${Math.round(Math.min(1, p) * 100)}%`; };

// folhas primeiro, para o progresso avançar de forma contínua
const MODULES = [
  "./data/Config.js", "./data/Ships.js", "./data/Weapons.js", "./data/Upgrades.js", "./data/Enemies.js", "./data/Assets.js",
  "./Pool.js", "./LocalSave.js", "./Audio.js", "./Art.js", "./Vfx.js", "./Ship.js", "./Input.js",
  "./WeaponSystem.js", "./PickupSystem.js", "./EnemySystem.js", "./WaveSystem.js", "./CollisionSystem.js", "./UpgradeSystem.js",
  "./Renderer.js", "./BuildMenu.js", "./Ui.js", "./Platform.js", "./Game.js",
];

async function boot() {
  try {
    const total = MODULES.length + 2;
    let done = 0;
    for (const m of MODULES) { await import(m); setProgress(++done / total); }
    const { Game } = await import("./Game.js");
    const game = new Game({ stage: document.getElementById("stage"), canvas: document.getElementById("game") });
    await game.load((p) => setProgress((MODULES.length + p) / total));
    setProgress(1);
    text.textContent = "Pronto!";
    await new Promise((r) => setTimeout(r, 250));
    game.setState("MAIN");
    if (new URLSearchParams(location.search).has("debug")) window.__game = game;   // só para testes (?debug)
  } catch (err) {
    console.error(err);
    document.getElementById("loading-progress").hidden = true;
    document.getElementById("loading-error").hidden = false;
  }
}
boot();
