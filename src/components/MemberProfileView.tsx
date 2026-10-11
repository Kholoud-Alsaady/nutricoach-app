"use client";

import React, { useState, useEffect } from "react";
import {
  AlertTriangle,
  AlertCircle,
  Check,
  CheckCircle2,
  Loader2,
  Plus,
  RotateCcw,
  Save,
  ShieldAlert,
  Sparkles,
  Target,
  Utensils,
  X,
} from "lucide-react";
import { useNutriCoach } from "./NutriCoachContext";

const COMMON_ALLERGIES_INTOLERANCES = [
  "Peanuts / Nuts",
  "Dairy / Lactose",
  "Gluten",
  "Shellfish",
  "Soy",
  "Eggs",
  "Fish",
  "Sesame",
];

const COMMON_DISLIKED_FOODS = [
  "Chicken",
  "Tuna",
  "Mushrooms",
  "Red Meat",
  "Eggs",
  "Dairy",
  "Eggplant",
  "Fish",
  "Cilantro",
  "Pork",
];

const DIETARY_PATTERNS = [
  "Standard / Omnivore",
  "Vegetarian",
  "Vegan",
  "Pescatarian",
  "Keto / Low-Carb",
  "Mediterranean",
  "High-Protein",
];

export function MemberProfileView() {
  const { activeProfile, activeTargets, updateDietaryPreferences } = useNutriCoach();

  // Local state for dietary preferences form
  const [allergies, setAllergies] = useState<string[]>(activeProfile.allergies || []);
  const [dislikedFoods, setDislikedFoods] = useState<string[]>(activeProfile.disliked_foods || []);
  const [dietaryStyle, setDietaryStyle] = useState<string>(activeProfile.dietary_style || "Standard / Omnivore");
  const [medicalNotes, setMedicalNotes] = useState<string>(activeProfile.medical_notes || "");

  // Custom entry input fields
  const [customAllergyInput, setCustomAllergyInput] = useState("");
  const [customDislikeInput, setCustomDislikeInput] = useState("");

  // Feedback states
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Sync state whenever activeProfile changes
  useEffect(() => {
    setAllergies(activeProfile.allergies || []);
    setDislikedFoods(activeProfile.disliked_foods || []);
    setDietaryStyle(activeProfile.dietary_style || "Standard / Omnivore");
    setMedicalNotes(activeProfile.medical_notes || "");
    setSaveSuccess(false);
    setSaveError(null);
  }, [activeProfile.id, activeProfile.allergies, activeProfile.disliked_foods, activeProfile.dietary_style, activeProfile.medical_notes]);

  // Allergies & Intolerances handlers
  const handleToggleAllergy = (allergen: string) => {
    const norm = allergen.toLowerCase();
    setAllergies((prev) => {
      const exists = prev.some((a) => a.toLowerCase() === norm);
      return exists ? prev.filter((a) => a.toLowerCase() !== norm) : [...prev, allergen];
    });
  };

  const handleAddCustomAllergy = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = customAllergyInput.trim();
    if (!trimmed) return;
    const norm = trimmed.toLowerCase();
    if (!allergies.some((a) => a.toLowerCase() === norm)) {
      setAllergies((prev) => [...prev, trimmed]);
    }
    setCustomAllergyInput("");
  };

  const handleRemoveAllergy = (allergen: string) => {
    const norm = allergen.toLowerCase();
    setAllergies((prev) => prev.filter((a) => a.toLowerCase() !== norm));
  };

  // Disliked Foods handlers
  const handleToggleDislike = (food: string) => {
    const norm = food.toLowerCase();
    setDislikedFoods((prev) => {
      const exists = prev.some((d) => d.toLowerCase() === norm);
      return exists ? prev.filter((d) => d.toLowerCase() !== norm) : [...prev, food];
    });
  };

  const handleAddCustomDislike = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = customDislikeInput.trim();
    if (!trimmed) return;
    const norm = trimmed.toLowerCase();
    if (!dislikedFoods.some((d) => d.toLowerCase() === norm)) {
      setDislikedFoods((prev) => [...prev, trimmed]);
    }
    setCustomDislikeInput("");
  };

  const handleRemoveDislike = (food: string) => {
    const norm = food.toLowerCase();
    setDislikedFoods((prev) => prev.filter((d) => d.toLowerCase() !== norm));
  };

  // Revert / Cancel changes
  const handleCancel = () => {
    setAllergies(activeProfile.allergies || []);
    setDislikedFoods(activeProfile.disliked_foods || []);
    setDietaryStyle(activeProfile.dietary_style || "Standard / Omnivore");
    setMedicalNotes(activeProfile.medical_notes || "");
    setSaveSuccess(false);
    setSaveError(null);
  };

  // Save changes
  const handleSaveChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);
    setSaveError(null);

    const payload = {
      allergies,
      disliked_foods: dislikedFoods,
      dietary_style: dietaryStyle,
      medical_notes: medicalNotes.trim() || null,
    };

    const res = await updateDietaryPreferences(payload);
    setIsSaving(false);

    if (res.success) {
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } else {
      setSaveError(res.error || "Failed to persist dietary preferences.");
    }
  };

  const getGoalBadgeText = () => {
    if (activeProfile.target_delta && activeProfile.target_delta > 0) {
      if (activeProfile.goal?.toLowerCase().includes("fat loss")) {
        return `Lose ${activeProfile.target_delta} ${activeProfile.target_unit === "% body fat" ? "% body fat" : "kg"}`;
      }
      if (activeProfile.goal?.toLowerCase().includes("bulking") || activeProfile.goal?.toLowerCase().includes("gain weight")) {
        return `Gain +${activeProfile.target_delta} ${activeProfile.target_unit === "% body fat" ? "% mass" : "kg Mass"}`;
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
      <div className="bg-surface rounded-lg border border-border p-5 shadow-card space-y-4" data-tour="member-profile-overview">
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

            {allergies.length > 0 && (
              <span className="text-[11px] font-semibold px-2.5 py-1 rounded-md bg-[#FEF2F2] text-status-danger border border-[#FCA5A5] flex items-center gap-1">
                <span>⚠️ {allergies.length} {allergies.length === 1 ? "Allergy" : "Allergies"}</span>
              </span>
            )}

            {dislikedFoods.length > 0 && (
              <span className="text-[11px] font-medium px-2.5 py-1 rounded-md bg-surface-subtle text-ink-secondary border border-border flex items-center gap-1">
                <span>🚫 {dislikedFoods.length} Excluded</span>
              </span>
            )}
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
      </div>

      {/* Editable Dietary Preferences & Meal Guardrails Section */}
      <div className="bg-surface rounded-lg border border-border p-5 shadow-card space-y-5" data-tour="member-dietary-guardrails">
        <div className="flex items-center justify-between border-b border-border pb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-brand-tint text-brand flex items-center justify-center">
              <Utensils className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-semibold text-ink-primary">Dietary Preferences & Meal Guardrails</h4>
              <p className="text-[11px] text-ink-muted">
                Manage your safety guardrails, ingredient exclusions, dietary pattern, and personalized notes
              </p>
            </div>
          </div>
          <span className="text-[10px] text-brand font-medium bg-brand-tint/60 px-2 py-0.5 rounded border border-[#D5E6D2]">
            Active in Planner & AI Coach
          </span>
        </div>

        <form onSubmit={handleSaveChanges} className="space-y-5">
          {/* 1. Food Allergies & Intolerances (Strict Guardrails) */}
          <div className="space-y-2.5 p-4 rounded-lg border border-[#FCA5A5]/80 bg-gradient-to-br from-[#FEF2F2]/50 to-surface">
            <div className="flex items-center justify-between flex-wrap gap-1">
              <label className="text-xs font-semibold text-status-danger flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Food Allergies & Intolerances (Strict Guardrails)</span>
              </label>
              <span className="text-[10px] text-status-danger font-medium bg-white px-2 py-0.5 rounded border border-[#FCA5A5]">
                Never Included in Meals
              </span>
            </div>
            <p className="text-[11px] text-ink-secondary leading-relaxed">
              Meals containing these allergens are strictly filtered out by the weekly planner, meal-swap suggestions, and NutriCoach AI.
            </p>

            {/* Currently Selected Allergy Chips */}
            <div className="flex flex-wrap gap-1.5 min-h-[30px] pt-1">
              {allergies.length > 0 ? (
                allergies.map((allergen) => (
                  <span
                    key={allergen}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-md bg-[#FEF2F2] text-status-danger border border-[#FCA5A5]"
                  >
                    <span>⚠️ {allergen}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveAllergy(allergen)}
                      className="hover:text-status-danger/70 transition-colors ml-0.5"
                      aria-label={`Remove ${allergen}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))
              ) : (
                <span className="text-xs text-ink-muted italic">No allergies selected. Choose below or add custom.</span>
              )}
            </div>

            {/* Quick-select common allergens */}
            <div className="space-y-1.5 pt-2">
              <span className="text-[10px] text-ink-muted uppercase tracking-wider block font-medium">Quick Select Common Allergens:</span>
              <div className="flex flex-wrap gap-1.5">
                {COMMON_ALLERGIES_INTOLERANCES.map((allergen) => {
                  const isSelected = allergies.some((a) => a.toLowerCase() === allergen.toLowerCase());
                  return (
                    <button
                      key={allergen}
                      type="button"
                      onClick={() => handleToggleAllergy(allergen)}
                      className={`text-[11px] px-2.5 py-1 rounded-md font-medium border transition-colors flex items-center gap-1 ${
                        isSelected
                          ? "bg-status-danger text-white border-status-danger shadow-hairline"
                          : "bg-surface text-ink-secondary border-border hover:bg-surface-subtle"
                      }`}
                    >
                      {isSelected ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3 text-ink-muted" />}
                      <span>{allergen}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Allergy / Intolerance Input */}
            <div className="flex items-center gap-2 pt-2">
              <input
                type="text"
                placeholder="Enter custom allergy or intolerance (e.g. Mustard, Pine nuts)..."
                value={customAllergyInput}
                onChange={(e) => setCustomAllergyInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddCustomAllergy();
                  }
                }}
                className="flex-1 text-xs rounded-md border border-border bg-surface px-3 py-1.5 text-ink-primary placeholder:text-ink-muted focus:outline-none focus:ring-1 focus:ring-status-danger focus:border-status-danger transition-colors"
                maxLength={50}
              />
              <button
                type="button"
                onClick={handleAddCustomAllergy}
                disabled={!customAllergyInput.trim()}
                className="px-3 py-1.5 rounded-md bg-surface text-ink-primary hover:bg-surface-subtle border border-border text-xs font-medium transition-colors disabled:opacity-40"
              >
                + Add Allergen
              </button>
            </div>
          </div>

          {/* 2. Excluded Foods & Disliked Ingredients */}
          <div className="space-y-2.5 p-4 rounded-lg border border-border bg-surface-subtle">
            <div className="flex items-center justify-between flex-wrap gap-1">
              <label className="text-xs font-semibold text-ink-primary flex items-center gap-1.5">
                <span>🚫 Excluded Foods & Disliked Ingredients</span>
              </label>
              <span className="text-[10px] text-ink-muted font-medium bg-surface px-2 py-0.5 rounded border border-border">
                Excluded in Meal Generator
              </span>
            </div>
            <p className="text-[11px] text-ink-secondary leading-relaxed">
              Foods you prefer not to eat. NutriCoach will skip these ingredients when planning and proposing swaps.
            </p>

            {/* Currently Selected Disliked Chips */}
            <div className="flex flex-wrap gap-1.5 min-h-[30px] pt-1">
              {dislikedFoods.length > 0 ? (
                dislikedFoods.map((food) => (
                  <span
                    key={food}
                    className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-md bg-surface text-ink-secondary border border-border"
                  >
                    <span>🚫 {food.replace(/^no\s+/i, "")}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveDislike(food)}
                      className="hover:text-status-danger transition-colors ml-0.5"
                      aria-label={`Remove ${food}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))
              ) : (
                <span className="text-xs text-ink-muted italic">No excluded ingredients. Choose below or add custom.</span>
              )}
            </div>

            {/* Quick-select common disliked foods */}
            <div className="space-y-1.5 pt-2">
              <span className="text-[10px] text-ink-muted uppercase tracking-wider block font-medium">Quick Select Common Exclusions:</span>
              <div className="flex flex-wrap gap-1.5">
                {COMMON_DISLIKED_FOODS.map((food) => {
                  const isSelected = dislikedFoods.some((d) => d.toLowerCase() === food.toLowerCase());
                  return (
                    <button
                      key={food}
                      type="button"
                      onClick={() => handleToggleDislike(food)}
                      className={`text-[11px] px-2.5 py-1 rounded-md font-medium border transition-colors flex items-center gap-1 ${
                        isSelected
                          ? "bg-ink-primary text-white border-ink-primary shadow-hairline"
                          : "bg-surface text-ink-secondary border-border hover:bg-surface-subtle"
                      }`}
                    >
                      {isSelected ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3 text-ink-muted" />}
                      <span>{food}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Dislike Input */}
            <div className="flex items-center gap-2 pt-2">
              <input
                type="text"
                placeholder="Enter custom excluded ingredient (e.g. Eggplant, Cilantro)..."
                value={customDislikeInput}
                onChange={(e) => setCustomDislikeInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddCustomDislike();
                  }
                }}
                className="flex-1 text-xs rounded-md border border-border bg-surface px-3 py-1.5 text-ink-primary placeholder:text-ink-muted focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand transition-colors"
                maxLength={50}
              />
              <button
                type="button"
                onClick={handleAddCustomDislike}
                disabled={!customDislikeInput.trim()}
                className="px-3 py-1.5 rounded-md bg-surface text-ink-primary hover:bg-surface-subtle border border-border text-xs font-medium transition-colors disabled:opacity-40"
              >
                + Add Excluded
              </button>
            </div>
          </div>

          {/* 3. Dietary Pattern & 4. Additional Meal Notes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Dietary Pattern */}
            <div className="space-y-1.5">
              <label htmlFor="dietary-pattern" className="text-xs font-semibold text-ink-primary block">
                Dietary Pattern
              </label>
              <select
                id="dietary-pattern"
                value={dietaryStyle}
                onChange={(e) => setDietaryStyle(e.target.value)}
                className="w-full text-xs rounded-md border border-border bg-surface px-3 py-2 text-ink-primary focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand transition-colors cursor-pointer"
              >
                {DIETARY_PATTERNS.map((pattern) => (
                  <option key={pattern} value={pattern}>
                    {pattern}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-ink-muted">
                Shapes your meal structure (e.g. Vegetarian excludes all meat/poultry/fish; Pescatarian allows seafood).
              </p>
            </div>

            {/* Additional Meal Notes */}
            <div className="space-y-1.5">
              <label htmlFor="additional-notes" className="text-xs font-semibold text-ink-primary block">
                Additional Meal Preferences & Notes
              </label>
              <textarea
                id="additional-notes"
                rows={2}
                value={medicalNotes}
                onChange={(e) => setMedicalNotes(e.target.value)}
                placeholder="e.g. Prefer larger breakfasts, avoid eating past 9 PM, love whole grains..."
                className="w-full text-xs rounded-md border border-border bg-surface px-3 py-2 text-ink-primary placeholder:text-ink-muted focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand transition-colors resize-none"
                maxLength={300}
              />
              <p className="text-[10px] text-ink-muted">
                Optional guidance communicated to your coach and AI assistant.
              </p>
            </div>
          </div>

          {/* Feedback banners */}
          {saveSuccess && (
            <div className="flex items-center gap-2 p-3 rounded-md bg-[#F0FDF4] border border-[#86EFAC] text-status-success text-xs animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-status-success" />
              <span>Dietary preferences saved! Your meal planner and AI coach now reflect these settings.</span>
            </div>
          )}

          {saveError && (
            <div className="flex items-center gap-2 p-3 rounded-md bg-[#FEF2F2] border border-[#FCA5A5] text-status-danger text-xs animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-status-danger" />
              <span>Failed to save preferences: {saveError}</span>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center justify-between pt-3 border-t border-border">
            <button
              type="button"
              onClick={handleCancel}
              disabled={isSaving}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium text-ink-secondary hover:text-ink-primary hover:bg-surface-subtle transition-colors disabled:opacity-40"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset to Saved</span>
            </button>

            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-brand text-white hover:bg-brand-hover text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-hairline"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving Changes...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Target Breakdown Card */}
      <div className="bg-surface rounded-lg border border-border p-5 shadow-card space-y-3" data-tour="member-profile-targets">
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
