"use client";

import React, { useState } from "react";
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  ChevronRight,
  Flame,
  LineChart,
  Plus,
  Sparkles,
  TrendingUp,
  User,
  UserCheck,
  Users,
  Utensils,
  X,
  Zap,
} from "lucide-react";
import { useNutriCoach } from "./NutriCoachContext";

export function LandingPortal() {
  const { state, selectMemberAndEnter, addNewMember, setCurrentView } = useNutriCoach();
  const [showMemberSelector, setShowMemberSelector] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // New member form state
  const [newName, setNewName] = useState("");
  const [newCalories, setNewCalories] = useState(2100);
  const [newProtein, setNewProtein] = useState(150);
  const [newGoal, setNewGoal] = useState("Lean Muscle & Athletic Performance");
  const [newSex, setNewSex] = useState<"male" | "female">("male");

  const handleCreateMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    addNewMember({
      name: newName.trim(),
      calorieGoal: Number(newCalories) || 2000,
      proteinGoal: Number(newProtein) || 140,
      dietGoal: newGoal,
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
                <span className="bg-surface-subtle px-2 py-0.5 rounded border border-border">Gym ROI Model</span>
              </div>
            </div>

            <div className="flex items-center text-xs font-medium text-ink-primary group-hover:text-brand pt-2 group-hover:translate-x-0.5 transition-transform">
              <span>Enter Coach Dashboard</span>
              <ChevronRight className="w-4 h-4 ml-1" />
            </div>
          </div>
        </div>

        {/* Business Impact Footer Summary */}
        <div className="bg-surface-subtle rounded-xl border border-border p-4 flex flex-col md:flex-row items-center justify-between text-xs text-ink-secondary gap-3">
          <div className="flex items-center gap-2 text-ink-primary font-medium">
            <TrendingUp className="w-4 h-4 text-brand" />
            <span>Modeled Gym Economics:</span>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-ink-muted">
            <span>50 members · 25,000 EGP/mo</span>
            <span>·</span>
            <span className="text-brand font-medium">+10,000 EGP/mo revenue uplift</span>
            <span>·</span>
            <span>75 Coach hours returned</span>
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

      {/* Create New Member Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-ink-primary/20 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <form
            onSubmit={handleCreateMember}
            className="bg-surface rounded-xl border border-border max-w-md w-full p-5 space-y-4 shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-sm font-semibold text-ink-primary">Create New Member</h3>
                <p className="text-[11px] text-ink-muted">Add a custom member with personalized goals</p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-1 text-ink-muted hover:text-ink-primary rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-ink-secondary mb-1">Daily Calories (kcal)</label>
                  <input
                    type="number"
                    value={newCalories}
                    onChange={(e) => setNewCalories(Number(e.target.value))}
                    className="w-full bg-surface-subtle border border-border rounded-md px-3 py-1.5 text-ink-primary focus:outline-none focus:border-brand"
                  />
                </div>
                <div>
                  <label className="block font-medium text-ink-secondary mb-1">Daily Protein (g)</label>
                  <input
                    type="number"
                    value={newProtein}
                    onChange={(e) => setNewProtein(Number(e.target.value))}
                    className="w-full bg-surface-subtle border border-border rounded-md px-3 py-1.5 text-ink-primary focus:outline-none focus:border-brand"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-ink-secondary mb-1">Primary Nutrition Goal</label>
                <input
                  type="text"
                  value={newGoal}
                  onChange={(e) => setNewGoal(e.target.value)}
                  className="w-full bg-surface-subtle border border-border rounded-md px-3 py-1.5 text-ink-primary focus:outline-none focus:border-brand"
                />
              </div>

              <div>
                <label className="block font-medium text-ink-secondary mb-1">Sex</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-1.5 text-xs text-ink-secondary cursor-pointer">
                    <input
                      type="radio"
                      name="sex"
                      checked={newSex === "male"}
                      onChange={() => setNewSex("male")}
                      className="text-brand focus:ring-0"
                    />
                    <span>Male</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-ink-secondary cursor-pointer">
                    <input
                      type="radio"
                      name="sex"
                      checked={newSex === "female"}
                      onChange={() => setNewSex("female")}
                      className="text-brand focus:ring-0"
                    />
                    <span>Female</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-xs text-ink-secondary px-3 py-1.5 rounded-md border border-border hover:bg-surface-subtle"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="text-xs font-medium text-white bg-brand hover:bg-brand-hover px-4 py-1.5 rounded-md shadow-hairline"
              >
                Save & Enter App
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
