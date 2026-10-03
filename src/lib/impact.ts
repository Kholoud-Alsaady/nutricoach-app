// Business impact calculations.
// Every number here is either (a) summed from real agent_actions / ai_usage rows,
// or (b) a MODELED estimate from the gym's editable assumptions. The UI labels
// (b) as "Modeled estimate".

import type { AgentAction, AiUsage, Gym } from "./types";

/**
 * Modeled time baseline per agent action type (minutes).
 * manual = how long a coach would spend doing it by hand.
 * agent  = coach time still needed with the agent (review/approve).
 */
export const ACTION_BASELINES: Record<string, { manual: number; agent: number; label: string }> = {
  log_meal: { manual: 3, agent: 0.5, label: "Check a food log against the plan" },
  update_meal: { manual: 2, agent: 0.5, label: "Correct a logged meal" },
  replace_meal: { manual: 10, agent: 2, label: "Find a replacement meal that fits targets" },
  adapt_daily_plan: { manual: 15, agent: 5, label: "Rebalance the rest of the day" },
  adapt_weekly_plan: { manual: 45, agent: 10, label: "Rework upcoming days of a plan" },
  generate_meal_plan: { manual: 20, agent: 4, label: "Write a full day plan" },
  update_preferences: { manual: 20, agent: 4, label: "Update preferences and fix affected meals" },
  progress_analysis: { manual: 8, agent: 1, label: "Review a member's adherence" },
  coach_followup: { manual: 10, agent: 2, label: "Spot inactivity and draft a follow-up" },
  chat_answer: { manual: 3, agent: 0.5, label: "Answer a nutrition question" },
};

export function baselineFor(actionType: string) {
  return ACTION_BASELINES[actionType] ?? { manual: 0, agent: 0, label: actionType };
}

/** Minutes saved and EGP value for one executed action. */
export function impactFor(actionType: string, hourlyValue: number) {
  const b = baselineFor(actionType);
  const saved = Math.max(0, b.manual - b.agent);
  return {
    estimated_manual_minutes: b.manual,
    estimated_agent_minutes: b.agent,
    estimated_minutes_saved: saved,
    estimated_cost_value: Math.round((saved / 60) * hourlyValue * 100) / 100,
  };
}

// ---------------------------------------------------------------------------
// Measured (from the database)
// ---------------------------------------------------------------------------

export interface MeasuredImpact {
  executedActions: number;
  pendingActions: number;
  minutesSaved: number;
  hoursSaved: number;
  laborValue: number;           // EGP
  adaptationsThisWeek: number;
  byType: { type: string; count: number; minutes: number }[];
  aiRequests: number;
  inputTokens: number;
  outputTokens: number;
  aiCostUsd: number;
  aiCostEgp: number;
  aiCostPerRequestEgp: number;
  projectedAiCostPerMemberMonthEgp: number | null;
  projectedAiCostFor50Egp: number | null;
  firstActivity: string | null;
}

const PLAN_CHANGE_TYPES = ["replace_meal", "adapt_daily_plan", "adapt_weekly_plan", "generate_meal_plan", "update_preferences"];

export function measureImpact(actions: AgentAction[], usage: AiUsage[], gym: Gym, activeMembers: number): MeasuredImpact {
  const executed = actions.filter((a) => a.execution_status === "executed");
  const minutesSaved = executed.reduce((s, a) => s + Number(a.estimated_minutes_saved || 0), 0);
  const weekAgo = Date.now() - 7 * 86_400_000;

  const typeMap = new Map<string, { count: number; minutes: number }>();
  for (const a of executed) {
    const t = typeMap.get(a.action_type) ?? { count: 0, minutes: 0 };
    t.count++;
    t.minutes += Number(a.estimated_minutes_saved || 0);
    typeMap.set(a.action_type, t);
  }

  const aiRequests = usage.reduce((s, u) => s + u.request_count, 0);
  const aiCostUsd = usage.reduce((s, u) => s + Number(u.estimated_cost_usd || 0), 0);
  const aiCostEgp = aiCostUsd * gym.usd_to_egp;

  // Projection: observed cost per request × observed requests per member per month.
  const allTimes = [...actions.map((a) => a.created_at), ...usage.map((u) => u.created_at)].sort();
  const firstActivity = allTimes[0] ?? null;
  const spanDays = firstActivity ? Math.max(1, (Date.now() - new Date(firstActivity).getTime()) / 86_400_000) : 1;
  const costPerRequest = aiRequests ? aiCostEgp / aiRequests : 0;
  let perMember: number | null = null;
  if (aiRequests > 0 && activeMembers > 0) {
    const requestsPerMemberMonth = (aiRequests / activeMembers) * (30 / spanDays);
    perMember = costPerRequest * requestsPerMemberMonth;
  }

  return {
    executedActions: executed.length,
    pendingActions: actions.filter((a) => a.execution_status === "proposed" || a.execution_status === "pending_coach").length,
    minutesSaved: Math.round(minutesSaved * 10) / 10,
    hoursSaved: Math.round((minutesSaved / 60) * 10) / 10,
    laborValue: Math.round((minutesSaved / 60) * gym.estimated_coach_hourly_value),
    adaptationsThisWeek: executed.filter((a) => PLAN_CHANGE_TYPES.includes(a.action_type) && new Date(a.created_at).getTime() >= weekAgo).length,
    byType: [...typeMap.entries()].map(([type, v]) => ({ type, ...v })).sort((a, b) => b.minutes - a.minutes),
    aiRequests,
    inputTokens: usage.reduce((s, u) => s + u.input_tokens, 0),
    outputTokens: usage.reduce((s, u) => s + u.output_tokens, 0),
    aiCostUsd,
    aiCostEgp,
    aiCostPerRequestEgp: costPerRequest,
    projectedAiCostPerMemberMonthEgp: perMember,
    projectedAiCostFor50Egp: perMember == null ? null : perMember * 50,
    firstActivity,
  };
}

// ---------------------------------------------------------------------------
// Modeled monthly scenario (from editable gym assumptions)
// ---------------------------------------------------------------------------

export interface ModeledRoi {
  members: number;
  revenue: number;
  traditionalRevenue: number;
  revenueUplift: number;
  coachHoursSaved: number;
  laborValue: number;
  aiCost: number;
  infrastructureCost: number;
  contribution: number;
  roiPct: number;
}

export function modelRoi(gym: Gym, members = gym.modeled_member_count, aiCostPerMember = gym.ai_cost): ModeledRoi {
  const revenue = members * gym.subscription_price;
  const traditionalRevenue = members * gym.traditional_nutrition_price;
  const revenueUplift = revenue - traditionalRevenue;
  const coachHoursSaved = (members * Math.max(0, gym.estimated_manual_minutes_per_member - gym.estimated_agent_minutes_per_member)) / 60;
  const laborValue = coachHoursSaved * gym.estimated_coach_hourly_value;
  const aiCost = members * aiCostPerMember;
  const infrastructureCost = Number(gym.infrastructure_cost);
  const contribution = revenue - aiCost - infrastructureCost;
  const operatingCost = aiCost + infrastructureCost;
  // ROI on the platform's operating cost: (uplift + labor value − cost) / cost
  const roiPct = operatingCost > 0 ? Math.round(((revenueUplift + laborValue - operatingCost) / operatingCost) * 100) : 0;
  return {
    members,
    revenue,
    traditionalRevenue,
    revenueUplift,
    coachHoursSaved: Math.round(coachHoursSaved * 10) / 10,
    laborValue: Math.round(laborValue),
    aiCost: Math.round(aiCost),
    infrastructureCost,
    contribution: Math.round(contribution),
    roiPct,
  };
}

export const egp = (n: number) => `${Math.round(n).toLocaleString("en-US")} EGP`;
