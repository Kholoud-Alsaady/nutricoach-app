"use client";

import React from "react";
import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Compass,
  LineChart,
  MessageSquare,
  Sparkles,
  TrendingUp,
  User,
  Users,
  Utensils,
  Zap,
} from "lucide-react";
import { useNutriCoach } from "./NutriCoachContext";

export function Sidebar() {
  const { state, activeProfile, setActiveMember, setActiveTab, resetDemo } = useNutriCoach();

  const navItems = [
    { id: "today", label: "Today", icon: CalendarDays },
    { id: "plan", label: "Meal plan", icon: Utensils },
    { id: "progress", label: "Progress", icon: LineChart },
    { id: "coach", label: "Coach Hub", icon: Users },
    { id: "roi", label: "Impact & ROI", icon: TrendingUp },
  ] as const;

  return (
    <aside className="w-[220px] shrink-0 border-r border-border bg-canvas flex flex-col justify-between h-screen sticky top-0 px-4 py-5 select-none">
      {/* Brand Header */}
      <div>
        <div className="flex items-center gap-2.5 px-2 mb-6">
          <div className="w-7 h-7 rounded-md bg-brand flex items-center justify-center text-white font-medium text-sm">
            N
          </div>
          <div>
            <h1 className="font-medium text-ink-primary text-sm tracking-tight leading-none">NutriCoach</h1>
            <p className="text-[11px] text-ink-muted mt-0.5">Adaptive Nutrition Agent</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = state.activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  isActive
                    ? "bg-surface text-ink-primary shadow-hairline border border-border"
                    : "text-ink-secondary hover:text-ink-primary hover:bg-surface-subtle"
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? "text-brand" : "text-ink-muted"}`} />
                <span>{item.label}</span>
                {item.id === "coach" && (
                  <span className="ml-auto text-[10px] px-1.5 py-0.2 bg-brand-tint text-brand rounded font-medium">
                    Triage
                  </span>
                )}
                {item.id === "roi" && (
                  <span className="ml-auto text-[10px] px-1.5 py-0.2 bg-surface-subtle text-ink-secondary rounded font-medium">
                    EGP
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Persistent Demo Switcher */}
      <div className="border-t border-border pt-3 space-y-3">
        <div className="px-2">
          <div className="flex items-center justify-between text-[11px] font-medium text-ink-muted uppercase tracking-wider mb-1.5">
            <span>Demo Member</span>
            <button
              onClick={resetDemo}
              className="text-[10px] text-ink-secondary hover:text-brand transition-colors normal-case font-normal"
              title="Reset all member scenarios to default state"
            >
              Reset
            </button>
          </div>

          <div className="relative">
            <select
              value={state.activeMemberId}
              onChange={(e) => setActiveMember(e.target.value)}
              className="w-full appearance-none bg-surface border border-border text-xs text-ink-primary rounded-md px-2.5 py-1.5 pr-7 focus:outline-none focus:border-brand cursor-pointer shadow-hairline font-normal"
            >
              {state.members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.scenarioLabel})
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-ink-muted absolute right-2 top-2.5 pointer-events-none" />
          </div>

          <div className="mt-2 text-[11px] text-ink-muted leading-tight px-0.5">
            Scenario: <span className="text-ink-secondary">{state.members.find((m) => m.id === state.activeMemberId)?.scenarioDescription}</span>
          </div>
        </div>

        {/* Gym Badge */}
        <div className="bg-surface-subtle rounded-md p-2 border border-border flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-status-success animate-pulse" />
          <div className="text-[11px] leading-tight overflow-hidden">
            <div className="font-medium text-ink-primary truncate">{state.gym.name}</div>
            <div className="text-ink-muted text-[10px]">Active Member Service</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
