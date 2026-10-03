"use client";

import React, { useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Eye,
  Flame,
  LayoutDashboard,
  LineChart,
  MessageSquare,
  Send,
  Sparkles,
  Users,
  Utensils,
} from "lucide-react";
import { useNutriCoach } from "./NutriCoachContext";
import { timeAgo } from "@/lib/dates";

export function CoachLayout() {
  const { state, allMessages, setActiveMember, setCurrentView, approveProposal, rejectProposal, sendCoachReply } = useNutriCoach();
  const [coachTab, setCoachTab] = useState<"overview" | "triage" | "questions" | "audit">("overview");
  const [selectedMemberId, setSelectedMemberId] = useState<string>(state.members[0].id);
  const [coachInput, setCoachInput] = useState("");

  // Aggregate 7-day adherence data
  const weekData = [
    { day: "Mon", rate: 88, onTrack: true },
    { day: "Tue", rate: 84, onTrack: true },
    { day: "Wed", rate: 79, onTrack: false },
    { day: "Thu", rate: 86, onTrack: true },
    { day: "Fri", rate: 91, onTrack: true },
    { day: "Sat", rate: 76, onTrack: false },
    { day: "Sun", rate: 82, onTrack: true },
  ];

  // At-risk members triage list
  const triageMembers = [
    {
      member: state.members[2], // Layla
      issue: "Repeated Carbohydrate Deviations",
      detail: "Off-plan lunch (Koshary, 160g C). High-protein dinner rebalance proposed.",
      badge: "Dinner Rebalance",
      badgeColor: "bg-[#FEF8EC] text-status-warning border border-[#FDE6B8]",
    },
    {
      member: state.members[3], // Ahmed
      issue: "Protein Deficit Pattern",
      detail: "Calories on target (2,400 kcal) but protein below 80g for 4 consecutive days.",
      badge: "Weekly Adaptation",
      badgeColor: "bg-[#FEF8EC] text-status-warning border border-[#FDE6B8]",
    },
    {
      member: state.members[5], // Youssef
      issue: "Member Inactivity (5 Days)",
      detail: "No meals logged since Tuesday. Supportive coach check-in drafted.",
      badge: "Follow-up Ready",
      badgeColor: "bg-[#FDF2F0] text-status-danger border border-[#F9D7D2]",
    },
  ];

  const handleReviewMember = (memberId: string) => {
    setActiveMember(memberId);
    setCurrentView("member");
  };

  const handleSendCoachMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!coachInput.trim()) return;
    sendCoachReply(selectedMemberId, coachInput);
    setCoachInput("");
  };

  return (
    <div className="min-h-screen bg-canvas flex justify-center selection:bg-brand-tint selection:text-brand">
      <div className="w-full max-w-[1200px] flex min-h-screen border-x border-border/60 bg-canvas">
        {/* Coach Left Navigation */}
        <aside className="w-[220px] shrink-0 border-r border-border bg-canvas flex flex-col justify-between h-screen sticky top-0 px-4 py-5 select-none">
          <div>
            <div className="flex items-center gap-2.5 px-2 mb-6">
              <div className="w-7 h-7 rounded-md bg-brand flex items-center justify-center text-white font-medium text-sm">
                C
              </div>
              <div>
                <h1 className="font-medium text-ink-primary text-sm tracking-tight leading-none">NutriCoach</h1>
                <p className="text-[11px] text-ink-muted mt-0.5">Coach Workspace</p>
              </div>
            </div>

            <nav className="space-y-0.5">
              <button
                onClick={() => setCoachTab("overview")}
                className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  coachTab === "overview"
                    ? "bg-surface text-ink-primary shadow-hairline border border-border"
                    : "text-ink-secondary hover:text-ink-primary hover:bg-surface-subtle"
                }`}
              >
                <LayoutDashboard className={`w-4 h-4 ${coachTab === "overview" ? "text-brand" : "text-ink-muted"}`} />
                <span>Overview</span>
              </button>

              <button
                onClick={() => setCoachTab("triage")}
                className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  coachTab === "triage"
                    ? "bg-surface text-ink-primary shadow-hairline border border-border"
                    : "text-ink-secondary hover:text-ink-primary hover:bg-surface-subtle"
                }`}
              >
                <AlertCircle className={`w-4 h-4 ${coachTab === "triage" ? "text-brand" : "text-ink-muted"}`} />
                <span>Needs Attention</span>
                <span className="ml-auto text-[10px] px-1.5 py-0.2 bg-brand-tint text-brand rounded font-medium">3</span>
              </button>

              <button
                onClick={() => setCoachTab("questions")}
                className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  coachTab === "questions"
                    ? "bg-surface text-ink-primary shadow-hairline border border-border"
                    : "text-ink-secondary hover:text-ink-primary hover:bg-surface-subtle"
                }`}
              >
                <MessageSquare className={`w-4 h-4 ${coachTab === "questions" ? "text-brand" : "text-ink-muted"}`} />
                <span>Member Questions</span>
                <span className="ml-auto text-[10px] px-1.5 py-0.2 bg-brand-tint text-brand rounded font-medium">6</span>
              </button>

              <button
                onClick={() => setCoachTab("audit")}
                className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  coachTab === "audit"
                    ? "bg-surface text-ink-primary shadow-hairline border border-border"
                    : "text-ink-secondary hover:text-ink-primary hover:bg-surface-subtle"
                }`}
              >
                <Clock className={`w-4 h-4 ${coachTab === "audit" ? "text-brand" : "text-ink-muted"}`} />
                <span>Agent Activity Log</span>
              </button>
            </nav>
          </div>

          <div className="border-t border-border pt-3 space-y-2">
            <button
              onClick={() => setCurrentView("portal")}
              className="w-full flex items-center justify-center gap-1.5 text-xs text-ink-secondary hover:text-brand bg-surface-subtle hover:bg-surface p-2 rounded-md border border-border transition-colors font-medium"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>← Back to Portal</span>
            </button>
          </div>
        </aside>

        {/* Main Coach Workspace */}
        <main className="flex-1 min-w-0 px-8 py-6 overflow-y-auto space-y-6">
          {/* Warm Greeting Header */}
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div>
              <h2 className="text-base font-semibold text-ink-primary tracking-tight">Good morning, Coach</h2>
              <p className="text-xs text-ink-secondary mt-0.5">
                Here is what needs your attention today across your 48 active members.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleReviewMember(state.members[2].id)}
                className="text-xs font-medium text-brand hover:text-brand-hover bg-brand-tint px-3 py-1.5 rounded-md border border-[#D5E6D2] flex items-center gap-1"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Preview Layla&apos;s App</span>
              </button>
            </div>
          </div>

          {/* Quick Status Summary Row */}
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-surface rounded-lg border border-border p-3.5 shadow-hairline">
              <div className="text-[11px] text-ink-muted">Active Members</div>
              <div className="text-lg font-semibold text-ink-primary mt-0.5">48 athletes</div>
              <div className="text-[10px] text-brand mt-0.5 font-medium">100% agent monitored</div>
            </div>

            <div className="bg-surface rounded-lg border border-border p-3.5 shadow-hairline">
              <div className="text-[11px] text-ink-muted">On Track</div>
              <div className="text-lg font-semibold text-brand mt-0.5">38 members</div>
              <div className="text-[10px] text-ink-muted mt-0.5">Stable adherence</div>
            </div>

            <div className="bg-surface rounded-lg border border-border p-3.5 shadow-hairline">
              <div className="text-[11px] text-ink-muted">Needs Attention</div>
              <div className="text-lg font-semibold text-status-warning mt-0.5">6 members</div>
              <div className="text-[10px] text-status-warning mt-0.5">3 triage exceptions</div>
            </div>

            <div className="bg-surface rounded-lg border border-border p-3.5 shadow-hairline">
              <div className="text-[11px] text-ink-muted">AI Adaptations Completed</div>
              <div className="text-lg font-semibold text-ink-primary mt-0.5">17 this week</div>
              <div className="text-[10px] text-brand mt-0.5 font-medium">~75 coach hrs returned</div>
            </div>
          </div>

          {/* 1. OVERVIEW TAB */}
          {coachTab === "overview" && (
            <div className="space-y-6">
              {/* Team Consistency & Adherence Diagram */}
              <div className="bg-surface rounded-lg border border-border p-5 shadow-card space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-medium text-ink-primary">Team Consistency & Weekly Adherence</h3>
                    <p className="text-[11px] text-ink-muted">Gym aggregate macro and meal consistency over the past 7 days</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-semibold text-brand">83.7%</span>
                    <span className="text-[11px] text-ink-muted"> weekly avg</span>
                  </div>
                </div>

                {/* Minimal Bar Chart */}
                <div className="h-36 pt-4 flex items-end justify-between gap-3 border-b border-border pb-2 px-2">
                  {weekData.map((d) => (
                    <div key={d.day} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                      <span className="text-[10px] font-medium text-ink-secondary">{d.rate}%</span>
                      <div
                        className={`w-full max-w-[48px] rounded-t transition-all duration-300 ${
                          d.rate >= 80 ? "bg-brand" : "bg-status-warning"
                        }`}
                        style={{ height: `${(d.rate / 100) * 85}px` }}
                      />
                      <span className="text-[10px] text-ink-muted uppercase">{d.day}</span>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between text-[11px] text-ink-muted pt-1">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded bg-brand" /> On Target (≥80%)
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded bg-status-warning" /> Weekend Deviation Dip
                    </span>
                  </div>
                  <span>Automated Sunday rebalancing scheduled</span>
                </div>
              </div>

              {/* Summary Worklist Section */}
              <div className="bg-surface rounded-lg border border-border p-4 shadow-card space-y-3">
                <div className="flex items-center justify-between border-b border-border pb-2">
                  <h3 className="text-xs font-semibold text-ink-primary">Active Members Triage Preview</h3>
                  <button
                    onClick={() => setCoachTab("triage")}
                    className="text-xs font-medium text-brand hover:underline"
                  >
                    View All Triage Queue →
                  </button>
                </div>

                <div className="space-y-2">
                  {triageMembers.map((item) => (
                    <div
                      key={item.member.id}
                      className="p-3 rounded-lg border border-border bg-surface-subtle flex items-center justify-between gap-3"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs text-ink-primary">{item.member.name}</span>
                          <span className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${item.badgeColor}`}>
                            {item.badge}
                          </span>
                        </div>
                        <p className="text-xs text-ink-secondary">{item.detail}</p>
                      </div>

                      <button
                        onClick={() => handleReviewMember(item.member.id)}
                        className="text-xs font-medium text-brand bg-brand-tint hover:bg-[#D5E6D2] px-2.5 py-1 rounded border border-[#D5E6D2] transition-colors"
                      >
                        Inspect
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 2. NEEDS ATTENTION / TRIAGE TAB */}
          {coachTab === "triage" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-semibold text-ink-primary">Priority Triage Queue</h3>
                  <p className="text-[11px] text-ink-muted">Immediate behavioral deviations and automated rebalance proposals</p>
                </div>
                <span className="text-[11px] text-ink-muted">3 athletes flagged</span>
              </div>

              <div className="space-y-3">
                {triageMembers.map((item) => (
                  <div
                    key={item.member.id}
                    className="bg-surface rounded-lg border border-border p-4 shadow-hairline flex items-center justify-between gap-4 hover:border-brand/40 transition-all"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-ink-primary">{item.member.name}</span>
                        <span className={`text-[10px] px-2 py-0.2 rounded font-medium ${item.badgeColor}`}>
                          {item.badge}
                        </span>
                        <span className="text-[11px] text-ink-muted">· {item.issue}</span>
                      </div>
                      <p className="text-xs text-ink-secondary leading-relaxed">{item.detail}</p>
                    </div>

                    <button
                      onClick={() => handleReviewMember(item.member.id)}
                      className="shrink-0 text-xs font-medium text-ink-primary hover:text-brand bg-surface-subtle hover:bg-surface px-3 py-1.5 rounded-md border border-border transition-colors flex items-center gap-1"
                    >
                      <span>Review Member</span>
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3. MEMBER QUESTIONS TAB */}
          {coachTab === "questions" && (
            <div className="bg-surface rounded-lg border border-border shadow-card overflow-hidden">
              <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-semibold text-ink-primary">Member Questions & Coaching Channel</h3>
                  <p className="text-[11px] text-ink-muted">Direct bidirectional communication between Coach Captain Ahmed and athletes</p>
                </div>
                <span className="text-[10px] text-brand font-medium bg-brand-tint px-2.5 py-1 rounded border border-[#D5E6D2]">
                  Live Inbox
                </span>
              </div>

              <div className="grid grid-cols-12 min-h-[460px]">
                {/* Left: Member Directory */}
                <div className="col-span-4 border-r border-border divide-y divide-border bg-surface-subtle overflow-y-auto max-h-[500px]">
                  {state.members.map((m) => {
                    const msgs = allMessages[m.id] || [];
                    const lastMsg = msgs[msgs.length - 1];
                    const isSelected = selectedMemberId === m.id;

                    return (
                      <button
                        key={m.id}
                        onClick={() => setSelectedMemberId(m.id)}
                        className={`w-full p-3 text-left transition-all flex flex-col gap-1 ${
                          isSelected
                            ? "bg-surface border-l-2 border-l-brand"
                            : "hover:bg-surface/60"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-xs font-semibold ${isSelected ? "text-brand" : "text-ink-primary"}`}>
                            {m.name}
                          </span>
                          {lastMsg && (
                            <span className="text-[10px] text-ink-muted">
                              {timeAgo(lastMsg.created_at)}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-ink-secondary truncate">
                          {lastMsg ? lastMsg.text : "No messages yet"}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[9px] px-1.5 py-0.2 bg-surface text-ink-muted rounded border border-border">
                            {m.scenarioLabel}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Right: Active Member Conversation Stream */}
                {(() => {
                  const activeMember = state.members.find((m) => m.id === selectedMemberId) || state.members[0];
                  const currentMsgs = allMessages[activeMember.id] || [];

                  return (
                    <div className="col-span-8 flex flex-col justify-between bg-surface p-4">
                      {/* Member Info Bar */}
                      <div className="flex items-center justify-between pb-3 border-b border-border mb-3">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs font-semibold text-ink-primary">{activeMember.name}</h4>
                            <span className="text-[10px] px-1.5 py-0.2 bg-brand-tint text-brand rounded font-medium">
                              Target: {activeMember.targets.calories} kcal · {activeMember.targets.protein}g P
                            </span>
                          </div>
                          <p className="text-[11px] text-ink-muted">{activeMember.goal}</p>
                        </div>

                        <button
                          onClick={() => handleReviewMember(activeMember.id)}
                          className="text-xs font-medium text-ink-primary hover:text-brand bg-surface-subtle hover:bg-surface px-2.5 py-1 rounded border border-border transition-colors flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Preview App</span>
                        </button>
                      </div>

                      {/* Chat History */}
                      <div className="flex-1 overflow-y-auto space-y-2.5 pr-2 max-h-[300px]">
                        {currentMsgs.map((msg, i) => {
                          const isMember = msg.sender === "member";
                          const isCoach = msg.sender === "coach";

                          return (
                            <div
                              key={msg.id || i}
                              className={`p-3 rounded-lg border text-xs leading-relaxed space-y-1.5 ${
                                isCoach
                                  ? "bg-[#F4F8F3] text-ink-primary border-[#D5E6D2] ml-6 shadow-hairline"
                                  : isMember
                                  ? "bg-surface-subtle text-ink-primary border-border mr-6 shadow-hairline"
                                  : "bg-[#FAFBF9] text-ink-primary border-border shadow-hairline"
                              }`}
                            >
                              <div className="flex items-center justify-between text-[10px] text-ink-muted">
                                <span className={`font-semibold ${isCoach ? "text-brand" : "text-ink-primary"}`}>
                                  {isCoach ? "Coach Captain Ahmed (You)" : isMember ? activeMember.name : "NutriCoach Assistant"}
                                </span>
                                <span>{timeAgo(msg.created_at)}</span>
                              </div>
                              <p className="text-xs text-ink-secondary leading-relaxed">{msg.text}</p>
                            </div>
                          );
                        })}
                      </div>

                      {/* Coach Reply Input & Fast Templates */}
                      <div className="pt-3 border-t border-border space-y-2 mt-3">
                        <div className="flex flex-wrap gap-1">
                          <button
                            type="button"
                            onClick={() => setCoachInput("Keep up the great work! Let's prioritize 35g protein post-workout.")}
                            className="text-[10px] bg-surface-subtle hover:bg-surface text-ink-secondary px-2 py-0.5 rounded border border-border"
                          >
                            + &quot;Prioritize 35g protein post-workout&quot;
                          </button>
                          <button
                            type="button"
                            onClick={() => setCoachInput("Good catch! I've confirmed your dinner adaptation to keep calories balanced.")}
                            className="text-[10px] bg-surface-subtle hover:bg-surface text-ink-secondary px-2 py-0.5 rounded border border-border"
                          >
                            + &quot;Confirmed dinner adaptation&quot;
                          </button>
                        </div>

                        <form onSubmit={handleSendCoachMessage} className="flex items-center gap-2">
                          <input
                            type="text"
                            placeholder={`Reply to ${activeMember.name.split(" ")[0]} as Coach Ahmed...`}
                            value={coachInput}
                            onChange={(e) => setCoachInput(e.target.value)}
                            className="flex-1 text-xs bg-surface-subtle border border-border rounded-md px-3 py-2 text-ink-primary focus:outline-none focus:border-brand"
                          />
                          <button
                            type="submit"
                            disabled={!coachInput.trim()}
                            className="text-xs font-medium text-white bg-brand hover:bg-brand-hover px-3.5 py-2 rounded-md shadow-hairline transition-colors flex items-center gap-1 disabled:opacity-40"
                          >
                            <span>Send Reply</span>
                            <Send className="w-3.5 h-3.5" />
                          </button>
                        </form>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* 4. AGENT ACTIVITY LOG TAB */}
          {coachTab === "audit" && (
            <div className="bg-surface rounded-lg border border-border shadow-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-medium text-ink-primary">Agent Activity Audit Log</h3>
                  <p className="text-[11px] text-ink-muted">Recorded operations and verifiable coach time savings</p>
                </div>
                <span className="text-[11px] text-brand font-medium">
                  {state.actions.filter((a) => a.execution_status === "executed").length} executed actions
                </span>
              </div>

              <div className="divide-y divide-border">
                {state.actions.map((act) => {
                  const member = state.members.find((m) => m.id === act.member_id);
                  const isPending = act.execution_status === "pending_coach" || act.execution_status === "proposed";
                  return (
                    <div key={act.id} className="px-4 py-3 flex items-start justify-between text-xs">
                      <div className="space-y-1 max-w-[540px]">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-ink-primary">{member?.name || "Member"}</span>
                          <span className="text-ink-muted">·</span>
                          <span className="text-[11px] text-ink-muted">{timeAgo(act.created_at)}</span>
                          <span className="text-[10px] px-1.5 py-0.2 bg-surface-subtle text-ink-secondary rounded font-mono">
                            {act.action_type}
                          </span>
                        </div>

                        <p className="text-ink-secondary leading-relaxed">{act.summary}</p>

                        <div className="flex items-center gap-2 text-[10px] text-ink-muted">
                          <span>
                            Manual: <strong>{act.estimated_manual_minutes}m</strong>
                          </span>
                          <span>·</span>
                          <span>
                            Agent: <strong>{act.estimated_agent_minutes}m</strong>
                          </span>
                          <span>·</span>
                          <span className="text-brand font-medium">
                            Saved: +{act.estimated_minutes_saved} min
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {isPending ? (
                          <>
                            <button
                              onClick={() => rejectProposal(act.id)}
                              className="text-[11px] text-ink-secondary hover:text-ink-primary px-2 py-1 rounded border border-border"
                            >
                              Reject
                            </button>
                            <button
                              onClick={() => approveProposal(act.id)}
                              className="text-[11px] font-medium text-white bg-brand hover:bg-brand-hover px-2.5 py-1 rounded shadow-hairline"
                            >
                              Approve
                            </button>
                          </>
                        ) : (
                          <span className="text-[11px] text-brand font-medium flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Executed
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
