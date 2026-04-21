/**
 * spaceshooter.js — Space Shooter
 *
 * Desktop: WASD / Arrows to move, Space to shoot
 * Mobile:  Drag anywhere to move ship, auto-fires while alive
 */

const SpaceShooter = (() => {
  let canvas, ctx, W, H;
  let animId = null;
  let lastTime = 0;

  let score, lives, wave, gameRunning;
  let shootCooldown = 0;
  let waveTimer = 0;
  let waveSpawned = false;
  let bossActive = false;

  let player, bullets, enemyBullets, enemies, particles, powerups, boss;
  let stars = [];

  // Touch drag state for mobile movement
  let touchActive = false;
  let touchStartX = 0, touchStartY = 0;
  let touchDX = 0, touchDY = 0;

  // ── Init ──────────────────────────────────────────────────────
  function init(c) {
    canvas = c;
    ctx = canvas.getContext('2d');
    Input.attachTouch();
    resize();
    window.addEventListener('resize', resize);
    attachTouchMove();
    reset();
    Audio.startMusic('shooter');
    lastTime = performance.now();
    animId = requestAnimationFrame(loop);
  }

  function attachTouchMove() {
    canvas.addEventListener('touchstart', e => {
      touchActive = true;
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      touchDX = 0; touchDY = 0;
    }, { passive: true });
    canvas.addEventListener('touchmove', e => {
      if (!touchActive) return;
      touchDX = e.touches[0].clientX - touchStartX;
      touchDY = e.touches[0].clientY - touchStartY;
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }, { passive: true });
    canvas.addEventListener('touchend', () => {
      touchActive = false;
      touchDX = 0; touchDY = 0;
    }, { passive: true });
  }

  function resize() {
    W = canvas.width  = canvas.offsetWidth  || window.innerWidth;
    H = canvas.height = canvas.offsetHeight || (window.innerHeight - 50);
    stars = Array.from({ length: 120 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() * 1.5 + 0.3,
      speed: Math.random() * 60 + 20,
      alpha: Math.random() * 0.7 + 0.3,
    }));
  }

  function reset() {
    score = 0; lives = 3; wave = 0; gameRunning = true;
    shootCooldown = 0; waveTimer = 0; waveSpawned = false; bossActive = false;
    bullets = []; enemyBullets = []; enemies = []; particles = []; powerups = [];
    boss = null;
    player = {
      x: W / 2, y: H - 80,
      w: 36, h: 36,
      speed: 280,
      invincible: 0,
      shield: false,
      triShot: 0,
    };
    updateHUD();
    spawnWave();
  }

  // ── Wave spawning ─────────────────────────────────────────────
  function spawnWave() {
    wave++;
    waveSpawned = true;
    waveTimer = 0;
    Audio.sfx.wave();

    if (wave % 5 === 0) {
      bossActive = true;
      boss = {
        x: W / 2, y: 80,
        w: 80, h: 60,
        hp: 20 + wave * 4,
        maxHp: 20 + wave * 4,
        speed: 80 + wave * 5,
        dir: 1,
        shootTimer: 0,
        shootInterval: Math.max(0.5, 1.5 - wave * 0.05),
        phase: 0,
      };
    } else {
      const count = 5 + wave * 2;
      const rows = Math.min(3, 1 + Math.floor(wave / 3));
      const cols = Math.ceil(count / rows);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (enemies.length >= count) break;
          enemies.push({
            x: 60 + c * (W - 120) / Math.max(cols - 1, 1),
            y: 60 + r * 60,
            w: 28, h: 28,
            hp: 1 + Math.floor(wave / 4),
            speed: 40 + wave * 8,
            dir: 1,
            shootTimer: Math.random() * 2,
            shootInterval: Math.max(0.8, 2.5 - wave * 0.08),
            color: `hsl(${Math.random()*60},80%,60%)`,
          });
        }
      }
    }
  }

  // ── Loop ──────────────────────────────────────────────────────
  function loop(ts) {
    const dt = Math.min((ts - lastTime) / 1000, 0.05);
    lastTime = ts;
    if (gameRunning) { update(dt); draw(); }
    animId = requestAnimationFrame(loop);
  }

  // ── Update ────────────────────────────────────────────────────
  function update(dt) {
    updateStars(dt);
    updatePlayer(dt);
    updateBullets(dt);
    updateEnemies(dt);
    updateBoss(dt);
    updateParticles(dt);
    updatePowerups(dt);
    checkCollisions();
    checkWaveComplete();
    updateHUD();
    Input.flush(); // must be last
  }

  function updateStars(dt) {
    stars.forEach(s => {
      s.y += s.speed * dt;
      if (s.y > H) { s.y = 0; s.x = Math.random() * W; }
    });
  }

  function updatePlayer(dt) {
    const spd = player.speed * dt;

    // Keyboard
    if (Input.isDown('ArrowLeft') || Input.isDown('KeyA')) player.x -= spd;
    if (Input.isDown('ArrowRight')|| Input.isDown('KeyD')) player.x += spd;
    if (Input.isDown('ArrowUp')   || Input.isDown('KeyW')) player.y -= spd;
    if (Input.isDown('ArrowDown') || Input.isDown('KeyS')) player.y += spd;

    // Touch drag — move ship by the drag delta each frame
    if (touchActive) {
      player.x += touchDX * 1.2;
      player.y += touchDY * 1.2;
      touchDX = 0; touchDY = 0; // consume delta
    }

    player.x = Math.max(player.w/2, Math.min(W - player.w/2, player.x));
    player.y = Math.max(player.h/2, Math.min(H - player.h/2, player.y));

    // Shooting — keyboard or auto-fire on mobile when touch is active
    shootCooldown -= dt;
    const wantShoot = Input.isDown('Space') || Input.isDown('KeyZ') || touchActive;
    if (wantShoot && shootCooldown <= 0) {
      shootCooldown = 0.18;
      fireBullet();
      Audio.sfx.shoot();
    }

    if (player.invincible > 0) player.invincible -= dt;
    if (player.triShot > 0)    player.triShot -= dt;
  }

  function fireBullet() {
    const base = { x: player.x, y: player.y - player.h/2, w: 4, h: 14, speed: 600 };
    bullets.push({ ...base });
    if (player.triShot > 0) {
      bullets.push({ ...base, x: player.x - 14, speed: 580 });
      bullets.push({ ...base, x: player.x + 14, speed: 580 });
    }
  }

  function updateBullets(dt) {
    bullets = bullets.filter(b => { b.y -= b.speed * dt; return b.y + b.h > 0; });
    enemyBullets = enemyBullets.filter(b => {
      b.x += b.vx * dt; b.y += b.vy * dt;
      return b.y < H + 20 && b.x > -20 && b.x < W + 20;
    });
  }

  function updateEnemies(dt) {
    enemies.forEach(e => {
      e.x += e.speed * e.dir * dt;
      if (e.x > W - e.w/2 || e.x < e.w/2) { e.dir *= -1; e.y += 20; }
      e.shootTimer -= dt;
      if (e.shootTimer <= 0) {
        e.shootTimer = e.shootInterval + Math.random() * 0.5;
        const angle = Math.atan2(player.y - e.y, player.x - e.x);
        const spd = 180 + wave * 10;
        enemyBullets.push({ x: e.x, y: e.y, vx: Math.cos(angle)*spd, vy: Math.sin(angle)*spd, w: 6, h: 6 });
      }
    });
  }

  function updateBoss(dt) {
    if (!boss) return;
    boss.x += boss.speed * boss.dir * dt;
    if (boss.x > W - boss.w/2 || boss.x < boss.w/2) boss.dir *= -1;
    boss.shootTimer -= dt;
    if (boss.shootTimer <= 0) {
      boss.shootTimer = boss.shootInterval;
      const angles = boss.phase === 0
        ? [Math.PI/2]
        : [Math.PI/2 - Math.PI/6, Math.PI/2, Math.PI/2 + Math.PI/6];
      angles.forEach(a => {
        const spd = 200 + wave * 8;
        enemyBullets.push({ x: boss.x, y: boss.y + boss.h/2, vx: Math.cos(a)*spd, vy: Math.sin(a)*spd, w: 8, h: 8, isBoss: true });
      });
      if (boss.hp < boss.maxHp * 0.5) boss.phase = 1;
    }
  }

  function updateParticles(dt) {
    particles = particles.filter(p => {
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.life -= dt; p.alpha = p.life / p.maxLife;
      return p.life > 0;
    });
  }

  function updatePowerups(dt) {
    powerups = powerups.filter(p => {
      p.y += 80 * dt;
      p.angle = (p.angle || 0) + dt * 2;
      return p.y < H + 30;
    });
  }

  // ── Collisions ────────────────────────────────────────────────
  function checkCollisions() {
    // Bullets vs enemies
    for (let bi = bullets.length - 1; bi >= 0; bi--) {
      const b = bullets[bi];
      let hit = false;
      for (let ei = enemies.length - 1; ei >= 0; ei--) {
        const e = enemies[ei];
        if (rectsOverlap(b, e)) {
          e.hp--;
          hit = true;
          spawnHitParticles(e.x, e.y, e.color);
          Audio.sfx.hit();
          if (e.hp <= 0) {
            score += 10 * wave;
            spawnExplosion(e.x, e.y, e.color);
            Audio.sfx.enemyDie();
            if (Math.random() < 0.15) spawnPowerup(e.x, e.y);
            enemies.splice(ei, 1);
          }
          break;
        }
      }
      if (!hit && boss && rectsOverlap(b, boss)) {
        boss.hp--;
        hit = true;
        spawnHitParticles(boss.x, boss.y, '#ff4444');
        Audio.sfx.hit();
        if (boss.hp <= 0) {
          score += 200 * wave;
          spawnExplosion(boss.x, boss.y, '#ff4444', 40);
          Audio.sfx.explosion();
          boss = null; bossActive = false;
          spawnPowerup(W/2, H/2);
          spawnPowerup(W/3, H/3);
        }
      }
      if (hit) bullets.splice(bi, 1);
    }

    // Enemy bullets vs player
    if (player.invincible <= 0) {
      for (let bi = enemyBullets.length - 1; bi >= 0; bi--) {
        const b = enemyBullets[bi];
        if (circleRect(b.x, b.y, 6, player)) {
          if (player.shield) {
            player.shield = false;
            enemyBullets.splice(bi, 1);
            spawnHitParticles(player.x, player.y, '#00d4ff');
          } else {
            lives--;
            player.invincible = 2;
            enemyBullets.splice(bi, 1);
            spawnExplosion(player.x, player.y, '#ffffff', 20);
            Audio.sfx.playerDie();
            if (lives <= 0) endGame();
          }
        }
      }
    }

    // Powerups vs player
    for (let pi = powerups.length - 1; pi >= 0; pi--) {
      if (circleRect(powerups[pi].x, powerups[pi].y, 14, player)) {
        applyPowerup(powerups[pi].type);
        powerups.splice(pi, 1);
        Audio.sfx.coin();
      }
    }
  }

  function rectsOverlap(a, b) {
    return Math.abs(a.x - b.x) < (a.w + b.w) / 2 &&
           Math.abs(a.y - b.y) < (a.h + b.h) / 2;
  }
  function circleRect(cx, cy, cr, r) {
    return Math.abs(cx - r.x) < cr + r.w/2 && Math.abs(cy - r.y) < cr + r.h/2;
  }

  function checkWaveComplete() {
    if (!waveSpawned) return;
    if (enemies.length === 0 && !bossActive) {
      waveTimer += 1/60;
      if (waveTimer > 2) { waveSpawned = false; spawnWave(); }
    }
  }

  function spawnPowerup(x, y) {
    const types = ['trishot','shield','life'];
    powerups.push({ x, y, type: types[Math.floor(Math.random()*types.length)], angle: 0 });
  }
  function applyPowerup(type) {
    if (type === 'trishot') { player.triShot = 8; Audio.sfx.levelUp(); }
    if (type === 'shield')  { player.shield = true; }
    if (type === 'life')    { lives = Math.min(lives + 1, 5); }
  }

  function spawnHitParticles(x, y, color, count = 6) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, spd = Math.random() * 120 + 40;
      particles.push({ x, y, vx: Math.cos(a)*spd, vy: Math.sin(a)*spd, r: Math.random()*3+1, color, life: 0.4, maxLife: 0.4, alpha: 1 });
    }
  }
  function spawnExplosion(x, y, color, count = 20) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, spd = Math.random() * 200 + 60;
      particles.push({ x, y, vx: Math.cos(a)*spd, vy: Math.sin(a)*spd, r: Math.random()*5+2, color, life: 0.8, maxLife: 0.8, alpha: 1 });
    }
  }

  // ── Draw ──────────────────────────────────────────────────────
  function draw() {
    ctx.fillStyle = '#000010';
    ctx.fillRect(0, 0, W, H);
    drawStars();
    drawPowerups();
    drawBullets();
    drawEnemies();
    drawBoss();
    drawPlayer();
    drawParticles();
    drawWaveAnnounce();
    drawLives();
    // Mobile hint
    if (touchActive) {
      ctx.fillStyle = 'rgba(0,212,255,0.15)';
      ctx.beginPath();
      ctx.arc(player.x, player.y, player.w + 8, 0, Math.PI*2);
      ctx.fill();
    }
  }

  function drawStars() {
    stars.forEach(s => {
      ctx.globalAlpha = s.alpha;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI*2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  function drawPlayer() {
    if (player.invincible > 0 && Math.floor(player.invincible * 10) % 2 === 0) return;
    ctx.save();
    ctx.translate(player.x, player.y);
    if (player.shield) {
      ctx.strokeStyle = 'rgba(0,212,255,0.6)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, player.w, 0, Math.PI*2);
      ctx.stroke();
    }
    if (player.triShot > 0) {
      ctx.fillStyle = 'rgba(127,255,0,0.15)';
      ctx.beginPath();
      ctx.arc(0, 0, player.w + 4, 0, Math.PI*2);
      ctx.fill();
    }
    ctx.fillStyle = '#00d4ff';
    ctx.beginPath();
    ctx.moveTo(0, -player.h/2);
    ctx.lineTo(-player.w/2, player.h/2);
    ctx.lineTo(-player.w/4, player.h/4);
    ctx.lineTo(0, player.h/3);
    ctx.lineTo(player.w/4, player.h/4);
    ctx.lineTo(player.w/2, player.h/2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = `rgba(255,${100 + Math.random()*100},0,0.9)`;
    ctx.beginPath();
    ctx.ellipse(0, player.h/2 + 4, 6, 10 + Math.random()*6, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
  }

  function drawBullets() {
    ctx.fillStyle = '#7fff00';
    ctx.shadowColor = '#7fff00';
    ctx.shadowBlur = 8;
    bullets.forEach(b => ctx.fillRect(b.x - b.w/2, b.y - b.h/2, b.w, b.h));
    enemyBullets.forEach(b => {
      ctx.fillStyle = b.isBoss ? '#ff0080' : '#ff6b35';
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.w/2, 0, Math.PI*2);
      ctx.fill();
    });
    ctx.shadowBlur = 0;
  }

  function drawEnemies() {
    enemies.forEach(e => {
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.fillStyle = e.color;
      ctx.beginPath();
      ctx.moveTo(0, e.h/2);
      ctx.lineTo(-e.w/2, -e.h/4);
      ctx.lineTo(-e.w/4, -e.h/2);
      ctx.lineTo(e.w/4, -e.h/2);
      ctx.lineTo(e.w/2, -e.h/4);
      ctx.closePath();
      ctx.fill();
      if (e.hp > 1) {
        const maxHp = 1 + Math.floor(wave/4);
        ctx.fillStyle = '#333';
        ctx.fillRect(-e.w/2, -e.h/2 - 8, e.w, 4);
        ctx.fillStyle = '#0f0';
        ctx.fillRect(-e.w/2, -e.h/2 - 8, e.w * (e.hp / maxHp), 4);
      }
      ctx.restore();
    });
  }

  function drawBoss() {
    if (!boss) return;
    ctx.save();
    ctx.translate(boss.x, boss.y);
    ctx.shadowBlur = 30; ctx.shadowColor = '#ff0000';
    ctx.fillStyle = '#cc0000';
    ctx.beginPath();
    ctx.ellipse(0, 0, boss.w/2, boss.h/2, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.fillStyle = '#ff4444';
    ctx.beginPath();
    ctx.ellipse(0, 0, boss.w/4, boss.h/4, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.fillStyle = '#880000';
    [[- boss.w/2, -boss.w, -boss.w/2], [boss.w/2, boss.w, boss.w/2]].forEach(([x1,x2,x3]) => {
      ctx.beginPath();
      ctx.moveTo(x1, 0); ctx.lineTo(x2, boss.h/3); ctx.lineTo(x3, boss.h/2);
      ctx.closePath(); ctx.fill();
    });
    ctx.shadowBlur = 0;
    const bw = 160;
    ctx.fillStyle = '#330000';
    ctx.fillRect(-bw/2, -boss.h/2 - 16, bw, 10);
    ctx.fillStyle = `hsl(${(boss.hp/boss.maxHp)*120},80%,50%)`;
    ctx.fillRect(-bw/2, -boss.h/2 - 16, bw * (boss.hp/boss.maxHp), 10);
    ctx.strokeStyle = '#ff0000'; ctx.lineWidth = 1;
    ctx.strokeRect(-bw/2, -boss.h/2 - 16, bw, 10);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`BOSS  ${boss.hp}/${boss.maxHp}`, 0, -boss.h/2 - 20);
    ctx.restore();
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

  function drawPowerups() {
    const icons = { trishot:'⚡', shield:'🛡', life:'❤️' };
    powerups.forEach(p => {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.font = '22px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(icons[p.type] || '?', 0, 0);
      ctx.restore();
    });
  }

  function drawWaveAnnounce() {
    if (waveTimer < 1.5 && waveSpawned) {
      const alpha = Math.min(1, waveTimer < 0.3 ? waveTimer/0.3 : (1.5 - waveTimer)/0.5);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = bossActive ? '#ff4444' : '#00d4ff';
      ctx.font = `bold ${Math.floor(H * 0.06)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(bossActive ? `⚠ BOSS WAVE ${wave} ⚠` : `Wave ${wave}`, W/2, H/2);
      ctx.globalAlpha = 1;
    }
  }

  function drawLives() {
    ctx.font = '20px serif';
    ctx.textBaseline = 'top';
    for (let i = 0; i < lives; i++) ctx.fillText('❤️', 8 + i * 26, 4);
  }

  function updateHUD() {
    document.getElementById('hud-score').textContent = `Score: ${score}`;
  }

  function endGame() {
    gameRunning = false;
    Audio.sfx.gameOver();
    Audio.stopMusic();
    setTimeout(() => GameManager.showEnd(score), 800);
  }

  function destroy() {
    if (animId) cancelAnimationFrame(animId);
    window.removeEventListener('resize', resize);
    Audio.stopMusic();
  }

  return { init, destroy };
})();
