/* SlimTucci Workout Diary — single-file app, no backend. Data lives in localStorage on the device. */
(function () {
  'use strict';
  const KEY = 'slimtucci-diary-v1';
  const DAY = 86400000;
  const $app = document.getElementById('app');

  // ---------- utils ----------
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const DOW_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const pad = (n) => String(n).padStart(2, '0');
  function todayStr() { const d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  // Dates are plain 'YYYY-MM-DD' strings; math is done in UTC so DST never shifts a day.
  function toMs(s) { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); }
  function fromMs(ms) { const d = new Date(ms); return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); }
  function addDays(s, n) { return fromMs(toMs(s) + n * DAY); }
  function dow(s) { return new Date(toMs(s)).getUTCDay(); } // 0 = Sunday
  // WEEKS RUN SUNDAY -> SATURDAY.
  function weekStart(s) { return addDays(s, -dow(s)); }          // the Sunday on/before s
  function weekEnd(s) { return addDays(weekStart(s), 6); }        // the Saturday after that Sunday
  function weekNum(s) {
    const ps = state.settings.programStart;
    if (!ps) return null;
    return Math.floor((toMs(weekStart(s)) - toMs(weekStart(ps))) / (7 * DAY)) + 1;
  }
  function rangeLabel(s) {
    const a = new Date(toMs(weekStart(s))), b = new Date(toMs(weekEnd(s)));
    const am = MON[a.getUTCMonth()], bm = MON[b.getUTCMonth()];
    let r = am === bm ? `${am} ${a.getUTCDate()}–${b.getUTCDate()}` : `${am} ${a.getUTCDate()}–${bm} ${b.getUTCDate()}`;
    if (a.getUTCFullYear() !== new Date().getFullYear() || b.getUTCFullYear() !== a.getUTCFullYear()) r += `, ${b.getUTCFullYear()}`;
    return r;
  }
  function weekLabel(s) { const n = weekNum(s); return (n != null && n >= 1 ? `Week ${n} · ` : '') + rangeLabel(s); }
  function fmtDate(s, withYear) {
    const d = new Date(toMs(s));
    let r = `${DOW[d.getUTCDay()]}, ${MON[d.getUTCMonth()]} ${d.getUTCDate()}`;
    if (withYear || d.getUTCFullYear() !== new Date().getFullYear()) r += `, ${d.getUTCFullYear()}`;
    return r;
  }
  function fmtLongDate(s) { const d = new Date(toMs(s)); return `${DOW_LONG[d.getUTCDay()]}, ${MON[d.getUTCMonth()]} ${d.getUTCDate()}`; }
  function relDay(s) { const t = todayStr(); return s === t ? 'Today' : s === addDays(t, -1) ? 'Yesterday' : s === addDays(t, 1) ? 'Tomorrow' : ''; }
  const num = (v) => (v === '' || v == null || isNaN(Number(v)) ? null : Number(v));
  const fmtW = (w) => (w == null ? 'BW' : (Math.round(w * 100) / 100).toString());
  const fmtSet = (st) => `${fmtW(num(st.weight))} × ${num(st.reps) == null ? '–' : num(st.reps)}`;
  const isLogged = (st) => num(st.weight) != null || num(st.reps) != null;
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  function topSet(sets) {
    let best = null;
    for (const st of sets || []) {
      if (!isLogged(st)) continue;
      const w = num(st.weight) ?? -1, r = num(st.reps) ?? 0;
      if (!best || w > best.w || (w === best.w && r > best.r)) best = { w, r, st };
    }
    return best ? best.st : null;
  }
  function sessionStats(list) {
    let sets = 0, vol = 0;
    for (const s of list) for (const e of s.exercises) for (const st of e.sets) {
      if (!isLogged(st)) continue;
      sets++;
      const w = num(st.weight), r = num(st.reps);
      if (w != null && r != null) vol += w * r;
    }
    return { workouts: list.length, sets, vol: Math.round(vol) };
  }
  const fmtVol = (v) => (v >= 10000 ? (v / 1000).toFixed(1) + 'k' : v.toLocaleString());

  // ---------- built-in exercise library (exercises-library.js) ----------
  const LIB = window.SLIMTUCCI_LIBRARY || { categories: [], items: [] };
  const CAT_LABEL = Object.fromEntries(LIB.categories.map((c) => [c.key, c.label]));
  const CAT_KEY = Object.fromEntries(LIB.categories.map((c) => [c.label.toLowerCase(), c.key]));
  const CHIP_SHORT = { push: 'Push', pull: 'Pull', legs: 'Legs', core: 'Core', power: 'Power & Plyo', carry: 'Carries', cardio: 'Cardio', agility: 'Agility', mobility: 'Mobility', stretch: 'Stretching' };
  const norm = (s) => String(s || '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  const LIB_ITEMS = LIB.items.map(([name, cat, sub, equip], i) => ({ i, name, cat, sub, equip, key: norm(name), hay: ' ' + norm([name, CAT_LABEL[cat], sub, equip].join(' ')) }));
  const SYN = { db: 'dumbbell', dbs: 'dumbbell', bb: 'barbell', kb: 'kettlebell', kbs: 'kettlebell', rdl: 'romanian deadlift', sldl: 'stiff leg deadlift',
    ohp: 'overhead press', mb: 'med ball', bss: 'bulgarian split squat', ghr: 'glute ham raise', sl: 'single leg', sa: 'single arm', bw: 'bodyweight',
    lat: 'lat', pulldown: 'pulldown', pullup: 'pull up', pushup: 'push up', chinup: 'chin up', situp: 'sit up', stepup: 'step up', trx: 'suspension', ez: 'ez' };
  function queryTokens(q) {
    const out = [];
    for (const t of norm(q).split(' ').filter(Boolean)) (SYN[t] ? SYN[t].split(' ') : [t]).forEach((x) => out.push(x));
    return out;
  }
  function lev(a, b) {
    if (Math.abs(a.length - b.length) > 1) return 2;
    const dp = Array.from({ length: a.length + 1 }, (_, i) => [i]);
    for (let j = 1; j <= b.length; j++) dp[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return dp[a.length][b.length];
  }
  function fuzzyWord(t, words) {
    if (t.length < 3) return false;
    return words.some((w) => (t.length >= 4 && (lev(t, w) <= 1 || lev(t, w.slice(0, t.length)) <= 1)));
  }
  // "fuzzy-ish": every token must appear (substring) or be a 1-typo match for a word in the name.
  function scoreItem(tokens, hay, key) {
    if (!tokens.length) return 0;
    let score = 0; let words = null;
    for (const t of tokens) {
      const i = hay.indexOf(t);
      if (i >= 0) { score += hay[i - 1] === ' ' ? 3 : 1; if (key.startsWith(t)) score += 2; continue; }
      words = words || key.split(' ');
      if (fuzzyWord(t, words)) { score += 0.5; continue; }
      return -1;
    }
    if (key.startsWith(tokens.join(' '))) score += 6;
    return score - key.length / 200;
  }
  const mineHay = (e) => ' ' + norm([e.name, e.cat, e.sub, e.equip].join(' '));
  function searchList(list, q, hayFn, keyFn) {
    const tokens = queryTokens(q);
    if (!tokens.length) return list.slice();
    return list.map((x) => [x, scoreItem(tokens, hayFn(x), keyFn(x))]).filter((p) => p[1] >= 0).sort((a, b) => b[1] - a[1]).map((p) => p[0]);
  }
  function catKeyOf(ex) { return CAT_KEY[String(ex.cat || '').toLowerCase()] || null; }
  function findMineByName(name) { const k = norm(name); return state.exercises.find((e) => norm(e.name) === k); }
  // add a library movement to "My exercises" (or return the existing one)
  function ensureMine(libItem) {
    const have = findMineByName(libItem.name);
    if (have) return { ex: have, created: false };
    const ex = { id: uid(), name: libItem.name, cat: CAT_LABEL[libItem.cat], sub: libItem.sub, equip: libItem.equip, notes: '' };
    state.exercises.push(ex); save();
    return { ex, created: true };
  }
  function createCustom(name, catKey) {
    const have = findMineByName(name);
    if (have) return { ex: have, created: false };
    const ex = { id: uid(), name: name.trim(), cat: catKey ? CAT_LABEL[catKey] : 'Custom', sub: '', equip: '', notes: '' };
    state.exercises.push(ex); save();
    return { ex, created: true };
  }

  // ---------- state ----------
  let state;
  function seed() {
    const names = [
      ['Barbell Back Squat', 'Legs', 'Squat'], ['Romanian Deadlift', 'Legs', 'Hinge'], ['Bulgarian Split Squat', 'Legs', 'Lunge'], ['Lateral Lunge', 'Legs', 'Lunge'],
      ['Cossack Squat', 'Legs', 'Squat'], ['Single-Leg Romanian Deadlift', 'Legs', 'Hinge'], ['Landmine Rotation', 'Core', 'Rotation'], ['Cable Woodchop', 'Core', 'Rotation'],
      ['Med Ball Rotational Throw', 'Core', 'Rotation'], ['Pallof Press', 'Core', 'Anti-Rotation'], ['Barbell Bench Press', 'Push', 'Chest'], ['Single-Arm Dumbbell Bench Press', 'Push', 'Chest'],
      ['Landmine Press', 'Push', 'Shoulders'], ['Pull-Up', 'Pull', 'Back'], ['Single-Arm Dumbbell Row', 'Pull', 'Back'], ['Single-Arm Lat Pulldown', 'Pull', 'Back'],
      ['Trap Bar Deadlift', 'Legs', 'Hinge'], ['Suitcase Carry', 'Carries & Strongman', 'Carries'], ["Farmer's Carry", 'Carries & Strongman', 'Carries'], ['Lateral Sled Drag', 'Carries & Strongman', 'Strongman & Sled']
    ];
    const ex = names.map(([name, cat, sub]) => { const li = LIB_ITEMS.find((x) => x.name === name); return { id: uid(), name, cat, sub, equip: li ? li.equip : '', notes: '' }; });
    return {
      version: 1,
      settings: { programStart: weekStart(todayStr()), samplesCleared: true },
      exercises: ex,
      templates: [],
      sessions: [],
      plans: [],
      macros: null,
      burn: null
    };
  }
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const d = normalize(JSON.parse(raw));
        // one-time cleanup: drop the starter sample workouts shipped in the first release
        if (!d.settings.samplesCleared) {
          const SAMPLE = ['Monday Lower + Rotation', 'Wednesday Upper (Unilateral)', 'Friday Upper + Rotational Core', 'Saturday Full Body (Unilateral)'];
          d.templates = d.templates.filter((t) => !SAMPLE.includes(t.name));
          d.settings.samplesCleared = true;
          localStorage.setItem(KEY, JSON.stringify(d));
        }
        return d;
      }
    } catch (e) { console.error(e); }
    const s = seed(); localStorage.setItem(KEY, JSON.stringify(s)); return s;
  }
  function normalize(d) {
    d = d && d.data && d.app === 'slimtucci-diary' ? d.data : d;
    if (!d || !Array.isArray(d.exercises) || !Array.isArray(d.templates) || !Array.isArray(d.sessions)) throw new Error('Not a SlimTucci diary backup');
    d.settings = d.settings || {};
    if (!('programStart' in d.settings)) d.settings.programStart = null;
    if (!Array.isArray(d.plans)) d.plans = [];
    if (d.macros === undefined) d.macros = null;
    if (d.burn === undefined) d.burn = null;
    // map first-release category names onto the library categories
    const LEGACY = { rotation: 'Core', carry: 'Carries & Strongman', conditioning: 'Cardio & Conditioning', 'full body': 'Legs' };
    for (const e of d.exercises) { const k = String(e.cat || '').toLowerCase(); if (LEGACY[k]) e.cat = LEGACY[k]; }
    d.version = 1;
    return d;
  }
  let saveErr = false;
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); saveErr = false; }
    catch (e) { if (!saveErr) toast('Could not save — storage full or blocked'); saveErr = true; }
  }
  state = load();

  const exById = (id) => state.exercises.find((e) => e.id === id);
  const exName = (entry) => (exById(entry.exId) || {}).name || entry.name || '(deleted exercise)';
  const sortedSessions = () => state.sessions.slice().sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt));
  const tplById = (id) => state.templates.find((t) => t.id === id);

  function lastPerformance(exId, cur) {
    let best = null;
    for (const s of state.sessions) {
      if (cur && s.id === cur.id) continue;
      if (cur && (s.date > cur.date || (s.date === cur.date && s.createdAt > cur.createdAt))) continue;
      const e = s.exercises.find((x) => x.exId === exId && x.sets.some(isLogged));
      if (!e) continue;
      if (!best || (s.date + s.createdAt) > (best.s.date + best.s.createdAt)) best = { s, e };
    }
    return best;
  }

  // ---------- ui helpers ----------
  let toastT;
  function toast(msg) {
    const t = document.getElementById('toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), 2400);
  }
  function setChrome(title, back) {
    document.getElementById('title').textContent = title;
    document.title = title === 'SlimTucci' ? 'SlimTucci Workout Diary' : `${title} · SlimTucci`;
    document.getElementById('backBtn').hidden = !back;
    const tab = location.hash.split('?')[0].split('/')[1] || 'home';
    const map = { whoop: 'settings', '': 'home', log: 'home', history: 'history', exercises: 'exercises', exercise: 'exercises', templates: 'settings', template: 'settings', settings: 'settings', macros: 'macros' };
    document.querySelectorAll('.tabbar a').forEach((a) => { const on = a.dataset.tab === (map[tab] || tab); a.classList.toggle('active', on); if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    document.body.classList.toggle('has-actionbar', tab === 'log');
  }
  function go(h) { if (location.hash === h) render(); else location.hash = h; }
  function emptyState(icon, title, sub, btnHtml) {
    return `<div class="empty"><div class="empty-ico" aria-hidden="true">${icon}</div><div class="empty-title">${title}</div>${sub ? `<div class="empty-sub">${sub}</div>` : ''}${btnHtml || ''}</div>`;
  }

  // generic bottom sheet
  function openSheet(title, bodyHtml, onClick, opts = {}) {
    const bg = document.createElement('div'); bg.className = 'sheet-bg';
    bg.innerHTML = `<div class="sheet${opts.tall ? ' tall' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="sheet-grab" aria-hidden="true"></div>
      <div class="sheet-head"><h3>${esc(title)}</h3><button class="btn ${opts.doneLabel ? 'primary' : 'ghost'} sm" data-x="close">${esc(opts.doneLabel || 'Close')}</button></div>
      <div class="sheet-body">${bodyHtml}</div></div>`;
    document.body.appendChild(bg);
    document.body.classList.add('sheet-open');
    const close = () => { bg.remove(); document.body.classList.remove('sheet-open'); if (opts.onClose) opts.onClose(); };
    bg.addEventListener('click', (ev) => {
      if (ev.target === bg) return close();
      const el = ev.target.closest('[data-x]'); if (!el) return;
      if (el.dataset.x === 'close') return close();
      onClick && onClick(el, close, bg);
    });
    return { bg, close };
  }

  // ---------- exercise browser (picker + Exercises tab share this) ----------
  function chipsHTML(active, withMine) {
    const chips = [['all', 'All']].concat(withMine ? [['mine', 'My exercises']] : []).concat(LIB.categories.map((c) => [c.key, CHIP_SHORT[c.key] || c.label]));
    return `<div class="chips" role="tablist">${chips.map(([k, l]) => `<button class="chip${k === active ? ' on' : ''}" data-chip="${k}" role="tab" aria-selected="${k === active}">${esc(l)}</button>`).join('')}</div>`;
  }
  function metaLine(cat, sub, equip) { return [cat, sub, equip].filter(Boolean).map(esc).join(' · '); }
  // returns HTML for result rows. mode: 'pick' (adds) or 'browse' (Exercises tab)
  function resultsHTML(o) {
    const { q, chip, limit, added, mode, seg } = o;
    const showMine = mode === 'pick' ? chip !== 'lib' : seg === 'mine';
    const showLib = mode === 'pick' ? chip !== 'mine' : seg === 'lib';
    let mine = [], lib = [];
    if (showMine) {
      mine = state.exercises.filter((e) => chip === 'all' || chip === 'mine' || catKeyOf(e) === chip);
      mine = searchList(mine, q, mineHay, (e) => norm(e.name));
    }
    if (showLib) {
      const mineKeys = new Set(state.exercises.map((e) => norm(e.name)));
      lib = LIB_ITEMS.filter((x) => (chip === 'all' || chip === 'mine' || x.cat === chip) && (mode === 'browse' || !mineKeys.has(x.key)));
      lib = searchList(lib, q, (x) => x.hay, (x) => x.key);
    }
    const qt = q.trim();
    const exact = qt && (state.exercises.some((e) => norm(e.name) === norm(qt)) || LIB_ITEMS.some((x) => x.key === norm(qt)));
    const customRow = qt && !exact ? `<button class="pick-row custom" data-x="custom"><span class="pr-plus" aria-hidden="true">+</span><span class="grow"><span class="pr-name">Add custom “${esc(qt)}”</span><span class="pr-meta">Saved to My exercises${chip !== 'all' && chip !== 'mine' ? ' · ' + esc(CAT_LABEL[chip]) : ''}</span></span></button>` : '';
    let h = '';
    const nothing = !mine.length && !lib.length;
    if (nothing && customRow) h += customRow;
    if (showMine) {
      if (mode === 'pick') h += `<div class="sec-title">My exercises <span class="count">${mine.length}</span></div>`;
      if (mine.length) h += mine.map((e) => {
        const isAdded = added && added.has(e.id);
        if (mode === 'pick') return `<button class="pick-row${isAdded ? ' added' : ''}" data-x="pick-mine" data-id="${e.id}"><span class="grow"><span class="pr-name">${esc(e.name)}</span><span class="pr-meta">${metaLine(e.cat, e.sub, e.equip) || 'Custom'}</span></span><span class="pr-add" aria-hidden="true">${isAdded ? '✓ Added' : '+'}</span></button>`;
        return `<div class="pick-row" data-exrow="${e.id}"><a class="grow rowlink" href="#/exercise/${e.id}"><span class="pr-name">${esc(e.name)}</span><span class="pr-meta">${metaLine(e.cat, e.sub, e.equip) || 'Custom'}${(() => { const lp = lastPerformance(e.id); const t = lp && topSet(lp.e.sets); return t ? ` · last ${fmtSet(t)}` : ''; })()}</span></a><span class="chev" aria-hidden="true">›</span></div>`;
      }).join('');
      else if (!qt && mode === 'pick') h += `<div class="sec-empty">Nothing here yet — pick from the library below.</div>`;
      else if (!qt) h += emptyState('🏋️', 'No exercises yet', 'Browse the library and tap + to add movements you use.', `<button class="btn primary" data-x="seg-lib">Browse library</button>`);
      else if (mode === 'browse' && !customRow) h += `<div class="sec-empty">No match in My exercises.</div>`;
    }
    if (showLib) {
      const shown = lib.slice(0, limit);
      if (mode === 'pick') h += `<div class="sec-title">Library <span class="count">${lib.length}</span></div>`;
      if (!lib.length && qt && !(nothing && customRow)) h += `<div class="sec-empty">No library match for “${esc(qt)}”.</div>`;
      h += shown.map((x) => {
        const mineEx = mode === 'browse' ? findMineByName(x.name) : null;
        const isAdded = added && added.has('lib:' + x.i);
        const right = mode === 'browse' ? (mineEx ? '<span class="pr-have">✓ Mine</span>' : '<span class="pr-add" aria-hidden="true">+</span>') : `<span class="pr-add" aria-hidden="true">${isAdded ? '✓ Added' : '+'}</span>`;
        return `<button class="pick-row${isAdded ? ' added' : ''}" data-x="pick-lib" data-li="${x.i}" aria-label="${esc((mineEx ? 'Open ' : 'Add ') + x.name)}"><span class="grow"><span class="pr-name">${esc(x.name)}</span><span class="pr-meta">${metaLine(x.sub === CAT_LABEL[x.cat] ? '' : x.sub, x.equip)}</span></span>${right}</button>`;
      }).join('');
      if (lib.length > shown.length) h += `<button class="btn ghost block" data-x="more">Show more (${lib.length - shown.length} more)</button>`;
    }
    if (!nothing && customRow) h += customRow;
    return h;
  }

  // the "Add exercise" picker sheet. onPick(exerciseId) is called for every tap; sheet stays open for multi-add.
  function pickExercise(title, onPick, onDone) {
    const st = { q: '', chip: 'all', limit: 60, added: new Set(), mode: 'pick' };
    const body = `<div class="picker-top"><input type="search" id="pickQ" placeholder="Search ${LIB_ITEMS.length}+ exercises" autocomplete="off" autocapitalize="off" enterkeyhint="search" aria-label="Search exercises">${chipsHTML('all', true)}</div><div id="pickList" class="pick-list"></div>`;
    let count = 0;
    const sh = openSheet(title, body, (el, close, bg) => {
      const x = el.dataset.x;
      if (x === 'pick-mine') { onPick(el.dataset.id); st.added.add(el.dataset.id); count++; toast(`Added ${exById(el.dataset.id).name}`); }
      else if (x === 'pick-lib') {
        const li = LIB_ITEMS[+el.dataset.li]; const r = ensureMine(li);
        onPick(r.ex.id); st.added.add('lib:' + li.i); st.added.add(r.ex.id); count++;
        toast(r.created ? `Added ${li.name} · saved to My exercises` : `Added ${li.name}`);
      } else if (x === 'custom') {
        const r = createCustom(st.q, st.chip !== 'all' && st.chip !== 'mine' ? st.chip : null);
        onPick(r.ex.id); st.added.add(r.ex.id); count++; toast(`Added custom “${r.ex.name}”`);
        st.q = ''; bg.querySelector('#pickQ').value = '';
      } else if (x === 'more') st.limit += 100;
      else return;
      updDone(); draw();
    }, { tall: true, doneLabel: 'Done', onClose: () => onDone && onDone(count) });
    const bg = sh.bg, list = bg.querySelector('#pickList'), q = bg.querySelector('#pickQ');
    const doneBtn = bg.querySelector('[data-x="close"]');
    function updDone() { doneBtn.textContent = count ? `Done (${count})` : 'Done'; }
    function draw() { list.innerHTML = resultsHTML(st); }
    q.addEventListener('input', () => { st.q = q.value; st.limit = 60; draw(); list.scrollTop = 0; });
    bg.querySelector('.chips').addEventListener('click', (ev) => {
      const c = ev.target.closest('[data-chip]'); if (!c) return;
      st.chip = c.dataset.chip; st.limit = 60;
      bg.querySelectorAll('.chip').forEach((b) => { b.classList.toggle('on', b === c); b.setAttribute('aria-selected', b === c); });
      draw(); list.scrollTop = 0;
    });
    draw();
    setTimeout(() => q.focus({ preventScroll: true }), 60);
  }

  // ---------- views ----------
  let selDay = todayStr();
  function dayInfo(d) {
    return { logged: state.sessions.filter((s) => s.date === d), planned: state.plans.filter((p) => p.date === d) };
  }
  function weekCard(anchor) {
    const ws = weekStart(anchor), today = todayStr();
    const inWeek = state.sessions.filter((s) => weekStart(s.date) === ws);
    const st = sessionStats(inWeek);
    const days = [0, 1, 2, 3, 4, 5, 6].map((i) => {
      const d = addDays(ws, i), info = dayInfo(d);
      const cls = ['day', d === selDay ? 'sel' : '', d === today ? 'today' : '', info.logged.length ? 'has-log' : '', info.planned.length ? 'has-plan' : ''].filter(Boolean).join(' ');
      const lab = `${DOW_LONG[i]} ${MON[new Date(toMs(d)).getUTCMonth()]} ${new Date(toMs(d)).getUTCDate()}${info.logged.length ? `, ${plural(info.logged.length, 'workout')} logged` : ''}${info.planned.length ? `, ${info.planned.length} planned` : ''}`;
      return `<button class="${cls}" data-action="sel-day" data-date="${d}" aria-pressed="${d === selDay}" aria-label="${esc(lab)}"><span class="dw">${DOW[i][0]}</span><span class="dn">${new Date(toMs(d)).getUTCDate()}</span><span class="dots"><i class="dot-log"></i><i class="dot-plan"></i></span></button>`;
    }).join('');
    const isThisWeek = ws === weekStart(today);
    return `<section class="card week" data-week="${ws}">
      <div class="week-head"><div aria-label="${esc(weekLabel(ws))}">${(() => { const n = weekNum(ws); return n != null && n >= 1 ? `<div class="week-title">Week ${n}</div><div class="week-sub">${esc(rangeLabel(ws))}${isThisWeek ? ' · This week' : ''}</div>` : `<div class="week-title">${esc(rangeLabel(ws))}</div><div class="week-sub">${isThisWeek ? 'This week' : 'Sun–Sat'}</div>`; })()}</div>
        <div class="week-nav"><button class="icon-btn" data-action="week-prev" aria-label="Previous week">‹</button>${selDay !== today ? '<button class="btn sm soft" data-action="go-today">Today</button>' : ''}<button class="icon-btn" data-action="week-next" aria-label="Next week">›</button></div></div>
      <div class="days">${days}</div>
      <div class="stats"><div class="stat"><b>${st.workouts}</b><span>Workouts</span></div><div class="stat"><b>${st.sets}</b><span>Sets</span></div><div class="stat"><b>${fmtVol(st.vol)}</b><span>Volume (lb)</span></div></div>
    </section>`;
  }
  function sessionItem(s, showDate = true) {
    const names = s.exercises.map(exName);
    const st = sessionStats([s]);
    return `<a class="list-item" href="#/log/${s.id}" data-session="${s.id}"><span class="li-ico done" aria-hidden="true">✓</span><div class="grow"><div class="title">${esc(s.name || 'Workout')}</div>
      <div class="sub">${showDate ? esc(fmtDate(s.date)) + ' · ' : ''}${plural(s.exercises.length, 'exercise')} · ${plural(st.sets, 'set')}</div>
      ${names.length ? `<div class="hist-ex">${esc(names.slice(0, 4).join(', '))}${names.length > 4 ? ` +${names.length - 4}` : ''}</div>` : ''}</div><span class="chev" aria-hidden="true">›</span></a>`;
  }

  function viewHome() {
    setChrome('SlimTucci', false);
    const info = dayInfo(selDay);
    const logged = info.logged.slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const rel = relDay(selDay);
    const plannedHTML = info.planned.map((p) => {
      const t = tplById(p.templateId);
      return `<div class="list-item planned" data-plan="${p.id}"><span class="li-ico plan" aria-hidden="true">◷</span><div class="grow"><div class="title">${esc(t ? t.name : p.name)}</div><div class="sub">Planned${t ? ` · ${plural(t.items.length, 'exercise')}` : ' · template deleted'}</div></div>
        ${t ? `<button class="btn primary sm" data-action="plan-start" data-plan="${p.id}">Start</button>` : ''}<button class="icon-btn" data-action="plan-remove" data-plan="${p.id}" aria-label="Remove planned workout">✕</button></div>`;
    }).join('');
    $app.innerHTML = `${weekCard(selDay)}
      <section class="card day-panel" id="dayPanel" data-day="${selDay}">
        <div class="day-panel-head"><div><div class="day-title">${esc(fmtLongDate(selDay))}</div>${rel ? `<div class="day-rel">${rel}</div>` : ''}</div>
          <button class="fab" data-action="day-add" aria-label="Log a workout on ${esc(fmtLongDate(selDay))}">+</button></div>
        ${logged.map((s) => sessionItem(s, false)).join('')}${plannedHTML}
        ${!logged.length && !info.planned.length ? `<div class="day-empty">No workouts on ${DOW[dow(selDay)]} — tap <b>+</b> to log one${state.templates.length ? ' or plan a template' : ''}.</div>` : ''}
        <div class="btn-row"><button class="btn primary" data-action="day-add">+ Log workout</button><button class="btn" data-action="day-plan">Plan template</button></div>
      </section>
      ${macroMiniHTML()}
      ${burnCardHTML()}
      ${state.sessions.length ? '' : `<section class="card welcome"><div class="welcome-title">Welcome to your diary 👋</div><ol class="steps"><li>Tap a day, then <b>+ Log workout</b>.</li><li>Add exercises from ${LIB_ITEMS.length}+ movements.</li><li>Enter lb and reps for each set — it saves as you type.</li></ol><a class="btn block soft" href="#/templates">Build a template for the days you repeat</a></section>`}`;
  }

  function startSheet(date) {
    const tpls = state.templates;
    const body = `<button class="pick-row big" data-x="blank"><span class="pr-plus" aria-hidden="true">+</span><span class="grow"><span class="pr-name">Blank workout</span><span class="pr-meta">Add exercises as you go</span></span></button>
      <div class="sec-title">From a template</div>
      ${tpls.length ? tpls.map((t) => `<button class="pick-row" data-x="tpl" data-tpl="${t.id}"><span class="grow"><span class="pr-name">${esc(t.name)}</span><span class="pr-meta">${plural(t.items.length, 'exercise')}</span></span><span class="pr-add" aria-hidden="true">Start</span></button>`).join('')
        : `<div class="sec-empty">No templates yet. <a href="#/templates" data-x="close">Create one</a> for workouts you repeat.</div>`}`;
    openSheet(`Log workout · ${fmtDate(date)}`, body, (el, close) => {
      if (el.dataset.x === 'blank') { close(); startWorkout(null, date); }
      if (el.dataset.x === 'tpl') { close(); startWorkout(el.dataset.tpl, date); }
    });
  }
  function planSheet(date) {
    const tpls = state.templates;
    const body = tpls.length ? `<div class="sheet-note">Pick a template to plan for ${esc(fmtLongDate(date))}. It shows on that day so you can start it with one tap.</div>` + tpls.map((t) => `<button class="pick-row" data-x="plan" data-tpl="${t.id}"><span class="grow"><span class="pr-name">${esc(t.name)}</span><span class="pr-meta">${plural(t.items.length, 'exercise')}</span></span><span class="pr-add" aria-hidden="true">Plan</span></button>`).join('')
      : emptyState('🗂️', 'No templates yet', 'Templates are saved workouts (like “Monday Lower + Rotation”) you can plan and start in one tap.', '<a class="btn primary" href="#/templates" data-x="close">Create a template</a>');
    openSheet(`Plan · ${fmtDate(date)}`, body, (el, close) => {
      if (el.dataset.x === 'plan') {
        const t = tplById(el.dataset.tpl);
        state.plans.push({ id: uid(), date, templateId: t.id, name: t.name }); save(); close(); toast(`Planned ${t.name} for ${fmtDate(date)}`); render();
      }
    });
  }

  function startWorkout(tplId, date, planId) {
    const t = tplId ? tplById(tplId) : null;
    const now = new Date().toISOString();
    const s = { id: uid(), date: date || todayStr(), name: t ? t.name : 'Workout', templateId: t ? t.id : null, notes: '', createdAt: now, updatedAt: now, exercises: [] };
    if (t) s.exercises = t.items.filter((it) => exById(it.exId)).map((it) => ({ exId: it.exId, name: exName(it), target: it.reps, notes: '', sets: Array.from({ length: Math.max(1, Number(it.sets) || 1) }, () => ({ weight: '', reps: '', done: false })) }));
    state.sessions.push(s);
    if (planId) state.plans = state.plans.filter((p) => p.id !== planId);
    selDay = s.date; save();
    go('#/log/' + s.id);
  }

  function viewLog(id) {
    const s = state.sessions.find((x) => x.id === id);
    if (!s) { setChrome('Workout', true); $app.innerHTML = emptyState('🤔', 'Workout not found', 'It may have been deleted.', '<a class="btn primary" href="#/">Back to Today</a>'); document.body.classList.remove('has-actionbar'); return; }
    setChrome(s.name || 'Workout', true);
    $app.innerHTML = `<section class="card stack">
        <div><label class="f" for="sName">Workout name</label><input id="sName" data-bind="session" data-k="name" value="${esc(s.name)}"></div>
        <div><label class="f" for="sDate">Date</label><input id="sDate" type="date" data-bind="session" data-k="date" value="${esc(s.date)}"><div class="hint" id="sWeek">${esc(weekLabel(s.date))}</div></div>
        <details class="notes"${s.notes ? ' open' : ''}><summary>Session notes</summary><textarea data-bind="session" data-k="notes" placeholder="How did it feel? Sleep, energy, niggles…">${esc(s.notes)}</textarea></details>
      </section>
      <div id="exList">${s.exercises.map((e, i) => exCard(s, e, i)).join('')}</div>
      ${s.exercises.length ? '' : emptyState('🏋️', 'No exercises yet', `Tap <b>+ Add exercise</b> to search ${LIB_ITEMS.length}+ movements or add your own.`, '<button class="btn primary" data-action="add-ex">+ Add exercise</button>')}
      <section class="more-actions"><div class="sec-title">Workout options</div>
        <div class="btn-row"><button class="btn" data-action="save-as-tpl">Save as template</button><button class="btn danger" data-action="del-session">Delete workout</button></div></section>
      <div class="actionbar" role="toolbar" aria-label="Workout actions"><button class="btn" data-action="add-ex">+ Add exercise</button><button class="btn primary" data-action="finish">Finish ✓</button></div>`;
  }
  function exCard(s, e, i) {
    const lp = lastPerformance(e.exId, s);
    const last = lp ? `Last time · ${fmtDate(lp.s.date)}: ${lp.e.sets.filter(isLogged).map(fmtSet).join(' · ')}` : 'First time logging this — set a baseline';
    const lastSets = lp ? lp.e.sets.filter(isLogged) : [];
    const exObj = exById(e.exId);
    return `<section class="ex-card" data-ei="${i}">
      <div class="ex-head"><div class="grow"><div class="ex-name">${esc(exName(e))}</div>${exObj && exObj.cat ? `<div class="ex-meta">${esc(exObj.cat)}${e.target ? ' · target ' + esc(e.target) + ' reps' : ''}</div>` : e.target ? `<div class="ex-meta">target ${esc(e.target)} reps</div>` : ''}</div>
        <button class="icon-btn sm" data-action="ex-up" data-ei="${i}" aria-label="Move up"${i === 0 ? ' disabled' : ''}>↑</button>
        <button class="icon-btn sm" data-action="ex-down" data-ei="${i}" aria-label="Move down"${i === s.exercises.length - 1 ? ' disabled' : ''}>↓</button>
        <button class="icon-btn sm danger" data-action="ex-remove" data-ei="${i}" aria-label="Remove exercise">✕</button></div>
      <div class="last${lp ? '' : ' first'}">${esc(last)}</div>
      <table class="sets"><thead><tr><th scope="col">Set</th><th scope="col">lb</th><th scope="col">Reps</th><th scope="col"><span class="sr">Done</span></th><th scope="col"><span class="sr">Remove</span></th></tr></thead><tbody>
      ${e.sets.map((st, j) => {
        const ph = lastSets[j] || lastSets[lastSets.length - 1];
        return `<tr class="${st.done ? 'done' : ''}"><td class="n">${j + 1}</td>
          <td><input type="number" inputmode="decimal" step="any" min="0" data-bind="set" data-ei="${i}" data-si="${j}" data-k="weight" value="${esc(st.weight)}" placeholder="${ph && num(ph.weight) != null ? esc(num(ph.weight)) : 'lb'}" aria-label="Set ${j + 1} weight in pounds"></td>
          <td><input type="number" inputmode="numeric" step="1" min="0" data-bind="set" data-ei="${i}" data-si="${j}" data-k="reps" value="${esc(st.reps)}" placeholder="${ph && num(ph.reps) != null ? esc(num(ph.reps)) : esc(e.target || 'reps')}" aria-label="Set ${j + 1} reps"></td>
          <td class="ck"><button class="check${st.done ? ' on' : ''}" data-action="set-done" data-ei="${i}" data-si="${j}" aria-pressed="${!!st.done}" aria-label="Mark set ${j + 1} done">✓</button></td>
          <td class="x"><button class="icon-btn sm ghost danger" data-action="set-remove" data-ei="${i}" data-si="${j}" aria-label="Remove set ${j + 1}">−</button></td></tr>`;
      }).join('')}
      </tbody></table>
      <button class="btn soft block" data-action="set-add" data-ei="${i}">+ Add set</button>
      <details class="notes"${e.notes ? ' open' : ''}><summary>Exercise notes</summary><textarea data-bind="exnote" data-ei="${i}" placeholder="Cues, tempo, how it moved…">${esc(e.notes)}</textarea></details>
    </section>`;
  }

  let histQ = '';
  function viewHistory() {
    setChrome('History', false);
    if (!state.sessions.length) { $app.innerHTML = emptyState('📓', 'No workouts logged yet', 'Your past sessions will show here, grouped by week (Sun–Sat).', '<a class="btn primary" href="#/">Log your first workout</a>'); return; }
    $app.innerHTML = `<div class="search"><input type="search" id="histQ" placeholder="Search workouts, exercises or notes" value="${esc(histQ)}" autocomplete="off" aria-label="Search history"></div><div id="histList"></div>`;
    const inp = document.getElementById('histQ');
    inp.addEventListener('input', () => { histQ = inp.value; drawHistory(); });
    drawHistory();
  }
  function drawHistory() {
    const q = histQ.trim().toLowerCase();
    const list = sortedSessions().filter((s) => !q || (s.name || '').toLowerCase().includes(q) || (s.notes || '').toLowerCase().includes(q) ||
      s.exercises.some((e) => exName(e).toLowerCase().includes(q) || (e.notes || '').toLowerCase().includes(q)));
    const el = document.getElementById('histList');
    if (!list.length) { el.innerHTML = emptyState('🔍', `No workouts match “${esc(histQ)}”`, 'Try an exercise name like “squat” or a workout name.', '<button class="btn" data-action="hist-clear">Clear search</button>'); return; }
    const groups = new Map();
    for (const s of list) { const k = weekStart(s.date); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(s); }
    el.innerHTML = [...groups.entries()].map(([ws, ss]) => {
      const st = sessionStats(ss);
      return `<div class="week-group" data-week="${ws}"><div class="week-group-head"><span class="wt">${esc(weekLabel(ws))}</span><span class="wsum">${plural(st.workouts, 'workout')} · ${plural(st.sets, 'set')} · ${fmtVol(st.vol)} lb</span></div>${ss.map((s) => sessionItem(s)).join('')}</div>`;
    }).join('');
  }

  const exTab = { seg: 'mine', q: '', chip: 'all', limit: 80, mode: 'browse' };
  function viewExercises() {
    setChrome('Exercises', false);
    $app.innerHTML = `<div class="seg" role="tablist"><button class="seg-btn${exTab.seg === 'mine' ? ' on' : ''}" data-action="seg" data-seg="mine" role="tab" aria-selected="${exTab.seg === 'mine'}">My exercises <span class="count">${state.exercises.length}</span></button><button class="seg-btn${exTab.seg === 'lib' ? ' on' : ''}" data-action="seg" data-seg="lib" role="tab" aria-selected="${exTab.seg === 'lib'}">Library <span class="count">${LIB_ITEMS.length}</span></button></div>
      <div class="search"><input type="search" id="exQ" placeholder="${exTab.seg === 'mine' ? 'Search my exercises or add a new one' : `Search ${LIB_ITEMS.length} exercises`}" value="${esc(exTab.q)}" autocomplete="off" aria-label="Search exercises">${chipsHTML(exTab.chip, false)}</div>
      <div id="exResults" class="pick-list"></div>
      ${exTab.seg === 'mine' && state.exercises.length > 1 ? '<button class="btn ghost block" data-action="lib-reorder">Reorder my exercises</button>' : ''}`;
    const inp = document.getElementById('exQ');
    inp.addEventListener('input', () => { exTab.q = inp.value; exTab.limit = 80; drawExResults(); });
    drawExResults();
  }
  function drawExResults() { const el = document.getElementById('exResults'); if (el) el.innerHTML = resultsHTML(exTab); }
  function reorderSheet() {
    const draw = () => state.exercises.map((e, i) => `<div class="pick-row"><span class="grow"><span class="pr-name">${esc(e.name)}</span></span><button class="icon-btn sm" data-x="up" data-i="${i}" aria-label="Move ${esc(e.name)} up"${i === 0 ? ' disabled' : ''}>↑</button><button class="icon-btn sm" data-x="down" data-i="${i}" aria-label="Move ${esc(e.name)} down"${i === state.exercises.length - 1 ? ' disabled' : ''}>↓</button></div>`).join('');
    const sh = openSheet('Reorder my exercises', `<div id="ro">${draw()}</div>`, (el) => {
      const i = +el.dataset.i; if (el.disabled) return;
      if (el.dataset.x === 'up') swap(state.exercises, i, i - 1); else if (el.dataset.x === 'down') swap(state.exercises, i, i + 1); else return;
      save(); sh.bg.querySelector('#ro').innerHTML = draw();
    }, { tall: true, doneLabel: 'Done', onClose: () => render() });
  }

  function viewExercise(id) {
    const e = exById(id);
    if (!e) { setChrome('Exercise', true); $app.innerHTML = emptyState('🤔', 'Exercise not found', '', '<a class="btn primary" href="#/exercises">Back to exercises</a>'); return; }
    setChrome(e.name, true);
    const rows = [];
    for (const s of sortedSessions()) for (const x of s.exercises) if (x.exId === id && x.sets.some(isLogged)) rows.push({ s, x, top: topSet(x.sets) });
    let best = null;
    for (const r of rows) { const w = num(r.top.weight) ?? -1, rp = num(r.top.reps) ?? 0; if (!best || w > best.w || (w === best.w && rp > best.r)) best = { w, r: rp, row: r }; }
    const groups = new Map();
    for (const r of rows) { const k = weekStart(r.s.date); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(r); }
    const cats = LIB.categories.map((c) => `<option value="${esc(c.label)}"${c.label === e.cat ? ' selected' : ''}>${esc(c.label)}</option>`).join('') + `<option value="Custom"${!catKeyOf(e) ? ' selected' : ''}>Custom / other</option>`;
    $app.innerHTML = `${best ? `<section class="card best"><div class="best-l">Best set</div><div class="best-v">${esc(fmtSet(best.row.top))}</div><div class="best-d">${esc(fmtDate(best.row.s.date))} · ${plural(rows.length, 'session')} logged</div></section>` : ''}
      <div class="sec-title">History by week (Sun–Sat)</div>
      ${rows.length ? [...groups.entries()].map(([ws, rs]) => {
        const wkTop = topSet(rs.map((r) => r.top));
        return `<section class="card tight" data-week="${ws}"><div class="week-group-head inset"><span class="wt">${esc(weekLabel(ws))}</span><span class="wsum">top ${esc(fmtSet(wkTop))}</span></div>
          <table class="hist">${rs.map((r) => `<tr data-href="#/log/${r.s.id}" tabindex="0"><td>${esc(fmtDate(r.s.date))}<div class="sub">${esc(r.x.sets.filter(isLogged).map(fmtSet).join(' · '))}</div></td><td>${esc(fmtSet(r.top))}${best && r === best.row ? '<span class="badge-pr">BEST</span>' : ''}</td></tr>`).join('')}</table></section>`;
      }).join('') : `<div class="card">${emptyState('📈', 'Not logged yet', 'Add it to a workout and your sets will show here week by week.')}</div>`}
      <div class="sec-title">Details</div>
      <section class="card stack">
        <div><label class="f" for="exName">Name</label><input id="exName" data-bind="exdef" data-k="name" value="${esc(e.name)}"></div>
        <div><label class="f" for="exCat">Category</label><select id="exCat" data-bind="exdef" data-k="cat">${cats}</select></div>
        <div><label class="f" for="exNotes">Notes / cues</label><textarea id="exNotes" data-bind="exdef" data-k="notes" placeholder="Setup, cues, machine settings…">${esc(e.notes || '')}</textarea></div>
      </section>
      <button class="btn danger block" data-action="ex-delete" data-id="${e.id}">Delete exercise</button>`;
  }

  function viewTemplates() {
    setChrome('Templates', true);
    $app.innerHTML = `<section class="card"><label class="f" for="newTpl">New template</label>
      <div class="row"><input id="newTpl" class="grow" placeholder="e.g. Monday Lower + Rotation" autocomplete="off"><button class="btn primary" data-action="tpl-create">Create</button></div></section>
      ${state.templates.length ? `<div class="sec-title">Your templates</div>` + state.templates.map((t, i) => `<div class="list-item"><a class="grow rowlink" href="#/template/${t.id}"><div class="title">${esc(t.name)}</div><div class="sub">${plural(t.items.length, 'exercise')}</div></a>
        <button class="icon-btn sm" data-action="tpl-up" data-i="${i}" aria-label="Move up"${i === 0 ? ' disabled' : ''}>↑</button><button class="icon-btn sm" data-action="tpl-down" data-i="${i}" aria-label="Move down"${i === state.templates.length - 1 ? ' disabled' : ''}>↓</button>
        <button class="btn primary sm" data-action="start" data-tpl="${t.id}">Start</button></div>`).join('')
        : emptyState('🗂️', 'No templates yet', 'Save the workouts you repeat (e.g. “Monday Lower + Rotation”) and start or plan them in one tap. Name one above to begin.')}`;
    document.getElementById('newTpl').addEventListener('keydown', (ev) => { if (ev.key === 'Enter') doAction('tpl-create'); });
  }

  function viewTemplate(id) {
    const t = tplById(id);
    if (!t) { setChrome('Template', true); $app.innerHTML = emptyState('🤔', 'Template not found', '', '<a class="btn primary" href="#/templates">Back to templates</a>'); return; }
    setChrome(t.name, true);
    $app.innerHTML = `<section class="card"><label class="f" for="tName">Template name</label><input id="tName" data-bind="tpl" data-k="name" value="${esc(t.name)}"></section>
      <div class="sec-title">Exercises</div>
      ${t.items.map((it, i) => `<section class="ex-card"><div class="ex-head"><div class="grow"><div class="ex-name">${esc(exName(it))}</div></div>
          <button class="icon-btn sm" data-action="ti-up" data-i="${i}" aria-label="Move up"${i === 0 ? ' disabled' : ''}>↑</button>
          <button class="icon-btn sm" data-action="ti-down" data-i="${i}" aria-label="Move down"${i === t.items.length - 1 ? ' disabled' : ''}>↓</button>
          <button class="icon-btn sm danger" data-action="ti-remove" data-i="${i}" aria-label="Remove">✕</button></div>
        <div class="row"><div class="grow"><label class="f">Sets</label><input type="number" inputmode="numeric" min="1" data-bind="ti" data-i="${i}" data-k="sets" value="${esc(it.sets)}"></div>
        <div class="grow"><label class="f">Target reps</label><input data-bind="ti" data-i="${i}" data-k="reps" value="${esc(it.reps)}" placeholder="e.g. 5 or 8-10"></div></div></section>`).join('') || emptyState('🏋️', 'No exercises yet', 'Add movements from the library or your own list.')}
      <div class="stack"><button class="btn soft block" data-action="ti-add">+ Add exercise</button>
        <button class="btn primary block" data-action="start" data-tpl="${t.id}">Start this workout today</button>
        <button class="btn danger block" data-action="tpl-delete">Delete template</button></div>`;
  }

  function viewSettings() {
    setChrome('More', false);
    const ps = state.settings.programStart;
    const st = sessionStats(state.sessions);
    $app.innerHTML = `<div class="sec-title">Connections</div>
      <a class="list-item" href="#/whoop"><span class="li-ico tool" aria-hidden="true">⌁</span><div class="grow"><div class="title">Connections</div><div class="sub">WHOOP · ${whoopStatusText()}</div></div><span class="chev" aria-hidden="true">›</span></a>
      <div class="sec-title">Plan</div>
      <a class="list-item" href="#/templates"><span class="li-ico tool" aria-hidden="true">▤</span><div class="grow"><div class="title">Templates</div><div class="sub">${plural(state.templates.length, 'saved workout')} · create, edit, start</div></div><span class="chev" aria-hidden="true">›</span></a>
      <a class="list-item" href="#/macros"><span class="li-ico tool" aria-hidden="true">◔</span><div class="grow"><div class="title">Macro calculator</div><div class="sub">${state.macros && state.macros.result && state.macros.result.calories ? `${state.macros.result.calories.toLocaleString()} kcal · P ${state.macros.result.protein} · C ${state.macros.result.carbs} · F ${state.macros.result.fat}` : 'Set your daily calories and macros'}</div></div><span class="chev" aria-hidden="true">›</span></a>
      <div class="sec-title">Program</div><section class="card">
        <label class="f" for="progStart">Program start date</label>
        <input id="progStart" type="date" data-bind="setting" data-k="programStart" value="${esc(ps || '')}">
        <div class="hint">Weeks run Sunday → Saturday. Week 1 is the Sun–Sat week containing this date${ps ? ` (${esc(rangeLabel(ps))})` : ''}. This week: <b id="curWeek">${esc(weekLabel(todayStr()))}</b></div></section>
      <div class="sec-title">Backup</div><section class="card stack">
        <div class="hint">Your diary lives only on this phone. Export a backup regularly (and before changing phones or clearing your browser), then Import it to restore.</div>
        <div class="btn-row"><button class="btn primary" data-action="export">Export JSON</button><button class="btn" data-action="import">Import JSON</button></div>
        <div class="hint">${plural(st.workouts, 'workout')} · ${plural(state.exercises.length, 'exercise')} · ${plural(state.templates.length, 'template')} · <span id="persist">checking storage…</span></div></section>
      <div class="sec-title">Danger zone</div><section class="card">
        <button class="btn danger block" data-action="wipe">Erase all data</button></section>
      <div class="foot">SlimTucci Workout Diary · works offline<br>Add to Home Screen from your browser’s Share / ⋮ menu</div>`;
    if (navigator.storage && navigator.storage.persisted) navigator.storage.persisted().then((p) => { const el = document.getElementById('persist'); if (el) el.textContent = p ? 'storage: persistent' : 'storage: best-effort'; });
    else document.getElementById('persist').textContent = 'storage: local';
  }


  // ---------- macro calculator (math lives in macros-calc.js) ----------
  const MAC = window.SlimTucciMacros;
  const KG_LB = 2.20462;
  const DEFAULT_PROFILE = { weightKg: null, heightCm: null, age: null, sex: 'male', activity: 'moderate', goal: 'maintain', intensity: 'standard', bodyFat: null, wUnit: 'lb', hUnit: 'ftin' };
  function macroState() {
    if (!state.macros || !state.macros.profile) state.macros = { profile: Object.assign({}, DEFAULT_PROFILE), result: null, updatedAt: null };
    state.macros.profile = Object.assign({}, DEFAULT_PROFILE, state.macros.profile);
    return state.macros;
  }
  const trim1 = (x) => (x == null || x === '' || isNaN(x) ? '' : String(Math.round(x * 10) / 10));
  function heightParts(cm) { if (!(cm > 0)) return { ft: '', inch: '' }; let tin = Math.round(cm / 2.54); return { ft: Math.floor(tin / 12), inch: tin % 12 }; }
  // HOOK: total calories burned today (WHOOP cycle kcal when connected, else a manual number). 0 = none.
  // The base targets ignore it; adjustedToday() turns it into extra carbs via computeBurnExtra + computeTargets.
  function caloriesBurnedToday() { const b = todayBurn(); return b ? b.kcal : 0; }
  function todayBurn() { const b = state.burn; return b && b.date === todayStr() && b.kcal > 0 ? b : null; }
  function adjustedToday() {
    const m = state.macros, base = m && m.result;
    if (!base || !base.calories || !m.profile) return null;
    const burn = caloriesBurnedToday();
    if (!burn) return null;
    const extra = MAC.computeBurnExtra(burn, base.tdee, m.profile.goal);
    const adj = MAC.computeTargets(m.profile, extra);
    return { burn, extra, factor: MAC.BURN_FACTOR[m.profile.goal] ?? 0.75, tdee: base.tdee, base, adj };
  }
  function recomputeMacros() {
    const m = macroState();
    m.result = MAC.computeTargets(m.profile, 0); // base targets; today's burn is applied separately (adjustedToday)
    m.updatedAt = new Date().toISOString();
    save();
    return m.result;
  }
  function macroMiniHTML() {
    const r = state.macros && state.macros.result;
    if (!r || !r.calories) return `<a class="card macro-mini empty-mini" href="#/macros"><span class="li-ico tool" aria-hidden="true">◔</span><span class="grow"><b>Set your daily macro targets</b><span class="sub">Calories, protein, carbs and fat in 30 seconds</span></span><span class="chev" aria-hidden="true">›</span></a>`;
    return `<a class="card macro-mini" href="#/macros" aria-label="Today's targets: ${r.calories} calories, ${r.protein} grams protein, ${r.carbs} grams carbs, ${r.fat} grams fat">
      <div class="mm-head"><span>Today’s targets</span><span class="chev" aria-hidden="true">›</span></div>
      <div class="mm-row"><div class="mm-k"><b>${r.calories.toLocaleString()}</b><span>kcal</span></div><div class="mm-p"><b>${r.protein}g</b><span>Protein</span></div><div class="mm-c"><b>${r.carbs}g</b><span>Carbs</span></div><div class="mm-f"><b>${r.fat}g</b><span>Fat</span></div></div></a>`;
  }
  const DISCLAIMER = 'Estimates only. Adjust based on your weekly progress, and talk to your coach if you have any medical conditions.';
  function macroResultsHTML() {
    const m = macroState(), r = m.result, p = m.profile;
    if (!r) return `<section class="card">${emptyState('◔', 'Your daily targets', 'Enter your weight, height and age below to see calories, protein, carbs and fat.')}</section>`;
    if (r.blocked) return `<section class="card warn"><b>Under 18?</b> Calorie targets need a coach review first. Talk to your coach before using these numbers.</section>`;
    const g = MAC.GOALS[r.goal], goalTxt = r.goal === 'maintain' ? 'Maintain' : `${g.label} · ${MAC.INTENSITY_LABEL[r.intensity]} (${r.adjPct > 0 ? '+' : ''}${r.adjPct}%)`;
    const bmrLine = r.method === 'Katch-McArdle'
      ? `Katch-McArdle BMR = 370 + 21.6 × lean mass (${r.lbmKg} kg at ${trim1(p.bodyFat)}% body fat) = <b>${r.bmr.toLocaleString()}</b> kcal`
      : `Mifflin-St Jeor BMR = 10 × ${trim1(p.weightKg)} kg + 6.25 × ${trim1(p.heightCm)} cm − 5 × ${p.age} ${p.sex === 'female' ? '− 161' : '+ 5'} = <b>${r.bmr.toLocaleString()}</b> kcal`;
    return `<section class="card macro-hero"><div class="mh-l">Daily calories</div><div class="mh-v" id="mCalories">${r.calories.toLocaleString()}<span> kcal</span></div><div class="mh-s">${esc(goalTxt)} · ${esc(r.activityLabel)}</div></section>
      <div class="macro-grid">
        <div class="macro-card p"><span class="mc-l">Protein</span><b id="mProtein">${r.protein}<small>g</small></b><span class="mc-pct">${r.pct.protein}%</span></div>
        <div class="macro-card c"><span class="mc-l">Carbs</span><b id="mCarbs">${r.carbs}<small>g</small></b><span class="mc-pct">${r.pct.carbs}%</span></div>
        <div class="macro-card f"><span class="mc-l">Fat</span><b id="mFat">${r.fat}<small>g</small></b><span class="mc-pct">${r.pct.fat}%</span></div>
      </div>
      <div class="split-bar" role="img" aria-label="Calorie split: protein ${r.pct.protein}%, carbs ${r.pct.carbs}%, fat ${r.pct.fat}%"><i class="p" style="width:${r.pct.protein}%"></i><i class="c" style="width:${r.pct.carbs}%"></i><i class="f" style="width:${r.pct.fat}%"></i></div>
      <div class="macro-meta" id="mMeta">BMR ${r.bmr.toLocaleString()} · TDEE ${r.tdee.toLocaleString()} kcal · ${esc(r.method)}</div>
      ${adjustedLineHTML()}
      ${r.warnings.map((w) => `<div class="card warn">${esc(w)}</div>`).join('')}
      <details class="how"><summary>How this was calculated</summary><ol>
        <li>${bmrLine}</li>
        <li>TDEE = BMR × ${r.activityMult} (${esc(r.activityLabel)}) = <b>${r.tdee.toLocaleString()}</b> kcal</li>
        <li>Goal: ${esc(goalTxt)} → ${r.tdee.toLocaleString()} × ${(1 + r.adjPct / 100).toFixed(2)}${r.extraBurnKcal ? ` + ${r.extraBurnKcal} burned today` : ''}, rounded to the nearest 50 = <b>${r.calories.toLocaleString()}</b> kcal</li>
        <li>Protein: ${r.proteinPerLb} g per lb × ${r.weightLb} lb = <b>${r.protein} g</b> (rounded to 5 g)</li>
        <li>Fat: 0.35 g per lb (never below 0.3 g/lb, kept within 20–35% of calories) = <b>${r.fat} g</b></li>
        <li>Carbs fill the rest: (${r.calories.toLocaleString()} − ${r.protein}×4 − ${r.fat}×9) ÷ 4 = <b>${r.carbs} g</b></li>
      </ol><div class="hint">Based on the SlimTucci Nutrition Desk macro framework.</div></details>
      <p class="disclaimer">${DISCLAIMER}</p>`;
  }
  function segHTML(k, cur, opts, label) {
    return `<div class="seg mini" role="radiogroup" aria-label="${esc(label)}">${opts.map(([v, l]) => `<button class="seg-btn${v === cur ? ' on' : ''}" data-action="macro-set" data-k="${k}" data-v="${v}" role="radio" aria-checked="${v === cur}">${esc(l)}</button>`).join('')}</div>`;
  }
  function viewMacros() {
    setChrome('Macros', false);
    const m = macroState(), p = m.profile;
    if (!m.result && p.weightKg) recomputeMacros();
    const hp = heightParts(p.heightCm);
    const wVal = p.weightKg ? (p.wUnit === 'kg' ? trim1(p.weightKg) : trim1(p.weightKg * KG_LB)) : '';
    const goal = MAC.GOALS[p.goal] || MAC.GOALS.maintain;
    const ints = Object.entries(goal.intensities);
    $app.innerHTML = `<div id="macroResults">${macroResultsHTML()}</div>
      <div class="sec-title">WHOOP</div>
      <div id="whoopCard">${whoopCardHTML()}</div>
      <div class="sec-title">Your details</div>
      <section class="card stack">
        <div><div class="lab-row"><label class="f" for="mWeight">Weight</label>${segHTML('wUnit', p.wUnit, [['lb', 'lb'], ['kg', 'kg']], 'Weight unit')}</div>
          <div class="unit-input"><input id="mWeight" type="number" inputmode="decimal" step="any" min="0" data-bind="macro" data-k="weight" value="${esc(wVal)}" placeholder="${p.wUnit === 'kg' ? 'e.g. 93' : 'e.g. 205'}"><span class="unit">${p.wUnit}</span></div></div>
        <div><div class="lab-row"><label class="f" for="${p.hUnit === 'cm' ? 'mCm' : 'mFt'}">Height</label>${segHTML('hUnit', p.hUnit, [['ftin', 'ft / in'], ['cm', 'cm']], 'Height unit')}</div>
          ${p.hUnit === 'cm' ? `<div class="unit-input"><input id="mCm" type="number" inputmode="decimal" step="any" min="0" data-bind="macro" data-k="cm" value="${esc(trim1(p.heightCm))}" placeholder="e.g. 193"><span class="unit">cm</span></div>`
            : `<div class="row"><div class="unit-input grow"><input id="mFt" type="number" inputmode="numeric" min="0" max="8" data-bind="macro" data-k="ft" value="${esc(hp.ft)}" placeholder="6" aria-label="Height feet"><span class="unit">ft</span></div><div class="unit-input grow"><input id="mIn" type="number" inputmode="numeric" min="0" max="11" data-bind="macro" data-k="in" value="${esc(hp.inch)}" placeholder="4" aria-label="Height inches"><span class="unit">in</span></div></div>`}</div>
        <div class="row top"><div class="grow"><label class="f" for="mAge">Age</label><div class="unit-input"><input id="mAge" type="number" inputmode="numeric" min="1" max="100" data-bind="macro" data-k="age" value="${esc(p.age || '')}" placeholder="e.g. 30"><span class="unit">yrs</span></div></div>
          <div class="grow"><span class="f">Sex</span>${segHTML('sex', p.sex, [['male', 'Male'], ['female', 'Female']], 'Sex')}</div></div>
        <div><label class="f" for="mBf">Body fat % <span class="opt">optional</span></label><div class="unit-input"><input id="mBf" type="number" inputmode="decimal" step="any" min="3" max="60" data-bind="macro" data-k="bodyFat" value="${esc(p.bodyFat || '')}" placeholder="Leave blank if unsure"><span class="unit">%</span></div>
          <div class="hint">If you know it, BMR switches to Katch-McArdle (based on lean mass).</div></div>
      </section>
      <div class="sec-title">Activity level</div>
      <div class="choice-list" role="radiogroup" aria-label="Activity level">${Object.entries(MAC.ACTIVITY).map(([k, a]) => `<button class="choice${k === p.activity ? ' on' : ''}" data-action="macro-set" data-k="activity" data-v="${k}" role="radio" aria-checked="${k === p.activity}"><span class="radio" aria-hidden="true"></span><span class="grow"><span class="ch-t">${esc(a.label)}</span><span class="ch-d">${esc(a.desc)}</span></span><span class="ch-m">×${a.mult}</span></button>`).join('')}</div>
      <div class="sec-title">Goal</div>
      <section class="card stack">
        ${segHTML('goal', p.goal, [['cut', 'Cut'], ['maintain', 'Maintain'], ['bulk', 'Bulk']], 'Goal')}
        ${ints.length > 1 ? `<div><span class="f">How hard?</span>${segHTML('intensity', p.intensity in goal.intensities ? p.intensity : 'standard', ints.map(([k, v]) => [k, `${MAC.INTENSITY_LABEL[k]} ${v > 0 ? '+' : ''}${Math.round(v * 100)}%`]), 'Goal intensity')}
          <div class="hint">${p.goal === 'cut' ? 'Start mild or standard. Use a hard cut only with your coach’s OK.' : 'Lean bulk keeps fat gain low. Standard suits most phases.'}</div></div>` : '<div class="hint">Calories match your estimated daily burn (TDEE).</div>'}
      </section>
      <p class="disclaimer">${DISCLAIMER}</p>`;
  }
  function macroSet(k, v) {
    const m = macroState(), p = m.profile;
    p[k] = v;
    if (k === 'goal') p.intensity = 'standard';
    recomputeMacros(); rerenderKeepScroll();
  }
  function macroInput() {
    const p = macroState().profile;
    const val = (id) => { const el = document.getElementById(id); return el && el.value !== '' && !isNaN(Number(el.value)) ? Number(el.value) : null; };
    const w = val('mWeight'); p.weightKg = w == null ? null : (p.wUnit === 'kg' ? w : w / KG_LB);
    if (p.hUnit === 'cm') p.heightCm = val('mCm');
    else { const ft = val('mFt'), inch = val('mIn'); p.heightCm = ft == null && inch == null ? null : ((ft || 0) * 12 + (inch || 0)) * 2.54; }
    p.age = val('mAge'); p.bodyFat = val('mBf');
    recomputeMacros();
    document.getElementById('macroResults').innerHTML = macroResultsHTML();
  }

  // ---------- burn today + WHOOP ----------
  const CONFIG = window.SLIMTUCCI_CONFIG || {};
  const WHOOP_URL = String(CONFIG.WHOOP_WORKER_URL || '').trim().replace(/\/+$/, '');
  const WKEY = 'slimtucci-whoop-v1'; // per-device only: { session, connectedAt, lastSync, today, error }. Never WHOOP tokens.
  function wload() { try { return JSON.parse(localStorage.getItem(WKEY)) || {}; } catch (e) { return {}; } }
  let whoop = wload();
  function wsave() { try { localStorage.setItem(WKEY, JSON.stringify(whoop)); } catch (e) {} }
  const whoopConnected = () => !!(WHOOP_URL && whoop.session);
  const fmtTime = (iso) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  function whoopStatusText() { return !WHOOP_URL ? 'setup needed' : whoopConnected() ? 'connected' : 'not connected'; }
  const SRC = (src) => `<span class="src-pill ${src === 'whoop' ? 'whoop' : 'manual'}">${src === 'whoop' ? 'WHOOP' : 'Manual'}</span>`;
  function burnCardHTML() {
    const b = todayBurn(), a = adjustedToday(), hasTargets = !!(state.macros && state.macros.result && state.macros.result.calories);
    if (!b) return `<section class="card burn" id="burnCard"><div class="burn-head"><span class="bh-t">Burn today</span>${whoopConnected() ? SRC('whoop') : ''}</div>
      <button class="burn-empty" data-action="burn-edit"><span class="pr-plus" aria-hidden="true">+</span><span class="grow"><b>Tap to enter calories burned</b><span class="sub">${whoopConnected() ? 'Waiting for WHOOP, or type a number' : 'Your total for today, from WHOOP or your watch'}</span></span></button></section>`;
    let adjHTML;
    if (!hasTargets) adjHTML = `<a class="adj-cta" href="#/macros">Set your macro targets to turn this into a carb adjustment ›</a>`;
    else if (a.extra > 0) adjHTML = `<div class="adj" id="burnAdj">Adjusted for today: <b>+${a.extra.toLocaleString()} kcal</b> (+${a.adj.extraCarbs} g carbs)</div>
      <div class="adj-sub">${Math.round(a.factor * 100)}% of your burn above your ${a.tdee.toLocaleString()} kcal TDEE, added as carbs → <b>${a.adj.calories.toLocaleString()} kcal · C ${a.adj.carbs} g</b> today</div>`;
    else adjHTML = `<div class="adj none" id="burnAdj">Adjusted for today: <b>+0 kcal</b></div><div class="adj-sub">Burn is at or below your ${a.tdee.toLocaleString()} kcal TDEE, so today’s targets stay the same.</div>`;
    return `<section class="card burn" id="burnCard"><div class="burn-head"><span class="bh-t">Burn today</span>${SRC(b.source)}</div>
      <div class="burn-row"><div class="burn-v"><b id="burnKcal">${b.kcal.toLocaleString()}</b> kcal${b.source === 'whoop' && whoop.today && whoop.today.in_progress ? ' <span class="sub">so far</span>' : ''}</div><button class="btn sm" data-action="burn-edit">Edit</button></div>
      ${adjHTML}</section>`;
  }
  function adjustedLineHTML() {
    const b = todayBurn(), a = adjustedToday();
    if (!b || !a) return `<button class="adj-line empty" data-action="burn-edit">Adjusted today: no burn entered · <u>add today’s burn</u></button>`;
    return `<button class="adj-line" data-action="burn-edit" id="adjLine">Adjusted today: <b>+${a.extra.toLocaleString()} kcal (+${a.adj.extraCarbs} g carbs)</b>${a.extra ? ` <span class="nw">→ ${a.adj.calories.toLocaleString()} kcal · C ${a.adj.carbs} g</span>` : ''}<span class="al-src">from ${b.kcal.toLocaleString()} kcal burned (${b.source === 'whoop' ? 'WHOOP' : 'manual'})</span></button>`;
  }
  function burnSheet() {
    const b = todayBurn();
    const body = `<div class="sheet-note">Enter your <b>total</b> calories burned today (active + resting), e.g. from WHOOP or your watch. Your base targets already cover a normal day (your TDEE). Only the burn above that is added back: ${Math.round(MAC.BURN_FACTOR.cut * 100)}% on a cut, ${Math.round(MAC.BURN_FACTOR.maintain * 100)}% on maintain or bulk, up to +${MAC.BURN_MAX_EXTRA} kcal, all as carbs.</div>
      <label class="f" for="burnInput">Calories burned today</label>
      <div class="unit-input"><input id="burnInput" type="number" inputmode="numeric" min="0" max="15000" value="${b ? b.kcal : ''}" placeholder="e.g. 3600"><span class="unit">kcal</span></div>
      <div class="btn-row"><button class="btn primary" data-x="burn-save">Save</button>${b ? '<button class="btn danger" data-x="burn-clear">Clear</button>' : ''}</div>
      ${whoopConnected() ? `<button class="btn ghost block" data-x="burn-whoop">Use WHOOP instead</button>` : `<a class="btn ghost block" href="#/whoop" data-x="close">Connect WHOOP to fill this automatically</a>`}`;
    const sh = openSheet('Burn today', body, (el, close) => {
      const x = el.dataset.x;
      if (x === 'burn-save') {
        const v = Math.round(Number(sh.bg.querySelector('#burnInput').value));
        if (!(v > 0) || v > 15000) { toast('Enter a number between 1 and 15,000'); return; }
        state.burn = { date: todayStr(), kcal: v, source: 'manual', updatedAt: new Date().toISOString() }; save(); close(); toast('Burn saved'); refreshBurnViews();
      } else if (x === 'burn-clear') { state.burn = null; save(); close(); refreshBurnViews(); }
      else if (x === 'burn-whoop') { state.burn = null; save(); close(); refreshBurnViews(); whoopSync(true); }
    });
    sh.bg.querySelector('#burnInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') sh.bg.querySelector('[data-x="burn-save"]').click(); });
  }
  // Update burn/WHOOP bits in place (no full re-render, so focus in Macros inputs is never lost).
  function refreshBurnViews() {
    const set = (id, html) => { const el = document.getElementById(id); if (el) el.outerHTML = html; };
    const r = location.hash.split('?')[0];
    if (r === '' || r === '#' || r === '#/') set('burnCard', burnCardHTML());
    const mr = document.getElementById('macroResults'); if (mr) mr.innerHTML = macroResultsHTML();
    const wc = document.getElementById('whoopCard'); if (wc) wc.innerHTML = whoopCardHTML();
  }
  function whoopCardHTML() {
    const head = (pill) => `<div class="wc-head"><span class="wc-logo" aria-hidden="true">W</span><span class="grow"><b>WHOOP</b><span class="sub" id="whoopSub">${pill[2]}</span></span><span class="status-pill ${pill[0]}">${pill[1]}</span></div>`;
    if (!WHOOP_URL) return `<section class="card whoop-card" data-state="setup">${head(['pending', 'Setup needed', 'Pull today’s calories burned automatically'])}
      <p class="wc-note">Connecting WHOOP needs a one-time setup that’s still pending. Until then, enter <b>Burn today</b> by hand on the Today screen.</p>
      <button class="btn primary block" data-action="whoop-connect">Connect WHOOP</button></section>`;
    if (!whoop.session) return `<section class="card whoop-card" data-state="ready">${head(['off', 'Not connected', 'Pull today’s calories burned automatically'])}
      ${whoop.error ? `<p class="wc-err">${esc(whoop.error)}</p>` : ''}<p class="wc-note">You’ll sign in at WHOOP and approve read access to your daily cycles. Your WHOOP password and tokens never touch this app.</p>
      <button class="btn primary block" data-action="whoop-connect">Connect WHOOP</button></section>`;
    const t = whoop.today && whoop.today.date === todayStr() ? whoop.today : null;
    const tb = todayBurn();
    return `<section class="card whoop-card on" data-state="connected">${head(['ok', 'Connected', `Connected · ${whoop.lastSync ? 'last synced ' + esc(fmtTime(whoop.lastSync)) : 'not synced yet'}`])}
      <div class="wc-today"><span class="wc-l">Today${t && t.in_progress ? ' so far' : ''}</span><b id="whoopKcal">${t && t.kcal != null ? t.kcal.toLocaleString() : '—'}</b><span class="wc-u">kcal burned</span></div>
      ${t && t.kcal == null ? '<p class="wc-note">WHOOP is still scoring today’s cycle. Check back soon.</p>' : ''}${whoop.error ? `<p class="wc-err">${esc(whoop.error)}</p>` : ''}
      ${tb && tb.source === 'manual' ? '<p class="wc-note">Today is using your <b>manual</b> number. Open Burn today and tap “Use WHOOP instead” to switch.</p>' : ''}
      <div class="btn-row"><button class="btn primary" data-action="whoop-refresh">↻ Refresh</button><button class="btn danger" data-action="whoop-disconnect">Disconnect</button></div></section>`;
  }
  function whoopSetupSheet() {
    openSheet('Setup needed', `<div class="sheet-note">WHOOP only shares data through a small secure bridge that keeps its secret key off your phone. It’s a one-time setup:</div>
      <ol class="setup-steps"><li><b>Create a WHOOP developer app</b> at developer.whoop.com (free, same WHOOP login). You paste in the redirect URL we give you.</li>
      <li><b>Create a free Cloudflare account</b> at dash.cloudflare.com. The bridge runs there for $0.</li>
      <li><b>We deploy the bridge and switch it on in the app.</b> Then you tap Connect WHOOP once and approve.</li></ol>
      <div class="sheet-note">Until then, type today’s burn by hand. The same adjustment applies.</div>
      <button class="btn primary block" data-x="manual">Enter today’s burn by hand</button>`, (el, close) => {
      if (el.dataset.x === 'manual') { close(); burnSheet(); }
    });
  }
  let whoopInflight = null;
  function whoopSync(force) {
    if (!whoopConnected()) return Promise.resolve();
    if (whoopInflight) return whoopInflight;
    const fresh = whoop.lastSync && Date.now() - new Date(whoop.lastSync).getTime() < 10 * 60 * 1000 && whoop.today && whoop.today.date === todayStr();
    if (!force && fresh) return Promise.resolve();
    whoopInflight = (async () => {
      try {
        const res = await fetch(`${WHOOP_URL}/today`, { headers: { Authorization: `Bearer ${whoop.session}` }, cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        if (res.status === 401) {
          whoop = { error: 'WHOOP access ended. Tap Connect WHOOP to reconnect.' }; wsave();
          if (state.burn && state.burn.source === 'whoop') { state.burn = null; save(); }
        } else if (!res.ok) {
          whoop.error = res.status === 429 ? 'WHOOP is busy. Try again in a minute.' : res.status === 503 ? 'Refreshing WHOOP access. Try again in a few seconds.' : 'Couldn’t reach WHOOP just now. Try Refresh later.'; wsave();
        } else {
          whoop.lastSync = new Date().toISOString(); whoop.error = null; whoop.today = Object.assign({}, data, { date: todayStr() }); wsave();
          const manualToday = state.burn && state.burn.date === todayStr() && state.burn.source === 'manual';
          if (data.kcal > 0 && !manualToday) { state.burn = { date: todayStr(), kcal: Math.round(data.kcal), source: 'whoop', updatedAt: whoop.lastSync }; save(); }
          if (force) toast('WHOOP synced');
        }
      } catch (e) { whoop.error = 'You’re offline or the WHOOP bridge is unreachable.'; wsave(); }
      finally { whoopInflight = null; refreshBurnViews(); }
    })();
    return whoopInflight;
  }
  const SESSION_RE = /^[A-Za-z0-9_-]{20,200}$/;
  function handleWhoopReturn(query) {
    const q = new URLSearchParams(query);
    const sid = q.get('session'), err = q.get('error');
    history.replaceState(null, '', location.pathname + location.search + '#/whoop'); // drop the session id from the URL
    if (sid && SESSION_RE.test(sid)) {
      whoop = { session: sid, connectedAt: new Date().toISOString() }; wsave();
      setTimeout(() => { whoopSync(true); connectedSheet(sid); }, 0);
    } else if (err || sid) {
      const msg = { denied: 'WHOOP access wasn’t approved.', not_allowed: 'That WHOOP account isn’t allowed on this bridge.', bad_state: 'The sign-in link expired. Please try again.', token_exchange: 'WHOOP sign-in failed. Please try again.' }[err] || 'WHOOP connection failed. Please try again.';
      whoop.error = msg; wsave(); setTimeout(() => toast(msg), 0);
    }
  }
  function connectedSheet(sid) {
    openSheet('WHOOP connected', `<div class="sheet-note">Today’s calories burned now fill in automatically.</div>
      <div class="sheet-note small">Using the Home Screen app? If it still shows “Not connected” there, copy this connection code and paste it under More → Connections in that app.</div>
      <div class="code-box"><code id="sessCode">${esc(sid)}</code></div><div class="btn-row"><button class="btn" data-x="copy">Copy code</button><button class="btn primary" data-x="close">Done</button></div>`, (el) => {
      if (el.dataset.x === 'copy') (navigator.clipboard ? navigator.clipboard.writeText(sid) : Promise.reject()).then(() => toast('Code copied'), () => toast('Long-press the code to copy it'));
    });
  }
  function viewWhoop() {
    setChrome('Connections', true);
    $app.innerHTML = `<div class="sec-title">WHOOP</div><div id="whoopCard">${whoopCardHTML()}</div>
      <section class="card stack"><div class="bold">How it works</div>
        <div class="hint">When connected, the app reads today’s total calories burned from your WHOOP cycle (kilojoules ÷ 4.184) and uses it as <b>Burn today</b>. It refreshes when you open Today or Macros, or tap Refresh.</div>
        <div class="hint">Only a random per-device session code is stored on this phone. Your WHOOP password and tokens are never stored here. Disconnect revokes access at WHOOP.</div></section>
      ${WHOOP_URL && !whoop.session ? `<details class="how"><summary>Have a connection code?</summary><div class="stack" style="padding:0 0 12px"><input id="pasteCode" placeholder="Paste connection code" autocomplete="off" autocapitalize="off" spellcheck="false"><button class="btn block" data-action="whoop-paste">Use code</button></div></details>` : ''}
      <div class="foot">Apple Health can’t be read by a web app. Enter that burn by hand on Today.</div>`;
    whoopSync(false);
  }

  // ---------- router ----------
  let renderedHash = null;
  function render() {
    renderedHash = null; // blur/change events fired while the old view is torn down are ignored
    const [hpath, hquery] = location.hash.split('?');
    if (hpath === '#/whoop' && hquery) handleWhoopReturn(hquery);
    const [r, id] = (location.hash.split('?')[0].replace(/^#\/?/, '') || '').split('/');
    window.scrollTo(0, 0);
    if (r === 'log') viewLog(id);
    else if (r === 'history') viewHistory();
    else if (r === 'exercises') viewExercises();
    else if (r === 'exercise') viewExercise(id);
    else if (r === 'templates') viewTemplates();
    else if (r === 'template') viewTemplate(id);
    else if (r === 'settings') viewSettings();
    else if (r === 'macros') { viewMacros(); whoopSync(false); }
    else if (r === 'whoop') viewWhoop();
    else { viewHome(); whoopSync(false); }
    renderedHash = location.hash;
  }
  function rerenderKeepScroll() { const y = window.scrollY; render(); window.scrollTo(0, y); }
  const curId = () => location.hash.split('/')[2];
  const curSession = () => state.sessions.find((s) => s.id === curId());
  const curTpl = () => tplById(curId());
  function swap(arr, i, j) { if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; }
  const touch = (s) => { s.updatedAt = new Date().toISOString(); };

  function doAction(a, el) {
    el = el || {};
    const d = el.dataset || {};
    const s = curSession(), t = curTpl();
    const ei = Number(d.ei), si = Number(d.si), i = Number(d.i);
    switch (a) {
      case 'back': if (history.length > 1) history.back(); else go('#/'); break;
      case 'sel-day': selDay = d.date; rerenderKeepScroll(); break;
      case 'week-prev': selDay = addDays(selDay, -7); rerenderKeepScroll(); break;
      case 'week-next': selDay = addDays(selDay, 7); rerenderKeepScroll(); break;
      case 'go-today': selDay = todayStr(); rerenderKeepScroll(); break;
      case 'day-add': startSheet(selDay); break;
      case 'day-plan': planSheet(selDay); break;
      case 'plan-start': { const p = state.plans.find((x) => x.id === d.plan); if (p) startWorkout(p.templateId, p.date, p.id); break; }
      case 'plan-remove': state.plans = state.plans.filter((x) => x.id !== d.plan); save(); toast('Removed from plan'); rerenderKeepScroll(); break;
      case 'start': startWorkout(d.tpl || null, todayStr()); break;
      case 'add-ex': pickExercise('Add exercise', (id) => { s.exercises.push({ exId: id, name: exById(id).name, target: '', notes: '', sets: [{ weight: '', reps: '', done: false }] }); touch(s); save(); },
        (n) => { if (n) { rerenderKeepScroll(); const cards = document.querySelectorAll('.ex-card'); if (cards.length) cards[cards.length - 1].scrollIntoView({ block: 'center' }); } }); break;
      case 'ex-up': swap(s.exercises, ei, ei - 1); touch(s); save(); rerenderKeepScroll(); break;
      case 'ex-down': swap(s.exercises, ei, ei + 1); touch(s); save(); rerenderKeepScroll(); break;
      case 'ex-remove': if (confirm(`Remove ${exName(s.exercises[ei])} from this workout?`)) { s.exercises.splice(ei, 1); touch(s); save(); rerenderKeepScroll(); } break;
      case 'set-add': { const sets = s.exercises[ei].sets, prev = sets[sets.length - 1]; sets.push({ weight: prev ? prev.weight : '', reps: prev ? prev.reps : '', done: false }); touch(s); save(); rerenderKeepScroll(); break; }
      case 'set-remove': s.exercises[ei].sets.splice(si, 1); touch(s); save(); rerenderKeepScroll(); break;
      case 'set-done': { const st = s.exercises[ei].sets[si]; st.done = !st.done; el.classList.toggle('on', st.done); el.setAttribute('aria-pressed', st.done); el.closest('tr').classList.toggle('done', st.done); touch(s); save(); break; }
      case 'finish': selDay = s.date; toast('Workout saved 💪'); go('#/'); break;
      case 'save-as-tpl': {
        const name = prompt('Template name', s.name || 'Workout'); if (!name) break;
        state.templates.push({ id: uid(), name: name.trim(), items: s.exercises.map((e) => ({ exId: e.exId, sets: e.sets.length || 1, reps: e.target || String(num((topSet(e.sets) || {}).reps) ?? '') })) });
        save(); toast('Template saved'); break;
      }
      case 'del-session': if (confirm('Delete this workout? This cannot be undone.')) { state.sessions = state.sessions.filter((x) => x.id !== s.id); save(); toast('Workout deleted'); go('#/'); } break;
      case 'hist-clear': histQ = ''; render(); break;
      case 'seg': exTab.seg = d.seg; exTab.limit = 80; render(); break;
      case 'lib-reorder': reorderSheet(); break;
      case 'ex-delete': {
        const e = exById(d.id);
        if (!confirm(`Delete “${e.name}” from My exercises? Past workouts keep their logs; it is removed from templates.`)) break;
        for (const ss of state.sessions) for (const x of ss.exercises) if (x.exId === e.id) x.name = e.name;
        for (const tt of state.templates) tt.items = tt.items.filter((it) => it.exId !== e.id);
        state.exercises = state.exercises.filter((x) => x.id !== e.id); save(); toast('Exercise deleted'); go('#/exercises'); break;
      }
      case 'tpl-create': {
        const inp = document.getElementById('newTpl'); const name = inp.value.trim(); if (!name) { toast('Give the template a name first'); return inp.focus(); }
        const nt = { id: uid(), name, items: [] }; state.templates.push(nt); save(); go('#/template/' + nt.id); break;
      }
      case 'tpl-up': swap(state.templates, i, i - 1); save(); rerenderKeepScroll(); break;
      case 'tpl-down': swap(state.templates, i, i + 1); save(); rerenderKeepScroll(); break;
      case 'ti-up': swap(t.items, i, i - 1); save(); rerenderKeepScroll(); break;
      case 'ti-down': swap(t.items, i, i + 1); save(); rerenderKeepScroll(); break;
      case 'ti-remove': t.items.splice(i, 1); save(); rerenderKeepScroll(); break;
      case 'ti-add': pickExercise('Add to template', (id) => { t.items.push({ exId: id, sets: 3, reps: '8' }); save(); }, (n) => { if (n) rerenderKeepScroll(); }); break;
      case 'tpl-delete': if (confirm(`Delete template “${t.name}”? Logged workouts are kept.`)) { state.templates = state.templates.filter((x) => x.id !== t.id); state.plans = state.plans.filter((p) => p.templateId !== t.id); save(); toast('Template deleted'); go('#/templates'); } break;
      case 'export': exportJSON(); break;
      case 'macro-set': macroSet(d.k, d.v); break;
      case 'burn-edit': burnSheet(); break;
      case 'whoop-connect': if (!WHOOP_URL) whoopSetupSheet(); else location.href = `${WHOOP_URL}/auth/start`; break;
      case 'whoop-refresh': whoopSync(true); break;
      case 'whoop-paste': { const v = (document.getElementById('pasteCode').value || '').trim(); if (/^[A-Za-z0-9_-]{20,200}$/.test(v)) { whoop = { session: v, connectedAt: new Date().toISOString() }; wsave(); whoopSync(true); render(); } else toast('That code doesn’t look right'); break; }
      case 'whoop-disconnect':
        if (!confirm('Disconnect WHOOP? This revokes the app’s access at WHOOP.')) break;
        { const sid = whoop.session; fetch(`${WHOOP_URL}/disconnect`, { method: 'POST', headers: { Authorization: `Bearer ${sid}` } }).catch(() => {}); }
        whoop = {}; wsave(); if (state.burn && state.burn.source === 'whoop') { state.burn = null; save(); } toast('WHOOP disconnected'); refreshBurnViews(); break;
      case 'import': document.getElementById('importFile').click(); break;
      case 'wipe':
        if (confirm('Erase ALL workouts, exercises and templates on this phone? Export a backup first!') && confirm('Really erase everything?')) {
          state = { version: 1, settings: { programStart: weekStart(todayStr()), samplesCleared: true }, exercises: [], templates: [], sessions: [], plans: [], macros: null, burn: null }; save(); toast('All data erased'); go('#/');
        }
        break;
    }
  }

  // Exercises tab interactions (chips, library rows, custom add)
  $app.addEventListener('click', (ev) => {
    if (!location.hash.startsWith('#/exercises')) return;
    const chip = ev.target.closest('[data-chip]');
    if (chip) { exTab.chip = chip.dataset.chip; exTab.limit = 80; document.querySelectorAll('#app .chip').forEach((b) => { b.classList.toggle('on', b === chip); b.setAttribute('aria-selected', b === chip); }); drawExResults(); return; }
    const x = ev.target.closest('[data-x]'); if (!x) return;
    if (x.dataset.x === 'pick-lib') {
      const li = LIB_ITEMS[+x.dataset.li]; const have = findMineByName(li.name);
      if (have) { location.hash = '#/exercise/' + have.id; return; }
      ensureMine(li); toast(`${li.name} added to My exercises`); drawExResults();
      const c = document.querySelector('.seg-btn[data-seg="mine"] .count'); if (c) c.textContent = state.exercises.length;
    } else if (x.dataset.x === 'custom') {
      const r = createCustom(exTab.q, exTab.chip !== 'all' ? exTab.chip : null); exTab.q = ''; toast(`Added “${r.ex.name}” to My exercises`); exTab.seg = 'mine'; render();
    } else if (x.dataset.x === 'more') { exTab.limit += 150; drawExResults(); }
    else if (x.dataset.x === 'seg-lib') { exTab.seg = 'lib'; render(); }
  });

  function exportJSON() {
    const payload = { app: 'slimtucci-diary', version: 1, exportedAt: new Date().toISOString(), data: state };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `slimtucci-diary-${todayStr()}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast('Backup downloaded');
  }
  document.getElementById('importFile').addEventListener('change', (ev) => {
    const f = ev.target.files[0]; if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const d = normalize(JSON.parse(rd.result));
        if (!confirm(`Replace everything on this phone with this backup (${d.sessions.length} workouts, ${d.exercises.length} exercises, ${d.templates.length} templates)?`)) return;
        state = d; save(); toast('Backup restored'); render();
      } catch (e) { alert('Could not import: ' + e.message); }
      ev.target.value = '';
    };
    rd.readAsText(f);
  });

  // ---------- events ----------
  document.addEventListener('click', (ev) => {
    if (ev.target.closest('.sheet-bg')) return;
    const tr = ev.target.closest('tr[data-href]'); if (tr) { location.hash = tr.dataset.href; return; }
    const el = ev.target.closest('[data-action]'); if (!el || el.disabled) return;
    ev.preventDefault(); doAction(el.dataset.action, el);
  });
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') { const c = document.querySelector('.sheet-bg [data-x="close"]'); if (c) c.click(); }
    if (ev.key === 'Enter' && ev.target.matches('tr[data-href]')) location.hash = ev.target.dataset.href;
  });
  function onField(ev) {
    const el = ev.target; const b = el.dataset && el.dataset.bind; if (!b) return;
    // Ignore late blur/change events from a view we already navigated away from.
    if (location.hash !== renderedHash || !el.isConnected) return;
    const k = el.dataset.k, v = el.value;
    if (b === 'session') {
      const s = curSession(); if (!s) return;
      if (k === 'date') { if (!v) return; s.date = v; touch(s); save(); if (ev.type === 'change') rerenderKeepScroll(); return; }
      s[k] = v; touch(s); if (k === 'name') document.getElementById('title').textContent = v || 'Workout';
    } else if (b === 'set') { const s = curSession(); if (!s) return; s.exercises[+el.dataset.ei].sets[+el.dataset.si][k] = v; touch(s); }
    else if (b === 'exnote') { const s = curSession(); if (!s) return; s.exercises[+el.dataset.ei].notes = v; touch(s); }
    else if (b === 'exdef') { const e = exById(curId()); if (!e) return; if (k === 'name' && !v.trim()) return; e[k] = k === 'name' ? v.trim() : v; if (k === 'name') document.getElementById('title').textContent = v; }
    else if (b === 'tpl') { const t = curTpl(); if (!t || !v.trim()) return; t.name = v.trim(); document.getElementById('title').textContent = v; }
    else if (b === 'ti') { const t = curTpl(); if (!t) return; t.items[+el.dataset.i][k] = k === 'sets' ? Math.max(1, parseInt(v, 10) || 1) : v; }
    else if (b === 'macro') { macroInput(); return; }
    else if (b === 'setting') { state.settings[k] = v || null; save(); if (ev.type === 'change') render(); return; }
    save();
  }
  $app.addEventListener('input', onField);
  $app.addEventListener('change', onField);
  window.addEventListener('hashchange', render);
  window.addEventListener('pagehide', save);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') save(); });

  // expose helpers for testing / debugging
  window.SlimTucci = { computeTargets: (p, x) => MAC.computeTargets(p, x), computeBurnExtra: MAC.computeBurnExtra, caloriesBurnedToday, adjustedToday, whoopConfigured: () => !!WHOOP_URL, weekStart, weekEnd, weekNum, weekLabel, search: (q) => searchList(LIB_ITEMS, q, (x) => x.hay, (x) => x.key).slice(0, 10).map((x) => x.name), libSize: LIB_ITEMS.length, get state() { return state; } };

  render();
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch((e) => console.warn('SW failed', e)));
  }
})();
