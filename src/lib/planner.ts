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
  // Variety: rotate the starting point across good candidates so plans don't repeat meals.
  const pool = ranked.slice(0, Math.max(count, 8));
  const start = pool.length ? (opts.variety ?? 0) % pool.length : 0;
  const rotated = [...pool.slice(start), ...pool.slice(0, start)];
  return rotated.slice(0, count).map((s) => foodToSnapshot(s.food, s.scale));
}

/** Strip a "(1.25× portion)" suffix so the same food isn't suggested twice. */
export function baseName(name: string): string {
  return name.replace(/\s*\([\d.]+× portion\)\s*$/, "").toLowerCase().trim();
}

/**
 * Normalizes a meal name into a set of core semantic ingredient/food tokens.
 * Strips portion indicators, cooking method adjectives, and common filler words.
 */
export function normalizeMealTokens(name: string): string[] {
  let cleaned = name.toLowerCase();
  cleaned = cleaned.replace(/\s*\([\d.]+× portion\)\s*$/gi, "");
  cleaned = cleaned.replace(/[&,+/()\-]/g, " ");

  const words = cleaned.split(/\s+/).map((w) => w.trim()).filter(Boolean);

  // Common descriptors and fillers to ignore when identifying duplicates
  const stopWords = new Set([
    "with", "and", "or", "in", "on", "a", "an", "the", "plate", "bowl",
    "sandwich", "wrap", "salad", "fresh", "warm", "lean", "light", "crispy",
    "boiled", "grilled", "roasted", "baked", "seared", "steamed", "fried",
    "smoked", "pan-seared", "homemade", "style", "dish", "meal", "pieces",
    "slice", "slices", "portion", "served", "side", "mixed"
  ]);

  // Stem / unify common food variations
  const stemToken = (w: string): string => {
    if (w.endsWith("s") && !w.endsWith("ss") && w.length > 3) w = w.slice(0, -1);
    if (w === "eggwhite" || w === "egg-white") return "egg";
    if (w === "oatmeal" || w === "oats") return "oat";
    if (w === "tilapia" || w === "bolti" || w === "salmon" || w === "seabass") return "fish";
    if (w === "foul") return "ful";
    if (w === "shakshouka") return "shakshuka";
    if (w === "yoghurt") return "yogurt";
    return w;
  };

  const tokens = words
    .filter((w) => !stopWords.has(w) && w.length > 2)
    .map(stemToken);

  return Array.from(new Set(tokens)).sort();
}

/**
 * Programmatic check: Are two meal names identical or essentially duplicates?
 * E.g., "Chicken salad" and "Grilled chicken salad" -> true
 * "Oatmeal with banana" and "Banana oatmeal" -> true
 * "Ful medames with eggs" and "Ful medames with boiled eggs" -> true
 * But distinct dishes with common side accompaniments (e.g. "Shakshuka with baladi bread" vs "Ful with baladi bread") -> false
 */
export function areMealsDuplicate(mealA: string, mealB: string): boolean {
  if (!mealA || !mealB) return false;
  const a = baseName(mealA);
  const b = baseName(mealB);
  if (a === b) return true;

  const tokensA = normalizeMealTokens(a);
  const tokensB = normalizeMealTokens(b);
  if (!tokensA.length || !tokensB.length) return false;

  const setA = new Set(tokensA);
  const setB = new Set(tokensB);

  // Accompaniments that do not define the dish by themselves
  const accompaniments = new Set(["baladi", "bread", "toast", "rice", "potato", "salad", "sauce", "tahini"]);

  // Key distinguishing tokens (excluding basic sides)
  const coreA = tokensA.filter((t) => !accompaniments.has(t));
  const coreB = tokensB.filter((t) => !accompaniments.has(t));

  // If one has a distinct core dish identifier that the other doesn't
  const primaryKeys = ["shakshuka", "ful", "koshary", "molokhia", "bamia", "fatta", "kebda", "kofta", "pancake", "waffle", "omelet", "omelette"];
  for (const pk of primaryKeys) {
    const hasA = setA.has(pk);
    const hasB = setB.has(pk);
    if ((hasA && !hasB) || (!hasA && hasB)) {
      return false; // Distinct primary traditional dishes
    }
  }

  const intersection = tokensA.filter((t) => setB.has(t));
  const coreIntersection = coreA.filter((t) => new Set(coreB).has(t));
  const union = new Set([...tokensA, ...tokensB]);

  const jaccard = intersection.length / union.size;

  // High Jaccard token overlap
  if (jaccard >= 0.5) return true;

  // If core ingredients completely overlap (e.g. "chicken" in "grilled chicken salad" vs "chicken salad")
  if (coreA.length > 0 && coreB.length > 0) {
    if (coreIntersection.length === coreA.length || coreIntersection.length === coreB.length) {
      return true;
    }
  }

  // 2+ matching core food tokens (e.g. "ful" + "medame" or "oat" + "banana")
  if (coreIntersection.length >= 2) {
    return true;
  }

  return false;
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

// -----------------------------------------------------------------------------
// Programmatic Week-Level Diversity and Validation Engine
// -----------------------------------------------------------------------------

export interface WeekDayPlan {
  date: string;
  dayIndex: number;
  meals: Array<{ meal_type: MealType; meal: MealSnapshot }>;
  totals: Macros;
  calorieDeviancePct: number;
}

export interface WeekPlanValidationResult {
  isValid: boolean;
  duplicateConsecutive: Array<{ slot: MealType; dayA: number; dayB: number; mealA: string; mealB: string }>;
  duplicateWeekSlots: Array<{ slot: MealType; count: number; meal: string }>;
  nutritionalViolations: Array<{ date: string; calories: number; target: number; deviancePct: number }>;
}

/**
 * Validates diversity and nutritional adherence across a 7-day meal plan.
 */
export function validateWeekDiversity(
  days: WeekDayPlan[],
  targets?: Macros
): WeekPlanValidationResult {
  const duplicateConsecutive: WeekPlanValidationResult["duplicateConsecutive"] = [];
  const nutritionalViolations: WeekPlanValidationResult["nutritionalViolations"] = [];

  const slotUsage: Record<MealType, Record<string, number>> = {
    breakfast: {},
    lunch: {},
    snack: {},
    dinner: {},
  };

  for (let i = 0; i < days.length; i++) {
    const currentDay = days[i];

    // 1. Nutritional target check (allowed range: +/- 15% calories)
    if (targets && targets.calories > 0) {
      const calDev = Math.abs(currentDay.totals.calories - targets.calories) / Math.max(targets.calories, 1);
      if (calDev > 0.15) {
        nutritionalViolations.push({
          date: currentDay.date,
          calories: currentDay.totals.calories,
          target: targets.calories,
          deviancePct: Math.round(calDev * 100),
        });
      }
    }

    // Track usage
    for (const m of currentDay.meals) {
      const bName = baseName(m.meal.meal_name);
      slotUsage[m.meal_type][bName] = (slotUsage[m.meal_type][bName] || 0) + 1;
    }

    // 2. Check consecutive days
    if (i > 0) {
      const prevDay = days[i - 1];
      for (const m of currentDay.meals) {
        const prevSlotMeal = prevDay.meals.find((pm) => pm.meal_type === m.meal_type);
        if (prevSlotMeal && areMealsDuplicate(m.meal.meal_name, prevSlotMeal.meal.meal_name)) {
          duplicateConsecutive.push({
            slot: m.meal_type,
            dayA: i - 1,
            dayB: i,
            mealA: prevSlotMeal.meal.meal_name,
            mealB: m.meal.meal_name,
          });
        }
      }
    }
  }

  const duplicateWeekSlots: WeekPlanValidationResult["duplicateWeekSlots"] = [];
  for (const slot of ["breakfast", "lunch", "snack", "dinner"] as MealType[]) {
    for (const [meal, count] of Object.entries(slotUsage[slot])) {
      // If the exact same meal repeats more than 2 times in 7 days, flag it
      if (count > 2) {
        duplicateWeekSlots.push({ slot, count, meal });
      }
    }
  }

  const isValid = duplicateConsecutive.length === 0 && nutritionalViolations.length === 0;

  return {
    isValid,
    duplicateConsecutive,
    duplicateWeekSlots,
    nutritionalViolations,
  };
}

export interface PlanWeekOptions {
  startDate: string;
  daysCount?: number;
  /** Existing logged/eaten meals that MUST NOT be overwritten */
  existingLogs?: Array<{ date: string; meal_type: string; meal_name: string; calories: number; protein: number; carbs: number; fat: number }>;
  /** Existing planned meals to preserve if desired */
  existingPlan?: Array<{ date: string; meal_type: string; meal_name: string; calories: number; protein: number; carbs: number; fat: number }>;
  /** Additional food names or terms to avoid */
  avoidTerms?: string[];
  /** Preferred tags (e.g. ["egyptian"]) */
  preferTags?: string[];
}

/**
 * Helper to calculate date string offset from base date
 */
function addDaysISO(baseDate: string, days: number): string {
  const d = new Date(baseDate + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Generates a genuinely varied, nutritionally balanced 7-day meal plan.
 *
 * Rules:
 * - Genuinely different meals across the 7 days for every slot (breakfast, lunch, snack, dinner).
 * - Avoids identical/near-duplicate meals on consecutive days.
 * - Tracks meals used across the week to prevent over-repetition.
 * - Validates and rebalances day-level macros against targets.
 * - Preserves already logged/consumed meals.
 * - Strictly respects user allergies, dietary style, and disliked foods.
 */
export function planWeek(
  targets: Macros,
  prefs: PlanningPrefs,
  opts: PlanWeekOptions
): WeekDayPlan[] {
  const daysCount = opts.daysCount ?? 7;
  const days: WeekDayPlan[] = [];

  // Track meal frequency across the week
  const usedPerSlot: Record<MealType, string[]> = {
    breakfast: [],
    lunch: [],
    snack: [],
    dinner: [],
  };

  const allSlots: MealType[] = ["breakfast", "lunch", "snack", "dinner"];

  for (let dayIdx = 0; dayIdx < daysCount; dayIdx++) {
    const date = addDaysISO(opts.startDate, dayIdx);
    const dayLogs = (opts.existingLogs || []).filter((l) => l.date === date);

    const plannedDayMeals: Array<{ meal_type: MealType; meal: MealSnapshot }> = [];

    // Calculate remaining target for the day after taking logged meals into account
    let remainingBudget: Macros = { ...targets };
    for (const log of dayLogs) {
      remainingBudget = subtractMacros(remainingBudget, {
        calories: Number(log.calories) || 0,
        protein: Number(log.protein) || 0,
        carbs: Number(log.carbs) || 0,
        fat: Number(log.fat) || 0,
      });
    }

    const unloggedSlots = allSlots.filter((slot) => !dayLogs.some((l) => l.meal_type === slot));
    let shareLeft = unloggedSlots.reduce((s, t) => s + SLOT_SHARE[t], 0);

    // Keep track of meals selected for today to avoid repeats in different slots on same day
    const selectedTodayNames: string[] = [];

    for (let slotIdx = 0; slotIdx < unloggedSlots.length; slotIdx++) {
      const slotType = unloggedSlots[slotIdx];
      const isLast = slotIdx === unloggedSlots.length - 1;

      const share = shareLeft > 0 ? SLOT_SHARE[slotType] / shareLeft : 1;
      const slotTarget: Macros = isLast
        ? remainingBudget
        : {
            calories: Math.max(slotType === "snack" ? 120 : 250, remainingBudget.calories * share),
            protein: Math.max(slotType === "snack" ? 8 : 20, remainingBudget.protein * share),
            carbs: Math.max(0, remainingBudget.carbs * share),
            fat: Math.max(0, remainingBudget.fat * share),
          };

      // Determine exclusion list for this slot:
      // 1. Meals from yesterday's same slot
      // 2. Meals already used today in other slots
      const yesterdayMeal = dayIdx > 0 ? days[dayIdx - 1]?.meals.find((m) => m.meal_type === slotType)?.meal.meal_name : undefined;
      const slotExclusions: string[] = [...selectedTodayNames];
      if (yesterdayMeal) {
        slotExclusions.push(yesterdayMeal);
      }

      // Rotate variety index based on day to cycle cleanly through catalog candidates
      const varietyOffset = (dayIdx + slotIdx) % 7;

      // Suggest candidate meals
      const candidates = suggestMeals(slotTarget, slotType, prefs, {
        count: 7,
        excludeNames: slotExclusions,
        avoidTerms: opts.avoidTerms,
        preferTags: opts.preferTags,
        variety: varietyOffset,
      });

      // Pick best candidate that is NOT a duplicate of yesterday's meal and minimizes week-level repeats
      let chosenMeal: MealSnapshot | null = null;
      for (const cand of candidates) {
        // Reject if duplicate of yesterday's meal
        if (yesterdayMeal && areMealsDuplicate(cand.meal_name, yesterdayMeal)) {
          continue;
        }

        // Reject if duplicate of another meal planned today
        if (selectedTodayNames.some((m) => areMealsDuplicate(cand.meal_name, m))) {
          continue;
        }

        // Prioritize foods not yet used in this slot earlier this week
        const timesUsed = usedPerSlot[slotType].filter((m) => areMealsDuplicate(cand.meal_name, m)).length;
        if (timesUsed >= 1) {
          const hasUnused = candidates.some(
            (c) =>
              !selectedTodayNames.some((m) => areMealsDuplicate(c.meal_name, m)) &&
              (!yesterdayMeal || !areMealsDuplicate(c.meal_name, yesterdayMeal)) &&
              !usedPerSlot[slotType].some((m) => areMealsDuplicate(c.meal_name, m))
          );
          if (hasUnused) {
            continue;
          }
        }

        chosenMeal = cand;
        break;
      }

      // Fallback to top candidate if strict filtering left no candidates
      if (!chosenMeal && candidates.length > 0) {
        chosenMeal = candidates[0];
      }

      if (chosenMeal) {
        plannedDayMeals.push({ meal_type: slotType, meal: chosenMeal });
        selectedTodayNames.push(chosenMeal.meal_name);
        usedPerSlot[slotType].push(chosenMeal.meal_name);
        remainingBudget = subtractMacros(remainingBudget, chosenMeal);
      }

      shareLeft -= SLOT_SHARE[slotType];
    }

    // Merge logged meals and planned meals for total check
    const allDayMeals: Array<{ meal_type: MealType; meal: MealSnapshot }> = [
      ...dayLogs.map((l) => ({
        meal_type: l.meal_type as MealType,
        meal: {
          meal_name: l.meal_name,
          calories: Number(l.calories) || 0,
          protein: Number(l.protein) || 0,
          carbs: Number(l.carbs) || 0,
          fat: Number(l.fat) || 0,
          ingredients: [] as string[],
          tags: [] as string[],
        },
      })),
      ...plannedDayMeals,
    ];

    let totals = totalsOf(allDayMeals);
    let deviancePct = Math.round((Math.abs(totals.calories - targets.calories) / Math.max(targets.calories, 1)) * 100);

    // Auto-balance if day calories are off by > 12%
    if (deviancePct > 12 && plannedDayMeals.length > 0) {
      const adjustable = plannedDayMeals[plannedDayMeals.length - 1];
      const neededCal = targets.calories - (totals.calories - adjustable.meal.calories);
      if (neededCal > 150) {
        const factor = Math.max(0.75, Math.min(1.5, neededCal / Math.max(adjustable.meal.calories, 1)));
        const scaled = scaleMacros(adjustable.meal, factor);
        adjustable.meal = {
          ...adjustable.meal,
          ...scaled,
        };
        totals = totalsOf(allDayMeals);
        deviancePct = Math.round((Math.abs(totals.calories - targets.calories) / Math.max(targets.calories, 1)) * 100);
      }
    }

    days.push({
      date,
      dayIndex: dayIdx,
      meals: plannedDayMeals,
      totals,
      calorieDeviancePct: deviancePct,
    });
  }

  // Programmatic Week Diversity Pass: fix any accidental consecutive duplicates
  for (let i = 1; i < days.length; i++) {
    const prev = days[i - 1];
    const curr = days[i];

    for (let mIdx = 0; mIdx < curr.meals.length; mIdx++) {
      const currentSlotMeal = curr.meals[mIdx];
      const prevSlotMeal = prev.meals.find((pm) => pm.meal_type === currentSlotMeal.meal_type);

      if (prevSlotMeal && areMealsDuplicate(currentSlotMeal.meal.meal_name, prevSlotMeal.meal.meal_name)) {
        // Swap with a diverse alternative
        const alts = suggestMeals(currentSlotMeal.meal, currentSlotMeal.meal_type, prefs, {
          count: 5,
          excludeNames: [prevSlotMeal.meal.meal_name, currentSlotMeal.meal.meal_name],
          avoidTerms: opts.avoidTerms,
          preferTags: opts.preferTags,
          variety: (i + 3) % 5,
        });

        const nonDup = alts.find((a) => !areMealsDuplicate(a.meal_name, prevSlotMeal.meal.meal_name));
        if (nonDup) {
          curr.meals[mIdx].meal = nonDup;
        }
      }
    }

    curr.totals = totalsOf(curr.meals);
  }

  return days;
}
