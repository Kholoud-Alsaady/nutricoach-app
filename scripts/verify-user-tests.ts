import { searchTrustedNutritionSources, isTrustedResearchSource } from "../src/lib/research/trusted-sources";
import { planWeek, validateWeekDiversity, areMealsDuplicate, normalizeMealTokens, type PlanningPrefs } from "../src/lib/planner";

async function run() {
  console.log("=== RUNNING USER SPECIFIED TEST CASES ===");
  let passed = 0;
  let failed = 0;

  function assert(cond: boolean, msg: string) {
    if (cond) {
      console.log(`✅ [PASS] ${msg}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${msg}`);
      failed++;
    }
  }

  // --- Test 1: Research - "Give me an article about a sugar-free diet." ---
  console.log("\n[Test 1] 'Give me an article about a sugar-free diet.'");
  const sources1 = await searchTrustedNutritionSources("Give me an article about a sugar-free diet.");
  assert(sources1.length > 0, "Returns real articles");
  assert(sources1.every((s) => isTrustedResearchSource(s.url)), "All URLs strictly trusted");
  assert(sources1.every((s) => s.title && s.summary && s.url.startsWith("http")), "Real metadata without fabrication");

  // --- Test 2: Research - "Find me an FAO article about healthy diets." ---
  console.log("\n[Test 2] 'Find me an FAO article about healthy diets.'");
  const sources2 = await searchTrustedNutritionSources("Find me an FAO article about healthy diets.");
  assert(sources2.length > 0, "Returns FAO article");
  assert(sources2[0].sourceName.toUpperCase().includes("FAO") || sources2[0].url.includes("fao.org"), "FAO prioritized");
  assert(sources2.every((s) => isTrustedResearchSource(s.url)), "All URLs strictly trusted");

  // --- Test 3: Research - "Find research about protein intake." ---
  console.log("\n[Test 3] 'Find research about protein intake.'");
  const sources3 = await searchTrustedNutritionSources("Find research about protein intake.");
  assert(sources3.length > 0, "Returns real protein research");
  const hasPubMedOrNIH = sources3.some((s) => s.url.includes("nih.gov") || s.url.includes("pubmed") || s.sourceType === "study");
  assert(hasPubMedOrNIH, "Includes real PubMed/NIH/peer-reviewed source");

  // --- Test 4: Research - Search where no trusted source exists ---
  console.log("\n[Test 4] Search with impossible query (no trusted sources)");
  const sources4 = await searchTrustedNutritionSources("xylophone astronaut quantum cryptocurrency 999xyz");
  assert(sources4.length === 0, "Never fabricates sources when none exist");

  // --- Duplicate Detection Checks ---
  console.log("\n[Duplicate Detection Tests]");
  assert(areMealsDuplicate("Chicken salad", "Grilled chicken salad"), "Detects Chicken salad vs Grilled chicken salad");
  assert(areMealsDuplicate("Oatmeal with banana", "Banana oatmeal"), "Detects Oatmeal with banana vs Banana oatmeal");
  assert(!areMealsDuplicate("Eggs & Baladi Bread", "Ful Mudammas & Baladi Bread"), "Distinguishes distinct Egyptian meals sharing bread");

  // --- Weekly Meal Diversity Test ---
  console.log("\n[Weekly Meal Diversity Plan]");
  const sampleTargets = { id: "t1", member_id: "m1", calories: 2200, protein: 160, carbs: 220, fat: 70, water: 3000, meals_per_day: 4, updated_at: "" };
  const samplePrefs: PlanningPrefs = {
    dietary_preferences: ["high_protein"],
    disliked_foods: ["eggplant"],
    allergies: ["peanuts"],
  };

  const week = planWeek(sampleTargets, samplePrefs, { startDate: "2026-10-05" });
  assert(week.length === 7, "Generates 7 days");

  const diversityReport = validateWeekDiversity(week, sampleTargets);
  console.log("Diversity report:", JSON.stringify(diversityReport));
  assert(diversityReport.duplicateConsecutive.length === 0, "Zero consecutive duplicate meals in 7-day plan");
  assert(diversityReport.nutritionalViolations.length === 0, "All days adhere to calorie & macro target tolerance");

  const uniqueBreakfasts = new Set(week.map((d) => d.meals.find((m) => m.meal_type === "breakfast")?.meal.meal_name)).size;
  const uniqueLunches = new Set(week.map((d) => d.meals.find((m) => m.meal_type === "lunch")?.meal.meal_name)).size;
  const uniqueDinners = new Set(week.map((d) => d.meals.find((m) => m.meal_type === "dinner")?.meal.meal_name)).size;
  const uniqueSnacks = new Set(week.map((d) => d.meals.find((m) => m.meal_type === "snack")?.meal.meal_name)).size;

  assert(uniqueBreakfasts >= 5, `High breakfast variety: ${uniqueBreakfasts}/7 unique`);
  assert(uniqueLunches >= 5, `High lunch variety: ${uniqueLunches}/7 unique`);
  assert(uniqueDinners >= 5, `High dinner variety: ${uniqueDinners}/7 unique`);
  assert(uniqueSnacks >= 4, `High snack variety: ${uniqueSnacks}/7 unique`);

  // Target bounds check: Calories within reasonable bounds
  const calDeviances = week.map((d) => Math.abs(d.totals.calories - sampleTargets.calories) / sampleTargets.calories);
  const maxDeviance = Math.max(...calDeviances);
  assert(maxDeviance <= 0.15, `Calorie deviance within 15% across all 7 days (max: ${Math.round(maxDeviance * 100)}%)`);

  // Restriction check: No peanuts or eggplant
  const allMealNames = week.flatMap((d) => d.meals.map((m) => m.meal.meal_name.toLowerCase()));
  const violatesPeanuts = allMealNames.some((n) => n.includes("peanut"));
  const violatesEggplant = allMealNames.some((n) => n.includes("eggplant"));
  assert(!violatesPeanuts, "Respects allergy: no peanuts generated in 7-day plan");
  assert(!violatesEggplant, "Respects disliked food: no eggplant generated in 7-day plan");

  console.log(`\n================================`);
  console.log(`User Test Suite: ${passed} passed, ${failed} failed`);
  console.log(`================================`);
  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
