"use client";

import React from "react";
import {
  ArrowLeft,
  CalendarDays,
  LineChart,
  MessageSquare,
  User,
  Utensils,
} from "lucide-react";
import { useNutriCoach } from "./NutriCoachContext";

export function MemberSidebar() {
  const { state, activeProfile, setActiveTab, setCurrentView } = useNutriCoach();

  const navItems = [
    { id: "today", label: "Today", icon: CalendarDays },
    { id: "plan", label: "Meal plan", icon: Utensils },
    { id: "progress", label: "Progress", icon: LineChart },
    { id: "ask", label: "Ask Coach", icon: MessageSquare },
    { id: "profile", label: "Profile", icon: User },
  ] as const;

  return (
    <aside className="w-[220px] shrink-0 border-r border-border bg-canvas flex flex-col justify-between h-screen sticky top-0 px-4 py-5 select-none">
      {/* Brand & Member Info */}
      <div>
        <div className="flex items-center gap-2.5 px-2 mb-6">
          <div className="w-7 h-7 rounded-md bg-brand flex items-center justify-center text-white font-medium text-sm">
            N
          </div>
          <div>
            <h1 className="font-medium text-ink-primary text-sm tracking-tight leading-none">NutriCoach</h1>
            <p className="text-[11px] text-ink-muted mt-0.5">Member App</p>
          </div>
        </div>

        {/* Member-Only Navigation */}
        <nav className="space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = state.activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as any)}
                className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  isActive
                    ? "bg-surface text-ink-primary shadow-hairline border border-border"
                    : "text-ink-secondary hover:text-ink-primary hover:bg-surface-subtle"
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? "text-brand" : "text-ink-muted"}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Member Profile Badge & Return to Portal / Change User */}
      <div className="border-t border-border pt-3 space-y-2">
        <div className="bg-surface rounded-md p-2.5 border border-border flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-brand-tint text-brand flex items-center justify-center text-xs font-semibold">
            {activeProfile?.name?.charAt(0) || "M"}
          </div>
          <div className="text-xs leading-tight overflow-hidden">
            <div className="font-medium text-ink-primary truncate">{activeProfile?.name || "Member"}</div>
            <div className="text-ink-muted text-[10px] truncate">{activeProfile?.goal || "Fitness Goal"}</div>
          </div>
        </div>

        <button
          onClick={() => setCurrentView("portal")}
          className="w-full flex items-center justify-center gap-1.5 text-xs text-ink-secondary hover:text-brand bg-surface-subtle hover:bg-surface p-2 rounded-md border border-border transition-colors font-medium"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Role Selector / Change User</span>
        </button>
      </div>
    </aside>
  );
}

