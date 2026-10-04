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
  const [newGoal, setNewGoal] = useState("Fat Loss & Tone");
  const [newTargetDelta, setNewTargetDelta] = useState<number>(5);
  const [newTargetUnit, setNewTargetUnit] = useState<"kg" | "% body fat">("kg");
  const [newCalories, setNewCalories] = useState<number>(1750);
  const [newProtein, setNewProtein] = useState<number>(140);
  const [newSex, setNewSex] = useState<"male" | "female">("male");

  // Restrictions and Allergies
  const [selectedRestrictions, setSelectedRestrictions] = useState<string[]>([]);
  const [customDislikeInput, setCustomDislikeInput] = useState("");
  const [selectedAllergies, setSelectedAllergies] = useState<string[]>([]);
  const [customAllergyInput, setCustomAllergyInput] = useState("");

  const commonRestrictions = [
    "No Chicken",
    "No Red Meat",
    "Vegetarian",
    "Pescatarian",
    "Dairy-Free",
    "Low Sodium",
  ];

  const commonAllergies = [
    "Peanut / Nut Allergy",
    "Lactose / Dairy",
    "Gluten / Celiac",
    "Shellfish",
  ];

  const handleGoalChange = (goal: string) => {
    setNewGoal(goal);
    if (goal === "Fat Loss & Tone") {
      setNewCalories(1750);
      setNewProtein(140);
      setNewTargetDelta(5);
    } else if (goal === "Lean Muscle Gain & Hypertrophy") {
      setNewCalories(2450);
      setNewProtein(170);
      setNewTargetDelta(3);
    } else if (goal === "Endurance & Athletic Performance") {
      setNewCalories(2250);
      setNewProtein(135);
      setNewTargetDelta(2);
    } else {
      setNewCalories(2000);
      setNewProtein(130);
      setNewTargetDelta(0);
    }
  };

  const toggleRestriction = (item: string) => {
    setSelectedRestrictions((prev) =>
      prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]
    );
  };

  const addCustomDislike = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customDislikeInput.trim()) return;
    const item = customDislikeInput.trim();
    if (!selectedRestrictions.includes(item)) {
      setSelectedRestrictions((prev) => [...prev, item]);
    }
    setCustomDislikeInput("");
  };

  const toggleAllergy = (item: string) => {
    setSelectedAllergies((prev) =>
      prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]
    );
  };

  const addCustomAllergy = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customAllergyInput.trim()) return;
    const item = customAllergyInput.trim();
    if (!selectedAllergies.includes(item)) {
      setSelectedAllergies((prev) => [...prev, item]);
    }
    setCustomAllergyInput("");
  };

  const getDynamicGoalPreview = () => {
    if (newGoal === "Fat Loss & Tone") {
      return `Goal: Lose ${newTargetDelta} ${newTargetUnit === "kg" ? "kg" : "% body fat"}`;
    }
    if (newGoal === "Lean Muscle Gain & Hypertrophy") {
      return `Goal: Gain +${newTargetDelta} ${newTargetUnit === "kg" ? "kg lean muscle" : "% muscle mass"}`;
    }
    if (newGoal === "Endurance & Athletic Performance") {
      return `Goal: +${newTargetDelta} ${newTargetUnit === "kg" ? "kg stamina efficiency" : "% VO2 endurance"}`;
    }
    return `Goal: Maintain ±${newTargetDelta} ${newTargetUnit === "kg" ? "kg weight" : "% body composition"}`;
  };

  const handleCreateMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    addNewMember({
      name: newName.trim(),
      calorieGoal: Number(newCalories) || 2000,
      proteinGoal: Number(newProtein) || 140,
      dietGoal: newGoal,
      targetDelta: Number(newTargetDelta) || 0,
      targetUnit: newTargetUnit,
      dietaryRestrictions: selectedRestrictions.filter((r) => !r.toLowerCase().includes("no ")),
      dislikedFoods: selectedRestrictions,
      allergies: selectedAllergies,
      sex: newSex,
    });
    setShowCreateModal(false);
    setShowMemberSelector(false);
    setNewName("");
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
            className="bg-surface rounded-xl border border-border max-w-lg w-full p-5 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-sm font-semibold text-ink-primary flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-brand" />
                  <span>Create New Member Profile</span>
                </h3>
                <p className="text-[11px] text-ink-muted">Configure goals, quantitative targets, dietary preferences & allergies</p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-1 text-ink-muted hover:text-ink-primary rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              {/* Full Name & Sex */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block font-medium text-ink-secondary mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Tarek Mansour"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full bg-surface-subtle border border-border rounded-md px-3 py-1.5 text-ink-primary focus:outline-none focus:border-brand"
                  />
                </div>
                <div>
                  <label className="block font-medium text-ink-secondary mb-1">Sex</label>
                  <select
                    value={newSex}
                    onChange={(e) => setNewSex(e.target.value as "male" | "female")}
                    className="w-full bg-surface-subtle border border-border rounded-md px-2.5 py-1.5 text-ink-primary focus:outline-none focus:border-brand font-medium"
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </div>
              </div>

              {/* Primary Nutrition Goal Dropdown */}
              <div>
                <label className="block font-medium text-ink-secondary mb-1">Primary Nutrition Goal</label>
                <select
                  value={newGoal}
                  onChange={(e) => handleGoalChange(e.target.value)}
                  className="w-full bg-surface-subtle border border-border rounded-md px-3 py-1.5 text-ink-primary focus:outline-none focus:border-brand font-medium text-xs"
                >
                  <option value="Fat Loss & Tone">Fat Loss & Tone</option>
                  <option value="Lean Muscle Gain & Hypertrophy">Lean Muscle Gain & Hypertrophy</option>
                  <option value="Endurance & Athletic Performance">Endurance & Athletic Performance</option>
                  <option value="Maintenance & General Health">Maintenance & General Health</option>
                </select>
              </div>

              {/* Quantitative Target (Goal Count & Metric) */}
              <div className="bg-surface-subtle/70 rounded-lg border border-border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-medium text-ink-secondary text-[11px]">Quantitative Goal Target</label>
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
                      placeholder="e.g. 5"
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
                  <span>🎯 {getDynamicGoalPreview()}</span>
                  <span className="text-[10px] text-brand font-semibold">Active Objective</span>
                </div>
              </div>

              {/* Prescribed Daily Calories & Protein */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-ink-secondary mb-1">Daily Calories (kcal)</label>
                  <input
                    type="number"
                    value={newCalories}
                    onChange={(e) => setNewCalories(Number(e.target.value))}
                    className="w-full bg-surface-subtle border border-border rounded-md px-3 py-1.5 text-ink-primary focus:outline-none focus:border-brand font-semibold"
                  />
                </div>
                <div>
                  <label className="block font-medium text-ink-secondary mb-1">Daily Protein (g)</label>
                  <input
                    type="number"
                    value={newProtein}
                    onChange={(e) => setNewProtein(Number(e.target.value))}
                    className="w-full bg-surface-subtle border border-border rounded-md px-3 py-1.5 text-ink-primary focus:outline-none focus:border-brand font-semibold"
                  />
                </div>
              </div>

              {/* Dietary Restrictions & Dislikes (Tags / Multi-Select) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="font-medium text-ink-secondary text-xs">Dietary Restrictions & Dislikes</label>
                  <span className="text-[10px] text-ink-muted">Strictly excluded in plan</span>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {commonRestrictions.map((item) => {
                    const active = selectedRestrictions.includes(item);
                    return (
                      <button
                        key={item}
                        type="button"
                        onClick={() => toggleRestriction(item)}
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

                {/* Custom Excluded Ingredient Input */}
                <div className="flex gap-1.5 pt-1">
                  <input
                    type="text"
                    placeholder="+ Add excluded ingredient (e.g., chicken, tuna, eggs)"
                    value={customDislikeInput}
                    onChange={(e) => setCustomDislikeInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addCustomDislike(e)}
                    className="flex-1 bg-surface-subtle border border-border rounded-md px-2.5 py-1 text-xs text-ink-primary focus:outline-none focus:border-brand"
                  />
                  <button
                    type="button"
                    onClick={addCustomDislike}
                    className="text-xs bg-surface hover:bg-surface-hover px-2.5 py-1 rounded-md border border-border text-ink-primary font-medium"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Allergies & Intolerances (Crucial Guardrails) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="font-medium text-status-danger text-xs flex items-center gap-1">
                    <span>⚠️ Allergies & Intolerances</span>
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
                        {active ? "⚠️ " : ""}{allergy}
                      </button>
                    );
                  })}
                </div>

                {/* Custom Allergen Input */}
                <div className="flex gap-1.5 pt-1">
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
                    onClick={addCustomAllergy}
                    className="text-xs bg-surface hover:bg-surface-hover px-2.5 py-1 rounded-md border border-border text-ink-primary font-medium"
                  >
                    Add
                  </button>
                </div>
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

