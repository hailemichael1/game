/**
 * endlessrunner.js — Endless Runner game module
 *
 * Controls: Space / Up Arrow / Tap to jump (double-jump supported)
 * Features: Parallax BG, coins, obstacles, increasing speed, day/night cycle
 */

const EndlessRunner = (() => {
  let canvas, ctx, W, H;
  let animId = null;
  let lastTime = 0;

  // ── Game state ────────────────────────────────────────────────
  let score, distance, gameRunning, started;
  let speed, speedTimer;
  let groundY;

  // ── Player ────────────────────────────────────────────────────
  let player;

  // ── World objects ─────────────────────────────────────────────
  let obstacles, coins, particles;
  let bgLayers;   // parallax layers
  let clouds;

  // ── Visual ────────────────────────────────────────────────────
  let dayTime = 0;  // 0=day, cycles to night

  // ─────────────────────────────────────────────────────────────
  function init(c) {
    canvas = c;
    ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
    reset();
    Audio.startMusic('runner');
    lastTime = performance.now();
    animId = requestAnimationFrame(loop);
  }

  function resize() {
    W = canvas.width  = canvas.offsetWidth;
    H = canvas.height = canvas.offsetHeight;
    groundY = H * 0.75;
    buildBgLayers();
  }

  function buildBgLayers() {
    // 3 parallax layers: mountains, hills, trees
    bgLayers = [
      { speed: 0.1, items: buildMountains() },
      { speed: 0.3, items: buildHills() },
      { speed: 0.6, items: buildTrees() },
    ];
    clouds = Array.from({ length: 6 }, () => ({
      x: Math.random() * W,
      y: Math.random() * groundY * 0.5,
      w: Math.random() * 80 + 40,
      h: Math.random() * 20 + 10,
      speed: Math.random() * 20 + 10,
    }));
  }

  function buildMountains() {
    return Array.from({ length: 8 }, (_, i) => ({
      x: i * (W / 6),
      h: Math.random() * groundY * 0.5 + groundY * 0.2,
      w: Math.random() * 120 + 80,
    }));
  }
  function buildHills() {
    return Array.from({ length: 10 }, (_, i) => ({
      x: i * (W / 8),
      h: Math.random() * groundY * 0.3 + groundY * 0.1,
      w: Math.random() * 80 + 60,
    }));
  }
  function buildTrees() {
    return Array.from({ length: 14 }, (_, i) => ({
      x: i * (W / 12),
      h: Math.random() * 40 + 30,
    }));
  }

  function reset() {
    score = 0; distance = 0; gameRunning = true; started = false;
    speed = 280; speedTimer = 0;
    dayTime = 0;
    obstacles = []; coins = []; particles = [];

    player = {
      x: W * 0.15,
      y: groundY,
      w: 32, h: 48,
      vy: 0,
      jumpsLeft: 2,
      onGround: true,
      frame: 0,
      frameTimer: 0,
      dead: false,
      deathTimer: 0,
    };

    // Spawn initial coins
    for (let i = 0; i < 3; i++) spawnCoin(W + i * 300);
    // Spawn initial obstacles
    spawnObstacle(W + 400);
    spawnObstacle(W + 800);

    updateHUD();
  }

  // ── Main loop ─────────────────────────────────────────────────
  function loop(ts) {
    const dt = Math.min((ts - lastTime) / 1000, 0.05);
    lastTime = ts;
    update(dt);
    draw();
    animId = requestAnimationFrame(loop);
  }

  // ── Update ────────────────────────────────────────────────────
  function update(dt) {
    handleInput();
    if (!started || !gameRunning) return;

    dayTime += dt * 0.05;
    speedTimer += dt;
    if (speedTimer > 5) { speed += 15; speedTimer = 0; }

    distance += speed * dt;
    score = Math.floor(distance / 10);

    updatePlayer(dt);
    updateObstacles(dt);
    updateCoins(dt);
    updateParticles(dt);
    updateBg(dt);
    checkCollisions();
    updateHUD();
  }

  function handleInput() {
    const jumpPressed =
      Input.wasPressed('Space') ||
      Input.wasPressed('ArrowUp') ||
      Input.wasPressed('KeyW') ||
      Input.touchJump;

    if (!started && jumpPressed) {
      started = true;
      Audio.sfx.jump();
      return;
    }

    if (jumpPressed && player.jumpsLeft > 0 && !player.dead) {
      player.vy = -620;
      player.jumpsLeft--;
      player.onGround = false;
      Audio.sfx.jump();
    }
  }

  function updatePlayer(dt) {
    if (player.dead) {
      player.deathTimer += dt;
      if (player.deathTimer > 1.2) endGame();
      return;
    }

    // Gravity
    player.vy += 1600 * dt;
    player.y += player.vy * dt;

    if (player.y >= groundY) {
      player.y = groundY;
      if (player.vy > 0) {
        if (!player.onGround) Audio.sfx.land();
        player.onGround = true;
        player.jumpsLeft = 2;
        player.vy = 0;
      }
    } else {
      player.onGround = false;
    }

    // Run animation
    if (player.onGround) {
      player.frameTimer += dt;
      if (player.frameTimer > 0.1) { player.frame = (player.frame + 1) % 4; player.frameTimer = 0; }
    }
  }

  function updateObstacles(dt) {
    obstacles = obstacles.filter(o => {
      o.x -= speed * dt;
      return o.x + o.w > -20;
    });
    // Spawn new
    const last = obstacles[obstacles.length - 1];
    const gap = 300 + Math.random() * 400 - Math.min(speed * 0.3, 150);
    if (!last || last.x < W - gap) spawnObstacle(W + 50);
  }

  function updateCoins(dt) {
    coins = coins.filter(c => {
      c.x -= speed * dt;
      c.angle = (c.angle || 0) + dt * 3;
      return c.x + 12 > -20;
    });
    const last = coins[coins.length - 1];
    if (!last || last.x < W - 200) spawnCoin(W + 100 + Math.random() * 200);
  }

  function updateParticles(dt) {
    particles = particles.filter(p => {
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vy += 400 * dt;
      p.life -= dt; p.alpha = p.life / p.maxLife;
      return p.life > 0;
    });
  }

  function updateBg(dt) {
    // Scroll parallax layers
    bgLayers.forEach(layer => {
      layer.items.forEach(item => {
        item.x -= speed * layer.speed * dt;
        if (item.x + (item.w || 60) < 0) item.x += W + (item.w || 60);
      });
    });
    clouds.forEach(c => {
      c.x -= c.speed * dt;
      if (c.x + c.w < 0) c.x = W + c.w;
    });
  }

  // ── Spawners ──────────────────────────────────────────────────
  function spawnObstacle(x) {
    const types = ['cactus', 'rock', 'spike'];
    const type = types[Math.floor(Math.random() * types.length)];
    const h = type === 'rock' ? 28 : (type === 'spike' ? 36 : 44);
    const w = type === 'rock' ? 36 : (type === 'spike' ? 20 : 24);
    obstacles.push({ x, y: groundY - h, w, h, type });
  }

  function spawnCoin(x) {
    // Coin row at varying heights
    const count = Math.floor(Math.random() * 4) + 1;
    const baseY = groundY - 60 - Math.random() * 80;
    for (let i = 0; i < count; i++) {
      coins.push({ x: x + i * 40, y: baseY, r: 10, angle: 0, collected: false });
    }
  }

  // ── Collisions ────────────────────────────────────────────────
  function checkCollisions() {
    if (player.dead) return;

    // vs obstacles
    obstacles.forEach(o => {
      if (rectsOverlap(
        { x: player.x - player.w/2 + 6, y: player.y - player.h + 4, w: player.w - 12, h: player.h - 4 },
        { x: o.x, y: o.y, w: o.w, h: o.h }
      )) {
        killPlayer();
      }
    });

    // vs coins
    coins.forEach((c, ci) => {
      if (!c.collected && Math.abs(c.x - player.x) < player.w/2 + c.r &&
          Math.abs(c.y - (player.y - player.h/2)) < player.h/2 + c.r) {
        c.collected = true;
        score += 5;
        spawnCoinParticles(c.x, c.y);
        Audio.sfx.coin();
        coins.splice(ci, 1);
      }
    });
  }

  function rectsOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x &&
           a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function killPlayer() {
    player.dead = true;
    player.vy = -400;
    spawnExplosion(player.x, player.y - player.h/2);
    Audio.sfx.playerDie();
  }

  function spawnCoinParticles(x, y) {
    for (let i = 0; i < 6; i++) {
      const a = Math.random() * Math.PI * 2;
      particles.push({ x, y, vx: Math.cos(a)*80, vy: Math.sin(a)*80 - 60,
        r: 3, color: '#ffd700', life: 0.5, maxLife: 0.5, alpha: 1 });
    }
  }

  function spawnExplosion(x, y) {
    for (let i = 0; i < 16; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = Math.random() * 150 + 50;
      particles.push({ x, y, vx: Math.cos(a)*spd, vy: Math.sin(a)*spd - 100,
        r: Math.random()*4+2, color: `hsl(${Math.random()*40+10},90%,60%)`,
        life: 0.7, maxLife: 0.7, alpha: 1 });
    }
  }

  // ── Draw ──────────────────────────────────────────────────────
  function draw() {
    drawSky();
    drawClouds();
    drawBgLayers();
    drawGround();
    drawCoins();
    drawObstacles();
    drawPlayer();
    drawParticles();
    drawUI();
  }

  function skyColor() {
    const t = (Math.sin(dayTime * Math.PI * 2) + 1) / 2; // 0=night, 1=day
    const day   = { r: 30,  g: 100, b: 200 };
    const night = { r: 5,   g: 5,   b: 30  };
    const r = Math.round(day.r * t + night.r * (1-t));
    const g = Math.round(day.g * t + night.g * (1-t));
    const b = Math.round(day.b * t + night.b * (1-t));
    return `rgb(${r},${g},${b})`;
  }

  function drawSky() {
    const grad = ctx.createLinearGradient(0, 0, 0, groundY);
    grad.addColorStop(0, skyColor());
    grad.addColorStop(1, 'rgba(0,0,0,0.2)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }

  function drawClouds() {
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    clouds.forEach(c => {
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, c.w/2, c.h/2, 0, 0, Math.PI*2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(c.x - c.w*0.2, c.y + c.h*0.1, c.w*0.35, c.h*0.4, 0, 0, Math.PI*2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(c.x + c.w*0.2, c.y + c.h*0.1, c.w*0.35, c.h*0.4, 0, 0, Math.PI*2);
      ctx.fill();
    });
  }

  function drawBgLayers() {
    bgLayers.forEach((layer, li) => {
      layer.items.forEach(item => {
        if (li === 0) {
          // Mountains
          const alpha = 0.3;
          ctx.fillStyle = `rgba(60,40,80,${alpha})`;
          ctx.beginPath();
          ctx.moveTo(item.x, groundY);
          ctx.lineTo(item.x + item.w/2, groundY - item.h);
          ctx.lineTo(item.x + item.w, groundY);
          ctx.closePath();
          ctx.fill();
        } else if (li === 1) {
          // Hills
          ctx.fillStyle = 'rgba(30,80,30,0.5)';
          ctx.beginPath();
          ctx.ellipse(item.x + item.w/2, groundY, item.w/2, item.h, 0, Math.PI, 0);
          ctx.fill();
        } else {
          // Trees
          ctx.fillStyle = 'rgba(20,60,20,0.7)';
          ctx.fillRect(item.x - 3, groundY - item.h, 6, item.h);
          ctx.beginPath();
          ctx.arc(item.x, groundY - item.h, 12, 0, Math.PI*2);
          ctx.fill();
        }
      });
    });
  }

  function drawGround() {
    // Ground
    ctx.fillStyle = '#3a2a10';
    ctx.fillRect(0, groundY, W, H - groundY);
    // Grass strip
    ctx.fillStyle = '#2d6a2d';
    ctx.fillRect(0, groundY, W, 8);
    // Ground detail lines
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, groundY + 8);
      ctx.lineTo(x + 20, groundY + 20);
      ctx.stroke();
    }
  }

  function drawPlayer() {
    if (player.dead && Math.floor(player.deathTimer * 10) % 2 === 0) return;
    ctx.save();
    ctx.translate(player.x, player.y);

    const legOffset = player.onGround ? Math.sin(player.frame * Math.PI / 2) * 8 : 0;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(0, 2, player.w/2, 5, 0, 0, Math.PI*2);
    ctx.fill();

    // Legs
    ctx.fillStyle = '#1a3a8a';
    ctx.fillRect(-player.w/2 + 4, -player.h * 0.35 + legOffset, player.w/2 - 2, player.h * 0.35);
    ctx.fillRect(2, -player.h * 0.35 - legOffset, player.w/2 - 2, player.h * 0.35);

    // Body
    ctx.fillStyle = '#e84040';
    ctx.beginPath();
    ctx.roundRect(-player.w/2 + 2, -player.h, player.w - 4, player.h * 0.65, 6);
    ctx.fill();

    // Head
    ctx.fillStyle = '#f5c07a';
    ctx.beginPath();
    ctx.arc(0, -player.h + 2, player.w * 0.32, 0, Math.PI*2);
    ctx.fill();

    // Eyes
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(player.w * 0.1, -player.h + 2, 3, 0, Math.PI*2);
    ctx.fill();

    // Arm (animated)
    ctx.fillStyle = '#e84040';
    ctx.fillRect(player.w/2 - 2, -player.h * 0.85 + legOffset * 0.5, 8, player.h * 0.3);

    ctx.restore();
  }

  function drawObstacles(dt) {
    obstacles.forEach(o => {
      ctx.save();
      ctx.translate(o.x + o.w/2, o.y + o.h);

      if (o.type === 'cactus') {
        ctx.fillStyle = '#2d8a2d';
        // Main trunk
        ctx.fillRect(-o.w/2, -o.h, o.w, o.h);
        // Arms
        ctx.fillRect(-o.w, -o.h * 0.6, o.w/2, o.h * 0.25);
        ctx.fillRect(o.w/2, -o.h * 0.7, o.w/2, o.h * 0.25);
        // Spines
        ctx.fillStyle = '#1a5a1a';
        for (let i = 0; i < 4; i++) {
          ctx.fillRect(-o.w/2 - 3, -o.h + i * (o.h/4), 3, 2);
          ctx.fillRect(o.w/2, -o.h + i * (o.h/4), 3, 2);
        }
      } else if (o.type === 'rock') {
        ctx.fillStyle = '#666';
        ctx.beginPath();
        ctx.ellipse(0, -o.h/2, o.w/2, o.h/2, 0, 0, Math.PI*2);
        ctx.fill();
        ctx.fillStyle = '#888';
        ctx.beginPath();
        ctx.ellipse(-o.w/6, -o.h * 0.6, o.w/4, o.h/4, 0, 0, Math.PI*2);
        ctx.fill();
      } else {
        // Spike
        ctx.fillStyle = '#aaa';
        ctx.beginPath();
        ctx.moveTo(0, -o.h);
        ctx.lineTo(-o.w/2, 0);
        ctx.lineTo(o.w/2, 0);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#ccc';
        ctx.beginPath();
        ctx.moveTo(0, -o.h);
        ctx.lineTo(-2, 0);
        ctx.lineTo(2, 0);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    });
  }

  function drawCoins() {
    coins.forEach(c => {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.scale(Math.abs(Math.cos(c.angle)), 1); // spin effect
      ctx.fillStyle = '#ffd700';
      ctx.shadowBlur = 8;
      ctx.shadowColor = '#ffd700';
      ctx.beginPath();
      ctx.arc(0, 0, c.r, 0, Math.PI*2);
      ctx.fill();
      ctx.fillStyle = '#ffaa00';
      ctx.font = `bold ${c.r}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('$', 0, 0);
      ctx.shadowBlur = 0;
      ctx.restore();
    });
  }

  function drawParticles() {
    particles.forEach(p => {
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  function drawUI() {
    // Speed indicator
    const lvl = Math.floor((speed - 280) / 15) + 1;
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(W - 120, 8, 112, 28);
    ctx.fillStyle = '#7fff00';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`⚡ Speed Lv.${lvl}`, W - 114, 14);

    // Start prompt
    if (!started) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${Math.floor(H * 0.05)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Press SPACE or Tap to Start', W/2, H/2);
      ctx.font = `${Math.floor(H * 0.03)}px sans-serif`;
      ctx.fillStyle = '#aaa';
      ctx.fillText('Double-jump supported!', W/2, H/2 + H * 0.07);
    }
  }

  // ── HUD ───────────────────────────────────────────────────────
  function updateHUD() {
    document.getElementById('hud-score').textContent = `Score: ${score}`;
  }

  // ── End game ──────────────────────────────────────────────────
  function endGame() {
    gameRunning = false;
    Audio.stopMusic();
    GameManager.showEnd(score);
  }

  // ── Cleanup ───────────────────────────────────────────────────
  function destroy() {
    if (animId) cancelAnimationFrame(animId);
    window.removeEventListener('resize', resize);
    Audio.stopMusic();
  }

  return { init, destroy };
})();
