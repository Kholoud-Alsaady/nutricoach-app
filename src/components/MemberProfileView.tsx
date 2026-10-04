"use client";

import React from "react";
import { AlertTriangle, CheckCircle2, ShieldAlert, Sparkles, Target, User } from "lucide-react";
import { useNutriCoach } from "./NutriCoachContext";

export function MemberProfileView() {
  const { activeProfile, activeTargets } = useNutriCoach();

  const getGoalBadgeText = () => {
    if (activeProfile.target_delta && activeProfile.target_delta > 0) {
      if (activeProfile.goal?.toLowerCase().includes("fat loss")) {
        return `Lose ${activeProfile.target_delta} ${activeProfile.target_unit === "% body fat" ? "% body fat" : "kg"}`;
      }
      if (activeProfile.goal?.toLowerCase().includes("muscle")) {
        return `Gain +${activeProfile.target_delta} ${activeProfile.target_unit === "% body fat" ? "% muscle" : "kg Muscle"}`;
      }
      return `Target: ±${activeProfile.target_delta} ${activeProfile.target_unit || "kg"}`;
    }
    return activeProfile.goal || "Healthy Maintenance";
  };

  return (
    <div className="space-y-6">
      {/* Profile Overview Card */}
      <div className="bg-surface rounded-lg border border-border p-5 shadow-card space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-4 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-brand-tint text-brand flex items-center justify-center font-bold text-base">
              {activeProfile.name.charAt(0)}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-ink-primary">{activeProfile.name}</h3>
              <p className="text-xs text-ink-muted">
                {activeProfile.email} · {activeProfile.sex} · {activeProfile.age} yrs · {activeProfile.height} cm · {activeProfile.weight} kg
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-md bg-brand-tint text-brand border border-[#D5E6D2] flex items-center gap-1">
              <span>🎯 Goal:</span>
              <span>{getGoalBadgeText()}</span>
            </span>

            {activeProfile.allergies && activeProfile.allergies.map((allergy) => (
              <span
                key={allergy}
                className="text-[11px] font-semibold px-2.5 py-1 rounded-md bg-[#FEF2F2] text-status-danger border border-[#FCA5A5] flex items-center gap-1"
              >
                <span>⚠️ Allergy:</span>
                <span>{allergy}</span>
              </span>
            ))}

            {activeProfile.disliked_foods && activeProfile.disliked_foods.map((food) => (
              <span
                key={food}
                className="text-[11px] font-medium px-2.5 py-1 rounded-md bg-surface-subtle text-ink-secondary border border-border flex items-center gap-1"
              >
                <span>🚫 Excludes:</span>
                <span>{food.replace(/^no\s+/i, "")}</span>
              </span>
            ))}
          </div>
        </div>

        {/* Quantitative Goal Details */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-surface-subtle p-3.5 rounded-lg border border-border">
          <div>
            <span className="text-[10px] text-ink-muted uppercase tracking-wider block mb-1">Primary Nutrition Goal</span>
            <div className="font-semibold text-xs text-ink-primary">{activeProfile.goal || "Fat Loss & Tone"}</div>
          </div>

          <div>
            <span className="text-[10px] text-ink-muted uppercase tracking-wider block mb-1">Quantitative Target</span>
            <div className="font-semibold text-xs text-brand flex items-center gap-1">
              <Target className="w-3.5 h-3.5" />
              <span>
                {activeProfile.target_delta && activeProfile.target_delta > 0
                  ? `${activeProfile.target_delta} ${activeProfile.target_unit || "kg"}`
                  : "Maintenance (0 kg delta)"}
              </span>
            </div>
          </div>

          <div>
            <span className="text-[10px] text-ink-muted uppercase tracking-wider block mb-1">Activity Level</span>
            <div className="font-semibold text-xs text-ink-primary capitalize">{activeProfile.activity_level || "Moderate (3-5 sessions/wk)"}</div>
          </div>
        </div>

        {/* Dietary Restrictions & Allergy Guardrails */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs pt-1">
          {/* Allergies Card */}
          <div className="border border-[#FCA5A5]/80 bg-gradient-to-br from-[#FEF2F2]/50 to-surface p-3.5 rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-status-danger text-xs flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Allergies & Intolerances (Guardrails)</span>
              </span>
              <span className="text-[10px] text-status-danger font-medium">Strictly Filtered</span>
            </div>

            <div className="flex flex-wrap gap-1.5 pt-1">
              {activeProfile.allergies && activeProfile.allergies.length > 0 ? (
                activeProfile.allergies.map((allergy) => (
                  <span
                    key={allergy}
                    className="text-[11px] font-semibold px-2.5 py-1 rounded bg-[#FEF2F2] text-status-danger border border-[#FCA5A5]"
                  >
                    ⚠️ {allergy}
                  </span>
                ))
              ) : (
                <span className="text-ink-muted text-xs">No known allergies reported</span>
              )}
            </div>
          </div>

          {/* Exclusions & Preferences Card */}
          <div className="border border-border bg-surface-subtle p-3.5 rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-ink-primary text-xs flex items-center gap-1.5">
                <span>🚫 Excluded Foods & Preferences</span>
              </span>
              <span className="text-[10px] text-ink-muted font-medium">Excluded in Planner</span>
            </div>

            <div className="flex flex-wrap gap-1.5 pt-1">
              {activeProfile.disliked_foods && activeProfile.disliked_foods.length > 0 ? (
                activeProfile.disliked_foods.map((item) => (
                  <span
                    key={item}
                    className="text-[11px] font-medium px-2.5 py-1 rounded bg-surface text-ink-secondary border border-border"
                  >
                    🚫 {item.replace(/^no\s+/i, "")}
                  </span>
                ))
              ) : (
                <span className="text-ink-muted text-xs">No excluded ingredients</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Target Breakdown */}
      <div className="bg-surface rounded-lg border border-border p-5 shadow-card space-y-3">
        <div className="flex items-center justify-between border-b border-border pb-2">
          <h4 className="text-xs font-semibold text-ink-primary flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-brand" />
            <span>Prescribed Daily Nutrition Targets</span>
          </h4>
          <span className="text-[11px] text-brand font-medium">Coach Verified · Calibrated</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
          <div className="bg-surface-subtle p-3.5 rounded-md border border-border">
            <div className="text-[11px] text-ink-muted font-medium">Energy</div>
            <div className="text-lg font-bold text-ink-primary mt-0.5">{activeTargets.calories}</div>
            <div className="text-[10px] text-ink-muted">kcal / day</div>
          </div>

          <div className="bg-surface-subtle p-3.5 rounded-md border border-border">
            <div className="text-[11px] text-ink-muted font-medium">Protein</div>
            <div className="text-lg font-bold text-brand mt-0.5">{activeTargets.protein}g</div>
            <div className="text-[10px] text-ink-muted">{Math.round((activeTargets.protein * 4 / activeTargets.calories) * 100)}% calories</div>
          </div>

          <div className="bg-surface-subtle p-3.5 rounded-md border border-border">
            <div className="text-[11px] text-ink-muted font-medium">Carbohydrates</div>
            <div className="text-lg font-bold text-ink-primary mt-0.5">{activeTargets.carbs}g</div>
            <div className="text-[10px] text-ink-muted">{Math.round((activeTargets.carbs * 4 / activeTargets.calories) * 100)}% calories</div>
          </div>

          <div className="bg-surface-subtle p-3.5 rounded-md border border-border">
            <div className="text-[11px] text-ink-muted font-medium">Fats</div>
            <div className="text-lg font-bold text-ink-primary mt-0.5">{activeTargets.fat}g</div>
            <div className="text-[10px] text-ink-muted">{Math.round((activeTargets.fat * 9 / activeTargets.calories) * 100)}% calories</div>
          </div>
        </div>
      </div>
    </div>
  );
}
