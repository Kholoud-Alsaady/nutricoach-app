// =============================================================================
// Reactive App Store & Demo Engine
// -----------------------------------------------------------------------------
// Seamlessly backs the UI with the 6 demo states and handles live actions,
// proposals, approvals, logging, and recalculations.
// =============================================================================

import { addDays, todayISO } from "./dates";
import { FOODS, foodToSnapshot } from "./foods";
import { impactFor, measureImpact, modelRoi } from "./impact";
import { checkMeal, normalizeMacros, scaleMacros, subtractMacros, sumMacros, verifyMeals } from "./nutrition";
import { baseName, planDay, planSlots, prefsFromProfile, suggestMeals } from "./planner";
import {
  DEMO_ADMIN_ID,
  DEMO_COACH,
  DEMO_COACH_ID,
  DEMO_GYM,
  DEMO_GYM_ID,
  DEMO_MEMBERS,
  type DemoMemberSpec,
} from "./agent/seed-data";
import type {
  AgentAction,
  AiUsage,
  ExecutionStatus,
  Gym,
  Macros,
  MealChange,
  MealLog,
  MealSnapshot,
  MealType,
  MemberMessage,
  PlannedMeal,
  Profile,
  ProposedChange,
  Role,
  Targets,
} from "./types";

export interface DemoState {
  gym: Gym;
  coach: Profile;
  members: DemoMemberSpec[];
  activeMemberId: string;
  activeRole: Role;
  activeTab: "today" | "plan" | "progress" | "ask" | "profile";
  today: string;
  profiles: Record<string, Profile>;
  targets: Record<string, Targets>;
  plannedMeals: Record<string, PlannedMeal[]>; // memberId -> PlannedMeal[]
  mealLogs: Record<string, MealLog[]>;         // memberId -> MealLog[]
  messages: Record<string, MemberMessage[]>;   // memberId -> MemberMessage[]
  actions: AgentAction[];
  aiUsage: AiUsage[];
}

export function createInitialDemoState(): DemoState {
  const today = todayISO();
  const startDate = addDays(today, -13);
  const endDate = addDays(today, 6);

  const profiles: Record<string, Profile> = {
    [DEMO_COACH.id]: DEMO_COACH,
  };

  const targets: Record<string, Targets> = {};
  const plannedMeals: Record<string, PlannedMeal[]> = {};
  const mealLogs: Record<string, MealLog[]> = {};

  const fulEggs = foodToSnapshot(FOODS.find((f) => f.id === "ful-eggs")!);
  const chickenRice = foodToSnapshot(FOODS.find((f) => f.id === "chicken-rice")!);
  const yogurtBerries = foodToSnapshot(FOODS.find((f) => f.id === "yogurt-berries")!);
  const koftaBread = foodToSnapshot(FOODS.find((f) => f.id === "kofta-bread")!);
  const fishRice = foodToSnapshot(FOODS.find((f) => f.id === "fish-rice")!);
  const molokhiaChicken = foodToSnapshot(FOODS.find((f) => f.id === "molokhia-chicken")!);

  for (const m of DEMO_MEMBERS) {
    profiles[m.id] = {
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
      medical_notes: null,
      subscription_status: "active",
      demo_scenario: m.scenario,
      created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
    };

    targets[m.id] = {
      id: `target-${m.id}`,
      member_id: m.id,
      calories: m.targets.calories,
      protein: m.targets.protein,
      carbs: m.targets.carbs,
      fat: m.targets.fat,
      water: m.targets.water,
      meals_per_day: 4,
      updated_at: new Date().toISOString(),
    };

    // Planned meals across -13 to +6 tailored to user calories & targets
    const pMeals: PlannedMeal[] = [];
    const omarFul = { meal_name: "Ful medames with boiled eggs & baladi bread", calories: 550, protein: 36, carbs: 68, fat: 15, ingredients: ["fava beans", "eggs", "baladi bread", "olive oil", "cumin"], tags: ["egyptian", "breakfast", "eggs"] };
    const omarChicken = { meal_name: "Grilled chicken breast with basmati rice & salad", calories: 720, protein: 58, carbs: 82, fat: 16, ingredients: ["chicken breast", "basmati rice", "cucumber", "tomato", "olive oil"], tags: ["lunch", "chicken", "high-protein"] };
    const omarYogurt = { meal_name: "Greek yogurt with honey & raw almonds", calories: 280, protein: 24, carbs: 26, fat: 8, ingredients: ["greek yogurt", "honey", "almonds"], tags: ["snack", "dairy"] };
    const omarKofta = { meal_name: "Lean grilled kofta with tahini & baladi bread", calories: 700, protein: 44, carbs: 70, fat: 26, ingredients: ["lean beef", "onions", "parsley", "baladi bread", "tahini"], tags: ["dinner", "beef", "egyptian"] };
    const omarFish = { meal_name: "Grilled sea bass with brown rice & salad", calories: 690, protein: 48, carbs: 72, fat: 20, ingredients: ["sea bass", "brown rice", "mixed greens", "lemon"], tags: ["dinner", "fish", "pescatarian"] };

    for (let d = -13; d <= 6; d++) {
      const date = addDays(today, d);
      if (m.scenario === "stable") {
        pMeals.push(
          { id: `p-${m.id}-${date}-b`, plan_id: `plan-${m.id}`, member_id: m.id, date, meal_type: "breakfast", meal_name: omarFul.meal_name, calories: omarFul.calories, protein: omarFul.protein, carbs: omarFul.carbs, fat: omarFul.fat, ingredients: omarFul.ingredients, tags: omarFul.tags, source: "coach", updated_at: new Date().toISOString() },
          { id: `p-${m.id}-${date}-l`, plan_id: `plan-${m.id}`, member_id: m.id, date, meal_type: "lunch", meal_name: omarChicken.meal_name, calories: omarChicken.calories, protein: omarChicken.protein, carbs: omarChicken.carbs, fat: omarChicken.fat, ingredients: omarChicken.ingredients, tags: omarChicken.tags, source: "coach", updated_at: new Date().toISOString() },
          { id: `p-${m.id}-${date}-s`, plan_id: `plan-${m.id}`, member_id: m.id, date, meal_type: "snack", meal_name: omarYogurt.meal_name, calories: omarYogurt.calories, protein: omarYogurt.protein, carbs: omarYogurt.carbs, fat: omarYogurt.fat, ingredients: omarYogurt.ingredients, tags: omarYogurt.tags, source: "coach", updated_at: new Date().toISOString() },
          { id: `p-${m.id}-${date}-d`, plan_id: `plan-${m.id}`, member_id: m.id, date, meal_type: "dinner", meal_name: d % 2 === 0 ? omarKofta.meal_name : omarFish.meal_name, calories: d % 2 === 0 ? omarKofta.calories : omarFish.calories, protein: d % 2 === 0 ? omarKofta.protein : omarFish.protein, carbs: d % 2 === 0 ? omarKofta.carbs : omarFish.carbs, fat: d % 2 === 0 ? omarKofta.fat : omarFish.fat, ingredients: d % 2 === 0 ? omarKofta.ingredients : omarFish.ingredients, tags: d % 2 === 0 ? omarKofta.tags : omarFish.tags, source: "coach", updated_at: new Date().toISOString() }
        );
      } else {
        pMeals.push(
          { id: `p-${m.id}-${date}-b`, plan_id: `plan-${m.id}`, member_id: m.id, date, meal_type: "breakfast", meal_name: fulEggs.meal_name, calories: fulEggs.calories, protein: fulEggs.protein, carbs: fulEggs.carbs, fat: fulEggs.fat, ingredients: fulEggs.ingredients, tags: fulEggs.tags, source: "coach", updated_at: new Date().toISOString() },
          { id: `p-${m.id}-${date}-l`, plan_id: `plan-${m.id}`, member_id: m.id, date, meal_type: "lunch", meal_name: chickenRice.meal_name, calories: chickenRice.calories, protein: chickenRice.protein, carbs: chickenRice.carbs, fat: chickenRice.fat, ingredients: chickenRice.ingredients, tags: chickenRice.tags, source: "coach", updated_at: new Date().toISOString() },
          { id: `p-${m.id}-${date}-s`, plan_id: `plan-${m.id}`, member_id: m.id, date, meal_type: "snack", meal_name: yogurtBerries.meal_name, calories: yogurtBerries.calories, protein: yogurtBerries.protein, carbs: yogurtBerries.carbs, fat: yogurtBerries.fat, ingredients: yogurtBerries.ingredients, tags: yogurtBerries.tags, source: "coach", updated_at: new Date().toISOString() },
          { id: `p-${m.id}-${date}-d`, plan_id: `plan-${m.id}`, member_id: m.id, date, meal_type: "dinner", meal_name: d % 2 === 0 ? koftaBread.meal_name : fishRice.meal_name, calories: d % 2 === 0 ? koftaBread.calories : fishRice.calories, protein: d % 2 === 0 ? koftaBread.protein : fishRice.protein, carbs: d % 2 === 0 ? koftaBread.carbs : fishRice.carbs, fat: d % 2 === 0 ? koftaBread.fat : fishRice.fat, ingredients: d % 2 === 0 ? koftaBread.ingredients : fishRice.ingredients, tags: d % 2 === 0 ? koftaBread.tags : fishRice.tags, source: "coach", updated_at: new Date().toISOString() }
        );
      }
    }
    plannedMeals[m.id] = pMeals;

    // Logs per scenario
    const logs: MealLog[] = [];
    if (m.scenario === "stable") {
      // Omar Hassan: 10 days of 100% adherence, streak = 10 days
      for (let d = -10; d <= -1; d++) {
        const date = addDays(today, d);
        const dinnerMeal = d % 2 === 0 ? omarKofta : omarFish;
        logs.push(
          { id: `l-${m.id}-${date}-b`, member_id: m.id, date, meal_type: "breakfast", meal_name: omarFul.meal_name, calories: omarFul.calories, protein: omarFul.protein, carbs: omarFul.carbs, fat: omarFul.fat, matched_plan: true, estimated: false, notes: null, created_at: `${date}T08:00:00Z` },
          { id: `l-${m.id}-${date}-l`, member_id: m.id, date, meal_type: "lunch", meal_name: omarChicken.meal_name, calories: omarChicken.calories, protein: omarChicken.protein, carbs: omarChicken.carbs, fat: omarChicken.fat, matched_plan: true, estimated: false, notes: null, created_at: `${date}T13:30:00Z` },
          { id: `l-${m.id}-${date}-s`, member_id: m.id, date, meal_type: "snack", meal_name: omarYogurt.meal_name, calories: omarYogurt.calories, protein: omarYogurt.protein, carbs: omarYogurt.carbs, fat: omarYogurt.fat, matched_plan: true, estimated: false, notes: null, created_at: `${date}T17:00:00Z` },
          { id: `l-${m.id}-${date}-d`, member_id: m.id, date, meal_type: "dinner", meal_name: dinnerMeal.meal_name, calories: dinnerMeal.calories, protein: dinnerMeal.protein, carbs: dinnerMeal.carbs, fat: dinnerMeal.fat, matched_plan: true, estimated: false, notes: null, created_at: `${date}T20:30:00Z` }
        );
      }
      logs.push(
        { id: `l-${m.id}-${today}-b`, member_id: m.id, date: today, meal_type: "breakfast", meal_name: omarFul.meal_name, calories: omarFul.calories, protein: omarFul.protein, carbs: omarFul.carbs, fat: omarFul.fat, matched_plan: true, estimated: false, notes: null, created_at: `${today}T08:15:00Z` },
        { id: `l-${m.id}-${today}-l`, member_id: m.id, date: today, meal_type: "lunch", meal_name: omarChicken.meal_name, calories: omarChicken.calories, protein: omarChicken.protein, carbs: omarChicken.carbs, fat: omarChicken.fat, matched_plan: true, estimated: false, notes: null, created_at: `${today}T13:30:00Z` }
      );
    } else if (m.scenario === "single_miss") {
      // Sara: Days -10 to -2 on plan (~1,730 kcal), Day -1 missed (unlogged)
      for (let d = -10; d <= -2; d++) {
        const date = addDays(today, d);
        logs.push(
          { id: `l-${m.id}-${date}-b`, member_id: m.id, date, meal_type: "breakfast", meal_name: fulEggs.meal_name, calories: 440, protein: 28, carbs: 50, fat: 14, matched_plan: true, estimated: false, notes: null, created_at: `${date}T08:00:00Z` },
          { id: `l-${m.id}-${date}-l`, member_id: m.id, date, meal_type: "lunch", meal_name: chickenRice.meal_name, calories: 580, protein: 48, carbs: 65, fat: 12, matched_plan: true, estimated: false, notes: null, created_at: `${date}T13:30:00Z` },
          { id: `l-${m.id}-${date}-s`, member_id: m.id, date, meal_type: "snack", meal_name: yogurtBerries.meal_name, calories: 180, protein: 16, carbs: 22, fat: 4, matched_plan: true, estimated: false, notes: null, created_at: `${date}T17:00:00Z` },
          { id: `l-${m.id}-${date}-d`, member_id: m.id, date, meal_type: "dinner", meal_name: fishRice.meal_name, calories: 530, protein: 28, carbs: 45, fat: 24, matched_plan: true, estimated: false, notes: null, created_at: `${date}T20:30:00Z` }
        );
      }
      // Day -1: no logs (missed)
      // Today: logged breakfast
      logs.push(
        { id: `l-${m.id}-${today}-b`, member_id: m.id, date: today, meal_type: "breakfast", meal_name: fulEggs.meal_name, calories: 440, protein: 28, carbs: 50, fat: 14, matched_plan: true, estimated: false, notes: null, created_at: `${today}T08:30:00Z` }
      );
    } else if (m.scenario === "repeated_deviation") {
      // Layla: frequent off-plan carb spikes
      for (let d = -10; d <= -1; d++) {
        const date = addDays(today, d);
        if (d === -8 || d === -6 || d === -3 || d === -1) {
          logs.push(
            { id: `l-${m.id}-${date}-b`, member_id: m.id, date, meal_type: "breakfast", meal_name: fulEggs.meal_name, calories: 480, protein: 25, carbs: 55, fat: 18, matched_plan: false, estimated: false, notes: null, created_at: `${date}T08:00:00Z` },
            { id: `l-${m.id}-${date}-l`, member_id: m.id, date, meal_type: "lunch", meal_name: "Pizza (2 slices) with soda", calories: 950, protein: 28, carbs: 130, fat: 38, matched_plan: false, estimated: false, notes: "Out with colleagues", created_at: `${date}T13:30:00Z` },
            { id: `l-${m.id}-${date}-d`, member_id: m.id, date, meal_type: "dinner", meal_name: "Light Salad & laban", calories: 320, protein: 15, carbs: 22, fat: 12, matched_plan: false, estimated: false, notes: null, created_at: `${date}T20:30:00Z` }
          );
        } else {
          logs.push(
            { id: `l-${m.id}-${date}-b`, member_id: m.id, date, meal_type: "breakfast", meal_name: fulEggs.meal_name, calories: 460, protein: 28, carbs: 52, fat: 14, matched_plan: true, estimated: false, notes: null, created_at: `${date}T08:00:00Z` },
            { id: `l-${m.id}-${date}-l`, member_id: m.id, date, meal_type: "lunch", meal_name: chickenRice.meal_name, calories: 560, protein: 48, carbs: 65, fat: 12, matched_plan: true, estimated: false, notes: null, created_at: `${date}T13:30:00Z` },
            { id: `l-${m.id}-${date}-d`, member_id: m.id, date, meal_type: "dinner", meal_name: fishRice.meal_name, calories: 600, protein: 42, carbs: 60, fat: 20, matched_plan: true, estimated: false, notes: null, created_at: `${date}T20:30:00Z` }
          );
        }
      }
      // Today: Layla logged breakfast + KOSHARY for lunch!
      logs.push(
        { id: `l-${m.id}-${today}-b`, member_id: m.id, date: today, meal_type: "breakfast", meal_name: fulEggs.meal_name, calories: 480, protein: 28, carbs: 52, fat: 14, matched_plan: true, estimated: false, notes: null, created_at: `${today}T08:15:00Z` },
        { id: `l-${m.id}-${today}-l`, member_id: m.id, date: today, meal_type: "lunch", meal_name: "Koshary (large plate)", calories: 900, protein: 26, carbs: 160, fat: 18, matched_plan: false, estimated: false, notes: "Office lunch", created_at: `${today}T14:00:00Z` }
      );
    } else if (m.scenario === "protein_gap") {
      // Ahmed: 2400 kcal target, calories on target (2350 kcal) but protein low (75g / 170g)
      for (let d = -10; d <= -1; d++) {
        const date = addDays(today, d);
        logs.push(
          { id: `l-${m.id}-${date}-b`, member_id: m.id, date, meal_type: "breakfast", meal_name: "Pastry & caramel latte", calories: 650, protein: 12, carbs: 90, fat: 26, matched_plan: false, estimated: false, notes: null, created_at: `${date}T08:00:00Z` },
          { id: `l-${m.id}-${date}-l`, member_id: m.id, date, meal_type: "lunch", meal_name: "Pasta with tomato sauce & garlic bread", calories: 950, protein: 22, carbs: 140, fat: 32, matched_plan: false, estimated: false, notes: null, created_at: `${date}T13:30:00Z` },
          { id: `l-${m.id}-${date}-s`, member_id: m.id, date, meal_type: "snack", meal_name: "Banana & biscuits", calories: 300, protein: 4, carbs: 55, fat: 8, matched_plan: false, estimated: false, notes: null, created_at: `${date}T17:00:00Z` },
          { id: `l-${m.id}-${date}-d`, member_id: m.id, date, meal_type: "dinner", meal_name: "Feteer meshaltet with honey & cheese", calories: 480, protein: 40, carbs: 45, fat: 16, matched_plan: false, estimated: false, notes: null, created_at: `${date}T20:30:00Z` }
        );
      }
      logs.push(
        { id: `l-${m.id}-${today}-b`, member_id: m.id, date: today, meal_type: "breakfast", meal_name: "Pastry & caramel latte", calories: 650, protein: 12, carbs: 90, fat: 26, matched_plan: false, estimated: false, notes: null, created_at: `${today}T08:15:00Z` }
      );
    } else if (m.scenario === "preference_shift") {
      // Mariam: pescatarian shift (avoids chicken, swaps to tuna/eggs/salmon)
      for (let d = -10; d <= -1; d++) {
        const date = addDays(today, d);
        logs.push(
          { id: `l-${m.id}-${date}-b`, member_id: m.id, date, meal_type: "breakfast", meal_name: "Greek yogurt with oats & berries", calories: 420, protein: 30, carbs: 55, fat: 9, matched_plan: true, estimated: false, notes: null, created_at: `${date}T08:00:00Z` },
          { id: `l-${m.id}-${date}-l`, member_id: m.id, date, meal_type: "lunch", meal_name: "Tuna pasta salad with olives", calories: 510, protein: 38, carbs: 62, fat: 12, matched_plan: false, estimated: false, notes: "Avoided chicken", created_at: `${date}T13:30:00Z` },
          { id: `l-${m.id}-${date}-s`, member_id: m.id, date, meal_type: "snack", meal_name: "Apple with peanut butter", calories: 250, protein: 8, carbs: 28, fat: 12, matched_plan: true, estimated: false, notes: null, created_at: `${date}T17:00:00Z` },
          { id: `l-${m.id}-${date}-d`, member_id: m.id, date, meal_type: "dinner", meal_name: "Grilled sea bass with brown rice", calories: 580, protein: 38, carbs: 60, fat: 18, matched_plan: false, estimated: false, notes: null, created_at: `${date}T20:30:00Z` }
        );
      }
      logs.push(
        { id: `l-${m.id}-${today}-b`, member_id: m.id, date: today, meal_type: "breakfast", meal_name: "Greek yogurt with oats & berries", calories: 420, protein: 30, carbs: 55, fat: 9, matched_plan: true, estimated: false, notes: null, created_at: `${today}T08:00:00Z` }
      );
    } else if (m.scenario === "inactive") {
      // Youssef: logged days -10 to -6, then no logs for 5 consecutive days (-5 to -1)
      for (let d = -10; d <= -6; d++) {
        const date = addDays(today, d);
        logs.push(
          { id: `l-${m.id}-${date}-b`, member_id: m.id, date, meal_type: "breakfast", meal_name: fulEggs.meal_name, calories: fulEggs.calories, protein: fulEggs.protein, carbs: fulEggs.carbs, fat: fulEggs.fat, matched_plan: true, estimated: false, notes: null, created_at: `${date}T08:00:00Z` },
          { id: `l-${m.id}-${date}-l`, member_id: m.id, date, meal_type: "lunch", meal_name: chickenRice.meal_name, calories: chickenRice.calories, protein: chickenRice.protein, carbs: chickenRice.carbs, fat: chickenRice.fat, matched_plan: true, estimated: false, notes: null, created_at: `${date}T13:30:00Z` },
          { id: `l-${m.id}-${date}-d`, member_id: m.id, date, meal_type: "dinner", meal_name: fishRice.meal_name, calories: fishRice.calories, protein: fishRice.protein, carbs: fishRice.carbs, fat: fishRice.fat, matched_plan: true, estimated: false, notes: null, created_at: `${date}T20:30:00Z` }
        );
      }
      // Days -5 to today: 0 logs (Inactive)
    }
    mealLogs[m.id] = logs;

  }

  // Pre-seed Layla's active adaptive adjustment proposal (for the immediate WOW & prompt scenario)
  const layla = DEMO_MEMBERS[2];
  const laylaTarget = targets[layla.id];
  const laylaLogsToday = mealLogs[layla.id].filter((l) => l.date === today);
  const laylaLoggedSum = sumMacros(laylaLogsToday);
  const remainingCals = laylaTarget.calories - laylaLoggedSum.calories; // 2000 - 1380 = 620 kcal
  const remainingProt = laylaTarget.protein - laylaLoggedSum.protein;   // 140 - 54 = 86g P

  const turkeyWrap = foodToSnapshot(FOODS.find((f) => f.id === "turkey-wrap")!, 1.5); // ~540 kcal, 54g P
  const eggRiceBowl = foodToSnapshot(FOODS.find((f) => f.id === "egg-rice-bowl")!, 1.25);
  const tunaSandwich = foodToSnapshot(FOODS.find((f) => f.id === "tuna-sandwich")!, 1.5);

  const laylaProposedChange: ProposedChange = {
    kind: "adapt_daily_plan",
    title: "Rebalance Dinner for Today",
    explanation: "Your lunch was higher in carbohydrates (160g) than today's original plan. I adjusted dinner to a high-protein option to keep the rest of today's target balanced.",
    changes: [
      {
        date: today,
        meal_type: "dinner",
        before: foodToSnapshot(FOODS.find((f) => f.id === "kofta-bread")!),
        after: turkeyWrap,
      },
    ],
    options: [turkeyWrap, eggRiceBowl, tunaSandwich],
    selected_option: 0,
    verification: {
      ok: true,
      checks: [
        { label: "Safe macro ranges", ok: true, detail: "All proposed macros are mathematically verified" },
        { label: "Calories = P*4 + C*4 + F*9", ok: true, detail: "Deterministic calorie check passed" },
        { label: "Daily calorie tolerance", ok: true, detail: "Projects to 1,920 / 2,000 kcal (within 4%)" },
      ],
    },
  };

  const initialActions: AgentAction[] = [
    {
      id: "act-layla-today",
      member_id: layla.id,
      gym_id: DEMO_GYM_ID,
      initiated_by: layla.id,
      action_type: "adapt_daily_plan",
      user_request: "I ate Koshary for lunch",
      summary: "Layla Mostafa: Lunch was higher in carbohydrates (160g). Adjusted dinner to keep daily targets balanced.",
      tools_used: [
        { tool: "log_meal", summary: "Logged Koshary (large plate) for lunch (900 kcal, 26g P / 160g C / 18g F)" },
        { tool: "calculate_remaining_nutrition", summary: "Remaining: 620 kcal, 86g protein. Plan needed rebalancing." },
        { tool: "adapt_daily_plan", summary: "Proposed Turkey wrap with hummus (540 kcal, 54g protein)" },
      ],
      proposed_change: laylaProposedChange,
      requires_coach_approval: false,
      approved: null,
      execution_status: "proposed",
      decided_by: null,
      decided_at: null,
      decision_note: null,
      estimated_manual_minutes: 15,
      estimated_agent_minutes: 5,
      estimated_minutes_saved: 10,
      estimated_cost_value: 33.33,
      created_at: new Date(Date.now() - 35 * 60000).toISOString(),
    },
    {
      id: "act-ahmed-audit",
      member_id: DEMO_MEMBERS[3].id, // Ahmed
      gym_id: DEMO_GYM_ID,
      initiated_by: DEMO_COACH_ID,
      action_type: "adapt_weekly_plan",
      user_request: "Weekly compliance check",
      summary: "Ahmed Nabil: Protein low across 5 days (78g / 170g avg). Proposed high-protein weekly swaps.",
      tools_used: [
        { tool: "analyze_member_progress", summary: "Protein gap pattern identified (5 of 7 days below 80%)" },
        { tool: "adapt_weekly_plan", summary: "Drafted 7-day high protein meal alternatives" },
      ],
      proposed_change: null,
      requires_coach_approval: true,
      approved: null,
      execution_status: "pending_coach",
      decided_by: null,
      decided_at: null,
      decision_note: null,
      estimated_manual_minutes: 45,
      estimated_agent_minutes: 10,
      estimated_minutes_saved: 35,
      estimated_cost_value: 116.67,
      created_at: new Date(Date.now() - 3 * 3600000).toISOString(),
    },
    {
      id: "act-youssef-audit",
      member_id: DEMO_MEMBERS[5].id, // Youssef
      gym_id: DEMO_GYM_ID,
      initiated_by: DEMO_COACH_ID,
      action_type: "coach_followup",
      user_request: "Inactivity detection alert",
      summary: "Youssef Adel: Inactivity detected (4 days without logs). Coach follow-up drafted.",
      tools_used: [
        { tool: "analyze_member_progress", summary: "4 days since last meal log" },
        { tool: "create_coach_followup", summary: "Drafted coach check-in message" },
      ],
      proposed_change: null,
      requires_coach_approval: true,
      approved: null,
      execution_status: "pending_coach",
      decided_by: null,
      decided_at: null,
      decision_note: null,
      estimated_manual_minutes: 10,
      estimated_agent_minutes: 2,
      estimated_minutes_saved: 8,
      estimated_cost_value: 26.67,
      created_at: new Date(Date.now() - 8 * 3600000).toISOString(),
    },
  ];

  const initialAiUsage: AiUsage[] = [
    { id: "u-1", gym_id: DEMO_GYM_ID, member_id: layla.id, actor_id: layla.id, model: "gemini-3.5-flash-lite", input_tokens: 420, output_tokens: 115, request_count: 1, estimated_cost_usd: 0.0004135, created_at: new Date(Date.now() - 35 * 60000).toISOString() },
    { id: "u-2", gym_id: DEMO_GYM_ID, member_id: DEMO_MEMBERS[3].id, actor_id: DEMO_COACH_ID, model: "gemini-3.5-flash-lite", input_tokens: 680, output_tokens: 180, request_count: 1, estimated_cost_usd: 0.000654, created_at: new Date(Date.now() - 3 * 3600000).toISOString() },
    { id: "u-3", gym_id: DEMO_GYM_ID, member_id: DEMO_MEMBERS[5].id, actor_id: DEMO_COACH_ID, model: "gemini-3.5-flash-lite", input_tokens: 350, output_tokens: 95, request_count: 1, estimated_cost_usd: 0.0003425, created_at: new Date(Date.now() - 8 * 3600000).toISOString() },
  ];

  const initialMessages: Record<string, MemberMessage[]> = {
    [DEMO_MEMBERS[0].id]: [ // Omar
      {
        id: "msg-o-1",
        member_id: DEMO_MEMBERS[0].id,
        sender: "member",
        text: "Hey Coach, should I increase my protein intake on heavy leg days?",
        created_at: new Date(Date.now() - 2 * 3600000).toISOString(),
      },
      {
        id: "msg-o-2",
        member_id: DEMO_MEMBERS[0].id,
        sender: "coach",
        text: "Omar, at 160g protein/day you're in the optimal muscle protein synthesis bracket (1.8-2.0g/kg). On heavy leg days, prioritize 35-40g high-leucine protein in your post-workout meal rather than spiking total daily volume.",
        created_at: new Date(Date.now() - 1 * 3600000).toISOString(),
      },
    ],
    [DEMO_MEMBERS[1].id]: [ // Sara
      {
        id: "msg-s-1",
        member_id: DEMO_MEMBERS[1].id,
        sender: "member",
        text: "I missed logging dinner yesterday due to a late flight.",
        created_at: new Date(Date.now() - 20 * 3600000).toISOString(),
      },
      {
        id: "msg-s-2",
        member_id: DEMO_MEMBERS[1].id,
        sender: "coach",
        text: "No stress at all Sara! A single missed log won't impact your fat loss trajectory. Stay consistent with today's scheduled meals.",
        created_at: new Date(Date.now() - 18 * 3600000).toISOString(),
      },
    ],
    [DEMO_MEMBERS[2].id]: [ // Layla
      {
        id: "msg-l-1",
        member_id: DEMO_MEMBERS[2].id,
        sender: "member",
        text: "I had koshary for lunch at work today. How does dinner rebalance work?",
        created_at: new Date(Date.now() - 3 * 3600000).toISOString(),
      },
      {
        id: "msg-l-2",
        member_id: DEMO_MEMBERS[2].id,
        sender: "coach",
        text: "No worries Layla! The system automatically adapted your dinner to a lean, high-protein turkey wrap with greens so your total daily energy and carbs stay balanced.",
        created_at: new Date(Date.now() - 2 * 3600000).toISOString(),
      },
    ],
    [DEMO_MEMBERS[3].id]: [ // Ahmed
      {
        id: "msg-a-1",
        member_id: DEMO_MEMBERS[3].id,
        sender: "member",
        text: "Coach, finding it tough to hit 160g protein with just solid chicken and meat.",
        created_at: new Date(Date.now() - 6 * 3600000).toISOString(),
      },
      {
        id: "msg-a-2",
        member_id: DEMO_MEMBERS[3].id,
        sender: "coach",
        text: "Let's add Greek yogurt bowls and a whey protein shake to your daily plan. They deliver 25-30g protein with much less fullness fatigue.",
        created_at: new Date(Date.now() - 4 * 3600000).toISOString(),
      },
    ],
    [DEMO_MEMBERS[4].id]: [ // Mariam
      {
        id: "msg-m-1",
        member_id: DEMO_MEMBERS[4].id,
        sender: "member",
        text: "I've transitioned to pescatarian meals this week.",
        created_at: new Date(Date.now() - 36 * 3600000).toISOString(),
      },
      {
        id: "msg-m-2",
        member_id: DEMO_MEMBERS[4].id,
        sender: "coach",
        text: "Awesome choice Mariam! I've updated your plan with sea bass, salmon, eggs, and lentils to hit your 130g target with ease.",
        created_at: new Date(Date.now() - 30 * 3600000).toISOString(),
      },
    ],
    [DEMO_MEMBERS[5].id]: [ // Youssef
      {
        id: "msg-y-1",
        member_id: DEMO_MEMBERS[5].id,
        sender: "coach",
        text: "Hey Youssef, noticed you haven't logged meals in a few days. How are workouts going? Let me know if you want a simplified 2-meal tracking setup.",
        created_at: new Date(Date.now() - 24 * 3600000).toISOString(),
      },
    ],
  };

  return {
    gym: DEMO_GYM,
    coach: DEMO_COACH,
    members: DEMO_MEMBERS,
    activeMemberId: DEMO_MEMBERS[0].id, // Default to Omar for clean first impression
    activeRole: "member",
    activeTab: "today",
    today,
    profiles,
    targets,
    plannedMeals,
    mealLogs,
    messages: initialMessages,
    actions: initialActions,
    aiUsage: initialAiUsage,
  };
}
