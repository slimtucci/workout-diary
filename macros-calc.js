/* SlimTucci macro calculator: pure math, no UI.
 * Follows the SlimTucci Nutrition Desk macro framework (nutrition-desk/macro-framework.md):
 *   1. BMR: Mifflin-St Jeor (default). If body-fat % is given: Katch-McArdle (alternate, requested by Alex).
 *   2. TDEE = BMR × activity multiplier (1.2 / 1.375 / 1.55 / 1.725 / 1.9).
 *   3. Goal: cut −10/−15/−20 %, maintain 0 %, bulk +5/+10/+15 % (framework ranges: deficit 10–20 %, surplus 5–15 %).
 *   4. Protein (current body weight): cut 1.0 g/lb, maintain 0.9 g/lb, bulk 0.9 g/lb (framework 0.6–1.0 g/lb, higher in a deficit).
 *   5. Fat: 0.35 g/lb, never below the 0.3 g/lb floor, and held within 20–35 % of calories.
 *   6. Carbs fill the remaining calories.
 *   7. Round: calories to nearest 50 kcal, macros to nearest 5 g.
 */
(function () {
  'use strict';
  const LB_PER_KG = 2.20462;
  const ACTIVITY = {
    sedentary: { label: 'Sedentary', mult: 1.2, desc: 'Desk job, little or no training' },
    light: { label: 'Lightly active', mult: 1.375, desc: 'Light activity or 1–3 training days a week' },
    moderate: { label: 'Moderately active', mult: 1.55, desc: 'Lifting plus field work, 3–5 days a week' },
    very: { label: 'Very active', mult: 1.725, desc: 'Hard training most days, or a physical job' },
    athlete: { label: 'Athlete', mult: 1.9, desc: 'Two-a-days or pro in-season volume (check with your coach)' }
  };
  const GOALS = {
    cut: { label: 'Cut', intensities: { mild: -0.10, standard: -0.15, hard: -0.20 }, proteinPerLb: 1.0 },
    maintain: { label: 'Maintain', intensities: { standard: 0 }, proteinPerLb: 0.9 },
    bulk: { label: 'Bulk', intensities: { lean: 0.05, standard: 0.10, aggressive: 0.15 }, proteinPerLb: 0.9 }
  };
  const INTENSITY_LABEL = { mild: 'Mild', standard: 'Standard', hard: 'Hard', lean: 'Lean', aggressive: 'Aggressive' };
  const FAT_PER_LB = 0.35, FAT_FLOOR_PER_LB = 0.3, FAT_MIN_PCT = 0.20, FAT_MAX_PCT = 0.35;
  const round = (x, step) => Math.round(x / step) * step;
  const ceilTo = (x, step) => Math.ceil(x / step) * step;
  const floorTo = (x, step) => Math.floor(x / step) * step;

  function validate(p) {
    const errs = [];
    if (!(p.weightKg > 0)) errs.push('weight');
    if (!(p.heightCm > 0)) errs.push('height');
    if (!(p.age > 0)) errs.push('age');
    return errs;
  }

  /**
   * computeTargets(profile, extraBurnKcal = 0)
   * profile: { weightKg, heightCm, age, sex: 'male'|'female', activity, goal, intensity, bodyFat (optional %) }
   * extraBurnKcal: HOOK for a future "calories burned today" adjustment (e.g. a logged session or wearable).
   *   It's added to the day's calorie target before the macro split; protein and the fat floor stay put and the
   *   extra energy lands in carbs (and fat, if the 20 % floor needs it). Default 0, and nothing feeds it yet.
   * Returns null when required inputs are missing; { blocked: 'under18' } for under-18s (framework: coach review first).
   */
  function computeTargets(profile, extraBurnKcal = 0) {
    const p = profile || {};
    if (validate(p).length) return null;
    if (p.age < 18) return { blocked: 'under18' };
    const kg = p.weightKg, cm = p.heightCm, lb = kg * LB_PER_KG;
    const bf = Number(p.bodyFat);
    const useKatch = bf > 0 && bf < 70;
    const lbmKg = useKatch ? kg * (1 - bf / 100) : null;
    const bmr = useKatch ? 370 + 21.6 * lbmKg
      : 10 * kg + 6.25 * cm - 5 * p.age + (p.sex === 'female' ? -161 : 5);
    const act = ACTIVITY[p.activity] || ACTIVITY.moderate;
    const tdee = bmr * act.mult;
    const goal = GOALS[p.goal] || GOALS.maintain;
    const intensity = goal.intensities[p.intensity] !== undefined ? p.intensity : 'standard';
    const adj = goal.intensities[intensity];
    const extra = Math.max(0, Number(extraBurnKcal) || 0);
    const calories = round(tdee * (1 + adj) + extra, 50);

    const protein = round(lb * goal.proteinPerLb, 5);
    let fat = Math.max(lb * FAT_PER_LB, lb * FAT_FLOOR_PER_LB, (calories * FAT_MIN_PCT) / 9);
    fat = Math.min(fat, Math.max((calories * FAT_MAX_PCT) / 9, lb * FAT_FLOOR_PER_LB));
    fat = round(fat, 5);
    if (fat * 9 < calories * FAT_MIN_PCT - 1 || fat < lb * FAT_FLOOR_PER_LB) fat = ceilTo(Math.max((calories * FAT_MIN_PCT) / 9, lb * FAT_FLOOR_PER_LB), 5);
    let carbs = round((calories - protein * 4 - fat * 9) / 4, 5);
    const warnings = [];
    if (carbs < 0) { carbs = 0; warnings.push('Protein and fat already exceed this calorie target. Talk to your coach.'); }
    const macroKcal = protein * 4 + carbs * 4 + fat * 9;
    const pct = (k) => Math.round((k / macroKcal) * 100);
    return {
      calories, protein, carbs, fat, macroKcal,
      pct: { protein: pct(protein * 4), carbs: pct(carbs * 4), fat: pct(fat * 9) },
      bmr: Math.round(bmr), tdee: Math.round(tdee), method: useKatch ? 'Katch-McArdle' : 'Mifflin-St Jeor',
      activityMult: act.mult, activityLabel: act.label, goal: p.goal in GOALS ? p.goal : 'maintain', intensity, adjPct: Math.round(adj * 100),
      proteinPerLb: goal.proteinPerLb, weightLb: Math.round(lb * 10) / 10, lbmKg: lbmKg && Math.round(lbmKg * 10) / 10, extraBurnKcal: extra, warnings
    };
  }

  window.SlimTucciMacros = { computeTargets, ACTIVITY, GOALS, INTENSITY_LABEL, LB_PER_KG };
})();
