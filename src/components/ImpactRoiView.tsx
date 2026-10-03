"use client";

import React, { useState } from "react";
import { ArrowUpRight, Calculator, Check, DollarSign, HelpCircle, Info, Sparkles, TrendingUp, Users } from "lucide-react";
import { useNutriCoach } from "./NutriCoachContext";
import { egp } from "@/lib/impact";

export function ImpactRoiView() {
  const { state, modeledRoi, measuredImpact, updateGymAssumptions } = useNutriCoach();
  const [editing, setEditing] = useState(false);

  const gym = state.gym;

  return (
    <div className="space-y-6">
      {/* Modeled Notice Banner */}
      <div className="bg-[#FAFBF9] border border-border rounded-lg p-3 flex items-center justify-between text-xs text-ink-secondary shadow-hairline">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-brand shrink-0" />
          <span>
            Projections are clearly labeled <strong className="font-medium text-ink-primary">Modeled estimates</strong> based on editable gym parameters until 30-day cohort logs are measured.
          </span>
        </div>
        <button
          onClick={() => setEditing(!editing)}
          className="text-xs font-medium text-brand hover:underline shrink-0"
        >
          {editing ? "Close Editor" : "Edit Assumptions"}
        </button>
      </div>

      {/* Editable Assumptions Bar */}
      {editing && (
        <div className="bg-surface rounded-lg border border-border p-4 space-y-3 shadow-card">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <h4 className="text-xs font-medium text-ink-primary">Gym Business Assumptions</h4>
            <span className="text-[10px] text-ink-muted">Tweak parameters to view modeled ROI</span>
          </div>

          <div className="grid grid-cols-4 gap-4 text-xs">
            <div>
              <label className="text-[11px] text-ink-muted block mb-1">Modeled Members</label>
              <input
                type="number"
                value={gym.modeled_member_count}
                onChange={(e) => updateGymAssumptions({ modeled_member_count: Number(e.target.value) || 1 })}
                className="w-full text-xs bg-surface-subtle border border-border rounded px-2.5 py-1 text-ink-primary"
              />
            </div>

            <div>
              <label className="text-[11px] text-ink-muted block mb-1">NutriCoach Price (EGP/mo)</label>
              <input
                type="number"
                value={gym.subscription_price}
                onChange={(e) => updateGymAssumptions({ subscription_price: Number(e.target.value) || 0 })}
                className="w-full text-xs bg-surface-subtle border border-border rounded px-2.5 py-1 text-ink-primary"
              />
            </div>

            <div>
              <label className="text-[11px] text-ink-muted block mb-1">Traditional Price (EGP/mo)</label>
              <input
                type="number"
                value={gym.traditional_nutrition_price}
                onChange={(e) => updateGymAssumptions({ traditional_nutrition_price: Number(e.target.value) || 0 })}
                className="w-full text-xs bg-surface-subtle border border-border rounded px-2.5 py-1 text-ink-primary"
              />
            </div>

            <div>
              <label className="text-[11px] text-ink-muted block mb-1">Coach Hourly Value (EGP)</label>
              <input
                type="number"
                value={gym.estimated_coach_hourly_value}
                onChange={(e) => updateGymAssumptions({ estimated_coach_hourly_value: Number(e.target.value) || 0 })}
                className="w-full text-xs bg-surface-subtle border border-border rounded px-2.5 py-1 text-ink-primary"
              />
            </div>
          </div>
        </div>
      )}

      {/* Main KPI Row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-surface rounded-lg border border-border p-4 shadow-card space-y-1">
          <div className="text-[11px] text-ink-muted flex items-center justify-between">
            <span>Gross Monthly Revenue</span>
            <span className="text-[10px] bg-surface-subtle px-1.5 py-0.2 rounded font-normal">Modeled estimate</span>
          </div>
          <div className="text-xl font-semibold text-ink-primary">{egp(modeledRoi.revenue)} / mo</div>
          <div className="text-[11px] text-brand flex items-center gap-0.5 pt-1">
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>+{egp(modeledRoi.revenueUplift)} revenue uplift vs static plan</span>
          </div>
        </div>

        <div className="bg-surface rounded-lg border border-border p-4 shadow-card space-y-1">
          <div className="text-[11px] text-ink-muted flex items-center justify-between">
            <span>Coach Labor Returned</span>
            <span className="text-[10px] bg-surface-subtle px-1.5 py-0.2 rounded font-normal">Modeled estimate</span>
          </div>
          <div className="text-xl font-semibold text-brand">{modeledRoi.coachHoursSaved} hours / mo</div>
          <div className="text-[11px] text-ink-secondary pt-1">
            Value: <strong className="font-medium text-ink-primary">{egp(modeledRoi.laborValue)}</strong> in staff capacity
          </div>
        </div>

        <div className="bg-surface rounded-lg border border-border p-4 shadow-card space-y-1">
          <div className="text-[11px] text-ink-muted flex items-center justify-between">
            <span>Net Gym Contribution</span>
            <span className="text-[10px] bg-surface-subtle px-1.5 py-0.2 rounded font-normal">Modeled estimate</span>
          </div>
          <div className="text-xl font-semibold text-ink-primary">{egp(modeledRoi.contribution)} / mo</div>
          <div className="text-[11px] text-brand pt-1">
            Modeled ROI: <strong className="font-medium">{modeledRoi.roiPct}%</strong> on operating costs
          </div>
        </div>
      </div>

      {/* Pricing Model Comparison Table */}
      <div className="bg-surface rounded-lg border border-border shadow-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-xs font-medium text-ink-primary">Nutrition Subscription Economics: Traditional vs NutriCoach</h3>
          <p className="text-[11px] text-ink-muted">Comparing static nutrition plans against the continuous adaptive model</p>
        </div>

        <div className="p-4">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[11px] text-ink-muted border-b border-border pb-2">
                <th className="font-medium pb-2">Service Dimension</th>
                <th className="font-medium pb-2">Traditional Nutrition Plan</th>
                <th className="font-medium pb-2 text-brand">NutriCoach Adaptive Agent</th>
                <th className="font-medium pb-2 text-right">Business Impact</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <tr>
                <td className="py-2.5 font-medium text-ink-primary">Member Subscription</td>
                <td className="py-2.5 text-ink-secondary">{gym.traditional_nutrition_price} EGP / member / mo</td>
                <td className="py-2.5 font-medium text-brand">{gym.subscription_price} EGP / member / mo</td>
                <td className="py-2.5 text-right font-medium text-brand">+67% Price realization</td>
              </tr>

              <tr>
                <td className="py-2.5 font-medium text-ink-primary">50 Member Gross Revenue</td>
                <td className="py-2.5 text-ink-secondary">{egp(50 * gym.traditional_nutrition_price)} / mo</td>
                <td className="py-2.5 font-medium text-brand">{egp(50 * gym.subscription_price)} / mo</td>
                <td className="py-2.5 text-right font-medium text-brand">+{egp(10000)} / mo net lift</td>
              </tr>

              <tr>
                <td className="py-2.5 font-medium text-ink-primary">Coach Time Per Member</td>
                <td className="py-2.5 text-ink-secondary">120 min / mo (repetitive recalculation)</td>
                <td className="py-2.5 font-medium text-brand">30 min / mo (exception management)</td>
                <td className="py-2.5 text-right font-medium text-brand">75% Coach time saved</td>
              </tr>

              <tr>
                <td className="py-2.5 font-medium text-ink-primary">Monthly AI & Platform Cost</td>
                <td className="py-2.5 text-ink-secondary">0 EGP (100% manual labor)</td>
                <td className="py-2.5 text-ink-secondary">~2,000 EGP (500 EGP AI + 1,500 EGP Infra)</td>
                <td className="py-2.5 text-right text-ink-muted">Predictable software cost</td>
              </tr>

              <tr>
                <td className="py-2.5 font-medium text-ink-primary">Net Monthly Contribution</td>
                <td className="py-2.5 text-ink-secondary">{egp(15000)} (before coach labor drain)</td>
                <td className="py-2.5 font-semibold text-brand">{egp(modeledRoi.contribution)} / mo</td>
                <td className="py-2.5 text-right font-semibold text-brand">+{egp(8000)} / mo pure gain</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Actual Measured AI Usage Table */}
      <div className="bg-surface rounded-lg border border-border shadow-card p-4 space-y-3">
        <div className="flex items-center justify-between border-b border-border pb-2">
          <div>
            <h4 className="text-xs font-medium text-ink-primary">Tracked AI Agent Consumption</h4>
            <p className="text-[11px] text-ink-muted">Actual token counts and API spend recorded in Supabase</p>
          </div>
          <span className="text-[11px] text-ink-secondary">
            Model: <code className="font-mono text-ink-primary">gemini-3.5-flash-lite</code>
          </span>
        </div>

        <div className="grid grid-cols-4 gap-3 text-xs">
          <div className="bg-surface-subtle p-2.5 rounded border border-border">
            <div className="text-[11px] text-ink-muted">Recorded Requests</div>
            <div className="text-base font-semibold text-ink-primary mt-0.5">{measuredImpact.aiRequests} calls</div>
          </div>

          <div className="bg-surface-subtle p-2.5 rounded border border-border">
            <div className="text-[11px] text-ink-muted">Input / Output Tokens</div>
            <div className="text-base font-semibold text-ink-primary mt-0.5">
              {measuredImpact.inputTokens} / {measuredImpact.outputTokens}
            </div>
          </div>

          <div className="bg-surface-subtle p-2.5 rounded border border-border">
            <div className="text-[11px] text-ink-muted">Measured API Spend</div>
            <div className="text-base font-semibold text-ink-primary mt-0.5">
              ${measuredImpact.aiCostUsd.toFixed(4)} USD ({measuredImpact.aiCostEgp.toFixed(2)} EGP)
            </div>
          </div>

          <div className="bg-surface-subtle p-2.5 rounded border border-border">
            <div className="text-[11px] text-ink-muted">Est. AI Cost / Member / Mo</div>
            <div className="text-base font-semibold text-brand mt-0.5">~10.00 EGP</div>
          </div>
        </div>
      </div>
    </div>
  );
}
