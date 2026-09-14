// Validates the built-in caverns: dimensions, characters, one start, one miner, miner reachable.
// Exits non-zero on any problem so CI can block a broken cavern.
const path = require('path');
const { HERO_LEVELS } = require(path.join(__dirname, '..', 'js', 'levels.js'));
let bad = 0;
for (const L of HERO_LEVELS) {
  const cols = L.sw * 20, rows = L.sh * 12, errs = [];
  if (L.map.length !== rows) errs.push('has ' + L.map.length + ' rows, expected ' + rows);
  L.map.forEach((r, i) => { if (r.length !== cols) errs.push('row ' + i + ' is ' + r.length + ' wide, expected ' + cols); });
  let P = null, M = null;
  L.map.forEach((r, y) => [...r].forEach((c, x) => {
    if (c === 'P') { if (P) errs.push('more than one start'); P = [x, y]; }
    if (c === 'M') { if (M) errs.push('more than one miner'); M = [x, y]; }
    if (!'.#WL~PMbsmnlr'.includes(c)) errs.push('unknown character "' + c + '" at ' + x + ',' + y);
  }));
  if (!P) errs.push('no start (P)'); if (!M) errs.push('no miner (M)');
  if (P && M) {
    const seen = new Set([P.join(',')]), q = [P]; let found = false;
    while (q.length) {
      const [x, y] = q.shift(); if (x === M[0] && y === M[1]) { found = true; break; }
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
        const c = L.map[ny][nx]; if (c === '#' || c === 'L' || c === '~') continue;
        const k = nx + ',' + ny; if (!seen.has(k)) { seen.add(k); q.push([nx, ny]); }
      }
    }
    if (!found) errs.push('miner unreachable from start');
  }
  console.log((errs.length ? 'FAIL ' : 'ok   ') + L.name.padEnd(16) + ' ' + L.sw + 'x' + L.sh + (errs.length ? '  ' + errs.join('; ') : ''));
  bad += errs.length;
}
process.exit(bad ? 1 : 0);
