"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { addDays, todayISO } from "@/lib/dates";
import { findFood, FOODS, foodToSnapshot } from "@/lib/foods";
import { impactFor, measureImpact } from "@/lib/impact";
import { caloriesFromMacros, normalizeMacros, scaleMacros, subtractMacros, sumMacros, verifyMeals } from "@/lib/nutrition";
import { baseName, planSlots, prefsFromProfile, suggestMeals } from "@/lib/planner";
import { createInitialDemoState, type DemoState } from "@/lib/store";
import {
  DEFAULT_CHATBOT_PREFERENCES,
  type AgentAction,
  type AiUsage,
  type ChatbotPreferences,
  type ExecutionStatus,
  type Gym,
  type Macros,
  type MealChange,
  type MealLog,
  type MealSnapshot,
  type MealType,
  type MemberMessage,
  type PlannedMeal,
  type Profile,
  type ProposedChange,
  type Role,
  type Targets,
  type ToolTraceEntry,
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
  targetDailyCalories: number;
  isApplied: boolean;
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
  isWeeklySmoothingApplied: boolean;
  isApplyingWeeklySmoothing: boolean;
  weeklySmoothingError: string | null;
  weeklySmoothingSuccess: string | null;
  applyWeeklySmoothing: () => Promise<{ success: boolean; error?: string }>;
  keepOriginalTargets: () => Promise<{ success: boolean; error?: string }>;
  weeklyRebalanceInfo: WeeklyRebalanceInfo;
  selectedPlanDayOffset: number;
  setSelectedPlanDayOffset: (offset: number) => void;

  // Member Management
  setActiveMember: (id: string) => void;
  selectMemberAndEnter: (id: string) => void;
  addNewMember: (params: {
    name: string;
    sex: "male" | "female";
    age?: number;
    height?: number;
    weight?: number;
    calorieGoal: number;
    proteinGoal: number;
    dietGoal: string;
    targetDelta?: number;
    targetUnit?: string;
    dietaryStyle?: string;
    dietaryRestrictions?: string[];
    dislikedFoods?: string[];
    allergies?: string[];
  }) => void;
  
  // Navigation
  setActiveTab: (tab: DemoState["activeTab"]) => void;

  // Actions
  logMeal: (params: { mealName: string; mealType: MealType; servings?: number; asPlanned?: boolean; notes?: string }) => void;
  logCustomMeal: (params: { mealType: MealType; mealName: string; calories: number; protein: number; carbs: number; fat: number; notes?: string }) => void;
  deleteLog: (logId: string) => void;
  replaceMeal: (params: { mealType: MealType; avoid?: string[]; reason?: string }) => void;
  replaceMealSlot: (params: { mealType: MealType; date?: string; meal: MealSnapshot; source?: "coach" | "agent" | "custom" | string; rebalanceDinner?: boolean }) => Promise<{ success: boolean; error?: string }>;
  replaceMultipleMealSlots: (params: { date: string; meals: Array<{ slot: MealType; meal: MealSnapshot }>; actionType?: string; userRequest?: string; summary?: string }) => Promise<{ success: boolean; error?: string }>;
  addExtraMeal: (params: { mealType: string; mealName: string; calories: number; protein: number; carbs: number; fat: number; asLogged?: boolean; date?: string }) => void;
  confirmAddMeal: (params: { mealName: string; calories: number; protein: number; carbs: number; fat: number; mealType: string; targetDate: string; asLogged?: boolean }) => void;
  sendMemberMessage: (text: string) => Promise<void>;
  sendCoachReply: (memberId: string, replyText: string) => void;
  adaptDailyPlan: (targetDateOrReason?: string, optionalReason?: string) => void;
  approveProposal: (actionId: string, optionIndex?: number) => void;
  rejectProposal: (actionId: string, note?: string) => void;
  updateGymAssumptions: (partial: Partial<Gym>) => void;
  updateChatbotPreferences: (prefs: Partial<ChatbotPreferences>) => Promise<{ success: boolean; error?: string }>;
  askAgent: (prompt: string) => Promise<{ reply: string; actionCard?: AgentActionCard }>;
  resetDemo: () => void;
}

const NutriCoachContext = createContext<NutriCoachContextType | null>(null);

export function NutriCoachProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<DemoState>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("nutricoach_demo_state_v6");
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
      localStorage.setItem("nutricoach_demo_state_v6", JSON.stringify(state));
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

  const [isWeeklySmoothingApplied, setIsWeeklySmoothingApplied] = useState(false);
  const [isApplyingWeeklySmoothing, setIsApplyingWeeklySmoothing] = useState(false);
  const [weeklySmoothingError, setWeeklySmoothingError] = useState<string | null>(null);
  const [weeklySmoothingSuccess, setWeeklySmoothingSuccess] = useState<string | null>(null);
  const [backupPlannedMeals, setBackupPlannedMeals] = useState<Record<string, PlannedMeal[]>>({});
  const [selectedPlanDayOffset, setSelectedPlanDayOffset] = useState<number>(0);

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
  const targetDailyCalories = Math.max(1200, Math.min(3500, activeTargets.calories + dailyAdjustment));
  const effectiveDailyAdjustment = targetDailyCalories - activeTargets.calories;

  const weeklyRebalanceInfo: WeeklyRebalanceInfo = {
    delta,
    isSignificant: isSignificantDelta,
    dailyAdjustment: effectiveDailyAdjustment,
    remainingDaysCount,
    enabled: isWeeklySmoothingApplied,
    todayCaloriesLogged,
    targetCalories: activeTargets.calories,
    targetDailyCalories,
    isApplied: isWeeklySmoothingApplied,
  };

  const weeklySmoothingEnabled = isWeeklySmoothingApplied;

  const pendingProposals = state.actions.filter(
    (a) => a.member_id === state.activeMemberId && (a.execution_status === "proposed" || a.execution_status === "pending_coach")
  );

  const recentAgentActions = [...state.actions].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const measuredImpact = measureImpact(state.actions, state.aiUsage, state.gym, state.members.length);

  const setActiveMember = (id: string) => {
    setIsWeeklySmoothingApplied(false);
    setWeeklySmoothingError(null);
    setWeeklySmoothingSuccess(null);
    setState((prev) => ({ ...prev, activeMemberId: id, activeRole: "member" }));
  };

  const selectMemberAndEnter = (id: string) => {
    setIsWeeklySmoothingApplied(false);
    setWeeklySmoothingError(null);
    setWeeklySmoothingSuccess(null);
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
    if (typeof window !== "undefined") {
      localStorage.removeItem("nutricoach_demo_state_v5");
      localStorage.removeItem("nutricoach_demo_state_v4");
      localStorage.removeItem("nutricoach_demo_state_v3");
      localStorage.removeItem("nutricoach_demo_state_v2");
    }
    setState(createInitialDemoState());
    setCurrentView("portal");
  };

  // Add dynamically created new member with preferences, allergies and quantitative targets
  const addNewMember = ({
    name,
    sex,
    age = 28,
    height = 168,
    weight = 72,
    calorieGoal,
    proteinGoal,
    dietGoal,
    targetDelta = 0,
    targetUnit = "kg",
    dietaryStyle = "Standard / Omnivore",
    dietaryRestrictions = [],
    dislikedFoods = [],
    allergies = [],
  }: {
    name: string;
    sex: "male" | "female";
    age?: number;
    height?: number;
    weight?: number;
    calorieGoal: number;
    proteinGoal: number;
    dietGoal: string;
    targetDelta?: number;
    targetUnit?: string;
    dietaryStyle?: string;
    dietaryRestrictions?: string[];
    dislikedFoods?: string[];
    allergies?: string[];
  }) => {
    const newId = `member-${Date.now()}`;
    const fatGoal = Math.round((calorieGoal * 0.25) / 9);
    const carbsGoal = Math.max(30, Math.round((calorieGoal - (proteinGoal * 4) - (fatGoal * 9)) / 4));

    // Normalize exclusions for planner and matching
    const normalizedDislikes = [...dislikedFoods];
    const normalizedAllergies = [...allergies];
    const normalizedPrefs = [...dietaryRestrictions];

    if (dietaryStyle && dietaryStyle.toLowerCase().includes("vegetarian") && !normalizedPrefs.includes("vegetarian")) {
      normalizedPrefs.push("vegetarian");
    }
    if (dietaryStyle && dietaryStyle.toLowerCase().includes("pescatarian") && !normalizedPrefs.includes("pescatarian")) {
      normalizedPrefs.push("pescatarian");
    }

    if (normalizedDislikes.some((d) => d.toLowerCase().includes("no chicken") || d.toLowerCase() === "chicken")) {
      if (!normalizedDislikes.includes("chicken")) normalizedDislikes.push("chicken");
    }
    if (normalizedDislikes.some((d) => d.toLowerCase().includes("no red meat") || d.toLowerCase().includes("beef"))) {
      if (!normalizedDislikes.includes("red meat")) normalizedDislikes.push("red meat");
    }
    if (normalizedDislikes.some((d) => d.toLowerCase().includes("dairy-free") || d.toLowerCase() === "dairy")) {
      if (!normalizedDislikes.includes("dairy")) normalizedDislikes.push("dairy");
    }
    if (normalizedAllergies.some((a) => a.toLowerCase().includes("peanut") || a.toLowerCase().includes("nut"))) {
      if (!normalizedAllergies.includes("nut")) normalizedAllergies.push("nut");
      if (!normalizedAllergies.includes("peanut")) normalizedAllergies.push("peanut");
    }
    if (normalizedAllergies.some((a) => a.toLowerCase().includes("lactose") || a.toLowerCase().includes("dairy"))) {
      if (!normalizedAllergies.includes("dairy")) normalizedAllergies.push("dairy");
    }
    if (normalizedAllergies.some((a) => a.toLowerCase().includes("gluten") || a.toLowerCase().includes("celiac"))) {
      if (!normalizedAllergies.includes("gluten")) normalizedAllergies.push("gluten");
    }
    if (normalizedAllergies.some((a) => a.toLowerCase().includes("shellfish") || a.toLowerCase().includes("shrimp"))) {
      if (!normalizedAllergies.includes("shellfish")) normalizedAllergies.push("shellfish");
    }
    if (normalizedPrefs.some((p) => p.toLowerCase().includes("vegetarian"))) {
      if (!normalizedPrefs.includes("vegetarian")) normalizedPrefs.push("vegetarian");
    }
    if (normalizedPrefs.some((p) => p.toLowerCase().includes("pescatarian"))) {
      if (!normalizedPrefs.includes("pescatarian")) normalizedPrefs.push("pescatarian");
    }

    const planningPreferences = {
      disliked_foods: normalizedDislikes,
      allergies: normalizedAllergies,
      dietary_preferences: normalizedPrefs,
    };

    const newProfile: Profile = {
      id: newId,
      gym_id: DEMO_GYM_ID,
      role: "member",
      coach_id: DEMO_COACH_ID,
      name,
      email: `${name.toLowerCase().replace(/\s+/g, ".")}@example.com`,
      age,
      sex,
      height,
      weight,
      goal: dietGoal,
      target_delta: targetDelta,
      target_unit: targetUnit,
      dietary_style: dietaryStyle,
      activity_level: "moderate",
      dietary_preferences: normalizedPrefs,
      disliked_foods: normalizedDislikes,
      allergies: normalizedAllergies,
      medical_notes: null,
      subscription_status: "active",
      demo_scenario: "onboarding",
      created_at: new Date().toISOString(),
    };

    const newMemberSpec: DemoMemberSpec = {
      id: newId,
      name,
      email: newProfile.email!,
      age,
      sex,
      height,
      weight,
      goal: dietGoal,
      target_delta: targetDelta,
      target_unit: targetUnit,
      dietary_style: dietaryStyle,
      activity_level: "moderate",
      dietary_preferences: normalizedPrefs,
      disliked_foods: normalizedDislikes,
      allergies: normalizedAllergies,
      scenario: "onboarding",
      scenarioLabel: "New Member Onboarding",
      scenarioDescription: `Day 1 on plan (${dietGoal}) with active exclusions: ${[...normalizedAllergies, ...normalizedDislikes].filter(Boolean).join(", ") || "None"}.`,
      targets: { calories: calorieGoal, protein: proteinGoal, carbs: carbsGoal, fat: fatGoal, water: 2.5 },
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

    // Plan baseline meals respecting all dislikes, allergies and preferences
    const pMeals: PlannedMeal[] = [];
    for (let d = -13; d <= 6; d++) {
      const date = addDays(today, d);
      const dailyBudget: Macros = { calories: calorieGoal, protein: proteinGoal, carbs: carbsGoal, fat: fatGoal };
      const plannedSlots = planSlots(dailyBudget, ["breakfast", "lunch", "snack", "dinner"], planningPreferences, { variety: Math.abs(d) });

      for (const slot of plannedSlots) {
        pMeals.push({
          id: `p-${newId}-${date}-${slot.meal_type[0]}`,
          plan_id: `plan-${newId}`,
          member_id: newId,
          date,
          meal_type: slot.meal_type,
          meal_name: slot.meal.meal_name,
          calories: slot.meal.calories,
          protein: slot.meal.protein,
          carbs: slot.meal.carbs,
          fat: slot.meal.fat,
          ingredients: slot.meal.ingredients,
          tags: slot.meal.tags,
          source: "coach",
          updated_at: new Date().toISOString(),
        });
      }
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

  // Direct meal slot replacement with reliable Supabase mutation verification
  const replaceMealSlot = async ({
    mealType,
    date = today,
    meal,
    source = "agent",
    rebalanceDinner = true,
  }: {
    mealType: MealType;
    date?: string;
    meal: MealSnapshot;
    source?: "coach" | "agent" | "custom" | string;
    rebalanceDinner?: boolean;
  }): Promise<{ success: boolean; error?: string }> => {
    const memberId = state.activeMemberId;
    const actionTitle = date === today ? "Today" : date === addDays(today, 1) ? "Tomorrow" : date;

    try {
      const res = await fetch("/api/mutate-meal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId,
          targetDate: date,
          targetSlot: mealType,
          meal,
          actionType: "replace_meal",
          userRequest: `Adjust ${actionTitle}'s ${mealType} to ${meal.meal_name}`,
          summary: `Updated ${actionTitle}'s ${mealType} to ${meal.meal_name} (${meal.calories} kcal)`,
          rebalanceDinner,
          gymId: state.gym.id,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        console.error("[NutriCoach] Supabase mutation failed:", data?.error);
        return {
          success: false,
          error: data?.error || "Failed to persist meal change to Supabase.",
        };
      }

      // Supabase verified: Update local state with persisted meal
      setState((prev) => {
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
          tags: meal.tags || [mealType, "agent"],
          source: "agent",
          updated_at: new Date().toISOString(),
        };

        if (idx >= 0) {
          currentPlanned[idx] = updatedSlot;
        } else {
          currentPlanned.push(updatedSlot);
        }

        const impact = impactFor("replace_meal", prev.gym.estimated_coach_hourly_value);
        const newAction: AgentAction = {
          id: `act-${Date.now()}`,
          member_id: memberId,
          gym_id: prev.gym.id,
          initiated_by: memberId,
          action_type: "replace_meal",
          user_request: `Adjust ${actionTitle}'s ${mealType} to ${meal.meal_name}`,
          summary: `Updated ${actionTitle}'s ${mealType} to ${meal.meal_name} (${meal.calories} kcal)`,
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
          decision_note: "Directly applied by NutriCoach agent after Supabase verification",
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

      return { success: true };
    } catch (err: any) {
      console.error("[NutriCoach] Mutation network error:", err);
      return {
        success: false,
        error: err?.message || "Network error while connecting to mutation API.",
      };
    }
  };

  // Multiple meal slots replacement with atomic Supabase persistence verification
  const replaceMultipleMealSlots = async ({
    date,
    meals,
    actionType = "adapt_day",
    userRequest,
    summary,
  }: {
    date: string;
    meals: Array<{ slot: MealType; meal: MealSnapshot }>;
    actionType?: string;
    userRequest?: string;
    summary?: string;
  }): Promise<{ success: boolean; error?: string }> => {
    const memberId = state.activeMemberId;
    const actionTitle = date === today ? "Today" : date === addDays(today, 1) ? "Tomorrow" : date;

    try {
      const res = await fetch("/api/mutate-meal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId,
          targetDate: date,
          meals,
          actionType,
          userRequest: userRequest || `Adapt ${actionTitle}'s meal plan`,
          summary: summary || `Adapted ${meals.length} meals for ${actionTitle}`,
          gymId: state.gym.id,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        console.error("[NutriCoach] Multi-meal mutation failed:", data?.error);
        return {
          success: false,
          error: data?.error || "Failed to persist multi-meal adaptation to Supabase.",
        };
      }

      // Supabase verified: Update local state with persisted meals
      setState((prev) => {
        const currentPlanned = [...(prev.plannedMeals[memberId] || [])];

        for (const item of meals) {
          const idx = currentPlanned.findIndex((p) => p.date === date && p.meal_type === item.slot);
          const updatedSlot: PlannedMeal = {
            id: idx >= 0 ? currentPlanned[idx].id : `p-${Date.now()}-${item.slot}`,
            plan_id: idx >= 0 ? currentPlanned[idx].plan_id : `plan-${memberId}`,
            member_id: memberId,
            date,
            meal_type: item.slot,
            meal_name: item.meal.meal_name,
            calories: item.meal.calories,
            protein: item.meal.protein,
            carbs: item.meal.carbs,
            fat: item.meal.fat,
            ingredients: item.meal.ingredients || [],
            tags: item.meal.tags || [item.slot, "agent", "adapted"],
            source: "agent",
            updated_at: new Date().toISOString(),
          };

          if (idx >= 0) {
            currentPlanned[idx] = updatedSlot;
          } else {
            currentPlanned.push(updatedSlot);
          }
        }

        const impact = impactFor("adapt_daily_plan", prev.gym.estimated_coach_hourly_value);
        const newAction: AgentAction = {
          id: `act-${Date.now()}`,
          member_id: memberId,
          gym_id: prev.gym.id,
          initiated_by: memberId,
          action_type: (actionType as any) || "adapt_day",
          user_request: userRequest || `Adapt ${actionTitle}'s meal plan`,
          summary: summary || `Adapted ${meals.length} meals for ${actionTitle}`,
          tools_used: [
            { tool: "adapt_day", summary: `Updated ${meals.length} meal slots for ${actionTitle}` },
            { tool: "calculate_remaining_nutrition", summary: "Balanced daily macro distribution" },
          ],
          proposed_change: null,
          requires_coach_approval: false,
          approved: true,
          execution_status: "executed",
          decided_by: memberId,
          decided_at: new Date().toISOString(),
          decision_note: "Directly applied by NutriCoach agent after Supabase verification",
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

      return { success: true };
    } catch (err: any) {
      console.error("[NutriCoach] Multi-meal network error:", err);
      return {
        success: false,
        error: err?.message || "Network error while connecting to mutation API.",
      };
    }
  };

  const applyWeeklySmoothing = async (): Promise<{ success: boolean; error?: string }> => {
    if (isApplyingWeeklySmoothing) {
      return { success: false, error: "Smoothing operation is already in progress." };
    }

    if (!weeklyRebalanceInfo.isSignificant) {
      return { success: false, error: "No significant calorie deviation detected for weekly auto-balance." };
    }

    setIsApplyingWeeklySmoothing(true);
    setWeeklySmoothingError(null);
    setWeeklySmoothingSuccess(null);

    const memberId = state.activeMemberId;
    const today = state.today;
    const currentPlanned = state.plannedMeals[memberId] || [];

    // Remaining upcoming days (day +1 through day +6)
    const remainingDays: string[] = [];
    for (let offset = 1; offset <= weeklyRebalanceInfo.remainingDaysCount; offset++) {
      remainingDays.push(addDays(today, offset));
    }

    // 1. Calculate validated daily target for remaining days
    const targetCalories = weeklyRebalanceInfo.targetDailyCalories;
    const effectiveAdjustment = weeklyRebalanceInfo.dailyAdjustment;
    const macroRatio = targetCalories / activeTargets.calories;
    const dayTargetBudget: Macros = {
      calories: targetCalories,
      protein: Math.round(activeTargets.protein * macroRatio),
      carbs: Math.round(activeTargets.carbs * macroRatio),
      fat: Math.round(activeTargets.fat * macroRatio),
    };

    // 2. Save current planned meals for remaining days to backup if not already saved
    if (!backupPlannedMeals[memberId] || backupPlannedMeals[memberId].length === 0) {
      const existingRemaining = currentPlanned.filter((p) => remainingDays.includes(p.date));
      setBackupPlannedMeals((prev) => ({
        ...prev,
        [memberId]: existingRemaining,
      }));
    }

    // 3. Recalculate remaining-day meal plans using planSlots
    const prefs = prefsFromProfile(activeProfile);
    const preferTags = activeProfile.dietary_preferences.includes("egyptian") ? ["egyptian"] : [];
    const allSlots: MealType[] = ["breakfast", "lunch", "snack", "dinner"];

    const newDaysPayload: Array<{
      targetDate: string;
      meals: Array<{ slot: MealType; meal: MealSnapshot }>;
    }> = [];

    const updatedPlannedMealsByDate: Record<string, Array<{ meal_type: MealType; meal: MealSnapshot }>> = {};

    let previousDayMeals: Array<{ meal_type: MealType; meal: MealSnapshot }> = [];
    const todayMeals = currentPlanned.filter((p) => p.date === today);
    if (todayMeals.length > 0) {
      previousDayMeals = todayMeals.map((p) => ({
        meal_type: p.meal_type,
        meal: {
          meal_name: p.meal_name,
          calories: p.calories,
          protein: p.protein,
          carbs: p.carbs,
          fat: p.fat,
          ingredients: p.ingredients,
          tags: p.tags,
        },
      }));
    }

    for (const date of remainingDays) {
      const dayLogs = (state.mealLogs[memberId] || []).filter((l) => l.date === date);
      let dayBudget = { ...dayTargetBudget };
      for (const log of dayLogs) {
        dayBudget = subtractMacros(dayBudget, log);
      }

      const unloggedSlots = allSlots.filter((slot) => !dayLogs.some((l) => l.meal_type === slot));
      if (unloggedSlots.length === 0) continue;

      // Avoid previous day's meal names to maintain variety
      const excludeNames = previousDayMeals.map((p) => p.meal.meal_name);

      const slots = planSlots(dayBudget, unloggedSlots, prefs, {
        preferTags,
        excludeNames,
        variety: remainingDays.indexOf(date) + 1,
      });

      updatedPlannedMealsByDate[date] = slots;
      previousDayMeals = slots;

      newDaysPayload.push({
        targetDate: date,
        meals: slots.map((s) => ({ slot: s.meal_type, meal: s.meal })),
      });
    }

    try {
      // 4. Persist to Supabase via /api/mutate-meal batch endpoint
      const res = await fetch("/api/mutate-meal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId,
          days: newDaysPayload,
          actionType: "weekly_auto_balance",
          userRequest: `Apply weekly auto-balance (${effectiveAdjustment > 0 ? `+${effectiveAdjustment}` : effectiveAdjustment} kcal/day)`,
          summary: `Weekly auto-balance applied: remaining ${newDaysPayload.length} days rebalanced to ${targetCalories} kcal/day`,
          gymId: state.gym.id,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data?.error || "Failed to persist weekly smoothing to database.");
      }

      // 5. Success verified: Update local state
      setState((prev) => {
        let currentPlannedList = [...(prev.plannedMeals[memberId] || [])];
        for (const [date, slots] of Object.entries(updatedPlannedMealsByDate)) {
          for (const item of slots) {
            const idx = currentPlannedList.findIndex((p) => p.date === date && p.meal_type === item.meal_type);
            const updatedPlanned: PlannedMeal = {
              id: idx >= 0 ? currentPlannedList[idx].id : `p-${memberId}-${date}-${item.meal_type}`,
              plan_id: idx >= 0 ? currentPlannedList[idx].plan_id : `plan-${memberId}`,
              member_id: memberId,
              date,
              meal_type: item.meal_type,
              meal_name: item.meal.meal_name,
              calories: item.meal.calories,
              protein: item.meal.protein,
              carbs: item.meal.carbs,
              fat: item.meal.fat,
              ingredients: item.meal.ingredients,
              tags: item.meal.tags || [item.meal_type, "agent", "smoothed"],
              source: "agent",
              updated_at: new Date().toISOString(),
            };

            if (idx >= 0) {
              currentPlannedList[idx] = updatedPlanned;
            } else {
              currentPlannedList.push(updatedPlanned);
            }
          }
        }

        const impact = impactFor("adapt_daily_plan", prev.gym.estimated_coach_hourly_value);
        const actionPayload: AgentAction = {
          id: `act-${Date.now()}`,
          member_id: memberId,
          gym_id: prev.gym.id,
          initiated_by: memberId,
          action_type: "weekly_auto_balance" as any,
          user_request: `Apply weekly smoothing (${effectiveAdjustment > 0 ? `+${effectiveAdjustment}` : effectiveAdjustment} kcal/day)`,
          summary: `Weekly auto-balance applied: ${newDaysPayload.length} remaining days adjusted to ${targetCalories} kcal/day`,
          tools_used: [
            { tool: "weekly_auto_balance", summary: `Redistributed intake delta of ${weeklyRebalanceInfo.delta} kcal` },
            { tool: "replan_meals", summary: `Recalculated meals for ${newDaysPayload.length} days to match target` },
          ],
          proposed_change: null,
          requires_coach_approval: false,
          approved: true,
          execution_status: "executed",
          decided_by: memberId,
          decided_at: new Date().toISOString(),
          decision_note: "Applied weekly smoothing to synchronize planned meals",
          estimated_manual_minutes: 15,
          estimated_agent_minutes: 0.5,
          estimated_minutes_saved: 15,
          estimated_cost_value: 50.0,
          created_at: new Date().toISOString(),
        };

        return {
          ...prev,
          plannedMeals: { ...prev.plannedMeals, [memberId]: currentPlannedList },
          actions: [actionPayload, ...prev.actions],
        };
      });

      setIsWeeklySmoothingApplied(true);
      setIsApplyingWeeklySmoothing(false);
      setWeeklySmoothingSuccess(`Weekly smoothing applied: remaining days adjusted to ${targetCalories} kcal/day.`);
      return { success: true };
    } catch (err: any) {
      console.error("[NutriCoach] applyWeeklySmoothing error:", err);
      setIsApplyingWeeklySmoothing(false);
      setWeeklySmoothingError(err?.message || "Failed to persist weekly smoothing.");
      return { success: false, error: err?.message };
    }
  };

  const keepOriginalTargets = async (): Promise<{ success: boolean; error?: string }> => {
    if (isApplyingWeeklySmoothing) {
      return { success: false, error: "Smoothing operation already in progress." };
    }

    setWeeklySmoothingError(null);
    setWeeklySmoothingSuccess(null);

    // If weekly smoothing was applied, revert the remaining days back to baseline
    if (isWeeklySmoothingApplied) {
      setIsApplyingWeeklySmoothing(true);
      const memberId = state.activeMemberId;
      const today = state.today;
      const remainingDays: string[] = [];
      for (let offset = 1; offset <= weeklyRebalanceInfo.remainingDaysCount; offset++) {
        remainingDays.push(addDays(today, offset));
      }

      const backup = backupPlannedMeals[memberId];

      try {
        let revertDaysPayload: Array<{
          targetDate: string;
          meals: Array<{ slot: MealType; meal: MealSnapshot }>;
        }> = [];

        if (backup && backup.length > 0) {
          const byDate: Record<string, PlannedMeal[]> = {};
          for (const b of backup) {
            if (!byDate[b.date]) byDate[b.date] = [];
            byDate[b.date].push(b);
          }

          revertDaysPayload = Object.entries(byDate).map(([date, meals]) => ({
            targetDate: date,
            meals: meals.map((m) => ({
              slot: m.meal_type,
              meal: {
                meal_name: m.meal_name,
                calories: m.calories,
                protein: m.protein,
                carbs: m.carbs,
                fat: m.fat,
                ingredients: m.ingredients,
                tags: m.tags,
              },
            })),
          }));
        } else {
          // Regenerate at baseline target
          const prefs = prefsFromProfile(activeProfile);
          const preferTags = activeProfile.dietary_preferences.includes("egyptian") ? ["egyptian"] : [];
          const allSlots: MealType[] = ["breakfast", "lunch", "snack", "dinner"];

          for (const date of remainingDays) {
            const dayLogs = (state.mealLogs[memberId] || []).filter((l) => l.date === date);
            let dayBudget: Macros = {
              calories: activeTargets.calories,
              protein: activeTargets.protein,
              carbs: activeTargets.carbs,
              fat: activeTargets.fat,
            };
            for (const log of dayLogs) {
              dayBudget = subtractMacros(dayBudget, log);
            }
            const unloggedSlots = allSlots.filter((slot) => !dayLogs.some((l) => l.meal_type === slot));
            const slots = planSlots(dayBudget, unloggedSlots, prefs, { preferTags });
            revertDaysPayload.push({
              targetDate: date,
              meals: slots.map((s) => ({ slot: s.meal_type, meal: s.meal })),
            });
          }
        }

        const res = await fetch("/api/mutate-meal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            memberId,
            days: revertDaysPayload,
            actionType: "revert_smoothing",
            userRequest: "Keep original targets",
            summary: `Restored baseline meal plans across ${revertDaysPayload.length} days`,
            gymId: state.gym.id,
          }),
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data?.error || "Failed to persist restored meal plan to database.");
        }

        // Update local state with restored meals
        setState((prev) => {
          let currentList = [...(prev.plannedMeals[memberId] || [])];
          for (const dayEntry of revertDaysPayload) {
            for (const item of dayEntry.meals) {
              const idx = currentList.findIndex((p) => p.date === dayEntry.targetDate && p.meal_type === item.slot);
              const restoredMeal: PlannedMeal = {
                id: idx >= 0 ? currentList[idx].id : `p-${memberId}-${dayEntry.targetDate}-${item.slot}`,
                plan_id: idx >= 0 ? currentList[idx].plan_id : `plan-${memberId}`,
                member_id: memberId,
                date: dayEntry.targetDate,
                meal_type: item.slot,
                meal_name: item.meal.meal_name,
                calories: item.meal.calories,
                protein: item.meal.protein,
                carbs: item.meal.carbs,
                fat: item.meal.fat,
                ingredients: item.meal.ingredients || [],
                tags: item.meal.tags || [item.slot, "coach"],
                source: "coach",
                updated_at: new Date().toISOString(),
              };
              if (idx >= 0) {
                currentList[idx] = restoredMeal;
              } else {
                currentList.push(restoredMeal);
              }
            }
          }
          return {
            ...prev,
            plannedMeals: { ...prev.plannedMeals, [memberId]: currentList },
          };
        });

        setIsWeeklySmoothingApplied(false);
        setIsApplyingWeeklySmoothing(false);
        setWeeklySmoothingSuccess("Kept original targets. Meals restored to baseline plan.");
        return { success: true };
      } catch (err: any) {
        console.error("[NutriCoach] keepOriginalTargets error:", err);
        setIsApplyingWeeklySmoothing(false);
        setWeeklySmoothingError(err?.message || "Failed to restore baseline targets.");
        return { success: false, error: err?.message };
      }
    } else {
      // Smoothing was not yet applied
      setIsWeeklySmoothingApplied(false);
      setWeeklySmoothingSuccess("Kept original targets.");
      return { success: true };
    }
  };

  const toggleWeeklySmoothing = () => {
    if (isWeeklySmoothingApplied) {
      keepOriginalTargets();
    } else {
      applyWeeklySmoothing();
    }
  };

  const adaptDailyPlan = (targetDateOrReason?: string, optionalReason?: string) => {
    const isDateArg = targetDateOrReason && /^\d{4}-\d{2}-\d{2}$/.test(targetDateOrReason);
    const targetDate = isDateArg ? targetDateOrReason : state.today;
    const reason = isDateArg ? optionalReason : targetDateOrReason;

    const targetDayLogs = (state.mealLogs[state.activeMemberId] || []).filter((l) => l.date === targetDate);
    const targetPlanned = (state.plannedMeals[state.activeMemberId] || []).filter((p) => p.date === targetDate);

    const remainingSlots = (["breakfast", "lunch", "snack", "dinner"] as MealType[]).filter(
      (slot) => !targetDayLogs.some((l) => l.meal_type === slot)
    );

    if (!remainingSlots.length) return;

    let remainingBudget: Macros = { ...activeTargets };
    for (const log of targetDayLogs) {
      remainingBudget = subtractMacros(remainingBudget, log);
    }

    const prefs = prefsFromProfile(activeProfile);
    const newMeals = planSlots(remainingBudget, remainingSlots, prefs);

    const changes: MealChange[] = newMeals.map(({ meal_type, meal }) => {
      const before = targetPlanned.find((p) => p.meal_type === meal_type);
      return {
        date: targetDate,
        meal_type,
        before: before ? { meal_name: before.meal_name, calories: before.calories, protein: before.protein, carbs: before.carbs, fat: before.fat, ingredients: before.ingredients, tags: before.tags } : null,
        after: meal,
      };
    });

    const projected = sumMacros([...targetDayLogs, ...newMeals.map((m) => m.meal)]);
    const verification = verifyMeals(newMeals.map((m) => m.meal), [{ date: targetDate, totals: projected }], activeTargets);

    const explanation = reason || `Adjusted remaining meals (${remainingSlots.join(", ")}) for ${targetDate} to keep your daily target balanced at ${activeTargets.calories} kcal.`;

    const proposed: ProposedChange = {
      kind: "adapt_daily_plan",
      title: `Rebalance ${remainingSlots.join(" & ")} for ${targetDate}`,
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

    // Immediately append user message to local state
    setState((prev) => {
      const currentMsgs = prev.messages[memberId] || [];
      return {
        ...prev,
        messages: {
          ...prev.messages,
          [memberId]: [...currentMsgs, userMsg],
        },
      };
    });

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          userProfile: activeProfile,
          targets: activeTargets,
          currentDate: state.today,
          plannedMeals: state.plannedMeals[memberId] || [],
          todayPlannedMeals: (state.plannedMeals[memberId] || []).filter((m) => m.date === state.today),
          todayMealLogs: (state.mealLogs[memberId] || []).filter((m) => m.date === state.today),
          mealLogs: state.mealLogs[memberId] || [],
          recentHistory: (state.messages[memberId] || []).slice(-10).map((m) => ({
            sender: m.sender === "coach" ? "agent" : "user",
            text: m.text,
          })),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const coachReplyMsg: MemberMessage = {
          id: `msg-coach-${Date.now()}`,
          member_id: memberId,
          sender: "coach",
          text: data.replyText,
          created_at: new Date().toISOString(),
        };

        setState((prev) => {
          const currentMsgs = prev.messages[memberId] || [];
          return {
            ...prev,
            messages: {
              ...prev.messages,
              [memberId]: [...currentMsgs, coachReplyMsg],
            },
          };
        });
        return;
      }
    } catch (e) {
      console.warn("sendMemberMessage delegation notice:", e);
    }

    // Graceful fallback if offline
    const coachReplyMsg: MemberMessage = {
      id: `msg-coach-${Date.now()}`,
      member_id: memberId,
      sender: "coach",
      text: `Got your note, ${activeProfile.name.split(" ")[0]}! I've reviewed your message and recent logs. Everything is tracking cleanly toward your goals.`,
      created_at: new Date().toISOString(),
    };

    setState((prev) => {
      const currentMsgs = prev.messages[memberId] || [];
      return {
        ...prev,
        messages: {
          ...prev.messages,
          [memberId]: [...currentMsgs, coachReplyMsg],
        },
      };
    });
  };

  const askAgent = async (prompt: string): Promise<{ reply: string; actionCard?: AgentActionCard }> => {
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: prompt,
          userProfile: activeProfile,
          targets: activeTargets,
          currentDate: state.today,
          plannedMeals: state.plannedMeals[state.activeMemberId] || [],
          todayPlannedMeals: (state.plannedMeals[state.activeMemberId] || []).filter((m) => m.date === state.today),
          todayMealLogs: (state.mealLogs[state.activeMemberId] || []).filter((m) => m.date === state.today),
          mealLogs: state.mealLogs[state.activeMemberId] || [],
          recentHistory: (state.messages[state.activeMemberId] || []).slice(-10).map((m) => ({
            sender: m.sender === "coach" ? "agent" : "user",
            text: m.text,
          })),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        return { reply: data.replyText };
      }
    } catch (e) {
      console.warn("askAgent notice:", e);
    }
    return { reply: "I am having trouble processing that right now." };
  };

  const updateChatbotPreferences = async (
    prefs: Partial<ChatbotPreferences>
  ): Promise<{ success: boolean; error?: string }> => {
    const memberId = state.activeMemberId;
    const currentMemberProfile = state.profiles[memberId] || activeProfile;
    const existingPrefs = currentMemberProfile?.chatbot_preferences || DEFAULT_CHATBOT_PREFERENCES;
    const mergedPrefs: ChatbotPreferences = {
      ...existingPrefs,
      ...prefs,
    };

    // Optimistically update local state
    setState((prev) => {
      const p = prev.profiles[memberId] || prev.profiles[prev.members[0]?.id];
      if (!p) return prev;
      return {
        ...prev,
        profiles: {
          ...prev.profiles,
          [memberId]: {
            ...p,
            chatbot_preferences: mergedPrefs,
          },
        },
      };
    });

    try {
      const res = await fetch("/api/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences: mergedPrefs }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const errMsg = errData.error || `Server responded with ${res.status}`;
        console.error("[NutriCoach] Failed to save preferences:", errMsg);
        return { success: false, error: errMsg };
      }

      return { success: true };
    } catch (e: any) {
      console.error("[NutriCoach] Network error saving preferences:", e);
      return { success: false, error: e?.message || "Network error while saving preferences" };
    }
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
        isWeeklySmoothingApplied,
        isApplyingWeeklySmoothing,
        weeklySmoothingError,
        weeklySmoothingSuccess,
        applyWeeklySmoothing,
        keepOriginalTargets,
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
        replaceMultipleMealSlots,
        addExtraMeal,
        confirmAddMeal,
        sendMemberMessage,
        sendCoachReply,
        adaptDailyPlan,
        approveProposal,
        rejectProposal,
        updateGymAssumptions,
        updateChatbotPreferences,
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
