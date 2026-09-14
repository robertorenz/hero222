/* ============================================================
   H.E.R.O. Revamped - app shell: menus, modals, storage, wiring
   ============================================================ */
(() => {
'use strict';
const $ = s => document.querySelector(s), $$ = s => Array.from(document.querySelectorAll(s));
const Store = {
  get(k, d) { try { const v = localStorage.getItem('hero222.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('hero222.' + k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } }
};

/* ---------- modal system (no alerts, ever) ---------- */
const modalRoot = $('#modal-root');
let modalStack = [];
function showModal({ title, html, body, buttons, closable = true, wide = false, onOpen }) {
  return new Promise(resolve => {
    const wrap = document.createElement('div'); wrap.className = 'modal-backdrop';
    const box = document.createElement('div'); box.className = 'modal' + (wide ? ' modal-wide' : ''); box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true');
    const h = document.createElement('div'); h.className = 'modal-head';
    const t = document.createElement('h2'); t.textContent = title; h.appendChild(t);
    if (closable) { const x = document.createElement('button'); x.className = 'modal-x'; x.type = 'button'; x.setAttribute('aria-label', 'Close'); x.innerHTML = '&times;'; x.addEventListener('click', () => close(null)); h.appendChild(x); }
    box.appendChild(h);
    const b = document.createElement('div'); b.className = 'modal-body'; if (html) b.innerHTML = html; if (body) b.appendChild(body); box.appendChild(b);
    const f = document.createElement('div'); f.className = 'modal-foot';
    (buttons || [{ label: 'OK', primary: true, value: true }]).forEach(btn => {
      const el = document.createElement('button'); el.type = 'button'; el.className = 'btn ' + (btn.primary ? 'btn-primary' : btn.danger ? 'btn-danger' : 'btn-ghost'); el.textContent = btn.label;
      el.addEventListener('click', () => { if (btn.onClick && btn.onClick(box) === false) return; close(btn.value === undefined ? btn.label : btn.value); }); f.appendChild(el);
    });
    box.appendChild(f); wrap.appendChild(box); modalRoot.appendChild(wrap);
    const onKey = e => { if (e.key === 'Escape' && closable) { e.stopPropagation(); close(null); } };
    wrap.addEventListener('keydown', onKey);
    requestAnimationFrame(() => { wrap.classList.add('open'); const first = box.querySelector('input,textarea,select,.btn-primary,button'); if (first) first.focus(); });
    const entry = { wrap };
    modalStack.push(entry);
    function close(v) { modalStack = modalStack.filter(m => m !== entry); wrap.classList.remove('open'); setTimeout(() => wrap.remove(), 160); resolve(v); }
    if (onOpen) onOpen(box, close);
  });
}
const modalOpen = () => modalStack.length > 0;

/* ---------- views ---------- */
const views = { menu: $('#view-menu'), game: $('#view-game'), editor: $('#view-editor') };
let current = 'menu';
function showView(name) {
  current = name;
  for (const k in views) views[k].hidden = k !== name;
  $$('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === name));
  game.setActive(name === 'game');
  if (name === 'game') fitCanvas();
  if (name === 'editor') Editor.render();
}

/* ---------- game wiring ---------- */
const canvas = $('#game');
let session = { levels: HERO_LEVELS, mode: 'campaign', startIndex: 0 };
const game = new HERO.Game(canvas, {
  onLevelComplete(r) {
    if (session.mode === 'campaign') {
      const prog = Store.get('progress', 0); if (r.levelIndex + 1 > prog) Store.set('progress', Math.min(HERO_LEVELS.length - 1, r.levelIndex + 1));
      const best = Store.get('best', {}); if (!best[r.levelIndex] || r.score > best[r.levelIndex]) { best[r.levelIndex] = r.score; Store.set('best', best); }
    }
    const rows = [['Miner rescued', r.rescue], ['Power remaining', r.bonusPower], ['Dynamite left', r.bonusDyn]];
    const html = '<p class="lead">Cavern ' + (r.levelIndex + 1) + ' · ' + esc(r.name) + '</p><table class="tally">' + rows.map(([k, v]) => '<tr><td>' + k + '</td><td class="num">+' + v + '</td></tr>').join('') + '<tr class="total"><td>Score</td><td class="num">' + r.score + '</td></tr></table>';
    const buttons = [];
    if (r.hasNext) buttons.push({ label: 'Next cavern', primary: true, value: 'next' });
    else buttons.push({ label: session.mode === 'test' ? 'Back to editor' : 'Finish', primary: true, value: 'done' });
    showModal({ title: r.hasNext ? 'Miner rescued!' : (session.mode === 'test' ? 'Test complete' : 'All miners rescued!'), html, buttons, closable: false }).then(v => {
      if (v === 'next') { game.nextLevel(); return; }
      endSession(r.score, true);
    });
  },
  onGameOver(r) {
    const hs = Store.get('highscore', 0), isNew = r.score > hs && session.mode === 'campaign';
    if (isNew) Store.set('highscore', r.score);
    showModal({ title: 'Game over', html: '<p class="lead">' + (isNew ? 'New high score!' : 'The caverns keep their secrets.') + '</p><table class="tally"><tr><td>Score</td><td class="num">' + r.score + '</td></tr><tr><td>Miners rescued</td><td class="num">' + r.rescued + '</td></tr><tr><td>Reached</td><td class="num">Cavern ' + (r.level + 1) + '</td></tr></table>',
      buttons: [{ label: 'Try again', primary: true, value: 'retry' }, { label: session.mode === 'test' ? 'Back to editor' : 'Main menu', value: 'menu' }], closable: false })
      .then(v => { if (v === 'retry') game.start(session.levels, session.mode === 'campaign' ? game.levelIndex : session.startIndex, {}); else endSession(r.score, false); });
  },
  onPauseMenu() {
    showModal({ title: 'Paused', html: '<p>' + esc(game.level.name) + ' · Cavern ' + (game.levelIndex + 1) + '</p><p class="muted">' + esc(game.level.tip || '') + '</p>',
      buttons: [{ label: 'Resume', primary: true, value: 'resume' }, { label: 'Restart cavern', value: 'restart' }, { label: session.mode === 'test' ? 'Back to editor' : 'Quit to menu', danger: true, value: 'quit' }] })
      .then(v => { if (v === 'restart') game.start(session.levels, game.levelIndex, {}); else if (v === 'quit') endSession(game.score, false); else game.resume(); });
  }
});
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function startGame(levels, index, mode) {
  session = { levels, mode, startIndex: index };
  showView('game'); game.start(levels, index, {});
  updateMenu();
}
function endSession() { game.state = 'idle'; game.setActive(false); showView(session.mode === 'test' ? 'editor' : 'menu'); updateMenu(); }

function fitCanvas() {
  const wrap = $('#game-wrap'); const w = wrap.clientWidth - 8, h = Math.max(200, window.innerHeight - wrap.getBoundingClientRect().top - 90);
  let s = Math.floor(Math.min(w / HERO.VW, h / HERO.CH)); if (s < 1) s = Math.min(w / HERO.VW, h / HERO.CH);
  canvas.style.width = Math.floor(HERO.VW * s) + 'px'; canvas.style.height = Math.floor(HERO.CH * s) + 'px';
}
window.addEventListener('resize', () => { if (current === 'game') fitCanvas(); });

/* touch controls */
$$('#touch button').forEach(b => {
  const k = b.dataset.key;
  const on = e => { e.preventDefault(); game.setKey(k, true); b.classList.add('down'); };
  const off = e => { e.preventDefault(); game.setKey(k, false); b.classList.remove('down'); };
  b.addEventListener('touchstart', on, { passive: false }); b.addEventListener('touchend', off); b.addEventListener('touchcancel', off);
  b.addEventListener('mousedown', on); b.addEventListener('mouseup', off); b.addEventListener('mouseleave', off);
});

/* ---------- menu ---------- */
function updateMenu() {
  $('#hs').textContent = String(Store.get('highscore', 0)).padStart(6, '0');
  const prog = Store.get('progress', 0);
  $('#progress-note').textContent = prog > 0 ? 'Furthest cavern reached: ' + (prog + 1) + ' of ' + HERO_LEVELS.length : 'No caverns explored yet';
  const custom = Store.get('custom', []);
  $('#custom-count').textContent = custom.length ? custom.length + ' custom cavern' + (custom.length === 1 ? '' : 's') : 'No custom caverns yet';
  $('#btn-custom').disabled = custom.length === 0;
}
$('#btn-start').addEventListener('click', () => startGame(HERO_LEVELS, 0, 'campaign'));
$('#btn-continue').addEventListener('click', () => startGame(HERO_LEVELS, Store.get('progress', 0), 'campaign'));
$('#btn-select').addEventListener('click', () => {
  const prog = Store.get('progress', 0), best = Store.get('best', {});
  const grid = document.createElement('div'); grid.className = 'level-grid';
  HERO_LEVELS.forEach((L, i) => {
    const locked = i > prog;
    const b = document.createElement('button'); b.type = 'button'; b.className = 'level-card' + (locked ? ' locked' : ''); b.disabled = locked;
    b.innerHTML = '<span class="lv-num">' + (i + 1) + '</span><span class="lv-name">' + esc(L.name) + '</span><span class="lv-meta">' + L.sw + '×' + L.sh + ' screens · ' + L.power + 's power</span><span class="lv-best">' + (locked ? 'Locked' : (best[i] ? 'Best ' + best[i] : 'Not cleared')) + '</span>';
    b.addEventListener('click', () => { closeAll(); startGame(HERO_LEVELS, i, 'campaign'); });
    grid.appendChild(b);
  });
  showModal({ title: 'Select cavern', body: grid, wide: true, html: '<p class="muted">Caverns unlock as you rescue miners. Every layout is fixed, so learn the route.</p>', buttons: [{ label: 'Close', value: null }] });
});
function closeAll() { modalStack.slice().forEach(m => { m.wrap.classList.remove('open'); setTimeout(() => m.wrap.remove(), 160); }); modalStack = []; }
$('#btn-custom').addEventListener('click', () => {
  const custom = Store.get('custom', []); if (!custom.length) return;
  const list = document.createElement('div'); list.className = 'level-grid';
  custom.forEach((L, i) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'level-card';
    b.innerHTML = '<span class="lv-num">' + (i + 1) + '</span><span class="lv-name">' + esc(L.name) + '</span><span class="lv-meta">' + L.sw + '×' + L.sh + ' screens · ' + L.power + 's power</span><span class="lv-best">Custom</span>';
    b.addEventListener('click', () => { closeAll(); startGame(custom, i, 'custom'); });
    list.appendChild(b);
  });
  showModal({ title: 'Custom caverns', body: list, wide: true, html: '<p class="muted">Play your own caverns in order, starting from the one you pick.</p>', buttons: [{ label: 'Play all from the start', primary: true, value: 'all' }, { label: 'Close', value: null }] })
    .then(v => { if (v === 'all') startGame(custom, 0, 'custom'); });
});
$('#btn-help').addEventListener('click', showHelp);
$('#nav-help').addEventListener('click', showHelp);
function showHelp() {
  showModal({ title: 'How to play', wide: true, html: `
    <p class="lead">Fly Roderick Hero down the mine, rescue the trapped miner, and get out before the power pack runs dry.</p>
    <div class="help-cols">
      <div><h3>Controls</h3>
        <table class="keys">
          <tr><td><kbd>←</kbd> <kbd>→</kbd> / <kbd>A</kbd> <kbd>D</kbd></td><td>Walk or steer</td></tr>
          <tr><td><kbd>↑</kbd> / <kbd>W</kbd></td><td>Helicopter pack (hold to fly)</td></tr>
          <tr><td><kbd>Space</kbd> / <kbd>Z</kbd></td><td>Helmet laser</td></tr>
          <tr><td><kbd>↓</kbd> / <kbd>X</kbd></td><td>Drop dynamite (must be standing)</td></tr>
          <tr><td><kbd>P</kbd></td><td>Pause</td></tr>
          <tr><td><kbd>Esc</kbd></td><td>Pause menu</td></tr>
        </table></div>
      <div><h3>The caverns</h3>
        <ul>
          <li><b>Walls</b> fall to dynamite, or to a long laser burn.</li>
          <li><b>Lava</b> and <b>water</b> kill on touch. Fly over water or ride a raft.</li>
          <li><b>Bats, spiders, moths, snakes</b> kill on touch. The laser kills them (50 pts).</li>
          <li><b>Lanterns</b> light the screen. Shoot one and you'll be flying blind.</li>
          <li>Stand next to a wall, drop dynamite, then get at least two tiles away. It's a 1.5 s fuse.</li>
          <li>Power drains constantly. Rescue bonus: 1000 + 10 per power unit + 50 per dynamite stick left.</li>
          <li>Extra life every 20,000 points. Dying sends you back to where you entered the screen.</li>
        </ul></div>
    </div>`, buttons: [{ label: 'Got it', primary: true, value: true }] });
}
$('#btn-sound').addEventListener('click', toggleSound);
function toggleSound() { const m = !HERO.Sfx.muted; HERO.Sfx.setMuted(m); Store.set('muted', m); $('#btn-sound').textContent = m ? 'Sound: off' : 'Sound: on'; }
if (Store.get('muted', false)) { HERO.Sfx.setMuted(true); $('#btn-sound').textContent = 'Sound: off'; }

$$('.nav-btn').forEach(b => b.addEventListener('click', () => {
  const v = b.dataset.view;
  if (current === 'game' && v !== 'game' && game.state !== 'idle') {
    showModal({ title: 'Leave the cavern?', html: '<p>Your current run will be lost.</p>', buttons: [{ label: 'Leave', danger: true, value: true }, { label: 'Stay', value: false }] }).then(ok => { if (ok) { game.state = 'idle'; showView(v); } else game.resume(); });
    return;
  }
  showView(v);
}));

/* ---------- editor wiring ---------- */
Editor.init({ isActive: () => current === 'editor' && !modalOpen() });
$('#ed-new').addEventListener('click', () => {
  const body = document.createElement('div'); body.innerHTML = '<label>Screens wide <select id="new-sw">' + [1, 2, 3, 4].map(n => '<option>' + n + '</option>').join('') + '</select></label><label>Screens tall <select id="new-sh">' + [1, 2, 3, 4, 5, 6, 7, 8].map(n => '<option' + (n === 2 ? ' selected' : '') + '>' + n + '</option>').join('') + '</select></label>';
  body.className = 'form-row';
  confirmDiscard().then(ok => { if (!ok) return; showModal({ title: 'New cavern', body, buttons: [{ label: 'Create', primary: true, value: true }, { label: 'Cancel', value: false }] }).then(v => { if (v) Editor.newLevel(+body.querySelector('#new-sw').value, +body.querySelector('#new-sh').value); }); });
});
function confirmDiscard() { if (!Editor.dirty) return Promise.resolve(true); return showModal({ title: 'Unsaved changes', html: '<p>The cavern you are editing has unsaved changes. Continue anyway?</p>', buttons: [{ label: 'Discard changes', danger: true, value: true }, { label: 'Keep editing', value: false }] }).then(v => !!v); }
$('#ed-load').addEventListener('click', () => {
  confirmDiscard().then(ok => {
    if (!ok) return;
    const custom = Store.get('custom', []);
    const body = document.createElement('div');
    const mk = (title, arr, isCustom) => {
      const h = document.createElement('h3'); h.textContent = title; body.appendChild(h);
      if (!arr.length) { const p = document.createElement('p'); p.className = 'muted'; p.textContent = 'Nothing saved yet.'; body.appendChild(p); return; }
      const ul = document.createElement('div'); ul.className = 'load-list';
      arr.forEach((L, i) => {
        const row = document.createElement('div'); row.className = 'load-row';
        const b = document.createElement('button'); b.type = 'button'; b.className = 'btn btn-ghost'; b.textContent = L.name + '  (' + L.sw + '×' + L.sh + ')';
        b.addEventListener('click', () => { closeAll(); Editor.fromDef(JSON.parse(JSON.stringify(L))); if (!isCustom) Editor.dirty = false; });
        row.appendChild(b);
        if (isCustom) { const d = document.createElement('button'); d.type = 'button'; d.className = 'btn btn-danger btn-sm'; d.textContent = 'Delete'; d.addEventListener('click', () => {
          showModal({ title: 'Delete cavern', html: '<p>Delete <b>' + esc(L.name) + '</b> permanently?</p>', buttons: [{ label: 'Delete', danger: true, value: true }, { label: 'Cancel', value: false }] }).then(v => { if (v) { custom.splice(i, 1); Store.set('custom', custom); row.remove(); updateMenu(); } });
        }); row.appendChild(d); }
        ul.appendChild(row);
      });
      body.appendChild(ul);
    };
    mk('Your caverns', custom, true); mk('Built-in caverns (open a copy)', HERO_LEVELS, false);
    showModal({ title: 'Open cavern', body, wide: true, buttons: [{ label: 'Close', value: null }] });
  });
});
$('#ed-save').addEventListener('click', () => {
  const def = Editor.toDef(), v = Editor.validate();
  const custom = Store.get('custom', []), idx = custom.findIndex(c => c.name === def.name);
  const problems = v.errors.length ? '<p class="warn">This cavern is not playable yet:</p><ul>' + v.errors.map(e => '<li>' + esc(e) + '</li>').join('') + '</ul>' : '';
  showModal({ title: idx >= 0 ? 'Replace cavern?' : 'Save cavern', html: problems + '<p>' + (idx >= 0 ? 'A cavern named <b>' + esc(def.name) + '</b> already exists and will be replaced.' : 'Save <b>' + esc(def.name) + '</b> to this browser?') + '</p>',
    buttons: [{ label: idx >= 0 ? 'Replace' : 'Save', primary: true, value: true }, { label: 'Cancel', value: false }] }).then(ok => {
      if (!ok) return; if (idx >= 0) custom[idx] = def; else custom.push(def); Store.set('custom', custom); Editor.dirty = false; updateMenu();
      showModal({ title: 'Saved', html: '<p><b>' + esc(def.name) + '</b> is saved. Find it under Custom caverns on the main menu.</p>' });
    });
});
$('#ed-validate').addEventListener('click', () => {
  const v = Editor.validate();
  const html = (v.ok ? '<p class="ok">The cavern is playable.</p>' : '<p class="warn">Fix these before playing:</p><ul>' + v.errors.map(e => '<li>' + esc(e) + '</li>').join('') + '</ul>') + (v.warnings.length ? '<p class="muted">Notes:</p><ul>' + v.warnings.map(e => '<li>' + esc(e) + '</li>').join('') + '</ul>' : '');
  showModal({ title: 'Check cavern', html });
});
$('#ed-test').addEventListener('click', () => {
  const v = Editor.validate();
  if (!v.ok) { showModal({ title: 'Not playable yet', html: '<ul>' + v.errors.map(e => '<li>' + esc(e) + '</li>').join('') + '</ul>' }); return; }
  startGame([Editor.toDef()], 0, 'test');
});
$('#ed-export').addEventListener('click', () => {
  const json = JSON.stringify(Editor.toDef(), null, 1).replace(/\[\n\s+"/g, '[\n  "').replace(/",\n\s+"/g, '",\n  "').replace(/"\n\s+\]/g, '"\n ]');
  const body = document.createElement('div'); const ta = document.createElement('textarea'); ta.readOnly = true; ta.value = json; ta.rows = 14; body.appendChild(ta);
  showModal({ title: 'Export cavern', body, wide: true, html: '<p class="muted">Copy this JSON to share the cavern. Paste it into Import on any copy of the game.</p>',
    buttons: [{ label: 'Copy to clipboard', primary: true, value: 'copy', onClick: () => { ta.select(); try { navigator.clipboard.writeText(ta.value); } catch (e) { document.execCommand('copy'); } return false; } }, { label: 'Close', value: null }] });
});
$('#ed-import').addEventListener('click', () => {
  const body = document.createElement('div'); const ta = document.createElement('textarea'); ta.rows = 14; ta.placeholder = 'Paste cavern JSON here'; body.appendChild(ta);
  showModal({ title: 'Import cavern', body, wide: true, buttons: [{ label: 'Import', primary: true, value: true, onClick: () => {
    let def; try { def = JSON.parse(ta.value); } catch (e) { ta.classList.add('bad'); return false; }
    if (!def || !Array.isArray(def.map)) { ta.classList.add('bad'); return false; }
    def.sw = Math.max(1, Math.min(4, +def.sw || Math.ceil((def.map[0] || '').length / 20))); def.sh = Math.max(1, Math.min(8, +def.sh || Math.ceil(def.map.length / 12)));
    Editor.fromDef(def); Editor.dirty = true; return true;
  } }, { label: 'Cancel', value: false }] });
});
$('#ed-back').addEventListener('click', () => showView('menu'));

/* ---------- boot ---------- */
updateMenu();
showView('menu');
})();
