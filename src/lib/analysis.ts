// Deterministic progress analysis.
// Turns raw logs + plan into day summaries, adherence metrics and ONE scenario
// classification. This is what lets the agent tell "one missed day" (Sara)
// apart from "repeated deviations" (Layla) without guessing.

import { addDays, daysBetween } from "./dates";
import { pctOf, sumMacros } from "./nutrition";
import type { Macros, MealLog, PlannedMeal, Targets } from "./types";

export type DayStatus = "adherent" | "deviation" | "missed" | "today" | "upcoming" | "before_start";

export interface DaySummary {
  date: string;
  status: DayStatus;
  logged: Macros;
  planned: Macros;
  mealsLogged: number;
  matchedMeals: number;
  proteinLow: boolean;
  calPct: number;
  proteinPct: number;
  note?: string;
}

export type Scenario =
  | "inactive"
  | "preference_shift"
  | "repeated_deviation"
  | "protein_gap"
  | "single_miss"
  | "stable"
  | "new_member";

export type SuggestedAction =
  | "coach_followup"
  | "adapt_weekly_plan"
  | "protein_adjustment"
  | "update_preferences"
  | "monitor"
  | "none";

export interface ProgressAnalysis {
  days: DaySummary[];
  adherencePct: number;          // adherent days / tracked days (last 7)
  mealConsistencyPct: number;    // planned meals logged as planned (last 7)
  avgCaloriesPct: number;
  avgProteinPct: number;
  streak: number;                // consecutive adherent days up to yesterday/today
  daysSinceLastLog: number | null;
  lastLogDate: string | null;
  missedDays: number;            // last 7
  deviationDays: string[];       // last 10
  proteinLowDays: number;        // of logged days, last 7
  loggedDays7: number;
  avoidedTag: { tag: string; count: number } | null;
  scenario: Scenario;
  suggestedAction: SuggestedAction;
  headline: string;
  recommendation: string;
}

/** A day is a deviation if calories drift >15% or an off-plan meal blew a slot by 30%+. */
function summarizeDay(date: string, logs: MealLog[], planned: PlannedMeal[], targets: Targets): Omit<DaySummary, "status"> & { offPlanSpike: boolean } {
  const logged = sumMacros(logs);
  const plannedTotals = sumMacros(planned);
  const calPct = pctOf(logged.calories, targets.calories);
  const proteinPct = pctOf(logged.protein, targets.protein);
  const offPlanSpike = logs.some((l) => {
    if (l.matched_plan) return false;
    const slot = planned.find((p) => p.meal_type === l.meal_type);
    return slot ? l.calories > slot.calories * 1.3 : false;
  });
  return {
    date,
    logged,
    planned: plannedTotals,
    mealsLogged: logs.length,
    matchedMeals: logs.filter((l) => l.matched_plan).length,
    proteinLow: logs.length > 0 && proteinPct < 85,
    calPct,
    proteinPct,
    offPlanSpike,
  };
}

export function analyzeProgress(input: {
  targets: Targets;
  logs: MealLog[];
  planned: PlannedMeal[];
  startDate: string;  // first day of tracking (plan start)
  today: string;
  windowDays?: number;
}): ProgressAnalysis {
  const { targets, logs, planned, startDate, today } = input;
  const windowDays = input.windowDays ?? 14;

  const days: DaySummary[] = [];
  for (let i = windowDays - 1; i >= 0; i--) {
    const date = addDays(today, -i);
    const dayLogs = logs.filter((l) => l.date === date);
    const dayPlan = planned.filter((p) => p.date === date);
    const s = summarizeDay(date, dayLogs, dayPlan, targets);
    let status: DayStatus;
    if (date < startDate) status = "before_start";
    else if (date === today) status = "today";
    else if (dayLogs.length === 0) status = "missed";
    else if (Math.abs(s.calPct - 100) > 15 || s.offPlanSpike) status = "deviation";
    else status = "adherent";
    const { offPlanSpike, ...rest } = s;
    void offPlanSpike;
    days.push({ ...rest, status });
  }

  const past = days.filter((d) => d.status !== "today" && d.status !== "before_start");
  const last7 = past.slice(-7);
  const last10 = past.slice(-10);
  const logged7 = last7.filter((d) => d.mealsLogged > 0);

  const adherencePct = last7.length ? Math.round((last7.filter((d) => d.status === "adherent").length / last7.length) * 100) : 0;
  const plannedCount7 = planned.filter((p) => last7.some((d) => d.date === p.date)).length;
  const matched7 = last7.reduce((s, d) => s + d.matchedMeals, 0);
  const mealConsistencyPct = plannedCount7 ? Math.round((matched7 / plannedCount7) * 100) : 0;
  const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);

  let streak = 0;
  for (let i = past.length - 1; i >= 0; i--) {
    if (past[i].status === "adherent") streak++;
    else break;
  }

  const sortedLogDates = [...new Set(logs.map((l) => l.date))].sort();
  const lastLogDate = sortedLogDates.length ? sortedLogDates[sortedLogDates.length - 1] : null;
  const daysSinceLastLog = lastLogDate ? daysBetween(lastLogDate, today) : null;

  // Preference signal: off-plan swaps away from planned meals sharing a tag.
  const tagCounts: Record<string, number> = {};
  for (const l of logs.filter((x) => !x.matched_plan && daysBetween(x.date, today) <= 7)) {
    const slot = planned.find((p) => p.date === l.date && p.meal_type === l.meal_type);
    if (!slot) continue;
    const logText = `${l.meal_name} ${l.notes ?? ""}`.toLowerCase();
    for (const tag of slot.tags) {
      if (["chicken", "beef", "fish", "salmon", "tuna", "turkey", "eggs", "dairy"].includes(tag) && !logText.includes(tag)) {
        tagCounts[tag] = (tagCounts[tag] ?? 0) + 1;
      }
    }
  }
  const topTag = Object.entries(tagCounts).sort((a, b) => b[1] - a[1])[0];
  const avoidedTag = topTag && topTag[1] >= 3 ? { tag: topTag[0], count: topTag[1] } : null;

  const missedDays = last7.filter((d) => d.status === "missed").length;
  const deviationDays = last10.filter((d) => d.status === "deviation").map((d) => d.date);
  const proteinLowDays = logged7.filter((d) => d.proteinLow).length;
  const avgCaloriesPct = avg(logged7.map((d) => d.calPct));
  const avgProteinPct = avg(logged7.map((d) => d.proteinPct));
  const trackedDays = past.length;

  // ----- Classification (order matters: most urgent first) -----
  let scenario: Scenario;
  let suggestedAction: SuggestedAction;
  let headline: string;
  let recommendation: string;

  if (trackedDays < 3) {
    scenario = "new_member";
    suggestedAction = "none";
    headline = "New member — not enough data yet.";
    recommendation = "Keep the starting plan and collect a few days of logs.";
  } else if (daysSinceLastLog === null || daysSinceLastLog >= 3) {
    scenario = "inactive";
    suggestedAction = "coach_followup";
    headline = `No meals logged for ${daysSinceLastLog ?? trackedDays} days.`;
    recommendation = "Inactivity detected. Prepare a supportive coach follow-up before changing the plan.";
  } else if (avoidedTag) {
    scenario = "preference_shift";
    suggestedAction = "update_preferences";
    headline = `Skipped planned ${avoidedTag.tag} meals ${avoidedTag.count} times this week.`;
    recommendation = `Preference change likely. Update preferences to exclude ${avoidedTag.tag} and replace upcoming ${avoidedTag.tag} meals.`;
  } else if (deviationDays.length >= 2) {
    scenario = "repeated_deviation";
    suggestedAction = "adapt_weekly_plan";
    headline = `${deviationDays.length} deviation days in the last 10 days.`;
    recommendation = "Repeated deviations detected. Recommend adapting upcoming meals.";
  } else if (logged7.length >= 4 && proteinLowDays >= Math.ceil(logged7.length * 0.6) && avgCaloriesPct >= 88 && avgCaloriesPct <= 112) {
    scenario = "protein_gap";
    suggestedAction = "protein_adjustment";
    headline = `Calories on target (${avgCaloriesPct}%) but protein low on ${proteinLowDays} of ${logged7.length} days (avg ${avgProteinPct}%).`;
    recommendation = "Protein gap pattern. Recommend protein-focused meal adjustments.";
  } else if (missedDays === 1) {
    scenario = "single_miss";
    suggestedAction = "monitor";
    headline = "One missed day detected.";
    recommendation = "One missed day detected. Maintain the current plan and monitor the next few days.";
  } else {
    scenario = "stable";
    suggestedAction = "none";
    headline = `Consistent: ${adherencePct}% adherence, ${streak}-day streak.`;
    recommendation = "Plan remains stable because the member is consistently following it.";
  }

  return {
    days,
    adherencePct,
    mealConsistencyPct,
    avgCaloriesPct,
    avgProteinPct,
    streak,
    daysSinceLastLog,
    lastLogDate,
    missedDays,
    deviationDays,
    proteinLowDays,
    loggedDays7: logged7.length,
    avoidedTag,
    scenario,
    suggestedAction,
    headline,
    recommendation,
  };
}

export type MemberStatus = "On track" | "Needs review" | "Plan adapted" | "No recent logs";

/** Member-list status, combining analysis with pending/recent agent actions. */
export function memberStatus(a: ProgressAnalysis, opts: { pendingReview: boolean; adaptedRecently: boolean }): MemberStatus {
  if (a.scenario === "inactive") return "No recent logs";
  if (opts.pendingReview) return "Needs review";
  if (opts.adaptedRecently) return "Plan adapted";
  return "On track";
}
