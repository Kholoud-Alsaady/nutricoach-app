"use client";

import React, { useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Plus,
  Sparkles,
  Users,
  Utensils,
  X,
} from "lucide-react";
import { useNutriCoach } from "./NutriCoachContext";

export function LandingPortal() {
  const { state, selectMemberAndEnter, addNewMember, setCurrentView } = useNutriCoach();
  const [showMemberSelector, setShowMemberSelector] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // New member form state
  const [newName, setNewName] = useState("");
  const [newSex, setNewSex] = useState<"male" | "female">("male");
  const [newAge, setNewAge] = useState<number>(28);
  const [newHeight, setNewHeight] = useState<number>(168);
  const [newWeight, setNewWeight] = useState<number>(72);
  const [newGoal, setNewGoal] = useState("Fat Loss & Tone");
  const [newTargetDelta, setNewTargetDelta] = useState<number>(4);
  const [newTargetUnit, setNewTargetUnit] = useState<"kg" | "% body fat">("kg");
  const [newDietaryStyle, setNewDietaryStyle] = useState<string>("Standard / Omnivore");

  // Restrictions, Allergies, Dislikes
  const [selectedDislikes, setSelectedDislikes] = useState<string[]>([]);
  const [customDislikeInput, setCustomDislikeInput] = useState("");
  const [selectedAllergies, setSelectedAllergies] = useState<string[]>([]);
  const [customAllergyInput, setCustomAllergyInput] = useState("");

  // Manual Override Toggle & Custom Values
  const [isManualOverride, setIsManualOverride] = useState(false);
  const [customCalories, setCustomCalories] = useState<number>(1850);
  const [customProtein, setCustomProtein] = useState<number>(144);

  const commonDislikes = ["Chicken", "Tuna", "Mushrooms", "Red Meat", "Eggs", "Dairy"];
  const commonAllergies = ["Peanuts / Nuts", "Dairy / Lactose", "Gluten", "Shellfish", "None"];
  const dietaryStyles = ["Standard / Omnivore", "Vegetarian", "Pescatarian", "Keto / Low-Carb"];

  // Mifflin-St Jeor BMR & TDEE Auto Calculation
  const calculateTargets = (
    sex: "male" | "female",
    age: number,
    height: number,
    weight: number,
    goal: string
  ) => {
    const w = Number(weight) || 72;
    const h = Number(height) || 168;
    const a = Number(age) || 28;

    // Mifflin-St Jeor formula
    const bmr =
      sex === "male"
        ? 10 * w + 6.25 * h - 5 * a + 5
        : 10 * w + 6.25 * h - 5 * a - 161;

    // 1.45 Gym activity multiplier
    const tdee = Math.round(bmr * 1.45);

    let calories = tdee;
    let protein = Math.round(w * 1.8);

    if (goal === "Fat Loss & Tone") {
      calories = Math.max(1250, tdee - 400);
      protein = Math.round(w * 2.0);
    } else if (goal === "Lean Muscle Gain & Hypertrophy") {
      calories = tdee + 250;
      protein = Math.round(w * 2.0);
    } else if (goal === "Endurance & Athletic Performance") {
      calories = tdee + 100;
      protein = Math.round(w * 1.8);
    } else {
      // Maintenance & General Health
      calories = tdee;
      protein = Math.round(w * 1.6);
    }

    return { bmr: Math.round(bmr), tdee, calories, protein };
  };

  const computedTargets = calculateTargets(newSex, newAge, newHeight, newWeight, newGoal);
  const effectiveCalories = isManualOverride ? customCalories : computedTargets.calories;
  const effectiveProtein = isManualOverride ? customProtein : computedTargets.protein;

  const toggleDislike = (item: string) => {
    setSelectedDislikes((prev) =>
      prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]
    );
  };

  const addCustomDislike = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const item = customDislikeInput.trim();
    if (!item) return;
    if (!selectedDislikes.some((d) => d.toLowerCase() === item.toLowerCase())) {
      setSelectedDislikes((prev) => [...prev, item]);
    }
    setCustomDislikeInput("");
  };

  const removeDislike = (item: string) => {
    setSelectedDislikes((prev) => prev.filter((i) => i !== item));
  };

  const toggleAllergy = (item: string) => {
    if (item === "None") {
      setSelectedAllergies((prev) => (prev.includes("None") ? [] : ["None"]));
      return;
    }
    setSelectedAllergies((prev) => {
      const filtered = prev.filter((i) => i !== "None");
      return filtered.includes(item) ? filtered.filter((i) => i !== item) : [...filtered, item];
    });
  };

  const addCustomAllergy = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const item = customAllergyInput.trim();
    if (!item) return;
    if (!selectedAllergies.some((a) => a.toLowerCase() === item.toLowerCase())) {
      setSelectedAllergies((prev) => [...prev.filter((i) => i !== "None"), item]);
    }
    setCustomAllergyInput("");
  };

  const removeAllergy = (item: string) => {
    setSelectedAllergies((prev) => prev.filter((i) => i !== item));
  };

  const getDynamicGoalPreview = () => {
    if (newGoal === "Fat Loss & Tone") {
      return `Lose ${newTargetDelta} ${newTargetUnit === "kg" ? "kg" : "% body fat"}`;
    }
    if (newGoal === "Lean Muscle Gain & Hypertrophy") {
      return `Gain +${newTargetDelta} ${newTargetUnit === "kg" ? "kg lean muscle" : "% muscle mass"}`;
    }
    if (newGoal === "Endurance & Athletic Performance") {
      return `+${newTargetDelta} ${newTargetUnit === "kg" ? "kg stamina efficiency" : "% VO2 endurance"}`;
    }
    return `Maintain ±${newTargetDelta} ${newTargetUnit === "kg" ? "kg weight" : "% body composition"}`;
  };

  const handleCreateMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    addNewMember({
      name: newName.trim(),
      sex: newSex,
      age: Number(newAge) || 28,
      height: Number(newHeight) || 168,
      weight: Number(newWeight) || 72,
      calorieGoal: effectiveCalories,
      proteinGoal: effectiveProtein,
      dietGoal: newGoal,
      targetDelta: Number(newTargetDelta) || 0,
      targetUnit: newTargetUnit,
      dietaryStyle: newDietaryStyle,
      dietaryRestrictions: selectedDislikes.filter((r) => !r.toLowerCase().startsWith("no ")),
      dislikedFoods: selectedDislikes,
      allergies: selectedAllergies.filter((a) => a !== "None"),
    });

    setShowCreateModal(false);
    setShowMemberSelector(false);
    setNewName("");
    setSelectedDislikes([]);
    setSelectedAllergies([]);
    setIsManualOverride(false);
  };

  return (
    <div className="min-h-screen bg-canvas flex flex-col items-center justify-center p-6 text-ink-primary select-none">
      <div className="w-full max-w-[840px] space-y-8">
        {/* Brand & Mission Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-tint border border-[#D5E6D2] text-xs font-medium text-brand mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse" />
            <span>NutriCoach AI · Egyptian Gym Innovation</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-ink-primary">
            Adaptive AI Nutrition Platform
          </h1>
          <p className="text-xs md:text-sm text-ink-secondary max-w-lg mx-auto leading-relaxed">
            Continuous nutrition intelligence for gym members that automatically adapts to real food logs while returning hundreds of hours to coaches.
          </p>
        </div>

        {/* 2 Primary Portals (Member vs Coach) */}
        <div className="grid md:grid-cols-2 gap-4">
          {/* Member Card */}
          <div
            onClick={() => setShowMemberSelector(true)}
            className="group bg-surface rounded-xl border border-border p-6 shadow-card hover:border-brand/40 hover:shadow-md transition-all cursor-pointer space-y-4 flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-lg bg-brand-tint text-brand flex items-center justify-center">
                <Utensils className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-ink-primary group-hover:text-brand transition-colors">
                  Member Experience
                </h2>
                <p className="text-xs text-ink-muted mt-1 leading-relaxed">
                  Experience how gym athletes interact with adaptive meal plans, log off-plan foods (like Koshary), and receive instant verified adjustments.
                </p>
              </div>

              <div className="flex flex-wrap gap-1.5 pt-1 text-[11px] text-ink-secondary">
                <span className="bg-surface-subtle px-2 py-0.5 rounded border border-border">6 Demo Personas</span>
                <span className="bg-surface-subtle px-2 py-0.5 rounded border border-border">+ Custom User</span>
                <span className="bg-surface-subtle px-2 py-0.5 rounded border border-border">Adaptive Rebalancing</span>
              </div>
            </div>

            <div className="flex items-center text-xs font-medium text-brand pt-2 group-hover:translate-x-0.5 transition-transform">
              <span>Choose a Member Profile</span>
              <ChevronRight className="w-4 h-4 ml-1" />
            </div>
          </div>

          {/* Coach Dashboard Card */}
          <div
            onClick={() => setCurrentView("coach")}
            className="group bg-surface rounded-xl border border-border p-6 shadow-card hover:border-brand/40 hover:shadow-md transition-all cursor-pointer space-y-4 flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-lg bg-surface-subtle text-ink-primary border border-border flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-ink-primary group-hover:text-brand transition-colors">
                  Coach Workspace
                </h2>
                <p className="text-xs text-ink-muted mt-1 leading-relaxed">
                  Enter the staff dashboard to monitor 48 gym members, review AI deviation triage, approve exceptions, and audit time saved.
                </p>
              </div>

              <div className="flex flex-wrap gap-1.5 pt-1 text-[11px] text-ink-secondary">
                <span className="bg-surface-subtle px-2 py-0.5 rounded border border-border">Team Adherence Chart</span>
                <span className="bg-surface-subtle px-2 py-0.5 rounded border border-border">Exception Triage</span>
                <span className="bg-surface-subtle px-2 py-0.5 rounded border border-border">Activity Audit Log</span>
              </div>
            </div>

            <div className="flex items-center text-xs font-medium text-ink-primary group-hover:text-brand pt-2 group-hover:translate-x-0.5 transition-transform">
              <span>Enter Coach Dashboard</span>
              <ChevronRight className="w-4 h-4 ml-1" />
            </div>
          </div>
        </div>

        {/* Platform Capabilities Summary */}
        <div className="bg-surface-subtle rounded-xl border border-border p-4 flex flex-col md:flex-row items-center justify-between text-xs text-ink-secondary gap-3">
          <div className="flex items-center gap-2 text-ink-primary font-medium">
            <Sparkles className="w-4 h-4 text-brand" />
            <span>Autonomous Nutrition Operations</span>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-ink-muted">
            <span>Real-time meal adjustments</span>
            <span>·</span>
            <span className="text-brand font-medium">Automatic macro rebalancing</span>
            <span>·</span>
            <span>Direct coach support</span>
          </div>
        </div>
      </div>

      {/* Member Selection Modal */}
      {showMemberSelector && (
        <div className="fixed inset-0 bg-ink-primary/20 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-surface rounded-xl border border-border max-w-lg w-full p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-sm font-semibold text-ink-primary">Select Demo Member</h3>
                <p className="text-[11px] text-ink-muted">Choose a scenario to test specific adaptive agent behaviors</p>
              </div>
              <button
                onClick={() => setShowMemberSelector(false)}
                className="p-1 text-ink-muted hover:text-ink-primary rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 6 Personas List */}
            <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
              {state.members.map((m) => (
                <div
                  key={m.id}
                  onClick={() => {
                    selectMemberAndEnter(m.id);
                    setShowMemberSelector(false);
                  }}
                  className="p-3 rounded-lg border border-border bg-surface hover:border-brand/50 hover:bg-surface-hover cursor-pointer transition-all flex items-center justify-between"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-xs text-ink-primary">{m.name}</span>
                      <span className="text-[10px] px-1.5 py-0.2 bg-brand-tint text-brand rounded font-medium">
                        {m.scenarioLabel}
                      </span>
                    </div>
                    <p className="text-[11px] text-ink-muted leading-tight">{m.scenarioDescription}</p>
                    <div className="text-[10px] text-ink-secondary">
                      Goal: {m.goal} · Target: {m.targets.calories} kcal ({m.targets.protein}g P)
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-ink-muted shrink-0" />
                </div>
              ))}
            </div>

            {/* 7th Option: + Create New Member */}
            <div className="pt-2 border-t border-border flex items-center justify-between">
              <span className="text-[11px] text-ink-muted">Or create a custom profile:</span>
              <button
                onClick={() => {
                  setShowMemberSelector(false);
                  setShowCreateModal(true);
                }}
                className="text-xs font-medium text-brand hover:text-brand-hover bg-brand-tint px-3 py-1.5 rounded-md border border-[#D5E6D2] flex items-center gap-1.5 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Create New Member</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Create New Member Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-ink-primary/25 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <form
            onSubmit={handleCreateMember}
            className="bg-surface rounded-xl border border-border max-w-xl w-full p-5 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-sm font-semibold text-ink-primary flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-brand" />
                  <span>Create New Member Profile</span>
                </h3>
                <p className="text-[11px] text-ink-muted">Complete biometric intake, primary goal, dietary style & allergen guardrails</p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-1 text-ink-muted hover:text-ink-primary rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Section A: Biometrics & Demographics */}
              <div className="space-y-2">
                <div className="text-[11px] font-semibold text-ink-primary uppercase tracking-wide flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-brand" />
                  <span>A. Biometrics & Demographics</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="block font-medium text-ink-secondary mb-1">Full Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Hala Mahmoud"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="w-full bg-surface-subtle border border-border rounded-md px-3 py-1.5 text-ink-primary focus:outline-none focus:border-brand font-medium text-xs"
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-ink-secondary mb-1">Sex</label>
                    <div className="flex rounded-md bg-surface-subtle p-0.5 border border-border">
                      <button
                        type="button"
                        onClick={() => setNewSex("male")}
                        className={`flex-1 py-1.5 text-xs font-medium rounded transition-all ${
                          newSex === "male"
                            ? "bg-brand text-white shadow-hairline"
                            : "text-ink-secondary hover:text-ink-primary"
                        }`}
                      >
                        Male
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewSex("female")}
                        className={`flex-1 py-1.5 text-xs font-medium rounded transition-all ${
                          newSex === "female"
                            ? "bg-brand text-white shadow-hairline"
                            : "text-ink-secondary hover:text-ink-primary"
                        }`}
                      >
                        Female
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block font-medium text-ink-secondary mb-1">Age (Years)</label>
                    <input
                      type="number"
                      min={14}
                      max={90}
                      required
                      value={newAge}
                      onChange={(e) => setNewAge(Number(e.target.value))}
                      className="w-full bg-surface-subtle border border-border rounded-md px-3 py-1.5 text-ink-primary focus:outline-none focus:border-brand font-medium text-xs"
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-ink-secondary mb-1">Height (cm)</label>
                    <input
                      type="number"
                      min={120}
                      max={230}
                      required
                      value={newHeight}
                      onChange={(e) => setNewHeight(Number(e.target.value))}
                      className="w-full bg-surface-subtle border border-border rounded-md px-3 py-1.5 text-ink-primary focus:outline-none focus:border-brand font-medium text-xs"
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-ink-secondary mb-1">Current Weight (kg)</label>
                    <input
                      type="number"
                      min={35}
                      max={250}
                      required
                      value={newWeight}
                      onChange={(e) => setNewWeight(Number(e.target.value))}
                      className="w-full bg-surface-subtle border border-border rounded-md px-3 py-1.5 text-ink-primary focus:outline-none focus:border-brand font-medium text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Section B: Goal & Target Delta */}
              <div className="space-y-2 pt-2 border-t border-border">
                <div className="text-[11px] font-semibold text-ink-primary uppercase tracking-wide flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-brand" />
                  <span>B. Goal & Target Delta</span>
                </div>

                <div>
                  <label className="block font-medium text-ink-secondary mb-1">Primary Goal</label>
                  <select
                    value={newGoal}
                    onChange={(e) => setNewGoal(e.target.value)}
                    className="w-full bg-surface-subtle border border-border rounded-md px-3 py-1.5 text-ink-primary focus:outline-none focus:border-brand font-medium text-xs"
                  >
                    <option value="Fat Loss & Tone">Fat Loss & Tone</option>
                    <option value="Lean Muscle Gain & Hypertrophy">Lean Muscle Gain & Hypertrophy</option>
                    <option value="Endurance & Athletic Performance">Endurance & Athletic Performance</option>
                    <option value="Maintenance & General Health">Maintenance & General Health</option>
                  </select>
                </div>

                <div className="bg-surface-subtle/70 rounded-lg border border-border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="font-medium text-ink-secondary text-[11px]">Target Weight Delta</label>
                    <span className="text-[10px] text-ink-muted">Measurable milestone</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 items-center">
                    <div>
                      <input
                        type="number"
                        min={0}
                        max={50}
                        value={newTargetDelta}
                        onChange={(e) => setNewTargetDelta(Number(e.target.value))}
                        placeholder="e.g. 4"
                        className="w-full bg-surface border border-border rounded-md px-3 py-1.5 text-ink-primary focus:outline-none focus:border-brand font-semibold text-xs"
                      />
                    </div>

                    <div className="flex rounded-md bg-surface p-0.5 border border-border">
                      <button
                        type="button"
                        onClick={() => setNewTargetUnit("kg")}
                        className={`flex-1 py-1 text-[11px] font-medium rounded transition-all ${
                          newTargetUnit === "kg"
                            ? "bg-brand text-white shadow-hairline"
                            : "text-ink-muted hover:text-ink-primary"
                        }`}
                      >
                        kg / kilos
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewTargetUnit("% body fat")}
                        className={`flex-1 py-1 text-[11px] font-medium rounded transition-all ${
                          newTargetUnit === "% body fat"
                            ? "bg-brand text-white shadow-hairline"
                            : "text-ink-muted hover:text-ink-primary"
                        }`}
                      >
                        % body fat
                      </button>
                    </div>
                  </div>

                  {/* Dynamic Preview Text */}
                  <div className="text-[11px] text-brand font-medium bg-brand-tint/60 px-2.5 py-1 rounded border border-[#D5E6D2] flex items-center justify-between">
                    <span>🎯 Goal: {getDynamicGoalPreview()}</span>
                    <span className="text-[10px] text-brand font-semibold">Active Milestone</span>
                  </div>
                </div>
              </div>

              {/* Section C: Dietary Preferences, Allergies & Exclusions */}
              <div className="space-y-3 pt-2 border-t border-border">
                <div className="text-[11px] font-semibold text-ink-primary uppercase tracking-wide flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-brand" />
                  <span>C. Dietary Preferences, Allergies & Exclusions</span>
                </div>

                {/* Dietary Style */}
                <div className="space-y-1">
                  <label className="block font-medium text-ink-secondary text-[11px]">Dietary Style</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {dietaryStyles.map((style) => {
                      const active = newDietaryStyle === style;
                      return (
                        <button
                          key={style}
                          type="button"
                          onClick={() => setNewDietaryStyle(style)}
                          className={`text-[11px] py-1.5 px-2 rounded-md border text-center transition-all ${
                            active
                              ? "bg-brand-tint text-brand border-[#D5E6D2] font-semibold"
                              : "bg-surface-subtle text-ink-secondary border-border hover:bg-surface"
                          }`}
                        >
                          {active ? "✓ " : ""}{style}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Allergies Multi-Select Tags */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="font-medium text-status-danger text-xs flex items-center gap-1">
                      <span>⚠️ Allergies (Strict Exclusion)</span>
                    </label>
                    <span className="text-[10px] text-ink-muted">High priority guardrail</span>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {commonAllergies.map((allergy) => {
                      const active = selectedAllergies.includes(allergy);
                      return (
                        <button
                          key={allergy}
                          type="button"
                          onClick={() => toggleAllergy(allergy)}
                          className={`text-[11px] px-2.5 py-1 rounded-md border transition-all ${
                            active
                              ? "bg-[#FEF2F2] text-status-danger border-[#FCA5A5] font-semibold"
                              : "bg-surface-subtle text-ink-secondary border-border hover:bg-surface"
                          }`}
                        >
                          {active ? "✓ " : ""}{allergy}
                        </button>
                      );
                    })}
                  </div>

                  {/* Custom Allergen Input */}
                  <div className="flex gap-1.5 pt-0.5">
                    <input
                      type="text"
                      placeholder="+ Add custom allergy (e.g. Sesame, Soy)"
                      value={customAllergyInput}
                      onChange={(e) => setCustomAllergyInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addCustomAllergy(e)}
                      className="flex-1 bg-surface-subtle border border-border rounded-md px-2.5 py-1 text-xs text-ink-primary focus:outline-none focus:border-brand"
                    />
                    <button
                      type="button"
                      onClick={() => addCustomAllergy()}
                      className="text-xs bg-surface hover:bg-surface-hover px-2.5 py-1 rounded-md border border-border text-ink-primary font-medium"
                    >
                      Add
                    </button>
                  </div>
                </div>

                {/* Disliked Foods (Tag input & chips) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="font-medium text-ink-secondary text-xs">Disliked Foods & Excluded Ingredients</label>
                    <span className="text-[10px] text-ink-muted">Replaced in meal planner</span>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {commonDislikes.map((item) => {
                      const active = selectedDislikes.includes(item);
                      return (
                        <button
                          key={item}
                          type="button"
                          onClick={() => toggleDislike(item)}
                          className={`text-[11px] px-2.5 py-1 rounded-md border transition-all ${
                            active
                              ? "bg-brand-tint text-brand border-[#D5E6D2] font-semibold"
                              : "bg-surface-subtle text-ink-secondary border-border hover:bg-surface"
                          }`}
                        >
                          {active ? "✓ " : ""}{item}
                        </button>
                      );
                    })}
                  </div>

                  {/* Active Excluded Tags */}
                  {selectedDislikes.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {selectedDislikes.map((d) => (
                        <span
                          key={d}
                          className="inline-flex items-center gap-1 text-[11px] bg-brand-tint text-brand px-2 py-0.5 rounded border border-[#D5E6D2] font-medium"
                        >
                          <span>{d}</span>
                          <button
                            type="button"
                            onClick={() => removeDislike(d)}
                            className="hover:text-status-danger p-0.5"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Custom Excluded Ingredient Input */}
                  <div className="flex gap-1.5 pt-0.5">
                    <input
                      type="text"
                      placeholder="Type ingredients to exclude (e.g. chicken, tuna, mushrooms)"
                      value={customDislikeInput}
                      onChange={(e) => setCustomDislikeInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addCustomDislike(e)}
                      className="flex-1 bg-surface-subtle border border-border rounded-md px-2.5 py-1 text-xs text-ink-primary focus:outline-none focus:border-brand"
                    />
                    <button
                      type="button"
                      onClick={() => addCustomDislike()}
                      className="text-xs bg-surface hover:bg-surface-hover px-2.5 py-1 rounded-md border border-border text-ink-primary font-medium"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>

              {/* Section D: Automatic Target Calculation */}
              <div className="space-y-2.5 pt-2 border-t border-border">
                <div className="text-[11px] font-semibold text-ink-primary uppercase tracking-wide flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-brand" />
                  <span>D. Daily Nutrition Targets</span>
                </div>

                <div className="bg-brand-tint/60 border border-[#D5E6D2] rounded-lg p-3 flex items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="text-xs font-semibold text-brand flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Recommended: ~{computedTargets.calories.toLocaleString()} kcal · {computedTargets.protein}g Protein</span>
                    </div>
                    <div className="text-[10px] text-ink-secondary">
                      Mifflin-St Jeor BMR ({computedTargets.bmr} kcal) + 1.45 TDEE ({computedTargets.tdee} kcal) · {newGoal}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (!isManualOverride) {
                        setCustomCalories(computedTargets.calories);
                        setCustomProtein(computedTargets.protein);
                      }
                      setIsManualOverride(!isManualOverride);
                    }}
                    className="text-[11px] font-semibold px-2.5 py-1 rounded bg-surface border border-border text-ink-primary hover:bg-surface-subtle transition-all shrink-0"
                  >
                    {isManualOverride ? "Use Auto Calculated" : "Edit Manually"}
                  </button>
                </div>

                {isManualOverride && (
                  <div className="grid grid-cols-2 gap-3 p-3 bg-surface-subtle rounded-lg border border-border">
                    <div>
                      <label className="block font-medium text-ink-secondary mb-1">Custom Daily Calories (kcal)</label>
                      <input
                        type="number"
                        min={800}
                        max={6000}
                        value={customCalories}
                        onChange={(e) => setCustomCalories(Number(e.target.value))}
                        className="w-full bg-surface border border-border rounded-md px-3 py-1.5 text-ink-primary focus:outline-none focus:border-brand font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-ink-secondary mb-1">Custom Daily Protein (g)</label>
                      <input
                        type="number"
                        min={30}
                        max={350}
                        value={customProtein}
                        onChange={(e) => setCustomProtein(Number(e.target.value))}
                        className="w-full bg-surface border border-border rounded-md px-3 py-1.5 text-ink-primary focus:outline-none focus:border-brand font-semibold"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-xs text-ink-secondary px-3 py-1.5 rounded-md border border-border hover:bg-surface-subtle"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="text-xs font-semibold text-white bg-brand hover:bg-brand-hover px-4 py-1.5 rounded-md shadow-hairline flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Save & Enter App</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

