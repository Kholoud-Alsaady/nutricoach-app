// Deterministic nutrition math + sanity checks.
// RULE: the LLM never does arithmetic. Every number shown to a user or saved to
// the database passes through these functions.

import type { Macros, MealSnapshot, Verification, VerificationCheck } from "./types";

export const ZERO: Macros = { calories: 0, protein: 0, carbs: 0, fat: 0 };

/** Calories from macros: protein×4 + carbs×4 + fat×9 */
export function caloriesFromMacros(protein: number, carbs: number, fat: number): number {
  return Math.round(protein * 4 + carbs * 4 + fat * 9);
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Round macros and ALWAYS recompute calories from them. */
export function normalizeMacros(m: { protein: number; carbs: number; fat: number }): Macros {
  const protein = Math.max(0, round1(Number(m.protein) || 0));
  const carbs = Math.max(0, round1(Number(m.carbs) || 0));
  const fat = Math.max(0, round1(Number(m.fat) || 0));
  return { calories: caloriesFromMacros(protein, carbs, fat), protein, carbs, fat };
}

export function scaleMacros(m: Macros, factor: number): Macros {
  return normalizeMacros({ protein: m.protein * factor, carbs: m.carbs * factor, fat: m.fat * factor });
}

export function sumMacros(items: Macros[]): Macros {
  const total = items.reduce(
    (acc, m) => ({
      calories: acc.calories + Number(m.calories || 0),
      protein: acc.protein + Number(m.protein || 0),
      carbs: acc.carbs + Number(m.carbs || 0),
      fat: acc.fat + Number(m.fat || 0),
    }),
    { ...ZERO }
  );
  return {
    calories: Math.round(total.calories),
    protein: round1(total.protein),
    carbs: round1(total.carbs),
    fat: round1(total.fat),
  };
}

export function subtractMacros(a: Macros, b: Macros): Macros {
  return {
    calories: Math.round(a.calories - b.calories),
    protein: round1(a.protein - b.protein),
    carbs: round1(a.carbs - b.carbs),
    fat: round1(a.fat - b.fat),
  };
}

/** Percentage difference of value vs target, e.g. +12 means 12% over. */
export function pctDiff(value: number, target: number): number {
  if (!target) return 0;
  return Math.round(((value - target) / target) * 100);
}

export function pctOf(value: number, target: number): number {
  if (!target) return 0;
  return Math.round((value / target) * 100);
}

// ---------------------------------------------------------------------------
// Sanity checks
// ---------------------------------------------------------------------------

export const MEAL_LIMITS = { minCalories: 50, maxCalories: 1600, maxProtein: 120 };

/** Checks a single meal. Returns a list of problems (empty = OK). */
export function checkMeal(meal: Partial<MealSnapshot>, claimedCalories?: number): string[] {
  const issues: string[] = [];
  const { protein, carbs, fat } = meal;
  if (protein == null || carbs == null || fat == null || [protein, carbs, fat].some((v) => Number.isNaN(Number(v)))) {
    issues.push("Missing macros");
    return issues;
  }
  if (protein < 0 || carbs < 0 || fat < 0) issues.push("Negative macro values");
  const kcal = caloriesFromMacros(protein, carbs, fat);
  if (kcal < MEAL_LIMITS.minCalories) issues.push(`Very low calories (${kcal} kcal)`);
  if (kcal > MEAL_LIMITS.maxCalories) issues.push(`Unreasonably high calories (${kcal} kcal)`);
  if (protein > MEAL_LIMITS.maxProtein) issues.push(`Unreasonably high protein (${protein} g)`);
  if (claimedCalories != null && claimedCalories > 0) {
    const mismatch = Math.abs(claimedCalories - kcal) / kcal;
    if (mismatch > 0.15) issues.push(`Stated calories (${claimedCalories}) don't match macros (${kcal}); macros used`);
  }
  return issues;
}

/** Day-level tolerance used across the app. */
export const DAY_TOLERANCE = { caloriesPct: 10, proteinMinPct: 90 };

/**
 * Verify a set of proposed meals: every meal is sane and calories match
 * macros, and (optionally) each affected day lands near its target.
 */
export function verifyMeals(
  meals: MealSnapshot[],
  dayTotals: { date: string; totals: Macros }[] = [],
  target?: Macros
): Verification {
  const checks: VerificationCheck[] = [];

  const mealIssues = meals.flatMap((m) => checkMeal(m).map((i) => `${m.meal_name}: ${i}`));
  checks.push({
    label: "Meal sanity",
    ok: mealIssues.length === 0,
    detail: mealIssues.length ? mealIssues.join("; ") : `${meals.length} meal(s) within safe ranges, no negative or missing values`,
  });

  const mismatched = meals.filter((m) => Math.abs(m.calories - caloriesFromMacros(m.protein, m.carbs, m.fat)) > 1);
  checks.push({
    label: "Calories = P×4 + C×4 + F×9",
    ok: mismatched.length === 0,
    detail: mismatched.length ? `${mismatched.length} meal(s) recalculated` : "All meal calories recomputed from macros",
  });

  if (target) {
    for (const d of dayTotals) {
      const calDiff = pctDiff(d.totals.calories, target.calories);
      const proteinPct = pctOf(d.totals.protein, target.protein);
      const ok = Math.abs(calDiff) <= DAY_TOLERANCE.caloriesPct && proteinPct >= DAY_TOLERANCE.proteinMinPct;
      checks.push({
        label: `Day total ${d.date}`,
        ok,
        detail: `${d.totals.calories} / ${target.calories} kcal (${calDiff >= 0 ? "+" : ""}${calDiff}%), protein ${d.totals.protein} / ${target.protein} g (${proteinPct}%)`,
      });
    }
  }

  return { ok: checks.every((c) => c.ok), checks };
}
