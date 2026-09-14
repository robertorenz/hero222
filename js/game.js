/* ============================================================
   H.E.R.O. Revamped - game engine
   Canvas 2D, fixed 60 Hz step, screen-flip caverns.
   ============================================================ */
const HERO = (() => {
'use strict';

const TILE = 16, SW = 20, SH = 12, VW = SW * TILE, VH = SH * TILE, HUD_H = 24, CH = VH + HUD_H;
const T_EMPTY = 0, T_ROCK = 1, T_WALL = 2, T_LAVA = 3, T_WATER = 4;
const CHAR_TILE = { '.': T_EMPTY, '#': T_ROCK, 'W': T_WALL, 'L': T_LAVA, '~': T_WATER };
const ENT_CHAR = { P: 'start', M: 'miner', b: 'bat', s: 'spider', m: 'moth', n: 'snake', l: 'lantern', r: 'raft' };
const ENT_NAMES = { start: 'Start', miner: 'Miner', bat: 'Bat', spider: 'Spider', moth: 'Moth', snake: 'Snake', lantern: 'Lantern', raft: 'Raft' };
const ENEMY = { bat: 1, spider: 1, moth: 1, snake: 1 };
const SCORE = { enemy: 50, lantern: 25, wallTile: 25, rescue: 1000, perPower: 10, perDynamite: 50, extraLife: 20000 };
const FUSE = 90, LASER_LEN = 30, LASER_BURN = 2.5, START_LIVES = 4;

/* ---------- level parsing / validation ---------- */
function parseLevel(def) {
  const sw = def.sw || 1, sh = def.sh || 1, cols = sw * SW, rows = sh * SH;
  const tiles = new Uint8Array(cols * rows);
  const entities = [];
  let start = { tx: 1, ty: 1 };
  for (let y = 0; y < rows; y++) {
    const row = def.map[y] || '';
    for (let x = 0; x < cols; x++) {
      const c = row[x] === undefined ? '#' : row[x];
      if (c in CHAR_TILE) tiles[y * cols + x] = CHAR_TILE[c];
      else if (c in ENT_CHAR) { tiles[y * cols + x] = T_EMPTY; if (c === 'P') start = { tx: x, ty: y }; else entities.push({ type: ENT_CHAR[c], tx: x, ty: y }); }
      else tiles[y * cols + x] = T_ROCK;
    }
  }
  return { name: def.name || 'Untitled', tip: def.tip || '', power: +def.power || 90, dynamite: +def.dynamite || 6, sw, sh, cols, rows, tiles, entities, start };
}

function validateLevel(def) {
  const errors = [], warnings = [];
  const cols = (def.sw || 1) * SW, rows = (def.sh || 1) * SH;
  if (!def.name || !def.name.trim()) warnings.push('The cavern has no name.');
  if (!(def.power > 0)) errors.push('Power must be greater than zero.');
  let P = null, M = null, enemies = 0;
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const c = (def.map[y] || '')[x] || '#';
    if (c === 'P') { if (P) errors.push('More than one start position.'); P = [x, y]; }
    if (c === 'M') { if (M) errors.push('More than one miner.'); M = [x, y]; }
    if ('bsmn'.includes(c)) enemies++;
  }
  if (!P) errors.push('No start position (P).');
  if (!M) errors.push('No miner (M).');
  if (P && M) {
    const seen = new Uint8Array(cols * rows); seen[P[1] * cols + P[0]] = 1;
    const q = [P]; let found = false;
    while (q.length) {
      const [x, y] = q.shift();
      if (x === M[0] && y === M[1]) { found = true; break; }
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
        const c = (def.map[ny] || '')[nx] || '#';
        if (c === '#' || c === 'L' || c === '~') continue;
        const i = ny * cols + nx; if (seen[i]) continue; seen[i] = 1; q.push([nx, ny]);
      }
    }
    if (!found) errors.push('The miner cannot be reached from the start (walls count as passable, lava and water do not).');
  }
  if (enemies === 0) warnings.push('No enemies placed. The cavern will be quiet.');
  return { ok: errors.length === 0, errors, warnings };
}

/* ---------- pixel art ---------- */
const PAL = {
  k: '#101418', K: '#374151', g: '#94a3b8', G: '#cbd5e1', w: '#f8fafc', y: '#fde047',
  Y: '#ca8a04', s: '#f2c9a0', S: '#c9926a', h: '#1e3a8a', H: '#3b82f6', b: '#2563eb',
  B: '#1e40af', r: '#dc2626', R: '#7f1d1d', o: '#f59e0b', O: '#b45309', n: '#8b5a2b',
  N: '#5c3a1b', t: '#d6c08a', T: '#ead9b0', e: '#16a34a', E: '#14532d', v: '#4ade80',
  c: '#22d3ee', C: '#0e7490', p: '#fda4af', m: '#6b7280'
};
// Hero: 16x16, facing right. Row 0 is the rotor (4 frames), rows 1-12 the body, rows 13-15 the legs (walk 0-2, airborne 3).
const HERO_PROP = ['..GGGGGGGGGGGG..', '....GGGGGGGG....', '.......GG.......', '....GGGGGGGG....'];
const HERO_BODY = [
  '.......KK.......',
  '......yyyy......',
  '.....yyyyyyy....',
  '....yyyyyyyyy...',
  '....YYYYYYYYYr..',
  '.....ssssskcr...',
  '.....Ssssssss...',
  '......ssss......',
  '..KKK.hhhhhh....',
  '..KgKhhhhhhhhs..',
  '..KKK.hhhhhh....',
  '......HHhhhh....',
];
const HERO_LEGS = [
  ['......hh..hh....', '......hh..hh....', '.....KKK.KKK....'],
  ['.....hh...hh....', '....hh.....hh...', '...KKK.....KKK..'],
  ['......hh..hh....', '......hh..hh....', '.....KKK.KKK....'],
  ['.......hhhh.....', '.......hh.hh....', '......KKK.KKK...'],
];
const SPR = {
  miner: ['....oooooo....', '...oooooooo...', '..OOOOwwOOOO..', '....ssssss....', '....skssks....', '....ssssss....', '.....SSSS.....', '..nnbbbbbbnn..', '.nnnbbbbbbnnn.', '.ss.bbbbbb.ss.', '....bbbbbb....', '....bBbbBb....', '....bb..bb....', '....bb..bb....', '....bb..bb....', '...KKK..KKK...'],
  miner2: ['....oooooo..s.', '...oooooooo.n.', '..OOOOwwOOOOn.', '....ssssss..n.', '....skssks..n.', '....ssssss.nn.', '.....SSSS.nn..', '..nnbbbbbbnn..', '.nnnbbbbbbn...', '.ss.bbbbbb....', '....bbbbbb....', '....bBbbBb....', '....bb..bb....', '....bb..bb....', '....bb..bb....', '...KKK..KKK...'],
  bat0: ['KK............KK', 'KKK..........KKK', 'KKKK...pp...KKKK', '.KKKK.NNNN.KKKK.', '..KKKKNrrNKKKK..', '...KKKNNNNKKK...', '....KKNwwNKK....', '.....K.NN.K.....', '................', '................'],
  bat1: ['................', '................', '.......pp.......', 'KKKKK.NNNN.KKKKK', 'KKKKKKNrrNKKKKKK', '.KKKKKNNNNKKKK..', '....KKNwwNKK....', '.....K.NN.K.....', '................', '................'],
  bat2: ['................', '................', '.......pp.......', '......NNNN......', '...KKKNrrNKKKK..', 'KKKKKKNNNNKKKKKK', 'KKK..KNwwNK..KKK', 'K.....K.NN.K...K', '................', '................'],
  spider0: ['.K..........K.', '..K...KK...K..', '...K.nnnn.K...', 'K...nNNNNn...K', '.KKKNNnnNNKKK.', '..KKNrNNrNKK..', '...KNNNNNNK...', 'K..KnNNNNnK..K', '.KK.nnNNnn.KK.', '..K..K..K..K..', '.K..K....K..K.', 'K...........K.'],
  spider1: ['..K........K..', '..K...KK...K..', '..K..nnnn..K..', '.K..nNNNNn..K.', '.KKKNNnnNNKKK.', '..KKNrNNrNKK..', '...KNNNNNNK...', '.K.KnNNNNnK.K.', '.KK.nnNNnn.KK.', '.K...K..K...K.', '.K..K....K..K.', '.K..........K.'],
  moth0: ['.K..........K.', '..K...KK...K..', 'tttt..KK..tttt', 'tToTt.KK.tToTt', 'tTTTtKKKKtTTTt', '.tttotKKtottt.', '..ttttKKtttt..', '..tt...KK...tt', '......KK......', '..............'],
  moth1: ['.K..........K.', '..K...KK...K..', '.....tKKt.....', '....tTKKTt....', '....toKKot....', '....ttKKtt....', '.....tKKt.....', '......KK......', '......KK......', '..............'],
  snake0: ['...........vee..', '..........veeee.', '..........eekek.', '...........eee.r', '....eeeeee.eee..', '...eevvvveeeee..', '..eevvEEvveee...', '..eeeeEEeeee....', '...eeeeeeee.....', '................'],
  snake1: ['...........vee..', '..........veeee.', '..........eekek.', '...........eee..', '....eeeeee.eee..', '...eevvvveeeee..', '..eevvEEvveee...', '..eeeeEEeeee....', '...eeeeeeee.....', '................'],
  lantern: ['...KK...', '..KKKK..', '.K....K.', '.KyyyyK.', '.KyTTyK.', '.KyTwyK.', '.KyTTyK.', '.KyyyyK.', '.K....K.', '..KKKK..', '...KK...', '........'],
  raft: ['NnnnnnnnNNnnnnnnnNNnnnnnnnNNnnnn', 'nTTTTTTTnnTTTTTTTnnTTTTTTTnnTTTT', 'NnnnnnnnNNnnnnnnnNNnnnnnnnNNnnnn', 'nTTTTTTTnnTTTTTTTnnTTTTTTTnnTTTT', 'NNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNN', '.N............................N.'],
  dynamite: ['...o..', '..o...', '..k...', '.rrrr.', '.rRrr.', '.rwrr.', '.rRrr.', '.rrrr.'],
  life: ['.GGGGGG.', '...KK...', '..yyyy..', '..yyyy..', '..hhhh..', '.hhhhhh.', '..h..h..', '..K..K..'],
};

let sprites = null, tilesImg = null;
function makeSprite(rows) {
  const h = rows.length, w = rows[0].length;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d');
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const ch = rows[j][i]; if (ch !== '.' && PAL[ch]) { x.fillStyle = PAL[ch]; x.fillRect(i, j, 1, 1); } }
  return c;
}
function flip(img) {
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const x = c.getContext('2d'); x.translate(img.width, 0); x.scale(-1, 1); x.drawImage(img, 0, 0); return c;
}
function rnd(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function makeTile(fn) { const c = document.createElement('canvas'); c.width = TILE; c.height = TILE; fn(c.getContext('2d')); return c; }

function initAssets() {
  if (sprites) return;
  sprites = {};
  sprites.hero = []; // [propFrame][legFrame] facing right
  for (let p = 0; p < 4; p++) { sprites.hero[p] = []; for (let l = 0; l < HERO_LEGS.length; l++) sprites.hero[p][l] = makeSprite([HERO_PROP[p], ...HERO_BODY, ...HERO_LEGS[l]]); }
  sprites.heroL = sprites.hero.map(row => row.map(flip));
  for (const k in SPR) sprites[k] = makeSprite(SPR[k]);
  sprites.batL = [flip(sprites.bat0), flip(sprites.bat1), flip(sprites.bat2)];
  sprites.snakeL = [flip(sprites.snake0), flip(sprites.snake1)];

  tilesImg = { rock: [], wall: null, lava: [], water: [] };
  for (let v = 0; v < 4; v++) {
    const r = rnd(1234 + v * 77);
    tilesImg.rock.push(makeTile(g => {
      g.fillStyle = '#2b2118'; g.fillRect(0, 0, 16, 16);
      for (let i = 0; i < 26; i++) { g.fillStyle = r() < 0.5 ? '#3a2c20' : '#241a12'; g.fillRect((r() * 16) | 0, (r() * 16) | 0, 1 + (r() * 2 | 0), 1); }
      for (let i = 0; i < 4; i++) { g.fillStyle = '#4a3a2b'; g.fillRect((r() * 16) | 0, (r() * 16) | 0, 1, 1); }
    }));
  }
  tilesImg.wall = makeTile(g => {
    g.fillStyle = '#6b4f2f'; g.fillRect(0, 0, 16, 16);
    g.fillStyle = '#b08a5a';
    g.fillRect(0, 0, 7, 3); g.fillRect(8, 0, 8, 3); g.fillRect(0, 4, 3, 3); g.fillRect(4, 4, 12, 3);
    g.fillRect(0, 8, 7, 3); g.fillRect(8, 8, 8, 3); g.fillRect(0, 12, 3, 3); g.fillRect(4, 12, 12, 3);
    g.fillStyle = '#c9a374'; g.fillRect(0, 0, 7, 1); g.fillRect(8, 0, 8, 1); g.fillRect(4, 4, 12, 1); g.fillRect(0, 8, 7, 1); g.fillRect(8, 8, 8, 1); g.fillRect(4, 12, 12, 1);
  });
  for (let f = 0; f < 2; f++) {
    const r = rnd(99 + f);
    tilesImg.lava.push(makeTile(g => {
      g.fillStyle = '#b91c1c'; g.fillRect(0, 0, 16, 16);
      for (let i = 0; i < 9; i++) { g.fillStyle = r() < 0.5 ? '#f97316' : '#fbbf24'; const w = 2 + (r() * 4 | 0); g.fillRect((r() * 14) | 0, (r() * 14) | 0, w, 2); }
      for (let i = 0; i < 4; i++) { g.fillStyle = '#7f1d1d'; g.fillRect((r() * 16) | 0, (r() * 16) | 0, 2, 1); }
    }));
    tilesImg.water.push(makeTile(g => {
      g.fillStyle = '#1e40af'; g.fillRect(0, 0, 16, 16);
      g.fillStyle = '#38bdf8';
      for (let i = 0; i < 3; i++) { const y = (i * 5 + f * 2) % 16; g.fillRect(0, y, 4, 1); g.fillRect(8, y, 4, 1); }
      g.fillStyle = '#60a5fa'; g.fillRect(0, 0, 16, 1);
    }));
  }
}

/* ---------- sound ---------- */
const Sfx = {
  ctx: null, muted: false, hum: null,
  ensure() {
    if (!this.ctx) { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { this.ctx = null; } }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  },
  beep(f, dur, type, vol, f2) {
    if (this.muted || !this.ctx) return;
    const t = this.ctx.currentTime, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type || 'square'; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(vol || 0.08, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.ctx.destination); o.start(t); o.stop(t + dur + 0.02);
  },
  noise(dur, vol) {
    if (this.muted || !this.ctx) return;
    const sr = this.ctx.sampleRate, buf = this.ctx.createBuffer(1, sr * dur, sr), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const s = this.ctx.createBufferSource(), g = this.ctx.createGain(), t = this.ctx.currentTime;
    s.buffer = buf; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(g); g.connect(this.ctx.destination); s.start(t);
  },
  laser() { this.beep(1200, 0.05, 'sawtooth', 0.04, 400); },
  place() { this.beep(260, 0.08, 'square', 0.06); },
  explode() { this.noise(0.45, 0.25); this.beep(90, 0.4, 'triangle', 0.15, 30); },
  wall() { this.beep(220, 0.12, 'triangle', 0.07, 90); },
  hit() { this.beep(700, 0.08, 'square', 0.06, 200); },
  die() { this.humStop(); this.beep(440, 0.6, 'square', 0.08, 55); },
  rescue() { [523, 659, 784, 1046, 784, 1046].forEach((f, i) => setTimeout(() => this.beep(f, 0.14, 'square', 0.07), i * 110)); },
  life() { [784, 988, 1175].forEach((f, i) => setTimeout(() => this.beep(f, 0.1, 'triangle', 0.08), i * 90)); },
  humStart() {
    if (this.hum || this.muted || !this.ctx) return;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain(), t = this.ctx.currentTime;
    o.type = 'sawtooth'; o.frequency.setValueAtTime(75, t);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.03, t + 0.08);
    o.connect(g); g.connect(this.ctx.destination); o.start(t); this.hum = { o, g };
  },
  humStop() {
    if (!this.hum) return;
    const t = this.ctx.currentTime; this.hum.g.gain.setTargetAtTime(0.0001, t, 0.05); this.hum.o.stop(t + 0.25); this.hum = null;
  },
  setMuted(m) { this.muted = m; if (m) this.humStop(); }
};

/* ---------- helpers ---------- */
const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const KEYMAP = {
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up',
  Space: 'fire', KeyZ: 'fire', KeyJ: 'fire', ControlLeft: 'fire', ControlRight: 'fire',
  ArrowDown: 'dyn', KeyS: 'dyn', KeyX: 'dyn', KeyK: 'dyn', ShiftLeft: 'dyn',
  KeyP: 'pause', Escape: 'esc', Enter: 'enter'
};

/* ---------- the game ---------- */
class Game {
  constructor(canvas, cb) {
    initAssets();
    this.canvas = canvas; this.cb = cb || {};
    canvas.width = VW; canvas.height = CH;
    this.ctx = canvas.getContext('2d'); this.ctx.imageSmoothingEnabled = false;
    this.overlay = document.createElement('canvas'); this.overlay.width = VW; this.overlay.height = VH;
    this.octx = this.overlay.getContext('2d');
    this.keys = {}; this.pressed = {};
    this.state = 'idle'; this.frame = 0; this.acc = 0; this.last = performance.now();
    this.active = false;
    window.addEventListener('keydown', e => this.onKey(e, true));
    window.addEventListener('keyup', e => this.onKey(e, false));
    window.addEventListener('blur', () => { this.keys = {}; Sfx.humStop(); });
    requestAnimationFrame(t => this.loop(t));
  }
  onKey(e, down) {
    const k = KEYMAP[e.code]; if (!k || !this.active) return;
    if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    e.preventDefault();
    if (down) Sfx.ensure();
    if (down && !this.keys[k]) this.pressed[k] = true;
    this.keys[k] = down;
  }
  setActive(a) { this.active = a; this.keys = {}; if (!a) Sfx.humStop(); }
  // virtual buttons (touch)
  setKey(k, down) { if (down && !this.keys[k]) this.pressed[k] = true; this.keys[k] = down; if (down) Sfx.ensure(); }

  start(levelDefs, index, opts) {
    this.levelDefs = levelDefs; this.levelIndex = index || 0; this.opts = opts || {};
    this.score = 0; this.lives = START_LIVES; this.nextLife = SCORE.extraLife; this.rescued = 0;
    this.active = true; Sfx.ensure();
    this.loadLevel();
  }
  nextLevel() { this.levelIndex++; this.loadLevel(); }
  loadLevel() {
    const L = this.level = parseLevel(this.levelDefs[this.levelIndex]);
    this.burn = new Float32Array(L.tiles.length);
    this.dark = {};
    this.entities = L.entities.map(e => this.makeEntity(e, L));
    this.player = { x: L.start.tx * TILE + 3, y: L.start.ty * TILE + 2, w: 10, h: 14, vy: 0, facing: 1, walk: 0, flying: false, onGround: false, beam: null, laser: false };
    this.dynamites = []; this.explosions = []; this.popups = [];
    this.power = L.power; this.dynamite = L.dynamite;
    this.sx = -1; this.sy = -1; this.invuln = 0; this.timer = 0;
    this.state = 'playing'; this.deathCause = '';
    this.banner = { text: 'CAVERN ' + (this.levelIndex + 1), sub: L.name.toUpperCase(), t: 150 };
    this.updateScreen(true);
  }
  makeEntity(d, L) {
    const e = { type: d.type, tx: d.tx, ty: d.ty, alive: true, t: 0, sx: (d.tx / SW) | 0, sy: (d.ty / SH) | 0, x: d.tx * TILE, y: d.ty * TILE, w: 12, h: 12, vx: 0 };
    switch (d.type) {
      case 'bat': e.w = 16; e.h = 10; e.y0 = e.y + 3; e.y = e.y0; e.vx = -0.8; break;
      case 'spider': {
        e.w = 14; e.h = 12; e.x = d.tx * TILE + 1; e.anchorY = d.ty * TILE;
        let drop = 0; for (let k = 1; k <= 3; k++) { if (this.solidTile(L, d.tx, d.ty + k)) break; drop = k; }
        e.range = drop * TILE + 6;
        let top = d.ty; for (let k = 1; k <= 12; k++) { if (d.ty - k < 0 || this.solidTile(L, d.tx, d.ty - k)) { top = d.ty - k + 1; break; } }
        e.threadY = top * TILE; e.t = (d.tx * 37) % 200; break;
      }
      case 'moth': e.w = 14; e.h = 10; e.x0 = e.x + 1; e.y0 = e.y + 3; e.t = (d.tx * 13) % 100; break;
      case 'snake': e.w = 16; e.h = 10; e.y = d.ty * TILE + 6; break;
      case 'lantern': e.w = 8; e.h = 12; e.x = d.tx * TILE + 4; e.y = d.ty * TILE + 2; break;
      case 'miner': e.w = 14; e.h = 16; e.x = d.tx * TILE + 1; break;
      case 'raft': {
        e.w = 32; e.h = 6; e.y = d.ty * TILE + 12; e.vx = 0.5;
        let lx = d.tx, rx = d.tx;
        const water = (tx) => tx >= 0 && tx < L.cols && L.tiles[(d.ty + 1) * L.cols + tx] === T_WATER && !this.solidTile(L, tx, d.ty);
        while (water(lx - 1)) lx--; while (water(rx + 1)) rx++;
        e.minX = lx * TILE; e.maxX = Math.max(e.minX, (rx + 1) * TILE - 32); e.x = Math.min(Math.max(e.x - 8, e.minX), e.maxX); break;
      }
    }
    e.x0 = e.x0 === undefined ? e.x : e.x0; e.sx0 = e.x; e.sy0 = e.y; e.t0 = e.t;
    return e;
  }
  resetEntity(e) { e.x = e.sx0; e.y = e.sy0; e.t = e.t0; if (e.type === 'bat') e.vx = -0.8; if (e.type === 'raft') e.vx = 0.5; }
  solidTile(L, tx, ty) { if (tx < 0 || ty < 0 || tx >= L.cols || ty >= L.rows) return true; const t = L.tiles[ty * L.cols + tx]; return t === T_ROCK || t === T_WALL; }
  tileAt(tx, ty) { const L = this.level; if (tx < 0 || ty < 0 || tx >= L.cols || ty >= L.rows) return T_ROCK; return L.tiles[ty * L.cols + tx]; }
  solidAt(px, py) { return this.solidTile(this.level, (px / TILE) | 0, (py / TILE) | 0); }
  boxSolid(x, y, w, h) { return this.solidAt(x, y) || this.solidAt(x + w - 1, y) || this.solidAt(x, y + h - 1) || this.solidAt(x + w - 1, y + h - 1); }
  hazardAt(px, py) { const t = this.tileAt((px / TILE) | 0, (py / TILE) | 0); return t === T_LAVA || t === T_WATER; }
  boxHazard(x, y, w, h) { return this.hazardAt(x, y) || this.hazardAt(x + w - 1, y) || this.hazardAt(x, y + h - 1) || this.hazardAt(x + w - 1, y + h - 1) || this.hazardAt(x + w / 2, y + h / 2); }
  onScreen(e) { return e.sx === this.sx && e.sy === this.sy; }
  screenKey() { return this.sx + ',' + this.sy; }

  /* ---- loop ---- */
  loop(t) {
    requestAnimationFrame(tt => this.loop(tt));
    if (!this.active) { this.last = t; return; }
    let dt = t - this.last; this.last = t; if (dt > 250) dt = 250;
    this.acc += dt;
    while (this.acc >= 1000 / 60) { this.update(); this.acc -= 1000 / 60; }
    this.render();
  }
  update() {
    this.frame++;
    if (this.state === 'idle') return;
    if (this.pressed.esc) { this.pressed = {}; if (this.state === 'playing' || this.state === 'paused') { this.state = 'paused'; Sfx.humStop(); if (this.cb.onPauseMenu) this.cb.onPauseMenu(); } return; }
    if (this.pressed.pause || (this.pressed.enter && this.state === 'paused')) { if (this.state === 'playing') { this.state = 'paused'; Sfx.humStop(); } else if (this.state === 'paused') this.state = 'playing'; }
    if (this.banner) { if (--this.banner.t <= 0) this.banner = null; }
    switch (this.state) {
      case 'playing': this.updatePlaying(); break;
      case 'dying': this.updateEffects(); if (--this.timer <= 0) this.afterDeath(); break;
      case 'rescued': this.updateEffects(); this.entities.forEach(e => e.t++); if (--this.timer <= 0) this.finishLevel(); break;
    }
    this.pressed = {};
  }
  resume() { if (this.state === 'paused') this.state = 'playing'; this.keys = {}; }

  updatePlaying() {
    const p = this.player;
    if (this.invuln > 0) this.invuln--;
    this.power -= 1 / 60;
    if (this.power <= 0) { this.power = 0; this.kill('power'); return; }

    // ground / raft
    p.onGround = this.boxSolid(p.x, p.y + 1, p.w, p.h);
    let raftDx = 0;
    for (const e of this.entities) {
      if (e.type !== 'raft' || !this.onScreen(e)) continue;
      const feet = p.y + p.h;
      if (p.x + p.w > e.x && p.x < e.x + e.w && feet >= e.y - 3 && feet <= e.y + 5 && p.vy >= 0) { p.onGround = true; p.y = e.y - p.h; raftDx = e.vx; }
    }
    if (raftDx) this.moveX(p, raftDx);

    let dx = 0;
    if (this.keys.left) { dx = -1; p.facing = -1; } else if (this.keys.right) { dx = 1; p.facing = 1; }
    if (dx) { this.moveX(p, dx * (p.onGround ? 1.25 : 1.5)); p.walk++; } else p.walk = 0;

    if (this.keys.up) { p.vy -= 0.22; if (p.vy < -1.9) p.vy = -1.9; p.flying = true; Sfx.humStart(); }
    else { p.vy += 0.14; if (p.vy > 2.6) p.vy = 2.6; p.flying = false; Sfx.humStop(); }
    if (p.onGround && p.vy > 0) p.vy = 0;
    this.moveY(p, p.vy);

    if (this.boxHazard(p.x + 2, p.y + 2, p.w - 4, p.h - 4)) { this.kill('hazard'); return; }
    this.updateScreen(false);

    p.laser = !!this.keys.fire; p.beam = null;
    if (p.laser) this.doLaser();
    if (this.pressed.dyn && p.onGround && this.dynamite > 0 && this.dynamites.length === 0) this.placeDynamite();

    this.updateEntities();

    for (const d of this.dynamites) { d.t--; if (d.t <= 0) this.explode(d); }
    this.dynamites = this.dynamites.filter(d => d.t > 0);
    this.updateEffects();
    if (this.state !== 'playing') return;

    const pb = { x: p.x + 1, y: p.y + 1, w: p.w - 2, h: p.h - 2 };
    for (const e of this.entities) {
      if (!e.alive || !this.onScreen(e)) continue;
      if (ENEMY[e.type] && this.invuln === 0 && overlap(pb, { x: e.x + 1, y: e.y + 1, w: e.w - 2, h: e.h - 2 })) { this.kill('enemy'); return; }
      if (e.type === 'miner' && overlap(pb, e)) { this.rescue(); return; }
    }
  }
  moveX(p, d) {
    const n = Math.ceil(Math.abs(d)); if (!n) return; const s = d / n;
    for (let i = 0; i < n; i++) { const nx = p.x + s; if (this.boxSolid(nx, p.y, p.w, p.h)) break; p.x = nx; }
  }
  moveY(p, d) {
    const n = Math.ceil(Math.abs(d)); if (!n) return; const s = d / n;
    for (let i = 0; i < n; i++) { const ny = p.y + s; if (this.boxSolid(p.x, ny, p.w, p.h)) { p.vy = 0; break; } p.y = ny; }
  }
  updateScreen(force) {
    const p = this.player, L = this.level;
    let sx = ((p.x + p.w / 2) / VW) | 0, sy = ((p.y + p.h / 2) / VH) | 0;
    sx = Math.max(0, Math.min(L.sw - 1, sx)); sy = Math.max(0, Math.min(L.sh - 1, sy));
    if (!force && sx === this.sx && sy === this.sy) return;
    this.sx = sx; this.sy = sy;
    this.checkpoint = { x: p.x, y: p.y, facing: p.facing };
    for (const e of this.entities) if (this.onScreen(e) && e.alive) this.resetEntity(e);
    this.player.beam = null;
  }
  doLaser() {
    const p = this.player, L = this.level, dir = p.facing;
    const y = p.y + 4, h = 3, startX = dir > 0 ? p.x + p.w : p.x;
    let endX = startX + dir * LASER_LEN, hit = -1;
    const ty = ((y + 1) / TILE) | 0;
    for (let i = 0; i <= LASER_LEN; i += 2) {
      const px = startX + dir * i, tx = (px / TILE) | 0, t = this.tileAt(tx, ty);
      if (t === T_ROCK || t === T_WALL) { endX = dir > 0 ? tx * TILE : (tx + 1) * TILE; if (t === T_WALL) hit = ty * L.cols + tx; break; }
    }
    const beam = { x: Math.min(startX, endX), y, w: Math.abs(endX - startX), h };
    p.beam = beam;
    if (this.frame % 7 === 0) Sfx.laser();
    if (hit >= 0) {
      this.burn[hit] += 1 / 60;
      if (this.burn[hit] >= LASER_BURN) { L.tiles[hit] = T_EMPTY; this.burn[hit] = 0; this.addScore(SCORE.wallTile, (hit % L.cols) * TILE + 8, ((hit / L.cols) | 0) * TILE + 8); Sfx.wall(); }
    }
    for (const e of this.entities) {
      if (!e.alive || !this.onScreen(e)) continue;
      if ((ENEMY[e.type] || e.type === 'lantern') && overlap(beam, e)) this.killEntity(e);
    }
  }
  killEntity(e) {
    e.alive = false;
    if (e.type === 'lantern') { this.dark[e.sx + ',' + e.sy] = true; this.addScore(SCORE.lantern, e.x + 4, e.y); }
    else this.addScore(SCORE.enemy, e.x + e.w / 2, e.y);
    this.explosions.push({ x: e.x + e.w / 2, y: e.y + e.h / 2, t: 14, r: 10, soft: true });
    Sfx.hit();
  }
  placeDynamite() {
    const p = this.player, tx = ((p.x + p.w / 2) / TILE) | 0, ty = ((p.y + p.h - 1) / TILE) | 0;
    this.dynamites.push({ tx, ty, x: tx * TILE + 5, y: ty * TILE + 8, t: FUSE });
    this.dynamite--; Sfx.place();
  }
  explode(d) {
    const L = this.level, cx = d.tx * TILE + 8, cy = d.ty * TILE + 8;
    const offs = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1], [2, 0], [-2, 0], [0, 2], [0, -2]];
    let n = 0;
    for (const [ox, oy] of offs) { const tx = d.tx + ox, ty = d.ty + oy; if (this.tileAt(tx, ty) === T_WALL) { L.tiles[ty * L.cols + tx] = T_EMPTY; this.burn[ty * L.cols + tx] = 0; n++; } }
    if (n) this.addScore(n * SCORE.wallTile, cx, cy - 12);
    this.explosions.push({ x: cx, y: cy, t: 26, r: 34 });
    for (const e of this.entities) {
      if (!e.alive || !this.onScreen(e) || !(ENEMY[e.type] || e.type === 'lantern')) continue;
      const ex = e.x + e.w / 2, ey = e.y + e.h / 2;
      if (Math.hypot(ex - cx, ey - cy) < 34) this.killEntity(e);
    }
    const p = this.player;
    if (Math.hypot(p.x + p.w / 2 - cx, p.y + p.h / 2 - cy) < 30) this.kill('dynamite');
    Sfx.explode();
  }
  updateEntities() {
    for (const e of this.entities) {
      if (!e.alive || !this.onScreen(e)) continue;
      e.t++;
      switch (e.type) {
        case 'bat': {
          const nx = e.x + e.vx, minX = this.sx * VW, maxX = (this.sx + 1) * VW - e.w;
          if (nx < minX || nx > maxX || this.boxSolid(nx, e.y, e.w, e.h)) e.vx = -e.vx; else e.x = nx;
          e.y = e.y0 + Math.sin(e.t * 0.07) * 5; break;
        }
        case 'spider': e.y = e.anchorY + (0.5 - 0.5 * Math.cos(e.t * 0.035)) * e.range; break;
        case 'moth': e.x = e.x0 + Math.cos(e.t * 0.045) * 18; e.y = e.y0 + Math.sin(e.t * 0.1) * 9; break;
        case 'raft': { e.x += e.vx; if (e.x <= e.minX) { e.x = e.minX; e.vx = Math.abs(e.vx); } else if (e.x >= e.maxX) { e.x = e.maxX; e.vx = -Math.abs(e.vx); } break; }
      }
    }
  }
  updateEffects() {
    for (const x of this.explosions) x.t--;
    this.explosions = this.explosions.filter(x => x.t > 0);
    for (const pp of this.popups) { pp.t--; pp.y -= 0.35; }
    this.popups = this.popups.filter(pp => pp.t > 0);
  }
  addScore(n, x, y) {
    this.score += n;
    if (x !== undefined) this.popups.push({ x, y, text: '' + n, t: 50 });
    if (this.score >= this.nextLife) { this.nextLife += SCORE.extraLife; this.lives++; this.popups.push({ x: this.player.x, y: this.player.y - 10, text: 'EXTRA LIFE', t: 80 }); Sfx.life(); }
  }
  kill(cause) {
    if (this.state !== 'playing') return;
    this.state = 'dying'; this.timer = 75; this.deathCause = cause; this.player.beam = null;
    this.explosions.push({ x: this.player.x + 5, y: this.player.y + 7, t: 30, r: 18, soft: true });
    Sfx.die();
  }
  afterDeath() {
    this.lives--;
    if (this.lives < 0) { this.state = 'over'; if (this.cb.onGameOver) this.cb.onGameOver({ score: this.score, level: this.levelIndex, rescued: this.rescued }); return; }
    const p = this.player, c = this.checkpoint;
    p.x = c.x; p.y = c.y; p.facing = c.facing; p.vy = 0;
    this.power = this.level.power; this.dynamite = this.level.dynamite;
    this.dynamites = []; this.burn.fill(0); this.invuln = 70;
    for (const e of this.entities) if (this.onScreen(e)) { e.alive = true; this.resetEntity(e); }
    if (this.dark[this.screenKey()]) { delete this.dark[this.screenKey()]; }
    this.state = 'playing';
  }
  rescue() {
    this.state = 'rescued'; this.timer = 140; this.player.beam = null; Sfx.humStop();
    this.bonusPower = Math.round(this.power) * SCORE.perPower; this.bonusDyn = this.dynamite * SCORE.perDynamite;
    this.addScore(SCORE.rescue + this.bonusPower + this.bonusDyn);
    this.rescued++;
    Sfx.rescue();
  }
  finishLevel() {
    this.state = 'between';
    if (this.cb.onLevelComplete) this.cb.onLevelComplete({
      levelIndex: this.levelIndex, name: this.level.name, score: this.score, rescue: SCORE.rescue, bonusPower: this.bonusPower, bonusDyn: this.bonusDyn,
      hasNext: this.levelIndex + 1 < this.levelDefs.length, lives: this.lives
    });
  }

  /* ---- render ---- */
  render() {
    const ctx = this.ctx;
    ctx.fillStyle = '#0F1923'; ctx.fillRect(0, 0, VW, CH);
    if (this.state === 'idle' || !this.level) return;
    const L = this.level, ox = this.sx * VW, oy = this.sy * VH, f = this.frame;
    ctx.save(); ctx.translate(-ox, -oy);
    ctx.fillStyle = '#0b1220'; ctx.fillRect(ox, oy, VW, VH);
    // tiles
    const tx0 = this.sx * SW, ty0 = this.sy * SH;
    for (let ty = ty0; ty < ty0 + SH; ty++) for (let tx = tx0; tx < tx0 + SW; tx++) {
      const t = L.tiles[ty * L.cols + tx], px = tx * TILE, py = ty * TILE;
      if (t === T_EMPTY) continue;
      if (t === T_ROCK) {
        ctx.drawImage(tilesImg.rock[(tx * 7 + ty * 13) & 3], px, py);
        ctx.fillStyle = '#5a4636';
        if (!this.solidTile(L, tx, ty - 1) && ty > ty0) ctx.fillRect(px, py, TILE, 1);
        if (!this.solidTile(L, tx - 1, ty) && tx > tx0) ctx.fillRect(px, py, 1, TILE);
        ctx.fillStyle = '#1a120c';
        if (!this.solidTile(L, tx, ty + 1) && ty < ty0 + SH - 1) ctx.fillRect(px, py + TILE - 1, TILE, 1);
        if (!this.solidTile(L, tx + 1, ty) && tx < tx0 + SW - 1) ctx.fillRect(px + TILE - 1, py, 1, TILE);
      } else if (t === T_WALL) {
        ctx.drawImage(tilesImg.wall, px, py);
        const b = this.burn[ty * L.cols + tx]; if (b > 0) { ctx.fillStyle = 'rgba(239,68,68,' + Math.min(0.8, b / LASER_BURN) + ')'; ctx.fillRect(px, py, TILE, TILE); }
      } else if (t === T_LAVA) ctx.drawImage(tilesImg.lava[(f >> 4) & 1], px, py);
      else if (t === T_WATER) ctx.drawImage(tilesImg.water[(f >> 4) & 1], px, py);
    }
    // entities
    for (const e of this.entities) {
      if (!e.alive || !this.onScreen(e)) continue;
      const x = Math.round(e.x), y = Math.round(e.y);
      switch (e.type) {
        case 'bat': { const fr = [0, 1, 2, 1][(e.t >> 2) & 3]; ctx.drawImage(e.vx < 0 ? sprites['bat' + fr] : sprites.batL[fr], x, y); break; }
        case 'spider': ctx.fillStyle = '#cbd5e1'; ctx.fillRect(x + 6, e.threadY, 1, y - e.threadY + 2); ctx.drawImage(sprites['spider' + ((e.t >> 4) & 1)], x, y); break;
        case 'moth': ctx.drawImage(sprites['moth' + ((e.t >> 2) & 1)], x, y); break;
        case 'snake': ctx.drawImage(sprites['snake' + ((e.t >> 4) & 1)], x, y); break;
        case 'lantern': {
          ctx.drawImage(sprites.lantern, x, y);
          const g = ctx.createRadialGradient(x + 4, y + 6, 2, x + 4, y + 6, 26); g.addColorStop(0, 'rgba(253,224,71,0.28)'); g.addColorStop(1, 'rgba(253,224,71,0)');
          ctx.fillStyle = g; ctx.fillRect(x - 24, y - 22, 56, 56); break;
        }
        case 'raft': ctx.drawImage(sprites.raft, x, y); break;
        case 'miner': ctx.drawImage((e.t >> 4) & 1 ? sprites.miner2 : sprites.miner, x, y); break;
      }
    }
    for (const d of this.dynamites) { if (((d.t >> 2) & 1) || d.t > 30) ctx.drawImage(sprites.dynamite, d.x, d.y); if (d.t <= 30 && (d.t >> 2) & 1) { ctx.fillStyle = '#fde047'; ctx.fillRect(d.x + 2, d.y - 1, 2, 2); } }
    // player
    const p = this.player;
    if (this.state !== 'dying' || (f >> 2) & 1) {
      if (!(this.invuln > 0 && (f >> 2) & 1)) {
        const prop = p.flying ? (f >> 1) & 3 : (this.state === 'dying' ? (f >> 1) & 3 : 0);
        const leg = p.onGround && p.walk ? ((p.walk >> 3) % 3) : (p.onGround ? 0 : 3);
        const img = (p.facing > 0 ? sprites.hero : sprites.heroL)[prop][leg];
        ctx.drawImage(img, Math.round(p.x) - 3, Math.round(p.y) - 2);
      }
    }
    if (p.beam && this.state === 'playing') {
      ctx.fillStyle = (f & 2) ? '#f87171' : '#fecaca'; ctx.fillRect(p.beam.x, p.beam.y + 1, p.beam.w, 1);
      ctx.fillStyle = 'rgba(248,113,113,0.45)'; ctx.fillRect(p.beam.x, p.beam.y, p.beam.w, 3);
    }
    for (const x of this.explosions) {
      const k = x.soft ? 14 : 26, pr = (1 - x.t / k) * x.r;
      ctx.beginPath(); ctx.arc(x.x, x.y, pr, 0, Math.PI * 2); ctx.fillStyle = x.soft ? 'rgba(253,224,71,' + (x.t / k) * 0.8 + ')' : 'rgba(249,115,22,' + (x.t / k) * 0.9 + ')'; ctx.fill();
      if (!x.soft) { ctx.beginPath(); ctx.arc(x.x, x.y, pr * 0.55, 0, Math.PI * 2); ctx.fillStyle = 'rgba(254,240,138,' + (x.t / k) + ')'; ctx.fill(); }
    }
    ctx.font = '7px "Press Start 2P", monospace'; ctx.textAlign = 'center';
    for (const pp of this.popups) { ctx.fillStyle = '#0F1923'; ctx.fillText(pp.text, Math.round(pp.x) + 1, Math.round(pp.y) + 1); ctx.fillStyle = '#fde047'; ctx.fillText(pp.text, Math.round(pp.x), Math.round(pp.y)); }
    ctx.textAlign = 'left';
    ctx.restore();

    // darkness
    if (this.dark[this.screenKey()]) {
      const o = this.octx; o.globalCompositeOperation = 'source-over'; o.clearRect(0, 0, VW, VH);
      o.fillStyle = 'rgba(0,0,0,0.94)'; o.fillRect(0, 0, VW, VH);
      o.globalCompositeOperation = 'destination-out';
      const px = p.x + p.w / 2 - ox, py = p.y + p.h / 2 - oy;
      let g = o.createRadialGradient(px, py, 4, px, py, 44); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.6, 'rgba(0,0,0,0.6)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      o.fillStyle = g; o.fillRect(px - 44, py - 44, 88, 88);
      for (let ty = ty0; ty < ty0 + SH; ty++) for (let tx = tx0; tx < tx0 + SW; tx++) if (L.tiles[ty * L.cols + tx] === T_LAVA) {
        const lx = tx * TILE + 8 - ox, ly = ty * TILE + 8 - oy; g = o.createRadialGradient(lx, ly, 2, lx, ly, 18); g.addColorStop(0, 'rgba(0,0,0,0.7)'); g.addColorStop(1, 'rgba(0,0,0,0)'); o.fillStyle = g; o.fillRect(lx - 18, ly - 18, 36, 36);
      }
      for (const x of this.explosions) { g = o.createRadialGradient(x.x - ox, x.y - oy, 2, x.x - ox, x.y - oy, x.r + 10); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)'); o.fillStyle = g; o.fillRect(x.x - ox - 50, x.y - oy - 50, 100, 100); }
      ctx.drawImage(this.overlay, 0, 0);
    }
    this.renderHud();
    if (this.banner) {
      const a = Math.min(1, this.banner.t / 30);
      ctx.fillStyle = 'rgba(15,25,35,' + (0.85 * a) + ')'; ctx.fillRect(40, 70, 240, 44);
      ctx.fillStyle = 'rgba(8,145,178,' + a + ')'; ctx.fillRect(40, 70, 240, 2);
      ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(248,250,252,' + a + ')'; ctx.font = '10px "Press Start 2P", monospace'; ctx.fillText(this.banner.text, 160, 88);
      ctx.fillStyle = 'rgba(34,211,238,' + a + ')'; ctx.font = '7px "Press Start 2P", monospace'; ctx.fillText(this.banner.sub, 160, 104); ctx.textAlign = 'left';
    }
    if (this.state === 'paused') {
      ctx.fillStyle = 'rgba(15,25,35,0.7)'; ctx.fillRect(0, 0, VW, VH);
      ctx.textAlign = 'center'; ctx.fillStyle = '#f8fafc'; ctx.font = '12px "Press Start 2P", monospace'; ctx.fillText('PAUSED', 160, 92);
      ctx.fillStyle = '#94a3b8'; ctx.font = '7px "Press Start 2P", monospace'; ctx.fillText('P TO RESUME', 160, 110); ctx.textAlign = 'left';
    }
    if (this.state === 'rescued') {
      ctx.textAlign = 'center'; ctx.fillStyle = (f >> 3) & 1 ? '#fde047' : '#f8fafc'; ctx.font = '10px "Press Start 2P", monospace'; ctx.fillText('MINER RESCUED!', 160, 40); ctx.textAlign = 'left';
    }
    if (this.state === 'dying') {
      const msg = { power: 'OUT OF POWER', hazard: 'TOO HOT / TOO WET', enemy: 'GOT YOU', dynamite: 'TOO CLOSE!' }[this.deathCause] || '';
      ctx.textAlign = 'center'; ctx.fillStyle = '#f87171'; ctx.font = '8px "Press Start 2P", monospace'; ctx.fillText(msg, 160, 30); ctx.textAlign = 'left';
    }
  }
  renderHud() {
    const ctx = this.ctx, y = VH;
    ctx.fillStyle = '#0F1923'; ctx.fillRect(0, y, VW, HUD_H);
    ctx.fillStyle = '#1B2A4A'; ctx.fillRect(0, y, VW, 1);
    ctx.font = '7px "Press Start 2P", monospace'; ctx.fillStyle = '#94a3b8';
    ctx.fillText('SCORE', 4, y + 9); ctx.fillStyle = '#f8fafc'; ctx.fillText(String(this.score).padStart(6, '0'), 4, y + 19);
    // power bar
    const bx = 62, bw = 96, frac = Math.max(0, this.power / this.level.power);
    ctx.fillStyle = '#94a3b8'; ctx.fillText('POWER', bx, y + 9);
    ctx.fillStyle = '#1B2A4A'; ctx.fillRect(bx, y + 12, bw, 7);
    const col = frac > 0.5 ? '#0891B2' : frac > 0.25 ? '#D97706' : (this.frame >> 3 & 1 ? '#DC2626' : '#7f1d1d');
    ctx.fillStyle = col; ctx.fillRect(bx, y + 12, Math.round(bw * frac), 7);
    ctx.fillStyle = '#f8fafc'; ctx.fillText(String(Math.ceil(this.power)), bx + bw + 4, y + 19);
    // lives
    ctx.fillStyle = '#94a3b8'; ctx.fillText('MEN', 196, y + 9);
    for (let i = 0; i < Math.min(this.lives, 5); i++) ctx.drawImage(sprites.life, 196 + i * 9, y + 11);
    if (this.lives > 5) { ctx.fillStyle = '#f8fafc'; ctx.fillText('+' + (this.lives - 5), 242, y + 19); }
    // dynamite
    ctx.fillStyle = '#94a3b8'; ctx.fillText('TNT', 258, y + 9);
    for (let i = 0; i < this.dynamite; i++) ctx.drawImage(sprites.dynamite, 258 + i * 5, y + 11);
    // level
    ctx.fillStyle = '#22d3ee'; ctx.textAlign = 'right'; ctx.fillText('C' + (this.levelIndex + 1), VW - 3, y + 9);
    ctx.fillStyle = '#94a3b8'; ctx.fillText(this.sx + ',' + this.sy, VW - 3, y + 19); ctx.textAlign = 'left';
  }
}

return { Game, Sfx, parseLevel, validateLevel, initAssets, get sprites() { initAssets(); return sprites; }, get tiles() { initAssets(); return tilesImg; },
  TILE, SW, SH, VW, VH, CH, ENT_CHAR, ENT_NAMES, CHAR_TILE, SCORE };
})();
