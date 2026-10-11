"use client";

import React, { useEffect } from "react";
import {
  Compass,
  CheckCircle2,
  Sparkles,
  Users,
  X,
  ArrowRight,
} from "lucide-react";

export interface WelcomeTourModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartTour: () => void;
  workspaceType: "member" | "coach";
}

export function WelcomeTourModal({
  isOpen,
  onClose,
  onStartTour,
  workspaceType,
}: WelcomeTourModalProps) {
  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isMember = workspaceType === "member";

  const content = isMember
    ? {
        title: "Welcome to NutriCoach!",
        subtitle: "Make every meal count.",
        description:
          "Discover how to track your daily nutrition, plan your meals, monitor your progress, and get personalized nutrition guidance.",
        items: [
          "Track today's calories and macros.",
          "Plan and adjust your meals.",
          "Stay on track with personalized guidance.",
        ],
        icon: Sparkles,
        badge: "Member Onboarding",
      }
    : {
        title: "Welcome to the NutriCoach Coach Workspace!",
        subtitle: "Support your members more efficiently.",
        description:
          "Explore how to monitor member progress, review nutrition exceptions, and oversee AI-assisted recommendations.",
        items: [
          "Monitor member adherence and progress.",
          "Review recommendations and exceptions.",
          "Keep human oversight of AI-assisted actions.",
        ],
        icon: Users,
        badge: "Coach Workspace",
      };

  const Icon = content.icon;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-primary/40 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="bg-surface rounded-2xl border border-border shadow-2xl max-w-md w-full p-6 text-ink-primary space-y-5 animate-in zoom-in-95 duration-200 select-none relative">
        {/* Top Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-ink-muted hover:text-ink-primary hover:bg-surface-subtle p-1.5 rounded-lg transition-colors"
          aria-label="Skip for now"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header with Icon Badge */}
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-brand-tint text-brand flex items-center justify-center shrink-0 border border-[#D5E6D2] shadow-hairline">
            <Icon className="w-5 h-5 text-brand" />
          </div>
          <div className="space-y-0.5 pr-6">
            <span className="text-[10px] font-semibold text-brand uppercase tracking-wider bg-brand-tint/60 px-2 py-0.5 rounded border border-[#D5E6D2]">
              {content.badge}
            </span>
            <h2 id="welcome-modal-title" className="text-base font-bold text-ink-primary tracking-tight pt-1">
              {content.title}
            </h2>
            <p className="text-xs font-medium text-brand">{content.subtitle}</p>
          </div>
        </div>

        {/* Description */}
        <p className="text-xs text-ink-secondary leading-relaxed">
          {content.description}
        </p>

        {/* 3 Compact Preview Items */}
        <div className="bg-surface-subtle/80 rounded-xl border border-border p-3.5 space-y-2.5">
          {content.items.map((item, idx) => (
            <div key={idx} className="flex items-center gap-2.5 text-xs text-ink-primary">
              <div className="w-4 h-4 rounded-full bg-brand-tint text-brand flex items-center justify-center shrink-0 border border-[#D5E6D2]">
                <CheckCircle2 className="w-3 h-3 text-brand" />
              </div>
              <span className="font-medium text-[11px] leading-snug">{item}</span>
            </div>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border/80">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 rounded-lg text-xs font-medium text-ink-secondary hover:text-ink-primary hover:bg-surface-subtle border border-border transition-colors"
          >
            Skip for now
          </button>

          <button
            type="button"
            onClick={onStartTour}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-brand text-white hover:bg-brand-hover shadow-hairline transition-colors"
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Take a 2-minute tour</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
