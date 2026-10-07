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
  const num = (v) => (v === '' || v == null || isNaN(Number(v)) ? null : Number(v));
  const fmtW = (w) => (w == null ? 'BW' : (Math.round(w * 100) / 100).toString());
  const fmtSet = (st) => `${fmtW(num(st.weight))} × ${num(st.reps) == null ? '–' : num(st.reps)}`;
  const isLogged = (st) => num(st.weight) != null || num(st.reps) != null;
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

  // ---------- state ----------
  let state;
  function seed() {
    const names = [
      ['Barbell Back Squat', 'Legs'], ['Barbell RDL', 'Legs'], ['Bulgarian Split Squat', 'Legs'], ['Lateral Lunge', 'Legs'],
      ['Cossack Squat', 'Legs'], ['Single-Leg RDL', 'Legs'], ['Landmine Rotation', 'Rotation'], ['Cable Woodchop', 'Rotation'],
      ['Med Ball Rotational Throw', 'Rotation'], ['Pallof Press', 'Core'], ['Bench Press', 'Push'], ['Single-Arm DB Bench', 'Push'],
      ['Landmine Press', 'Push'], ['Pull-Up', 'Pull'], ['Single-Arm DB Row', 'Pull'], ['Single-Arm Pulldown', 'Pull'],
      ['Trap Bar Deadlift', 'Full body'], ['Suitcase Carry', 'Carry'], ['Farmer Carry', 'Carry'], ['Lateral Sled Drag', 'Conditioning']
    ];
    const ex = names.map(([name, cat]) => ({ id: uid(), name, cat, notes: '' }));
    const by = (n) => ex.find((e) => e.name === n).id;
    const t = (name, items) => ({ id: uid(), name, items: items.map(([n, sets, reps]) => ({ exId: by(n), sets, reps: String(reps) })) });
    return {
      version: 1,
      settings: { programStart: weekStart(todayStr()) },
      exercises: ex,
      templates: [
        t('Monday Lower + Rotation', [['Barbell Back Squat', 4, 5], ['Barbell RDL', 3, 6], ['Bulgarian Split Squat', 3, 8], ['Lateral Lunge', 3, 8], ['Landmine Rotation', 3, 8], ['Cable Woodchop', 3, 10]]),
        t('Wednesday Upper (Unilateral)', [['Single-Arm DB Bench', 4, 8], ['Single-Arm DB Row', 4, 10], ['Landmine Press', 3, 8], ['Single-Arm Pulldown', 3, 10]]),
        t('Friday Upper + Rotational Core', [['Bench Press', 4, 5], ['Pull-Up', 4, 6], ['Med Ball Rotational Throw', 3, 5], ['Pallof Press', 3, 10]]),
        t('Saturday Full Body (Unilateral)', [['Trap Bar Deadlift', 3, 5], ['Cossack Squat', 3, 6], ['Single-Leg RDL', 3, 8], ['Lateral Sled Drag', 4, 20], ['Suitcase Carry', 3, 40]])
      ],
      sessions: []
    };
  }
  function load() {
    try { const raw = localStorage.getItem(KEY); if (raw) return normalize(JSON.parse(raw)); } catch (e) { console.error(e); }
    const s = seed(); localStorage.setItem(KEY, JSON.stringify(s)); return s;
  }
  function normalize(d) {
    d = d && d.data && d.app === 'slimtucci-diary' ? d.data : d;
    if (!d || !Array.isArray(d.exercises) || !Array.isArray(d.templates) || !Array.isArray(d.sessions)) throw new Error('Not a SlimTucci diary backup');
    d.settings = d.settings || {};
    if (!('programStart' in d.settings)) d.settings.programStart = null;
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
    clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), 2200);
  }
  function setChrome(title, back) {
    document.getElementById('title').textContent = title;
    document.title = title === 'SlimTucci' ? 'SlimTucci Workout Diary' : `${title} · SlimTucci`;
    document.getElementById('backBtn').hidden = !back;
    const tab = location.hash.split('/')[1] || 'home';
    const map = { '': 'home', log: 'home', history: 'history', exercises: 'exercises', exercise: 'exercises', templates: 'templates', template: 'templates', settings: 'settings' };
    document.querySelectorAll('.tabbar a').forEach((a) => a.classList.toggle('active', a.dataset.tab === (map[tab] || tab)));
  }
  function go(h) { if (location.hash === h) render(); else location.hash = h; }

  // exercise picker bottom sheet
  function pickExercise(title, onPick) {
    const bg = document.createElement('div'); bg.className = 'sheet-bg';
    bg.innerHTML = `<div class="sheet" role="dialog" aria-label="${esc(title)}"><h3>${esc(title)}</h3>
      <input type="search" id="pickQ" placeholder="Search or type a new exercise" autocomplete="off">
      <div id="pickList" style="margin-top:10px"></div>
      <button class="btn ghost block" data-x="close" style="margin-top:6px">Cancel</button></div>`;
    document.body.appendChild(bg);
    const q = bg.querySelector('#pickQ'), list = bg.querySelector('#pickList');
    const close = () => bg.remove();
    function draw() {
      const v = q.value.trim().toLowerCase();
      const hits = state.exercises.filter((e) => !v || e.name.toLowerCase().includes(v) || (e.cat || '').toLowerCase().includes(v));
      const exact = state.exercises.some((e) => e.name.toLowerCase() === v);
      list.innerHTML = (v && !exact ? `<button class="btn primary block" data-x="create" style="margin-bottom:8px">+ Create “${esc(q.value.trim())}”</button>` : '') +
        hits.map((e) => `<div class="list-item" data-x="pick" data-id="${e.id}"><div class="grow"><div class="title">${esc(e.name)}</div>${e.cat ? `<div class="small muted">${esc(e.cat)}</div>` : ''}</div><span class="accent bold">+</span></div>`).join('') +
        (!hits.length && !v ? '<div class="empty">No exercises yet. Type a name above.</div>' : '');
    }
    q.addEventListener('input', draw);
    bg.addEventListener('click', (ev) => {
      const el = ev.target.closest('[data-x]');
      if (ev.target === bg) return close();
      if (!el) return;
      if (el.dataset.x === 'close') close();
      if (el.dataset.x === 'pick') { close(); onPick(el.dataset.id); }
      if (el.dataset.x === 'create') { const e = { id: uid(), name: q.value.trim(), cat: '', notes: '' }; state.exercises.push(e); save(); close(); onPick(e.id); }
    });
    draw(); setTimeout(() => q.focus(), 50);
  }

  // ---------- views ----------
  function weekCard(anchor, opts = {}) {
    const ws = weekStart(anchor), today = todayStr();
    const inWeek = state.sessions.filter((s) => weekStart(s.date) === ws);
    const st = sessionStats(inWeek);
    const days = [0, 1, 2, 3, 4, 5, 6].map((i) => {
      const d = addDays(ws, i), has = inWeek.some((s) => s.date === d);
      return `<div class="day${has ? ' done' : ''}${d === today ? ' today' : ''}" data-date="${d}"><span>${DOW[i][0]}</span><span class="dn">${new Date(toMs(d)).getUTCDate()}</span><span class="dot"></span></div>`;
    }).join('');
    return `<div class="card" data-week="${ws}"><div class="week-head"><div class="week-title">${esc(weekLabel(ws))}</div>
      ${opts.nav ? `<div class="row"><button class="icon-btn" data-action="week-prev" aria-label="Previous week">‹</button><button class="icon-btn" data-action="week-next" aria-label="Next week">›</button></div>` : ''}</div>
      <div class="small muted">Sun–Sat</div>
      <div class="days">${days}</div>
      <div class="stats"><div class="stat"><b>${st.workouts}</b><span>Workouts</span></div><div class="stat"><b>${st.sets}</b><span>Sets</span></div><div class="stat"><b>${fmtVol(st.vol)}</b><span>Volume lb</span></div></div></div>`;
  }
  function sessionItem(s) {
    const names = s.exercises.map(exName);
    return `<a class="list-item" href="#/log/${s.id}" data-session="${s.id}"><div class="grow"><div class="title">${esc(s.name || 'Workout')}</div>
      <div class="small muted">${esc(fmtDate(s.date))} · ${s.exercises.length} exercise${s.exercises.length === 1 ? '' : 's'}</div>
      ${names.length ? `<div class="hist-ex">${esc(names.slice(0, 4).join(', '))}${names.length > 4 ? ` +${names.length - 4}` : ''}</div>` : ''}</div><span class="chev">›</span></a>`;
  }

  let homeWeek = null;
  function viewHome() {
    setChrome('SlimTucci', false);
    const anchor = homeWeek || todayStr();
    const ws = weekStart(anchor);
    const inWeek = sortedSessions().filter((s) => weekStart(s.date) === ws);
    $app.innerHTML = `${weekCard(anchor, { nav: true })}
      <h2>Start a workout</h2>
      ${state.templates.map((t) => `<div class="list-item" data-action="start" data-tpl="${t.id}"><div class="grow"><div class="title">${esc(t.name)}</div><div class="small muted">${t.items.length} exercises</div></div><span class="pill accent">Start</span></div>`).join('')}
      <button class="btn block" data-action="start" data-tpl="">+ Blank workout</button>
      <h2>${homeWeek && ws !== weekStart(todayStr()) ? 'Workouts that week' : 'This week'}</h2>
      ${inWeek.length ? inWeek.map(sessionItem).join('') : '<div class="empty">No workouts logged this week yet.</div>'}`;
  }

  function startWorkout(tplId) {
    const t = state.templates.find((x) => x.id === tplId);
    const now = new Date().toISOString();
    const s = { id: uid(), date: todayStr(), name: t ? t.name : 'Workout', templateId: t ? t.id : null, notes: '', createdAt: now, updatedAt: now, exercises: [] };
    if (t) s.exercises = t.items.filter((it) => exById(it.exId)).map((it) => ({ exId: it.exId, name: exName(it), target: it.reps, notes: '', sets: Array.from({ length: Math.max(1, Number(it.sets) || 1) }, () => ({ weight: '', reps: '', done: false })) }));
    state.sessions.push(s); save();
    go('#/log/' + s.id);
  }

  function viewLog(id) {
    const s = state.sessions.find((x) => x.id === id);
    if (!s) { $app.innerHTML = '<div class="empty">Workout not found.</div>'; return setChrome('Workout', true); }
    setChrome(s.name || 'Workout', true);
    const wl = weekLabel(s.date);
    $app.innerHTML = `<div class="card stack">
        <div><label class="f" for="sName">Workout name</label><input id="sName" data-bind="session" data-k="name" value="${esc(s.name)}"></div>
        <div><label class="f" for="sDate">Date</label><input id="sDate" type="date" data-bind="session" data-k="date" value="${esc(s.date)}"><div class="small muted" style="margin-top:6px" id="sWeek">${esc(wl)}</div></div>
        <details class="notes"${s.notes ? ' open' : ''}><summary>📝 Session notes${s.notes ? '' : ' (tap to add)'}</summary><textarea data-bind="session" data-k="notes" placeholder="How did it feel? Sleep, energy, niggles…">${esc(s.notes)}</textarea></details>
      </div>
      <div id="exList">${s.exercises.map((e, i) => exCard(s, e, i)).join('')}</div>
      ${s.exercises.length ? '' : '<div class="empty">No exercises yet. Add one below.</div>'}
      <div class="stack">
        <button class="btn primary block" data-action="add-ex">+ Add exercise</button>
        <div class="btn-row"><button class="btn" data-action="save-as-tpl">Save as template</button><button class="btn" data-action="finish">Done</button></div>
        <button class="btn danger block" data-action="del-session">Delete workout</button>
      </div>`;
  }
  function exCard(s, e, i) {
    const lp = lastPerformance(e.exId, s);
    const last = lp ? `Last time (${fmtDate(lp.s.date)}): ${lp.e.sets.filter(isLogged).map(fmtSet).join(' · ')}` : 'Last time: first time logging this';
    const lastSets = lp ? lp.e.sets.filter(isLogged) : [];
    return `<div class="ex-card" data-ei="${i}">
      <div class="ex-head"><div class="ex-name">${esc(exName(e))}${e.target ? ` <span class="pill">target ${esc(e.target)}</span>` : ''}</div>
        <button class="icon-btn" data-action="ex-up" data-ei="${i}" aria-label="Move up"${i === 0 ? ' disabled' : ''}>↑</button>
        <button class="icon-btn" data-action="ex-down" data-ei="${i}" aria-label="Move down"${i === s.exercises.length - 1 ? ' disabled' : ''}>↓</button>
        <button class="icon-btn danger" data-action="ex-remove" data-ei="${i}" aria-label="Remove exercise">✕</button></div>
      <div class="last">${esc(last)}</div>
      <table class="sets"><thead><tr><th>Set</th><th>lb</th><th>Reps</th><th></th><th></th></tr></thead><tbody>
      ${e.sets.map((st, j) => {
        const ph = lastSets[j] || lastSets[lastSets.length - 1];
        return `<tr><td class="n">${j + 1}</td>
          <td><input type="number" inputmode="decimal" step="any" min="0" data-bind="set" data-ei="${i}" data-si="${j}" data-k="weight" value="${esc(st.weight)}" placeholder="${ph && num(ph.weight) != null ? esc(num(ph.weight)) : 'lb'}" aria-label="Set ${j + 1} weight"></td>
          <td><input type="number" inputmode="numeric" step="1" min="0" data-bind="set" data-ei="${i}" data-si="${j}" data-k="reps" value="${esc(st.reps)}" placeholder="${ph && num(ph.reps) != null ? esc(num(ph.reps)) : esc(e.target || 'reps')}" aria-label="Set ${j + 1} reps"></td>
          <td class="ck"><button class="check${st.done ? ' on' : ''}" data-action="set-done" data-ei="${i}" data-si="${j}" aria-label="Mark set done">✓</button></td>
          <td class="x"><button class="icon-btn danger" data-action="set-remove" data-ei="${i}" data-si="${j}" aria-label="Remove set">−</button></td></tr>`;
      }).join('')}
      </tbody></table>
      <div class="ex-tools"><button class="btn sm" data-action="set-add" data-ei="${i}">+ Add set</button></div>
      <details class="notes"${e.notes ? ' open' : ''}><summary>📝 Exercise notes${e.notes ? '' : ' (tap to add)'}</summary><textarea data-bind="exnote" data-ei="${i}" placeholder="Cues, tempo, how it moved…">${esc(e.notes)}</textarea></details>
    </div>`;
  }

  let histQ = '';
  function viewHistory() {
    setChrome('History', false);
    $app.innerHTML = `<div class="search"><input type="search" id="histQ" placeholder="Search workout, exercise or notes" value="${esc(histQ)}" autocomplete="off"></div><div id="histList"></div>`;
    const inp = document.getElementById('histQ');
    inp.addEventListener('input', () => { histQ = inp.value; drawHistory(); });
    drawHistory();
  }
  function drawHistory() {
    const q = histQ.trim().toLowerCase();
    const list = sortedSessions().filter((s) => !q || (s.name || '').toLowerCase().includes(q) || (s.notes || '').toLowerCase().includes(q) ||
      s.exercises.some((e) => exName(e).toLowerCase().includes(q) || (e.notes || '').toLowerCase().includes(q)));
    const el = document.getElementById('histList');
    if (!list.length) { el.innerHTML = `<div class="empty">${q ? 'No workouts match “' + esc(histQ) + '”.' : 'No workouts logged yet. Start one from Today.'}</div>`; return; }
    // group by Sun–Sat week
    const groups = new Map();
    for (const s of list) { const k = weekStart(s.date); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(s); }
    el.innerHTML = [...groups.entries()].map(([ws, ss]) => {
      const st = sessionStats(ss);
      return `<div class="week-group" data-week="${ws}"><div class="week-group-head"><span class="wt">${esc(weekLabel(ws))}</span><span class="wsum">${st.workouts} workout${st.workouts === 1 ? '' : 's'} · ${st.sets} set${st.sets === 1 ? '' : 's'} · ${fmtVol(st.vol)} lb</span></div>${ss.map(sessionItem).join('')}</div>`;
    }).join('');
  }

  function viewExercises() {
    setChrome('Exercises', false);
    $app.innerHTML = `<div class="card"><label class="f" for="newEx" style="margin-top:0">New exercise</label>
      <div class="row"><input id="newEx" class="grow" placeholder="e.g. Hip Thrust" autocomplete="off"><button class="btn primary" data-action="ex-create">Add</button></div></div>
      <h2>Your library (${state.exercises.length})</h2>
      ${state.exercises.map((e, i) => `<div class="list-item" data-exrow="${e.id}"><a class="grow" href="#/exercise/${e.id}" style="color:inherit;text-decoration:none"><div class="title">${esc(e.name)}</div><div class="small muted">${esc(e.cat || '')}${(() => { const lp = lastPerformance(e.id); const t = lp && topSet(lp.e.sets); return t ? `${e.cat ? ' · ' : ''}last ${fmtSet(t)}` : ''; })()}</div></a>
        <button class="icon-btn" data-action="lib-up" data-i="${i}" aria-label="Move up"${i === 0 ? ' disabled' : ''}>↑</button><button class="icon-btn" data-action="lib-down" data-i="${i}" aria-label="Move down"${i === state.exercises.length - 1 ? ' disabled' : ''}>↓</button></div>`).join('') || '<div class="empty">No exercises yet.</div>'}`;
    document.getElementById('newEx').addEventListener('keydown', (ev) => { if (ev.key === 'Enter') doAction('ex-create'); });
  }

  function viewExercise(id) {
    const e = exById(id);
    if (!e) { setChrome('Exercise', true); $app.innerHTML = '<div class="empty">Exercise not found.</div>'; return; }
    setChrome(e.name, true);
    const rows = [];
    for (const s of sortedSessions()) for (const x of s.exercises) if (x.exId === id && x.sets.some(isLogged)) rows.push({ s, x, top: topSet(x.sets) });
    let best = null;
    for (const r of rows) { const w = num(r.top.weight) ?? -1, rp = num(r.top.reps) ?? 0; if (!best || w > best.w || (w === best.w && rp > best.r)) best = { w, r: rp, row: r }; }
    const groups = new Map();
    for (const r of rows) { const k = weekStart(r.s.date); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(r); }
    $app.innerHTML = `<div class="card stack">
        <div><label class="f" for="exName" style="margin-top:0">Name</label><input id="exName" data-bind="exdef" data-k="name" value="${esc(e.name)}"></div>
        <div><label class="f" for="exCat">Category</label><input id="exCat" data-bind="exdef" data-k="cat" value="${esc(e.cat || '')}" placeholder="Legs, Push, Pull, Rotation…"></div>
        <div><label class="f" for="exNotes">Notes / cues</label><textarea id="exNotes" data-bind="exdef" data-k="notes" placeholder="Setup, cues, machine settings…">${esc(e.notes || '')}</textarea></div>
      </div>
      ${best ? `<div class="card"><div class="small muted">Best set</div><div class="week-title">${esc(fmtSet(best.row.top))} <span class="small muted">· ${esc(fmtDate(best.row.s.date))}</span></div></div>` : ''}
      <h2>History by week (Sun–Sat)</h2>
      ${rows.length ? [...groups.entries()].map(([ws, rs]) => {
        const wkTop = topSet(rs.map((r) => r.top));
        return `<div class="card tight" data-week="${ws}"><div class="week-group-head" style="margin:4px 0"><span class="wt">${esc(weekLabel(ws))}</span><span class="wsum">top ${esc(fmtSet(wkTop))}</span></div>
          <table class="hist">${rs.map((r) => `<tr data-href="#/log/${r.s.id}"><td>${esc(fmtDate(r.s.date))}<div class="small muted">${esc(r.x.sets.filter(isLogged).map(fmtSet).join(' · '))}</div></td><td>${esc(fmtSet(r.top))}${best && r === best.row ? '<span class="badge-pr">BEST</span>' : ''}</td></tr>`).join('')}</table></div>`;
      }).join('') : '<div class="empty">Not logged yet.</div>'}
      <button class="btn danger block" data-action="ex-delete" data-id="${e.id}" style="margin-top:14px">Delete exercise</button>`;
  }

  function viewTemplates() {
    setChrome('Templates', false);
    $app.innerHTML = `<div class="card"><label class="f" for="newTpl" style="margin-top:0">New template</label>
      <div class="row"><input id="newTpl" class="grow" placeholder="e.g. Monday Lower + Rotation" autocomplete="off"><button class="btn primary" data-action="tpl-create">Add</button></div></div>
      <h2>Your templates</h2>
      ${state.templates.map((t, i) => `<div class="list-item"><a class="grow" href="#/template/${t.id}" style="color:inherit;text-decoration:none"><div class="title">${esc(t.name)}</div><div class="small muted">${t.items.length} exercises</div></a>
        <button class="icon-btn" data-action="tpl-up" data-i="${i}" aria-label="Move up"${i === 0 ? ' disabled' : ''}>↑</button><button class="icon-btn" data-action="tpl-down" data-i="${i}" aria-label="Move down"${i === state.templates.length - 1 ? ' disabled' : ''}>↓</button></div>`).join('') || '<div class="empty">No templates yet.</div>'}`;
    document.getElementById('newTpl').addEventListener('keydown', (ev) => { if (ev.key === 'Enter') doAction('tpl-create'); });
  }

  function viewTemplate(id) {
    const t = state.templates.find((x) => x.id === id);
    if (!t) { setChrome('Template', true); $app.innerHTML = '<div class="empty">Template not found.</div>'; return; }
    setChrome(t.name, true);
    $app.innerHTML = `<div class="card"><label class="f" for="tName" style="margin-top:0">Template name</label><input id="tName" data-bind="tpl" data-k="name" value="${esc(t.name)}"></div>
      <h2>Exercises</h2>
      ${t.items.map((it, i) => `<div class="ex-card"><div class="ex-head"><div class="ex-name">${esc(exName(it))}</div>
          <button class="icon-btn" data-action="ti-up" data-i="${i}" aria-label="Move up"${i === 0 ? ' disabled' : ''}>↑</button>
          <button class="icon-btn" data-action="ti-down" data-i="${i}" aria-label="Move down"${i === t.items.length - 1 ? ' disabled' : ''}>↓</button>
          <button class="icon-btn danger" data-action="ti-remove" data-i="${i}" aria-label="Remove">✕</button></div>
        <div class="row" style="margin-top:8px"><div class="grow"><label class="f">Sets</label><input type="number" inputmode="numeric" min="1" data-bind="ti" data-i="${i}" data-k="sets" value="${esc(it.sets)}"></div>
        <div class="grow"><label class="f">Target reps</label><input data-bind="ti" data-i="${i}" data-k="reps" value="${esc(it.reps)}" placeholder="e.g. 5 or 8-10"></div></div></div>`).join('') || '<div class="empty">No exercises in this template yet.</div>'}
      <div class="stack"><button class="btn block" data-action="ti-add">+ Add exercise</button>
        <button class="btn primary block" data-action="start" data-tpl="${t.id}">Start this workout</button>
        <button class="btn danger block" data-action="tpl-delete">Delete template</button></div>`;
  }

  function viewSettings() {
    setChrome('More', false);
    const ps = state.settings.programStart;
    const st = sessionStats(state.sessions);
    $app.innerHTML = `<h2>Program</h2><div class="card">
        <label class="f" for="progStart" style="margin-top:0">Program start date</label>
        <input id="progStart" type="date" data-bind="setting" data-k="programStart" value="${esc(ps || '')}">
        <div class="small muted" style="margin-top:8px">Weeks run Sunday → Saturday. Week 1 is the Sun–Sat week containing this date${ps ? ` (${esc(rangeLabel(ps))})` : ''}. This week: <b id="curWeek">${esc(weekLabel(todayStr()))}</b></div></div>
      <h2>Backup</h2><div class="card stack">
        <div class="small muted">Your diary lives only on this phone. Export a backup regularly (and before changing phones or clearing your browser), then Import it to restore.</div>
        <div class="btn-row"><button class="btn primary" data-action="export">Export JSON</button><button class="btn" data-action="import">Import JSON</button></div>
        <div class="small muted">${st.workouts} workouts · ${state.exercises.length} exercises · ${state.templates.length} templates · <span id="persist">checking storage…</span></div></div>
      <h2>Danger zone</h2><div class="card stack">
        <button class="btn danger block" data-action="wipe">Erase all data</button></div>
      <div class="empty small">SlimTucci Workout Diary · works offline · add to Home Screen from your browser's Share/menu</div>`;
    if (navigator.storage && navigator.storage.persisted) navigator.storage.persisted().then((p) => { const el = document.getElementById('persist'); if (el) el.textContent = p ? 'storage: persistent' : 'storage: best-effort'; });
    else document.getElementById('persist').textContent = 'storage: local';
  }

  // ---------- router ----------
  let renderedHash = null;
  function render() {
    renderedHash = null; // blur/change events fired while the old view is torn down are ignored
    const parts = (location.hash.replace(/^#\/?/, '') || '').split('/');
    const [r, id] = parts;
    window.scrollTo(0, 0);
    if (r === 'log') viewLog(id);
    else if (r === 'history') viewHistory();
    else if (r === 'exercises') viewExercises();
    else if (r === 'exercise') viewExercise(id);
    else if (r === 'templates') viewTemplates();
    else if (r === 'template') viewTemplate(id);
    else if (r === 'settings') viewSettings();
    else viewHome();
    renderedHash = location.hash;
  }
  function rerenderKeepScroll() { const y = window.scrollY; render(); window.scrollTo(0, y); }
  const curId = () => location.hash.split('/')[2];
  const curSession = () => state.sessions.find((s) => s.id === curId());
  const curTpl = () => state.templates.find((t) => t.id === curId());
  function swap(arr, i, j) { if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; }
  const touch = (s) => { s.updatedAt = new Date().toISOString(); };

  function doAction(a, el) {
    el = el || {};
    const d = el.dataset || {};
    const s = curSession(), t = curTpl();
    const ei = Number(d.ei), si = Number(d.si), i = Number(d.i);
    switch (a) {
      case 'back': if (history.length > 1) history.back(); else go('#/'); break;
      case 'week-prev': homeWeek = addDays(weekStart(homeWeek || todayStr()), -7); render(); break;
      case 'week-next': homeWeek = addDays(weekStart(homeWeek || todayStr()), 7); render(); break;
      case 'start': startWorkout(d.tpl); break;
      case 'add-ex': pickExercise('Add exercise', (id) => { s.exercises.push({ exId: id, name: exById(id).name, target: '', notes: '', sets: [{ weight: '', reps: '', done: false }] }); touch(s); save(); rerenderKeepScroll(); }); break;
      case 'ex-up': swap(s.exercises, ei, ei - 1); touch(s); save(); rerenderKeepScroll(); break;
      case 'ex-down': swap(s.exercises, ei, ei + 1); touch(s); save(); rerenderKeepScroll(); break;
      case 'ex-remove': if (confirm(`Remove ${exName(s.exercises[ei])} from this workout?`)) { s.exercises.splice(ei, 1); touch(s); save(); rerenderKeepScroll(); } break;
      case 'set-add': { const sets = s.exercises[ei].sets, prev = sets[sets.length - 1]; sets.push({ weight: prev ? prev.weight : '', reps: prev ? prev.reps : '', done: false }); touch(s); save(); rerenderKeepScroll(); break; }
      case 'set-remove': s.exercises[ei].sets.splice(si, 1); touch(s); save(); rerenderKeepScroll(); break;
      case 'set-done': { const st = s.exercises[ei].sets[si]; st.done = !st.done; el.classList.toggle('on', st.done); touch(s); save(); break; }
      case 'finish': toast('Workout saved'); go('#/history'); break;
      case 'save-as-tpl': {
        const name = prompt('Template name', s.name || 'Workout'); if (!name) break;
        state.templates.push({ id: uid(), name: name.trim(), items: s.exercises.map((e) => ({ exId: e.exId, sets: e.sets.length || 1, reps: e.target || String(num((topSet(e.sets) || {}).reps) ?? '') })) });
        save(); toast('Template saved'); break;
      }
      case 'del-session': if (confirm('Delete this workout? This cannot be undone.')) { state.sessions = state.sessions.filter((x) => x.id !== s.id); save(); toast('Workout deleted'); go('#/history'); } break;
      case 'ex-create': {
        const inp = document.getElementById('newEx'); const name = inp.value.trim(); if (!name) return inp.focus();
        if (state.exercises.some((e) => e.name.toLowerCase() === name.toLowerCase())) { toast('That exercise already exists'); break; }
        state.exercises.unshift({ id: uid(), name, cat: '', notes: '' }); save(); toast('Exercise added'); render(); break;
      }
      case 'lib-up': swap(state.exercises, i, i - 1); save(); rerenderKeepScroll(); break;
      case 'lib-down': swap(state.exercises, i, i + 1); save(); rerenderKeepScroll(); break;
      case 'ex-delete': {
        const e = exById(d.id);
        if (!confirm(`Delete “${e.name}” from your library? Past workouts keep their logs; it is removed from templates.`)) break;
        for (const ss of state.sessions) for (const x of ss.exercises) if (x.exId === e.id) x.name = e.name;
        for (const tt of state.templates) tt.items = tt.items.filter((it) => it.exId !== e.id);
        state.exercises = state.exercises.filter((x) => x.id !== e.id); save(); toast('Exercise deleted'); go('#/exercises'); break;
      }
      case 'tpl-create': {
        const inp = document.getElementById('newTpl'); const name = inp.value.trim(); if (!name) return inp.focus();
        const nt = { id: uid(), name, items: [] }; state.templates.push(nt); save(); go('#/template/' + nt.id); break;
      }
      case 'tpl-up': swap(state.templates, i, i - 1); save(); rerenderKeepScroll(); break;
      case 'tpl-down': swap(state.templates, i, i + 1); save(); rerenderKeepScroll(); break;
      case 'ti-up': swap(t.items, i, i - 1); save(); rerenderKeepScroll(); break;
      case 'ti-down': swap(t.items, i, i + 1); save(); rerenderKeepScroll(); break;
      case 'ti-remove': t.items.splice(i, 1); save(); rerenderKeepScroll(); break;
      case 'ti-add': pickExercise('Add to template', (id) => { t.items.push({ exId: id, sets: 3, reps: '8' }); save(); rerenderKeepScroll(); }); break;
      case 'tpl-delete': if (confirm(`Delete template “${t.name}”? Logged workouts are kept.`)) { state.templates = state.templates.filter((x) => x.id !== t.id); save(); toast('Template deleted'); go('#/templates'); } break;
      case 'export': exportJSON(); break;
      case 'import': document.getElementById('importFile').click(); break;
      case 'wipe':
        if (confirm('Erase ALL workouts, exercises and templates on this phone? Export a backup first!') && confirm('Really erase everything?')) {
          state = { version: 1, settings: { programStart: weekStart(todayStr()) }, exercises: [], templates: [], sessions: [] }; save(); toast('All data erased'); go('#/');
        }
        break;
    }
  }

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
    const tr = ev.target.closest('tr[data-href]'); if (tr) { location.hash = tr.dataset.href; return; }
    const day = ev.target.closest('.day[data-date]');
    if (day) { const ss = sortedSessions().filter((x) => x.date === day.dataset.date); if (ss.length) location.hash = '#/log/' + ss[ss.length - 1].id; return; }
    const el = ev.target.closest('[data-action]'); if (!el || el.disabled) return;
    ev.preventDefault(); doAction(el.dataset.action, el);
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
    } else if (b === 'set') { const s = curSession(); s.exercises[+el.dataset.ei].sets[+el.dataset.si][k] = v; touch(s); }
    else if (b === 'exnote') { const s = curSession(); s.exercises[+el.dataset.ei].notes = v; touch(s); }
    else if (b === 'exdef') { const e = exById(curId()); if (k === 'name' && !v.trim()) return; e[k] = k === 'name' ? v.trim() : v; if (k === 'name') document.getElementById('title').textContent = v; }
    else if (b === 'tpl') { const t = curTpl(); if (!v.trim()) return; t.name = v.trim(); document.getElementById('title').textContent = v; }
    else if (b === 'ti') { const t = curTpl(); t.items[+el.dataset.i][k] = k === 'sets' ? Math.max(1, parseInt(v, 10) || 1) : v; }
    else if (b === 'setting') { state.settings[k] = v || null; save(); if (ev.type === 'change') render(); return; }
    save();
  }
  $app.addEventListener('input', onField);
  $app.addEventListener('change', onField);
  window.addEventListener('hashchange', render);
  window.addEventListener('pagehide', save);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') save(); });

  // expose week helpers for testing / debugging
  window.SlimTucci = { weekStart, weekEnd, weekNum, weekLabel, get state() { return state; } };

  render();
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch((e) => console.warn('SW failed', e)));
  }
})();
