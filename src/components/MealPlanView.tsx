"use client";

import React, { useState } from "react";
import { addDays, formatDay, relativeDay } from "@/lib/dates";
import { RefreshCw, Sparkles, Utensils, X } from "lucide-react";
import { useNutriCoach } from "./NutriCoachContext";
import type { MealSnapshot, MealType } from "@/lib/types";

export function MealPlanView() {
  const {
    state,
    activeProfile,
    activeTargets,
    activePlannedMeals,
    replaceMealSlot,
    adaptDailyPlan,
    weeklySmoothingEnabled,
    toggleWeeklySmoothing,
    weeklyRebalanceInfo,
    selectedPlanDayOffset,
    setSelectedPlanDayOffset,
  } = useNutriCoach();

  // Replace meal modal state
  const [replacingSlot, setReplacingSlot] = useState<MealType | null>(null);
  const [replaceTab, setReplaceTab] = useState<"suggest" | "custom">("suggest");
  const [customReplaceName, setCustomReplaceName] = useState("");
  const [customReplaceMode, setCustomReplaceMode] = useState<"calories" | "grams">("calories");
  const [customReplaceCals, setCustomReplaceCals] = useState<number>(550);
  const [customReplaceProtein, setCustomReplaceProtein] = useState<number>(40);
  const [customReplaceCarbs, setCustomReplaceCarbs] = useState<number>(60);
  const [customReplaceFat, setCustomReplaceFat] = useState<number>(16);

  const today = state.today;
  const currentSelectedDate = addDays(today, selectedPlanDayOffset);

  // Effective day target based on weekly smoothing
  const effectiveDayTarget =
    selectedPlanDayOffset > 0 && weeklySmoothingEnabled && weeklyRebalanceInfo.isSignificant
      ? activeTargets.calories + weeklyRebalanceInfo.dailyAdjustment
      : activeTargets.calories;

  // 7-day selector
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(today, i);
    const dayTarget =
      i > 0 && weeklySmoothingEnabled && weeklyRebalanceInfo.isSignificant
        ? activeTargets.calories + weeklyRebalanceInfo.dailyAdjustment
        : activeTargets.calories;

    return {
      offset: i,
      date,
      label: relativeDay(date, today),
      short: formatDay(date, { weekday: "short" }),
      target: dayTarget,
    };
  });

  const selectedMeals = activePlannedMeals.filter((p) => p.date === currentSelectedDate);
  const dayCalories = selectedMeals.reduce((s, m) => s + m.calories, 0);
  const dayProtein = selectedMeals.reduce((s, m) => s + m.protein, 0);

  const openReplaceModal = (slot: MealType) => {
    const meal = selectedMeals.find((m) => m.meal_type === slot);
    setReplacingSlot(slot);
    setReplaceTab("suggest");
    setCustomReplaceName("");
    setCustomReplaceCals(meal?.calories || 550);
    setCustomReplaceProtein(meal?.protein || 40);
    setCustomReplaceCarbs(meal?.carbs || 60);
    setCustomReplaceFat(meal?.fat || 16);
  };

  const getSmartSuggestions = (slot: MealType): MealSnapshot[] => {
    if (slot === "breakfast") {
      return [
        { meal_name: "Greek yogurt bowl with honey & mixed berries", calories: 420, protein: 32, carbs: 46, fat: 12, ingredients: ["greek yogurt", "honey", "berries", "chia seeds"], tags: ["breakfast", "dairy", "high-protein"] },
        { meal_name: "Egg white & vegetable omelet with baladi toast", calories: 390, protein: 34, carbs: 42, fat: 9, ingredients: ["egg whites", "spinach", "baladi bread", "olive oil"], tags: ["breakfast", "eggs"] },
        { meal_name: "Ful medames with boiled egg & cumin tahini", calories: 480, protein: 30, carbs: 58, fat: 14, ingredients: ["fava beans", "egg", "tahini", "baladi bread"], tags: ["egyptian", "breakfast"] },
      ];
    }
    if (slot === "lunch" || slot === "dinner") {
      return [
        { meal_name: "Seared Salmon with quinoa & steamed asparagus", calories: 620, protein: 46, carbs: 54, fat: 22, ingredients: ["salmon", "quinoa", "asparagus", "lemon", "olive oil"], tags: ["fish", "pescatarian", "omega-3"] },
        { meal_name: "Tofu stir-fry with edamame & jasmine rice", calories: 540, protein: 38, carbs: 66, fat: 14, ingredients: ["firm tofu", "edamame", "bell peppers", "jasmine rice", "sesame oil"], tags: ["vegan", "plant-protein"] },
        { meal_name: "Grilled sea bass with brown rice & tahini", calories: 590, protein: 44, carbs: 62, fat: 18, ingredients: ["sea bass", "brown rice", "tahini", "greens"], tags: ["egyptian", "fish"] },
      ];
    }
    return [
      { meal_name: "Protein shake with almond butter & banana", calories: 280, protein: 28, carbs: 22, fat: 8, ingredients: ["whey protein", "almond milk", "almond butter", "banana"], tags: ["snack", "high-protein"] },
      { meal_name: "Cottage cheese with fresh fruit & walnuts", calories: 240, protein: 26, carbs: 20, fat: 6, ingredients: ["cottage cheese", "strawberries", "walnuts"], tags: ["snack", "dairy"] },
    ];
  };

  const handleSelectSuggestion = (meal: MealSnapshot) => {
    if (!replacingSlot) return;
    replaceMealSlot({ mealType: replacingSlot, date: currentSelectedDate, meal, source: "agent", rebalanceDinner: true });
    setReplacingSlot(null);
  };

  const handleApplyCustomMeal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replacingSlot) return;

    let finalCals = customReplaceCals;
    let finalProtein = customReplaceProtein;
    let finalCarbs = customReplaceCarbs;
    let finalFat = customReplaceFat;

    if (customReplaceMode === "grams") {
      finalCals = customReplaceProtein * 4 + customReplaceCarbs * 4 + customReplaceFat * 9;
    } else {
      finalProtein = Math.round((customReplaceCals * 0.28) / 4);
      finalCarbs = Math.round((customReplaceCals * 0.48) / 4);
      finalFat = Math.round((customReplaceCals * 0.24) / 9);
    }

    const customMeal: MealSnapshot = {
      meal_name: customReplaceName.trim() || `Custom ${replacingSlot.charAt(0).toUpperCase() + replacingSlot.slice(1)}`,
      calories: finalCals,
      protein: finalProtein,
      carbs: finalCarbs,
      fat: finalFat,
      ingredients: [],
      tags: ["custom"],
    };

    replaceMealSlot({ mealType: replacingSlot, date: currentSelectedDate, meal: customMeal, source: "custom", rebalanceDinner: true });
    setReplacingSlot(null);
  };

  // Diet plan badge parameters
  const getDietPlanInfo = () => {
    const scenario = state.profiles[state.activeMemberId]?.demo_scenario;
    const name = state.profiles[state.activeMemberId]?.name?.toLowerCase() || "";

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
      const pCals = activeTargets.protein * 4;
      const cCals = activeTargets.carbs * 4;
      const fCals = activeTargets.fat * 9;
      const total = pCals + cCals + fCals || activeTargets.calories || 2000;
      const pPct = Math.round((pCals / total) * 100);
      const cPct = Math.round((cCals / total) * 100);
      const fPct = Math.max(0, 100 - pPct - cPct);

      return {
        dietType: `${activeProfile.dietary_style || "Personalized"} · ${activeProfile.goal || "Adaptive"}`,
        split: `${pPct}% P · ${cPct}% C · ${fPct}% F`,
        calorieTarget: `${activeTargets.calories} kcal`,
        proteinTarget: `${activeTargets.protein}g protein`,
      };
    }

    if (scenario === "stable" || name.includes("omar")) {
      return {
        dietType: "Balanced High-Protein",
        split: "28% P · 48% C · 24% F",
        calorieTarget: `${activeTargets.calories} kcal`,
        proteinTarget: `${activeTargets.protein}g protein`,
      };
    }
    if (scenario === "repeated_deviation" || name.includes("layla")) {
      return {
        dietType: "Glycemic Balance & Carb Control",
        split: "25% P · 45% C · 30% F",
        calorieTarget: `${activeTargets.calories} kcal`,
        proteinTarget: `${activeTargets.protein}g protein`,
      };
    }
    if (scenario === "preference_shift" || name.includes("mariam")) {
      return {
        dietType: "Pescatarian Mediterranean",
        split: "26% P · 48% C · 26% F",
        calorieTarget: `${activeTargets.calories} kcal`,
        proteinTarget: `${activeTargets.protein}g protein`,
      };
    }
    if (scenario === "protein_gap" || name.includes("ahmed")) {
      return {
        dietType: "Strength & Hypertrophy",
        split: "27% P · 50% C · 23% F",
        calorieTarget: `${activeTargets.calories} kcal`,
        proteinTarget: `${activeTargets.protein}g protein`,
      };
    }
    if (scenario === "single_miss" || name.includes("sara")) {
      return {
        dietType: "Moderate Calorie Deficit",
        split: "30% P · 45% C · 25% F",
        calorieTarget: `${activeTargets.calories} kcal`,
        proteinTarget: `${activeTargets.protein}g protein`,
      };
    }
    return {
      dietType: activeProfile.goal || "Baseline Maintenance",
      split: "28% P · 48% C · 24% F",
      calorieTarget: `${activeTargets.calories} kcal`,
      proteinTarget: `${activeTargets.protein}g protein`,
    };
  };

  const dietInfo = getDietPlanInfo();

  const getGoalBadgeText = () => {
    if (activeProfile.target_delta && activeProfile.target_delta > 0) {
      if (activeProfile.goal?.toLowerCase().includes("fat loss")) {
        return `Goal: -${activeProfile.target_delta} ${activeProfile.target_unit === "% body fat" ? "% body fat" : "kg"}`;
      }
      if (activeProfile.goal?.toLowerCase().includes("muscle")) {
        return `Goal: +${activeProfile.target_delta} ${activeProfile.target_unit === "% body fat" ? "% muscle" : "kg Muscle"}`;
      }
      return `Goal: ±${activeProfile.target_delta} ${activeProfile.target_unit || "kg"}`;
    }
    return `Goal: ${activeProfile.goal || "Healthy Maintenance"}`;
  };

  return (
    <div className="space-y-4">
      {/* Current Plan Badge & Baseline Parameters Banner */}
      <div className="bg-surface rounded-lg border border-border p-3.5 shadow-hairline space-y-2.5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Goal Badge */}
            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-md bg-brand-tint text-brand border border-[#D5E6D2] flex items-center gap-1">
              <span>🎯</span>
              <span>{getGoalBadgeText()}</span>
            </span>

            {/* Diet Type */}
            <span className="text-[11px] font-medium px-2.5 py-1 rounded-md bg-surface-subtle text-ink-primary border border-border">
              {dietInfo.dietType}
            </span>

            {/* Allergies Badges */}
            {activeProfile.allergies && activeProfile.allergies.map((allergy) => (
              <span
                key={allergy}
                className="text-[11px] font-semibold px-2.5 py-1 rounded-md bg-[#FEF2F2] text-status-danger border border-[#FCA5A5] flex items-center gap-1"
              >
                <span>⚠️ Allergy:</span>
                <span>{allergy}</span>
              </span>
            ))}

            {/* Exclusions Badges */}
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

          <div className="text-[11px] text-ink-muted">
            Base Target: <strong className="font-semibold text-ink-primary">{dietInfo.calorieTarget}</strong> · <strong className="font-semibold text-brand">{dietInfo.proteinTarget}</strong>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-ink-secondary pt-0.5 border-t border-border/60">
          <span className="text-ink-muted text-[11px]">Daily Macro Ratio:</span>
          <span className="text-ink-primary font-medium text-[11px]">{dietInfo.split}</span>
        </div>
      </div>

      {/* Multi-Day Weekly Calorie Compensatory Rebalancing Banner & Agency Toggle */}
      {weeklyRebalanceInfo.isSignificant && (
        <div className="bg-surface rounded-lg border border-brand/40 bg-gradient-to-r from-brand-tint/40 to-surface p-3.5 shadow-hairline flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-2.5 max-w-xl">
            <div className="w-5 h-5 rounded bg-brand text-white flex items-center justify-center shrink-0 mt-0.5">
              <Sparkles className="w-3 h-3" />
            </div>
            <div className="space-y-0.5 text-xs">
              <div className="font-semibold text-ink-primary flex items-center gap-2">
                <span>Weekly Auto-Balance Active</span>
                <span className="text-[10px] font-medium px-2 py-0.2 bg-brand-tint text-brand rounded border border-[#D5E6D2]">
                  {weeklyRebalanceInfo.delta > 0 ? `+${weeklyRebalanceInfo.delta}` : weeklyRebalanceInfo.delta} kcal logged today
                </span>
              </div>
              <p className="text-ink-secondary text-[11px] leading-relaxed">
                Daily targets adjusted by{" "}
                <strong className="font-semibold text-brand">
                  {weeklyRebalanceInfo.dailyAdjustment > 0 ? `+${weeklyRebalanceInfo.dailyAdjustment}` : weeklyRebalanceInfo.dailyAdjustment} kcal/day
                </strong>{" "}
                across the next {weeklyRebalanceInfo.remainingDaysCount} days to compensate for today&apos;s intake.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 bg-surface-subtle p-0.5 rounded-lg border border-border shrink-0">
            <button
              type="button"
              onClick={() => {
                if (!weeklySmoothingEnabled) toggleWeeklySmoothing();
              }}
              className={`text-[11px] font-medium px-2.5 py-1 rounded transition-all ${
                weeklySmoothingEnabled
                  ? "bg-brand text-white shadow-hairline"
                  : "text-ink-muted hover:text-ink-primary"
              }`}
            >
              Apply weekly smoothing
            </button>
            <button
              type="button"
              onClick={() => {
                if (weeklySmoothingEnabled) toggleWeeklySmoothing();
              }}
              className={`text-[11px] font-medium px-2.5 py-1 rounded transition-all ${
                !weeklySmoothingEnabled
                  ? "bg-surface text-ink-primary shadow-hairline"
                  : "text-ink-muted hover:text-ink-primary"
              }`}
            >
              Keep original targets
            </button>
          </div>
        </div>
      )}

      {/* 7-Day Horizontal Selector */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {days.map((d) => {
          const isSelected = selectedPlanDayOffset === d.offset;
          return (
            <button
              key={d.date}
              onClick={() => setSelectedPlanDayOffset(d.offset)}
              className={`px-3 py-2 rounded-lg border text-xs text-left transition-all shrink-0 min-w-[90px] ${
                isSelected
                  ? "bg-surface border-brand shadow-card"
                  : "bg-surface-subtle border-border text-ink-secondary hover:bg-surface hover:text-ink-primary"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-ink-muted uppercase">{d.short}</span>
                {d.offset > 0 && weeklySmoothingEnabled && weeklyRebalanceInfo.isSignificant && (
                  <span className="text-[9px] text-brand font-semibold">
                    {d.target}k
                  </span>
                )}
              </div>
              <div className="font-medium text-ink-primary mt-0.5">{d.label}</div>
            </button>
          );
        })}
      </div>

      {/* Selected Day Plan Card */}
      <div className="bg-surface rounded-lg border border-border p-4 shadow-card space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div>
            <h3 className="text-xs font-medium text-ink-primary flex items-center gap-2">
              <span>Meal Plan for {relativeDay(currentSelectedDate, today)} ({formatDay(currentSelectedDate)})</span>
              {selectedPlanDayOffset > 0 && weeklySmoothingEnabled && weeklyRebalanceInfo.isSignificant && (
                <span className="text-[10px] font-medium px-2 py-0.5 bg-brand-tint text-brand rounded border border-[#D5E6D2]">
                  Smoothed Target
                </span>
              )}
            </h3>
            <p className="text-[11px] text-ink-muted mt-0.5">
              Target: <strong className="font-semibold text-ink-primary">{effectiveDayTarget} kcal</strong>
              {selectedPlanDayOffset > 0 && weeklySmoothingEnabled && weeklyRebalanceInfo.isSignificant && (
                <span> ({weeklyRebalanceInfo.dailyAdjustment > 0 ? `+${weeklyRebalanceInfo.dailyAdjustment}` : weeklyRebalanceInfo.dailyAdjustment} kcal/day adjustment)</span>
              )}
              {" "}· Planned: <strong className="font-semibold text-brand">{dayCalories} kcal</strong> ({dayProtein}g protein)
            </p>
          </div>

          <button
            onClick={() => adaptDailyPlan(`Regenerate full plan for ${relativeDay(currentSelectedDate, today)}`)}
            className="text-xs text-brand hover:text-brand-hover px-2.5 py-1 rounded border border-border hover:bg-surface-subtle transition-colors flex items-center gap-1 font-medium"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Adapt Day Plan</span>
          </button>
        </div>

        {/* Meal Slots List */}
        <div className="divide-y divide-border">
          {(["breakfast", "lunch", "snack", "dinner"] as MealType[]).map((slotType) => {
            const meal = selectedMeals.find((m) => m.meal_type === slotType);
            const slotTitle = slotType.charAt(0).toUpperCase() + slotType.slice(1);
            const isAiAdapted = meal?.source === "agent";
            const isCustom = meal?.source === "custom";

            return (
              <div key={slotType} className="py-3 first:pt-0 last:pb-0 flex items-start justify-between text-xs">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-ink-primary">{slotTitle}</span>
                    <span className="text-[10px] text-ink-muted px-1.5 py-0.2 bg-surface-subtle rounded uppercase">
                      {slotType}
                    </span>
                    {isAiAdapted && (
                      <span className="text-[10px] px-2 py-0.5 bg-brand-tint text-brand rounded font-medium border border-[#D5E6D2] flex items-center gap-1">
                        <Sparkles className="w-2.5 h-2.5" />
                        AI Adapted
                      </span>
                    )}
                    {isCustom && (
                      <span className="text-[10px] px-2 py-0.5 bg-surface-subtle text-ink-primary rounded font-medium border border-border">
                        Custom
                      </span>
                    )}
                  </div>

                  {meal ? (
                    <div className="text-ink-secondary">
                      <span className="font-normal text-ink-primary">{meal.meal_name}</span>
                      <span className="text-ink-muted">
                        {" "}
                        · {meal.calories} kcal ({meal.protein}g P / {meal.carbs}g C / {meal.fat}g F)
                      </span>
                    </div>
                  ) : (
                    <div className="text-ink-muted italic">No meal assigned to this slot yet.</div>
                  )}

                  {meal?.ingredients && meal.ingredients.length > 0 && (
                    <div className="text-[11px] text-ink-muted">
                      Ingredients: {meal.ingredients.join(", ")}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => openReplaceModal(slotType)}
                  className="text-[11px] text-ink-secondary hover:text-brand px-2.5 py-1 rounded border border-border hover:bg-surface-subtle transition-colors flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Replace</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Interactive Replace Meal Modal */}
      {replacingSlot && (
        <div className="fixed inset-0 bg-ink-primary/20 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-surface rounded-xl border border-border max-w-lg w-full p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-sm font-semibold text-ink-primary">
                  Replace {replacingSlot.charAt(0).toUpperCase() + replacingSlot.slice(1)} ({formatDay(currentSelectedDate)})
                </h3>
                <p className="text-[11px] text-ink-muted">Choose a smart alternative or enter a custom meal</p>
              </div>
              <button
                type="button"
                onClick={() => setReplacingSlot(null)}
                className="p-1 text-ink-muted hover:text-ink-primary rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Segmented Choice: Option A (Suggest) vs Option B (Custom) */}
            <div className="flex rounded-lg bg-surface-subtle p-1 border border-border">
              <button
                type="button"
                onClick={() => setReplaceTab("suggest")}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all flex items-center justify-center gap-1.5 ${
                  replaceTab === "suggest"
                    ? "bg-surface text-brand shadow-hairline"
                    : "text-ink-muted hover:text-ink-primary"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Smart Recommendations</span>
              </button>
              <button
                type="button"
                onClick={() => setReplaceTab("custom")}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${
                  replaceTab === "custom"
                    ? "bg-surface text-ink-primary shadow-hairline"
                    : "text-ink-muted hover:text-ink-primary"
                }`}
              >
                Custom Entry
              </button>
            </div>

            {/* Option A: Smart Recommendations List */}
            {replaceTab === "suggest" && (
              <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
                {getSmartSuggestions(replacingSlot).map((opt, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-lg border border-border bg-surface hover:border-brand/40 transition-all flex items-center justify-between gap-3"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="font-medium text-xs text-ink-primary truncate">{opt.meal_name}</div>
                      <div className="text-[11px] text-ink-muted flex items-center gap-2">
                        <span className="font-semibold text-brand">{opt.calories} kcal</span>
                        <span>·</span>
                        <span>{opt.protein}g P</span>
                        <span>·</span>
                        <span>{opt.carbs}g C</span>
                        <span>·</span>
                        <span>{opt.fat}g F</span>
                      </div>
                      {opt.ingredients && opt.ingredients.length > 0 && (
                        <div className="text-[10px] text-ink-secondary truncate">
                          {opt.ingredients.join(", ")}
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSelectSuggestion(opt)}
                      className="shrink-0 text-xs font-medium text-white bg-brand hover:bg-brand-hover px-3 py-1.5 rounded-md shadow-hairline transition-colors"
                    >
                      Select
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Option B: Custom Entry Form */}
            {replaceTab === "custom" && (
              <form onSubmit={handleApplyCustomMeal} className="space-y-3 text-xs">
                <div>
                  <label className="block font-medium text-ink-secondary mb-1">Custom Meal Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Greek Yogurt Bowl with Honey"
                    value={customReplaceName}
                    onChange={(e) => setCustomReplaceName(e.target.value)}
                    className="w-full bg-surface-subtle border border-border rounded-md px-3 py-1.5 text-ink-primary focus:outline-none focus:border-brand"
                  />
                </div>

                <div className="flex rounded-md bg-surface-subtle p-0.5 border border-border">
                  <button
                    type="button"
                    onClick={() => setCustomReplaceMode("calories")}
                    className={`flex-1 py-1 text-[11px] font-medium rounded transition-all ${
                      customReplaceMode === "calories"
                        ? "bg-surface text-ink-primary shadow-hairline"
                        : "text-ink-muted"
                    }`}
                  >
                    Calories Directly
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomReplaceMode("grams")}
                    className={`flex-1 py-1 text-[11px] font-medium rounded transition-all ${
                      customReplaceMode === "grams"
                        ? "bg-surface text-ink-primary shadow-hairline"
                        : "text-ink-muted"
                    }`}
                  >
                    Enter Grams (P · C · F)
                  </button>
                </div>

                {customReplaceMode === "calories" ? (
                  <div>
                    <label className="block font-medium text-ink-secondary mb-1">Target Calories (kcal)</label>
                    <input
                      type="number"
                      min={1}
                      required
                      value={customReplaceCals}
                      onChange={(e) => setCustomReplaceCals(Number(e.target.value))}
                      className="w-full bg-surface-subtle border border-border rounded-md px-3 py-1.5 text-ink-primary focus:outline-none focus:border-brand text-base font-semibold"
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block font-medium text-ink-secondary mb-1">Protein (g)</label>
                        <input
                          type="number"
                          min={0}
                          value={customReplaceProtein}
                          onChange={(e) => setCustomReplaceProtein(Number(e.target.value))}
                          className="w-full bg-surface-subtle border border-border rounded-md px-2.5 py-1 text-ink-primary focus:outline-none focus:border-brand"
                        />
                      </div>
                      <div>
                        <label className="block font-medium text-ink-secondary mb-1">Carbs (g)</label>
                        <input
                          type="number"
                          min={0}
                          value={customReplaceCarbs}
                          onChange={(e) => setCustomReplaceCarbs(Number(e.target.value))}
                          className="w-full bg-surface-subtle border border-border rounded-md px-2.5 py-1 text-ink-primary focus:outline-none focus:border-brand"
                        />
                      </div>
                      <div>
                        <label className="block font-medium text-ink-secondary mb-1">Fat (g)</label>
                        <input
                          type="number"
                          min={0}
                          value={customReplaceFat}
                          onChange={(e) => setCustomReplaceFat(Number(e.target.value))}
                          className="w-full bg-surface-subtle border border-border rounded-md px-2.5 py-1 text-ink-primary focus:outline-none focus:border-brand"
                        />
                      </div>
                    </div>
                    <div className="bg-surface-subtle rounded p-2 text-center text-[11px] text-ink-secondary border border-border">
                      Computed: <strong className="font-semibold text-brand">{customReplaceProtein * 4 + customReplaceCarbs * 4 + customReplaceFat * 9} kcal</strong>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setReplacingSlot(null)}
                    className="text-xs text-ink-secondary px-3 py-1.5 rounded-md border border-border hover:bg-surface-subtle"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="text-xs font-medium text-white bg-brand hover:bg-brand-hover px-4 py-1.5 rounded-md shadow-hairline"
                  >
                    Apply Custom Meal
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

