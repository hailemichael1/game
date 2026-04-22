/**
 * CyberRacer - Neon Megacity Anti-Gravity Racing Game
 * 
 * A futuristic racing game set in a sprawling neon-lit megacity
 * with anti-gravity bikes, combat, and dynamic track environments.
 */

const CyberRacer = (() => {
  let canvas, W, H;
  let DPR = 1;
  let animId = null;
  let lastTime = 0;

  // Three.js core
  let scene, camera, renderer;
  let clock;

  // Game state
  let gameState = 'menu'; // menu, story, racing, combat, paused, finished
  let selectedMode = null; // story, freeride, timetrial, race, arena
  let selectedTrack = null;
  let score = 0;
  let raceTime = 0;
  let lapTime = 0;
  let bestLap = Infinity;
  let currentLap = 1;
  let totalLaps = 3;

  // Story mode
  let storyProgress = 0;
  let corporationSecrets = [];
  let currentStoryChapter = 0;

  // Player
  let playerBike = null;
  let playerSpeed = 0;
  let playerMaxSpeed = 300;
  let playerAccel = 80;
  let playerBrake = 120;
  let playerTurn = 3.5;
  let playerNitro = 100;
  let playerShield = 100;
  let playerPosition = { x: 0, y: 2, z: 0 }; // y = hover height
  let playerRotation = 0;
  let playerTilt = 0;
  
  // Anti-gravity physics
  let hoverHeight = 2;
  let hoverOscillation = 0;
  let gravityDefy = 0;

  // Customization
  let bikeLoadout = {
    shield: 'basic',
    booster: 'standard',
    ai: 'basic',
  };

  // AI opponents
  let opponents = [];

  // Combat
  let weapons = [];
  let projectiles = [];
  let shieldActive = false;

  // Track - Dynamic megacity
  let track = null;
  let trackMesh = null;
  let buildings = [];
  let movingPlatforms = [];
  let collapsingStructures = [];
  let checkpoints = [];
  let currentCheckpoint = 0;
  let trackSegments = [];

  // Environment - Neon city
  let weather = 'clear';
  let timeOfDay = 0.8;
  let rainParticles = null;
  let neonLights = [];
  let holograms = [];

  // UI overlay context
  let uiCanvas, uiCtx;

  // Touch controls
  let touchLeft = false, touchRight = false, touchNitro = false, touchAccel = false, touchBrake = false, touchShield = false, touchWeapon = false;
  const TOUCH_UI = { btnSize: 70, gap: 8, margin: 15 };
  let tiltSteer = 0;
  let tiltReady = false;
  let deviceOrientationHandler = null;

  const TRACK_LENGTH = 1500;

  // ─────────────────────────────────────────────────────────────
  function init(c) {
    canvas = c;
    W = canvas.offsetWidth  || window.innerWidth;
    H = canvas.offsetHeight || (window.innerHeight - 50);
    
    // Create UI overlay canvas
    uiCanvas = document.createElement('canvas');
    uiCanvas.style.position = 'fixed';
    uiCanvas.style.top = '0px';
    uiCanvas.style.left = '0px';
    uiCanvas.style.touchAction = 'none';
    uiCanvas.style.zIndex = '100';
    canvas.parentElement.appendChild(uiCanvas);
    uiCtx = uiCanvas.getContext('2d');
    
    uiCanvas.addEventListener('click', handleUIClick);
    uiCanvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    uiCanvas.addEventListener('touchend', handleTouchEnd, { passive: false });
    uiCanvas.addEventListener('touchmove', handleTouchMove, { passive: false });

    initThree();
    Input.attachTouch();
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);

    syncViewportSize();
    
    reset();
    Audio.startMusic('cyber');
    
    clock = new THREE.Clock();
    lastTime = performance.now();
    animId = requestAnimationFrame(loop);
  }

  function initThree() {
    // Scene - Dark cyberpunk atmosphere
    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x0a0a1a, 50, 800);

    // Camera - Third person chase cam
    camera = new THREE.PerspectiveCamera(80, W / H, 0.1, 3000);
    camera.position.set(0, 5, -12);
    camera.lookAt(0, 2, 0);

    // Renderer - Neon glow effects
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(W, H, false);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    // Lights - Neon city lighting
    const ambientLight = new THREE.AmbientLight(0x1a1a2e, 0.4);
    scene.add(ambientLight);

    // Multiple colored point lights for neon effect
    const neonColors = [0xff00ff, 0x00ffff, 0xff3366, 0x33ff66];
    neonColors.forEach((color, i) => {
      const light = new THREE.PointLight(color, 2, 200);
      light.position.set(
        (Math.random() - 0.5) * 100,
        20 + Math.random() * 30,
        Math.random() * 500
      );
      scene.add(light);
    });

    const dirLight = new THREE.DirectionalLight(0x6666ff, 0.3);
    dirLight.position.set(50, 100, 50);
    dirLight.castShadow = true;
    dirLight.shadow.camera.left = -100;
    dirLight.shadow.camera.right = 100;
    dirLight.shadow.camera.top = 100;
    dirLight.shadow.camera.bottom = -100;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    scene.add(dirLight);

    // Sky - Dark with stars
    scene.background = new THREE.Color(0x050510);
  }

  function onResize() {
    syncViewportSize();
  }

  function syncViewportSize() {
    if (!canvas || !renderer || !camera || !uiCanvas) return;
    const r = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.floor(r.width || canvas.offsetWidth || window.innerWidth));
    const h = Math.max(1, Math.floor(r.height || canvas.offsetHeight || (window.innerHeight - 50)));

    W = w;
    H = h;
    DPR = Math.min(window.devicePixelRatio || 1, 2);

    // Keep overlay aligned with the canvas (HUD height can change on mobile).
    uiCanvas.style.left = `${Math.floor(r.left)}px`;
    uiCanvas.style.top = `${Math.floor(r.top)}px`;
    uiCanvas.style.width = `${W}px`;
    uiCanvas.style.height = `${H}px`;

    uiCanvas.width = Math.floor(W * DPR);
    uiCanvas.height = Math.floor(H * DPR);
    uiCtx.setTransform(DPR, 0, 0, DPR, 0, 0);

    renderer.setPixelRatio(DPR);
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
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
    playerShield = 100;
    playerPosition = { x: 0, y: hoverHeight, z: 0 };
    playerRotation = 0;
    playerTilt = 0;
    currentCheckpoint = 0;
    storyProgress = 0;
    corporationSecrets = [];
    
    while(scene.children.length > 0) { 
      const obj = scene.children[0];
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) {
          obj.material.forEach(m => m.dispose());
        } else {
          obj.material.dispose();
        }
      }
      scene.remove(obj);
    }
    
    buildings = [];
    movingPlatforms = [];
    collapsingStructures = [];
    neonLights = [];
    holograms = [];
    weapons = [];
    projectiles = [];
    
    const ambientLight = new THREE.AmbientLight(0x1a1a2e, 0.4);
    scene.add(ambientLight);
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
    if (gameState === 'racing' || gameState === 'combat') {
      updateRacing(dt);
      if (gameState === 'combat') {
        updateCombat(dt);
      }
    }
    Input.flush();
  }

  function handleUIClick(e) {
    if (gameState === 'menu') {
      handleMenuClick(e);
    } else if (gameState === 'story') {
      handleStoryClick(e);
    }
  }

  function handleMenuClick(e) {
    const rect = uiCanvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    
    const btnW = 220, btnH = 70, gap = 25;
    const startX = W/2 - (btnW * 2 + gap) / 2;
    const startY = H/2 - 50;
    
    const modes = [
      { key: 'story', name: 'STORY', desc: 'Uncover corporation secrets' },
      { key: 'freeride', name: 'FREE RIDE', desc: 'Explore the megacity' },
      { key: 'timetrial', name: 'TIME TRIAL', desc: 'Beat the clock' },
      { key: 'race', name: 'GRAND RACE', desc: 'Race AI opponents' },
      { key: 'arena', name: 'COMBAT ARENA', desc: 'Battle for supremacy' },
      { key: 'garage', name: 'GARAGE', desc: 'Customize your bike' },
    ];
    
    modes.forEach((mode, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = startX + col * (btnW + gap);
      const y = startY + row * (btnH + gap);
      
      if (mx > x && mx < x + btnW && my > y && my < y + btnH) {
        if (mode.key === 'garage') {
          openGarage();
        } else {
          selectedMode = mode.key;
          startGame();
          Audio.sfx.menuClick();
        }
      }
    });
  }

  function handleStoryClick(e) {
    const storyChapters = [
      { title: 'Chapter 1: The Escape', text: 'You wake up in the slums of Neo Tokyo. The mega-corporation NEXUS controls everything. Your mission: reach the top of the Spire and expose their secrets.' },
      { title: 'Chapter 2: First Contact', text: 'Meet the Resistance. They tell you about the anti-gravity technology that NEXUS is hiding. Race through the Industrial Zone to find the hidden lab.' },
      { title: 'Chapter 3: The Revelation', text: 'The lab reveals NEXUS plans to control gravity itself. You must race through the collapsing sectors to reach the main tower.' },
      { title: 'Chapter 4: Final Race', text: 'Confront the CEO of NEXUS in the ultimate race. The city collapses around you as you fight for freedom.' },
    ];
    
    if (currentStoryChapter < storyChapters.length) {
      currentStoryChapter++;
      if (currentStoryChapter >= storyChapters.length) {
        gameState = 'finished';
        score += 10000;
        corporationSecrets.push('FREEDOM');
      }
    }
  }

  function handleTouchStart(e) {
    e.preventDefault();
    maybeEnableTiltControls();

    // Allow menus/story to work on phones (tap behaves like click)
    if (gameState === 'menu') {
      const t = e.touches[0];
      handleMenuClick({ clientX: t.clientX, clientY: t.clientY });
      return;
    }
    if (gameState === 'story') {
      handleStoryClick({});
      return;
    }

    if (gameState !== 'racing' && gameState !== 'combat') return;
    updateTouchButtonsFromTouches(e.touches);
  }

  function handleTouchMove(e) {
    e.preventDefault();
    if (gameState !== 'racing' && gameState !== 'combat') return;
    updateTouchButtonsFromTouches(e.touches);
  }

  function handleTouchEnd(e) {
    e.preventDefault();
    if (gameState !== 'racing' && gameState !== 'combat') return;
    updateTouchButtonsFromTouches(e.touches);
  }

  function updateTouchButtonsFromTouches(touches) {
    touchLeft = false;
    touchRight = false;
    touchNitro = false;
    touchAccel = false;
    touchBrake = false;
    touchShield = false;

    const rect = uiCanvas.getBoundingClientRect();
    const { btnSize, gap, margin } = TOUCH_UI;
    const leftRect = { x1: margin, y1: H - btnSize - margin, x2: margin + btnSize, y2: H - margin };
    const rightRect = { x1: margin + btnSize + gap, y1: H - btnSize - margin, x2: margin + 2 * btnSize + gap, y2: H - margin };
    const accelRect = { x1: W - btnSize - margin, y1: H - btnSize - margin, x2: W - margin, y2: H - margin };
    const nitroRect = { x1: W - btnSize - margin, y1: H - 2 * btnSize - 25, x2: W - margin, y2: H - btnSize - 25 };
    const brakeRect = { x1: W - btnSize - margin, y1: H - 3 * btnSize - 35, x2: W - margin, y2: H - 2 * btnSize - 35 };
    const shieldRect = { x1: W / 2 - 100, y1: H - 120, x2: W / 2 + 100, y2: H - 60 };

    for (const touch of Array.from(touches || [])) {
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;

      if (x >= leftRect.x1 && x <= leftRect.x2 && y >= leftRect.y1 && y <= leftRect.y2) touchLeft = true;
      if (x >= rightRect.x1 && x <= rightRect.x2 && y >= rightRect.y1 && y <= rightRect.y2) touchRight = true;
      if (x >= accelRect.x1 && x <= accelRect.x2 && y >= accelRect.y1 && y <= accelRect.y2) touchAccel = true;
      if (x >= nitroRect.x1 && x <= nitroRect.x2 && y >= nitroRect.y1 && y <= nitroRect.y2) touchNitro = true;
      if (x >= brakeRect.x1 && x <= brakeRect.x2 && y >= brakeRect.y1 && y <= brakeRect.y2) touchBrake = true;
      if (gameState === 'combat' && x >= shieldRect.x1 && x <= shieldRect.x2 && y >= shieldRect.y1 && y <= shieldRect.y2) touchShield = true;
    }
  }

  function maybeEnableTiltControls() {
    if (tiltReady) return;
    if (!('DeviceOrientationEvent' in window)) return;

    const attach = () => {
      deviceOrientationHandler = e => {
        const g = typeof e.gamma === 'number' ? e.gamma : 0;
        const clamped = Math.max(-35, Math.min(35, g));
        tiltSteer = clamped / 35; // -1..1
      };
      window.addEventListener('deviceorientation', deviceOrientationHandler, { passive: true });
      tiltReady = true;
    };

    // iOS requires explicit permission.
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      DeviceOrientationEvent.requestPermission().then(res => {
        if (res === 'granted') attach();
      }).catch(() => { /* ignore */ });
      return;
    }

    attach();
  }

  function startGame() {
    if (selectedMode === 'story') {
      gameState = 'story';
      currentStoryChapter = 0;
      buildMegacityTrack();
    } else if (selectedMode === 'garage') {
      openGarage();
      return;
    } else if (selectedMode === 'arena') {
      gameState = 'combat';
      buildMegacityTrack();
      createPlayerBike(true);
      createCombatOpponents();
    } else {
      gameState = 'racing';
      buildMegacityTrack();
      createPlayerBike(false);
      createOpponents();
    }
    
    raceTime = 0;
    lapTime = 0;
    currentLap = 1;
  }

  function openGarage() {
    gameState = 'garage';
    drawUI();
  }

  // ── Track Building - Megacity ─────────────────────────────────
  function buildMegacityTrack() {
    // Ground - Neon grid
    const groundGeo = new THREE.PlaneGeometry(300, 3000);
    const groundMat = new THREE.MeshStandardMaterial({ 
      color: 0x0a0a15,
      emissive: 0x001133,
      emissiveIntensity: 0.3,
      roughness: 0.9 
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Neon grid lines
    for (let i = -15; i <= 15; i++) {
      const lineGeo = new THREE.BoxGeometry(0.1, 0.05, 3000);
      const lineMat = new THREE.MeshStandardMaterial({ 
        color: 0x00ffff,
        emissive: 0x00ffff,
        emissiveIntensity: 0.8
      });
      const line = new THREE.Mesh(lineGeo, lineMat);
      line.position.set(i * 10, 0.03, 0);
      scene.add(line);
      neonLights.push(line);
    }
    
    for (let i = -150; i <= 150; i += 10) {
      const lineGeo = new THREE.BoxGeometry(300, 0.05, 0.1);
      const lineMat = new THREE.MeshStandardMaterial({ 
        color: 0xff00ff,
        emissive: 0xff00ff,
        emissiveIntensity: 0.5
      });
      const line = new THREE.Mesh(lineGeo, lineMat);
      line.position.set(0, 0.03, i);
      scene.add(line);
    }

    // Road - Anti-gravity lane
    const roadGeo = new THREE.PlaneGeometry(25, 3000);
    const roadMat = new THREE.MeshStandardMaterial({ 
      color: 0x1a1a2e,
      emissive: 0x110022,
      emissiveIntensity: 0.2,
      roughness: 0.5 
    });
    trackMesh = new THREE.Mesh(roadGeo, roadMat);
    trackMesh.rotation.x = -Math.PI / 2;
    trackMesh.position.y = 0.1;
    trackMesh.receiveShadow = true;
    scene.add(trackMesh);

    // Lane markings - glowing
    for (let i = 0; i < 150; i++) {
      const lineGeo = new THREE.BoxGeometry(0.3, 0.05, 8);
      const lineMat = new THREE.MeshStandardMaterial({ 
        color: 0x00ff88,
        emissive: 0x00ff88,
        emissiveIntensity: 1
      });
      const line = new THREE.Mesh(lineGeo, lineMat);
      line.position.set(0, 0.12, i * 20 - 1500);
      scene.add(line);
    }

    buildMegacity();
    buildMovingPlatforms();

    // Checkpoints - Glowing arches
    checkpoints = [];
    for (let i = 0; i < 12; i++) {
      const cpZ = i * 250;
      checkpoints.push({ z: cpZ });
      
      const archGroup = new THREE.Group();
      
      const pillarGeo = new THREE.BoxGeometry(1, 15, 1);
      const pillarMat = new THREE.MeshStandardMaterial({
        color: 0xff00ff,
        emissive: 0xff00ff,
        emissiveIntensity: 0.8
      });
      
      const leftPillar = new THREE.Mesh(pillarGeo, pillarMat);
      leftPillar.position.set(-15, 7.5, cpZ);
      scene.add(leftPillar);
      
      const rightPillar = new THREE.Mesh(pillarGeo, pillarMat);
      rightPillar.position.set(15, 7.5, cpZ);
      scene.add(rightPillar);
      
      const topGeo = new THREE.BoxGeometry(31, 1, 1);
      const top = new THREE.Mesh(topGeo, pillarMat);
      top.position.set(0, 15, cpZ);
      scene.add(top);
      
      createHologram('CHECKPOINT ' + (i + 1), 0, 12, cpZ);
    }
  }

  function buildMegacity() {
    const buildingColors = [0x00ffff, 0xff00ff, 0xff3366, 0x33ff66, 0xffff00, 0x6666ff];
    
    for (let i = 0; i < 80; i++) {
      const height = 30 + Math.random() * 70;
      const width = 8 + Math.random() * 15;
      const depth = 8 + Math.random() * 15;
      
      const buildingGeo = new THREE.BoxGeometry(width, height, depth);
      const color = buildingColors[Math.floor(Math.random() * buildingColors.length)];
      const buildingMat = new THREE.MeshStandardMaterial({ 
        color: 0x0a0a15,
        emissive: color,
        emissiveIntensity: 0.3 + Math.random() * 0.4
      });
      
      const building = new THREE.Mesh(buildingGeo, buildingMat);
      const side = -1;
      building.position.set(
        side * (20 + width/2 + Math.random() * 20),
        height/2,
        Math.random() * 3000 - 1500
      );
      building.castShadow = true;
      scene.add(building);
      buildings.push({ mesh: building, height });
      
      addNeonStrips(building, width, height, depth, color);
    }
    
    for (let i = 0; i < 80; i++) {
      const height = 30 + Math.random() * 70;
      const width = 8 + Math.random() * 15;
      const depth = 8 + Math.random() * 15;
      
      const buildingGeo = new THREE.BoxGeometry(width, height, depth);
      const color = buildingColors[Math.floor(Math.random() * buildingColors.length)];
      const buildingMat = new THREE.MeshStandardMaterial({ 
        color: 0x0a0a15,
        emissive: color,
        emissiveIntensity: 0.3 + Math.random() * 0.4
      });
      
      const building = new THREE.Mesh(buildingGeo, buildingMat);
      const side = 1;
      building.position.set(
        side * (20 + width/2 + Math.random() * 20),
        height/2,
        Math.random() * 3000 - 1500
      );
      building.castShadow = true;
      scene.add(building);
      buildings.push({ mesh: building, height });
      
      addNeonStrips(building, width, height, depth, color);
    }
    
    // Floating holographic billboards
    for (let i = 0; i < 20; i++) {
      const billboardGeo = new THREE.PlaneGeometry(20, 10);
      const billboardMat = new THREE.MeshStandardMaterial({
        color: buildingColors[Math.floor(Math.random() * buildingColors.length)],
        emissive: buildingColors[Math.floor(Math.random() * buildingColors.length)],
        emissiveIntensity: 0.8,
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide
      });
      
      const billboard = new THREE.Mesh(billboardGeo, billboardMat);
      billboard.position.set(
        (Math.random() - 0.5) * 60,
        25 + Math.random() * 30,
        Math.random() * 2500 - 1250
      );
      billboard.rotation.y = Math.random() * Math.PI;
      scene.add(billboard);
      holograms.push(billboard);
    }
  }

  function addNeonStrips(building, width, height, depth, color) {
    for (let j = 0; j < 3; j++) {
      const stripGeo = new THREE.BoxGeometry(0.2, height, 0.2);
      const stripMat = new THREE.MeshStandardMaterial({
        color: color,
        emissive: color,
        emissiveIntensity: 1
      });
      const strip = new THREE.Mesh(stripGeo, stripMat);
      strip.position.set(
        building.position.x + (Math.random() - 0.5) * width * 0.8,
        height/2,
        building.position.z + (Math.random() - 0.5) * depth * 0.8
      );
      scene.add(strip);
      neonLights.push(strip);
    }
  }

  function buildMovingPlatforms() {
    for (let i = 0; i < 5; i++) {
      const platformGeo = new THREE.BoxGeometry(30, 2, 40);
      const platformMat = new THREE.MeshStandardMaterial({
        color: 0x222244,
        emissive: 0x4444ff,
        emissiveIntensity: 0.4
      });
      
      const platform = new THREE.Mesh(platformGeo, platformMat);
      platform.position.set(
        (Math.random() - 0.5) * 10,
        5 + Math.random() * 3,
        i * 500 - 1000
      );
      scene.add(platform);
      
      movingPlatforms.push({
        mesh: platform,
        baseY: platform.position.y,
        speed: 0.5 + Math.random() * 0.5,
        phase: Math.random() * Math.PI * 2
      });
    }
  }

  function createHologram(text, x, y, z) {
    const holoGeo = new THREE.BoxGeometry(2, 2, 2);
    const holoMat = new THREE.MeshStandardMaterial({
      color: 0x00ffff,
      emissive: 0x00ffff,
      emissiveIntensity: 1,
      transparent: true,
      opacity: 0.5
    });
    const holo = new THREE.Mesh(holoGeo, holoMat);
    holo.position.set(x, y, z);
    scene.add(holo);
    holograms.push(holo);
  }

  // ── Bike Creation - Anti-Gravity ───────────────────────────────
  function createPlayerBike(isCombat) {
    const bikeGroup = new THREE.Group();
    
    // Main body - Sleek futuristic design
    const bodyGeo = new THREE.BoxGeometry(1.2, 0.6, 3.5);
    const bodyMat = new THREE.MeshStandardMaterial({ 
      color: 0x1a1a2e,
      emissive: 0x00ffff,
      emissiveIntensity: 0.5
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.8;
    body.castShadow = true;
    bikeGroup.add(body);
    
    // Front nose
    const noseGeo = new THREE.BoxGeometry(0.8, 0.4, 1.5);
    const nose = new THREE.Mesh(noseGeo, bodyMat);
    nose.position.set(0, 0.6, 2);
    nose.rotation.x = -0.3;
    bikeGroup.add(nose);
    
    // Anti-gravity pods (hover engines)
    const podGeo = new THREE.CylinderGeometry(0.3, 0.4, 0.8, 8);
    const podMat = new THREE.MeshStandardMaterial({
      color: 0x00ff88,
      emissive: 0x00ff88,
      emissiveIntensity: 0.8
    });
    
    const leftPod = new THREE.Mesh(podGeo, podMat);
    leftPod.position.set(-0.8, 0.3, 0);
    bikeGroup.add(leftPod);
    
    const rightPod = new THREE.Mesh(podGeo, podMat);
    rightPod.position.set(0.8, 0.3, 0);
    bikeGroup.add(rightPod);
    
    // Rear thruster
    const thrusterGeo = new THREE.ConeGeometry(0.5, 1.5, 8);
    const thrusterMat = new THREE.MeshStandardMaterial({
      color: 0xff00ff,
      emissive: 0xff00ff,
      emissiveIntensity: 1
    });
    const thruster = new THREE.Mesh(thrusterGeo, thrusterMat);
    thruster.position.set(0, 0.8, -2);
    thruster.rotation.x = Math.PI / 2;
    bikeGroup.add(thruster);
    
    // Rider - Futuristic leathers
    const riderGeo = new THREE.BoxGeometry(0.6, 1.2, 0.6);
    const riderMat = new THREE.MeshStandardMaterial({ 
      color: 0x222233,
      emissive: 0x6666ff,
      emissiveIntensity: 0.3
    });
    const rider = new THREE.Mesh(riderGeo, riderMat);
    rider.position.set(0, 1.8, 0);
    rider.castShadow = true;
    bikeGroup.add(rider);
    
    // Helmet with visor
    const helmetGeo = new THREE.SphereGeometry(0.35, 16, 16);
    const helmetMat = new THREE.MeshStandardMaterial({
      color: 0x00ffff,
      emissive: 0x00ffff,
      emissiveIntensity: 0.6
    });
    const helmet = new THREE.Mesh(helmetGeo, helmetMat);
    helmet.position.set(0, 2.6, 0);
    bikeGroup.add(helmet);
    
    // Visor
    const visorGeo = new THREE.BoxGeometry(0.5, 0.15, 0.3);
    const visorMat = new THREE.MeshStandardMaterial({
      color: 0xff00ff,
      emissive: 0xff00ff,
      emissiveIntensity: 1
    });
    const visor = new THREE.Mesh(visorGeo, visorMat);
    visor.position.set(0, 2.6, 0.25);
    bikeGroup.add(visor);
    
    // Combat mode - Add weapons
    if (isCombat) {
      const weaponGeo = new THREE.BoxGeometry(0.3, 0.3, 2);
      const weaponMat = new THREE.MeshStandardMaterial({
        color: 0xff3366,
        emissive: 0xff3366,
        emissiveIntensity: 0.8
      });
      
      const leftWeapon = new THREE.Mesh(weaponGeo, weaponMat);
      leftWeapon.position.set(-1.5, 0.8, 0);
      bikeGroup.add(leftWeapon);
      
      const rightWeapon = new THREE.Mesh(weaponGeo, weaponMat);
      rightWeapon.position.set(1.5, 0.8, 0);
      bikeGroup.add(rightWeapon);
      
      // Shield bubble
      const shieldGeo = new THREE.SphereGeometry(2.5, 16, 16);
      const shieldMat = new THREE.MeshStandardMaterial({
        color: 0x00ff00,
        emissive: 0x00ff00,
        emissiveIntensity: 0.5,
        transparent: true,
        opacity: 0.2,
        side: THREE.DoubleSide
      });
      const shield = new THREE.Mesh(shieldGeo, shieldMat);
      shield.position.set(0, 1, 0);
      shield.visible = false;
      bikeGroup.add(shield);
      bikeGroup.userData.shield = shield;
    }
    
    bikeGroup.position.set(0, hoverHeight, 0);
    scene.add(bikeGroup);
    playerBike = bikeGroup;
  }

  function createOpponents() {
    opponents = [];
    const opponentColors = [0x00ff00, 0x0000ff, 0xffff00, 0xff6600];
    const opponentNames = ['NEXUS-7', 'PHANTOM', 'VORTEX', 'STORM'];
    
    const count = selectedMode === 'race' ? 4 : (selectedMode === 'freeride' ? 2 : 1);
    for (let i = 0; i < count; i++) {
      const bikeGroup = new THREE.Group();
      
      const bodyGeo = new THREE.BoxGeometry(1.2, 0.6, 3.5);
      const bodyMat = new THREE.MeshStandardMaterial({ 
        color: 0x1a1a2e,
        emissive: opponentColors[i],
        emissiveIntensity: 0.5
      });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.y = 0.8;
      body.castShadow = true;
      bikeGroup.add(body);
      
      const podGeo = new THREE.CylinderGeometry(0.3, 0.4, 0.8, 8);
      const podMat = new THREE.MeshStandardMaterial({
        color: opponentColors[i],
        emissive: opponentColors[i],
        emissiveIntensity: 0.8
      });
      
      const leftPod = new THREE.Mesh(podGeo, podMat);
      leftPod.position.set(-0.8, 0.3, 0);
      bikeGroup.add(leftPod);
      
      const rightPod = new THREE.Mesh(podGeo, podMat);
      rightPod.position.set(0.8, 0.3, 0);
      bikeGroup.add(rightPod);
      
      const thrusterGeo = new THREE.ConeGeometry(0.5, 1.5, 8);
      const thrusterMat = new THREE.MeshStandardMaterial({
        color: opponentColors[i],
        emissive: opponentColors[i],
        emissiveIntensity: 1
      });
      const thruster = new THREE.Mesh(thrusterGeo, thrusterMat);
      thruster.position.set(0, 0.8, -2);
      thruster.rotation.x = Math.PI / 2;
      bikeGroup.add(thruster);
      
      bikeGroup.position.set((i - (count - 1) / 2) * 5, hoverHeight, 30 + i * 15);
      scene.add(bikeGroup);
      
      opponents.push({
        mesh: bikeGroup,
        baseSpeed: 110 + Math.random() * 55,
        speed: 0,
        x: (i - (count - 1) / 2) * 5,
        z: 30 + i * 15,
        lap: 1,
        name: opponentNames[i] || `RIVAL-${i + 1}`,
        targetLaneX: (i - (count - 1) / 2) * 6,
        aggression: 0.6 + Math.random() * 0.6,
      });
    }
  }

  function createCombatOpponents() {
    opponents = [];
    
    for (let i = 0; i < 3; i++) {
      const bikeGroup = new THREE.Group();
      
      const bodyGeo = new THREE.BoxGeometry(1.2, 0.6, 3.5);
      const bodyMat = new THREE.MeshStandardMaterial({ 
        color: 0x330000,
        emissive: 0xff0000,
        emissiveIntensity: 0.6
      });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.y = 0.8;
      body.castShadow = true;
      bikeGroup.add(body);
      
      const spikeGeo = new THREE.ConeGeometry(0.2, 1, 4);
      const spikeMat = new THREE.MeshStandardMaterial({
        color: 0xff0000,
        emissive: 0xff0000,
        emissiveIntensity: 1
      });
      
      const spike = new THREE.Mesh(spikeGeo, spikeMat);
      spike.position.set(0, 1.5, 0);
      bikeGroup.add(spike);
      
      bikeGroup.position.set((i - 1) * 6, hoverHeight, 50 + i * 20);
      scene.add(bikeGroup);
      
      opponents.push({
        mesh: bikeGroup,
        speed: 90 + Math.random() * 50,
        x: (i - 1) * 6,
        z: 50 + i * 20,
        health: 100
      });
    }
  }

  // ── Racing Update ─────────────────────────────────────────────
  function updateRacing(dt) {
    raceTime += dt;
    lapTime += dt;

    // Anti-gravity hover oscillation
    hoverOscillation += dt * 3;
    const hoverOffset = Math.sin(hoverOscillation) * 0.1;

    // Input
    const left  = Input.isDown('ArrowLeft')  || Input.isDown('KeyA') || touchLeft || tiltSteer < -0.25;
    const right = Input.isDown('ArrowRight') || Input.isDown('KeyD') || touchRight || tiltSteer > 0.25;
    const up    = Input.isDown('ArrowUp')    || Input.isDown('KeyW') || touchAccel;
    const down  = Input.isDown('ArrowDown')  || Input.isDown('KeyS') || touchBrake;
    const nitro = Input.isDown('ShiftLeft')  || Input.isDown('ShiftRight') || touchNitro;
    const shield = Input.isDown('KeyE') || touchShield;

    // Acceleration with anti-gravity physics
    if (up) {
      playerSpeed += playerAccel * dt;
      gravityDefy = Math.min(1, gravityDefy + dt * 2);
    } else {
      playerSpeed -= playerAccel * 0.3 * dt;
      gravityDefy = Math.max(0, gravityDefy - dt);
    }

    if (down) {
      playerSpeed -= playerBrake * dt;
    }

    // Nitro boost
    if (nitro && playerNitro > 0) {
      playerSpeed += 150 * dt;
      playerNitro -= 30 * dt;
      Audio.sfx.jump();
      playerPosition.y = hoverHeight + 0.5;
    } else {
      playerNitro = Math.min(100, playerNitro + 8 * dt);
      playerPosition.y = hoverHeight + hoverOffset + gravityDefy * 0.3;
    }

    // Clamp speed
    playerSpeed = Math.max(0, Math.min(playerMaxSpeed, playerSpeed));

    // Steering with tilt
    if (left) {
      playerRotation += playerTurn * dt;
      playerPosition.x -= playerSpeed * 0.025 * dt;
      playerTilt = Math.max(-0.4, playerTilt - dt * 2);
    }
    if (right) {
      playerRotation -= playerTurn * dt;
      playerPosition.x += playerSpeed * 0.025 * dt;
      playerTilt = Math.min(0.4, playerTilt + dt * 2);
    }
    
    if (!left && !right) {
      playerTilt *= 0.9;
    }

    // Clamp X position
    playerPosition.x = Math.max(-12, Math.min(12, playerPosition.x));

    // Move forward
    playerPosition.z += playerSpeed * dt;

    // Update bike
    if (playerBike) {
      playerBike.position.set(playerPosition.x, playerPosition.y, playerPosition.z);
      playerBike.rotation.y = playerRotation;
      playerBike.rotation.z = playerTilt;
      playerBike.rotation.x = -playerSpeed * 0.001;
    }

    // Camera - Dynamic chase
    const camOffset = 10 + playerSpeed * 0.02;
    camera.position.x = playerPosition.x * 0.7;
    camera.position.z = playerPosition.z - camOffset;
    camera.position.y = 4 + playerSpeed * 0.01;
    camera.lookAt(playerPosition.x, playerPosition.y + 1, playerPosition.z + 8);

    // Update moving platforms
    movingPlatforms.forEach(platform => {
      platform.phase += dt * platform.speed;
      platform.mesh.position.y = platform.baseY + Math.sin(platform.phase) * 2;
      platform.mesh.position.x = Math.sin(platform.phase * 0.5) * 5;
    });

    // Update opponents (simple lane AI + catch-up)
    const playerDistance = (currentLap - 1) * TRACK_LENGTH + playerPosition.z;
    opponents.forEach(opp => {
      const oppDistance = (opp.lap - 1) * TRACK_LENGTH + opp.z;
      const behind = playerDistance - oppDistance;

      const desired = (opp.baseSpeed || 120)
        + Math.max(-40, Math.min(60, behind * 0.08))
        + (selectedMode === 'race' ? 30 : 0);
      opp.speed += (desired - opp.speed) * (0.8 * dt);
      opp.speed = Math.max(60, Math.min(240, opp.speed));

      // Lane changes around the player to create overtakes.
      if (Math.abs(behind) < 80 && Math.random() < (opp.aggression || 0.9) * dt * 0.7) {
        const dir = (playerPosition.x > opp.mesh.position.x) ? -1 : 1;
        opp.targetLaneX = Math.max(-12, Math.min(12, (opp.targetLaneX ?? opp.mesh.position.x) + dir * (4 + Math.random() * 4)));
      }

      const wobble = Math.sin(raceTime * (0.9 + (opp.aggression || 0.9)) + opp.z * 0.02) * 1.2;
      const targetX = (opp.targetLaneX ?? opp.mesh.position.x) + wobble;
      const currentX = opp.mesh.position.x;
      const steer = (targetX - currentX) * 2.2 * dt;

      opp.mesh.position.x += steer;
      opp.z += opp.speed * dt;

      // Wrap track for laps (keeps race position sane)
      if (opp.z > TRACK_LENGTH) {
        opp.z -= TRACK_LENGTH;
        opp.lap = (opp.lap || 1) + 1;
      }

      opp.mesh.position.z = opp.z;
      opp.mesh.rotation.y = -steer * 2;
    });

    // Check checkpoints
    if (currentCheckpoint < checkpoints.length) {
      const cp = checkpoints[currentCheckpoint];
      if (playerPosition.z > cp.z) {
        currentCheckpoint++;
        score += 250;
        Audio.sfx.coin();
        
        if (selectedMode === 'story' && currentCheckpoint === 3) {
          corporationSecrets.push('NEXUS CONTROLS GRAVITY');
        }
        if (selectedMode === 'story' && currentCheckpoint === 6) {
          corporationSecrets.push('THE SPIRE IS A WEAPON');
        }
      }
    }

    // Lap completion
    if (playerPosition.z > TRACK_LENGTH) {
      if (lapTime < bestLap) bestLap = lapTime;
      currentLap++;
      lapTime = 0;
      playerPosition.z -= TRACK_LENGTH;
      currentCheckpoint = 0;
      
      if (currentLap > totalLaps) {
        endGame();
      } else {
        Audio.sfx.levelUp();
      }
    }

    // Bike-to-bike bump collisions
    for (const opp of opponents) {
      const dx = opp.mesh.position.x - playerPosition.x;
      const dz = opp.mesh.position.z - playerPosition.z;
      if (Math.abs(dx) < 1.8 && Math.abs(dz) < 3.2) {
        const push = dx >= 0 ? -1 : 1;
        playerPosition.x = Math.max(-12, Math.min(12, playerPosition.x + push * 0.9));
        opp.mesh.position.x = Math.max(-12, Math.min(12, opp.mesh.position.x - push * 0.6));
        playerSpeed = Math.max(0, playerSpeed - 35);
        Audio.sfx.hit();
      }
    }

    // Animate holograms
    holograms.forEach((holo, i) => {
      holo.position.y += Math.sin(raceTime * 2 + i) * 0.01;
      holo.rotation.y += dt * 0.5;
    });

    updateHUD();
  }

  // ── Combat Update ─────────────────────────────────────────────
  function updateCombat(dt) {
    if (playerBike && playerBike.userData.shield) {
      const shield = playerBike.userData.shield;
      if (touchShield && playerShield > 0) {
        shield.visible = true;
        playerShield -= 20 * dt;
      } else {
        shield.visible = false;
        playerShield = Math.min(100, playerShield + 5 * dt);
      }
    }
    
    opponents.forEach(opp => {
      const dx = playerPosition.x - opp.mesh.position.x;
      opp.mesh.position.x += dx * 0.5 * dt;
      opp.z = Math.max(opp.z, playerPosition.z - 20 + Math.sin(raceTime) * 10);
      opp.z += opp.speed * 0.8 * dt;
    });
  }

  // ── Render ────────────────────────────────────────────────────
  function render() {
    renderer.render(scene, camera);
  }

  // ── UI Overlay ────────────────────────────────────────────────
  function drawUI() {
    uiCtx.setTransform(DPR, 0, 0, DPR, 0, 0);
    uiCtx.clearRect(0, 0, W, H);

    if (gameState === 'menu') {
      drawMainMenu();
    } else if (gameState === 'story') {
      drawStoryScreen();
    } else if (gameState === 'garage') {
      drawGarage();
    } else if (gameState === 'racing' || gameState === 'combat') {
      drawRacingUI();
    } else if (gameState === 'finished') {
      drawEndScreen();
    }
  }

  function drawMainMenu() {
    // Cyberpunk background
    const gradient = uiCtx.createLinearGradient(0, 0, 0, H);
    gradient.addColorStop(0, '#0a0a1a');
    gradient.addColorStop(0.5, '#1a0a2e');
    gradient.addColorStop(1, '#0a1a2a');
    uiCtx.fillStyle = gradient;
    uiCtx.fillRect(0, 0, W, H);
    
    // Scanlines
    uiCtx.fillStyle = 'rgba(0,255,255,0.03)';
    for (let i = 0; i < H; i += 4) {
      uiCtx.fillRect(0, i, W, 2);
    }
    
    // Title
    uiCtx.fillStyle = '#00ffff';
    uiCtx.font = 'bold 64px "Orbitron", sans-serif';
    uiCtx.textAlign = 'center';
    uiCtx.shadowColor = '#00ffff';
    uiCtx.shadowBlur = 30;
    uiCtx.fillText('CYBER RACER', W/2, H/6);
    uiCtx.shadowBlur = 0;
    
    uiCtx.fillStyle = '#ff00ff';
    uiCtx.font = '24px "Orbitron", sans-serif';
    uiCtx.fillText('NEON MEGACITY', W/2, H/6 + 40);
    
    uiCtx.fillStyle = '#888';
    uiCtx.font = '18px sans-serif';
    uiCtx.fillText('Anti-Gravity Racing • Combat • Story', W/2, H/6 + 80);

    // Menu buttons
    const btnW = 220, btnH = 70, gap = 25;
    const startX = W/2 - (btnW * 2 + gap) / 2;
    const startY = H/2 - 50;
    
    const modes = [
      { key: 'story', name: 'STORY', desc: 'Uncover NEXUS secrets', color: '#ff00ff' },
      { key: 'freeride', name: 'FREE RIDE', desc: 'Explore megacity', color: '#00ffff' },
      { key: 'timetrial', name: 'TIME TRIAL', desc: 'Beat the clock', color: '#33ff66' },
      { key: 'race', name: 'GRAND RACE', desc: 'Race AI opponents', color: '#ffff00' },
      { key: 'arena', name: 'COMBAT ARENA', desc: 'Battle for supremacy', color: '#ff3366' },
      { key: 'garage', name: 'GARAGE', desc: 'Customize your bike', color: '#6666ff' },
    ];
    
    modes.forEach((mode, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = startX + col * (btnW + gap);
      const y = startY + row * (btnH + gap);
      
      uiCtx.fillStyle = 'rgba(10,10,30,0.8)';
      uiCtx.fillRect(x, y, btnW, btnH);
      
      uiCtx.strokeStyle = mode.color;
      uiCtx.lineWidth = 2;
      uiCtx.strokeRect(x, y, btnW, btnH);
      
      uiCtx.shadowColor = mode.color;
      uiCtx.shadowBlur = 10;
      uiCtx.strokeRect(x, y, btnW, btnH);
      uiCtx.shadowBlur = 0;
      
      uiCtx.fillStyle = mode.color;
      uiCtx.font = 'bold 20px "Orbitron", sans-serif';
      uiCtx.fillText(mode.name, x + btnW/2, y + 30);
      
      uiCtx.fillStyle = '#888';
      uiCtx.font = '12px sans-serif';
      uiCtx.fillText(mode.desc, x + btnW/2, y + 55);
    });
    
    uiCtx.fillStyle = '#666';
    uiCtx.font = '14px sans-serif';
    uiCtx.fillText('Controls: Arrow Keys/WASD to drive • Shift for Nitro • E for Shield', W/2, H - 30);
  }

  function drawStoryScreen() {
    uiCtx.fillStyle = 'rgba(0,0,0,0.85)';
    uiCtx.fillRect(0, 0, W, H);
    
    const storyChapters = [
      { title: 'Chapter 1: The Escape', text: 'You wake up in the slums of Neo Tokyo. The mega-corporation NEXUS controls everything. Your mission: reach the top of the Spire and expose their secrets.' },
      { title: 'Chapter 2: First Contact', text: 'Meet the Resistance. They tell you about the anti-gravity technology that NEXUS is hiding. Race through the Industrial Zone to find the hidden lab.' },
      { title: 'Chapter 3: The Revelation', text: 'The lab reveals NEXUS plans to control gravity itself. You must race through the collapsing sectors to reach the main tower.' },
      { title: 'Chapter 4: Final Race', text: 'Confront the CEO of NEXUS in the ultimate race. The city collapses around you as you fight for freedom.' },
    ];
    
    const chapter = storyChapters[currentStoryChapter] || storyChapters[0];
    
    uiCtx.fillStyle = '#ff00ff';
    uiCtx.font = 'bold 36px "Orbitron", sans-serif';
    uiCtx.textAlign = 'center';
    uiCtx.fillText(chapter.title, W/2, H/4);
    
    uiCtx.fillStyle = '#fff';
    uiCtx.font = '20px sans-serif';
    uiCtx.fillText(chapter.text, W/2, H/2, W - 100);
    
    const btnW = 200, btnH = 50;
    uiCtx.fillStyle = '#00ffff';
    uiCtx.fillRect(W/2 - btnW/2, H - 150, btnW, btnH);
    uiCtx.fillStyle = '#000';
    uiCtx.font = 'bold 18px "Orbitron", sans-serif';
    uiCtx.fillText('CONTINUE', W/2, H - 115);
    
    if (corporationSecrets.length > 0) {
      uiCtx.fillStyle = '#ff3366';
      uiCtx.font = '16px sans-serif';
      uiCtx.textAlign = 'left';
      uiCtx.fillText('SECRETS DISCOVERED:', 50, 50);
      corporationSecrets.forEach((secret, i) => {
        uiCtx.fillText('• ' + secret, 50, 80 + i * 25);
      });
    }
  }

  function drawGarage() {
    uiCtx.fillStyle = 'rgba(0,0,0,0.9)';
    uiCtx.fillRect(0, 0, W, H);
    
    uiCtx.fillStyle = '#00ffff';
    uiCtx.font = 'bold 48px "Orbitron", sans-serif';
    uiCtx.textAlign = 'center';
    uiCtx.fillText('BIKE GARAGE', W/2, 80);
    
    uiCtx.fillStyle = '#fff';
    uiCtx.font = '24px sans-serif';
    uiCtx.fillText('Current Loadout', W/2, 150);
    
    const items = [
      { name: 'Shield', value: bikeLoadout.shield.toUpperCase() },
      { name: 'Booster', value: bikeLoadout.booster.toUpperCase() },
      { name: 'AI System', value: bikeLoadout.ai.toUpperCase() },
    ];
    
    items.forEach((item, i) => {
      uiCtx.fillStyle = '#888';
      uiCtx.font = '18px sans-serif';
      uiCtx.textAlign = 'left';
      uiCtx.fillText(item.name + ':', W/2 - 150, 200 + i * 40);
      uiCtx.fillStyle = '#00ff88';
      uiCtx.fillText(item.value, W/2 + 50, 200 + i * 40);
    });
    
    uiCtx.fillStyle = '#ff00ff';
    uiCtx.font = 'bold 20px "Orbitron", sans-serif';
    uiCtx.textAlign = 'center';
    uiCtx.fillText('< BACK TO MENU', W/2, H - 50);
  }

  function drawRacingUI() {
    // Speed - Digital display
    uiCtx.fillStyle = 'rgba(0,10,20,0.8)';
    uiCtx.fillRect(20, H - 120, 200, 100);
    uiCtx.strokeStyle = '#00ffff';
    uiCtx.lineWidth = 2;
    uiCtx.strokeRect(20, H - 120, 200, 100);
    
    uiCtx.fillStyle = '#00ffff';
    uiCtx.font = 'bold 48px "Orbitron", monospace';
    uiCtx.textAlign = 'left';
    uiCtx.fillText(Math.floor(playerSpeed).toString().padStart(3, '0'), 35, H - 65);
    
    uiCtx.fillStyle = '#888';
    uiCtx.font = '16px sans-serif';
    uiCtx.fillText('KM/H', 35, H - 40);

    // Nitro
    uiCtx.fillStyle = 'rgba(0,10,20,0.8)';
    uiCtx.fillRect(W - 220, H - 120, 200, 100);
    uiCtx.strokeStyle = '#ff00ff';
    uiCtx.strokeRect(W - 220, H - 120, 200, 100);
    
    uiCtx.fillStyle = playerNitro > 20 ? '#ff00ff' : '#444';
    uiCtx.font = 'bold 20px "Orbitron", sans-serif';
    uiCtx.textAlign = 'right';
    uiCtx.fillText('NITRO', W - 35, H - 85);
    
    const nitroW = 180;
    uiCtx.fillStyle = '#1a0a2e';
    uiCtx.fillRect(W - 210, H - 55, nitroW, 25);
    uiCtx.fillStyle = '#ff00ff';
    uiCtx.fillRect(W - 210, H - 55, nitroW * (playerNitro / 100), 25);
    
    if (playerNitro > 80) {
      uiCtx.shadowColor = '#ff00ff';
      uiCtx.shadowBlur = 20;
      uiCtx.fillRect(W - 210, H - 55, nitroW * (playerNitro / 100), 25);
      uiCtx.shadowBlur = 0;
    }

    // Shield (combat mode)
    if (gameState === 'combat') {
      uiCtx.fillStyle = 'rgba(0,10,20,0.8)';
      uiCtx.fillRect(W/2 - 100, H - 120, 200, 60);
      uiCtx.strokeStyle = '#00ff00';
      uiCtx.strokeRect(W/2 - 100, H - 120, 200, 60);
      
      uiCtx.fillStyle = playerShield > 20 ? '#00ff00' : '#444';
      uiCtx.font = 'bold 18px "Orbitron", sans-serif';
      uiCtx.textAlign = 'center';
      uiCtx.fillText('SHIELD', W/2, H - 90);
      
      uiCtx.fillStyle = '#00ff00';
      uiCtx.fillRect(W/2 - 90, H - 65, 180 * (playerShield / 100), 15);
    }

    // Lap info
    uiCtx.fillStyle = 'rgba(0,10,20,0.8)';
    uiCtx.fillRect(W/2 - 120, 20, 240, 80);
    uiCtx.strokeStyle = '#ffff00';
    uiCtx.strokeRect(W/2 - 120, 20, 240, 80);
    
    uiCtx.fillStyle = '#fff';
    uiCtx.font = 'bold 22px "Orbitron", sans-serif';
    uiCtx.textAlign = 'center';
    uiCtx.fillText('LAP ' + currentLap + ' / ' + totalLaps, W/2, 50);
    uiCtx.font = '18px monospace';
    uiCtx.fillText('TIME: ' + lapTime.toFixed(2) + 's', W/2, 80);

    // Position (race mode)
    if (selectedMode === 'race' || selectedMode === 'arena') {
      const playerDistance = (currentLap - 1) * TRACK_LENGTH + playerPosition.z;
      let position = 1;
      opponents.forEach(opp => {
        const oppDistance = ((opp.lap || 1) - 1) * TRACK_LENGTH + (opp.z || 0);
        if (oppDistance > playerDistance) position++;
      });
      
      uiCtx.fillStyle = '#ffff00';
      uiCtx.font = 'bold 56px "Orbitron", sans-serif';
      uiCtx.textAlign = 'right';
      uiCtx.fillText(position + getOrdinal(position), W - 30, 70);
    }

    // Mode indicator
    uiCtx.fillStyle = '#ff3366';
    uiCtx.font = 'bold 14px "Orbitron", sans-serif';
    uiCtx.textAlign = 'left';
    const modeNames = {
      story: 'STORY MODE',
      freeride: 'FREE RIDE',
      timetrial: 'TIME TRIAL',
      race: 'GRAND RACE',
      arena: 'COMBAT ARENA'
    };
    uiCtx.fillText(modeNames[selectedMode] || '', 30, 40);

    if ('ontouchstart' in window) {
      drawTouchControls();
    }
  }

  function drawTouchControls() {
    const { btnSize, gap, margin } = TOUCH_UI;
    
    uiCtx.fillStyle = touchLeft ? 'rgba(0,200,255,0.6)' : 'rgba(0,200,255,0.3)';
    uiCtx.fillRect(margin, H - btnSize - margin, btnSize, btnSize);
    uiCtx.strokeStyle = '#00ffff';
    uiCtx.lineWidth = 2;
    uiCtx.strokeRect(margin, H - btnSize - margin, btnSize, btnSize);
    uiCtx.fillStyle = '#fff';
    uiCtx.font = 'bold 30px sans-serif';
    uiCtx.textAlign = 'center';
    uiCtx.textBaseline = 'middle';
    uiCtx.fillText('◀', margin + btnSize/2, H - btnSize/2 - margin);
    
    uiCtx.fillStyle = touchRight ? 'rgba(0,200,255,0.6)' : 'rgba(0,200,255,0.3)';
    uiCtx.fillRect(margin + btnSize + gap, H - btnSize - margin, btnSize, btnSize);
    uiCtx.strokeRect(margin + btnSize + gap, H - btnSize - margin, btnSize, btnSize);
    uiCtx.fillText('▶', margin + btnSize + gap + btnSize/2, H - btnSize/2 - margin);
    
    uiCtx.fillStyle = touchAccel ? 'rgba(0,255,100,0.6)' : 'rgba(0,255,100,0.3)';
    uiCtx.fillRect(W - btnSize - margin, H - btnSize - margin, btnSize, btnSize);
    uiCtx.strokeStyle = '#00ff66';
    uiCtx.strokeRect(W - btnSize - margin, H - btnSize - margin, btnSize, btnSize);
    uiCtx.fillStyle = '#fff';
    uiCtx.fillText('▲', W - btnSize/2 - margin, H - btnSize/2 - margin);
    
    uiCtx.fillStyle = touchNitro ? 'rgba(255,0,255,0.6)' : 'rgba(255,0,255,0.3)';
    uiCtx.fillRect(W - btnSize - margin, H - 2*btnSize - 25, btnSize, btnSize);
    uiCtx.strokeStyle = '#ff00ff';
    uiCtx.strokeRect(W - btnSize - margin, H - 2*btnSize - 25, btnSize, btnSize);
    uiCtx.fillStyle = '#fff';
    uiCtx.font = 'bold 24px sans-serif';
    uiCtx.fillText('⚡', W - btnSize/2 - margin, H - 2*btnSize/2 - 25);

    uiCtx.fillStyle = touchBrake ? 'rgba(255,60,60,0.6)' : 'rgba(255,60,60,0.3)';
    uiCtx.fillRect(W - btnSize - margin, H - 3*btnSize - 35, btnSize, btnSize);
    uiCtx.strokeStyle = '#ff4444';
    uiCtx.strokeRect(W - btnSize - margin, H - 3*btnSize - 35, btnSize, btnSize);
    uiCtx.fillStyle = '#fff';
    uiCtx.font = 'bold 28px sans-serif';
    uiCtx.fillText('▼', W - btnSize/2 - margin, H - 3*btnSize/2 - 35);
    
    uiCtx.textBaseline = 'alphabetic';
  }

  function getOrdinal(n) {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return s[(v - 20) % 10] || s[v] || s[0];
  }

  function updateHUD() {
    const hudScore = document.getElementById('hud-score');
    if (hudScore) {
      hudScore.textContent = 'Score: ' + score;
    }
  }

  function endGame() {
    gameState = 'finished';
    Audio.stopMusic();
    
    if (selectedMode === 'story') {
      score += 10000;
    }
    
    GameManager.showEnd(score);
  }

  function destroy() {
    if (animId) cancelAnimationFrame(animId);
    window.removeEventListener('resize', onResize);
    window.removeEventListener('orientationchange', onResize);
    if (deviceOrientationHandler) {
      window.removeEventListener('deviceorientation', deviceOrientationHandler);
      deviceOrientationHandler = null;
    }
    if (uiCanvas && uiCanvas.parentElement) {
      uiCanvas.parentElement.removeChild(uiCanvas);
    }
    if (renderer) {
      renderer.dispose();
    }
  }

  // Public API
  return { init, destroy };
})();
