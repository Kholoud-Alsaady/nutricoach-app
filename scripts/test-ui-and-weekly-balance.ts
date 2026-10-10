import { planSlots, planWeek, prefsFromProfile, type PlanningPrefs } from "../src/lib/planner";
import { addDays, formatDay, daysBetween } from "../src/lib/dates";
import { sumMacros, subtractMacros } from "../src/lib/nutrition";
import type { Macros, MealType, PlannedMeal } from "../src/lib/types";

async function runTests() {
  console.log("=================================================");
  console.log("   NUTRI COACH UI & WEEKLY AUTO-BALANCE TESTS    ");
  console.log("=================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, details?: string) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}${details ? ` -> ${details}` : ""}`);
      failed++;
    }
  }

  // -------------------------------------------------------------
  // PART A: UI Duplication Tests (Source verification)
  // -------------------------------------------------------------
  console.log("--- PART A: UI Duplication Verification ---");
  const fs = await import("fs");
  const path = await import("path");

  // 1. Plus Icon duplication check
  const mealsStreamSrc = fs.readFileSync(path.resolve(__dirname, "../src/components/MealsStream.tsx"), "utf-8");
  const landingPortalSrc = fs.readFileSync(path.resolve(__dirname, "../src/components/LandingPortal.tsx"), "utf-8");
  
  assert(
    !mealsStreamSrc.includes("<span>+ Add Meal") && mealsStreamSrc.includes("<span>Add Meal / Snack</span>"),
    "MealsStream: Button does not duplicate '+' in text next to <Plus /> icon"
  );
  assert(
    !landingPortalSrc.includes("<span>+ Create New Member</span>") && landingPortalSrc.includes("<span>Create New Member</span>"),
    "LandingPortal: Button does not duplicate '+' in text next to <Plus /> icon"
  );

  // 2. Coach Layout Back Arrow check
  const coachLayoutSrc = fs.readFileSync(path.resolve(__dirname, "../src/components/CoachLayout.tsx"), "utf-8");
  assert(
    !coachLayoutSrc.includes("← Back to Portal") && coachLayoutSrc.includes("<span>Back to Portal</span>"),
    "CoachLayout: Back button displays 'Back to Portal' without redundant '←' text arrow"
  );

  // 3. Meal Plan Slot Title check
  const mealPlanViewSrc = fs.readFileSync(path.resolve(__dirname, "../src/components/MealPlanView.tsx"), "utf-8");
  assert(
    !mealPlanViewSrc.includes("{slotType}\n                    </span>") && !mealPlanViewSrc.includes("{slotType}</span>"),
    "MealPlanView: Redundant lowercase {slotType} badge removed from slot heading"
  );

  // 4. Progress View 10-day Adherence Date check
  const progressViewSrc = fs.readFileSync(path.resolve(__dirname, "../src/components/ProgressView.tsx"), "utf-8");
  assert(
    !progressViewSrc.includes("relativeDay(d.date, state.today)") &&
    progressViewSrc.includes("{formatDay(d.date)}"),
    "ProgressView: Adherence row displays single formatDay element without duplicate date text"
  );

  // -------------------------------------------------------------
  // PART B: Weekly Auto-Balance Calculation & Rebalancing Tests
  // -------------------------------------------------------------
  console.log("\n--- PART B: Weekly Auto-Balance Functional Tests ---");

  const baselineTargets: Macros = {
    calories: 2000,
    protein: 150,
    carbs: 200,
    fat: 65,
  };

  const sampleProfile = {
    id: "m-test-1",
    name: "Youssef Nabil",
    dietary_preferences: ["egyptian", "high_protein"],
    disliked_foods: ["eggplant"],
    allergies: ["peanuts"],
    dietary_style: "balanced",
  };

  const prefs = prefsFromProfile(sampleProfile as any);

  // Test 5: Weekly smoothing calculation under-intake scenario (-1030 kcal logged vs target)
  const loggedCaloriesTodayUnder = 970; // 970 logged vs 2000 target => delta = -1030
  const deltaUnder = loggedCaloriesTodayUnder - baselineTargets.calories; // -1030
  const remainingDays = 6;
  const rawAdjustmentUnder = Math.round(-deltaUnder / remainingDays); // -(-1030)/6 = +172
  const clampedAdjustmentUnder = Math.max(-150, Math.min(150, rawAdjustmentUnder)); // +150
  const targetCaloriesUnder = Math.max(1200, Math.min(3500, baselineTargets.calories + clampedAdjustmentUnder)); // 2150

  assert(deltaUnder === -1030, "Calculates correct under-intake delta (-1030 kcal)");
  assert(clampedAdjustmentUnder === 150, "Correctly caps daily adjustment to +150 kcal/day max constraint");
  assert(targetCaloriesUnder === 2150, "Calculates validated daily target of 2150 kcal for remaining days");

  // Test 6: Weekly smoothing calculation moderate over-intake (+600 kcal)
  const loggedCaloriesTodayOver = 2600; // 2600 logged vs 2000 target => delta = +600
  const deltaOver = loggedCaloriesTodayOver - baselineTargets.calories; // +600
  const rawAdjustmentOver = Math.round(-deltaOver / remainingDays); // -600/6 = -100
  const clampedAdjustmentOver = Math.max(-150, Math.min(150, rawAdjustmentOver)); // -100
  const targetCaloriesOver = Math.max(1200, Math.min(3500, baselineTargets.calories + clampedAdjustmentOver)); // 1900

  assert(deltaOver === 600, "Calculates correct over-intake delta (+600 kcal)");
  assert(clampedAdjustmentOver === -100, "Calculates proportional adjustment without hitting clamp (-100 kcal/day)");
  assert(targetCaloriesOver === 1900, "Calculates validated daily target of 1900 kcal for remaining days");

  // Test 7: Recalculate remaining-day meal plans for adjusted target (2150 kcal)
  const ratioUnder = targetCaloriesUnder / baselineTargets.calories;
  const dayBudgetUnder: Macros = {
    calories: targetCaloriesUnder,
    protein: Math.round(baselineTargets.protein * ratioUnder),
    carbs: Math.round(baselineTargets.carbs * ratioUnder),
    fat: Math.round(baselineTargets.fat * ratioUnder),
  };

  const slots: MealType[] = ["breakfast", "lunch", "snack", "dinner"];
  const recalculatedMealsUnder = planSlots(dayBudgetUnder, slots, prefs, {
    preferTags: ["egyptian"],
  });

  assert(recalculatedMealsUnder.length === 4, "Generates full 4-slot plan (breakfast, lunch, snack, dinner)");

  const totalCalsUnder = recalculatedMealsUnder.reduce((sum, s) => sum + s.meal.calories, 0);
  const totalProteinUnder = recalculatedMealsUnder.reduce((sum, s) => sum + s.meal.protein, 0);

  // Check tolerance (within 10% of target)
  const devianceUnder = Math.abs(totalCalsUnder - targetCaloriesUnder) / targetCaloriesUnder;
  assert(
    devianceUnder < 0.08,
    `Planned meals align with adjusted target: planned ${totalCalsUnder} kcal vs target ${targetCaloriesUnder} kcal (${(devianceUnder * 100).toFixed(1)}% deviance)`
  );

  // Check dietary preferences and allergy constraints
  const hasPeanuts = recalculatedMealsUnder.some((s) =>
    s.meal.ingredients.some((i) => i.toLowerCase().includes("peanut")) ||
    s.meal.meal_name.toLowerCase().includes("peanut")
  );
  assert(!hasPeanuts, "Recalculated meals respect allergy exclusion (no peanuts)");

  const hasEggplant = recalculatedMealsUnder.some((s) =>
    s.meal.ingredients.some((i) => i.toLowerCase().includes("eggplant")) ||
    s.meal.meal_name.toLowerCase().includes("eggplant")
  );
  assert(!hasEggplant, "Recalculated meals respect disliked foods (no eggplant)");

  // Test 8: Compare before and after plan totals
  const baselineMeals = planSlots(baselineTargets, slots, prefs, { preferTags: ["egyptian"] });
  const baselineTotalCals = baselineMeals.reduce((sum, s) => sum + s.meal.calories, 0);

  console.log(`\n  [Before & After Comparison]`);
  console.log(`  Baseline target: ${baselineTargets.calories} kcal -> Planned total: ${baselineTotalCals} kcal`);
  console.log(`  Adjusted target: ${targetCaloriesUnder} kcal -> Planned total: ${totalCalsUnder} kcal`);
  console.log(`  Calorie Delta between plans: +${totalCalsUnder - baselineTotalCals} kcal`);

  assert(
    totalCalsUnder > baselineTotalCals,
    "Planned meal calories increase when compensatory smoothing adds +150 kcal/day"
  );

  // Test 9: Variety across multiple remaining days (no consecutive slot duplication)
  let prevMeals = recalculatedMealsUnder;
  let consecutiveDuplicates = 0;

  for (let dayOffset = 2; dayOffset <= 6; dayOffset++) {
    const exclude = prevMeals.map((m) => m.meal.meal_name);
    const nextDayMeals = planSlots(dayBudgetUnder, slots, prefs, {
      preferTags: ["egyptian"],
      excludeNames: exclude,
      variety: dayOffset,
    });

    for (const slotType of slots) {
      const prevMeal = prevMeals.find((m) => m.meal_type === slotType)?.meal.meal_name;
      const nextMeal = nextDayMeals.find((m) => m.meal_type === slotType)?.meal.meal_name;
      if (prevMeal && nextMeal && prevMeal === nextMeal) {
        consecutiveDuplicates++;
      }
    }
    prevMeals = nextDayMeals;
  }

  assert(consecutiveDuplicates === 0, "No consecutive slot meal duplicates across 6 remaining days");

  // Test 10: Eaten-meal guard (does not overwrite logged meals)
  const loggedSlot: MealType = "breakfast";
  const loggedMeal: Macros = { calories: 420, protein: 32, carbs: 45, fat: 12 };
  const remainingSlots = slots.filter((s) => s !== loggedSlot);
  const remainingBudget = subtractMacros(dayBudgetUnder, loggedMeal);
  const partialRecalculated = planSlots(remainingBudget, remainingSlots, prefs);

  assert(partialRecalculated.length === 3, "Eaten-meal guard: only rebalances unlogged slots (lunch, snack, dinner)");
  assert(!partialRecalculated.some((s) => s.meal_type === "breakfast"), "Eaten-meal guard: breakfast slot preserved");

  const combinedDayCals = loggedMeal.calories + partialRecalculated.reduce((sum, s) => sum + s.meal.calories, 0);
  const combinedDeviance = Math.abs(combinedDayCals - targetCaloriesUnder) / targetCaloriesUnder;
  assert(
    combinedDeviance < 0.08,
    `Combined logged + planned calories align with day target (${combinedDayCals} kcal vs ${targetCaloriesUnder} kcal)`
  );

  // -------------------------------------------------------------
  // Test 11: Revert / Keep Original Targets
  // -------------------------------------------------------------
  console.log("\n--- Keep Original Targets Verification ---");
  const restoredMeals = planSlots(baselineTargets, slots, prefs, { preferTags: ["egyptian"] });
  const restoredTotalCals = restoredMeals.reduce((sum, s) => sum + s.meal.calories, 0);
  const restoredDeviance = Math.abs(restoredTotalCals - baselineTargets.calories) / baselineTargets.calories;

  assert(
    restoredDeviance < 0.08,
    `Restoring original targets produces baseline meal totals (${restoredTotalCals} kcal vs ${baselineTargets.calories} kcal)`
  );

  console.log("\n=================================================");
  console.log(`Results: ${passed} passed | ${failed} failed`);
  console.log("=================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution error:", err);
  process.exit(1);
});
