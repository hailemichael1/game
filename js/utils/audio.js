/**
 * audio.js — Web Audio API sound engine
 * Generates all sounds procedurally. iOS-safe: AudioContext is created
 * and resumed inside a user-gesture handler.
 */

const Audio = (() => {
  let ctx = null;
  let masterGain = null;
  let musicGain = null;
  let musicInterval = null;
  let musicStep = 0;
  let currentPattern = null;
  let enabled = true;

  // ── Init / resume (must be called inside a user gesture) ──────
  function init() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = ctx.createGain();
      masterGain.gain.value = 0.5;
      masterGain.connect(ctx.destination);

      musicGain = ctx.createGain();
      musicGain.gain.value = 0.18;
      musicGain.connect(masterGain);
    }
    // iOS suspends AudioContext until resumed inside a gesture
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
  }

  // ── Tone helper ───────────────────────────────────────────────
  function tone(freq, type, duration, vol = 0.4, startDelay = 0) {
    if (!enabled || !ctx) return;
    const t = ctx.currentTime + startDelay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(t);
    osc.stop(t + duration + 0.01);
  }

  // ── Noise burst ───────────────────────────────────────────────
  function noise(duration, vol = 0.3) {
    if (!enabled || !ctx) return;
    const bufSize = Math.floor(ctx.sampleRate * duration);
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    src.connect(gain);
    gain.connect(masterGain);
    src.start();
  }

  // ── Sound effects ─────────────────────────────────────────────
  const sfx = {
    shoot()     { init(); tone(880,'square',0.08,0.3); tone(660,'square',0.06,0.2,0.04); },
    hit()       { init(); noise(0.12,0.25); tone(200,'sawtooth',0.1,0.3); },
    explosion() { init(); noise(0.35,0.5); tone(80,'sawtooth',0.3,0.4); },
    enemyDie()  { init(); tone(440,'square',0.05,0.2); tone(220,'square',0.1,0.2,0.05); },
    playerDie() { init(); noise(0.6,0.6); tone(100,'sawtooth',0.5,0.5); tone(60,'sine',0.8,0.4,0.2); },
    jump()      { init(); tone(400,'sine',0.15,0.3); tone(600,'sine',0.1,0.2,0.08); },
    land()      { init(); noise(0.08,0.2); },
    coin()      { init(); tone(1200,'sine',0.1,0.3); tone(1600,'sine',0.08,0.25,0.06); },
    place()     { init(); tone(300,'triangle',0.15,0.3); tone(450,'triangle',0.1,0.2,0.08); },
    wave()      { init(); [0,0.1,0.2].forEach(d => tone(600+d*200,'square',0.12,0.25,d)); },
    levelUp()   { init(); [0,0.1,0.2,0.3].forEach((d,i) => tone(400+i*150,'sine',0.15,0.3,d)); },
    gameOver()  { init(); [0,0.15,0.3,0.5].forEach((d,i) => tone(300-i*50,'sawtooth',0.2,0.4,d)); },
    menuClick() { init(); tone(500,'sine',0.1,0.25); },
  };

  // ── Background music ──────────────────────────────────────────
  const MUSIC_PATTERNS = {
    menu:    [261,329,392,523,392,329,261,196],
    shooter: [220,277,330,440,330,277,220,165],
    tower:   [196,247,294,392,294,247,196,147],
    runner:  [330,415,494,659,494,415,330,247],
    moto:    [293,370,440,587,440,370,293,220],
  };

  function startMusic(type) {
    if (!enabled) return;
    init();
    stopMusic();
    currentPattern = MUSIC_PATTERNS[type] || MUSIC_PATTERNS.menu;
    musicStep = 0;
    musicInterval = setInterval(() => {
      if (!ctx || !enabled) return;
      if (ctx.state === 'suspended') ctx.resume();
      const freq = currentPattern[musicStep % currentPattern.length];
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(1, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      osc.connect(g);
      g.connect(musicGain);
      osc.start(t);
      osc.stop(t + 0.22);
      musicStep++;
    }, 200);
  }

  function stopMusic() {
    if (musicInterval) { clearInterval(musicInterval); musicInterval = null; }
  }

  return { sfx, startMusic, stopMusic, init };
})();
