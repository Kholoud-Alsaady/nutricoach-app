// =============================================================================
// Seed Script: Populates Supabase with full demo state for 6 members
// =============================================================================

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { addDays, todayISO } from "../src/lib/dates";
import { FOODS, foodToSnapshot } from "../src/lib/foods";
import { caloriesFromMacros } from "../src/lib/nutrition";
import {
  DEMO_ADMIN_ID,
  DEMO_COACH,
  DEMO_COACH_ID,
  DEMO_GYM,
  DEMO_GYM_ID,
  DEMO_MEMBERS,
} from "../src/lib/agent/seed-data";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  console.log("🌱 Seeding NutriCoach database...");

  const today = todayISO();
  const startDate = addDays(today, -13);
  const endDate = addDays(today, 6);

  // 1. Gym
  const { error: gymErr } = await supabase.from("gyms").upsert(DEMO_GYM);
  if (gymErr) console.warn("Gym upsert warning:", gymErr.message);

  // 2. Coach Profile
  await supabase.from("profiles").upsert(DEMO_COACH);

  // 3. AI Model Pricing
  await supabase.from("ai_model_pricing").upsert([
    { model: "gemini-3.5-flash-lite", input_usd_per_million: 0.30, output_usd_per_million: 2.50 },
    { model: "gemini-3.5-flash", input_usd_per_million: 1.50, output_usd_per_million: 9.00 },
    { model: "gemini-3.8-flash", input_usd_per_million: 0.75, output_usd_per_million: 3.75 },
  ]);

  // 4. Seed Members & Plans
  for (const m of DEMO_MEMBERS) {
    console.log(`- Seeding member: ${m.name} (${m.scenario})`);

    // Profile
    await supabase.from("profiles").upsert({
      id: m.id,
      gym_id: DEMO_GYM_ID,
      role: "member",
      coach_id: DEMO_COACH_ID,
      name: m.name,
      email: m.email,
      age: m.age,
      sex: m.sex,
      height: m.height,
      weight: m.weight,
      goal: m.goal,
      activity_level: m.activity_level,
      dietary_preferences: m.dietary_preferences,
      disliked_foods: m.disliked_foods,
      allergies: m.allergies,
      demo_scenario: m.scenario,
      subscription_status: "active",
    });

    // Targets
    await supabase.from("nutrition_targets").upsert({
      member_id: m.id,
      calories: m.targets.calories,
      protein: m.targets.protein,
      carbs: m.targets.carbs,
      fat: m.targets.fat,
      water: m.targets.water,
      meals_per_day: 4,
    }, { onConflict: "member_id" });

    // Active Plan
    const { data: plan } = await supabase
      .from("nutrition_plans")
      .upsert({
        member_id: m.id,
        start_date: startDate,
        end_date: endDate,
        status: "active",
      })
      .select("id")
      .single();

    const planId = plan?.id;
    if (!planId) continue;

    // Clear old planned meals & logs for clean seed
    await supabase.from("planned_meals").delete().eq("member_id", m.id);
    await supabase.from("meal_logs").delete().eq("member_id", m.id);
    await supabase.from("agent_actions").delete().eq("member_id", m.id);
    await supabase.from("coach_followups").delete().eq("member_id", m.id);

    // Standard baseline template foods
    const fulEggs = foodToSnapshot(FOODS.find((f) => f.id === "ful-eggs")!);
    const chickenRice = foodToSnapshot(FOODS.find((f) => f.id === "chicken-rice")!);
    const yogurtBerries = foodToSnapshot(FOODS.find((f) => f.id === "yogurt-berries")!);
    const koftaBread = foodToSnapshot(FOODS.find((f) => f.id === "kofta-bread")!);
    const fishRice = foodToSnapshot(FOODS.find((f) => f.id === "fish-rice")!);

    // Populate Planned Meals across 20 days (startDate -> endDate)
    const plannedRows: any[] = [];
    for (let d = -13; d <= 6; d++) {
      const date = addDays(today, d);
      plannedRows.push(
        { plan_id: planId, member_id: m.id, date, meal_type: "breakfast", meal_name: fulEggs.meal_name, calories: fulEggs.calories, protein: fulEggs.protein, carbs: fulEggs.carbs, fat: fulEggs.fat, ingredients: fulEggs.ingredients, tags: fulEggs.tags, source: "coach" },
        { plan_id: planId, member_id: m.id, date, meal_type: "lunch", meal_name: chickenRice.meal_name, calories: chickenRice.calories, protein: chickenRice.protein, carbs: chickenRice.carbs, fat: chickenRice.fat, ingredients: chickenRice.ingredients, tags: chickenRice.tags, source: "coach" },
        { plan_id: planId, member_id: m.id, date, meal_type: "snack", meal_name: yogurtBerries.meal_name, calories: yogurtBerries.calories, protein: yogurtBerries.protein, carbs: yogurtBerries.carbs, fat: yogurtBerries.fat, ingredients: yogurtBerries.ingredients, tags: yogurtBerries.tags, source: "coach" },
        { plan_id: planId, member_id: m.id, date, meal_type: "dinner", meal_name: d % 2 === 0 ? koftaBread.meal_name : fishRice.meal_name, calories: d % 2 === 0 ? koftaBread.calories : fishRice.calories, protein: d % 2 === 0 ? koftaBread.protein : fishRice.protein, carbs: d % 2 === 0 ? koftaBread.carbs : fishRice.carbs, fat: d % 2 === 0 ? koftaBread.fat : fishRice.fat, ingredients: d % 2 === 0 ? koftaBread.ingredients : fishRice.ingredients, tags: d % 2 === 0 ? koftaBread.tags : fishRice.tags, source: "coach" }
      );
    }
    await supabase.from("planned_meals").insert(plannedRows);

    // Populate Meal Logs based on member's exact demo scenario
    const logRows: any[] = [];

    if (m.scenario === "stable") {
      // Omar: 6 days of consistent logging matching plan
      for (let d = -6; d <= -1; d++) {
        const date = addDays(today, d);
        logRows.push(
          { member_id: m.id, date, meal_type: "breakfast", meal_name: fulEggs.meal_name, calories: fulEggs.calories, protein: fulEggs.protein, carbs: fulEggs.carbs, fat: fulEggs.fat, matched_plan: true },
          { member_id: m.id, date, meal_type: "lunch", meal_name: chickenRice.meal_name, calories: chickenRice.calories, protein: chickenRice.protein, carbs: chickenRice.carbs, fat: chickenRice.fat, matched_plan: true },
          { member_id: m.id, date, meal_type: "snack", meal_name: yogurtBerries.meal_name, calories: yogurtBerries.calories, protein: yogurtBerries.protein, carbs: yogurtBerries.carbs, fat: yogurtBerries.fat, matched_plan: true },
          { member_id: m.id, date, meal_type: "dinner", meal_name: koftaBread.meal_name, calories: koftaBread.calories, protein: koftaBread.protein, carbs: koftaBread.carbs, fat: koftaBread.fat, matched_plan: true }
        );
      }
      // Today: logged breakfast
      logRows.push({ member_id: m.id, date: today, meal_type: "breakfast", meal_name: fulEggs.meal_name, calories: fulEggs.calories, protein: fulEggs.protein, carbs: fulEggs.carbs, fat: fulEggs.fat, matched_plan: true });
    } else if (m.scenario === "single_miss") {
      // Sara: Missed only yesterday (d = -1)
      for (let d = -6; d <= -2; d++) {
        const date = addDays(today, d);
        logRows.push(
          { member_id: m.id, date, meal_type: "breakfast", meal_name: fulEggs.meal_name, calories: fulEggs.calories, protein: fulEggs.protein, carbs: fulEggs.carbs, fat: fulEggs.fat, matched_plan: true },
          { member_id: m.id, date, meal_type: "lunch", meal_name: chickenRice.meal_name, calories: chickenRice.calories, protein: chickenRice.protein, carbs: chickenRice.carbs, fat: chickenRice.fat, matched_plan: true },
          { member_id: m.id, date, meal_type: "dinner", meal_name: fishRice.meal_name, calories: fishRice.calories, protein: fishRice.protein, carbs: fishRice.carbs, fat: fishRice.fat, matched_plan: true }
        );
      }
    } else if (m.scenario === "repeated_deviation") {
      // Layla: Deviations on day -9 and day -4 (Pizza / Burger), and today lunch: Koshary!
      for (let d = -10; d <= -1; d++) {
        const date = addDays(today, d);
        if (d === -9 || d === -4) {
          // Off-plan deviation
          logRows.push(
            { member_id: m.id, date, meal_type: "breakfast", meal_name: fulEggs.meal_name, calories: 500, protein: 25, carbs: 55, fat: 18, matched_plan: false },
            { member_id: m.id, date, meal_type: "lunch", meal_name: "Pizza (2 slices) with soda", calories: 950, protein: 28, carbs: 120, fat: 38, matched_plan: false, notes: "Out with colleagues" },
            { member_id: m.id, date, meal_type: "dinner", meal_name: "Light Salad & laban", calories: 300, protein: 15, carbs: 20, fat: 12, matched_plan: false }
          );
        } else {
          logRows.push(
            { member_id: m.id, date, meal_type: "breakfast", meal_name: fulEggs.meal_name, calories: fulEggs.calories, protein: fulEggs.protein, carbs: fulEggs.carbs, fat: fulEggs.fat, matched_plan: true },
            { member_id: m.id, date, meal_type: "lunch", meal_name: chickenRice.meal_name, calories: chickenRice.calories, protein: chickenRice.protein, carbs: chickenRice.carbs, fat: chickenRice.fat, matched_plan: true },
            { member_id: m.id, date, meal_type: "dinner", meal_name: fishRice.meal_name, calories: fishRice.calories, protein: fishRice.protein, carbs: fishRice.carbs, fat: fishRice.fat, matched_plan: true }
          );
        }
      }
      // Today: Layla logged breakfast + KOSHARY for lunch!
      logRows.push(
        { member_id: m.id, date: today, meal_type: "breakfast", meal_name: fulEggs.meal_name, calories: fulEggs.calories, protein: fulEggs.protein, carbs: fulEggs.carbs, fat: fulEggs.fat, matched_plan: true },
        { member_id: m.id, date: today, meal_type: "lunch", meal_name: "Koshary (large plate)", calories: 900, protein: 26, carbs: 160, fat: 18, matched_plan: false, notes: "Office lunch" }
      );
    } else if (m.scenario === "protein_gap") {
      // Ahmed: Calories fine (~2400 kcal) but low protein (only 75g P instead of 170g)
      for (let d = -6; d <= -1; d++) {
        const date = addDays(today, d);
        logRows.push(
          { member_id: m.id, date, meal_type: "breakfast", meal_name: "Pastry & sweetened latte", calories: 650, protein: 12, carbs: 90, fat: 26, matched_plan: false },
          { member_id: m.id, date, meal_type: "lunch", meal_name: "Pasta with tomato sauce & garlic bread", calories: 950, protein: 22, carbs: 140, fat: 32, matched_plan: false },
          { member_id: m.id, date, meal_type: "dinner", meal_name: "Feteer with honey", calories: 800, protein: 14, carbs: 95, fat: 40, matched_plan: false }
        );
      }
    } else if (m.scenario === "preference_shift") {
      // Mariam: Swapped out planned chicken meals for tuna/eggs repeatedly
      for (let d = -6; d <= -1; d++) {
        const date = addDays(today, d);
        logRows.push(
          { member_id: m.id, date, meal_type: "breakfast", meal_name: "Greek yogurt with oats", calories: 420, protein: 30, carbs: 55, fat: 9, matched_plan: true },
          { member_id: m.id, date, meal_type: "lunch", meal_name: "Tuna pasta salad", calories: 510, protein: 38, carbs: 62, fat: 12, matched_plan: false, notes: "Didn't feel like chicken" },
          { member_id: m.id, date, meal_type: "dinner", meal_name: "Egg and rice bowl", calories: 510, protein: 30, carbs: 62, fat: 16, matched_plan: false }
        );
      }
    } else if (m.scenario === "inactive") {
      // Youssef: Logged until 4 days ago, then stopped
      for (let d = -10; d <= -4; d++) {
        const date = addDays(today, d);
        logRows.push(
          { member_id: m.id, date, meal_type: "breakfast", meal_name: fulEggs.meal_name, calories: fulEggs.calories, protein: fulEggs.protein, carbs: fulEggs.carbs, fat: fulEggs.fat, matched_plan: true },
          { member_id: m.id, date, meal_type: "lunch", meal_name: chickenRice.meal_name, calories: chickenRice.calories, protein: chickenRice.protein, carbs: chickenRice.carbs, fat: chickenRice.fat, matched_plan: true }
        );
      }
    }

    if (logRows.length) {
      await supabase.from("meal_logs").insert(logRows);
    }
  }

  // 5. Seed historical agent actions for ROI & audit table
  await supabase.from("agent_actions").insert([
    {
      member_id: DEMO_MEMBERS[2].id, // Layla
      gym_id: DEMO_GYM_ID,
      action_type: "adapt_daily_plan",
      user_request: "Logged Koshary for lunch",
      summary: "Layla Mostafa: Lunch exceeded carbs (160g). Dinner adjusted to high-protein chicken salad to keep daily targets balanced.",
      tools_used: [{ tool: "log_meal" }, { tool: "calculate_remaining_nutrition" }, { tool: "adapt_daily_plan" }],
      requires_coach_approval: false,
      approved: true,
      execution_status: "executed",
      estimated_manual_minutes: 15,
      estimated_agent_minutes: 5,
      estimated_minutes_saved: 10,
      estimated_cost_value: 33.33,
      created_at: new Date(Date.now() - 2 * 3600000).toISOString(),
    },
    {
      member_id: DEMO_MEMBERS[3].id, // Ahmed
      gym_id: DEMO_GYM_ID,
      action_type: "adapt_weekly_plan",
      user_request: "Weekly adherence check",
      summary: "Ahmed Nabil: Protein consistently below target (78g / 170g avg). Suggested high-protein meal plan update.",
      tools_used: [{ tool: "analyze_member_progress" }, { tool: "adapt_weekly_plan" }],
      requires_coach_approval: true,
      approved: null,
      execution_status: "pending_coach",
      estimated_manual_minutes: 45,
      estimated_agent_minutes: 10,
      estimated_minutes_saved: 35,
      estimated_cost_value: 116.67,
      created_at: new Date(Date.now() - 5 * 3600000).toISOString(),
    },
    {
      member_id: DEMO_MEMBERS[5].id, // Youssef
      gym_id: DEMO_GYM_ID,
      action_type: "coach_followup",
      user_request: "Inactivity detection alert",
      summary: "Youssef Adel: Inactivity detected (4 days without logs). Coach follow-up drafted.",
      tools_used: [{ tool: "analyze_member_progress" }, { tool: "create_coach_followup" }],
      requires_coach_approval: true,
      approved: null,
      execution_status: "pending_coach",
      estimated_manual_minutes: 10,
      estimated_agent_minutes: 2,
      estimated_minutes_saved: 8,
      estimated_cost_value: 26.67,
      created_at: new Date(Date.now() - 12 * 3600000).toISOString(),
    },
  ]);

  console.log("✅ Seeding completed successfully!");
}

main().catch(console.error);
