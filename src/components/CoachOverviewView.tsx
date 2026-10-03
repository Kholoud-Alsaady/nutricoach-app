"use client";

import React from "react";
import { AlertCircle, CheckCircle2, Clock, Eye, FileText, Send, UserCheck, Users, Zap } from "lucide-react";
import { useNutriCoach } from "./NutriCoachContext";
import { timeAgo } from "@/lib/dates";

export function CoachOverviewView() {
  const { state, setActiveMember, setActiveTab, approveProposal, rejectProposal, measuredImpact } = useNutriCoach();

  // Triage members
  const triageList = state.members.map((m) => {
    let status: "On track" | "Needs review" | "Plan adapted" | "No recent logs" = "On track";
    let statusColor = "bg-surface-subtle text-ink-secondary";
    let priority = 3;

    if (m.scenario === "inactive") {
      status = "No recent logs";
      statusColor = "bg-[#FDF2F0] text-status-danger border border-[#F9D7D2]";
      priority = 1;
    } else if (m.scenario === "repeated_deviation" || m.scenario === "protein_gap") {
      status = "Needs review";
      statusColor = "bg-[#FEF8EC] text-status-warning border border-[#FDE6B8]";
      priority = 1;
    } else if (m.scenario === "single_miss" || m.scenario === "preference_shift") {
      status = "Plan adapted";
      statusColor = "bg-brand-tint text-brand border border-[#D5E6D2]";
      priority = 2;
    } else {
      status = "On track";
      statusColor = "bg-surface-subtle text-ink-secondary";
      priority = 3;
    }

    return { ...m, status, statusColor, priority };
  }).sort((a, b) => a.priority - b.priority);

  return (
    <div className="space-y-6">
      {/* Top Stat Ribbon */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-surface rounded-lg border border-border p-3 shadow-hairline">
          <div className="text-[11px] text-ink-muted">Total Active Members</div>
          <div className="text-lg font-semibold text-ink-primary mt-0.5">{state.members.length} athletes</div>
          <div className="text-[10px] text-brand mt-1">100% agent monitored</div>
        </div>

        <div className="bg-surface rounded-lg border border-border p-3 shadow-hairline">
          <div className="text-[11px] text-ink-muted">Needs Attention</div>
          <div className="text-lg font-semibold text-status-warning mt-0.5">3 members</div>
          <div className="text-[10px] text-ink-muted mt-1">Deviations & inactivity triage</div>
        </div>

        <div className="bg-surface rounded-lg border border-border p-3 shadow-hairline">
          <div className="text-[11px] text-ink-muted">Coach Hours Returned</div>
          <div className="text-lg font-semibold text-brand mt-0.5">{measuredImpact.hoursSaved} hrs</div>
          <div className="text-[10px] text-ink-muted mt-1">~{measuredImpact.minutesSaved} manual mins saved</div>
        </div>

        <div className="bg-surface rounded-lg border border-border p-3 shadow-hairline">
          <div className="text-[11px] text-ink-muted">Estimated Labor Value</div>
          <div className="text-lg font-semibold text-ink-primary mt-0.5">{measuredImpact.laborValue} EGP</div>
          <div className="text-[10px] text-ink-muted mt-1">Based on 200 EGP/hr rate</div>
        </div>
      </div>

      {/* Member Triage Table */}
      <div className="bg-surface rounded-lg border border-border shadow-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="text-xs font-medium text-ink-primary">Member Triage & Adherence Status</h3>
            <p className="text-[11px] text-ink-muted">Continuous background agent surveillance</p>
          </div>
          <span className="text-[11px] text-ink-muted font-normal">Coach Karim El-Sayed</span>
        </div>

        <div className="divide-y divide-border">
          {triageList.map((m) => (
            <div
              key={m.id}
              className="px-4 py-3 flex items-center justify-between hover:bg-surface-hover transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-surface-subtle border border-border flex items-center justify-center font-medium text-xs text-ink-primary">
                  {m.name.split(" ").map((n) => n[0]).join("")}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-ink-primary">{m.name}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${m.statusColor}`}>
                      {m.status}
                    </span>
                  </div>
                  <div className="text-[11px] text-ink-muted mt-0.5">
                    {m.goal} · Target: {m.targets.calories} kcal ({m.targets.protein}g P)
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right text-[11px] text-ink-secondary max-w-[220px] truncate">
                  {m.scenarioDescription}
                </div>

                <button
                  onClick={() => {
                    setActiveMember(m.id);
                    setActiveTab("today");
                  }}
                  className="text-xs text-ink-secondary hover:text-brand px-2.5 py-1 rounded border border-border hover:bg-surface transition-colors flex items-center gap-1"
                >
                  <Eye className="w-3 h-3" />
                  <span>Inspect</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Human-Readable Agent Activity Audit Table */}
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
                <div className="space-y-1 max-w-[500px]">
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
                      Manual baseline: <strong>{act.estimated_manual_minutes} min</strong>
                    </span>
                    <span>·</span>
                    <span>
                      Agent assisted: <strong>{act.estimated_agent_minutes} min</strong>
                    </span>
                    <span>·</span>
                    <span className="text-brand font-medium">
                      Net saved: +{act.estimated_minutes_saved} min
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
    </div>
  );
}
