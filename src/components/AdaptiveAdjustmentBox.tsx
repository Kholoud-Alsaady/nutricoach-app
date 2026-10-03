"use client";

import React, { useState } from "react";
import { Check, Edit2, Sparkles, X, ChevronRight, CheckCircle2, RotateCcw } from "lucide-react";
import { useNutriCoach } from "./NutriCoachContext";

export function AdaptiveAdjustmentBox() {
  const { pendingProposals, approveProposal, rejectProposal } = useNutriCoach();
  const [selectedOptionIdx, setSelectedOptionIdx] = useState<number>(0);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const proposalAction = pendingProposals[0];

  if (!proposalAction || !proposalAction.proposed_change) {
    if (feedbackMessage) {
      return (
        <div className="bg-[#FAFBF9] border border-border rounded-lg p-3.5 flex items-center justify-between text-xs text-ink-primary shadow-hairline transition-all">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-brand-tint text-brand flex items-center justify-center">
              <Check className="w-3.5 h-3.5" />
            </div>
            <span className="font-medium">{feedbackMessage}</span>
            <span className="text-ink-muted">· Planned meals synchronized</span>
          </div>
          <span className="text-[11px] text-brand font-medium">10 min coach labor saved</span>
        </div>
      );
    }
    return null;
  }

  const proposal = proposalAction.proposed_change;
  const primaryChange = proposal.changes?.[0];
  const options = proposal.options || (primaryChange ? [primaryChange.after] : []);
  const activeMeal = options[selectedOptionIdx] || primaryChange?.after;

  const handleApprove = () => {
    approveProposal(proposalAction.id, selectedOptionIdx);
    const mealLabel = primaryChange?.meal_type
      ? `${primaryChange.meal_type.charAt(0).toUpperCase() + primaryChange.meal_type.slice(1)} updated`
      : "Dinner updated";
    setFeedbackMessage(`✓ ${mealLabel}`);
    setIsEditing(false);
    setTimeout(() => {
      setFeedbackMessage(null);
    }, 5000);
  };

  const handleReject = () => {
    rejectProposal(proposalAction.id, "Kept original plan");
    setFeedbackMessage("Kept original meal plan");
    setIsEditing(false);
    setTimeout(() => {
      setFeedbackMessage(null);
    }, 4000);
  };

  return (
    <div className="bg-[#FAFBF9] border border-border rounded-lg p-4 space-y-3 shadow-hairline">
      {/* Header with subtle badge */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-medium tracking-wide uppercase px-1.5 py-0.5 bg-brand-tint text-brand rounded border border-[#D5E6D2]">
              Adaptive Adjustment
            </span>
            <span className="text-[11px] text-ink-muted">Automated balance</span>
          </div>
          <h4 className="text-xs font-semibold text-ink-primary">{proposal.title}</h4>
        </div>

        <button
          onClick={handleReject}
          className="text-ink-muted hover:text-ink-primary p-1 rounded transition-colors"
          title="Dismiss adjustment"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Rationale description */}
      <p className="text-xs text-ink-secondary leading-relaxed">{proposal.explanation}</p>

      {/* Inline Proposed Target Card */}
      {activeMeal && (
        <div className="bg-surface rounded-md border border-border p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="font-medium text-xs text-ink-primary">{activeMeal.meal_name}</div>
            <div className="text-xs font-semibold text-brand">{activeMeal.calories} kcal</div>
          </div>

          <div className="flex items-center gap-3 text-[11px] text-ink-secondary">
            <span>
              Protein: <strong className="font-medium text-ink-primary">{activeMeal.protein}g</strong>
            </span>
            <span>·</span>
            <span>
              Carbs: <strong className="font-medium text-ink-primary">{activeMeal.carbs}g</strong>
            </span>
            <span>·</span>
            <span>
              Fat: <strong className="font-medium text-ink-primary">{activeMeal.fat}g</strong>
            </span>
          </div>

          {/* Alternative options selector if multiple are provided or editing */}
          {(options.length > 1 || isEditing) && (
            <div className="pt-2 border-t border-border flex flex-col gap-1.5">
              <span className="text-[10px] text-ink-muted font-medium">Select Alternative Option:</span>
              <div className="flex flex-wrap items-center gap-1.5">
                {options.map((opt, i) => (
                  <button
                    key={opt.meal_name + i}
                    onClick={() => setSelectedOptionIdx(i)}
                    className={`text-[11px] px-2.5 py-1 rounded transition-all flex items-center gap-1 ${
                      selectedOptionIdx === i
                        ? "bg-brand text-white font-medium shadow-hairline"
                        : "bg-surface-subtle text-ink-secondary hover:text-ink-primary border border-border"
                    }`}
                  >
                    <span>{opt.meal_name.split(" ")[0]}</span>
                    <span className="opacity-80 text-[10px]">({opt.calories} kcal)</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Instant Action Row with Keep Original, Edit, and Keep this change */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 border-t border-border/60">
        <div className="text-[11px] text-ink-muted">
          Rebalances remaining target to ~2,000 kcal
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleReject}
            className="text-xs text-ink-secondary hover:text-ink-primary px-2.5 py-1 rounded border border-border hover:bg-surface-subtle transition-colors"
          >
            Keep Original
          </button>

          <button
            onClick={() => setIsEditing(!isEditing)}
            className="text-xs text-ink-secondary hover:text-ink-primary px-2.5 py-1 rounded border border-border hover:bg-surface-subtle transition-colors flex items-center gap-1"
          >
            <Edit2 className="w-3 h-3" />
            <span>{isEditing ? "Done" : "Edit"}</span>
          </button>

          <button
            onClick={handleApprove}
            className="text-xs font-medium text-white bg-brand hover:bg-brand-hover px-3 py-1 rounded shadow-hairline transition-colors flex items-center gap-1.5"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Keep this change</span>
          </button>
        </div>
      </div>
    </div>
  );
}

