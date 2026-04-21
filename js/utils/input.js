/**
 * input.js — Unified keyboard / mouse / touch input handler
 */

const Input = (() => {
  const keys = {};       // currently held keys
  const justPressed = {}; // keys pressed this frame
  let mouseX = 0, mouseY = 0;
  let mouseClicked = false;
  let mouseClickX = 0, mouseClickY = 0;
  let touchJump = false; // single-tap flag for runner

  // ── Keyboard ─────────────────────────────────────────────────
  window.addEventListener('keydown', e => {
    if (!keys[e.code]) justPressed[e.code] = true;
    keys[e.code] = true;
    // Prevent page scroll on arrow/space
    if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) {
      e.preventDefault();
    }
  });
  window.addEventListener('keyup', e => { keys[e.code] = false; });

  // ── Mouse ─────────────────────────────────────────────────────
  const canvas = () => document.getElementById('gameCanvas');
  window.addEventListener('mousemove', e => {
    const c = canvas();
    if (!c) return;
    const r = c.getBoundingClientRect();
    mouseX = e.clientX - r.left;
    mouseY = e.clientY - r.top;
  });
  window.addEventListener('click', e => {
    const c = canvas();
    if (!c) return;
    const r = c.getBoundingClientRect();
    mouseClicked = true;
    mouseClickX = e.clientX - r.left;
    mouseClickY = e.clientY - r.top;
  });

  // ── Touch ─────────────────────────────────────────────────────
  window.addEventListener('touchstart', e => {
    const c = canvas();
    if (!c) return;
    const r = c.getBoundingClientRect();
    const t = e.touches[0];
    mouseX = t.clientX - r.left;
    mouseY = t.clientY - r.top;
    mouseClicked = true;
    mouseClickX = mouseX;
    mouseClickY = mouseY;
    touchJump = true;
    e.preventDefault();
  }, { passive: false });

  window.addEventListener('touchmove', e => {
    const c = canvas();
    if (!c) return;
    const r = c.getBoundingClientRect();
    const t = e.touches[0];
    mouseX = t.clientX - r.left;
    mouseY = t.clientY - r.top;
    e.preventDefault();
  }, { passive: false });

  // ── Frame reset (call at end of each frame) ───────────────────
  function flush() {
    for (const k in justPressed) delete justPressed[k];
    mouseClicked = false;
    touchJump = false;
  }

  return {
    isDown: code => !!keys[code],
    wasPressed: code => !!justPressed[code],
    get mouseX() { return mouseX; },
    get mouseY() { return mouseY; },
    get clicked() { return mouseClicked; },
    get clickX() { return mouseClickX; },
    get clickY() { return mouseClickY; },
    get touchJump() { return touchJump; },
    flush,
  };
})();
