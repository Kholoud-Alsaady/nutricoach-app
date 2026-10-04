// Deterministic meal planner.
// Given a calorie/protein budget for a meal slot, it picks catalog meals and a
// portion size (0.75×–1.75×) that best fit, respecting dislikes, allergies and
// dietary preferences. The LLM decides WHEN to plan; this code decides the numbers.

import { FOODS, foodToSnapshot, type Food } from "./foods";
import { normalizeMacros, scaleMacros, subtractMacros, sumMacros } from "./nutrition";
import type { Macros, MealSnapshot, MealType, Profile } from "./types";

/** Default share of daily calories per slot (450/600/250/700 of 2,000). */
export const SLOT_SHARE: Record<MealType, number> = { breakfast: 0.225, lunch: 0.3, snack: 0.125, dinner: 0.35 };

const SCALES = [0.75, 1, 1.25, 1.5, 1.75];

const SYNONYMS: Record<string, string[]> = {
  chicken: ["chicken", "poultry"],
  poultry: ["chicken", "turkey", "poultry"],
  turkey: ["turkey", "poultry"],
  fish: ["fish", "tuna", "salmon", "tilapia", "seafood"],
  tuna: ["tuna", "fish"],
  salmon: ["salmon", "fish"],
  tilapia: ["tilapia", "fish"],
  seafood: ["seafood", "shellfish", "fish", "shrimp"],
  shellfish: ["shellfish", "seafood", "shrimp"],
  shrimp: ["shellfish", "seafood", "shrimp"],
  meat: ["beef", "chicken", "turkey", "meat"],
  "red meat": ["beef", "meat"],
  beef: ["beef", "meat"],
  dairy: ["dairy", "cheese", "milk", "yogurt", "whey", "feta", "labneh", "cottage"],
  lactose: ["dairy", "cheese", "milk", "yogurt", "whey"],
  milk: ["dairy", "milk", "cheese", "yogurt"],
  gluten: ["gluten", "wheat", "bread", "pasta", "oats", "freekeh"],
  wheat: ["gluten", "wheat", "bread", "pasta"],
  celiac: ["gluten", "wheat", "bread", "pasta"],
  nut: ["nuts", "peanuts", "peanut", "almond", "walnut"],
  nuts: ["nuts", "peanuts", "peanut", "almond", "walnut"],
  peanut: ["nuts", "peanuts", "peanut"],
  peanuts: ["nuts", "peanuts", "peanut"],
  egg: ["eggs", "egg"],
  eggs: ["eggs", "egg"],
  mushroom: ["mushroom", "mushrooms"],
  mushrooms: ["mushroom", "mushrooms"],
};

const norm = (s: string) => s.toLowerCase().trim();
const sanitizeTerm = (s: string) =>
  norm(s)
    .replace(/^no\s+/i, "")
    .replace(/-free$/i, "")
    .replace(/\s*\/\s*.+$/i, "") // handles "Peanuts / Nuts" -> "peanuts"
    .replace(/s$/, "");

/** Does a blocked term (e.g. "fish", "chicken", "no chicken") apply to this food? */
export function foodMatchesTerm(food: Pick<Food, "tags" | "ingredients" | "name">, rawTerm: string): boolean {
  const clean = sanitizeTerm(rawTerm);
  if (!clean || clean === "none") return false;

  const rawNorm = norm(rawTerm);
  const tagHits = SYNONYMS[clean] ?? SYNONYMS[rawNorm] ?? [clean];

  // Check food tags
  if (food.tags.some((tag) => {
    const nTag = norm(tag);
    const sTag = sanitizeTerm(tag);
    return tagHits.includes(nTag) || tagHits.includes(sTag) || sTag === clean;
  })) {
    return true;
  }

  // Check food ingredients
  if (food.ingredients.some((i) => {
    const nIng = norm(i);
    return tagHits.some((hit) => nIng.includes(hit)) || nIng.includes(clean);
  })) {
    return true;
  }

  // Check food name
  const nName = norm(food.name);
  if (tagHits.some((hit) => nName.includes(hit)) || nName.includes(clean)) {
    return true;
  }

  return false;
}

export interface PlanningPrefs {
  disliked_foods: string[];
  allergies: string[];
  dietary_preferences: string[];
  dietary_style?: string | null;
}

export function prefsFromProfile(p: Pick<Profile, "disliked_foods" | "allergies" | "dietary_preferences"> & { dietary_style?: string | null }): PlanningPrefs {
  return {
    disliked_foods: p.disliked_foods ?? [],
    allergies: p.allergies ?? [],
    dietary_preferences: p.dietary_preferences ?? [],
    dietary_style: p.dietary_style ?? null,
  };
}

export function isAllowed(food: Food, prefs: PlanningPrefs, extraAvoid: string[] = []): boolean {
  const blocked = [...prefs.disliked_foods, ...prefs.allergies, ...extraAvoid];
  if (blocked.some((b) => foodMatchesTerm(food, b))) return false;

  const allPrefs = [
    ...prefs.dietary_preferences.map(norm),
    ...(prefs.dietary_style ? [norm(prefs.dietary_style)] : []),
  ];

  // Vegetarian guardrail
  if (allPrefs.some((p) => p.includes("vegetarian")) && !food.tags.includes("vegetarian")) {
    return false;
  }

  // Pescatarian guardrail (no chicken, turkey, beef, red meat)
  if (allPrefs.some((p) => p.includes("pescatarian"))) {
    const meatTags = ["chicken", "turkey", "beef", "meat"];
    if (food.tags.some((t) => meatTags.includes(norm(t)))) return false;
    if (food.ingredients.some((i) => meatTags.some((m) => norm(i).includes(m)))) return false;
  }

  return true;
}

export interface SuggestOptions {
  count?: number;
  /** Food names to skip (e.g. the meal being replaced, or meals already used today). */
  excludeNames?: string[];
  /** Extra terms to avoid for this request only (e.g. "chicken" tonight). */
  avoidTerms?: string[];
  /** Tags to favour, e.g. ["egyptian"]. */
  preferTags?: string[];
  /** How strongly to penalise missing protein. 1.5 default, 3 for protein-focused plans. */
  proteinWeight?: number;
  /** Rotates through the top candidates so plans don't repeat every day. */
  variety?: number;
}

interface Scored {
  food: Food;
  macros: Macros;
  scale: number;
  score: number;
}

function scoreFood(food: Food, slot: Macros, opts: SuggestOptions): Scored {
  const base = normalizeMacros(food);
  let best: Scored | null = null;
  for (const scale of SCALES) {
    const m = scale === 1 ? base : scaleMacros(base, scale);
    const calErr = Math.abs(m.calories - slot.calories) / Math.max(slot.calories, 100);
    const proteinGap = Math.max(0, slot.protein - m.protein) / Math.max(slot.protein, 10);
    const proteinExcess = Math.max(0, m.protein - slot.protein * 1.6) / Math.max(slot.protein, 10);
    let score = calErr + (opts.proteinWeight ?? 1.5) * proteinGap + 0.3 * proteinExcess;
    if (opts.preferTags?.some((t) => food.tags.includes(t))) score -= 0.15;
    if (scale !== 1) score += 0.02; // prefer standard portions when equally good
    if (!best || score < best.score) best = { food, macros: m, scale, score };
  }
  return best!;
}

/** Ranked meal options for one slot. Pure function — never touches the DB. */
export function suggestMeals(slot: Macros, mealType: MealType, prefs: PlanningPrefs, opts: SuggestOptions = {}): MealSnapshot[] {
  const exclude = new Set((opts.excludeNames ?? []).map((n) => baseName(n)));
  const ranked = FOODS.filter(
    (f) => f.planning && f.meal_types.includes(mealType) && !exclude.has(baseName(f.name)) && isAllowed(f, prefs, opts.avoidTerms)
  )
    .map((f) => scoreFood(f, slot, opts))
    .sort((a, b) => a.score - b.score);

  const count = opts.count ?? 3;
  // Variety: rotate the starting point within the top few good candidates.
  const pool = ranked.slice(0, Math.max(count, 4));
  const start = pool.length ? (opts.variety ?? 0) % Math.min(pool.length, 3) : 0;
  const rotated = [...pool.slice(start), ...pool.slice(0, start)];
  return rotated.slice(0, count).map((s) => foodToSnapshot(s.food, s.scale));
}

/** Strip a "(1.25× portion)" suffix so the same food isn't suggested twice. */
export function baseName(name: string): string {
  return name.replace(/\s*\([\d.]+× portion\)\s*$/, "").toLowerCase().trim();
}

/**
 * Plan several slots against a shared budget. Each slot gets its share of what
 * is left; the last slot absorbs the remainder so the day lands on target.
 */
export function planSlots(
  budget: Macros,
  slots: MealType[],
  prefs: PlanningPrefs,
  opts: SuggestOptions = {}
): { meal_type: MealType; meal: MealSnapshot }[] {
  const out: { meal_type: MealType; meal: MealSnapshot }[] = [];
  let remaining = { ...budget };
  let shareLeft = slots.reduce((s, t) => s + SLOT_SHARE[t], 0);
  const used = [...(opts.excludeNames ?? [])];

  slots.forEach((slotType, i) => {
    const isLast = i === slots.length - 1;
    const share = SLOT_SHARE[slotType] / shareLeft;
    const slotTarget: Macros = isLast
      ? remaining
      : { ...remaining, calories: remaining.calories * share, protein: remaining.protein * share };
    // Never plan an absurdly small meal even if the day's budget is used up.
    const minCal = slotType === "snack" ? 120 : 250;
    slotTarget.calories = Math.max(slotTarget.calories, minCal);
    slotTarget.protein = Math.max(slotTarget.protein, slotType === "snack" ? 8 : 20);

    const [meal] = suggestMeals(slotTarget, slotType, prefs, { ...opts, count: 1, excludeNames: used });
    if (meal) {
      out.push({ meal_type: slotType, meal });
      used.push(meal.meal_name);
      remaining = subtractMacros(remaining, meal);
    }
    shareLeft -= SLOT_SHARE[slotType];
  });
  return out;
}

/** A full day plan matching the targets. */
export function planDay(targets: Macros, prefs: PlanningPrefs, opts: SuggestOptions = {}) {
  return planSlots(targets, ["breakfast", "lunch", "snack", "dinner"], prefs, opts);
}

export function totalsOf(meals: { meal: MealSnapshot }[]): Macros {
  return sumMacros(meals.map((m) => m.meal));
}
