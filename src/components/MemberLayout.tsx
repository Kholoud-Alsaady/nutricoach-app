"use client";

import React from "react";
import { MemberSidebar } from "./MemberSidebar";
import { MacroSummary } from "./MacroSummary";
import { AdaptiveAdjustmentBox } from "./AdaptiveAdjustmentBox";
import { MealsStream } from "./MealsStream";
import { AskNutriCoachPanel } from "./AskNutriCoachPanel";
import { CoachDirectView } from "./CoachDirectView";
import { MealPlanView } from "./MealPlanView";
import { ProgressView } from "./ProgressView";
import { MemberProfileView } from "./MemberProfileView";
import { TodayTipCard } from "./TodayTipCard";
import { useNutriCoach } from "./NutriCoachContext";

export function MemberLayout() {
  const { state, activeProfile, setCurrentView } = useNutriCoach();

  const getGreeting = () => {
    const name = activeProfile?.name?.split(" ")[0] || "Athlete";
    return `Good evening, ${name}`;
  };

  const getStatusText = () => {
    if (state.activeMemberId === state.members[2].id) {
      return "Lunch deviation detected. Dinner adjustment proposed below.";
    }
    if (state.activeMemberId === state.members[5].id) {
      return "Inactivity detected. Coach follow-up prepared.";
    }
    return "You're on track today.";
  };

  return (
    <div className="min-h-screen bg-canvas flex justify-center selection:bg-brand-tint selection:text-brand">
      <div className="w-full max-w-[1200px] flex min-h-screen border-x border-border/60 bg-canvas">
        {/* Member-Only Left Navigation (220px fixed) */}
        <MemberSidebar />

        {/* Center Main Workspace (640px flexible) */}
        <main className="flex-1 min-w-0 px-6 py-6 overflow-y-auto space-y-5">
          {/* Header Banner with Clean Breadcrumb */}
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div>
              <div className="flex items-center gap-1.5 text-[11px] text-ink-muted mb-1">
                <button
                  onClick={() => setCurrentView("portal")}
                  className="hover:text-brand transition-colors"
                >
                  Portal
                </button>
                <span>/</span>
                <span className="text-ink-primary font-medium">{activeProfile.name}</span>
              </div>
              <h2 className="text-base font-semibold text-ink-primary tracking-tight">
                {state.activeTab === "plan"
                  ? "Weekly Meal Planner"
                  : state.activeTab === "progress"
                  ? "Adherence & Progress Trends"
                  : state.activeTab === "profile"
                  ? "Member Profile & Targets"
                  : state.activeTab === "ask"
                  ? "Direct Coach Support"
                  : getGreeting()}
              </h2>
              <p className="text-xs text-ink-secondary mt-0.5">
                {state.activeTab === "plan"
                  ? `Active meal plan for ${activeProfile.name}`
                  : state.activeTab === "progress"
                  ? "Continuous compliance telemetry and behavioral patterns"
                  : state.activeTab === "profile"
                  ? "Prescribed macro goals and dietary settings"
                  : state.activeTab === "ask"
                  ? "Direct communication with Coach Captain Ahmed"
                  : getStatusText()}
              </p>
            </div>

            {state.activeTab === "today" && (
              <div className="flex items-center gap-1.5 text-xs text-brand font-medium bg-brand-tint px-2.5 py-1 rounded-md border border-[#D5E6D2]">
                <span className="w-1.5 h-1.5 rounded-full bg-brand" />
                <span>Adaptive active</span>
              </div>
            )}
          </div>

          {/* Member Content Routing */}
          {state.activeTab === "today" && (
            <div className="space-y-4">
              {/* Flat Macro Summary Row */}
              <MacroSummary />

              {/* Today's Curated Tip Editorial Card */}
              <TodayTipCard />

              {/* Adaptive AI Adjustment Box (Keep this change / Edit) */}
              <AdaptiveAdjustmentBox />

              {/* Meals Stream (Breakfast, Lunch, Snack, Dinner + Additional Meals) */}
              <MealsStream />
            </div>
          )}

          {state.activeTab === "plan" && <MealPlanView />}

          {state.activeTab === "progress" && <ProgressView />}

          {state.activeTab === "profile" && <MemberProfileView />}

          {state.activeTab === "ask" && <CoachDirectView />}
        </main>

        {/* Right Contextual Panel (340px) */}
        <AskNutriCoachPanel />
      </div>
    </div>
  );
}

