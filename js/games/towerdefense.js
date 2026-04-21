/**
 * towerdefense.js — Tower Defense game module
 *
 * Controls: Click to place selected tower on the grid
 * Features: 3 tower types, enemy path, waves, gold economy
 */

const TowerDefense = (() => {
  let canvas, ctx, W, H;
  let animId = null;
  let lastTime = 0;

  // ── Game state ────────────────────────────────────────────────
  let gold, lives, wave, score, gameRunning;
  let waveActive, waveEnemiesLeft, waveTimer, betweenWaveTimer;
  let selectedTower = 'basic';

  // ── Grid ──────────────────────────────────────────────────────
  let COLS, ROWS, CELL;
  let grid = [];   // 0=empty, 1=path, 2=tower

  // ── Entities ──────────────────────────────────────────────────
  let towers, enemies, projectiles, particles;

  // ── Path (waypoints in grid coords) ──────────────────────────
  // Will be computed based on canvas size
  let PATH = [];
  let pathPixels = []; // pixel coords of path waypoints

  // ── Tower definitions ─────────────────────────────────────────
  const TOWER_DEFS = {
    basic:  { cost: 50,  range: 120, damage: 1,   fireRate: 1.0, color: '#00d4ff', projColor: '#00d4ff', projSpeed: 300, splash: 0,   label: '🗼' },
    sniper: { cost: 100, range: 220, damage: 3,   fireRate: 0.5, color: '#7fff00', projColor: '#7fff00', projSpeed: 600, splash: 0,   label: '🎯' },
    splash: { cost: 150, range: 100, damage: 1.5, fireRate: 0.7, color: '#ff6b35', projColor: '#ff6b35', projSpeed: 250, splash: 50,  label: '💥' },
  };

  // ─────────────────────────────────────────────────────────────
  function init(c) {
    canvas = c;
    ctx = canvas.getContext('2d');
    Input.attachTouch();
    resize();
    window.addEventListener('resize', resize);
    canvas.addEventListener('click', onCanvasClick);
    // Touch placement
    canvas.addEventListener('touchend', e => {
      e.preventDefault();
      const t = e.changedTouches[0];
      onCanvasClick({ clientX: t.clientX, clientY: t.clientY });
    }, { passive: false });
    reset();
    Audio.startMusic('tower');
    lastTime = performance.now();
    animId = requestAnimationFrame(loop);
  }

  function resize() {
    const panelW = window.innerWidth <= 600 ? 80 : 110;
    const fullW = canvas.offsetWidth  || window.innerWidth;
    const fullH = canvas.offsetHeight || (window.innerHeight - 50);
    W = fullW - panelW;
    H = fullH;
    canvas.width  = W;
    canvas.height = H;
    canvas.style.width  = W + 'px';
    canvas.style.height = H + 'px';

    CELL = Math.floor(Math.min(W / 20, H / 14));
    COLS = Math.floor(W / CELL);
    ROWS = Math.floor(H / CELL);
    buildGrid();
  }

  function buildGrid() {
    grid = Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
    // Build a winding path
    PATH = buildPath();
    PATH.forEach(([c, r]) => {
      if (r >= 0 && r < ROWS && c >= 0 && c < COLS) grid[r][c] = 1;
    });
    pathPixels = PATH.map(([c, r]) => ({ x: c * CELL + CELL/2, y: r * CELL + CELL/2 }));
  }

  function buildPath() {
    // Create a winding path across the grid
    const path = [];
    const midR = Math.floor(ROWS / 2);
    const q1 = Math.floor(ROWS / 4);
    const q3 = Math.floor(3 * ROWS / 4);
    const c1 = Math.floor(COLS * 0.25);
    const c2 = Math.floor(COLS * 0.5);
    const c3 = Math.floor(COLS * 0.75);

    // Entry from left
    for (let c = 0; c < c1; c++) path.push([c, midR]);
    // Go up
    for (let r = midR; r >= q1; r--) path.push([c1, r]);
    // Go right
    for (let c = c1; c <= c2; c++) path.push([c, q1]);
    // Go down
    for (let r = q1; r <= q3; r++) path.push([c2, r]);
    // Go right
    for (let c = c2; c <= c3; c++) path.push([c, q3]);
    // Go up
    for (let r = q3; r >= midR; r--) path.push([c3, r]);
    // Exit right
    for (let c = c3; c < COLS; c++) path.push([c, midR]);

    // Deduplicate
    const seen = new Set();
    return path.filter(([c, r]) => {
      const k = `${c},${r}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }

  function reset() {
    gold = 200; lives = 20; wave = 0; score = 0; gameRunning = true;
    waveActive = false; waveEnemiesLeft = 0; waveTimer = 0; betweenWaveTimer = 3;
    towers = []; enemies = []; projectiles = []; particles = [];
    buildGrid();
    updateTDPanel();
    updateHUD();
    startNextWave();
  }

  // ── Wave management ───────────────────────────────────────────
  function startNextWave() {
    wave++;
    waveActive = true;
    waveEnemiesLeft = 8 + wave * 3;
    waveTimer = 0;
    Audio.sfx.wave();
    updateTDPanel();
  }

  // ── Main loop ─────────────────────────────────────────────────
  function loop(ts) {
    const dt = Math.min((ts - lastTime) / 1000, 0.05);
    lastTime = ts;
    if (gameRunning) {
      update(dt);
      draw();
    }
    animId = requestAnimationFrame(loop);
  }

  // ── Update ────────────────────────────────────────────────────
  function update(dt) {
    spawnEnemies(dt);
    updateEnemies(dt);
    updateTowers(dt);
    updateProjectiles(dt);
    updateParticles(dt);
    checkWaveEnd();
    updateTDPanel();
    updateHUD();
    Input.flush();
  }

  function spawnEnemies(dt) {
    if (!waveActive || waveEnemiesLeft <= 0) return;
    waveTimer -= dt;
    if (waveTimer <= 0) {
      waveTimer = Math.max(0.3, 0.9 - wave * 0.03);
      waveEnemiesLeft--;
      const hp = Math.ceil((2 + wave * 1.5) * (Math.random() * 0.4 + 0.8));
      const spd = 60 + wave * 8 + Math.random() * 20;
      const isFast = wave > 3 && Math.random() < 0.25;
      const isTank = wave > 5 && Math.random() < 0.15;
      enemies.push({
        pathIdx: 0,
        x: pathPixels[0].x,
        y: pathPixels[0].y,
        hp: isTank ? hp * 3 : hp,
        maxHp: isTank ? hp * 3 : hp,
        speed: isFast ? spd * 1.8 : spd,
        reward: isTank ? 15 : (isFast ? 8 : 5),
        color: isTank ? '#ff4444' : (isFast ? '#ffff00' : `hsl(${Math.random()*60+100},70%,55%)`),
        r: isTank ? 12 : (isFast ? 7 : 9),
      });
    }
  }

  function updateEnemies(dt) {
    enemies = enemies.filter(e => {
      if (e.pathIdx >= pathPixels.length - 1) {
        // Reached the end
        lives--;
        Audio.sfx.hit();
        spawnParticles(e.x, e.y, '#ff0000', 8);
        if (lives <= 0) endGame();
        return false;
      }
      const target = pathPixels[e.pathIdx + 1];
      const dx = target.x - e.x;
      const dy = target.y - e.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      const move = e.speed * dt;
      if (dist <= move) {
        e.x = target.x; e.y = target.y;
        e.pathIdx++;
      } else {
        e.x += (dx/dist) * move;
        e.y += (dy/dist) * move;
      }
      return true;
    });
  }

  function updateTowers(dt) {
    towers.forEach(t => {
      t.cooldown = (t.cooldown || 0) - dt;
      if (t.cooldown > 0) return;
      const def = TOWER_DEFS[t.type];
      // Find nearest enemy in range
      let target = null, minDist = Infinity;
      enemies.forEach(e => {
        const d = dist2(t.x, t.y, e.x, e.y);
        if (d < def.range && d < minDist) { minDist = d; target = e; }
      });
      if (!target) return;
      t.cooldown = 1 / def.fireRate;
      t.angle = Math.atan2(target.y - t.y, target.x - t.x);
      projectiles.push({
        x: t.x, y: t.y,
        tx: target.x, ty: target.y,
        target,
        speed: def.projSpeed,
        damage: def.damage,
        splash: def.splash,
        color: def.projColor,
        r: def.splash > 0 ? 7 : 4,
      });
      Audio.sfx.shoot();
    });
  }

  function updateProjectiles(dt) {
    projectiles = projectiles.filter(p => {
      const dx = p.target.x - p.x;
      const dy = p.target.y - p.y;
      const d = Math.sqrt(dx*dx + dy*dy);
      const move = p.speed * dt;
      if (d <= move + 4) {
        // Hit
        if (p.splash > 0) {
          enemies.forEach(e => {
            if (dist2(p.target.x, p.target.y, e.x, e.y) < p.splash) {
              damageEnemy(e, p.damage);
            }
          });
          spawnParticles(p.target.x, p.target.y, p.color, 12);
          Audio.sfx.explosion();
        } else {
          damageEnemy(p.target, p.damage);
          spawnParticles(p.target.x, p.target.y, p.color, 5);
        }
        return false;
      }
      p.x += (dx/d) * move;
      p.y += (dy/d) * move;
      return true;
    });
  }

  function damageEnemy(e, dmg) {
    e.hp -= dmg;
    Audio.sfx.hit();
    if (e.hp <= 0) {
      score += 10 * wave;
      gold += e.reward;
      spawnParticles(e.x, e.y, e.color, 10);
      Audio.sfx.enemyDie();
      enemies.splice(enemies.indexOf(e), 1);
    }
  }

  function updateParticles(dt) {
    particles = particles.filter(p => {
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.life -= dt; p.alpha = p.life / p.maxLife;
      return p.life > 0;
    });
  }

  function checkWaveEnd() {
    if (waveActive && waveEnemiesLeft <= 0 && enemies.length === 0) {
      waveActive = false;
      betweenWaveTimer = 3;
      gold += 30 + wave * 5;
      Audio.sfx.levelUp();
      setTimeout(startNextWave, 3000);
    }
  }

  // ── Canvas click → place tower ────────────────────────────────
  function onCanvasClick(e) {
    if (!gameRunning) return;
    const r = canvas.getBoundingClientRect();
    const mx = e.clientX - r.left;
    const my = e.clientY - r.top;
    const col = Math.floor(mx / CELL);
    const row = Math.floor(my / CELL);
    if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return;
    if (grid[row][col] !== 0) return; // path or already has tower

    const def = TOWER_DEFS[selectedTower];
    if (gold < def.cost) { Audio.sfx.hit(); return; }

    gold -= def.cost;
    grid[row][col] = 2;
    towers.push({
      type: selectedTower,
      x: col * CELL + CELL/2,
      y: row * CELL + CELL/2,
      col, row,
      cooldown: 0,
      angle: 0,
    });
    Audio.sfx.place();
  }

  function spawnParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = Math.random() * 100 + 30;
      particles.push({ x, y, vx: Math.cos(a)*spd, vy: Math.sin(a)*spd,
        r: Math.random()*3+1, color, life: 0.5, maxLife: 0.5, alpha: 1 });
    }
  }

  function dist2(ax, ay, bx, by) {
    return Math.sqrt((ax-bx)**2 + (ay-by)**2);
  }

  // ── Draw ──────────────────────────────────────────────────────
  function draw() {
    ctx.fillStyle = '#0a1a0a';
    ctx.fillRect(0, 0, W, H);

    drawGrid();
    drawPath();
    drawTowers();
    drawEnemies();
    drawProjectiles();
    drawParticles();
    drawRangePreview();
    drawWaveInfo();
  }

  function drawGrid() {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (grid[r][c] === 0) {
          ctx.fillStyle = 'rgba(0,40,0,0.5)';
          ctx.fillRect(c*CELL+1, r*CELL+1, CELL-2, CELL-2);
        }
      }
    }
  }

  function drawPath() {
    if (pathPixels.length < 2) return;
    ctx.strokeStyle = '#3a2a00';
    ctx.lineWidth = CELL - 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(pathPixels[0].x, pathPixels[0].y);
    pathPixels.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.stroke();

    // Path highlight
    ctx.strokeStyle = '#5a4000';
    ctx.lineWidth = CELL - 6;
    ctx.beginPath();
    ctx.moveTo(pathPixels[0].x, pathPixels[0].y);
    pathPixels.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.stroke();

    // Start / end markers
    ctx.fillStyle = '#00ff88';
    ctx.font = `${CELL * 0.7}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('▶', pathPixels[0].x, pathPixels[0].y);
    ctx.fillStyle = '#ff4444';
    ctx.fillText('🏁', pathPixels[pathPixels.length-1].x, pathPixels[pathPixels.length-1].y);
  }

  function drawTowers() {
    towers.forEach(t => {
      const def = TOWER_DEFS[t.type];
      ctx.save();
      ctx.translate(t.x, t.y);

      // Base
      ctx.fillStyle = '#1a1a3a';
      ctx.beginPath();
      ctx.arc(0, 0, CELL * 0.42, 0, Math.PI*2);
      ctx.fill();

      // Barrel (rotates toward target)
      ctx.rotate(t.angle + Math.PI/2);
      ctx.fillStyle = def.color;
      ctx.fillRect(-3, -CELL*0.38, 6, CELL*0.38);

      ctx.restore();

      // Icon
      ctx.font = `${CELL * 0.55}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(def.label, t.x, t.y);
    });
  }

  function drawEnemies() {
    enemies.forEach(e => {
      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(e.x, e.y + e.r, e.r, e.r * 0.4, 0, 0, Math.PI*2);
      ctx.fill();

      // Body
      ctx.fillStyle = e.color;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r, 0, Math.PI*2);
      ctx.fill();

      // HP bar
      const bw = e.r * 2.5;
      ctx.fillStyle = '#330000';
      ctx.fillRect(e.x - bw/2, e.y - e.r - 8, bw, 4);
      ctx.fillStyle = `hsl(${(e.hp/e.maxHp)*120},80%,50%)`;
      ctx.fillRect(e.x - bw/2, e.y - e.r - 8, bw * (e.hp/e.maxHp), 4);
    });
  }

  function drawProjectiles() {
    projectiles.forEach(p => {
      ctx.fillStyle = p.color;
      ctx.shadowBlur = 8;
      ctx.shadowColor = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
      ctx.fill();
    });
    ctx.shadowBlur = 0;
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

  function drawRangePreview() {
    // Show range of hovered tower
    const mx = Input.mouseX, my = Input.mouseY;
    const col = Math.floor(mx / CELL);
    const row = Math.floor(my / CELL);
    if (row >= 0 && row < ROWS && col >= 0 && col < COLS) {
      if (grid[row][col] === 2) {
        const t = towers.find(t => t.col === col && t.row === row);
        if (t) {
          const def = TOWER_DEFS[t.type];
          ctx.strokeStyle = 'rgba(255,255,255,0.2)';
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.arc(t.x, t.y, def.range, 0, Math.PI*2);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      } else if (grid[row][col] === 0) {
        // Placement preview
        const def = TOWER_DEFS[selectedTower];
        ctx.fillStyle = gold >= def.cost ? 'rgba(0,212,255,0.15)' : 'rgba(255,0,0,0.15)';
        ctx.fillRect(col*CELL, row*CELL, CELL, CELL);
        ctx.strokeStyle = gold >= def.cost ? 'rgba(0,212,255,0.5)' : 'rgba(255,0,0,0.5)';
        ctx.lineWidth = 2;
        ctx.strokeRect(col*CELL, row*CELL, CELL, CELL);
        // Range preview
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(col*CELL + CELL/2, row*CELL + CELL/2, def.range, 0, Math.PI*2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }

  function drawWaveInfo() {
    if (!waveActive && enemies.length === 0) {
      ctx.fillStyle = 'rgba(0,212,255,0.8)';
      ctx.font = `bold ${Math.floor(H * 0.04)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Next wave incoming...', W/2, H * 0.08);
    }
  }

  // ── HUD & panel ───────────────────────────────────────────────
  function updateHUD() {
    document.getElementById('hud-score').textContent = `Score: ${score}`;
  }

  function updateTDPanel() {
    document.getElementById('td-gold').textContent  = `💰 Gold: ${gold}`;
    document.getElementById('td-lives').textContent = `❤️ Lives: ${lives}`;
    document.getElementById('td-wave').textContent  = `Wave: ${wave}`;
  }

  // ── End game ──────────────────────────────────────────────────
  function endGame() {
    gameRunning = false;
    Audio.sfx.gameOver();
    Audio.stopMusic();
    setTimeout(() => GameManager.showEnd(score), 800);
  }

  // ── Public API ────────────────────────────────────────────────
  function selectTower(type) {
    selectedTower = type;
    document.querySelectorAll('.td-tower-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`td-btn-${type}`).classList.add('active');
  }

  function destroy() {
    if (animId) cancelAnimationFrame(animId);
    window.removeEventListener('resize', resize);
    canvas.removeEventListener('click', onCanvasClick);
    Audio.stopMusic();
    canvas.style.width  = '';
    canvas.style.height = '';
  }

  return { init, destroy, selectTower };
})();

// Global helper called from HTML
function tdSelectTower(type) { TowerDefense.selectTower(type); }
