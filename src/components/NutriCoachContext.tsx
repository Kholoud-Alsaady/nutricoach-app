"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { addDays, todayISO } from "@/lib/dates";
import { findFood, FOODS, foodToSnapshot } from "@/lib/foods";
import { impactFor, measureImpact } from "@/lib/impact";
import { caloriesFromMacros, normalizeMacros, scaleMacros, subtractMacros, sumMacros, verifyMeals } from "@/lib/nutrition";
import { baseName, planSlots, prefsFromProfile, suggestMeals } from "@/lib/planner";
import { createInitialDemoState, type DemoState } from "@/lib/store";
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
  ToolTraceEntry,
} from "@/lib/types";
import { DEMO_COACH_ID, DEMO_GYM_ID, type DemoMemberSpec } from "@/lib/agent/seed-data";

export type AppView = "portal" | "member" | "coach";

export interface WeeklyRebalanceInfo {
  delta: number;
  isSignificant: boolean;
  dailyAdjustment: number;
  remainingDaysCount: number;
  enabled: boolean;
  todayCaloriesLogged: number;
  targetCalories: number;
}

export interface AgentActionCard {
  type: "plan_updated" | "logged" | "info" | "question_sent";
  title: string;
  details: string;
  actionLabel: string;
  targetTab?: "plan" | "today" | "progress";
}

interface NutriCoachContextType {
  state: DemoState;
  currentView: AppView;
  setCurrentView: (view: AppView) => void;
  activeProfile: Profile;
  activeTargets: Targets;
  activePlannedMeals: PlannedMeal[];
  activeMealLogs: MealLog[];
  todayPlannedMeals: PlannedMeal[];
  todayMealLogs: MealLog[];
  todayLoggedMacros: Macros;
  todayPlannedMacros: Macros;
  todayRemainingMacros: Macros;
  pendingProposals: AgentAction[];
  recentAgentActions: AgentAction[];
  activeMessages: MemberMessage[];
  allMessages: Record<string, MemberMessage[]>;
  measuredImpact: ReturnType<typeof measureImpact>;
  weeklySmoothingEnabled: boolean;
  toggleWeeklySmoothing: () => void;
  weeklyRebalanceInfo: WeeklyRebalanceInfo;
  selectedPlanDayOffset: number;
  setSelectedPlanDayOffset: (offset: number) => void;

  // Member Management
  setActiveMember: (id: string) => void;
  selectMemberAndEnter: (id: string) => void;
  addNewMember: (params: { name: string; calorieGoal: number; proteinGoal: number; dietGoal: string; sex: "male" | "female" }) => void;
  
  // Navigation
  setActiveTab: (tab: DemoState["activeTab"]) => void;

  // Actions
  logMeal: (params: { mealName: string; mealType: MealType; servings?: number; asPlanned?: boolean; notes?: string }) => void;
  logCustomMeal: (params: { mealType: MealType; mealName: string; calories: number; protein: number; carbs: number; fat: number; notes?: string }) => void;
  deleteLog: (logId: string) => void;
  replaceMeal: (params: { mealType: MealType; avoid?: string[]; reason?: string }) => void;
  replaceMealSlot: (params: { mealType: MealType; date?: string; meal: MealSnapshot; source?: "coach" | "agent" | "custom"; rebalanceDinner?: boolean }) => void;
  addExtraMeal: (params: { mealType: string; mealName: string; calories: number; protein: number; carbs: number; fat: number; asLogged?: boolean; date?: string }) => void;
  confirmAddMeal: (params: { mealName: string; calories: number; protein: number; carbs: number; fat: number; mealType: string; targetDate: string; asLogged?: boolean }) => void;
  sendMemberMessage: (text: string) => Promise<void>;
  sendCoachReply: (memberId: string, replyText: string) => void;
  adaptDailyPlan: (reason?: string) => void;
  approveProposal: (actionId: string, optionIndex?: number) => void;
  rejectProposal: (actionId: string, note?: string) => void;
  updateGymAssumptions: (partial: Partial<Gym>) => void;
  askAgent: (prompt: string) => Promise<{ reply: string; actionCard?: AgentActionCard }>;
  resetDemo: () => void;
}

const NutriCoachContext = createContext<NutriCoachContextType | null>(null);

export function NutriCoachProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<DemoState>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("nutricoach_demo_state_v5");
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          // ignore
        }
      }
    }
    return createInitialDemoState();
  });

  const [currentView, setCurrentView] = useState<AppView>("portal");

  useEffect(() => {
    try {
      localStorage.setItem("nutricoach_demo_state_v5", JSON.stringify(state));
    } catch (e) {
      // ignore
    }
  }, [state]);

  const activeProfile = state.profiles[state.activeMemberId] || state.profiles[state.members[0].id];
  const activeTargets = state.targets[state.activeMemberId] || state.targets[state.members[0].id] || {
    id: "target-default",
    member_id: state.activeMemberId,
    calories: 2000,
    protein: 140,
    carbs: 210,
    fat: 65,
    water: 2.5,
    meals_per_day: 4,
    updated_at: new Date().toISOString(),
  };

  const activePlannedMeals = state.plannedMeals[state.activeMemberId] || [];
  const activeMealLogs = state.mealLogs[state.activeMemberId] || [];

  const today = state.today;
  const todayPlannedMeals = activePlannedMeals.filter((p) => p.date === today);
  const todayMealLogs = activeMealLogs.filter((l) => l.date === today);

  const todayLoggedMacros = sumMacros(todayMealLogs);
  const todayPlannedMacros = sumMacros(todayPlannedMeals);
  const todayRemainingMacros = {
    calories: Math.max(0, activeTargets.calories - todayLoggedMacros.calories),
    protein: Math.max(0, activeTargets.protein - todayLoggedMacros.protein),
    carbs: Math.max(0, activeTargets.carbs - todayLoggedMacros.carbs),
    fat: Math.max(0, activeTargets.fat - todayLoggedMacros.fat),
  };

  const [weeklySmoothingEnabled, setWeeklySmoothingEnabled] = useState(true);
  const [selectedPlanDayOffset, setSelectedPlanDayOffset] = useState<number>(0);

  const toggleWeeklySmoothing = () => setWeeklySmoothingEnabled((prev) => !prev);

  // Weekly Compensatory Rebalancing Logic
  // Delta = Actual Calories Logged Today - Daily Calorie Target
  const todayCaloriesLogged = todayLoggedMacros.calories;
  const hasLoggedToday = todayMealLogs.length > 0;
  const delta = hasLoggedToday ? todayCaloriesLogged - activeTargets.calories : 0;
  const isSignificantDelta = hasLoggedToday && Math.abs(delta) > 50;

  // Remaining upcoming days N (e.g. tomorrow through next 6 days)
  const remainingDaysCount = 6;
  const rawAdjustment = remainingDaysCount > 0 ? Math.round(-delta / remainingDaysCount) : 0;
  const dailyAdjustment = Math.max(-150, Math.min(150, rawAdjustment));

  const weeklyRebalanceInfo: WeeklyRebalanceInfo = {
    delta,
    isSignificant: isSignificantDelta,
    dailyAdjustment,
    remainingDaysCount,
    enabled: weeklySmoothingEnabled,
    todayCaloriesLogged,
    targetCalories: activeTargets.calories,
  };

  const pendingProposals = state.actions.filter(
    (a) => a.member_id === state.activeMemberId && (a.execution_status === "proposed" || a.execution_status === "pending_coach")
  );

  const recentAgentActions = [...state.actions].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const measuredImpact = measureImpact(state.actions, state.aiUsage, state.gym, state.members.length);

  const setActiveMember = (id: string) => {
    setState((prev) => ({ ...prev, activeMemberId: id, activeRole: "member" }));
  };

  const selectMemberAndEnter = (id: string) => {
    setState((prev) => ({ ...prev, activeMemberId: id, activeRole: "member", activeTab: "today" }));
    setCurrentView("member");
  };

  const setActiveTab = (tab: DemoState["activeTab"]) => {
    setState((prev) => ({ ...prev, activeTab: tab }));
  };

  const updateGymAssumptions = (partial: Partial<Gym>) => {
    setState((prev) => ({ ...prev, gym: { ...prev.gym, ...partial } }));
  };

  const resetDemo = () => {
    if (typeof window !== "undefined") localStorage.removeItem("nutricoach_demo_state_v2");
    setState(createInitialDemoState());
    setCurrentView("portal");
  };

  // Add dynamically created new member
  const addNewMember = ({ name, calorieGoal, proteinGoal, dietGoal, sex }: { name: string; calorieGoal: number; proteinGoal: number; dietGoal: string; sex: "male" | "female" }) => {
    const newId = `member-${Date.now()}`;
    const carbsGoal = Math.round((calorieGoal - proteinGoal * 4 - (calorieGoal * 0.25)) / 4);
    const fatGoal = Math.round((calorieGoal * 0.25) / 9);

    const newMemberSpec: DemoMemberSpec = {
      id: newId,
      name,
      email: `${name.toLowerCase().replace(/\s+/g, ".")}@example.com`,
      age: 26,
      sex,
      height: 172,
      weight: 70,
      goal: dietGoal || "Healthy Fitness & Nutrition",
      activity_level: "moderate",
      dietary_preferences: [],
      disliked_foods: [],
      allergies: [],
      scenario: "stable",
      scenarioLabel: "Custom Created Member",
      scenarioDescription: "Newly created profile with personalized macro targets.",
      targets: { calories: calorieGoal, protein: proteinGoal, carbs: carbsGoal, fat: fatGoal, water: 2.5 },
    };

    const newProfile: Profile = {
      id: newId,
      gym_id: DEMO_GYM_ID,
      role: "member",
      coach_id: DEMO_COACH_ID,
      name,
      email: newMemberSpec.email,
      age: 26,
      sex,
      height: 172,
      weight: 70,
      goal: dietGoal,
      activity_level: "moderate",
      dietary_preferences: [],
      disliked_foods: [],
      allergies: [],
      medical_notes: null,
      subscription_status: "active",
      demo_scenario: "stable",
      created_at: new Date().toISOString(),
    };

    const newTargets: Targets = {
      id: `target-${newId}`,
      member_id: newId,
      calories: calorieGoal,
      protein: proteinGoal,
      carbs: carbsGoal,
      fat: fatGoal,
      water: 2.5,
      meals_per_day: 4,
      updated_at: new Date().toISOString(),
    };

    // Plan baseline meals
    const fulEggs = foodToSnapshot(FOODS.find((f) => f.id === "ful-eggs")!);
    const chickenRice = foodToSnapshot(FOODS.find((f) => f.id === "chicken-rice")!);
    const yogurtBerries = foodToSnapshot(FOODS.find((f) => f.id === "yogurt-berries")!);
    const fishRice = foodToSnapshot(FOODS.find((f) => f.id === "fish-rice")!);

    const pMeals: PlannedMeal[] = [];
    for (let d = -13; d <= 6; d++) {
      const date = addDays(today, d);
      pMeals.push(
        { id: `p-${newId}-${date}-b`, plan_id: `plan-${newId}`, member_id: newId, date, meal_type: "breakfast", meal_name: fulEggs.meal_name, calories: fulEggs.calories, protein: fulEggs.protein, carbs: fulEggs.carbs, fat: fulEggs.fat, ingredients: fulEggs.ingredients, tags: fulEggs.tags, source: "coach", updated_at: new Date().toISOString() },
        { id: `p-${newId}-${date}-l`, plan_id: `plan-${newId}`, member_id: newId, date, meal_type: "lunch", meal_name: chickenRice.meal_name, calories: chickenRice.calories, protein: chickenRice.protein, carbs: chickenRice.carbs, fat: chickenRice.fat, ingredients: chickenRice.ingredients, tags: chickenRice.tags, source: "coach", updated_at: new Date().toISOString() },
        { id: `p-${newId}-${date}-s`, plan_id: `plan-${newId}`, member_id: newId, date, meal_type: "snack", meal_name: yogurtBerries.meal_name, calories: yogurtBerries.calories, protein: yogurtBerries.protein, carbs: yogurtBerries.carbs, fat: yogurtBerries.fat, ingredients: yogurtBerries.ingredients, tags: yogurtBerries.tags, source: "coach", updated_at: new Date().toISOString() },
        { id: `p-${newId}-${date}-d`, plan_id: `plan-${newId}`, member_id: newId, date, meal_type: "dinner", meal_name: fishRice.meal_name, calories: fishRice.calories, protein: fishRice.protein, carbs: fishRice.carbs, fat: fishRice.fat, ingredients: fishRice.ingredients, tags: fishRice.tags, source: "coach", updated_at: new Date().toISOString() }
      );
    }

    setState((prev) => ({
      ...prev,
      members: [...prev.members, newMemberSpec],
      profiles: { ...prev.profiles, [newId]: newProfile },
      targets: { ...prev.targets, [newId]: newTargets },
      plannedMeals: { ...prev.plannedMeals, [newId]: pMeals },
      mealLogs: { ...prev.mealLogs, [newId]: [] },
      activeMemberId: newId,
      activeRole: "member",
    }));

    setCurrentView("member");
  };

  const deleteLog = (logId: string) => {
    setState((prev) => {
      const logs = prev.mealLogs[prev.activeMemberId] || [];
      return {
        ...prev,
        mealLogs: {
          ...prev.mealLogs,
          [prev.activeMemberId]: logs.filter((l) => l.id !== logId),
        },
      };
    });
  };

  const logMeal = ({ mealName, mealType, servings = 1, asPlanned = false, notes }: { mealName: string; mealType: MealType; servings?: number; asPlanned?: boolean; notes?: string }) => {
    const plannedSlot = todayPlannedMeals.find((p) => p.meal_type === mealType);
    let snapshot: MealSnapshot | null = null;
    let matched = false;

    if (asPlanned && plannedSlot) {
      snapshot = {
        meal_name: plannedSlot.meal_name,
        calories: plannedSlot.calories,
        protein: plannedSlot.protein,
        carbs: plannedSlot.carbs,
        fat: plannedSlot.fat,
        ingredients: plannedSlot.ingredients,
        tags: plannedSlot.tags,
      };
      matched = true;
    } else {
      const food = findFood(mealName);
      if (food) {
        snapshot = foodToSnapshot(food, servings);
      } else {
        snapshot = {
          meal_name: mealName,
          calories: 500 * servings,
          protein: 25 * servings,
          carbs: 60 * servings,
          fat: 15 * servings,
          ingredients: [],
          tags: [],
        };
      }
    }

    const newLog: MealLog = {
      id: `log-${Date.now()}`,
      member_id: state.activeMemberId,
      date: today,
      meal_type: mealType,
      meal_name: snapshot.meal_name,
      calories: snapshot.calories,
      protein: snapshot.protein,
      carbs: snapshot.carbs,
      fat: snapshot.fat,
      matched_plan: matched,
      estimated: !matched && !findFood(mealName),
      notes: notes || null,
      created_at: new Date().toISOString(),
    };

    const impact = impactFor("log_meal", state.gym.estimated_coach_hourly_value);
    const newAction: AgentAction = {
      id: `act-${Date.now()}`,
      member_id: state.activeMemberId,
      gym_id: state.gym.id,
      initiated_by: state.activeMemberId,
      action_type: "log_meal",
      user_request: `Logged ${snapshot.meal_name} for ${mealType}`,
      summary: `Logged ${snapshot.meal_name} for ${mealType} (${snapshot.calories} kcal, ${snapshot.protein}g P / ${snapshot.carbs}g C / ${snapshot.fat}g F)`,
      tools_used: [{ tool: "log_meal", summary: `Logged ${snapshot.meal_name}` }, { tool: "calculate_remaining_nutrition", summary: "Calculated remaining daily balance" }],
      proposed_change: null,
      requires_coach_approval: false,
      approved: true,
      execution_status: "executed",
      decided_by: state.activeMemberId,
      decided_at: new Date().toISOString(),
      decision_note: null,
      estimated_manual_minutes: impact.estimated_manual_minutes,
      estimated_agent_minutes: impact.estimated_agent_minutes,
      estimated_minutes_saved: impact.estimated_minutes_saved,
      estimated_cost_value: impact.estimated_cost_value,
      created_at: new Date().toISOString(),
    };

    setState((prev) => {
      const currentLogs = prev.mealLogs[prev.activeMemberId] || [];
      return {
        ...prev,
        mealLogs: { ...prev.mealLogs, [prev.activeMemberId]: [...currentLogs, newLog] },
        actions: [newAction, ...prev.actions],
      };
    });

    if (!matched && (snapshot.carbs > 100 || snapshot.calories > (plannedSlot?.calories || 600) * 1.25)) {
      adaptDailyPlan(`Lunch was higher in carbohydrates (${snapshot.carbs}g) than today's original plan.`);
    }
  };

  // Direct custom meal logging with exact calories or grams
  const logCustomMeal = ({
    mealType,
    mealName,
    calories,
    protein,
    carbs,
    fat,
    notes,
  }: {
    mealType: MealType;
    mealName: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    notes?: string;
  }) => {
    const newLog: MealLog = {
      id: `log-${Date.now()}`,
      member_id: state.activeMemberId,
      date: today,
      meal_type: mealType,
      meal_name: mealName.trim() || `Custom ${mealType.charAt(0).toUpperCase() + mealType.slice(1)}`,
      calories: Math.max(1, Math.round(calories)),
      protein: Math.max(0, Math.round(protein)),
      carbs: Math.max(0, Math.round(carbs)),
      fat: Math.max(0, Math.round(fat)),
      matched_plan: false,
      estimated: false,
      notes: notes || null,
      created_at: new Date().toISOString(),
    };

    const impact = impactFor("log_meal", state.gym.estimated_coach_hourly_value);
    const newAction: AgentAction = {
      id: `act-${Date.now()}`,
      member_id: state.activeMemberId,
      gym_id: state.gym.id,
      initiated_by: state.activeMemberId,
      action_type: "log_meal",
      user_request: `Custom log for ${mealType}: ${newLog.meal_name}`,
      summary: `Logged custom ${newLog.meal_name} (${newLog.calories} kcal · ${newLog.protein}g P · ${newLog.carbs}g C · ${newLog.fat}g F)`,
      tools_used: [{ tool: "log_meal", summary: `Custom logged ${newLog.meal_name}` }],
      proposed_change: null,
      requires_coach_approval: false,
      approved: true,
      execution_status: "executed",
      decided_by: state.activeMemberId,
      decided_at: new Date().toISOString(),
      decision_note: null,
      estimated_manual_minutes: impact.estimated_manual_minutes,
      estimated_agent_minutes: impact.estimated_agent_minutes,
      estimated_minutes_saved: impact.estimated_minutes_saved,
      estimated_cost_value: impact.estimated_cost_value,
      created_at: new Date().toISOString(),
    };

    setState((prev) => {
      const currentLogs = prev.mealLogs[prev.activeMemberId] || [];
      return {
        ...prev,
        mealLogs: { ...prev.mealLogs, [prev.activeMemberId]: [...currentLogs, newLog] },
        actions: [newAction, ...prev.actions],
      };
    });
  };

  // Direct meal slot replacement in plan or today with dinner auto-rebalancing
  const replaceMealSlot = ({
    mealType,
    date = today,
    meal,
    source = "agent",
    rebalanceDinner = true,
  }: {
    mealType: MealType;
    date?: string;
    meal: MealSnapshot;
    source?: "coach" | "agent" | "custom";
    rebalanceDinner?: boolean;
  }) => {
    setState((prev) => {
      const memberId = prev.activeMemberId;
      const currentPlanned = [...(prev.plannedMeals[memberId] || [])];
      const idx = currentPlanned.findIndex((p) => p.date === date && p.meal_type === mealType);

      const updatedSlot: PlannedMeal = {
        id: idx >= 0 ? currentPlanned[idx].id : `p-${Date.now()}`,
        plan_id: idx >= 0 ? currentPlanned[idx].plan_id : `plan-${memberId}`,
        member_id: memberId,
        date,
        meal_type: mealType,
        meal_name: meal.meal_name,
        calories: meal.calories,
        protein: meal.protein,
        carbs: meal.carbs,
        fat: meal.fat,
        ingredients: meal.ingredients || [],
        tags: meal.tags || [],
        source,
        updated_at: new Date().toISOString(),
      };

      if (idx >= 0) {
        currentPlanned[idx] = updatedSlot;
      } else {
        currentPlanned.push(updatedSlot);
      }

      // If modifying a non-dinner meal slot, auto-rebalance dinner for that day so total calories stay balanced
      let dinnerRebalancedNote = "";
      if (rebalanceDinner && mealType !== "dinner") {
        const dinnerIdx = currentPlanned.findIndex((p) => p.date === date && p.meal_type === "dinner");
        if (dinnerIdx >= 0) {
          const oldDinner = currentPlanned[dinnerIdx];
          const effectiveDailyTarget =
            weeklySmoothingEnabled && isSignificantDelta && date !== today
              ? activeTargets.calories + dailyAdjustment
              : activeTargets.calories;

          const otherMealsCals = currentPlanned
            .filter((p) => p.date === date && p.meal_type !== "dinner")
            .reduce((sum, m) => sum + m.calories, 0);

          const newDinnerCals = Math.max(250, effectiveDailyTarget - otherMealsCals);
          const ratio = oldDinner.calories > 0 ? newDinnerCals / oldDinner.calories : 1;
          const newDinnerProtein = Math.max(15, Math.round(oldDinner.protein * ratio));
          const newDinnerCarbs = Math.max(15, Math.round(oldDinner.carbs * ratio));
          const newDinnerFat = Math.max(5, Math.round(oldDinner.fat * ratio));

          currentPlanned[dinnerIdx] = {
            ...oldDinner,
            calories: newDinnerCals,
            protein: newDinnerProtein,
            carbs: newDinnerCarbs,
            fat: newDinnerFat,
            source: "agent",
            updated_at: new Date().toISOString(),
          };

          dinnerRebalancedNote = ` (Dinner recalibrated to ${newDinnerCals} kcal to maintain daily balance)`;
        }
      }

      const impact = impactFor("replace_meal", prev.gym.estimated_coach_hourly_value);
      const actionTitle = date === today ? "Today" : date === addDays(today, 1) ? "Tomorrow" : date;
      const newAction: AgentAction = {
        id: `act-${Date.now()}`,
        member_id: memberId,
        gym_id: prev.gym.id,
        initiated_by: memberId,
        action_type: "replace_meal",
        user_request: `Adjust ${actionTitle}'s ${mealType} to ${meal.meal_name}`,
        summary: `Updated ${actionTitle}'s ${mealType} to ${meal.meal_name} (${meal.calories} kcal)${dinnerRebalancedNote}`,
        tools_used: [
          { tool: "replace_meal", summary: `Assigned ${meal.meal_name} to ${actionTitle} ${mealType}` },
          { tool: "calculate_remaining_nutrition", summary: "Recalculated daily macro targets" },
        ],
        proposed_change: null,
        requires_coach_approval: false,
        approved: true,
        execution_status: "executed",
        decided_by: memberId,
        decided_at: new Date().toISOString(),
        decision_note: "Directly applied by NutriCoach agent",
        estimated_manual_minutes: impact.estimated_manual_minutes,
        estimated_agent_minutes: impact.estimated_agent_minutes,
        estimated_minutes_saved: impact.estimated_minutes_saved,
        estimated_cost_value: impact.estimated_cost_value,
        created_at: new Date().toISOString(),
      };

      return {
        ...prev,
        plannedMeals: {
          ...prev.plannedMeals,
          [memberId]: currentPlanned,
        },
        actions: [newAction, ...prev.actions],
      };
    });
  };

  const adaptDailyPlan = (reason?: string) => {
    const remainingSlots = (["breakfast", "lunch", "snack", "dinner"] as MealType[]).filter(
      (slot) => !todayMealLogs.some((l) => l.meal_type === slot)
    );

    if (!remainingSlots.length) return;

    const remainingBudget = todayRemainingMacros;
    const prefs = prefsFromProfile(activeProfile);
    const newMeals = planSlots(remainingBudget, remainingSlots, prefs);

    const changes: MealChange[] = newMeals.map(({ meal_type, meal }) => {
      const before = todayPlannedMeals.find((p) => p.meal_type === meal_type);
      return {
        date: today,
        meal_type,
        before: before ? { meal_name: before.meal_name, calories: before.calories, protein: before.protein, carbs: before.carbs, fat: before.fat, ingredients: before.ingredients, tags: before.tags } : null,
        after: meal,
      };
    });

    const projected = sumMacros([...todayMealLogs, ...newMeals.map((m) => m.meal)]);
    const verification = verifyMeals(newMeals.map((m) => m.meal), [{ date: today, totals: projected }], activeTargets);

    const explanation = reason || `Adjusted remaining meals (${remainingSlots.join(", ")}) to keep today's target balanced at ${activeTargets.calories} kcal.`;

    const proposed: ProposedChange = {
      kind: "adapt_daily_plan",
      title: `Rebalance ${remainingSlots.join(" & ")} for Today`,
      explanation,
      changes,
      options: newMeals.map((m) => m.meal),
      verification,
    };

    const impact = impactFor("adapt_daily_plan", state.gym.estimated_coach_hourly_value);
    const newAction: AgentAction = {
      id: `act-${Date.now()}`,
      member_id: state.activeMemberId,
      gym_id: state.gym.id,
      initiated_by: state.activeMemberId,
      action_type: "adapt_daily_plan",
      user_request: "Plan rebalance requested",
      summary: `${activeProfile.name}: ${explanation}`,
      tools_used: [
        { tool: "calculate_remaining_nutrition", summary: `Remaining: ${remainingBudget.calories} kcal, ${remainingBudget.protein}g protein` },
        { tool: "adapt_daily_plan", summary: `Calculated replacements for ${remainingSlots.join(", ")}` },
      ],
      proposed_change: proposed,
      requires_coach_approval: false,
      approved: null,
      execution_status: "proposed",
      decided_by: null,
      decided_at: null,
      decision_note: null,
      estimated_manual_minutes: impact.estimated_manual_minutes,
      estimated_agent_minutes: impact.estimated_agent_minutes,
      estimated_minutes_saved: impact.estimated_minutes_saved,
      estimated_cost_value: impact.estimated_cost_value,
      created_at: new Date().toISOString(),
    };

    setState((prev) => ({ ...prev, actions: [newAction, ...prev.actions] }));
  };

  const replaceMeal = ({ mealType, avoid = [], reason }: { mealType: MealType; avoid?: string[]; reason?: string }) => {
    const current = todayPlannedMeals.find((p) => p.meal_type === mealType);
    const prefs = prefsFromProfile(activeProfile);
    const targetSlotMacros: Macros = current
      ? { calories: current.calories, protein: current.protein, carbs: current.carbs, fat: current.fat }
      : { calories: Math.round(activeTargets.calories * 0.35), protein: Math.round(activeTargets.protein * 0.35), carbs: 0, fat: 0 };

    const options = suggestMeals(targetSlotMacros, mealType, prefs, {
      count: 3,
      avoidTerms: avoid,
      excludeNames: current ? [current.meal_name] : [],
    });

    if (!options.length) return;

    const verification = verifyMeals(options);
    const explanation = `Found 3 alternatives for ${mealType}${avoid.length ? ` avoiding ${avoid.join(", ")}` : ""} that match your target.`;

    const proposed: ProposedChange = {
      kind: "replace_meal",
      title: `Replace ${mealType[0].toUpperCase()}${mealType.slice(1)} for Today`,
      explanation,
      changes: [{ date: today, meal_type: mealType, before: current ? { meal_name: current.meal_name, calories: current.calories, protein: current.protein, carbs: current.carbs, fat: current.fat, ingredients: current.ingredients, tags: current.tags } : null, after: options[0] }],
      options,
      selected_option: 0,
      verification,
    };

    const impact = impactFor("replace_meal", state.gym.estimated_coach_hourly_value);
    const newAction: AgentAction = {
      id: `act-${Date.now()}`,
      member_id: state.activeMemberId,
      gym_id: state.gym.id,
      initiated_by: state.activeMemberId,
      action_type: "replace_meal",
      user_request: `Replace ${mealType}${avoid.length ? ` (no ${avoid.join(", ")})` : ""}`,
      summary: `${activeProfile.name}: Replace ${mealType}${reason ? ` — ${reason}` : ""}`,
      tools_used: [
        { tool: "get_today_plan", summary: `Inspected today's planned ${mealType}` },
        { tool: "replace_meal", summary: `Generated 3 alternative meals matching target macros` },
      ],
      proposed_change: proposed,
      requires_coach_approval: false,
      approved: null,
      execution_status: "proposed",
      decided_by: null,
      decided_at: null,
      decision_note: null,
      estimated_manual_minutes: impact.estimated_manual_minutes,
      estimated_agent_minutes: impact.estimated_agent_minutes,
      estimated_minutes_saved: impact.estimated_minutes_saved,
      estimated_cost_value: impact.estimated_cost_value,
      created_at: new Date().toISOString(),
    };

    setState((prev) => ({ ...prev, actions: [newAction, ...prev.actions] }));
  };

  const approveProposal = (actionId: string, optionIndex?: number) => {
    setState((prev) => {
      const action = prev.actions.find((a) => a.id === actionId);
      if (!action || !action.proposed_change) return prev;

      const memberId = action.member_id;
      const currentPlanned = [...(prev.plannedMeals[memberId] || [])];
      const proposal = action.proposed_change;

      if (optionIndex !== undefined && proposal.options && proposal.options[optionIndex] && proposal.changes?.[0]) {
        proposal.changes[0].after = proposal.options[optionIndex];
      }

      if (proposal.changes?.length) {
        for (const chg of proposal.changes) {
          const idx = currentPlanned.findIndex((p) => p.date === chg.date && p.meal_type === chg.meal_type);
          const updatedMeal: PlannedMeal = {
            id: idx >= 0 ? currentPlanned[idx].id : `p-${Date.now()}`,
            plan_id: idx >= 0 ? currentPlanned[idx].plan_id : `plan-${memberId}`,
            member_id: memberId,
            date: chg.date,
            meal_type: chg.meal_type,
            meal_name: chg.after.meal_name,
            calories: chg.after.calories,
            protein: chg.after.protein,
            carbs: chg.after.carbs,
            fat: chg.after.fat,
            ingredients: chg.after.ingredients,
            tags: chg.after.tags,
            source: "agent",
            updated_at: new Date().toISOString(),
          };
          if (idx >= 0) {
            currentPlanned[idx] = updatedMeal;
          } else {
            currentPlanned.push(updatedMeal);
          }
        }
      }

      const impact = impactFor(action.action_type, prev.gym.estimated_coach_hourly_value);

      const updatedAction: AgentAction = {
        ...action,
        execution_status: "executed",
        approved: true,
        decided_by: prev.activeMemberId,
        decided_at: new Date().toISOString(),
        decision_note: "Approved by member",
        estimated_minutes_saved: impact.estimated_minutes_saved,
        estimated_cost_value: impact.estimated_cost_value,
      };

      return {
        ...prev,
        plannedMeals: { ...prev.plannedMeals, [memberId]: currentPlanned },
        actions: prev.actions.map((a) => (a.id === actionId ? updatedAction : a)),
      };
    });
  };

  const rejectProposal = (actionId: string, note?: string) => {
    setState((prev) => ({
      ...prev,
      actions: prev.actions.map((a) =>
        a.id === actionId
          ? {
              ...a,
              execution_status: "rejected",
              approved: false,
              decided_by: prev.activeMemberId,
              decided_at: new Date().toISOString(),
              decision_note: note || "Declined by user",
            }
          : a
      ),
    }));
  };

  const activeMessages = state.messages[state.activeMemberId] || [];
  const allMessages = state.messages;

  const addExtraMeal = ({
    mealType,
    mealName,
    calories,
    protein,
    carbs,
    fat,
    asLogged = false,
    date = today,
  }: {
    mealType: string;
    mealName: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    asLogged?: boolean;
    date?: string;
  }) => {
    const memberId = state.activeMemberId;
    const newPlannedMeal: PlannedMeal = {
      id: `p-${memberId}-${Date.now()}`,
      plan_id: `plan-${memberId}`,
      member_id: memberId,
      date,
      meal_type: mealType as MealType,
      meal_name: mealName,
      calories,
      protein,
      carbs,
      fat,
      ingredients: [mealName.toLowerCase()],
      tags: ["custom", "extra"],
      source: "custom",
      updated_at: new Date().toISOString(),
    };

    let newLog: MealLog | null = null;
    if (asLogged) {
      newLog = {
        id: `l-${memberId}-${Date.now()}`,
        member_id: memberId,
        date,
        meal_type: mealType as MealType,
        meal_name: mealName,
        calories,
        protein,
        carbs,
        fat,
        matched_plan: true,
        estimated: false,
        notes: "Added & logged via Meal Stream",
        created_at: new Date().toISOString(),
      };
    }

    setState((prev) => {
      const currentPlanned = prev.plannedMeals[memberId] || [];
      const currentLogs = prev.mealLogs[memberId] || [];

      return {
        ...prev,
        plannedMeals: {
          ...prev.plannedMeals,
          [memberId]: [...currentPlanned, newPlannedMeal],
        },
        mealLogs: newLog
          ? {
              ...prev.mealLogs,
              [memberId]: [...currentLogs, newLog],
            }
          : prev.mealLogs,
      };
    });
  };

  const confirmAddMeal = ({
    mealName,
    calories,
    protein,
    carbs,
    fat,
    mealType,
    targetDate,
    asLogged = false,
  }: {
    mealName: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    mealType: string;
    targetDate: string;
    asLogged?: boolean;
  }) => {
    const memberId = state.activeMemberId;
    const newPlannedMeal: PlannedMeal = {
      id: `p-${memberId}-${Date.now()}`,
      plan_id: `plan-${memberId}`,
      member_id: memberId,
      date: targetDate,
      meal_type: mealType as MealType,
      meal_name: mealName,
      calories,
      protein,
      carbs,
      fat,
      ingredients: [mealName.toLowerCase()],
      tags: ["custom", "confirmed"],
      source: "agent",
      updated_at: new Date().toISOString(),
    };

    let newLog: MealLog | null = null;
    if (asLogged) {
      newLog = {
        id: `l-${memberId}-${Date.now()}`,
        member_id: memberId,
        date: targetDate,
        meal_type: mealType as MealType,
        meal_name: mealName,
        calories,
        protein,
        carbs,
        fat,
        matched_plan: true,
        estimated: false,
        notes: "Confirmed & logged via Ask Coach",
        created_at: new Date().toISOString(),
      };
    }

    const successMsg: MemberMessage = {
      id: `msg-confirm-${Date.now()}`,
      member_id: memberId,
      sender: "agent",
      text: `Confirmed! I've added ${mealName} (${calories} kcal · ${protein}g P · ${carbs}g C · ${fat}g F) to ${
        targetDate === today ? "Today" : "Tomorrow"
      }'s ${mealType.replace("_", " ")}${asLogged ? " and marked it as logged" : ""}.`,
      actionCard: {
        type: asLogged ? "logged" : "plan_updated",
        title: "Plan Updated",
        details: `${mealName} added to ${targetDate === today ? "Today" : "Tomorrow"}`,
        actionLabel: targetDate === today ? "View Today's Stream" : "View Weekly Plan",
        targetTab: targetDate === today ? "today" : "plan",
      },
      created_at: new Date().toISOString(),
    };

    setState((prev) => {
      const currentPlanned = prev.plannedMeals[memberId] || [];
      const currentLogs = prev.mealLogs[memberId] || [];
      const currentMsgs = prev.messages[memberId] || [];

      // Clear pending confirmation from last message
      const updatedMsgs = currentMsgs.map((m, idx) =>
        idx === currentMsgs.length - 1 ? { ...m, pendingConfirmation: undefined } : m
      );

      return {
        ...prev,
        plannedMeals: {
          ...prev.plannedMeals,
          [memberId]: [...currentPlanned, newPlannedMeal],
        },
        mealLogs: newLog
          ? {
              ...prev.mealLogs,
              [memberId]: [...currentLogs, newLog],
            }
          : prev.mealLogs,
        messages: {
          ...prev.messages,
          [memberId]: [...updatedMsgs, successMsg],
        },
      };
    });
  };

  const sendCoachReply = (memberId: string, replyText: string) => {
    if (!replyText.trim()) return;

    const replyMsg: MemberMessage = {
      id: `msg-coach-${Date.now()}`,
      member_id: memberId,
      sender: "coach",
      text: replyText.trim(),
      created_at: new Date().toISOString(),
    };

    setState((prev) => {
      const currentMsgs = prev.messages[memberId] || [];
      return {
        ...prev,
        messages: {
          ...prev.messages,
          [memberId]: [...currentMsgs, replyMsg],
        },
      };
    });
  };

  const sendMemberMessage = async (text: string) => {
    if (!text.trim()) return;
    const memberId = state.activeMemberId;
    const userMsg: MemberMessage = {
      id: `msg-user-${Date.now()}`,
      member_id: memberId,
      sender: "member",
      text: text.trim(),
      created_at: new Date().toISOString(),
    };

    const p = text.toLowerCase();

    let coachReplyText = "";
    if (p.includes("leg day") || (p.includes("protein") && p.includes("increase"))) {
      coachReplyText = `On heavy leg days, prioritize 35-40g high-leucine protein in your post-workout meal rather than drastically spiking total daily volume. Your current daily target (${activeTargets.protein}g) already provides optimal muscle protein synthesis.`;
    } else if (p.includes("balance lunch") || (p.includes("lunch") && p.includes("late dinner"))) {
      coachReplyText = `Shift ~25% of your daytime carbohydrates to your evening window, and focus your lunch on lean protein and high-fiber vegetables (e.g., grilled chicken with garden greens) so you have ample calorie budget for late dinner.`;
    } else if (p.includes("fatigued") || p.includes("snack advice") || p.includes("energy")) {
      coachReplyText = `For post-workout fatigue, try a fast-acting carb + electrolyte combo 30-45 mins before training: 1 ripe banana with 1 tbsp peanut butter or a Greek yogurt bowl with a drizzle of honey. Ensure you're hitting your 3.0L water target today.`;
    } else if (p.includes("travel") || p.includes("dining out") || p.includes("restaurant")) {
      coachReplyText = `When dining out, prioritize grilled proteins (shish taouk, grilled sea bass, or lean kofta), ask for dressings on the side, and opt for steamed basmati rice or 1 loaf of baladi bread over fried sides.`;
    } else {
      const goalStr = activeProfile.goal ? activeProfile.goal.toLowerCase() : "fitness";
      coachReplyText = `Got your note, ${activeProfile.name.split(" ")[0]}! I've reviewed your message and recent logs. Everything is tracking cleanly toward your ${goalStr} goal. Keep up the consistency!`;
    }

    const coachReplyMsg: MemberMessage = {
      id: `msg-coach-${Date.now()}`,
      member_id: memberId,
      sender: "coach",
      text: coachReplyText,
      created_at: new Date(Date.now() + 500).toISOString(),
    };

    setState((prev) => {
      const currentMsgs = prev.messages[memberId] || [];
      return {
        ...prev,
        messages: {
          ...prev.messages,
          [memberId]: [...currentMsgs, userMsg, coachReplyMsg],
        },
      };
    });
  };

  const askAgent = async (prompt: string): Promise<{ reply: string; actionCard?: AgentActionCard }> => {
    await sendMemberMessage(prompt);
    return { reply: "Message processed." };
  };

  return (
    <NutriCoachContext.Provider
      value={{
        state,
        currentView,
        setCurrentView,
        activeProfile,
        activeTargets,
        activePlannedMeals,
        activeMealLogs,
        todayPlannedMeals,
        todayMealLogs,
        todayLoggedMacros,
        todayPlannedMacros,
        todayRemainingMacros,
        pendingProposals,
        recentAgentActions,
        measuredImpact,
        activeMessages,
        allMessages,
        weeklySmoothingEnabled,
        toggleWeeklySmoothing,
        weeklyRebalanceInfo,
        selectedPlanDayOffset,
        setSelectedPlanDayOffset,
        setActiveMember,
        selectMemberAndEnter,
        addNewMember,
        setActiveTab,
        logMeal,
        logCustomMeal,
        deleteLog,
        replaceMeal,
        replaceMealSlot,
        addExtraMeal,
        confirmAddMeal,
        sendMemberMessage,
        sendCoachReply,
        adaptDailyPlan,
        approveProposal,
        rejectProposal,
        updateGymAssumptions,
        askAgent,
        resetDemo,
      }}
    >
      {children}
    </NutriCoachContext.Provider>
  );
}


export function useNutriCoach() {
  const context = useContext(NutriCoachContext);
  if (!context) throw new Error("useNutriCoach must be used within NutriCoachProvider");
  return context;
}
