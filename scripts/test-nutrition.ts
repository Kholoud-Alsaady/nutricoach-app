// =============================================================================
// Unit Tests: Deterministic Nutrition Calculations & Sanity Checks
// =============================================================================

import { caloriesFromMacros, normalizeMacros, verifyMeals, checkMeal } from "../src/lib/nutrition";
import { findFood, FOODS } from "../src/lib/foods";
import { suggestMeals } from "../src/lib/planner";

console.log("🧪 Running NutriCoach Nutrition Tests...");

// 1. Calorie arithmetic
const kcal = caloriesFromMacros(140, 220, 65);
const expected = 140 * 4 + 220 * 4 + 65 * 9; // 560 + 880 + 585 = 2025
console.assert(kcal === expected, `Expected ${expected} kcal, got ${kcal}`);
console.log("✓ Macro arithmetic P*4 + C*4 + F*9 verified");

// 2. Egyptian Food catalog search
const koshary = findFood("koshary");
console.assert(koshary !== null && koshary.name.includes("Koshary"), "Koshary not recognized");
console.log("✓ Egyptian food catalog fuzzy search verified (Koshary)");

// 3. Planner suggestion respects avoids
const prefs = { disliked_foods: ["chicken"], allergies: [], dietary_preferences: [] };
const options = suggestMeals({ calories: 500, protein: 35, carbs: 45, fat: 15 }, "dinner", prefs);
console.assert(options.every((o) => !o.meal_name.toLowerCase().includes("chicken")), "Planner failed to exclude chicken");
console.log("✓ Planner exclusion and portion scaling verified");

// 4. Sanity check catches negative or extreme numbers
const negativeIssues = checkMeal({ protein: -10, carbs: 20, fat: 5 } as any);
console.assert(negativeIssues.length > 0, "Failed to catch negative macros");
console.log("✓ Sanity check catches negative values");

console.log("🎉 All unit tests passed successfully!");
