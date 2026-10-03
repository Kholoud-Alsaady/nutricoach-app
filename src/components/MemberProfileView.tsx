"use client";

import React, { useState } from "react";
import { Check, ShieldCheck, User } from "lucide-react";
import { useNutriCoach } from "./NutriCoachContext";

export function MemberProfileView() {
  const { activeProfile, activeTargets } = useNutriCoach();

  return (
    <div className="space-y-6">
      {/* Profile Overview Card */}
      <div className="bg-surface rounded-lg border border-border p-5 shadow-card space-y-4">
        <div className="flex items-center gap-3 border-b border-border pb-4">
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

        <div className="grid grid-cols-2 gap-4 text-xs">
          <div>
            <span className="text-[11px] text-ink-muted block mb-0.5">Primary Nutrition Goal</span>
            <span className="font-medium text-ink-primary">{activeProfile.goal || "Healthy Maintenance"}</span>
          </div>

          <div>
            <span className="text-[11px] text-ink-muted block mb-0.5">Activity Level</span>
            <span className="font-medium text-ink-primary capitalize">{activeProfile.activity_level || "Moderate"}</span>
          </div>

          <div>
            <span className="text-[11px] text-ink-muted block mb-0.5">Dietary Preferences</span>
            <span className="text-ink-secondary">
              {activeProfile.dietary_preferences.length ? activeProfile.dietary_preferences.join(", ") : "None specified"}
            </span>
          </div>

          <div>
            <span className="text-[11px] text-ink-muted block mb-0.5">Disliked Foods</span>
            <span className="text-ink-secondary">
              {activeProfile.disliked_foods.length ? activeProfile.disliked_foods.join(", ") : "None"}
            </span>
          </div>
        </div>
      </div>

      {/* Target Breakdown */}
      <div className="bg-surface rounded-lg border border-border p-5 shadow-card space-y-3">
        <div className="flex items-center justify-between border-b border-border pb-2">
          <h4 className="text-xs font-medium text-ink-primary">Prescribed Daily Nutrition Targets</h4>
          <span className="text-[11px] text-brand font-medium">Coach Verified</span>
        </div>

        <div className="grid grid-cols-4 gap-3 text-center">
          <div className="bg-surface-subtle p-3 rounded-md border border-border">
            <div className="text-[11px] text-ink-muted">Energy</div>
            <div className="text-base font-semibold text-ink-primary mt-0.5">{activeTargets.calories}</div>
            <div className="text-[10px] text-ink-muted">kcal / day</div>
          </div>

          <div className="bg-surface-subtle p-3 rounded-md border border-border">
            <div className="text-[11px] text-ink-muted">Protein</div>
            <div className="text-base font-semibold text-brand mt-0.5">{activeTargets.protein}g</div>
            <div className="text-[10px] text-ink-muted">{Math.round((activeTargets.protein * 4 / activeTargets.calories) * 100)}% calories</div>
          </div>

          <div className="bg-surface-subtle p-3 rounded-md border border-border">
            <div className="text-[11px] text-ink-muted">Carbohydrates</div>
            <div className="text-base font-semibold text-ink-primary mt-0.5">{activeTargets.carbs}g</div>
            <div className="text-[10px] text-ink-muted">{Math.round((activeTargets.carbs * 4 / activeTargets.calories) * 100)}% calories</div>
          </div>

          <div className="bg-surface-subtle p-3 rounded-md border border-border">
            <div className="text-[11px] text-ink-muted">Fats</div>
            <div className="text-base font-semibold text-ink-primary mt-0.5">{activeTargets.fat}g</div>
            <div className="text-[10px] text-ink-muted">{Math.round((activeTargets.fat * 9 / activeTargets.calories) * 100)}% calories</div>
          </div>
        </div>
      </div>
    </div>
  );
}
