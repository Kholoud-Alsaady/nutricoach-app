// =============================================================================
// Agent tools
// -----------------------------------------------------------------------------
// Every capability of the Adaptive Nutrition Agent is an explicit tool here.
// =============================================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import { analyzeProgress, type ProgressAnalysis } from "../analysis";
import { addDays, cairoHour, relativeDay } from "../dates";
import { findFood, foodToSnapshot, searchFoods } from "../foods";
import { impactFor } from "../impact";
import { checkMeal, normalizeMacros, pctDiff, pctOf, subtractMacros, sumMacros, verifyMeals, scaleMacros } from "../nutrition";
import { baseName, foodMatchesTerm, planDay, planSlots, prefsFromProfile, SLOT_SHARE, suggestMeals } from "../planner";
import {
  MEAL_TYPES,
  type AgentAction,
  type ExecutionStatus,
  type Gym,
  type Macros,
  type MealChange,
  type MealLog,
  type MealSnapshot,
  type MealType,
  type PlannedMeal,
  type Profile,
  type ProposedChange,
  type Role,
  type Targets,
  type ToolTraceEntry,
} from "../types";

export interface AgentContext {
  db: SupabaseClient;
  memberId: string;
  actor: { id: string; role: Role; name?: string };
  gym: Gym;
  today: string;
  userRequest: string;
  trace: ToolTraceEntry[];
  createdActions: AgentAction[];
  cache: { profile?: Profile; targets?: Targets };
}

export function createContext(init: Omit<AgentContext, "trace" | "createdActions" | "cache">): AgentContext {
  return { ...init, trace: [], createdActions: [], cache: {} };
}

export type ToolResult = { result: Record<string, unknown>; summary: string };
export type ToolFn = (ctx: AgentContext, args: Record<string, any>) => Promise<ToolResult>;

// -----------------------------------------------------------------------------
// Data access helpers
// -----------------------------------------------------------------------------
const MEAL_ORDER: Record<string, number> = { breakfast: 0, lunch: 1, snack: 2, dinner: 3 };
const byMealOrder = <T extends { meal_type: string; date?: string }>(a: T, b: T) =>
  (a.date ?? "").localeCompare(b.date ?? "") || MEAL_ORDER[a.meal_type] - MEAL_ORDER[b.meal_type];

async function loadProfile(ctx: AgentContext): Promise<Profile> {
  if (ctx.cache.profile) return ctx.cache.profile;
  const { data } = await ctx.db.from("profiles").select("*").eq("id", ctx.memberId).single<Profile>();
  if (!data) throw new Error("Member not found or access denied");
  ctx.cache.profile = data;
  return data;
}

async function loadTargets(ctx: AgentContext): Promise<Targets> {
  if (ctx.cache.targets) return ctx.cache.targets;
  const { data } = await ctx.db.from("nutrition_targets").select("*").eq("member_id", ctx.memberId).single<Targets>();
  if (!data) throw new Error("No nutrition targets set for this member");
  const t = { ...data, calories: Number(data.calories), protein: Number(data.protein), carbs: Number(data.carbs), fat: Number(data.fat) };
  ctx.cache.targets = t;
  return t;
}

async function loadPlanned(ctx: AgentContext, from: string, to = from): Promise<PlannedMeal[]> {
  const { data } = await ctx.db
    .from("planned_meals")
    .select("*")
    .eq("member_id", ctx.memberId)
    .gte("date", from)
    .lte("date", to);
  return ((data ?? []) as PlannedMeal[]).map(numify).sort(byMealOrder);
}

async function loadLogs(ctx: AgentContext, from: string, to = from): Promise<MealLog[]> {
  const { data } = await ctx.db
    .from("meal_logs")
    .select("*")
    .eq("member_id", ctx.memberId)
    .gte("date", from)
    .lte("date", to)
    .order("created_at");
  return ((data ?? []) as MealLog[]).map(numify);
}

function numify<T extends Macros>(row: T): T {
  return { ...row, calories: Number(row.calories), protein: Number(row.protein), carbs: Number(row.carbs), fat: Number(row.fat) };
}

const targetMacros = (t: Targets): Macros => ({ calories: t.calories, protein: t.protein, carbs: t.carbs, fat: t.fat });
const snapshotOf = (p: PlannedMeal | MealLog): MealSnapshot => ({
  meal_name: p.meal_name,
  calories: p.calories,
  protein: p.protein,
  carbs: p.carbs,
  fat: p.fat,
  ingredients: (p as PlannedMeal).ingredients ?? [],
  tags: (p as PlannedMeal).tags ?? [],
});
const compactMeal = (m: Macros & { meal_type?: string; meal_name: string; date?: string }) => ({
  date: m.date,
  meal_type: m.meal_type,
  meal_name: m.meal_name,
  calories: m.calories,
  protein: m.protein,
  carbs: m.carbs,
  fat: m.fat,
});

function resolveDate(ctx: AgentContext, date?: string): string {
  if (!date || date === "today") return ctx.today;
  if (date === "tomorrow") return addDays(ctx.today, 1);
  if (date === "yesterday") return addDays(ctx.today, -1);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : ctx.today;
}

function asMealType(v: unknown): MealType | undefined {
  const s = String(v ?? "").toLowerCase();
  return (MEAL_TYPES as string[]).includes(s) ? (s as MealType) : undefined;
}

function statusFor(ctx: AgentContext, needsCoach: boolean): ExecutionStatus {
  if (needsCoach) return "pending_coach";
  return ctx.actor.role === "member" ? "proposed" : "pending_coach";
}

// -----------------------------------------------------------------------------
// record_agent_action
// -----------------------------------------------------------------------------
export async function recordAgentAction(
  ctx: AgentContext,
  input: {
    action_type: string;
    summary: string;
    status: ExecutionStatus;
    proposed_change?: ProposedChange | null;
    requires_coach_approval?: boolean;
  }
): Promise<AgentAction> {
  const impact = impactFor(input.action_type, ctx.gym.estimated_coach_hourly_value);
  const executed = input.status === "executed";
  ctx.trace.push({ tool: "record_agent_action", args: { action_type: input.action_type, status: input.status }, summary: input.summary });
  const row = {
    member_id: ctx.memberId,
    gym_id: ctx.gym.id,
    initiated_by: ctx.actor.id,
    action_type: input.action_type,
    user_request: ctx.userRequest || null,
    summary: input.summary,
    tools_used: ctx.trace.map((t) => ({ tool: t.tool, summary: t.summary })),
    proposed_change: input.proposed_change ?? null,
    requires_coach_approval: input.requires_coach_approval ?? input.status === "pending_coach",
    approved: executed ? true : null,
    execution_status: input.status,
    estimated_manual_minutes: impact.estimated_manual_minutes,
    estimated_agent_minutes: impact.estimated_agent_minutes,
    estimated_minutes_saved: executed ? impact.estimated_minutes_saved : 0,
    estimated_cost_value: executed ? impact.estimated_cost_value : 0,
  };
  const { data, error } = await ctx.db.from("agent_actions").insert(row).select("*").single<AgentAction>();
  if (error || !data) throw new Error(`Could not record agent action: ${error?.message}`);
  ctx.createdActions.push(data);
  return data;
}

async function computeRemaining(ctx: AgentContext, date: string) {
  const [targets, planned, logs] = await Promise.all([loadTargets(ctx), loadPlanned(ctx, date), loadLogs(ctx, date)]);
  const target = targetMacros(targets);
  const logged = sumMacros(logs);
  const remaining = subtractMacros(target, logged);
  const loggedTypes = new Set(logs.map((l) => l.meal_type));
  const remainingSlots = MEAL_TYPES.filter((t) => !loggedTypes.has(t));
  const remainingPlannedMeals = planned.filter((p) => !loggedTypes.has(p.meal_type));
  const remainingPlanned = sumMacros(remainingPlannedMeals);
  const projected = sumMacros([logged, remainingPlanned]);
  const calDiff = pctDiff(projected.calories, target.calories);
  const proteinPct = pctOf(projected.protein, target.protein);
  const fits = Math.abs(calDiff) <= 10 && proteinPct >= 90;
  return { targets, target, planned, logs, logged, remaining, remainingSlots, remainingPlannedMeals, remainingPlanned, projected, calDiff, proteinPct, fits };
}

function describeDeviation(logs: MealLog[], planned: PlannedMeal[]): string | null {
  let worst: { log: MealLog; slot: PlannedMeal; ratio: number } | null = null;
  for (const log of logs) {
    const slot = planned.find((p) => p.meal_type === log.meal_type);
    if (!slot || log.matched_plan) continue;
    const ratio = log.calories / Math.max(slot.calories, 1);
    if (Math.abs(ratio - 1) > 0.15 && (!worst || Math.abs(ratio - 1) > Math.abs(worst.ratio - 1))) worst = { log, slot, ratio };
  }
  if (!worst) return null;
  const { log, slot } = worst;
  const excess = [
    { k: "carbohydrates", v: (log.carbs - slot.carbs) / Math.max(slot.carbs, 1) },
    { k: "fat", v: (log.fat - slot.fat) / Math.max(slot.fat, 1) },
  ].sort((a, b) => b.v - a.v)[0];
  const lowProtein = log.protein < slot.protein * 0.75;
  const what = worst.ratio > 1 ? (excess.v > 0.2 ? `higher in ${excess.k}` : "higher in calories") : "lighter";
  return `Your ${log.meal_type} (${log.meal_name}, ${log.calories} kcal) was ${what} than the planned ${slot.meal_name} (${slot.calories} kcal)${lowProtein ? " and lower in protein" : ""}.`;
}

// Read tools
const get_member_profile: ToolFn = async (ctx) => {
  const p = await loadProfile(ctx);
  return {
    result: {
      name: p.name,
      age: p.age,
      sex: p.sex,
      height_cm: p.height,
      weight_kg: p.weight,
      goal: p.goal,
      activity_level: p.activity_level,
      dietary_preferences: p.dietary_preferences,
      disliked_foods: p.disliked_foods,
      allergies: p.allergies,
      medical_notes: p.medical_notes,
    },
    summary: `${p.name} · ${p.goal ?? "no goal"} · avoids: ${[...p.disliked_foods, ...p.allergies].join(", ") || "nothing"}`,
  };
};

const get_nutrition_targets: ToolFn = async (ctx) => {
  const t = await loadTargets(ctx);
  return {
    result: { calories: t.calories, protein: t.protein, carbs: t.carbs, fat: t.fat, water_l: t.water, meals_per_day: t.meals_per_day },
    summary: `${t.calories} kcal · ${t.protein}g protein · ${t.meals_per_day} meals/day`,
  };
};

const get_today_plan: ToolFn = async (ctx, args) => {
  const date = resolveDate(ctx, args.date);
  const meals = await loadPlanned(ctx, date);
  const totals = sumMacros(meals);
  return {
    result: { date, meals: meals.map(compactMeal), totals },
    summary: `${meals.length} planned meals for ${relativeDay(date, ctx.today)} · ${totals.calories} kcal`,
  };
};

const get_today_food_log: ToolFn = async (ctx, args) => {
  const date = resolveDate(ctx, args.date);
  const logs = await loadLogs(ctx, date);
  const totals = sumMacros(logs);
  return {
    result: { date, logs: logs.map((l) => ({ id: l.id, ...compactMeal(l), matched_plan: l.matched_plan })), totals },
    summary: `${logs.length} meals logged ${relativeDay(date, ctx.today).toLowerCase()} · ${totals.calories} kcal, ${totals.protein}g protein`,
  };
};

async function runAnalysis(ctx: AgentContext): Promise<ProgressAnalysis> {
  const from = addDays(ctx.today, -13);
  const [targets, logs, planned, plans] = await Promise.all([
    loadTargets(ctx),
    loadLogs(ctx, from, ctx.today),
    loadPlanned(ctx, from, ctx.today),
    ctx.db.from("nutrition_plans").select("start_date").eq("member_id", ctx.memberId).order("start_date").limit(1),
  ]);
  const startDate = (plans.data?.[0]?.start_date as string) ?? from;
  return analyzeProgress({ targets, logs, planned, startDate, today: ctx.today });
}

const get_recent_history: ToolFn = async (ctx) => {
  const a = await runAnalysis(ctx);
  const days = a.days
    .filter((d) => d.status !== "before_start")
    .map((d) => ({ date: d.date, status: d.status, calories: d.logged.calories, protein: d.logged.protein, meals_logged: d.mealsLogged }));
  return {
    result: { days, adherence_pct: a.adherencePct, deviation_days: a.deviationDays, missed_days_last7: a.missedDays, days_since_last_log: a.daysSinceLastLog },
    summary: `${days.length} days · adherence ${a.adherencePct}% · ${a.deviationDays.length} deviation days`,
  };
};

const calculate_remaining_nutrition: ToolFn = async (ctx, args) => {
  const date = resolveDate(ctx, args.date);
  const r = await computeRemaining(ctx, date);
  return {
    result: {
      date,
      target: r.target,
      logged: r.logged,
      remaining: r.remaining,
      remaining_slots: r.remainingSlots,
      remaining_planned_meals: r.remainingPlannedMeals.map(compactMeal),
      projected_end_of_day_if_plan_followed: r.projected,
      projected_calories_pct_vs_target: r.calDiff,
      projected_protein_pct_of_target: r.proteinPct,
      plan_still_fits: r.fits,
    },
    summary: `Remaining ${r.remaining.calories} kcal / ${r.remaining.protein}g protein · plan ${r.fits ? "still fits" : `no longer fits (${r.calDiff >= 0 ? "+" : ""}${r.calDiff}% kcal, ${r.proteinPct}% protein)`}`,
  };
};

const analyze_member_progress: ToolFn = async (ctx, args) => {
  const a = await runAnalysis(ctx);
  const p = await loadProfile(ctx);
  const summary = `${p.name}: ${a.headline} ${a.recommendation}`;
  if (args.record !== false) {
    await recordAgentAction(ctx, {
      action_type: "progress_analysis",
      summary,
      status: "executed",
      proposed_change: { kind: "insight", title: a.headline, explanation: a.recommendation },
    });
  }
  return {
    result: {
      scenario: a.scenario,
      headline: a.headline,
      recommendation: a.recommendation,
      suggested_action: a.suggestedAction,
      adherence_pct: a.adherencePct,
      meal_consistency_pct: a.mealConsistencyPct,
      avg_calories_pct: a.avgCaloriesPct,
      avg_protein_pct: a.avgProteinPct,
      streak_days: a.streak,
      missed_days_last7: a.missedDays,
      deviation_days_last10: a.deviationDays,
      protein_low_days: a.proteinLowDays,
      days_since_last_log: a.daysSinceLastLog,
      avoided_food: a.avoidedTag,
    },
    summary: `${a.scenario.replace("_", " ")} · ${a.headline}`,
  };
};

// Generation & proposal tools
const generate_meal: ToolFn = async (ctx, args) => {
  const mealType = asMealType(args.meal_type) ?? "dinner";
  const [profile, targets] = await Promise.all([loadProfile(ctx), loadTargets(ctx)]);
  const slot: Macros = {
    calories: Number(args.target_calories) || Math.round(targets.calories * SLOT_SHARE[mealType]),
    protein: Number(args.target_protein) || Math.round(targets.protein * SLOT_SHARE[mealType]),
    carbs: 0,
    fat: 0,
  };
  const options = suggestMeals(slot, mealType, prefsFromProfile(profile), {
    count: Math.min(Number(args.count) || 3, 5),
    avoidTerms: args.avoid ?? [],
    preferTags: args.prefer_egyptian ? ["egyptian"] : undefined,
  });
  return {
    result: { meal_type: mealType, slot_target: slot, options: options.map(compactMeal) },
    summary: `${options.length} ${mealType} options near ${slot.calories} kcal / ${slot.protein}g protein`,
  };
};

const replace_meal: ToolFn = async (ctx, args) => {
  const date = resolveDate(ctx, args.date);
  const mealType = asMealType(args.meal_type) ?? "dinner";
  const avoid: string[] = (args.avoid ?? []).filter(Boolean);
  const [profile, targets, planned, logs] = await Promise.all([loadProfile(ctx), loadTargets(ctx), loadPlanned(ctx, date), loadLogs(ctx, date)]);
  const current = planned.find((p) => p.meal_type === mealType) ?? null;

  let budget: Macros;
  if (date === ctx.today) {
    const r = await computeRemaining(ctx, date);
    const otherRemaining = sumMacros(r.remainingPlannedMeals.filter((p) => p.meal_type !== mealType));
    const left = subtractMacros(r.remaining, otherRemaining);
    budget = left.calories > 150 ? left : current ? snapshotOf(current) : { ...left, calories: 300 };
  } else {
    budget = current ? snapshotOf(current) : { calories: targets.calories * SLOT_SHARE[mealType], protein: targets.protein * SLOT_SHARE[mealType], carbs: 0, fat: 0 };
  }

  const otherNames = planned.filter((p) => p.meal_type !== mealType).map((p) => p.meal_name);
  const options = suggestMeals(budget, mealType, prefsFromProfile(profile), {
    count: 3,
    excludeNames: [...(current ? [current.meal_name] : []), ...otherNames],
    avoidTerms: avoid,
  });
  if (!options.length) return { result: { error: "No suitable alternatives found with these restrictions." }, summary: "No alternatives found" };

  const loggedTypes = new Set(logs.map((l) => l.meal_type));
  const dayOthers = [...logs, ...planned.filter((p) => p.meal_type !== mealType && !loggedTypes.has(p.meal_type))];
  const verification = verifyMeals(options, [{ date, totals: sumMacros([...dayOthers, options[0]]) }], targetMacros(targets));

  const label = `${mealType[0].toUpperCase()}${mealType.slice(1)}`;
  const proposal: ProposedChange = {
    kind: "replace_meal",
    title: `Replace ${label.toLowerCase()} · ${relativeDay(date, ctx.today)}`,
    explanation: `I found ${options.length} alternatives that fit ${relativeDay(date, ctx.today).toLowerCase()}'s remaining targets${avoid.length ? ` without ${avoid.join(", ")}` : ""}${current ? `, replacing ${current.meal_name}` : ""}.`,
    changes: [{ date, meal_type: mealType, before: current ? snapshotOf(current) : null, after: options[0] }],
    options,
    verification,
  };
  const action = await recordAgentAction(ctx, {
    action_type: "replace_meal",
    summary: `${label} alternatives for ${profile.name} (${relativeDay(date, ctx.today)})${args.reason ? ` — ${args.reason}` : ""}`,
    status: statusFor(ctx, false),
    proposed_change: proposal,
  });
  return {
    result: {
      proposal_id: action.id,
      status: action.execution_status,
      options: options.map(compactMeal),
      note: "Proposal created.",
    },
    summary: `${options.length} options: ${options.map((o) => o.meal_name).join(" · ")}`,
  };
};

const adapt_daily_plan: ToolFn = async (ctx, args) => {
  const date = resolveDate(ctx, args.date);
  const [profile, r] = await Promise.all([loadProfile(ctx), computeRemaining(ctx, date)]);
  if (!r.remainingSlots.length) {
    return { result: { error: "Every meal for this day is already logged." }, summary: "Nothing left to adapt" };
  }

  const newMeals = planSlots(r.remaining, r.remainingSlots, prefsFromProfile(profile), {
    excludeNames: r.logs.map((l) => l.meal_name),
  });
  const changes: MealChange[] = newMeals.map(({ meal_type, meal }) => {
    const before = r.planned.find((p) => p.meal_type === meal_type);
    return { date, meal_type, before: before ? snapshotOf(before) : null, after: meal };
  });
  const projected = sumMacros([r.logged, ...newMeals.map((m) => m.meal)]);
  const verification = verifyMeals(newMeals.map((m) => m.meal), [{ date, totals: projected }], r.target);

  const deviation = describeDeviation(r.logs, r.planned);
  const slotsText = r.remainingSlots.join(" and ");
  const overBudget = r.remaining.calories < 250 * r.remainingSlots.length;
  const explanation = [
    deviation ?? (args.reason ? `Requested: ${args.reason}.` : "Rebalancing the rest of the day."),
    `I adjusted ${slotsText} to keep the rest of ${relativeDay(date, ctx.today).toLowerCase()}'s target balanced.`,
    overBudget ? "Most of today's calories are already used, so remaining meals are lighter and protein-focused." : "",
  ]
    .filter(Boolean)
    .join(" ");

  const proposal: ProposedChange = {
    kind: "adapt_daily_plan",
    title: `Rebalance ${relativeDay(date, ctx.today).toLowerCase()}: ${slotsText}`,
    explanation,
    changes,
    verification,
  };
  const action = await recordAgentAction(ctx, {
    action_type: "adapt_daily_plan",
    summary: `${profile.name}: ${deviation ?? "daily rebalance"} Proposed new ${slotsText}.`,
    status: statusFor(ctx, false),
    proposed_change: proposal,
  });
  return {
    result: {
      proposal_id: action.id,
      status: action.execution_status,
      explanation,
      new_meals: changes.map((c) => ({ meal_type: c.meal_type, from: c.before?.meal_name, to: c.after.meal_name, calories: c.after.calories, protein: c.after.protein })),
      projected_day_totals: projected,
      verification_ok: verification.ok,
    },
    summary: `Proposed ${changes.length} meal(s) · day projects to ${projected.calories} / ${r.target.calories} kcal, ${projected.protein} / ${r.target.protein}g protein`,
  };
};

const adapt_weekly_plan: ToolFn = async (ctx, args) => {
  const days = Math.min(Math.max(Number(args.days) || 3, 1), 7);
  const focus: string = args.focus ?? "balanced";
  const start = addDays(ctx.today, 1);
  const end = addDays(start, days - 1);
  const [profile, targets, planned] = await Promise.all([loadProfile(ctx), loadTargets(ctx), loadPlanned(ctx, start, end)]);
  const target = targetMacros(targets);
  const prefs = prefsFromProfile(profile);

  const changes: MealChange[] = [];
  const dayTotals: { date: string; totals: Macros }[] = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(start, i);
    const meals = planDay(target, prefs, {
      proteinWeight: focus === "protein" ? 3 : 1.5,
      preferTags: focus === "egyptian" ? ["egyptian"] : undefined,
      variety: i,
    });
    for (const { meal_type, meal } of meals) {
      const before = planned.find((p) => p.date === date && p.meal_type === meal_type);
      changes.push({ date, meal_type, before: before ? snapshotOf(before) : null, after: meal });
    }
    dayTotals.push({ date, totals: sumMacros(meals.map((m) => m.meal)) });
  }
  const verification = verifyMeals(changes.map((c) => c.after), dayTotals, target);

  const beforeProtein = planned.length ? Math.round(sumMacros(planned).protein / days) : null;
  const afterProtein = Math.round(dayTotals.reduce((s, d) => s + d.totals.protein, 0) / days);
  const focusText: Record<string, string> = {
    protein: `Protein-focused swaps: planned protein averages ${afterProtein} g/day${beforeProtein ? ` (was ${beforeProtein} g)` : ""} against a ${target.protein} g target.`,
    egyptian: "Swapped upcoming meals to familiar Egyptian-style options that are closer to what the member actually eats.",
    simplify: "Simplified upcoming meals to fewer, easier options.",
    balanced: "Rebalanced upcoming meals around current targets.",
  };
  const explanation = `${args.reason ? args.reason + " " : ""}${focusText[focus] ?? focusText.balanced}`;

  const proposal: ProposedChange = {
    kind: "adapt_weekly_plan",
    title: `Adapt next ${days} days (${relativeDay(start, ctx.today)} → ${relativeDay(end, ctx.today)})`,
    explanation,
    changes,
    verification,
  };
  const action = await recordAgentAction(ctx, {
    action_type: "adapt_weekly_plan",
    summary: `${profile.name}: ${args.reason ?? "plan adaptation"} (${focus}, ${days} days)`,
    status: "pending_coach",
    requires_coach_approval: true,
    proposed_change: proposal,
  });
  return {
    result: {
      proposal_id: action.id,
      status: action.execution_status,
      explanation,
      days,
      meals_changed: changes.length,
      verification_ok: verification.ok,
    },
    summary: `${changes.length} meals over ${days} days · sent for coach approval`,
  };
};

const generate_meal_plan: ToolFn = async (ctx, args) => {
  const date = resolveDate(ctx, args.date ?? "tomorrow");
  const focus: string = args.focus ?? "balanced";
  const [profile, targets, planned] = await Promise.all([loadProfile(ctx), loadTargets(ctx), loadPlanned(ctx, date)]);
  const target = targetMacros(targets);
  const meals = planDay(target, prefsFromProfile(profile), {
    preferTags: focus === "egyptian" ? ["egyptian"] : undefined,
    proteinWeight: focus === "protein" ? 3 : 1.5,
    variety: new Date(date).getUTCDate(),
  });
  const changes: MealChange[] = meals.map(({ meal_type, meal }) => {
    const before = planned.find((p) => p.meal_type === meal_type);
    return { date, meal_type, before: before ? snapshotOf(before) : null, after: meal };
  });
  const totals = sumMacros(meals.map((m) => m.meal));
  const verification = verifyMeals(meals.map((m) => m.meal), [{ date, totals }], target);
  const proposal: ProposedChange = {
    kind: "generate_meal_plan",
    title: `New plan for ${relativeDay(date, ctx.today).toLowerCase()}${focus === "egyptian" ? " (Egyptian foods)" : ""}`,
    explanation: `A full day built around your targets: ${totals.calories} kcal and ${totals.protein} g protein.`,
    changes,
    verification,
  };
  const action = await recordAgentAction(ctx, {
    action_type: "generate_meal_plan",
    summary: `${profile.name}: generated ${focus} plan for ${date}`,
    status: statusFor(ctx, false),
    proposed_change: proposal,
  });
  return {
    result: { proposal_id: action.id, status: action.execution_status, meals: changes.map((c) => compactMeal({ ...c.after, meal_type: c.meal_type })), totals, verification_ok: verification.ok },
    summary: `${meals.length} meals · ${totals.calories} kcal · ${totals.protein}g protein`,
  };
};

const update_member_preferences: ToolFn = async (ctx, args) => {
  const profile = await loadProfile(ctx);
  const clean = (xs: unknown): string[] => (Array.isArray(xs) ? xs : []).map((x) => String(x).toLowerCase().trim()).filter(Boolean);
  const add = clean(args.add_dislikes);
  const remove = clean(args.remove_dislikes);
  const addAllergies = clean(args.add_allergies);
  const newPrefs = {
    disliked_foods: [...new Set([...profile.disliked_foods.filter((d) => !remove.includes(d)), ...add])],
    allergies: [...new Set([...profile.allergies, ...addAllergies])],
    dietary_preferences: profile.dietary_preferences,
  };
  const terms = [...add, ...addAllergies];

  const end = addDays(ctx.today, 6);
  const [planned, todayLogs] = await Promise.all([loadPlanned(ctx, ctx.today, end), loadLogs(ctx, ctx.today)]);
  const loggedToday = new Set(todayLogs.map((l) => l.meal_type));
  const affected = planned.filter(
    (p) => !(p.date === ctx.today && loggedToday.has(p.meal_type)) && terms.some((t) => foodMatchesTerm({ tags: p.tags, ingredients: p.ingredients, name: p.meal_name }, t))
  );

  const changes: MealChange[] = [];
  for (const p of affected) {
    const sameDay = planned.filter((x) => x.date === p.date && x.id !== p.id).map((x) => x.meal_name);
    const [alt] = suggestMeals(snapshotOf(p), p.meal_type, newPrefs, { count: 1, excludeNames: [p.meal_name, ...sameDay, ...changes.filter((c) => c.date === p.date).map((c) => c.after.meal_name)] });
    if (alt) changes.push({ date: p.date, meal_type: p.meal_type, before: snapshotOf(p), after: alt });
  }
  const verification = verifyMeals(changes.map((c) => c.after));

  const what = [add.length ? `stop planning ${add.join(", ")}` : "", remove.length ? `allow ${remove.join(", ")} again` : "", addAllergies.length ? `add allergy: ${addAllergies.join(", ")}` : ""]
    .filter(Boolean)
    .join("; ");
  const proposal: ProposedChange = {
    kind: "update_preferences",
    title: `Update preferences: ${what}`,
    explanation: `${changes.length ? `${changes.length} upcoming meal(s) contain ${terms.join(", ")} and will be replaced.` : "No upcoming meals are affected."}`,
    changes,
    preference_update: { add_dislikes: add, remove_dislikes: remove, add_allergies: addAllergies },
    verification,
    safety_note: addAllergies.length ? "Allergies can be serious. Please confirm with a doctor or registered dietitian." : undefined,
  };
  const action = await recordAgentAction(ctx, {
    action_type: "update_preferences",
    summary: `${profile.name}: ${what} (${changes.length} meals affected)`,
    status: statusFor(ctx, addAllergies.length > 0),
    proposed_change: proposal,
  });
  return {
    result: { proposal_id: action.id, status: action.execution_status, meals_replaced: changes.length },
    summary: `${what} · ${changes.length} affected meals get replacements`,
  };
};

const create_coach_followup: ToolFn = async (ctx, args) => {
  const profile = await loadProfile(ctx);
  const first = profile.name.split(" ")[0];
  const reason: string = args.reason ?? "Follow-up needed";
  const message: string =
    args.message ??
    `Hi ${first}, we noticed you haven't logged meals for a few days. Everything OK? Reply here and we'll simplify your plan this week.`;

  const { data: followup, error } = await ctx.db
    .from("coach_followups")
    .insert({ member_id: ctx.memberId, coach_id: profile.coach_id, reason, message, status: "draft" })
    .select("*")
    .single();
  if (error || !followup) throw new Error(`Could not create follow-up: ${error?.message}`);

  const action = await recordAgentAction(ctx, {
    action_type: "coach_followup",
    summary: `${profile.name}: ${reason} Drafted a coach follow-up.`,
    status: "pending_coach",
    requires_coach_approval: true,
    proposed_change: {
      kind: "coach_followup",
      title: `Follow up with ${first}`,
      explanation: reason,
      followup: { followup_id: followup.id, message, reason },
    },
  });
  await ctx.db.from("coach_followups").update({ agent_action_id: action.id }).eq("id", followup.id);
  return { result: { proposal_id: action.id, status: "pending_coach", message }, summary: "Follow-up drafted for coach approval" };
};

function guessMealType(loggedTypes: Set<string>, planned: PlannedMeal[]): MealType {
  const next = MEAL_TYPES.find((t) => !loggedTypes.has(t) && planned.some((p) => p.meal_type === t));
  if (next) return next;
  const h = cairoHour();
  return h < 11 ? "breakfast" : h < 16 ? "lunch" : h < 19 ? "snack" : "dinner";
}

const log_meal: ToolFn = async (ctx, args) => {
  const date = resolveDate(ctx, args.date);
  const [planned, logs] = await Promise.all([loadPlanned(ctx, date), loadLogs(ctx, date)]);
  const mealType = asMealType(args.meal_type) ?? guessMealType(new Set(logs.map((l) => l.meal_type)), planned);
  const servings = Math.min(Math.max(Number(args.servings) || 1, 0.25), 4);
  const text = String(args.meal_name ?? "").trim();
  const slot = planned.find((p) => p.meal_type === mealType);

  let snapshot: MealSnapshot | null = null;
  let matched = false;
  let estimated = false;
  if (slot && (args.as_planned || /^(as )?planned$/i.test(text) || baseName(text) === baseName(slot.meal_name))) {
    snapshot = servings === 1 ? snapshotOf(slot) : { ...snapshotOf(slot), ...scaleMacros(snapshotOf(slot), servings) };
    matched = servings === 1;
  }
  if (!snapshot) {
    const food = findFood(text);
    if (food) snapshot = foodToSnapshot(food, servings);
  }
  if (!snapshot && args.est_protein != null && args.est_carbs != null && args.est_fat != null) {
    const macros = normalizeMacros({ protein: args.est_protein * servings, carbs: args.est_carbs * servings, fat: args.est_fat * servings });
    snapshot = { meal_name: text || "Unlisted meal", ...macros, ingredients: [], tags: [] };
    estimated = true;
  }
  if (!snapshot) {
    return {
      result: { error: "unknown_food", message: `I couldn't find "${text}" in the food database.`, suggestions: searchFoods(text.split(" ")[0] ?? "").map((f) => f.name) },
      summary: `"${text}" not found in catalog`,
    };
  }

  const issues = checkMeal(snapshot, args.claimed_calories);
  if (issues.some((i) => i.startsWith("Missing") || i.startsWith("Negative"))) {
    return { result: { error: "invalid_meal", issues }, summary: `Rejected: ${issues.join("; ")}` };
  }

  const { data: logRow, error } = await ctx.db
    .from("meal_logs")
    .insert({
      member_id: ctx.memberId,
      date,
      meal_type: mealType,
      meal_name: snapshot.meal_name,
      calories: snapshot.calories,
      protein: snapshot.protein,
      carbs: snapshot.carbs,
      fat: snapshot.fat,
      notes: args.notes ?? null,
      matched_plan: matched,
      estimated,
    })
    .select("*")
    .single();
  if (error) throw new Error(`Could not log meal: ${error.message}`);

  const vsPlanned = slot ? pctDiff(snapshot.calories, slot.calories) : null;
  const significant = vsPlanned !== null && !matched && Math.abs(vsPlanned) > 15;
  const r = await computeRemaining(ctx, date);
  const summary = `Logged ${snapshot.meal_name} for ${mealType} — ${snapshot.calories} kcal, ${snapshot.protein}g protein`;
  await recordAgentAction(ctx, { action_type: "log_meal", summary, status: "executed" });

  return {
    result: {
      logged: { id: logRow.id, ...compactMeal({ ...snapshot, meal_type: mealType }), matched_plan: matched, estimated },
      warnings: issues,
      planned_meal: slot ? compactMeal(slot) : null,
      calories_vs_planned_pct: vsPlanned,
      significant_deviation: significant,
      remaining_today: r.remaining,
      plan_still_fits: r.fits,
    },
    summary,
  };
};

const update_meal: ToolFn = async (ctx, args) => {
  const date = resolveDate(ctx, args.date);
  const logs = await loadLogs(ctx, date);
  const target = args.log_id ? logs.find((l) => l.id === args.log_id) : logs.filter((l) => l.meal_type === asMealType(args.meal_type)).pop();
  if (!target) return { result: { error: "No matching logged meal found." }, summary: "No log to update" };
  const servings = Math.min(Math.max(Number(args.servings) || 1, 0.25), 4);
  const food = args.meal_name ? findFood(String(args.meal_name)) : null;
  const base: MealSnapshot = food ? foodToSnapshot(food, servings) : { ...snapshotOf(target), ...scaleMacros(snapshotOf(target), servings) };
  const { error } = await ctx.db
    .from("meal_logs")
    .update({ meal_name: base.meal_name, calories: base.calories, protein: base.protein, carbs: base.carbs, fat: base.fat, matched_plan: false })
    .eq("id", target.id);
  if (error) throw new Error(error.message);
  const summary = `Updated ${target.meal_type}: ${target.meal_name} → ${base.meal_name} (${base.calories} kcal)`;
  await recordAgentAction(ctx, { action_type: "update_meal", summary, status: "executed" });
  return { result: { updated: compactMeal({ ...base, meal_type: target.meal_type }) }, summary };
};

export const TOOLS: Record<string, ToolFn> = {
  get_member_profile,
  get_nutrition_targets,
  get_today_plan,
  get_today_food_log,
  get_recent_history,
  calculate_remaining_nutrition,
  generate_meal,
  generate_meal_plan,
  replace_meal,
  adapt_daily_plan,
  adapt_weekly_plan,
  log_meal,
  update_meal,
  update_member_preferences,
  analyze_member_progress,
  create_coach_followup,
};

export async function runTool(ctx: AgentContext, name: string, args: Record<string, any> = {}): Promise<Record<string, unknown>> {
  const fn = TOOLS[name];
  if (!fn) return { error: `Unknown tool ${name}` };
  const entry: ToolTraceEntry = { tool: name, args, summary: "…" };
  ctx.trace.push(entry);
  try {
    const out = await fn(ctx, args);
    entry.summary = out.summary;
    return out.result;
  } catch (e) {
    entry.summary = `Error: ${(e as Error).message}`;
    return { error: (e as Error).message };
  }
}

export async function runAnalysisTool(ctx: AgentContext, record = true): Promise<ProgressAnalysis> {
  return await runAnalysis(ctx);
}

export { computeRemaining, loadProfile, loadTargets };
