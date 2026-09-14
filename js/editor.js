/* ============================================================
   H.E.R.O. Revamped - cavern editor
   Paints the same text-map format the built-in caverns use.
   ============================================================ */
const Editor = (() => {
'use strict';
const SW = HERO.SW, SH = HERO.SH;
const TOOLS = [
  { c: '#', name: 'Rock', key: '1', hint: 'Solid. Cannot be destroyed.' },
  { c: '.', name: 'Air', key: '2', hint: 'Open space (also the eraser).' },
  { c: 'W', name: 'Wall', key: '3', hint: 'Destroyed by dynamite or a long laser burn.' },
  { c: 'L', name: 'Lava', key: '4', hint: 'Deadly to touch. Glows in the dark.' },
  { c: '~', name: 'Water', key: '5', hint: 'Deadly to touch. Rafts float on it.' },
  { c: 'P', name: 'Start', key: '6', hint: 'Where the hero enters. One per cavern.' },
  { c: 'M', name: 'Miner', key: '7', hint: 'The goal. One per cavern.' },
  { c: 'b', name: 'Bat', key: '8', hint: 'Flies left and right across the screen.' },
  { c: 's', name: 'Spider', key: '9', hint: 'Hangs from the ceiling, drops up to 3 tiles.' },
  { c: 'm', name: 'Moth', key: '0', hint: 'Flutters around its spot.' },
  { c: 'n', name: 'Snake', key: 'Q', hint: 'Sits on the floor. Place it on the tile above solid ground.' },
  { c: 'l', name: 'Lantern', key: 'E', hint: 'Shoot it and the screen goes dark.' },
  { c: 'r', name: 'Raft', key: 'R', hint: 'Place on the row above water. Drifts along the water.' },
];
let st = null, tool = '#', ts = 12, mouse = null, history = [], future = [], rectMode = false, rectStart = null, hover = null, dirty = false;
let els = {}, cb = {};

function blank(sw, sh) {
  const cols = sw * SW, rows = sh * SH, g = [];
  for (let y = 0; y < rows; y++) { const r = []; for (let x = 0; x < cols; x++) r.push(x === 0 || y === 0 || x === cols - 1 || y === rows - 1 ? '#' : '.'); g.push(r); }
  return g;
}
function newLevel(sw, sh) {
  st = { name: 'New Cavern', power: 90, dynamite: 6, sw: sw || 1, sh: sh || 2, grid: blank(sw || 1, sh || 2), tip: '' };
  st.grid[2][2] = 'P'; st.grid[st.grid.length - 3][st.grid[0].length - 4] = 'M';
  history = []; future = []; dirty = false; syncForm(); render();
}
function fromDef(def) {
  const sw = def.sw || 1, sh = def.sh || 1, g = blank(sw, sh);
  for (let y = 0; y < g.length; y++) for (let x = 0; x < g[0].length; x++) { const c = (def.map[y] || '')[x]; g[y][x] = c === undefined ? '#' : c; }
  st = { name: def.name || 'Untitled', power: def.power || 90, dynamite: def.dynamite || 6, sw, sh, grid: g, tip: def.tip || '' };
  history = []; future = []; dirty = false; syncForm(); render();
}
function toDef() { return { name: st.name, power: +st.power, dynamite: +st.dynamite, sw: st.sw, sh: st.sh, tip: st.tip, map: st.grid.map(r => r.join('')) }; }
function snapshot() { history.push(st.grid.map(r => r.slice())); if (history.length > 80) history.shift(); future = []; dirty = true; }
function undo() { if (!history.length) return; future.push(st.grid.map(r => r.slice())); st.grid = history.pop(); render(); }
function redo() { if (!future.length) return; history.push(st.grid.map(r => r.slice())); st.grid = future.pop(); render(); }
function resize(sw, sh) {
  snapshot();
  const g = blank(sw, sh);
  for (let y = 0; y < g.length; y++) for (let x = 0; x < g[0].length; x++) {
    const inner = x > 0 && y > 0 && x < g[0].length - 1 && y < g.length - 1;
    if (inner && st.grid[y] && st.grid[y][x] !== undefined) g[y][x] = st.grid[y][x];
  }
  st.sw = sw; st.sh = sh; st.grid = g; render();
}
function setCell(x, y, c) {
  const g = st.grid; if (y < 0 || x < 0 || y >= g.length || x >= g[0].length) return;
  if (c === 'P' || c === 'M') for (const row of g) for (let i = 0; i < row.length; i++) if (row[i] === c) row[i] = '.';
  g[y][x] = c;
}
function paintRect(x0, y0, x1, y1, c) {
  const ax = Math.min(x0, x1), bx = Math.max(x0, x1), ay = Math.min(y0, y1), by = Math.max(y0, y1);
  if (c === 'P' || c === 'M') { setCell(x1, y1, c); return; }
  for (let y = ay; y <= by; y++) for (let x = ax; x <= bx; x++) setCell(x, y, c);
}
function syncForm() {
  els.name.value = st.name; els.power.value = st.power; els.dyn.value = st.dynamite; els.tip.value = st.tip;
  els.sw.value = st.sw; els.sh.value = st.sh;
}
function cellFromEvent(e) {
  const r = els.canvas.getBoundingClientRect();
  const x = Math.floor((e.clientX - r.left) / ts), y = Math.floor((e.clientY - r.top) / ts);
  if (x < 0 || y < 0 || x >= st.grid[0].length || y >= st.grid.length) return null;
  return { x, y };
}
function render() {
  const g = st.grid, cols = g[0].length, rows = g.length, c = els.canvas, ctx = c.getContext('2d');
  c.width = cols * ts; c.height = rows * ts; ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#0b1220'; ctx.fillRect(0, 0, c.width, c.height);
  const T = HERO.tiles, S = HERO.sprites;
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const ch = g[y][x], px = x * ts, py = y * ts;
    if (ch === '#') ctx.drawImage(T.rock[(x * 7 + y * 13) & 3], px, py, ts, ts);
    else if (ch === 'W') ctx.drawImage(T.wall, px, py, ts, ts);
    else if (ch === 'L') ctx.drawImage(T.lava[0], px, py, ts, ts);
    else if (ch === '~') ctx.drawImage(T.water[0], px, py, ts, ts);
  }
  const k = ts / 16;
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const ch = g[y][x], px = x * ts, py = y * ts;
    if ('.#WL~'.includes(ch)) continue;
    const spr = { P: S.hero[0][0], M: S.miner, b: S.bat0, s: S.spider, m: S.moth0, n: S.snake0, l: S.lantern, r: S.raft }[ch];
    if (!spr) continue;
    if (ch === 'r') ctx.drawImage(spr, px - 8 * k, py + 12 * k, 32 * k, 6 * k);
    else ctx.drawImage(spr, px + (16 - spr.width) / 2 * k, py + (16 - spr.height) * k, spr.width * k, spr.height * k);
    if (ch === 'P' || ch === 'M') { ctx.strokeStyle = ch === 'P' ? '#22d3ee' : '#fde047'; ctx.lineWidth = 1; ctx.strokeRect(px + 0.5, py + 0.5, ts - 1, ts - 1); }
  }
  // grid + screen boundaries
  ctx.strokeStyle = 'rgba(148,163,184,0.10)'; ctx.lineWidth = 1; ctx.beginPath();
  for (let x = 0; x <= cols; x++) { ctx.moveTo(x * ts + 0.5, 0); ctx.lineTo(x * ts + 0.5, rows * ts); }
  for (let y = 0; y <= rows; y++) { ctx.moveTo(0, y * ts + 0.5); ctx.lineTo(cols * ts, y * ts + 0.5); }
  ctx.stroke();
  ctx.strokeStyle = 'rgba(34,211,238,0.75)'; ctx.lineWidth = 2; ctx.beginPath();
  for (let x = 0; x <= st.sw; x++) { ctx.moveTo(x * SW * ts, 0); ctx.lineTo(x * SW * ts, rows * ts); }
  for (let y = 0; y <= st.sh; y++) { ctx.moveTo(0, y * SH * ts); ctx.lineTo(cols * ts, y * SH * ts); }
  ctx.stroke();
  ctx.fillStyle = 'rgba(34,211,238,0.9)'; ctx.font = '10px "IBM Plex Mono", monospace';
  for (let y = 0; y < st.sh; y++) for (let x = 0; x < st.sw; x++) ctx.fillText('screen ' + x + ',' + y, x * SW * ts + 4, y * SH * ts + 12);
  if (rectStart && hover) { ctx.strokeStyle = '#D97706'; ctx.lineWidth = 2; const ax = Math.min(rectStart.x, hover.x), ay = Math.min(rectStart.y, hover.y), bx = Math.max(rectStart.x, hover.x), by = Math.max(rectStart.y, hover.y); ctx.strokeRect(ax * ts + 1, ay * ts + 1, (bx - ax + 1) * ts - 2, (by - ay + 1) * ts - 2); }
  else if (hover) { ctx.strokeStyle = '#f8fafc'; ctx.lineWidth = 1; ctx.strokeRect(hover.x * ts + 0.5, hover.y * ts + 0.5, ts - 1, ts - 1); }
  els.status.textContent = hover ? 'tile ' + hover.x + ',' + hover.y + '  ·  screen ' + Math.floor(hover.x / SW) + ',' + Math.floor(hover.y / SH) + '  ·  ' + (TOOLS.find(t => t.c === st.grid[hover.y][hover.x]) || { name: '?' }).name : 'Click or drag to paint. Right-click erases. Shift-drag fills a rectangle.';
}
function buildToolbar() {
  els.tools.innerHTML = '';
  const S = HERO.sprites, T = HERO.tiles;
  for (const t of TOOLS) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'tool' + (t.c === tool ? ' active' : ''); b.dataset.c = t.c; b.title = t.hint + ' (' + t.key + ')';
    const ic = document.createElement('canvas'); ic.width = 24; ic.height = 24; const x = ic.getContext('2d'); x.imageSmoothingEnabled = false;
    x.fillStyle = '#0b1220'; x.fillRect(0, 0, 24, 24);
    const img = { '#': T.rock[0], 'W': T.wall, 'L': T.lava[0], '~': T.water[0], P: S.hero[0][0], M: S.miner, b: S.bat0, s: S.spider, m: S.moth0, n: S.snake0, l: S.lantern, r: S.raft }[t.c];
    if (img) { const k = Math.min(24 / img.width, 24 / img.height, 1.5); x.drawImage(img, (24 - img.width * k) / 2, (24 - img.height * k) / 2, img.width * k, img.height * k); }
    b.appendChild(ic);
    const s = document.createElement('span'); s.textContent = t.name; b.appendChild(s);
    const kk = document.createElement('kbd'); kk.textContent = t.key; b.appendChild(kk);
    b.addEventListener('click', () => setTool(t.c));
    els.tools.appendChild(b);
  }
}
function setTool(c) { tool = c; els.tools.querySelectorAll('.tool').forEach(b => b.classList.toggle('active', b.dataset.c === c)); const t = TOOLS.find(t => t.c === c); els.toolHint.textContent = t ? t.name + ' — ' + t.hint : ''; }

function init(opts) {
  cb = opts;
  els = { canvas: document.getElementById('editor-canvas'), tools: document.getElementById('editor-tools'), toolHint: document.getElementById('editor-tool-hint'), status: document.getElementById('editor-status'),
    name: document.getElementById('ed-name'), power: document.getElementById('ed-power'), dyn: document.getElementById('ed-dyn'), tip: document.getElementById('ed-tip'), sw: document.getElementById('ed-sw'), sh: document.getElementById('ed-sh'), zoom: document.getElementById('ed-zoom') };
  buildToolbar(); setTool('#');
  newLevel(1, 2);
  const c = els.canvas;
  c.addEventListener('contextmenu', e => e.preventDefault());
  c.addEventListener('mousedown', e => {
    const cell = cellFromEvent(e); if (!cell) return;
    const ch = e.button === 2 ? '.' : tool;
    if (e.shiftKey || rectMode) { rectStart = cell; mouse = { ch }; render(); return; }
    snapshot(); mouse = { ch }; setCell(cell.x, cell.y, ch); render();
  });
  c.addEventListener('mousemove', e => {
    const cell = cellFromEvent(e); hover = cell;
    if (mouse && !rectStart && cell && !'PM'.includes(mouse.ch)) setCell(cell.x, cell.y, mouse.ch);
    render();
  });
  c.addEventListener('mouseleave', () => { hover = null; render(); });
  window.addEventListener('mouseup', e => {
    if (rectStart && hover) { snapshot(); paintRect(rectStart.x, rectStart.y, hover.x, hover.y, mouse ? mouse.ch : tool); }
    rectStart = null; mouse = null; render();
  });
  window.addEventListener('keydown', e => {
    if (!cb.isActive || !cb.isActive()) return;
    if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyY') { e.preventDefault(); redo(); return; }
    const t = TOOLS.find(t => t.key === e.key.toUpperCase()); if (t) setTool(t.c);
  });
  els.name.addEventListener('input', () => { st.name = els.name.value; dirty = true; });
  els.tip.addEventListener('input', () => { st.tip = els.tip.value; dirty = true; });
  els.power.addEventListener('change', () => { st.power = Math.max(10, Math.min(600, +els.power.value || 90)); els.power.value = st.power; dirty = true; });
  els.dyn.addEventListener('change', () => { st.dynamite = Math.max(0, Math.min(12, +els.dyn.value || 0)); els.dyn.value = st.dynamite; dirty = true; });
  els.sw.addEventListener('change', () => resize(+els.sw.value, st.sh));
  els.sh.addEventListener('change', () => resize(st.sw, +els.sh.value));
  els.zoom.addEventListener('change', () => { ts = +els.zoom.value; render(); });
  document.getElementById('ed-rect').addEventListener('change', e => { rectMode = e.target.checked; });
  document.getElementById('ed-undo').addEventListener('click', undo);
  document.getElementById('ed-redo').addEventListener('click', redo);
  document.getElementById('ed-fill-rock').addEventListener('click', () => { snapshot(); for (const r of st.grid) r.fill('#'); render(); });
  document.getElementById('ed-clear').addEventListener('click', () => { snapshot(); st.grid = blank(st.sw, st.sh); render(); });
}
return {
  init, newLevel, fromDef, toDef, render, undo, redo,
  get dirty() { return dirty; }, set dirty(v) { dirty = v; },
  get name() { return st ? st.name : ''; },
  validate: () => HERO.validateLevel(toDef()),
};
})();
