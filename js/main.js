/**
 * main.js — Screen manager & game orchestrator
 *
 * Manages transitions between: Menu → Game → End → Menu
 * Handles game selection, HUD setup, and best score tracking.
 */

const GameManager = (() => {
  // ── State ─────────────────────────────────────────────────────
  let currentGame = null;   // 'shooter' | 'tower' | 'runner'
  let activeModule = null;  // reference to the active game module
  let bestScores = JSON.parse(localStorage.getItem('arcadeBest') || '{}');

  // ── Screen helpers ────────────────────────────────────────────
  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
  }

  // ── Menu ──────────────────────────────────────────────────────
  function showMenu() {
    Audio.init();
    Audio.startMusic('menu');
    showScreen('screen-menu');
    document.getElementById('td-panel').style.display = 'none';
  }

  // ── Game selection ────────────────────────────────────────────
  function selectGame(type) {
    Audio.sfx.menuClick();
    currentGame = type;
    startGame();
  }

  function startGame() {
    // Destroy previous game if any
    if (activeModule && activeModule.destroy) activeModule.destroy();
    activeModule = null;

    // Setup HUD
    const titles = { shooter: '🚀 Space Shooter', tower: '🏰 Tower Defense', runner: '🏃 Endless Runner' };
    document.getElementById('hud-title').textContent = titles[currentGame] || '';
    document.getElementById('hud-score').textContent = 'Score: 0';

    // Show/hide TD panel
    const tdPanel = document.getElementById('td-panel');
    tdPanel.style.display = currentGame === 'tower' ? 'flex' : 'none';

    showScreen('screen-game');

    // Size canvas
    const canvas = document.getElementById('gameCanvas');
    canvas.style.width  = '';
    canvas.style.height = '';

    // Small delay to let layout settle before init
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        Audio.stopMusic();
        if (currentGame === 'shooter') {
          activeModule = SpaceShooter;
          SpaceShooter.init(canvas);
        } else if (currentGame === 'tower') {
          activeModule = TowerDefense;
          TowerDefense.init(canvas);
        } else if (currentGame === 'runner') {
          activeModule = EndlessRunner;
          EndlessRunner.init(canvas);
        }
      });
    });
  }

  // ── End screen ────────────────────────────────────────────────
  function showEnd(score) {
    // Update best score
    const prev = bestScores[currentGame] || 0;
    const isNew = score > prev;
    if (isNew) {
      bestScores[currentGame] = score;
      localStorage.setItem('arcadeBest', JSON.stringify(bestScores));
    }

    const icons = { shooter: '💥', tower: '🏰', runner: '💀' };
    const titles = { shooter: 'Mission Failed', tower: 'Base Destroyed', runner: 'Game Over' };

    document.getElementById('end-icon').textContent  = icons[currentGame] || '💀';
    document.getElementById('end-title').textContent = titles[currentGame] || 'Game Over';
    document.getElementById('end-score').textContent = `Score: ${score.toLocaleString()}`;
    document.getElementById('end-best').textContent  = isNew
      ? '🏆 New Best Score!'
      : `Best: ${(bestScores[currentGame] || 0).toLocaleString()}`;

    showScreen('screen-end');
    Audio.startMusic('menu');
  }

  // ── Replay ────────────────────────────────────────────────────
  function replayGame() {
    Audio.sfx.menuClick();
    startGame();
  }

  // ── Back to menu ──────────────────────────────────────────────
  function goToMenu() {
    Audio.sfx.menuClick();
    if (activeModule && activeModule.destroy) {
      activeModule.destroy();
      activeModule = null;
    }
    document.getElementById('td-panel').style.display = 'none';
    showMenu();
  }

  // ── Init ──────────────────────────────────────────────────────
  function init() {
    showMenu();
  }

  return { selectGame, showEnd, replayGame, goToMenu, init };
})();

// ── Global functions called from HTML ─────────────────────────
function selectGame(type) { GameManager.selectGame(type); }
function replayGame()      { GameManager.replayGame(); }
function goToMenu()        { GameManager.goToMenu(); }

// ── Boot ──────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => GameManager.init());
