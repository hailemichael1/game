/**
 * main.js — Screen manager & game orchestrator
 */

const GameManager = (() => {
  let currentGame = null;
  let activeModule = null;
  let bestScores = JSON.parse(localStorage.getItem('arcadeBest') || '{}');

  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
  }

  function showMenu() {
    Audio.init();
    Audio.startMusic('menu');
    showScreen('screen-menu');
    document.getElementById('td-panel').style.display = 'none';
  }

  function selectGame(type) {
    Audio.init(); // ensure AudioContext is created on this gesture
    Audio.sfx.menuClick();
    currentGame = type;
    startGame();
  }

  function startGame() {
    if (activeModule && activeModule.destroy) activeModule.destroy();
    activeModule = null;

    const titles = { shooter: '🚀 Space Shooter', tower: '🏰 Tower Defense', runner: '🏃 Endless Runner' };
    document.getElementById('hud-title').textContent = titles[currentGame] || '';
    document.getElementById('hud-score').textContent = 'Score: 0';

    // TD panel
    document.getElementById('td-panel').style.display = currentGame === 'tower' ? 'flex' : 'none';

    // Mobile controls
    const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    const mobControls = document.getElementById('mobile-controls');
    const mobJump  = document.getElementById('mob-jump');
    const mobShoot = document.getElementById('mob-shoot');
    mobJump.classList.remove('show');
    mobShoot.classList.remove('show');
    if (isTouch) {
      mobControls.classList.add('visible');
      if (currentGame === 'runner')  mobJump.classList.add('show');
      if (currentGame === 'shooter') mobShoot.classList.add('show');
    } else {
      mobControls.classList.remove('visible');
    }

    showScreen('screen-game');

    // Reset canvas styles so offsetWidth/Height are correct
    const canvas = document.getElementById('gameCanvas');
    canvas.style.width  = '';
    canvas.style.height = '';
    canvas.removeAttribute('width');
    canvas.removeAttribute('height');

    // Two rAF frames to let layout fully settle before reading dimensions
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

  function showEnd(score) {
    const prev = bestScores[currentGame] || 0;
    const isNew = score > prev;
    if (isNew) {
      bestScores[currentGame] = score;
      localStorage.setItem('arcadeBest', JSON.stringify(bestScores));
    }
    const icons  = { shooter:'💥', tower:'🏰', runner:'💀' };
    const titles = { shooter:'Mission Failed', tower:'Base Destroyed', runner:'Game Over' };
    document.getElementById('end-icon').textContent  = icons[currentGame]  || '💀';
    document.getElementById('end-title').textContent = titles[currentGame] || 'Game Over';
    document.getElementById('end-score').textContent = `Score: ${score.toLocaleString()}`;
    document.getElementById('end-best').textContent  = isNew
      ? '🏆 New Best Score!'
      : `Best: ${(bestScores[currentGame] || 0).toLocaleString()}`;
    showScreen('screen-end');
    Audio.startMusic('menu');
  }

  function replayGame() {
    Audio.init();
    Audio.sfx.menuClick();
    startGame();
  }

  function goToMenu() {
    Audio.init();
    Audio.sfx.menuClick();
    if (activeModule && activeModule.destroy) { activeModule.destroy(); activeModule = null; }
    document.getElementById('td-panel').style.display = 'none';
    document.getElementById('mobile-controls').classList.remove('visible');
    showMenu();
  }

  function init() { showMenu(); }

  return { selectGame, showEnd, replayGame, goToMenu, init };
})();

// ── Globals called from HTML ───────────────────────────────────
function selectGame(type) { GameManager.selectGame(type); }
function replayGame()      { GameManager.replayGame(); }
function goToMenu()        { GameManager.goToMenu(); }

// ── Mobile JUMP button — injects directly into Input state ────
// We expose a setter on Input so the button can trigger a jump
// without relying on synthetic KeyboardEvents (broken on iOS).
(function patchInputForMobile() {
  // Patch: expose a triggerJump method
  const origFlush = Input.flush;
  let _pendingJump = false;
  Object.defineProperty(Input, 'touchJump', {
    get() { return _pendingJump; },
    configurable: true,
  });
  Input.flush = function() {
    origFlush.call(Input);
    _pendingJump = false;
  };
  window._triggerMobileJump = function() { _pendingJump = true; };
})();

// ── Boot ──────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => GameManager.init());
