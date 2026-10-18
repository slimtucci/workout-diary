/* SlimTucci body map: our own simple front/back muscle diagram (plain SVG, no external art).
   Muscle region ids match exercise-media.js (built by tools/build_media.py). */
(function () {
  'use strict';
  const NAMES = { chest: 'Chest', fdelt: 'Front delts', sdelt: 'Side delts', rdelt: 'Rear delts', biceps: 'Biceps', triceps: 'Triceps', forearm: 'Forearms',
    abs: 'Abs', oblique: 'Obliques', lats: 'Lats', upback: 'Upper back', traps: 'Traps', lowback: 'Lower back', glutes: 'Glutes', hipflex: 'Hip flexors',
    adduct: 'Adductors', abduct: 'Abductors', quads: 'Quads', hams: 'Hamstrings', calves: 'Calves', shins: 'Shins' };
  // mirror helper: shapes are drawn for the figure's right side (viewer's left, x < 50) and mirrored around x = 50
  const M = (d) => d + `<g transform="translate(100 0) scale(-1 1)">${d}</g>`;
  const e = (cx, cy, rx, ry, rot) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"${rot ? ` transform="rotate(${rot} ${cx} ${cy})"` : ''}/>`;
  const p = (d) => `<path d="${d}"/>`;
  // base silhouette (same outline front and back)
  const BASE = e(50, 13, 8.5, 10.5) + p('M45 22h10v9H45z') +
    p('M33 31 Q50 27 67 31 L73 37 Q76 44 74 50 L70 92 Q68 104 64 112 L36 112 Q32 104 30 92 L26 50 Q24 44 27 37 Z') +
    M(p('M27 36 Q20 40 19.5 52 L17 76 Q15 88 15.5 98 L21 99 Q22 88 24.5 77 L29 54 Z') + e(18, 103, 3.6, 5)) +
    M(p('M36 108 Q30 120 31.5 140 L34 164 Q33 172 34 182 L35.5 204 L45 204 L45.5 182 Q47 170 46 162 L49.5 126 L50 112 Z') + e(40, 209, 6.2, 3.6));
  const FRONT = {
    traps: M(p('M44.5 27 L36 32.5 L44.5 33.5 Z')),
    sdelt: M(e(25.5, 41, 4.2, 6.5, 15)),
    fdelt: M(e(29.5, 39, 5.2, 6.2, -10)),
    chest: M(p('M49.4 36 Q41 34 34.5 38 Q32.5 46 36 51.5 Q42 55.5 49.4 54 Z')),
    biceps: M(e(24.6, 57.5, 3.7, 9.5, 8)),
    forearm: M(e(20.5, 81, 3.4, 12, 9)),
    abs: p('M44.3 57 h11.4 a1.5 1.5 0 0 1 1.5 1.5 V92 q-1 8 -7.2 12 q-6.2 -4 -7.2 -12 V58.5 a1.5 1.5 0 0 1 1.5 -1.5z'),
    oblique: M(p('M42.5 58 L35 56 Q33 72 34.5 90 Q37 99 42.5 101 Z')),
    abduct: M(e(33.5, 116, 3, 8.5, 8)),
    hipflex: M(e(41, 110, 3.2, 6, -32)),
    quads: M(p('M36.5 117 Q33.5 132 35.5 152 Q37.5 162 42 163 Q46 161 46.8 150 Q48 132 45.8 120 Q41.5 112 36.5 117 Z')),
    adduct: M(p('M47 116 L49.6 118 L49.4 140 Q47.5 138 46.3 130 Z')),
    shins: M(e(41.8, 186, 2.6, 13, 2)),
    calves: M(e(37.2, 184, 2.4, 11, 4)),
  };
  const BACK = {
    traps: p('M50 25.5 L39 33 Q43 43 46 52 L50 62 L54 52 Q57 43 61 33 Z'),
    sdelt: M(e(25.5, 41, 4.2, 6.5, 15)),
    rdelt: M(e(30, 39, 5, 5.8, 12)),
    upback: M(p('M45 40 L37 42 Q36 50 39.5 55 L46 57 Z')),
    lats: M(p('M36 52 Q33 64 36 80 L45.5 88 L46 62 Q41 60 36 52 Z')),
    lowback: M(p('M49.4 80 L45 80 L44.5 99 L49.4 101 Z')),
    triceps: M(e(25, 56, 3.9, 9.5, 10)),
    forearm: M(e(20.5, 81, 3.4, 12, 9)),
    abduct: M(e(35, 104, 4, 4.6, 0)),
    glutes: M(p('M49.4 103 Q42 101 37 106 Q34.5 115 37.5 121 Q43.5 125 49.4 121 Z')),
    hams: M(p('M37 124 Q34.5 138 36.5 154 Q38.5 162 41.5 162 Q44.5 158 45.5 150 Q46.8 136 46 124 Q41.5 121 37 124 Z')),
    adduct: M(p('M47 124 L49.6 125 L49.4 146 Q47.6 144 46.8 136 Z')),
    calves: M(p('M36.5 172 Q34.5 182 37 192 Q40 197 41 196 Q44.5 193 45 184 Q45 173 42 170 Q38.5 169 36.5 172 Z')),
  };
  const ALLF = Object.keys(FRONT), ALLB = Object.keys(BACK);
  const dark = () => !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  function colors() {
    return dark() ? { base: '#2a363b', idle: '#3a4950', line: '#141c1f', p: '#ff5a5f', s: '#a8494c' }
      : { base: '#e7eaed', idle: '#cfd5da', line: '#ffffff', p: '#e5484d', s: '#f6aaa5' };
  }
  function fig(map, keys, P, S, c) {
    let h = `<g fill="${c.base}">${BASE}</g>`;
    for (const k of keys) {
      const f = P.has(k) ? c.p : S.has(k) ? c.s : c.idle;
      h += `<g fill="${f}" stroke="${c.line}" stroke-width=".6" data-m="${k}">${map[k]}</g>`;
    }
    return h;
  }
  const toSet = (x) => (x instanceof Set ? x : new Set(typeof x === 'string' ? x.split(' ').filter(Boolean) : x || []));
  // view: 'both' | 'front' | 'back' | 'auto' (the view that shows the primary muscles best)
  function pickView(P) {
    let f = 0, b = 0; for (const k of P) { if (FRONT[k] && !BACK[k]) f++; if (BACK[k] && !FRONT[k]) b++; }
    return b > f ? 'back' : 'front';
  }
  function svg(primary, secondary, opts) {
    opts = opts || {};
    const P = toSet(primary), S = toSet(secondary), c = colors();
    let view = opts.view || 'both'; if (view === 'auto') view = pickView(P);
    const lbl = opts.label ? ` role="img" aria-label="${opts.label.replace(/"/g, '')}"` : ' aria-hidden="true"';
    const cls = opts.cls ? ` class="${opts.cls}"` : '';
    if (view === 'both') {
      const cap = opts.captions ? `<text x="50" y="219" text-anchor="middle" font-size="7" font-weight="700" fill="${c.idle}" font-family="-apple-system,Segoe UI,Roboto,sans-serif">FRONT</text><text x="150" y="219" text-anchor="middle" font-size="7" font-weight="700" fill="${c.idle}" font-family="-apple-system,Segoe UI,Roboto,sans-serif">BACK</text>` : '';
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 ${opts.captions ? 222 : 214}"${cls}${lbl}><g>${fig(FRONT, ALLF, P, S, c)}</g><g transform="translate(100 0)">${fig(BACK, ALLB, P, S, c)}</g>${cap}</svg>`;
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 214"${cls}${lbl}>${view === 'back' ? fig(BACK, ALLB, P, S, c) : fig(FRONT, ALLF, P, S, c)}</svg>`;
  }
  // cached data: URI (one <img> per card instead of hundreds of inline SVG nodes)
  const cache = new Map();
  function uri(primary, secondary, view) {
    const key = (dark() ? 'd|' : 'l|') + [...toSet(primary)].join(' ') + '|' + [...toSet(secondary)].join(' ') + '|' + (view || 'both');
    let u = cache.get(key);
    if (!u) { u = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg(primary, secondary, { view })); cache.set(key, u); }
    return u;
  }
  // Muscle-group filter chips (the Exercises tab)
  const GROUPS = [
    ['chest', 'Chest', 'chest'], ['back', 'Back', 'lats upback traps lowback'], ['shoulders', 'Shoulders', 'fdelt sdelt rdelt'],
    ['biceps', 'Biceps', 'biceps'], ['triceps', 'Triceps', 'triceps'], ['forearms', 'Forearms', 'forearm'], ['core', 'Core', 'abs oblique'],
    ['glutes', 'Glutes', 'glutes'], ['quads', 'Quadriceps', 'quads'], ['hams', 'Hamstrings', 'hams'], ['hips', 'Hips', 'hipflex adduct abduct'],
    ['calves', 'Calves', 'calves shins'],
  ].map(([k, label, m]) => ({ key: k, label, muscles: m.split(' ') }));
  // Rough muscles for his own custom exercises (library movements use exercise-media.js)
  const CUSTOM_RULES = [
    [/lateral raise|side raise/, 'sdelt', ''], [/rear delt|face pull|reverse fly/, 'rdelt', 'upback'], [/hamstring|leg curl|nordic/, 'hams', 'glutes'],
    [/curl/, 'biceps', 'forearm'], [/tricep|pushdown|skull|kickback/, 'triceps', ''], [/bench|chest|push-?up|fly|pec|dip/, 'chest', 'fdelt triceps'],
    [/overhead|shoulder|military|ohp|arnold/, 'fdelt', 'sdelt triceps'], [/pull-?up|chin|pulldown|lat\b/, 'lats', 'biceps upback'], [/row/, 'upback lats', 'biceps rdelt'],
    [/shrug/, 'traps', ''], [/deadlift|rdl|hinge|good morning|swing/, 'hams glutes', 'lowback'], [/hip thrust|bridge|glute|kickback/, 'glutes', 'hams'],
    [/calf/, 'calves', ''], [/squat|leg press|lunge|step|split/, 'quads glutes', 'hams adduct'], [/rotat|twist|chop|pallof|oblique|scrum/, 'oblique', 'abs'],
    [/plank|crunch|core|\bab|sit-?up|hollow/, 'abs', 'oblique'], [/carry|farmer|grip|hang/, 'forearm traps', 'abs'], [/sled|sprint|run|bike|row(ing)? machine/, 'quads glutes', 'calves hams'],
    [/jump|hop|bound|plyo/, 'quads glutes', 'calves'], [/stretch|mobility/, 'hams', ''],
  ];
  const CAT_DEFAULT = { push: ['chest fdelt', 'triceps'], pull: ['lats upback', 'biceps'], legs: ['quads glutes', 'hams'], core: ['abs', 'oblique'],
    power: ['quads glutes', 'calves'], carry: ['forearm traps', 'abs'], cardio: ['quads glutes', 'calves'], agility: ['glutes abduct adduct', 'quads calves'] };
  function inferCustom(name, catKey) {
    const n = String(name || '').toLowerCase();
    for (const [re, a, b] of CUSTOM_RULES) if (re.test(n)) return { p: a.split(' '), s: b.split(' ').filter(Boolean) };
    const d = CAT_DEFAULT[catKey]; return d ? { p: d[0].split(' '), s: d[1].split(' ') } : { p: [], s: [] };
  }
  window.SlimTucciBody = { NAMES, GROUPS, REGIONS: Object.keys(NAMES), svg, uri, inferCustom, clearCache: () => cache.clear() };
})();
