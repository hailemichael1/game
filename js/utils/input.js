/**
 * input.js — Unified keyboard / mouse / touch input handler
 */

const Input = (() => {
  const keys = {};
  const justPressed = {};
  let mouseX = 0, mouseY = 0;
  let mouseClicked = false;
  let mouseClickX = 0, mouseClickY = 0;
  let _touchJump = false;

  // ── Keyboard ──────────────────────────────────────────────────
  window.addEventListener('keydown', e => {
    if (!keys[e.code]) justPressed[e.code] = true;
    keys[e.code] = true;
    if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) {
      e.preventDefault();
    }
  });
  window.addEventListener('keyup', e => { keys[e.code] = false; });

  // ── Helpers ───────────────────────────────────────────────────
  function getCanvas() { return document.getElementById('gameCanvas'); }

  function canvasCoords(clientX, clientY) {
    const c = getCanvas();
    if (!c) return { x: 0, y: 0 };
    const r = c.getBoundingClientRect();
    return { x: clientX - r.left, y: clientY - r.top };
  }

  // ── Mouse ─────────────────────────────────────────────────────
  window.addEventListener('mousemove', e => {
    const p = canvasCoords(e.clientX, e.clientY);
    mouseX = p.x; mouseY = p.y;
  });

  window.addEventListener('click', e => {
    // Only register clicks that land on the canvas
    const c = getCanvas();
    if (!c) return;
    const r = c.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right ||
        e.clientY < r.top  || e.clientY > r.bottom) return;
    mouseClicked = true;
    mouseClickX = e.clientX - r.left;
    mouseClickY = e.clientY - r.top;
  });

  // ── Touch — attach to canvas only to avoid menu interference ──
  // We attach lazily when the canvas is ready (called by each game's init)
  let touchAttached = false;
  function attachTouch() {
    if (touchAttached) return;
    touchAttached = true;
    const c = getCanvas();
    if (!c) return;

    c.addEventListener('touchstart', e => {
      e.preventDefault();
      const t = e.touches[0];
      const p = canvasCoords(t.clientX, t.clientY);
      mouseX = p.x; mouseY = p.y;
      mouseClicked = true;
      mouseClickX = p.x; mouseClickY = p.y;
      _touchJump = true;
    }, { passive: false });

    c.addEventListener('touchmove', e => {
      e.preventDefault();
      const t = e.touches[0];
      const p = canvasCoords(t.clientX, t.clientY);
      mouseX = p.x; mouseY = p.y;
    }, { passive: false });

    c.addEventListener('touchend', e => {
      e.preventDefault();
    }, { passive: false });
  }

  // ── Frame flush (call once per frame at the END of update) ────
  function flush() {
    for (const k in justPressed) delete justPressed[k];
    mouseClicked = false;
    _touchJump = false;
  }

  return {
    isDown:     code => !!keys[code],
    wasPressed: code => !!justPressed[code],
    get mouseX()    { return mouseX; },
    get mouseY()    { return mouseY; },
    get clicked()   { return mouseClicked; },
    get clickX()    { return mouseClickX; },
    get clickY()    { return mouseClickY; },
    get touchJump() { return _touchJump; },
    flush,
    attachTouch,
  };
})();
