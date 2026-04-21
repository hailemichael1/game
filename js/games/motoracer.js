/**
 * motoracer.js — Pseudo-3D Motorcycle Racer (OutRun style)
 * 
 * Classic segment-based road rendering with curves, hills, traffic, and AI rival
 */

const MotoRacer = (() => {
  let canvas, ctx, W, H;
  let animId = null;
  let lastTime = 0;

  // ── Game state ────────────────────────────────────────────────
  let gameState = 'menu'; // menu, bikeSelect, trackSelect, racing, finished
  let selectedBike = null;
  let selectedTrack = null;
  let score = 0;
  let distance = 0;
  let gameRunning = false;

  // ── Player ────────────────────────────────────────────────────
  let player = {
    x: 0,        // -1 to 1 across road
    z: 0,        // position along track
    speed: 0,
    maxSpeed: 280,
    accel: 0.3,
    brake: 0.6,
    handling: 0.08,
    lean: 0,
    nitro: 3,
    nitroActive: false,
    crashed: false,
    crashTimer: 0,
  };

  // ── Track segments ────────────────────────────────────────────
  let segments = [];
  const SEGMENT_LENGTH = 200;
  const ROAD_WIDTH = 2000;
  const CAMERA_DEPTH = 0.84;
  const DRAW_DISTANCE = 300;

  // ── Traffic & AI ──────────────────────────────────────────────
  let traffic = [];
  let rival = { z: 0, x: 0, speed: 200 };

  // ── Weather & time ────────────────────────────────────────────
  let weather = 'clear'; // clear, rain
  let timeOfDay = 0.5; // 0=night, 1=day

  // ── Particles ─────────────────────────────────────────────────
  let particles = [];

  // ── Bikes data ────────────────────────────────────────────────
  const BIKES = {
    speeder: { name: 'Speeder', maxSpeed: 320, handling: 0.06, color: '#ff0000', desc: 'High speed, low handling' },
    drifter: { name: 'Drifter', maxSpeed: 260, handling: 0.12, color: '#00ff00', desc: 'Balanced performance' },
    cruiser: { name: 'Cruiser', maxSpeed: 220, handling: 0.10, color: '#0080ff', desc: 'Stable & easy to control' },
  };

  // ── Tracks data ───────────────────────────────────────────────
  const TRACKS = {
    city:    { name: 'City Streets', roadColor: '#555', grassColor: '#2a4a2a', scenery: 'buildings' },
    highway: { name: 'Highway',      roadColor: '#333', grassColor: '#1a3a1a', scenery: 'trees' },
    offroad: { name: 'Off-Road',     roadColor: '#8b6914', grassColor: '#4a6a1a', scenery: 'rocks' },
  };

  // ─────────────────────────────────────────────────────────────
  function init(c) {
    canvas = c;
    ctx = canvas.getContext('2d');
    Input.attachTouch();
    resize();
    window.addEventListener('resize', resize);
    reset();
    Audio.startMusic('runner');
    lastTime = performance.now();
    animId = requestAnimationFrame(loop);
  }

  function resize() {
    W = canvas.width  = canvas.offsetWidth  || window.innerWidth;
    H = canvas.height = canvas.offsetHeight || (window.innerHeight - 50);
  }

  function reset() {
    gameState = 'bikeSelect';
    selectedBike = null;
    selectedTrack = null;
    score = 0;
    distance = 0;
    player.z = 0;
    player.x = 0;
    player.speed = 0;
    player.nitro = 3;
    player.crashed = false;
    particles = [];
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
    if (gameState === 'bikeSelect' || gameState === 'trackSelect') {
      handleMenuInput();
    } else if (gameState === 'racing') {
      updateRacing(dt);
    }
    Input.flush();
  }

  function handleMenuInput() {
    // Simple click-based selection
    if (Input.clicked) {
      const mx = Input.clickX, my = Input.clickY;
      if (gameState === 'bikeSelect') {
        // 3 bike cards
        const cardW = 200, cardH = 120, gap = 20;
        const startX = W/2 - (cardW*3 + gap*2)/2;
        const startY = H/2 - cardH/2;
        ['speeder','drifter','cruiser'].forEach((key, i) => {
          const x = startX + i * (cardW + gap);
          if (mx > x && mx < x + cardW && my > startY && my < startY + cardH) {
            selectedBike = key;
            player.maxSpeed = BIKES[key].maxSpeed;
            player.handling = BIKES[key].handling;
            gameState = 'trackSelect';
            Audio.sfx.menuClick();
          }
        });
      } else if (gameState === 'trackSelect') {
        const cardW = 200, cardH = 100, gap = 20;
        const startX = W/2 - (cardW*3 + gap*2)/2;
        const startY = H/2 - cardH/2;
        ['city','highway','offroad'].forEach((key, i) => {
          const x = startX + i * (cardW + gap);
          if (mx > x && mx < x + cardW && my > startY && my < startY + cardH) {
            selectedTrack = key;
            buildTrack(key);
            gameState = 'racing';
            gameRunning = true;
            Audio.sfx.menuClick();
          }
        });
      }
    }
  }

  function updateRacing(dt) {
    if (player.crashed) {
      player.crashTimer += dt;
      if (player.crashTimer > 2) endGame();
      return;
    }

    // Input
    const left  = Input.isDown('ArrowLeft')  || Input.isDown('KeyA');
    const right = Input.isDown('ArrowRight') || Input.isDown('KeyD');
    const up    = Input.isDown('ArrowUp')    || Input.isDown('KeyW');
    const down  = Input.isDown('ArrowDown')  || Input.isDown('KeyS');
    const nitro = Input.isDown('ShiftLeft')  || Input.isDown('ShiftRight') || Input.touchJump;

    // Touch steering (left/right half of screen)
    if (Input.mouseX < W/3) player.x -= player.handling * dt * 60;
    if (Input.mouseX > W*2/3) player.x += player.handling * dt * 60;

    // Steering
    if (left)  player.x -= player.handling * dt * 60;
    if (right) player.x += player.handling * dt * 60;

    // Throttle
    if (up) player.speed += player.accel * dt * 60;
    if (down) player.speed -= player.brake * dt * 60;

    // Nitro
    if (nitro && player.nitro > 0 && !player.nitroActive) {
      player.nitroActive = true;
      player.nitro -= 0.5 * dt;
      player.speed += 100 * dt;
      Audio.sfx.jump();
    } else {
      player.nitroActive = false;
    }

    // Clamp speed
    player.speed = Math.max(0, Math.min(player.maxSpeed, player.speed));

    // Friction
    player.speed *= 0.98;

    // Move forward
    player.z += player.speed * dt;
    distance = Math.floor(player.z / SEGMENT_LENGTH);

    // Clamp X
    player.x = Math.max(-1.2, Math.min(1.2, player.x));

    // Off-road penalty
    if (Math.abs(player.x) > 0.9) {
      player.speed *= 0.95;
      if (Math.random() < 0.02) spawnDust(player.x, player.z);
    }

    // Lean
    player.lean = player.x * 0.3;

    // Traffic collision
    traffic.forEach(car => {
      const dz = Math.abs(car.z - player.z);
      const dx = Math.abs(car.x - player.x);
      if (dz < 50 && dx < 0.3) crash();
    });

    // Update traffic
    traffic.forEach(car => {
      if (car.z < player.z - 500) car.z += 3000;
    });

    // Update rival
    rival.z += rival.speed * dt;
    if (rival.z < player.z - 500) rival.z = player.z + 1000;

    // Update particles
    particles = particles.filter(p => {
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      p.life -= dt; p.alpha = p.life / p.maxLife;
      return p.life > 0;
    });

    // Score
    score = distance * 10;

    // End condition (simple: reach 1600 segments)
    if (distance > 1600) endGame();

    updateHUD();
  }

  function crash() {
    if (player.crashed) return;
    player.crashed = true;
    player.speed = 0;
    Audio.sfx.explosion();
    for (let i = 0; i < 20; i++) spawnSpark(player.x, player.z);
  }

  function spawnSpark(x, z) {
    particles.push({
      x, y: 0, z,
      vx: (Math.random()-0.5)*2, vy: Math.random()*2, vz: (Math.random()-0.5)*50,
      r: 3, color: '#ff8800', life: 0.5, maxLife: 0.5, alpha: 1
    });
  }

  function spawnDust(x, z) {
    particles.push({
      x, y: 0, z,
      vx: (Math.random()-0.5)*0.5, vy: 0.5, vz: -20,
      r: 4, color: '#8b6914', life: 0.8, maxLife: 0.8, alpha: 1
    });
  }

  // ── Track generation ──────────────────────────────────────────
  function buildTrack(type) {
    segments = [];
    traffic = [];
    const trackData = TRACKS[type];
    
    for (let i = 0; i < 1600; i++) {
      const curve = Math.sin(i * 0.02) * (Math.random() < 0.3 ? 2 : 0.5);
      const hill = Math.sin(i * 0.01) * 40;
      const color = i % 10 < 5 ? 0 : 1;
      segments.push({ curve, hill, color, z: i * SEGMENT_LENGTH });
    }

    // Spawn traffic
    for (let i = 0; i < 15; i++) {
      traffic.push({
        z: Math.random() * 1600 * SEGMENT_LENGTH,
        x: (Math.random() - 0.5) * 1.5,
        color: `hsl(${Math.random()*360},70%,50%)`,
      });
    }

    rival.z = player.z + 500;
    rival.x = 0;
  }

  // ── Draw ──────────────────────────────────────────────────────
  function draw() {
    if (gameState === 'bikeSelect') {
      drawBikeSelect();
    } else if (gameState === 'trackSelect') {
      drawTrackSelect();
    } else if (gameState === 'racing') {
      drawRacing();
    }
  }

  function drawBikeSelect() {
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 32px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SELECT YOUR BIKE', W/2, H/4);

    const cardW = 200, cardH = 120, gap = 20;
    const startX = W/2 - (cardW*3 + gap*2)/2;
    const startY = H/2 - cardH/2;

    ['speeder','drifter','cruiser'].forEach((key, i) => {
      const bike = BIKES[key];
      const x = startX + i * (cardW + gap);
      ctx.fillStyle = '#1a1a3a';
      ctx.fillRect(x, startY, cardW, cardH);
      ctx.strokeStyle = bike.color;
      ctx.lineWidth = 3;
      ctx.strokeRect(x, startY, cardW, cardH);
      ctx.fillStyle = bike.color;
      ctx.font = 'bold 18px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(bike.name, x + cardW/2, startY + 30);
      ctx.fillStyle = '#aaa';
      ctx.font = '12px sans-serif';
      ctx.fillText(bike.desc, x + cardW/2, startY + 60);
      ctx.fillText(`Speed: ${bike.maxSpeed}`, x + cardW/2, startY + 80);
      ctx.fillText(`Handling: ${Math.floor(bike.handling*100)}`, x + cardW/2, startY + 100);
    });
  }

  function drawTrackSelect() {
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 32px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SELECT TRACK', W/2, H/4);

    const cardW = 200, cardH = 100, gap = 20;
    const startX = W/2 - (cardW*3 + gap*2)/2;
    const startY = H/2 - cardH/2;

    ['city','highway','offroad'].forEach((key, i) => {
      const track = TRACKS[key];
      const x = startX + i * (cardW + gap);
      ctx.fillStyle = '#1a1a3a';
      ctx.fillRect(x, startY, cardW, cardH);
      ctx.strokeStyle = '#00d4ff';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, startY, cardW, cardH);
      ctx.fillStyle = '#00d4ff';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText(track.name, x + cardW/2, startY + 50);
    });
  }

  function drawRacing() {
    // Sky
    const skyGrad = ctx.createLinearGradient(0, 0, 0, H/2);
    skyGrad.addColorStop(0, timeOfDay > 0.5 ? '#87ceeb' : '#0a0a2a');
    skyGrad.addColorStop(1, timeOfDay > 0.5 ? '#e0f6ff' : '#1a1a3a');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, W, H);

    // Road
    drawRoad();

    // Traffic
    drawTraffic();

    // Rival
    drawRival();

    // Player bike
    drawPlayer();

    // Particles
    drawParticles();

    // HUD
    drawHUD();

    // Crash overlay
    if (player.crashed) {
      ctx.fillStyle = 'rgba(255,0,0,0.3)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 48px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('CRASHED!', W/2, H/2);
    }
  }

  function drawRoad() {
    const baseSegment = Math.floor(player.z / SEGMENT_LENGTH);
    const basePercent = (player.z % SEGMENT_LENGTH) / SEGMENT_LENGTH;

    for (let n = 0; n < DRAW_DISTANCE; n++) {
      const segIdx = (baseSegment + n) % segments.length;
      const seg = segments[segIdx];
      const nextIdx = (segIdx + 1) % segments.length;
      const next = segments[nextIdx];

      const z = (n - basePercent) * SEGMENT_LENGTH;
      if (z <= 0) continue;

      const scale = CAMERA_DEPTH / z;
      const roadW = scale * ROAD_WIDTH;
      const x = W/2 + scale * (seg.curve * n * 5);
      const y = H/2 + scale * seg.hill;

      const nextZ = z + SEGMENT_LENGTH;
      const nextScale = CAMERA_DEPTH / nextZ;
      const nextRoadW = nextScale * ROAD_WIDTH;
      const nextX = W/2 + nextScale * (next.curve * (n+1) * 5);
      const nextY = H/2 + nextScale * next.hill;

      // Grass
      ctx.fillStyle = seg.color === 0 ? TRACKS[selectedTrack].grassColor : darken(TRACKS[selectedTrack].grassColor);
      ctx.fillRect(0, y, W, nextY - y + 1);

      // Road
      ctx.fillStyle = seg.color === 0 ? TRACKS[selectedTrack].roadColor : lighten(TRACKS[selectedTrack].roadColor);
      drawTrapezoid(x - roadW, y, x + roadW, y, nextX - nextRoadW, nextY, nextX + nextRoadW, nextY);

      // Road lines
      if (n % 5 === 0) {
        ctx.fillStyle = '#fff';
        const lineW = roadW * 0.05;
        drawTrapezoid(x - lineW, y, x + lineW, y, nextX - lineW, nextY, nextX + lineW, nextY);
      }
    }
  }

  function drawTrapezoid(x1, y1, x2, y2, x3, y3, x4, y4) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineTo(x4, y4);
    ctx.lineTo(x3, y3);
    ctx.closePath();
    ctx.fill();
  }

  function drawTraffic() {
    traffic.forEach(car => {
      const dz = car.z - player.z;
      if (dz < 0 || dz > DRAW_DISTANCE * SEGMENT_LENGTH) return;
      const scale = CAMERA_DEPTH / dz;
      const screenX = W/2 + scale * car.x * ROAD_WIDTH/2;
      const screenY = H/2;
      const w = scale * 80;
      const h = scale * 120;
      ctx.fillStyle = car.color;
      ctx.fillRect(screenX - w/2, screenY - h, w, h);
    });
  }

  function drawRival() {
    const dz = rival.z - player.z;
    if (dz < 0 || dz > DRAW_DISTANCE * SEGMENT_LENGTH) return;
    const scale = CAMERA_DEPTH / dz;
    const screenX = W/2 + scale * rival.x * ROAD_WIDTH/2;
    const screenY = H/2;
    const w = scale * 60;
    const h = scale * 100;
    ctx.fillStyle = '#ff00ff';
    ctx.fillRect(screenX - w/2, screenY - h, w, h);
  }

  function drawPlayer() {
    const cx = W/2;
    const cy = H * 0.75;
    const w = 60, h = 100;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(player.lean * 0.3);

    // Bike body
    ctx.fillStyle = BIKES[selectedBike].color;
    ctx.fillRect(-w/2, -h, w, h);

    // Wheels
    ctx.fillStyle = '#222';
    ctx.fillRect(-w/2 - 5, -h + 10, 10, 15);
    ctx.fillRect(w/2 - 5, -h + 10, 10, 15);
    ctx.fillRect(-w/2 - 5, -20, 10, 15);
    ctx.fillRect(w/2 - 5, -20, 10, 15);

    ctx.restore();
  }

  function drawParticles() {
    particles.forEach(p => {
      const dz = p.z - player.z;
      if (dz < 0 || dz > 500) return;
      const scale = CAMERA_DEPTH / dz;
      const screenX = W/2 + scale * p.x * ROAD_WIDTH/2;
      const screenY = H/2 + scale * p.y;
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(screenX, screenY, p.r * scale, 0, Math.PI*2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  function drawHUD() {
    // Speed
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(10, H - 80, 150, 70);
    ctx.fillStyle = '#0f0';
    ctx.font = 'bold 24px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`${Math.floor(player.speed)} km/h`, 20, H - 50);

    // Nitro
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(W - 160, H - 80, 150, 70);
    ctx.fillStyle = '#ff0';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`Nitro: ${Math.floor(player.nitro * 10)/10}`, W - 20, H - 50);

    // Distance
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(W/2 - 100, 10, 200, 40);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Distance: ${distance}m`, W/2, 35);
  }

  function updateHUD() {
    document.getElementById('hud-score').textContent = `Score: ${score}`;
  }

  function lighten(color) {
    return color.replace(/[0-9a-f]{2}/gi, m => {
      const v = parseInt(m, 16);
      return Math.min(255, v + 30).toString(16).padStart(2, '0');
    });
  }

  function darken(color) {
    return color.replace(/[0-9a-f]{2}/gi, m => {
      const v = parseInt(m, 16);
      return Math.max(0, v - 30).toString(16).padStart(2, '0');
    });
  }

  function endGame() {
    gameRunning = false;
    Audio.stopMusic();
    GameManager.showEnd(score);
  }

  function destroy() {
    if (animId) cancelAnimationFrame(animId);
    window.removeEventListener('resize', resize);
    Audio.stopMusic();
  }

  return { init, destroy };
})();
