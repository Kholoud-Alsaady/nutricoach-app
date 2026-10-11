"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Compass,
  X,
} from "lucide-react";

export interface TourStep {
  title: string;
  category: string;
  section: string;
  sectionStep: number;
  sectionTotal: number;
  targetTab?: string;
  selector: string;
  description: string;
  keyPoints?: string[];
  interfaceTip?: string;
  preferredPlacement?: "bottom" | "top" | "right" | "left";
}

export const MEMBER_TOUR_STEPS: TourStep[] = [
  // SECTION 1: TODAY
  {
    title: "Today's Nutrition Targets",
    category: "Nutrition Targets",
    section: "Today",
    sectionStep: 1,
    sectionTotal: 3,
    targetTab: "today",
    selector: '[data-tour="member-today-targets"]',
    description:
      "Monitor consumed and remaining calories and macros throughout the day. Totals and balances update automatically as meals are logged and targets adapt.",
    preferredPlacement: "bottom",
  },
  {
    title: "Goal-Specific Educational Articles",
    category: "Education",
    section: "Today",
    sectionStep: 2,
    sectionTotal: 3,
    targetTab: "today",
    selector: '[data-tour="member-today-tip"]',
    description:
      "Explore short, approximately two-minute nutrition articles relevant to your fitness goal, covering protein timing, meal frequency, and healthy habit building.",
    preferredPlacement: "bottom",
  },
  {
    title: "Today's Meal Stream & Logging",
    category: "Meal Logging",
    section: "Today",
    sectionStep: 3,
    sectionTotal: 3,
    targetTab: "today",
    selector: '[data-tour="member-meal-stream"]',
    description:
      "Review today's planned meals and record what you eat. Use 'Ate planned' for scheduled meals, 'Log custom' for off-plan portions, or 'Replace' to choose alternatives.",
    preferredPlacement: "top",
  },

  // SECTION 2: PLAN
  {
    title: "Goal & Diet Plan Overview",
    category: "Plan Overview",
    section: "Plan",
    sectionStep: 1,
    sectionTotal: 3,
    targetTab: "plan",
    selector: '[data-tour="member-plan-goal"]',
    description:
      "Displays your prescribed nutrition goal, macro split ratio, and active dietary pattern providing context for your weekly schedule.",
    preferredPlacement: "bottom",
  },
  {
    title: "Weekly Auto-Balance",
    category: "Adaptive Rebalancing",
    section: "Plan",
    sectionStep: 2,
    sectionTotal: 3,
    targetTab: "plan",
    selector: '[data-tour="member-plan-autobalance"]',
    description:
      "Displays weekly rebalancing status when daily intake shifts. You choose whether to apply proposed adjustments to upcoming days or keep original targets.",
    preferredPlacement: "bottom",
  },
  {
    title: "Detailed 7-Day Meal Plan",
    category: "Weekly Plan",
    section: "Plan",
    sectionStep: 3,
    sectionTotal: 3,
    targetTab: "plan",
    selector: '[data-tour="member-plan-details"]',
    description:
      "Review planned meals day by day across the week. You can adapt full daily menus or tap Replace on any individual slot to view verified compliant alternatives.",
    preferredPlacement: "bottom",
  },

  // SECTION 3: PROGRESS
  {
    title: "Progress Metrics at a Glance",
    category: "Telemetry",
    section: "Progress",
    sectionStep: 1,
    sectionTotal: 4,
    targetTab: "progress",
    selector: '[data-tour="member-progress-metrics"]',
    description:
      "Tracks rolling 7-Day Adherence, Meal Consistency, Current Streak, and Average Daily Protein compared against your prescribed targets.",
    preferredPlacement: "bottom",
  },
  {
    title: "Behavioral Pattern Summary",
    category: "Summary",
    section: "Progress",
    sectionStep: 2,
    sectionTotal: 4,
    targetTab: "progress",
    selector: '[data-tour="member-progress-summary"]',
    description:
      "Summarizes your recent nutrition consistency and highlights tracking momentum based on recorded meals and caloric hit rates.",
    preferredPlacement: "bottom",
  },
  {
    title: "10-Day Adherence Log History",
    category: "History",
    section: "Progress",
    sectionStep: 3,
    sectionTotal: 4,
    targetTab: "progress",
    selector: '[data-tour="member-progress-history"]',
    description:
      "Review daily adherence history comparing consumed intake with planned targets to celebrate consistency and spot unlogged gaps.",
    preferredPlacement: "bottom",
  },
  {
    title: "Forward-Looking Goal Projections",
    category: "Projections",
    section: "Progress",
    sectionStep: 4,
    sectionTotal: 4,
    targetTab: "progress",
    selector: '[data-tour="member-progress-projections"]',
    description:
      "Explore estimated body composition trajectories across 2 weeks to 6 months based on application calculations and logged adherence.",
    preferredPlacement: "top",
  },

  // SECTION 4: SUPPORT
  {
    title: "Direct Human Coach Messaging",
    category: "Coach Support",
    section: "Support",
    sectionStep: 1,
    sectionTotal: 2,
    targetTab: "ask",
    selector: '[data-tour="member-coach-direct"]',
    description:
      "Reach your assigned human coach for personalized guidance, workout fueling strategies, and expert support whenever questions arise.",
    preferredPlacement: "bottom",
  },
  {
    title: "Ask NutriCoach AI Assistant",
    category: "AI Guidance",
    section: "Support",
    sectionStep: 2,
    sectionTotal: 2,
    targetTab: "today",
    selector: '[data-tour="member-ask-nutricoach"]',
    description:
      "Ask questions about remaining calories, request meal swaps, or explore evidence-based nutrition research from trusted sources like WHO and PubMed.",
    preferredPlacement: "left",
  },

  // SECTION 5: PROFILE
  {
    title: "Member Profile & Biometrics",
    category: "Profile",
    section: "Profile",
    sectionStep: 1,
    sectionTotal: 3,
    targetTab: "profile",
    selector: '[data-tour="member-profile-overview"]',
    description:
      "View your personal biometric details, primary goal badge, and calibrated health parameters configured for your account.",
    preferredPlacement: "bottom",
  },
  {
    title: "Dietary Preferences & Guardrails",
    category: "Guardrails",
    section: "Profile",
    sectionStep: 2,
    sectionTotal: 3,
    targetTab: "profile",
    selector: '[data-tour="member-dietary-guardrails"]',
    description:
      "Manage strict food allergies, intolerances, and disliked foods. Allergies serve as non-negotiable safety guardrails across all meal recommendations and swaps.",
    preferredPlacement: "top",
  },
  {
    title: "Prescribed Quantitative Targets",
    category: "Targets",
    section: "Profile",
    sectionStep: 3,
    sectionTotal: 3,
    targetTab: "profile",
    selector: '[data-tour="member-profile-targets"]',
    description:
      "Review coach-prescribed body composition targets and activity level settings that calibrate your daily calorie and macronutrient schedule.",
    preferredPlacement: "top",
  },
];

export const COACH_TOUR_STEPS: TourStep[] = [
  {
    title: "Coach Dashboard & Business Overview",
    category: "Overview",
    section: "Overview",
    sectionStep: 1,
    sectionTotal: 3,
    targetTab: "overview",
    selector: '[data-tour="coach-overview-metrics"]',
    description:
      "Monitor your gym roster at a glance. Track active athlete volume, stable adherence rates, and priority triage exceptions in real time.",
    preferredPlacement: "bottom",
  },
  {
    title: "Member Management & App Preview",
    category: "Members",
    section: "Overview",
    sectionStep: 2,
    sectionTotal: 3,
    targetTab: "overview",
    selector: '[data-tour="coach-member-roster"]',
    description:
      "Browse active members and their prescribed goals. Use 'Preview App' on any athlete card to inspect their live dashboard from their perspective.",
    preferredPlacement: "top",
  },
  {
    title: "Reviewing Member Logs & Adherence",
    category: "Tracking",
    section: "Overview",
    sectionStep: 3,
    sectionTotal: 3,
    targetTab: "overview",
    selector: '[data-tour="coach-adherence-panel"]',
    description:
      "Review real-time meal logging patterns across your gym to catch adherence gaps early before they become persistent training setbacks.",
    preferredPlacement: "bottom",
  },
  {
    title: "Priority Triage Queue: Needs Attention",
    category: "Triage",
    section: "Triage",
    sectionStep: 1,
    sectionTotal: 1,
    targetTab: "triage",
    selector: '[data-tour="coach-triage-panel"]',
    description:
      "Quickly identify athletes experiencing nutritional deviations, missed tracking days, or pending compensatory meal adjustments.",
    preferredPlacement: "bottom",
  },
  {
    title: "Reviewing Exceptions & Human Oversight",
    category: "Action Review",
    section: "Audit",
    sectionStep: 1,
    sectionTotal: 2,
    targetTab: "audit",
    selector: '[data-tour="coach-audit-panel"]',
    description:
      "Maintain clinical oversight: review proposed AI meal adaptations before they take effect. Approve or reject actions with a single click.",
    preferredPlacement: "bottom",
  },
  {
    title: "Direct Coach Messaging & Templates",
    category: "Communication",
    section: "Communication",
    sectionStep: 1,
    sectionTotal: 1,
    targetTab: "questions",
    selector: '[data-tour="coach-questions-panel"]',
    description:
      "Engage directly with your athletes. View message threads with logging context and send personalized notes or rapid coaching templates.",
    preferredPlacement: "top",
  },
  {
    title: "Activity Log & Operational Metrics",
    category: "Audit & ROI",
    section: "Audit",
    sectionStep: 2,
    sectionTotal: 2,
    targetTab: "audit",
    selector: '[data-tour="coach-economics-card"]',
    description:
      "Review verifiable operational time savings, showing manual coach minutes saved per member without exaggerated health claims.",
    preferredPlacement: "top",
  },
];

export interface AppTourModalProps {
  isOpen: boolean;
  onClose: () => void;
  tourType: "member" | "coach";
  onTabChange?: (tab: string) => void;
  initialTab?: string;
}

interface TargetPosition {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface TooltipCoords {
  top: number;
  left: number;
  placement: "bottom" | "top" | "left" | "right";
}

export function AppTourModal({
  isOpen,
  onClose,
  tourType,
  onTabChange,
  initialTab,
}: AppTourModalProps) {
  const steps = tourType === "member" ? MEMBER_TOUR_STEPS : COACH_TOUR_STEPS;
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<TargetPosition | null>(null);
  const [tooltipCoords, setTooltipCoords] = useState<TooltipCoords | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const currentStep = steps[currentStepIndex];
  const isFirst = currentStepIndex === 0;
  const isLast = currentStepIndex === steps.length - 1;
  const progressPercent = Math.round(((currentStepIndex + 1) / steps.length) * 100);

  const handleClose = useCallback(() => {
    // Restore initial tab if provided
    if (initialTab && onTabChange) {
      onTabChange(initialTab);
    }
    setCurrentStepIndex(0);
    setTargetRect(null);
    setTooltipCoords(null);
    onClose();
  }, [initialTab, onTabChange, onClose]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleClose]);

  // Navigate background tab when step changes
  useEffect(() => {
    if (!isOpen) return;
    if (currentStep?.targetTab && onTabChange) {
      onTabChange(currentStep.targetTab);
    }
  }, [isOpen, currentStepIndex, currentStep, onTabChange]);

  // Update target element location and tooltip coordinates
  const updatePosition = useCallback(() => {
    if (!isOpen || !currentStep) return;

    const el = document.querySelector(currentStep.selector);
    if (!el) {
      // Element not yet mounted (e.g. during tab transition); retry in a moment
      return false;
    }

    const rect = el.getBoundingClientRect();
    const pos: TargetPosition = {
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
    };
    setTargetRect(pos);

    // Compute tooltip placement
    const tooltipWidth = 320;
    const tooltipHeight = 180;
    const padding = 12;
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;

    let placement: "bottom" | "top" | "left" | "right" = currentStep.preferredPlacement || "bottom";

    // Adaptive fallback if preferred placement overflows screen
    if (placement === "right" && rect.right + tooltipWidth + padding > viewportW) {
      placement = rect.left - tooltipWidth - padding >= padding ? "left" : "bottom";
    } else if (placement === "left" && rect.left - tooltipWidth - padding < padding) {
      placement = rect.right + tooltipWidth + padding <= viewportW - padding ? "right" : "bottom";
    }

    if (placement === "bottom" && rect.bottom + tooltipHeight + padding > viewportH) {
      placement = rect.top - tooltipHeight - padding >= padding ? "top" : "bottom";
    } else if (placement === "top" && rect.top - tooltipHeight - padding < padding) {
      placement = "bottom";
    }

    let top = 0;
    let left = 0;

    if (placement === "bottom") {
      top = rect.bottom + padding;
      left = rect.left + rect.width / 2 - tooltipWidth / 2;
    } else if (placement === "top") {
      top = rect.top - tooltipHeight - padding;
      left = rect.left + rect.width / 2 - tooltipWidth / 2;
    } else if (placement === "right") {
      top = rect.top + rect.height / 2 - tooltipHeight / 2;
      left = rect.right + padding;
    } else if (placement === "left") {
      top = rect.top + rect.height / 2 - tooltipHeight / 2;
      left = rect.left - tooltipWidth - padding;
    }

    // Viewport clamping
    left = Math.max(padding, Math.min(viewportW - tooltipWidth - padding, left));
    top = Math.max(padding, Math.min(viewportH - tooltipHeight - padding, top));

    setTooltipCoords({ top, left, placement });
    return true;
  }, [isOpen, currentStep]);

  // Target element mounting & scroll-into-view
  useEffect(() => {
    if (!isOpen || !currentStep) return;

    let attempts = 0;
    const maxAttempts = 15;

    const checkAndScroll = () => {
      const found = updatePosition();
      if (found) {
        const el = document.querySelector(currentStep.selector);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
          // Recalculate once scrolling finishes
          setTimeout(updatePosition, 180);
        }
      } else if (attempts < maxAttempts) {
        attempts++;
        setTimeout(checkAndScroll, 60);
      }
    };

    checkAndScroll();

    const handleResize = () => updatePosition();
    const handleScroll = () => updatePosition();

    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleScroll, { capture: true, passive: true });

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [isOpen, currentStepIndex, currentStep, updatePosition]);

  if (!isOpen) return null;

  const handleNext = () => {
    if (isLast) {
      handleClose();
    } else {
      setCurrentStepIndex((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    if (!isFirst) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  };

  return (
    <>
      {/* 1. Subtle, Non-blocking Target Highlight Ring (No background dim or blur, pointer-events-none) */}
      {targetRect && (
        <div
          aria-hidden="true"
          style={{
            position: "fixed",
            top: Math.max(0, targetRect.top - 4),
            left: Math.max(0, targetRect.left - 4),
            width: targetRect.width + 8,
            height: targetRect.height + 8,
            pointerEvents: "none",
            zIndex: 40,
          }}
          className="rounded-lg ring-2 ring-brand ring-offset-2 ring-offset-canvas shadow-[0_0_16px_rgba(22,163,74,0.35)] transition-all duration-300 ease-out"
        >
          {/* Compact step badge marker attached to highlighted element */}
          <div className="absolute -top-3 -right-2 bg-brand text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-sm flex items-center gap-0.5">
            <span>{currentStepIndex + 1}</span>
          </div>
        </div>
      )}

      {/* 2. Non-blocking Contextual Tooltip Popover positioned directly next to feature */}
      <div
        ref={tooltipRef}
        role="region"
        aria-live="polite"
        aria-label={`${tourType === "member" ? "Member" : "Coach"} Walkthrough Step ${currentStepIndex + 1}`}
        style={{
          position: "fixed",
          top: tooltipCoords?.top ?? 80,
          left: tooltipCoords?.left ?? 20,
          zIndex: 50,
          width: 320,
          maxWidth: "calc(100vw - 24px)",
        }}
        className="bg-surface rounded-xl border border-border shadow-2xl p-4 text-ink-primary transition-all duration-200 animate-in fade-in zoom-in-95 select-none"
      >
        {/* Header: Section Group Badge, Step Indicator & Close */}
        <div className="flex items-center justify-between pb-2 border-b border-border/80">
          <div className="flex items-center gap-1.5">
            <span className="w-5 h-5 rounded-md bg-brand-tint text-brand flex items-center justify-center font-bold text-[10px]">
              <Compass className="w-3.5 h-3.5" />
            </span>
            <span className="text-[10px] font-semibold text-brand uppercase tracking-wider">
              {currentStep.section} · {currentStep.sectionStep} of {currentStep.sectionTotal}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-ink-muted">
              {currentStepIndex + 1} of {steps.length}
            </span>
            <button
              type="button"
              onClick={handleClose}
              className="text-ink-muted hover:text-ink-primary hover:bg-surface-subtle p-1 rounded-md transition-colors"
              aria-label="Close tour"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Progress Bar Indicator */}
        <div className="w-full bg-surface-subtle h-1 rounded-full overflow-hidden my-2">
          <div
            className="bg-brand h-full transition-all duration-300 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Step Title & Concise Description */}
        <div className="space-y-1.5 my-2">
          <h4 className="text-xs font-semibold text-ink-primary leading-snug">
            {currentStep.title}
          </h4>
          <p className="text-[11px] text-ink-secondary leading-relaxed">
            {currentStep.description}
          </p>
        </div>

        {/* Controls: Skip, Back, Next / Finish */}
        <div className="flex items-center justify-between pt-2.5 mt-2 border-t border-border/80">
          <button
            type="button"
            onClick={handleClose}
            className="text-[11px] text-ink-muted hover:text-ink-primary transition-colors font-medium px-1 py-1"
          >
            Skip tour
          </button>

          <div className="flex items-center gap-1.5">
            {!isFirst && (
              <button
                type="button"
                onClick={handleBack}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-medium text-ink-secondary hover:text-ink-primary hover:bg-surface-subtle border border-border transition-colors"
              >
                <ArrowLeft className="w-3 h-3" />
                <span>Back</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleNext}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-[11px] font-semibold bg-brand text-white hover:bg-brand-hover shadow-hairline transition-colors"
            >
              <span>{isLast ? "Finish" : "Next"}</span>
              {isLast ? <CheckCircle2 className="w-3 h-3" /> : <ArrowRight className="w-3 h-3" />}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
