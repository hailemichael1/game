/**
 * motoracer.js — True 3D Motorcycle Racing Game with Three.js
 * 
 * Features: Real 3D graphics, physics, AI opponents, multiple tracks
 */

const MotoRacer = (() => {
  let canvas, W, H;
  let animId = null;
  let lastTime = 0;

  // Three.js core
  let scene, camera, renderer;
  let clock;

  // Game state
  let gameState = 'menu'; // menu, racing, paused, finished
  let selectedMode = null; // freeride, timetrial, race
  let selectedTrack = null;
  let score = 0;
  let raceTime = 0;
  let lapTime = 0;
  let bestLap = Infinity;
  let currentLap = 1;
  let totalLaps = 3;

  // Player
  let playerBike = null;
  let playerSpeed = 0;
  let playerMaxSpeed = 200;
  let playerAccel = 50;
  let playerBrake = 80;
  let playerTurn = 2.5;
  let playerNitro = 100;
  let playerPosition = { x: 0, y: 0, z: 0 };
  let playerRotation = 0;

  // AI opponents
  let opponents = [];

  // Track
  let track = null;
  let trackMesh = null;
  let checkpoints = [];
  let currentCheckpoint = 0;

  // Environment
  let weather = 'clear'; // clear, rain
  let timeOfDay = 0.5; // 0=night, 1=day
  let rainParticles = null;

  // UI overlay context
  let uiCanvas, uiCtx;

  // Touch controls
  let touchLeft = false, touchRight = false, touchNitro = false, touchAccel = false;

  // ─────────────────────────────────────────────────────────────
  function init(c) {
    canvas = c;
    W = canvas.offsetWidth  || window.innerWidth;
    H = canvas.offsetHeight || (window.innerHeight - 50);
    
    // Create UI overlay canvas
    uiCanvas = document.createElement('canvas');
    uiCanvas.width = W;
    uiCanvas.height = H;
    uiCanvas.style.position = 'absolute';
    uiCanvas.style.top = '0';
    uiCanvas.style.left = '0';
    uiCanvas.style.zIndex = '100';
    canvas.parentElement.appendChild(uiCanvas);
    uiCtx = uiCanvas.getContext('2d');
    
    // Add click handler to UI canvas
    uiCanvas.addEventListener('click', handleUIClick);
    
    // Add touch handlers for mobile controls
    uiCanvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    uiCanvas.addEventListener('touchend', handleTouchEnd, { passive: false });
    uiCanvas.addEventListener('touchmove', e => e.preventDefault(), { passive: false });

    initThree();
    Input.attachTouch();
    window.addEventListener('resize', onResize);
    
    reset();
    Audio.startMusic('moto');
    
    clock = new THREE.Clock();
    lastTime = performance.now();
    animId = requestAnimationFrame(loop);
  }

  function initThree() {
    // Scene
    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x87ceeb, 100, 1000);

    // Camera
    camera = new THREE.PerspectiveCamera(75, W / H, 0.1, 2000);
    camera.position.set(0, 3, -8);
    camera.lookAt(0, 1, 0);

    // Renderer
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(W, H);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(50, 100, 50);
    dirLight.castShadow = true;
    dirLight.shadow.camera.left = -100;
    dirLight.shadow.camera.right = 100;
    dirLight.shadow.camera.top = 100;
    dirLight.shadow.camera.bottom = -100;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    scene.add(dirLight);

    // Sky
    scene.background = new THREE.Color(0x87ceeb);
  }

  function onResize() {
    W = canvas.offsetWidth  || window.innerWidth;
    H = canvas.offsetHeight || (window.innerHeight - 50);
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
    renderer.setSize(W, H);
    uiCanvas.width = W;
    uiCanvas.height = H;
  }

  function reset() {
    gameState = 'menu';
    selectedMode = null;
    selectedTrack = null;
    score = 0;
    raceTime = 0;
    lapTime = 0;
    currentLap = 1;
    playerSpeed = 0;
    playerNitro = 100;
    playerPosition = { x: 0, y: 0, z: 0 };
    playerRotation = 0;
    currentCheckpoint = 0;
    
    // Clear scene
    while(scene.children.length > 0) { 
      const obj = scene.children[0];
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) obj.material.dispose();
      scene.remove(obj);
    }
    
    // Re-add lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(50, 100, 50);
    dirLight.castShadow = true;
    scene.add(dirLight);
  }

  // ── Main loop ─────────────────────────────────────────────────
  function loop(ts) {
    const dt = Math.min((ts - lastTime) / 1000, 0.05);
    lastTime = ts;
    
    update(dt);
    render();
    drawUI();
    
    animId = requestAnimationFrame(loop);
  }

  // ── Update ────────────────────────────────────────────────────
  function update(dt) {
    if (gameState === 'racing') {
      updateRacing(dt);
    }
    Input.flush();
  }

  function handleMenuInput() {
    // This is now handled by handleUIClick
  }

  function handleUIClick(e) {
    if (gameState !== 'menu') return;
    
    const rect = uiCanvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    
    // Mode selection (3 buttons)
    const btnW = 200, btnH = 60, gap = 20;
    const startX = W/2 - (btnW*3 + gap*2)/2;
    const startY = H/2 - btnH/2;
    
    ['freeride', 'timetrial', 'race'].forEach((mode, i) => {
      const x = startX + i * (btnW + gap);
      if (mx > x && mx < x + btnW && my > startY && my < startY + btnH) {
        selectedMode = mode;
        startRace();
        Audio.sfx.menuClick();
      }
    });
  }

  function handleTouchStart(e) {
    e.preventDefault();
    if (gameState !== 'racing') return;
    
    Array.from(e.touches).forEach(touch => {
      const rect = uiCanvas.getBoundingClientRect();
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;
      
      // Check which button was touched
      // Left button (bottom-left)
      if (x < 100 && y > H - 100) touchLeft = true;
      // Right button (bottom-left, next to left)
      else if (x >= 100 && x < 200 && y > H - 100) touchRight = true;
      // Accel button (bottom-right)
      else if (x > W - 200 && x < W - 100 && y > H - 100) touchAccel = true;
      // Nitro button (bottom-right corner)
      else if (x > W - 100 && y > H - 100) touchNitro = true;
    });
  }

  function handleTouchEnd(e) {
    e.preventDefault();
    touchLeft = false;
    touchRight = false;
    touchNitro = false;
    touchAccel = false;
  }

  function startRace() {
    gameState = 'racing';
    buildTrack();
    createPlayerBike();
    createOpponents();
    raceTime = 0;
    lapTime = 0;
    currentLap = 1;
  }

  function buildTrack() {
    // Create ground plane
    const groundGeo = new THREE.PlaneGeometry(200, 2000);
    const groundMat = new THREE.MeshStandardMaterial({ 
      color: 0x2a4a2a,
      roughness: 0.8 
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Create road
    const roadGeo = new THREE.PlaneGeometry(20, 2000);
    const roadMat = new THREE.MeshStandardMaterial({ 
      color: 0x333333,
      roughness: 0.6 
    });
    trackMesh = new THREE.Mesh(roadGeo, roadMat);
    trackMesh.rotation.x = -Math.PI / 2;
    trackMesh.position.y = 0.01;
    trackMesh.receiveShadow = true;
    scene.add(trackMesh);

    // Road markings
    for (let i = 0; i < 100; i++) {
      const lineGeo = new THREE.BoxGeometry(0.5, 0.02, 10);
      const lineMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
      const line = new THREE.Mesh(lineGeo, lineMat);
      line.position.set(0, 0.02, i * 20 - 1000);
      scene.add(line);
    }

    // Side barriers
    for (let i = 0; i < 200; i++) {
      const barrierGeo = new THREE.BoxGeometry(1, 2, 5);
      const barrierMat = new THREE.MeshStandardMaterial({ 
        color: i % 2 === 0 ? 0xff0000 : 0xffffff 
      });
      
      const leftBarrier = new THREE.Mesh(barrierGeo, barrierMat);
      leftBarrier.position.set(-12, 1, i * 10 - 1000);
      leftBarrier.castShadow = true;
      scene.add(leftBarrier);
      
      const rightBarrier = new THREE.Mesh(barrierGeo, barrierMat);
      rightBarrier.position.set(12, 1, i * 10 - 1000);
      rightBarrier.castShadow = true;
      scene.add(rightBarrier);
    }

    // Trees
    for (let i = 0; i < 50; i++) {
      const treeGeo = new THREE.ConeGeometry(2, 8, 8);
      const treeMat = new THREE.MeshStandardMaterial({ color: 0x1a5a1a });
      const tree = new THREE.Mesh(treeGeo, treeMat);
      const side = Math.random() < 0.5 ? -1 : 1;
      tree.position.set(
        side * (20 + Math.random() * 30),
        4,
        Math.random() * 2000 - 1000
      );
      tree.castShadow = true;
      scene.add(tree);
    }

    // Checkpoints
    checkpoints = [];
    for (let i = 0; i < 10; i++) {
      checkpoints.push({ z: i * 200 });
    }
  }

  function createPlayerBike() {
    // Simple bike geometry
    const bikeGroup = new THREE.Group();
    
    // Body
    const bodyGeo = new THREE.BoxGeometry(1.5, 1, 3);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 1;
    body.castShadow = true;
    bikeGroup.add(body);
    
    // Wheels
    const wheelGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.3, 16);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
    
    const frontWheel = new THREE.Mesh(wheelGeo, wheelMat);
    frontWheel.rotation.z = Math.PI / 2;
    frontWheel.position.set(0, 0.5, 1.2);
    frontWheel.castShadow = true;
    bikeGroup.add(frontWheel);
    
    const rearWheel = new THREE.Mesh(wheelGeo, wheelMat);
    rearWheel.rotation.z = Math.PI / 2;
    rearWheel.position.set(0, 0.5, -1.2);
    rearWheel.castShadow = true;
    bikeGroup.add(rearWheel);
    
    // Rider
    const riderGeo = new THREE.BoxGeometry(0.8, 1.5, 0.8);
    const riderMat = new THREE.MeshStandardMaterial({ color: 0x0000ff });
    const rider = new THREE.Mesh(riderGeo, riderMat);
    rider.position.set(0, 2, 0);
    rider.castShadow = true;
    bikeGroup.add(rider);
    
    // Helmet
    const helmetGeo = new THREE.SphereGeometry(0.4, 16, 16);
    const helmetMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const helmet = new THREE.Mesh(helmetGeo, helmetMat);
    helmet.position.set(0, 2.8, 0);
    helmet.castShadow = true;
    bikeGroup.add(helmet);
    
    bikeGroup.position.set(0, 0, 0);
    scene.add(bikeGroup);
    playerBike = bikeGroup;
  }

  function createOpponents() {
    opponents = [];
    if (selectedMode !== 'race') return;
    
    for (let i = 0; i < 3; i++) {
      const bikeGroup = new THREE.Group();
      
      const bodyGeo = new THREE.BoxGeometry(1.5, 1, 3);
      const colors = [0x00ff00, 0x0000ff, 0xffff00];
      const bodyMat = new THREE.MeshStandardMaterial({ color: colors[i] });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.y = 1;
      body.castShadow = true;
      bikeGroup.add(body);
      
      const wheelGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.3, 16);
      const wheelMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
      
      const frontWheel = new THREE.Mesh(wheelGeo, wheelMat);
      frontWheel.rotation.z = Math.PI / 2;
      frontWheel.position.set(0, 0.5, 1.2);
      bikeGroup.add(frontWheel);
      
      const rearWheel = new THREE.Mesh(wheelGeo, wheelMat);
      rearWheel.rotation.z = Math.PI / 2;
      rearWheel.position.set(0, 0.5, -1.2);
      bikeGroup.add(rearWheel);
      
      bikeGroup.position.set((i - 1) * 4, 0, 20 + i * 10);
      scene.add(bikeGroup);
      
      opponents.push({
        mesh: bikeGroup,
        speed: 80 + Math.random() * 40,
        x: (i - 1) * 4,
        z: 20 + i * 10,
      });
    }
  }

  function updateRacing(dt) {
    raceTime += dt;
    lapTime += dt;

    // Input - keyboard OR touch
    const left  = Input.isDown('ArrowLeft')  || Input.isDown('KeyA') || touchLeft;
    const right = Input.isDown('ArrowRight') || Input.isDown('KeyD') || touchRight;
    const up    = Input.isDown('ArrowUp')    || Input.isDown('KeyW') || touchAccel;
    const down  = Input.isDown('ArrowDown')  || Input.isDown('KeyS');
    const nitro = Input.isDown('ShiftLeft')  || Input.isDown('ShiftRight') || Input.touchJump || touchNitro;

    // Acceleration
    if (up) {
      playerSpeed += playerAccel * dt;
    } else {
      playerSpeed -= playerAccel * 0.5 * dt;
    }

    if (down) {
      playerSpeed -= playerBrake * dt;
    }

    // Nitro
    if (nitro && playerNitro > 0) {
      playerSpeed += 100 * dt;
      playerNitro -= 20 * dt;
      Audio.sfx.jump();
    } else {
      playerNitro = Math.min(100, playerNitro + 5 * dt);
    }

    // Clamp speed
    playerSpeed = Math.max(0, Math.min(playerMaxSpeed, playerSpeed));

    // Steering
    if (left) {
      playerRotation += playerTurn * dt;
      playerPosition.x -= playerSpeed * 0.02 * dt;
    }
    if (right) {
      playerRotation -= playerTurn * dt;
      playerPosition.x += playerSpeed * 0.02 * dt;
    }

    // Clamp X position (stay on road)
    playerPosition.x = Math.max(-10, Math.min(10, playerPosition.x));

    // Move forward
    playerPosition.z += playerSpeed * dt;

    // Update bike position
    if (playerBike) {
      playerBike.position.set(playerPosition.x, 0, playerPosition.z);
      playerBike.rotation.y = playerRotation;
      
      // Lean effect
      const leanAmount = (left ? 0.2 : 0) - (right ? 0.2 : 0);
      playerBike.rotation.z = leanAmount;
    }

    // Update camera to follow player
    camera.position.x = playerPosition.x;
    camera.position.z = playerPosition.z - 8;
    camera.position.y = 3;
    camera.lookAt(playerPosition.x, 1, playerPosition.z + 5);

    // Update opponents
    opponents.forEach(opp => {
      opp.z += opp.speed * dt;
      opp.mesh.position.z = opp.z;
      
      // Reset if too far behind
      if (opp.z < playerPosition.z - 100) {
        opp.z = playerPosition.z + 100 + Math.random() * 50;
      }
    });

    // Check checkpoints
    if (currentCheckpoint < checkpoints.length) {
      const cp = checkpoints[currentCheckpoint];
      if (playerPosition.z > cp.z) {
        currentCheckpoint++;
        score += 100;
        Audio.sfx.coin();
      }
    }

    // Lap completion
    if (playerPosition.z > 1000) {
      if (lapTime < bestLap) bestLap = lapTime;
      currentLap++;
      lapTime = 0;
      playerPosition.z = 0;
      currentCheckpoint = 0;
      
      if (currentLap > totalLaps) {
        endGame();
      } else {
        Audio.sfx.levelUp();
      }
    }

    updateHUD();
  }

  // ── Render ────────────────────────────────────────────────────
  function render() {
    renderer.render(scene, camera);
  }

  // ── UI Overlay ────────────────────────────────────────────────
  function drawUI() {
    uiCtx.clearRect(0, 0, W, H);

    if (gameState === 'menu') {
      drawMenu();
    } else if (gameState === 'racing') {
      drawRacingUI();
    }
  }

  function drawMenu() {
    uiCtx.fillStyle = 'rgba(0,0,0,0.7)';
    uiCtx.fillRect(0, 0, W, H);
    
    uiCtx.fillStyle = '#fff';
    uiCtx.font = 'bold 48px sans-serif';
    uiCtx.textAlign = 'center';
    uiCtx.fillText('3D MOTO RACER', W/2, H/4);
    
    uiCtx.font = '20px sans-serif';
    uiCtx.fillStyle = '#aaa';
    uiCtx.fillText('Select Game Mode', W/2, H/4 + 50);

    const btnW = 200, btnH = 60, gap = 20;
    const startX = W/2 - (btnW*3 + gap*2)/2;
    const startY = H/2 - btnH/2;

    const modes = [
      { key: 'freeride', name: 'Free Ride', desc: 'Cruise freely' },
      { key: 'timetrial', name: 'Time Trial', desc: 'Beat the clock' },
      { key: 'race', name: 'Race', desc: 'Beat AI opponents' },
    ];

    modes.forEach((mode, i) => {
      const x = startX + i * (btnW + gap);
      
      uiCtx.fillStyle = '#1a1a3a';
      uiCtx.fillRect(x, startY, btnW, btnH);
      uiCtx.strokeStyle = '#00d4ff';
      uiCtx.lineWidth = 2;
      uiCtx.strokeRect(x, startY, btnW, btnH);
      
      uiCtx.fillStyle = '#00d4ff';
      uiCtx.font = 'bold 18px sans-serif';
      uiCtx.fillText(mode.name, x + btnW/2, startY + 30);
      
      uiCtx.fillStyle = '#aaa';
      uiCtx.font = '12px sans-serif';
      uiCtx.fillText(mode.desc, x + btnW/2, startY + 50);
    });

    // Controls hint
    uiCtx.fillStyle = '#fff';
    uiCtx.font = '16px sans-serif';
    uiCtx.fillText('Controls: Arrow Keys or WASD to drive, Shift for Nitro', W/2, H - 50);
  }

  function drawRacingUI() {
    // Speed
    uiCtx.fillStyle = 'rgba(0,0,0,0.7)';
    uiCtx.fillRect(20, H - 100, 180, 80);
    uiCtx.fillStyle = '#0f0';
    uiCtx.font = 'bold 32px monospace';
    uiCtx.textAlign = 'left';
    uiCtx.fillText(`${Math.floor(playerSpeed)} km/h`, 30, H - 55);

    // Nitro
    uiCtx.fillStyle = 'rgba(0,0,0,0.7)';
    uiCtx.fillRect(W - 200, H - 100, 180, 80);
    uiCtx.fillStyle = playerNitro > 20 ? '#ff0' : '#666';
    uiCtx.font = 'bold 20px sans-serif';
    uiCtx.textAlign = 'right';
    uiCtx.fillText('NITRO', W - 30, H - 70);
    
    const nitroW = 160;
    uiCtx.fillStyle = '#333';
    uiCtx.fillRect(W - 190, H - 50, nitroW, 20);
    uiCtx.fillStyle = '#ff0';
    uiCtx.fillRect(W - 190, H - 50, nitroW * (playerNitro / 100), 20);

    // Lap info
    uiCtx.fillStyle = 'rgba(0,0,0,0.7)';
    uiCtx.fillRect(W/2 - 150, 20, 300, 80);
    uiCtx.fillStyle = '#fff';
    uiCtx.font = 'bold 24px sans-serif';
    uiCtx.textAlign = 'center';
    uiCtx.fillText(`Lap ${currentLap} / ${totalLaps}`, W/2, 50);
    uiCtx.font = '18px monospace';
    uiCtx.fillText(`Time: ${lapTime.toFixed(2)}s`, W/2, 80);

    // Position
    if (selectedMode === 'race') {
      let position = 1;
      opponents.forEach(opp => {
        if (opp.z > playerPosition.z) position++;
      });
      uiCtx.fillStyle = '#ff0';
      uiCtx.font = 'bold 48px sans-serif';
      uiCtx.textAlign = 'right';
      uiCtx.fillText(`${position}${getOrdinal(position)}`, W - 30, 80);
    }

    // Touch controls (only on touch devices)
    if ('ontouchstart' in window) {
      drawTouchControls();
    }
  }

  function drawTouchControls() {
    const btnSize = 80;
    const gap = 10;
    
    // Left button
    uiCtx.fillStyle = touchLeft ? 'rgba(0,100,255,0.5)' : 'rgba(0,100,255,0.3)';
    uiCtx.fillRect(10, H - btnSize - 10, btnSize, btnSize);
    uiCtx.strokeStyle = '#00f';
    uiCtx.lineWidth = 3;
    uiCtx.strokeRect(10, H - btnSize - 10, btnSize, btnSize);
    uiCtx.fillStyle = '#fff';
    uiCtx.font = 'bold 40px sans-serif';
    uiCtx.textAlign = 'center';
    uiCtx.textBaseline = 'middle';
    uiCtx.fillText('◀', 10 + btnSize/2, H - btnSize/2 - 10);
    
    // Right button
    uiCtx.fillStyle = touchRight ? 'rgba(0,100,255,0.5)' : 'rgba(0,100,255,0.3)';
    uiCtx.fillRect(10 + btnSize + gap, H - btnSize - 10, btnSize, btnSize);
    uiCtx.strokeStyle = '#00f';
    uiCtx.strokeRect(10 + btnSize + gap, H - btnSize - 10, btnSize, btnSize);
    uiCtx.fillStyle = '#fff';
    uiCtx.fillText('▶', 10 + btnSize + gap + btnSize/2, H - btnSize/2 - 10);
    
    // Accel button
    uiCtx.fillStyle = touchAccel ? 'rgba(0,255,0,0.5)' : 'rgba(0,255,0,0.3)';
    uiCtx.fillRect(W - 2*btnSize - gap - 10, H - btnSize - 10, btnSize, btnSize);
    uiCtx.strokeStyle = '#0f0';
    uiCtx.strokeRect(W - 2*btnSize - gap - 10, H - btnSize - 10, btnSize, btnSize);
    uiCtx.fillStyle = '#fff';
    uiCtx.fillText('▲', W - 2*btnSize - gap - 10 + btnSize/2, H - btnSize/2 - 10);
    
    // Nitro button
    uiCtx.fillStyle = touchNitro ? 'rgba(255,200,0,0.5)' : 'rgba(255,200,0,0.3)';
    uiCtx.fillRect(W - btnSize - 10, H - btnSize - 10, btnSize, btnSize);
    uiCtx.strokeStyle = '#ff0';
    uiCtx.strokeRect(W - btnSize - 10, H - btnSize - 10, btnSize, btnSize);
    uiCtx.fillStyle = '#fff';
    uiCtx.font = 'bold 30px sans-serif';
    uiCtx.fillText('⚡', W - btnSize/2 - 10, H - btnSize/2 - 10);
    
    uiCtx.textBaseline = 'alphabetic';
  }

  function getOrdinal(n) {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return s[(v - 20) % 10] || s[v] || s[0];
  }

  function updateHUD() {
    document.getElementById('hud-score').textContent = `Score: ${score}`;
  }

  function endGame() {
    gameState = 'finished';
    Audio.stopMusic();
    GameManager.showEnd(score);
  }

  function destroy() {
    if (animId) cancelAnimationFrame(animId);
    window.removeEventListener('resize', onResize);
    if (uiCanvas) {
      uiCanvas.removeEventListener('click', handleUIClick);
      uiCanvas.removeEventListener('touchstart', handleTouchStart);
      uiCanvas.removeEventListener('touchend', handleTouchEnd);
      if (uiCanvas.parentElement) {
        uiCanvas.parentElement.removeChild(uiCanvas);
      }
    }
    
    // Dispose Three.js resources
    if (renderer) {
      renderer.dispose();
    }
    if (scene) {
      scene.traverse(obj => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) {
            obj.material.forEach(mat => mat.dispose());
          } else {
            obj.material.dispose();
          }
        }
      });
    }
    
    Audio.stopMusic();
  }

  return { init, destroy };
})();
