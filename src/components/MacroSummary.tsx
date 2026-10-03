"use client";

import React from "react";
import { useNutriCoach } from "./NutriCoachContext";

export function MacroSummary() {
  const { activeTargets, todayLoggedMacros, todayRemainingMacros } = useNutriCoach();

  const macros = [
    {
      label: "Calories",
      current: todayLoggedMacros.calories,
      target: activeTargets.calories,
      unit: "kcal",
      remaining: todayRemainingMacros.calories,
    },
    {
      label: "Protein",
      current: todayLoggedMacros.protein,
      target: activeTargets.protein,
      unit: "g",
      remaining: todayRemainingMacros.protein,
    },
    {
      label: "Carbs",
      current: todayLoggedMacros.carbs,
      target: activeTargets.carbs,
      unit: "g",
      remaining: todayRemainingMacros.carbs,
    },
    {
      label: "Fat",
      current: todayLoggedMacros.fat,
      target: activeTargets.fat,
      unit: "g",
      remaining: todayRemainingMacros.fat,
    },
  ];

  return (
    <div className="bg-surface rounded-lg border border-border p-4 shadow-card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-medium text-ink-primary">Today&apos;s Nutrition Targets</h3>
        <span className="text-[11px] text-ink-muted">
          Remaining: <span className="font-medium text-ink-secondary">{todayRemainingMacros.calories} kcal</span>
        </span>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {macros.map((m) => {
          const pct = Math.min(100, Math.round((m.current / m.target) * 100));
          const isOver = m.current > m.target;
          return (
            <div key={m.label} className="space-y-1.5">
              <div className="flex items-baseline justify-between text-[11px]">
                <span className="text-ink-secondary font-medium">{m.label}</span>
                <span className="text-ink-muted">
                  <span className={`font-medium ${isOver ? "text-status-warning" : "text-ink-primary"}`}>
                    {m.current}
                  </span>{" "}
                  / {m.target} {m.unit}
                </span>
              </div>

              {/* Minimalist 4px Sage Progress Bar */}
              <div className="w-full bg-surface-subtle h-1 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    isOver ? "bg-status-warning" : "bg-brand"
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>

              <div className="text-[10px] text-ink-muted flex justify-between">
                <span>{pct}% met</span>
                <span>{m.remaining > 0 ? `${m.remaining} ${m.unit} left` : "Target reached"}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
