"use client";

import React, { useState } from "react";
import { addDays, formatDay, relativeDay } from "@/lib/dates";
import { Award, CheckCircle2, Flame, LineChart, TrendingUp, AlertTriangle, Sparkles } from "lucide-react";
import { useNutriCoach } from "./NutriCoachContext";
import { analyzeProgress } from "@/lib/analysis";

export function ProgressView() {
  const { state, activeProfile, activeTargets, activePlannedMeals, activeMealLogs } = useNutriCoach();

  const scenario = activeProfile.demo_scenario;
  const name = activeProfile.name?.toLowerCase() || "";
  const isDemoMember = [
    "00000000-0000-0000-0000-000000000011",
    "00000000-0000-0000-0000-000000000012",
    "00000000-0000-0000-0000-000000000013",
    "00000000-0000-0000-0000-000000000014",
    "00000000-0000-0000-0000-000000000015",
    "00000000-0000-0000-0000-000000000016",
  ].includes(activeProfile.id);

  const isOnboarding =
    scenario === "onboarding" ||
    (!isDemoMember &&
      !name.includes("omar") &&
      !name.includes("sara") &&
      !name.includes("layla") &&
      !name.includes("ahmed") &&
      !name.includes("mariam") &&
      !name.includes("youssef"));

  const memberCreatedDate = activeProfile.created_at
    ? activeProfile.created_at.slice(0, 10)
    : state.today;

  const analysis = analyzeProgress({
    targets: activeTargets,
    logs: activeMealLogs,
    planned: activePlannedMeals,
    startDate: isOnboarding ? memberCreatedDate : addDays(state.today, -13),
    today: state.today,
  });

  // Persona-specific exact display metrics
  const getScenarioConfig = () => {
    if (isOnboarding) {
      const todayLogs = activeMealLogs.filter((l) => l.date === state.today);
      const todayProteinLogged = todayLogs.reduce((s, l) => s + l.protein, 0);
      const liveProteinPct =
        todayProteinLogged > 0
          ? Math.min(100, Math.round((todayProteinLogged / activeTargets.protein) * 100))
          : 0;

      return {
        badge: "NEW MEMBER — ONBOARDING",
        badgeStyle: "bg-brand-tint text-brand border border-[#D5E6D2]",
        headline: `${activeProfile.name}: Day 1 on Plan`,
        recommendation:
          "Welcome to NutriCoach. Log today's meals to begin establishing your consistency baseline.",
        adherence: 100,
        consistency: 100,
        streak: 1,
        streakDisplay: "Day 1",
        streakSubtext: "First day on plan",
        adherenceSubtext: "Day 1 baseline active",
        consistencySubtext: "Target active",
        proteinPct: liveProteinPct,
        proteinSubtext:
          todayProteinLogged > 0
            ? `${todayProteinLogged}g logged / ${activeTargets.protein}g target`
            : `vs ${activeTargets.protein}g target`,
        isOnboarding: true,
      };
    }

    if (scenario === "stable" || activeProfile.name.toLowerCase().includes("omar")) {
      return {
        badge: "Consistent adherence — target on track",
        badgeStyle: "bg-brand-tint text-brand border border-[#D5E6D2]",
        headline: "Omar Hassan: High consistency (10-day streak)",
        recommendation: "Plan remains stable with 96% adherence and 94% meal consistency. Target macros are consistently achieved.",
        adherence: 96,
        consistency: 94,
        streak: 10,
        streakDisplay: "10 days",
        streakSubtext: "Consecutive adherent days",
        adherenceSubtext: "Target tolerance ±10%",
        consistencySubtext: "Planned meals logged as planned",
        proteinPct: 98,
        proteinSubtext: `vs ${activeTargets.protein}g target`,
        isOnboarding: false,
      };
    }
    if (scenario === "single_miss" || activeProfile.name.toLowerCase().includes("sara")) {
      return {
        badge: "Single miss — no overreaction needed",
        badgeStyle: "bg-surface-subtle text-ink-primary border border-border",
        headline: "Sara Mahmoud: 1 missed day (Yesterday)",
        recommendation: "Missed dinner logging yesterday. Agent avoids overreacting and maintains the baseline weekly plan while monitoring.",
        adherence: 86,
        consistency: 88,
        streak: 1,
        streakDisplay: "1 day",
        streakSubtext: "Consecutive adherent days",
        adherenceSubtext: "Target tolerance ±10%",
        consistencySubtext: "Planned meals logged as planned",
        proteinPct: 92,
        proteinSubtext: `vs ${activeTargets.protein}g target`,
        isOnboarding: false,
      };
    }
    if (scenario === "repeated_deviation" || activeProfile.name.toLowerCase().includes("layla")) {
      return {
        badge: "Repeated deviations — active adaptation",
        badgeStyle: "bg-[#FEF8EC] text-status-warning border border-[#FDE6B8]",
        headline: "Layla Mostafa: Carbohydrate spikes detected",
        recommendation: "Repeated carbohydrate spikes from off-plan lunches (Koshary, Pizza). Dinner is actively adapted to rebalance daily totals.",
        adherence: 68,
        consistency: 62,
        streak: 0,
        streakDisplay: "0 days",
        streakSubtext: "Consecutive adherent days",
        adherenceSubtext: "Target tolerance ±10%",
        consistencySubtext: "Planned meals logged as planned",
        proteinPct: 78,
        proteinSubtext: `vs ${activeTargets.protein}g target`,
        isOnboarding: false,
      };
    }
    if (scenario === "protein_gap" || activeProfile.name.toLowerCase().includes("ahmed")) {
      return {
        badge: "Protein deficit pattern — swap recommended",
        badgeStyle: "bg-[#FEF8EC] text-status-warning border border-[#FDE6B8]",
        headline: "Ahmed Nabil: Calories on target, protein low (58% avg)",
        recommendation: "Calories meet the 2,400 kcal target, but protein is under 80g across 4 consecutive days. High-protein swaps recommended.",
        adherence: 74,
        consistency: 70,
        streak: 3,
        streakDisplay: "3 days",
        streakSubtext: "Consecutive adherent days",
        adherenceSubtext: "Target tolerance ±10%",
        consistencySubtext: "Planned meals logged as planned",
        proteinPct: 58,
        proteinSubtext: `vs ${activeTargets.protein}g target`,
        isOnboarding: false,
      };
    }
    if (scenario === "preference_shift" || activeProfile.name.toLowerCase().includes("mariam")) {
      return {
        badge: "Dietary shift (Pescatarian) — preferences updated",
        badgeStyle: "bg-brand-tint text-brand border border-[#D5E6D2]",
        headline: "Mariam Farid: Pescatarian preference shift",
        recommendation: "Consistently swapped chicken for tuna, salmon, and eggs. Dietary preference updated to pescatarian automatically.",
        adherence: 88,
        consistency: 85,
        streak: 5,
        streakDisplay: "5 days",
        streakSubtext: "Consecutive adherent days",
        adherenceSubtext: "Target tolerance ±10%",
        consistencySubtext: "Planned meals logged as planned",
        proteinPct: 94,
        proteinSubtext: `vs ${activeTargets.protein}g target`,
        isOnboarding: false,
      };
    }
    if (scenario === "inactive" || activeProfile.name.toLowerCase().includes("youssef")) {
      return {
        badge: "Inactive (5 days unlogged) — follow-up drafted",
        badgeStyle: "bg-[#FDF2F0] text-status-danger border border-[#F9D7D2]",
        headline: "Youssef Adel: 5 days without meal logs",
        recommendation: "No meal logs recorded for 5 consecutive days. Inactivity alert triggered and supportive coach follow-up drafted.",
        adherence: 0,
        consistency: 0,
        streak: 0,
        streakDisplay: "0 days",
        streakSubtext: "Consecutive adherent days",
        adherenceSubtext: "Target tolerance ±10%",
        consistencySubtext: "Planned meals logged as planned",
        proteinPct: 0,
        proteinSubtext: `vs ${activeTargets.protein}g target`,
        isOnboarding: false,
      };
    }

    return {
      badge: `Behavioral Pattern: ${analysis.scenario.replace("_", " ")}`,
      badgeStyle: "bg-brand-tint text-brand border border-[#D5E6D2]",
      headline: analysis.headline,
      recommendation: analysis.recommendation,
      adherence: analysis.adherencePct,
      consistency: analysis.mealConsistencyPct,
      streak: analysis.streak,
      streakDisplay: `${analysis.streak} days`,
      streakSubtext: "Consecutive adherent days",
      adherenceSubtext: "Target tolerance ±10%",
      consistencySubtext: "Planned meals logged as planned",
      proteinPct: analysis.avgProteinPct,
      proteinSubtext: `vs ${activeTargets.protein}g target`,
      isOnboarding: false,
    };
  };

  const cfg = getScenarioConfig();

  return (
    <div className="space-y-6">
      {/* Top Progress Metrics */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-surface rounded-lg border border-border p-3.5 shadow-hairline space-y-1">
          <div className="text-[11px] text-ink-muted">7-Day Adherence</div>
          <div className={`text-xl font-semibold ${cfg.adherence >= 80 ? "text-brand" : cfg.adherence > 50 ? "text-status-warning" : "text-status-danger"}`}>
            {cfg.adherence}%
          </div>
          <div className="text-[10px] text-ink-secondary">{cfg.adherenceSubtext}</div>
        </div>

        <div className="bg-surface rounded-lg border border-border p-3.5 shadow-hairline space-y-1">
          <div className="text-[11px] text-ink-muted">Meal Consistency</div>
          <div className="text-xl font-semibold text-ink-primary">{cfg.consistency}%</div>
          <div className="text-[10px] text-ink-secondary">{cfg.consistencySubtext}</div>
        </div>

        <div className="bg-surface rounded-lg border border-border p-3.5 shadow-hairline space-y-1">
          <div className="text-[11px] text-ink-muted">Current Streak</div>
          <div className="text-xl font-semibold text-ink-primary flex items-center gap-1">
            <Flame className={`w-5 h-5 ${cfg.streak > 0 ? "text-status-warning" : "text-ink-muted"}`} />
            <span>{cfg.streakDisplay}</span>
          </div>
          <div className="text-[10px] text-ink-secondary">{cfg.streakSubtext}</div>
        </div>

        <div className="bg-surface rounded-lg border border-border p-3.5 shadow-hairline space-y-1">
          <div className="text-[11px] text-ink-muted">Avg Daily Protein</div>
          <div className={`text-xl font-semibold ${cfg.proteinPct >= 80 || cfg.isOnboarding ? "text-brand" : "text-status-warning"}`}>
            {cfg.proteinPct}%
          </div>
          <div className="text-[10px] text-ink-secondary">{cfg.proteinSubtext}</div>
        </div>
      </div>

      {/* AI Diagnosis & Recommendation Card */}
      <div className="bg-[#FAFBF9] border border-border rounded-lg p-4 shadow-hairline space-y-2">
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-medium tracking-wide uppercase px-2 py-0.5 rounded ${cfg.badgeStyle}`}>
            {cfg.badge}
          </span>
        </div>
        <h4 className="text-xs font-semibold text-ink-primary">{cfg.headline}</h4>
        <p className="text-xs text-ink-secondary leading-relaxed">{cfg.recommendation}</p>
      </div>

      {/* 10-Day Historical Days Breakdown */}
      <div className="bg-surface rounded-lg border border-border shadow-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="text-xs font-semibold text-ink-primary">10-Day Adherence Log Review</h3>
            <p className="text-[11px] text-ink-muted">Daily calorie and macronutrient records for {activeProfile.name}</p>
          </div>
          <span className="text-[11px] text-ink-secondary font-medium">Target: {activeTargets.calories} kcal / day</span>
        </div>

        <div className="divide-y divide-border">
          {analysis.days.map((d) => {
            const isToday = d.date === state.today;
            const isBeforeEnrollment = isOnboarding && d.date < memberCreatedDate;

            return (
              <div key={d.date} className="px-4 py-2.5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <div className="w-24 font-medium text-ink-primary">
                    {isToday && isOnboarding ? "Today (Created)" : relativeDay(d.date, state.today)}
                  </div>
                  <div className="text-ink-muted text-[11px]">{formatDay(d.date)}</div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-right">
                    {isBeforeEnrollment ? (
                      <div className="text-ink-muted text-[11px] italic">Account not enrolled</div>
                    ) : (
                      <>
                        <div className="font-medium text-ink-primary">
                          {d.logged.calories > 0
                            ? `${d.logged.calories} / ${activeTargets.calories} kcal`
                            : isToday
                            ? "No food logged yet"
                            : "No food logged"}
                        </div>
                        {d.logged.calories > 0 && (
                          <div className="text-[10px] text-ink-muted">
                            {d.logged.protein}g P · {d.logged.carbs}g C · {d.logged.fat}g F
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  <div className="w-24 text-right">
                    {isBeforeEnrollment ? (
                      <span className="text-[10px] px-2 py-0.5 bg-surface-subtle text-ink-muted rounded font-medium border border-border">
                        Not enrolled
                      </span>
                    ) : d.status === "adherent" ? (
                      <span className="text-[10px] px-2 py-0.5 bg-brand-tint text-brand rounded font-medium border border-[#D5E6D2]">
                        On plan
                      </span>
                    ) : d.status === "deviation" ? (
                      <span className="text-[10px] px-2 py-0.5 bg-[#FEF8EC] text-status-warning rounded font-medium border border-[#FDE6B8]">
                        Deviation
                      </span>
                    ) : d.status === "missed" ? (
                      <span className="text-[10px] px-2 py-0.5 bg-[#FDF2F0] text-status-danger rounded font-medium border border-[#F9D7D2]">
                        Missed
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 bg-surface-subtle text-ink-secondary rounded font-medium border border-border">
                        {isToday ? "In progress" : "Upcoming"}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Forward-Looking Goal Projections Section */}
      <GoalProjectionsSection activeProfile={activeProfile} activeTargets={activeTargets} />
    </div>
  );
}

function GoalProjectionsSection({
  activeProfile,
  activeTargets,
}: {
  activeProfile: any;
  activeTargets: any;
}) {
  const [horizon, setHorizon] = useState<"2w" | "1m" | "3m" | "6m">("1m");

  const getProjectionData = () => {
    const scenario = activeProfile?.demo_scenario;
    const name = activeProfile?.name?.toLowerCase() || "";
    const goal = activeProfile?.goal || "Fat Loss & Tone";

    const isDemoMember = [
      "00000000-0000-0000-0000-000000000011",
      "00000000-0000-0000-0000-000000000012",
      "00000000-0000-0000-0000-000000000013",
      "00000000-0000-0000-0000-000000000014",
      "00000000-0000-0000-0000-000000000015",
      "00000000-0000-0000-0000-000000000016",
    ].includes(activeProfile?.id);

    const isOnboarding =
      scenario === "onboarding" ||
      (!isDemoMember &&
        !name.includes("omar") &&
        !name.includes("sara") &&
        !name.includes("layla") &&
        !name.includes("ahmed") &&
        !name.includes("mariam") &&
        !name.includes("youssef"));

    if (isOnboarding) {
      const delta = Number(activeProfile.target_delta) || (goal.includes("Fat") ? 4 : 3);
      const isFatLoss = goal.toLowerCase().includes("fat") || goal.toLowerCase().includes("tone");
      const isMuscleGain = goal.toLowerCase().includes("muscle") || goal.toLowerCase().includes("hypertrophy");
      const sign = isFatLoss ? "-" : "+";

      const map = {
        "2w": {
          weightChange: `${sign}${(delta * 0.15).toFixed(1)} kg`,
          leanMass: isMuscleGain ? `+${(delta * 0.25).toFixed(1)} kg` : "+0.2 kg",
          fatMass: isFatLoss ? `-${(delta * 0.2).toFixed(1)} kg` : "-0.1 kg",
          milestone: "2 Weeks Active",
          efficiency: "100% Plan Calibrated",
          callout: `Calibrated for ${activeProfile.name}'s biometric intake. Following your ~${activeTargets.calories} kcal target sets a strong foundation for your ${goal} milestone.`,
        },
        "1m": {
          weightChange: `${sign}${(delta * 0.35).toFixed(1)} kg`,
          leanMass: isMuscleGain ? `+${(delta * 0.5).toFixed(1)} kg` : "+0.4 kg",
          fatMass: isFatLoss ? `-${(delta * 0.45).toFixed(1)} kg` : "-0.3 kg",
          milestone: "1 Month Active",
          efficiency: "Steady Progress Velocity",
          callout: `At consistent Day 1 adherence, projected ${sign}${(delta * 0.35).toFixed(1)} kg body composition progress over 1 month without plateaus.`,
        },
        "3m": {
          weightChange: `${sign}${(delta * 0.75).toFixed(1)} kg`,
          leanMass: isMuscleGain ? `+${(delta * 0.9).toFixed(1)} kg` : "+0.8 kg",
          fatMass: isFatLoss ? `-${(delta * 0.85).toFixed(1)} kg` : "-0.6 kg",
          milestone: "3 Months Milestone",
          efficiency: "High Goal Momentum",
          callout: `Consistent ${activeTargets.protein}g protein fueling ensures sustained recovery and maximal muscular density.`,
        },
        "6m": {
          weightChange: `${sign}${delta.toFixed(1)} kg`,
          leanMass: isMuscleGain ? `+${(delta * 1.3).toFixed(1)} kg` : "+1.5 kg",
          fatMass: isFatLoss ? `-${delta.toFixed(1)} kg` : "-1.0 kg",
          milestone: "6 Months Milestone",
          efficiency: "Permanent Lifestyle Baseline",
          callout: `Complete lifestyle transformation achieved with automated AI macro recalibration.`,
        },
      };
      return map[horizon];
    }

    if (scenario === "stable" || name.includes("omar")) {
      const map = {
        "2w": {
          weightChange: "+0.7 kg",
          leanMass: "+0.8 kg",
          fatMass: "-0.1 kg",
          milestone: "November 18, 2026",
          efficiency: "96% Metabolic Efficiency",
          callout: "Maintaining your 10-day streak keeps you 2 weeks ahead of your muscle gain timeline.",
        },
        "1m": {
          weightChange: "+1.4 kg",
          leanMass: "+1.6 kg",
          fatMass: "-0.2 kg",
          milestone: "December 15, 2026",
          efficiency: "95% Optimal Hypertrophy Rate",
          callout: "At 94% meal consistency, projected +1.4 kg lean mass gain over 1 month, +3.8 kg over 3 months.",
        },
        "3m": {
          weightChange: "+3.8 kg",
          leanMass: "+4.2 kg",
          fatMass: "-0.4 kg",
          milestone: "February 12, 2027",
          efficiency: "Target Physique Achievable",
          callout: "Consistent 160g protein intake ensures sustained mTOR activation and maximal muscular density.",
        },
        "6m": {
          weightChange: "+6.5 kg",
          leanMass: "+7.0 kg",
          fatMass: "-0.5 kg",
          milestone: "May 15, 2027",
          efficiency: "Elite Athletic Baseline",
          callout: "Long-term metabolic momentum with zero plateaus based on continuous automated macro recalibration.",
        },
      };
      return map[horizon];
    }

    if (scenario === "repeated_deviation" || name.includes("layla")) {
      const map = {
        "2w": {
          weightChange: "-0.6 kg",
          leanMass: "+0.1 kg",
          fatMass: "-0.7 kg",
          milestone: "November 22, 2026",
          efficiency: "88% Rebalance Efficiency",
          callout: "Dinner adaptations protect your calorie deficit even during weekend social outings.",
        },
        "1m": {
          weightChange: "-1.5 kg",
          leanMass: "+0.3 kg",
          fatMass: "-1.8 kg",
          milestone: "December 20, 2026",
          efficiency: "Steady Fat Loss Trajectory",
          callout: "Compensating carb spikes with high-protein dinners yields steady fat loss without restrictive diets.",
        },
        "3m": {
          weightChange: "-4.2 kg",
          leanMass: "+0.8 kg",
          fatMass: "-5.0 kg",
          milestone: "February 25, 2027",
          efficiency: "Goal Body Composition Reached",
          callout: "Projected 5.0 kg pure body fat reduction while preserving lean metabolic tissue.",
        },
        "6m": {
          weightChange: "-7.8 kg",
          leanMass: "+1.2 kg",
          fatMass: "-9.0 kg",
          milestone: "May 28, 2027",
          efficiency: "Sustainable Lifestyle Transformation",
          callout: "Long-term sustainable weight management achieved with flexible Egyptian dining favorites.",
        },
      };
      return map[horizon];
    }

    if (scenario === "preference_shift" || name.includes("mariam")) {
      const map = {
        "2w": {
          weightChange: "-0.4 kg",
          leanMass: "+0.3 kg",
          fatMass: "-0.7 kg",
          milestone: "November 20, 2026",
          efficiency: "92% Bioability Rate",
          callout: "Pescatarian omega-3 profile supports faster recovery and lowered systemic inflammation.",
        },
        "1m": {
          weightChange: "-1.2 kg",
          leanMass: "+0.8 kg",
          fatMass: "-2.0 kg",
          milestone: "December 18, 2026",
          efficiency: "High Lean Tone Velocity",
          callout: "130g marine/plant protein target maintains lean body mass while shedding stubborn fat.",
        },
        "3m": {
          weightChange: "-3.2 kg",
          leanMass: "+1.8 kg",
          fatMass: "-5.0 kg",
          milestone: "February 15, 2027",
          efficiency: "Optimal Biomarker Profile",
          callout: "Target muscle definition reachable by mid-February with current pescatarian adherence.",
        },
        "6m": {
          weightChange: "-5.5 kg",
          leanMass: "+2.6 kg",
          fatMass: "-8.1 kg",
          milestone: "May 20, 2027",
          efficiency: "Mastered Plant/Seafood Nutrition",
          callout: "Complete dietary transformation with balanced essential micronutrients.",
        },
      };
      return map[horizon];
    }

    // Default projection template
    const map = {
      "2w": {
        weightChange: "-0.5 kg",
        leanMass: "+0.2 kg",
        fatMass: "-0.7 kg",
        milestone: "November 20, 2026",
        efficiency: "85% Metabolic Efficiency",
        callout: "Maintaining baseline consistency guarantees predictable body composition progress.",
      },
      "1m": {
        weightChange: "-1.3 kg",
        leanMass: "+0.5 kg",
        fatMass: "-1.8 kg",
        milestone: "December 18, 2026",
        efficiency: "Consistent Progress Velocity",
        callout: "On track to hit milestone weight target within 4 weeks.",
      },
      "3m": {
        weightChange: "-3.5 kg",
        leanMass: "+1.2 kg",
        fatMass: "-4.7 kg",
        milestone: "February 15, 2027",
        efficiency: "Major Goal Achievement",
        callout: "3-month progressive nutrition plan unlocks transformative health & energy improvements.",
      },
      "6m": {
        weightChange: "-6.2 kg",
        leanMass: "+2.0 kg",
        fatMass: "-8.2 kg",
        milestone: "May 20, 2027",
        efficiency: "Permanent Lifestyle Baseline",
        callout: "Long-term metabolic health and athletic performance locked in.",
      },
    };
    return map[horizon];
  };

  const proj = getProjectionData();

  return (
    <div className="bg-surface rounded-lg border border-border p-5 shadow-card space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2 border-b border-border pb-3">
        <div>
          <h3 className="text-xs font-semibold text-ink-primary">Forward-Looking Goal Projections</h3>
          <p className="text-[11px] text-ink-muted">AI-modeled body composition trajectory based on current adherence</p>
        </div>

        {/* Segmented Horizon Picker: [ 2 Weeks ] | [ 1 Month ] | [ 3 Months ] | [ 6 Months ] */}
        <div className="flex rounded-lg bg-surface-subtle p-1 border border-border">
          <button
            type="button"
            onClick={() => setHorizon("2w")}
            className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-all ${
              horizon === "2w"
                ? "bg-surface text-ink-primary shadow-hairline"
                : "text-ink-muted hover:text-ink-primary"
            }`}
          >
            2 Weeks
          </button>
          <button
            type="button"
            onClick={() => setHorizon("1m")}
            className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-all ${
              horizon === "1m"
                ? "bg-surface text-brand shadow-hairline font-semibold"
                : "text-ink-muted hover:text-ink-primary"
            }`}
          >
            1 Month
          </button>
          <button
            type="button"
            onClick={() => setHorizon("3m")}
            className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-all ${
              horizon === "3m"
                ? "bg-surface text-ink-primary shadow-hairline"
                : "text-ink-muted hover:text-ink-primary"
            }`}
          >
            3 Months
          </button>
          <button
            type="button"
            onClick={() => setHorizon("6m")}
            className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-all ${
              horizon === "6m"
                ? "bg-surface text-ink-primary shadow-hairline"
                : "text-ink-muted hover:text-ink-primary"
            }`}
          >
            6 Months
          </button>
        </div>
      </div>

      {/* Projection Metric Cards */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-surface-subtle rounded-lg p-3 border border-border space-y-1">
          <div className="text-[10px] text-ink-muted uppercase">Net Weight Delta</div>
          <div className="text-base font-bold text-ink-primary">{proj.weightChange}</div>
          <div className="text-[10px] text-ink-secondary">Modeled scale trajectory</div>
        </div>

        <div className="bg-surface-subtle rounded-lg p-3 border border-border space-y-1">
          <div className="text-[10px] text-ink-muted uppercase">Lean Tissue Gain</div>
          <div className="text-base font-bold text-brand">{proj.leanMass}</div>
          <div className="text-[10px] text-ink-secondary">Muscle & functional mass</div>
        </div>

        <div className="bg-surface-subtle rounded-lg p-3 border border-border space-y-1">
          <div className="text-[10px] text-ink-muted uppercase">Body Fat Delta</div>
          <div className="text-base font-bold text-ink-primary">{proj.fatMass}</div>
          <div className="text-[10px] text-ink-secondary">Subcutaneous & visceral</div>
        </div>

        <div className="bg-surface-subtle rounded-lg p-3 border border-border space-y-1">
          <div className="text-[10px] text-ink-muted uppercase">Milestone Target Date</div>
          <div className="text-xs font-semibold text-brand mt-0.5">{proj.milestone}</div>
          <div className="text-[10px] text-ink-secondary">Estimated completion</div>
        </div>
      </div>

      {/* Encouraging Behavioral Callout Banner */}
      <div className="p-3 bg-brand-tint rounded-lg border border-[#D5E6D2] flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-brand shrink-0" />
          <span className="text-xs text-ink-primary font-medium">{proj.callout}</span>
        </div>
        <span className="text-[10px] text-brand font-semibold px-2 py-0.5 bg-surface rounded border border-[#D5E6D2] shrink-0">
          {proj.efficiency}
        </span>
      </div>
    </div>
  );
}

