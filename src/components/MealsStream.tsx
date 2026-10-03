"use client";

import React, { useState } from "react";
import {
  Check,
  CheckCircle2,
  Clock,
  Edit2,
  Flame,
  Plus,
  RefreshCw,
  Sparkles,
  Utensils,
  X,
} from "lucide-react";
import { useNutriCoach } from "./NutriCoachContext";
import { FOODS, foodToSnapshot } from "@/lib/foods";
import type { MealSnapshot, MealType, PlannedMeal } from "@/lib/types";

export function MealsStream() {
  const {
    todayPlannedMeals,
    todayMealLogs,
    logMeal,
    logCustomMeal,
    replaceMealSlot,
    addExtraMeal,
    activeTargets,
  } = useNutriCoach();

  // Custom logging modal state
  const [loggingSlot, setLoggingSlot] = useState<MealType | null>(null);
  const [logMode, setLogMode] = useState<"calories" | "grams">("calories");
  const [logMealName, setLogMealName] = useState("");
  const [logCalories, setLogCalories] = useState<number>(500);
  const [logProtein, setLogProtein] = useState<number>(35);
  const [logCarbs, setLogCarbs] = useState<number>(55);
  const [logFat, setLogFat] = useState<number>(15);
  const [logNotes, setLogNotes] = useState("");

  // Replace meal modal state
  const [replacingSlot, setReplacingSlot] = useState<MealType | null>(null);
  const [replaceTab, setReplaceTab] = useState<"suggest" | "custom">("suggest");
  const [customReplaceName, setCustomReplaceName] = useState("");
  const [customReplaceMode, setCustomReplaceMode] = useState<"calories" | "grams">("calories");
  const [customReplaceCals, setCustomReplaceCals] = useState<number>(550);
  const [customReplaceProtein, setCustomReplaceProtein] = useState<number>(40);
  const [customReplaceCarbs, setCustomReplaceCarbs] = useState<number>(60);
  const [customReplaceFat, setCustomReplaceFat] = useState<number>(16);

  // Add Meal / Snack modal state
  const [isAddMealOpen, setIsAddMealOpen] = useState(false);
  const [addSlotType, setAddSlotType] = useState<string>("snack_2");
  const [addMealName, setAddMealName] = useState("");
  const [addMode, setAddMode] = useState<"calories" | "grams">("calories");
  const [addCalories, setAddCalories] = useState<number>(250);
  const [addProtein, setAddProtein] = useState<number>(20);
  const [addCarbs, setAddCarbs] = useState<number>(30);
  const [addFat, setAddFat] = useState<number>(6);
  const [addAsLogged, setAddAsLogged] = useState<boolean>(true);

  const baseSlots: { type: MealType; label: string; time: string }[] = [
    { type: "breakfast", label: "Breakfast", time: "8:00 AM" },
    { type: "lunch", label: "Lunch", time: "1:30 PM" },
    { type: "snack", label: "Snack", time: "5:00 PM" },
    { type: "dinner", label: "Dinner", time: "8:30 PM" },
  ];

  // Identify any extra meal types present in todayPlannedMeals or todayMealLogs
  const extraTypes = Array.from(
    new Set([
      ...todayPlannedMeals.map((p) => p.meal_type),
      ...todayMealLogs.map((l) => l.meal_type),
    ])
  ).filter((t) => !["breakfast", "lunch", "snack", "dinner"].includes(t));

  const extraSlots = extraTypes.map((t) => ({
    type: t as MealType,
    label: t
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" "),
    time: "Extra / Flexible",
  }));

  const allDisplaySlots = [...baseSlots, ...extraSlots];

  // Open Log Custom Modal
  const openCustomLogModal = (slot: MealType) => {
    const existingLog = todayMealLogs.find((l) => l.meal_type === slot);
    const planned = todayPlannedMeals.find((p) => p.meal_type === slot);

    setLoggingSlot(slot);
    setLogMealName(existingLog?.meal_name || planned?.meal_name || "");
    setLogCalories(existingLog?.calories || planned?.calories || 500);
    setLogProtein(existingLog?.protein || planned?.protein || 35);
    setLogCarbs(existingLog?.carbs || planned?.carbs || 55);
    setLogFat(existingLog?.fat || planned?.fat || 15);
    setLogNotes(existingLog?.notes || "");
    setLogMode("calories");
  };

  const handleSaveCustomLog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loggingSlot) return;

    let finalCals = logCalories;
    let finalProtein = logProtein;
    let finalCarbs = logCarbs;
    let finalFat = logFat;

    if (logMode === "grams") {
      finalCals = logProtein * 4 + logCarbs * 4 + logFat * 9;
    } else {
      finalProtein = Math.round((logCalories * 0.28) / 4);
      finalCarbs = Math.round((logCalories * 0.48) / 4);
      finalFat = Math.round((logCalories * 0.24) / 9);
    }

    logCustomMeal({
      mealType: loggingSlot,
      mealName: logMealName || `${loggingSlot.charAt(0).toUpperCase() + loggingSlot.slice(1)} Meal`,
      calories: finalCals,
      protein: finalProtein,
      carbs: finalCarbs,
      fat: finalFat,
      notes: logNotes,
    });

    setLoggingSlot(null);
  };

  // Open Add Meal Modal
  const openAddMealModal = () => {
    setIsAddMealOpen(true);
    setAddSlotType("snack_2");
    setAddMealName("");
    setAddMode("calories");
    setAddCalories(240);
    setAddProtein(20);
    setAddCarbs(28);
    setAddFat(6);
    setAddAsLogged(true);
  };

  const handleSaveAddMeal = (e: React.FormEvent) => {
    e.preventDefault();
    let finalCals = addCalories;
    let finalProtein = addProtein;
    let finalCarbs = addCarbs;
    let finalFat = addFat;

    if (addMode === "grams") {
      finalCals = addProtein * 4 + addCarbs * 4 + addFat * 9;
    } else {
      finalProtein = Math.round((addCalories * 0.28) / 4);
      finalCarbs = Math.round((addCalories * 0.48) / 4);
      finalFat = Math.round((addCalories * 0.24) / 9);
    }

    addExtraMeal({
      mealType: addSlotType,
      mealName: addMealName.trim() || `${addSlotType.replace("_", " ")}`,
      calories: finalCals,
      protein: finalProtein,
      carbs: finalCarbs,
      fat: finalFat,
      asLogged: addAsLogged,
    });

    setIsAddMealOpen(false);
  };

  // Open Replace Modal
  const openReplaceModal = (slot: MealType) => {
    const planned = todayPlannedMeals.find((p) => p.meal_type === slot);
    setReplacingSlot(slot);
    setReplaceTab("suggest");
    setCustomReplaceName("");
    setCustomReplaceCals(planned?.calories || 550);
    setCustomReplaceProtein(planned?.protein || 40);
    setCustomReplaceCarbs(planned?.carbs || 60);
    setCustomReplaceFat(planned?.fat || 16);
  };

  // Smart suggestions generator based on slot and current target
  const getSmartSuggestions = (slot: MealType): MealSnapshot[] => {
    if (slot === "breakfast") {
      return [
        { meal_name: "Greek yogurt bowl with honey & walnuts", calories: 420, protein: 32, carbs: 46, fat: 12, ingredients: ["greek yogurt", "honey", "walnuts", "strawberries"], tags: ["breakfast", "dairy", "high-protein"] },
        { meal_name: "Egg white omelet with spinach & baladi toast", calories: 390, protein: 34, carbs: 42, fat: 9, ingredients: ["egg whites", "spinach", "baladi bread", "olive oil"], tags: ["breakfast", "eggs"] },
        { meal_name: "Oatmeal with protein whey & sliced banana", calories: 450, protein: 35, carbs: 62, fat: 7, ingredients: ["rolled oats", "whey protein", "banana", "cinnamon"], tags: ["breakfast", "high-carb"] },
      ];
    }
    if (slot === "lunch" || slot === "dinner") {
      return [
        { meal_name: "Seared Salmon fillet with quinoa & asparagus", calories: 620, protein: 46, carbs: 54, fat: 22, ingredients: ["salmon", "quinoa", "asparagus", "lemon", "olive oil"], tags: ["fish", "pescatarian", "omega-3"] },
        { meal_name: "Grilled chicken breast with roasted sweet potato", calories: 580, protein: 52, carbs: 62, fat: 12, ingredients: ["chicken breast", "sweet potato", "steamed broccoli", "olive oil"], tags: ["chicken", "high-protein", "lean"] },
        { meal_name: "Tofu stir-fry with edamame & jasmine rice", calories: 540, protein: 38, carbs: 66, fat: 14, ingredients: ["firm tofu", "edamame", "bell peppers", "jasmine rice", "sesame oil"], tags: ["vegan", "plant-protein"] },
      ];
    }
    return [
      { meal_name: "Protein shake with almond butter", calories: 280, protein: 28, carbs: 18, fat: 10, ingredients: ["whey protein", "almond milk", "almond butter"], tags: ["snack", "high-protein"] },
      { meal_name: "Cottage cheese with pineapple chunks", calories: 220, protein: 26, carbs: 22, fat: 3, ingredients: ["cottage cheese", "pineapple"], tags: ["snack", "dairy"] },
      { meal_name: "Boiled eggs (2) with cucumber slices", calories: 190, protein: 16, carbs: 6, fat: 11, ingredients: ["boiled eggs", "cucumber"], tags: ["snack", "low-carb"] },
    ];
  };

  const handleSelectSuggestion = (meal: MealSnapshot) => {
    if (!replacingSlot) return;
    replaceMealSlot({ mealType: replacingSlot, meal, source: "agent" });
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

    replaceMealSlot({ mealType: replacingSlot, meal: customMeal, source: "custom" });
    setReplacingSlot(null);
  };

  return (
    <div className="bg-surface rounded-lg border border-border p-4 shadow-card space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-medium text-ink-primary">Today&apos;s Meal Stream</h3>
        <span className="text-[11px] text-ink-muted">
          {allDisplaySlots.length} active slots
        </span>
      </div>

      <div className="divide-y divide-border">
        {allDisplaySlots.map((slot) => {
          const planned = todayPlannedMeals.find((p) => p.meal_type === slot.type);
          const logged = todayMealLogs.find((l) => l.meal_type === slot.type);

          return (
            <div key={slot.type} className="py-3 first:pt-0 last:pb-0 space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-ink-primary">{slot.label}</span>
                    <span className="text-[11px] text-ink-muted flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {slot.time}
                    </span>
                    {logged && (
                      <span className="text-[10px] px-1.5 py-0.2 bg-brand-tint text-brand rounded font-medium flex items-center gap-0.5">
                        <Check className="w-2.5 h-2.5" /> Logged
                      </span>
                    )}
                    {planned?.source === "custom" && !logged && (
                      <span className="text-[10px] px-1.5 py-0.2 bg-surface-subtle text-ink-secondary rounded font-medium">
                        Custom
                      </span>
                    )}
                  </div>

                  {/* Planned Meal Description */}
                  {planned && (
                    <div className="text-xs text-ink-secondary mt-0.5">
                      <span className="font-normal text-ink-primary">{planned.meal_name}</span>
                      <span className="text-ink-muted">
                        {" "}
                        · {planned.calories} kcal ({planned.protein}g P / {planned.carbs}g C / {planned.fat}g F)
                      </span>
                    </div>
                  )}

                  {/* Logged Item (if different from planned or off-plan) */}
                  {logged && !logged.matched_plan && (
                    <div className="mt-1 text-[11px] text-status-warning bg-[#FAF6F0] px-2 py-1 rounded border border-[#EFE5D8]">
                      Eaten: <strong className="font-medium">{logged.meal_name}</strong> ({logged.calories} kcal · {logged.protein}g P · {logged.carbs}g C · {logged.fat}g F)
                      {logged.notes && <span className="text-ink-muted"> — &quot;{logged.notes}&quot;</span>}
                    </div>
                  )}
                </div>

                {/* Slot Action Buttons */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {!logged && planned && (
                    <>
                      <button
                        onClick={() => logMeal({ mealName: planned.meal_name, mealType: slot.type, asPlanned: true })}
                        className="text-[11px] text-ink-secondary hover:text-ink-primary px-2.5 py-1 rounded border border-border hover:bg-surface-subtle transition-colors flex items-center gap-1"
                        title="Quick log as planned"
                      >
                        <Check className="w-3 h-3 text-brand" />
                        <span>Ate planned</span>
                      </button>

                      <button
                        onClick={() => openCustomLogModal(slot.type)}
                        className="text-[11px] text-ink-secondary hover:text-ink-primary px-2 py-1 rounded border border-border hover:bg-surface-subtle transition-colors"
                      >
                        Log custom
                      </button>

                      <button
                        onClick={() => openReplaceModal(slot.type)}
                        className="text-[11px] text-ink-secondary hover:text-brand px-2 py-1 rounded border border-border hover:bg-surface-subtle transition-colors flex items-center gap-1"
                        title="Replace this meal with alternatives or custom entry"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Replace</span>
                      </button>
                    </>
                  )}
                  {logged && (
                    <button
                      onClick={() => openCustomLogModal(slot.type)}
                      className="text-[11px] text-ink-secondary hover:text-ink-primary px-2.5 py-1 rounded border border-border hover:bg-surface-subtle transition-colors flex items-center gap-1"
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>Edit log</span>
                    </button>
                  )}
                  {!logged && !planned && (
                    <button
                      onClick={() => openCustomLogModal(slot.type)}
                      className="text-[11px] text-brand hover:text-brand-hover px-2.5 py-1 rounded border border-border hover:bg-surface-subtle transition-colors flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Log meal</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* + Add Meal / Snack Action Button */}
      <div className="pt-2 border-t border-border">
        <button
          onClick={openAddMealModal}
          className="w-full py-2 px-3 rounded-lg border border-dashed border-border hover:border-brand/50 hover:bg-surface-subtle text-ink-secondary hover:text-brand text-xs font-medium transition-all flex items-center justify-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>+ Add Meal / Snack</span>
        </button>
      </div>

      {/* Add Meal / Snack Modal */}
      {isAddMealOpen && (
        <div className="fixed inset-0 bg-ink-primary/20 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <form
            onSubmit={handleSaveAddMeal}
            className="bg-surface rounded-xl border border-border max-w-md w-full p-5 space-y-4 shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-sm font-semibold text-ink-primary">Add Meal / Snack</h3>
                <p className="text-[11px] text-ink-muted">Add an extra meal or snack to today&apos;s stream</p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddMealOpen(false)}
                className="p-1 text-ink-muted hover:text-ink-primary rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-ink-secondary mb-1">Meal Slot Type</label>
                <select
                  value={addSlotType}
                  onChange={(e) => setAddSlotType(e.target.value)}
                  className="w-full bg-surface-subtle border border-border rounded-md px-3 py-1.5 text-ink-primary focus:outline-none focus:border-brand"
                >
                  <option value="snack_2">Snack 2 (Evening / Second Snack)</option>
                  <option value="pre_workout">Pre-Workout Meal / Fuel</option>
                  <option value="post_workout">Post-Workout Recovery</option>
                  <option value="dessert">Dessert / Sweet Craving</option>
                  <option value="late_night">Late Night Snack</option>
                  <option value="extra_meal">Extra Meal</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-ink-secondary mb-1">Meal / Food Description</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Chocolate pudding, Rice cakes with peanut butter..."
                  value={addMealName}
                  onChange={(e) => setAddMealName(e.target.value)}
                  className="w-full bg-surface-subtle border border-border rounded-md px-3 py-1.5 text-ink-primary focus:outline-none focus:border-brand"
                />
              </div>

              {/* Segmented Toggle: Calories vs Grams */}
              <div className="flex rounded-lg bg-surface-subtle p-1 border border-border">
                <button
                  type="button"
                  onClick={() => setAddMode("calories")}
                  className={`flex-1 py-1 text-xs font-medium rounded-md transition-all ${
                    addMode === "calories"
                      ? "bg-surface text-ink-primary shadow-hairline"
                      : "text-ink-muted hover:text-ink-primary"
                  }`}
                >
                  Calories (kcal)
                </button>
                <button
                  type="button"
                  onClick={() => setAddMode("grams")}
                  className={`flex-1 py-1 text-xs font-medium rounded-md transition-all ${
                    addMode === "grams"
                      ? "bg-surface text-ink-primary shadow-hairline"
                      : "text-ink-muted hover:text-ink-primary"
                  }`}
                >
                  Grams / Macros (P · C · F)
                </button>
              </div>

              {addMode === "calories" ? (
                <div>
                  <label className="block font-medium text-ink-secondary mb-1">Total Calories (kcal)</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={addCalories}
                    onChange={(e) => setAddCalories(Number(e.target.value))}
                    className="w-full bg-surface-subtle border border-border rounded-md px-3 py-1.5 text-ink-primary focus:outline-none focus:border-brand text-base font-semibold"
                  />
                  <span className="text-[10px] text-ink-muted mt-1 block">
                    Estimated split: ~{Math.round((addCalories * 0.28) / 4)}g Protein · ~{Math.round((addCalories * 0.48) / 4)}g Carbs · ~{Math.round((addCalories * 0.24) / 9)}g Fat
                  </span>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-3 gap-2.5">
                    <div>
                      <label className="block font-medium text-ink-secondary mb-1">Protein (g)</label>
                      <input
                        type="number"
                        min={0}
                        value={addProtein}
                        onChange={(e) => setAddProtein(Number(e.target.value))}
                        className="w-full bg-surface-subtle border border-border rounded-md px-2.5 py-1.5 text-ink-primary focus:outline-none focus:border-brand font-medium"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-ink-secondary mb-1">Carbs (g)</label>
                      <input
                        type="number"
                        min={0}
                        value={addCarbs}
                        onChange={(e) => setAddCarbs(Number(e.target.value))}
                        className="w-full bg-surface-subtle border border-border rounded-md px-2.5 py-1.5 text-ink-primary focus:outline-none focus:border-brand font-medium"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-ink-secondary mb-1">Fat (g)</label>
                      <input
                        type="number"
                        min={0}
                        value={addFat}
                        onChange={(e) => setAddFat(Number(e.target.value))}
                        className="w-full bg-surface-subtle border border-border rounded-md px-2.5 py-1.5 text-ink-primary focus:outline-none focus:border-brand font-medium"
                      />
                    </div>
                  </div>
                  <div className="bg-surface-subtle rounded-md p-2 border border-border text-center text-[11px] text-ink-muted">
                    Total: <strong className="text-brand font-semibold">{addProtein * 4 + addCarbs * 4 + addFat * 9} kcal</strong>
                  </div>
                </div>
              )}

              {/* Status Selector */}
              <div className="flex items-center gap-4 pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="addStatus"
                    checked={addAsLogged}
                    onChange={() => setAddAsLogged(true)}
                    className="accent-brand"
                  />
                  <span className="text-xs text-ink-primary font-medium">Log as eaten now</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="addStatus"
                    checked={!addAsLogged}
                    onChange={() => setAddAsLogged(false)}
                    className="accent-brand"
                  />
                  <span className="text-xs text-ink-secondary">Add to planned stream</span>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => setIsAddMealOpen(false)}
                className="text-xs text-ink-secondary px-3 py-1.5 rounded-md border border-border hover:bg-surface-subtle"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="text-xs font-medium text-white bg-brand hover:bg-brand-hover px-4 py-1.5 rounded-md shadow-hairline"
              >
                Save & Add Meal
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 1. Custom Meal Logging Modal (Calories vs Grams Toggle) */}
      {loggingSlot && (
        <div className="fixed inset-0 bg-ink-primary/20 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <form
            onSubmit={handleSaveCustomLog}
            className="bg-surface rounded-xl border border-border max-w-md w-full p-5 space-y-4 shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-sm font-semibold text-ink-primary">
                  Log Meal: {loggingSlot.charAt(0).toUpperCase() + loggingSlot.slice(1)}
                </h3>
                <p className="text-[11px] text-ink-muted">Enter exact calories or macronutrient grams</p>
              </div>
              <button
                type="button"
                onClick={() => setLoggingSlot(null)}
                className="p-1 text-ink-muted hover:text-ink-primary rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Segmented Toggle: Calories vs Grams */}
            <div className="flex rounded-lg bg-surface-subtle p-1 border border-border">
              <button
                type="button"
                onClick={() => setLogMode("calories")}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${
                  logMode === "calories"
                    ? "bg-surface text-ink-primary shadow-hairline"
                    : "text-ink-muted hover:text-ink-primary"
                }`}
              >
                Calories (kcal)
              </button>
              <button
                type="button"
                onClick={() => setLogMode("grams")}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${
                  logMode === "grams"
                    ? "bg-surface text-ink-primary shadow-hairline"
                    : "text-ink-muted hover:text-ink-primary"
                }`}
              >
                Grams / Macros (P · C · F)
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-ink-secondary mb-1">Meal / Food Description</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Koshary with eggs, Grilled Salmon..."
                  value={logMealName}
                  onChange={(e) => setLogMealName(e.target.value)}
                  className="w-full bg-surface-subtle border border-border rounded-md px-3 py-1.5 text-ink-primary focus:outline-none focus:border-brand"
                />
              </div>

              {logMode === "calories" ? (
                <div>
                  <label className="block font-medium text-ink-secondary mb-1">Total Calories (kcal)</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={logCalories}
                    onChange={(e) => setLogCalories(Number(e.target.value))}
                    className="w-full bg-surface-subtle border border-border rounded-md px-3 py-1.5 text-ink-primary focus:outline-none focus:border-brand text-base font-semibold"
                  />
                  <span className="text-[10px] text-ink-muted mt-1 block">
                    Estimated macro split: ~{Math.round((logCalories * 0.28) / 4)}g Protein · ~{Math.round((logCalories * 0.48) / 4)}g Carbs · ~{Math.round((logCalories * 0.24) / 9)}g Fat
                  </span>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-3 gap-2.5">
                    <div>
                      <label className="block font-medium text-ink-secondary mb-1">Protein (g)</label>
                      <input
                        type="number"
                        min={0}
                        value={logProtein}
                        onChange={(e) => setLogProtein(Number(e.target.value))}
                        className="w-full bg-surface-subtle border border-border rounded-md px-2.5 py-1.5 text-ink-primary focus:outline-none focus:border-brand font-medium"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-ink-secondary mb-1">Carbs (g)</label>
                      <input
                        type="number"
                        min={0}
                        value={logCarbs}
                        onChange={(e) => setLogCarbs(Number(e.target.value))}
                        className="w-full bg-surface-subtle border border-border rounded-md px-2.5 py-1.5 text-ink-primary focus:outline-none focus:border-brand font-medium"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-ink-secondary mb-1">Fat (g)</label>
                      <input
                        type="number"
                        min={0}
                        value={logFat}
                        onChange={(e) => setLogFat(Number(e.target.value))}
                        className="w-full bg-surface-subtle border border-border rounded-md px-2.5 py-1.5 text-ink-primary focus:outline-none focus:border-brand font-medium"
                      />
                    </div>
                  </div>

                  {/* Computed calories live preview */}
                  <div className="bg-surface-subtle rounded-md p-2.5 border border-border text-center">
                    <span className="text-[11px] text-ink-muted">Computed Energy: </span>
                    <strong className="text-sm font-semibold text-brand">
                      {logProtein * 4 + logCarbs * 4 + logFat * 9} kcal
                    </strong>
                    <span className="text-[10px] text-ink-muted ml-1.5">
                      (4×{logProtein} + 4×{logCarbs} + 9×{logFat})
                    </span>
                  </div>
                </div>
              )}

              <div>
                <label className="block font-medium text-ink-secondary mb-1">Notes (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Office lunch, extra tahini..."
                  value={logNotes}
                  onChange={(e) => setLogNotes(e.target.value)}
                  className="w-full bg-surface-subtle border border-border rounded-md px-3 py-1.5 text-ink-primary focus:outline-none focus:border-brand"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setLoggingSlot(null)}
                className="text-xs text-ink-secondary px-3 py-1.5 rounded-md border border-border hover:bg-surface-subtle"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="text-xs font-medium text-white bg-brand hover:bg-brand-hover px-4 py-1.5 rounded-md shadow-hairline"
              >
                Save Log
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 2. Interactive Replace Meal Modal (Smart Suggestion vs Custom Entry) */}
      {replacingSlot && (
        <div className="fixed inset-0 bg-ink-primary/20 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-surface rounded-xl border border-border max-w-lg w-full p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-sm font-semibold text-ink-primary">
                  Replace {replacingSlot.charAt(0).toUpperCase() + replacingSlot.slice(1)}
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

