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
  targetTab?: string;
  selector: string;
  description: string;
  keyPoints?: string[];
  interfaceTip?: string;
  preferredPlacement?: "bottom" | "top" | "right" | "left";
}

export const MEMBER_TOUR_STEPS: TourStep[] = [
  {
    title: "Today's Nutrition Overview",
    category: "Today Overview",
    targetTab: "today",
    selector: '[data-tour="member-today-overview"]',
    description:
      "Your daily command center shows live progress toward your energy and macronutrient targets. Calorie and macro bars update in real time as you log meals.",
    keyPoints: [
      "Live macro bars update as meals are logged.",
      "Adaptive adjustment proposals appear dynamically if deviations occur.",
    ],
    preferredPlacement: "bottom",
  },
  {
    title: "Personalized Daily Meal Plan",
    category: "Daily Meals",
    targetTab: "plan",
    selector: '[data-tour="member-plan-section"]',
    description:
      "Review your planned breakfast, lunch, snack, and dinner. Each recipe is balanced to fit your targets, incorporating Egyptian and international wholesome foods.",
    keyPoints: [
      "Planned calorie and protein distribution per meal slot.",
      "Browse 7-day variation and upcoming days.",
    ],
    preferredPlacement: "bottom",
  },
  {
    title: "Smart Meal Swaps & Alternatives",
    category: "Meal Adaptation",
    targetTab: "plan",
    selector: '[data-tour="member-meal-swap"]',
    description:
      "Need a change? Tap Replace on any meal slot to view coach-verified alternatives that strictly honor your saved allergies and dietary preferences.",
    keyPoints: [
      "Instant alternative recipes matching your slot budget.",
      "Strictly respects all saved allergies and disliked foods.",
    ],
    preferredPlacement: "left",
  },
  {
    title: "Meal Logging Controls",
    category: "Tracking",
    targetTab: "today",
    selector: '[data-tour="member-meal-log"]',
    description:
      "Record completed meals with one click using 'Ate planned', or enter custom portions to keep your daily intake accurate without guilt or judgment.",
    keyPoints: [
      "One-click logging for planned meals.",
      "Support for custom off-plan portions.",
    ],
    preferredPlacement: "top",
  },
  {
    title: "Dietary Preferences & Guardrails",
    category: "Safety Guardrails",
    targetTab: "profile",
    selector: '[data-tour="member-dietary-guardrails"]',
    description:
      "Manage food allergies, intolerances, and disliked ingredients directly. Allergies act as strict safety guardrails, while disliked foods guide meal variety.",
    keyPoints: [
      "Allergies & intolerances are strictly excluded across all meals.",
      "Excluded foods and dietary patterns guide planner variety.",
    ],
    preferredPlacement: "top",
  },
  {
    title: "Calibrated Member Profile",
    category: "Settings & Targets",
    targetTab: "profile",
    selector: '[data-tour="member-profile-overview"]',
    description:
      "Review your personal target calories, BMR metrics, weight goals, and activity level prescribed by your coaching staff.",
    keyPoints: [
      "Calibrated BMR and target macros.",
      "Quantitative goals and body composition deltas.",
    ],
    preferredPlacement: "bottom",
  },
  {
    title: "Adherence History & Progress Trends",
    category: "Analytics",
    targetTab: "progress",
    selector: '[data-tour="member-progress-content"]',
    description:
      "Review historical tracking consistency, macro hit rates, and adherence trends over the past 7–14 days to understand long-term habit sustainability.",
    keyPoints: [
      "Visual adherence badges highlight consistent tracking.",
      "Planned vs. logged telemetry day by day.",
    ],
    preferredPlacement: "bottom",
  },
  {
    title: "Ask NutriCoach AI Assistant",
    category: "AI Guidance",
    targetTab: "today",
    selector: '[data-tour="member-ask-nutricoach"]',
    description:
      "Ask nutrition questions, explore research from trusted authorities (WHO, PubMed), or request conversational meal adjustments in natural language.",
    keyPoints: [
      "Evidence-based responses cite authoritative scientific sources.",
      "Natural greetings and meal adjustments with confirmation cards.",
    ],
    preferredPlacement: "left",
  },
];

export const COACH_TOUR_STEPS: TourStep[] = [
  {
    title: "Coach Dashboard & Business Overview",
    category: "Overview",
    targetTab: "overview",
    selector: '[data-tour="coach-overview-metrics"]',
    description:
      "Monitor your entire roster of active members, overall team consistency, and high-level engagement at a glance.",
    keyPoints: [
      "Track active member count, stable adherence, and triage exceptions.",
      "Quantifies automated AI adaptations and coach hours returned.",
    ],
    preferredPlacement: "bottom",
  },
  {
    title: "Member Management & App Preview",
    category: "Members",
    targetTab: "overview",
    selector: '[data-tour="coach-member-roster"]',
    description:
      "Inspect individual athletes on your roster and use 'Preview App' to inspect any athlete's live dashboard from their perspective.",
    keyPoints: [
      "Browse active members and their prescribed goals.",
      "One-click app preview for instant verification.",
    ],
    preferredPlacement: "top",
  },
  {
    title: "Reviewing Member Logs & Adherence",
    category: "Tracking",
    targetTab: "overview",
    selector: '[data-tour="coach-adherence-panel"]',
    description:
      "Review real-time meal logging patterns across your gym to catch adherence gaps early before they become persistent setbacks.",
    keyPoints: [
      "Examine aggregate 7-day team consistency trends.",
      "Identify patterns such as weekend deviation dips.",
    ],
    preferredPlacement: "bottom",
  },
  {
    title: "Priority Triage Queue: Needs Attention",
    category: "Triage",
    targetTab: "triage",
    selector: '[data-tour="coach-triage-panel"]',
    description:
      "Quickly identify athletes experiencing nutritional deviations, missed tracking days, or pending compensatory meal adjustments.",
    keyPoints: [
      "Prioritizes athletes based on behavioral exceptions.",
      "Contextual badges show issue types for rapid outreach.",
    ],
    preferredPlacement: "bottom",
  },
  {
    title: "Reviewing Exceptions & Human Oversight",
    category: "Action Review",
    targetTab: "audit",
    selector: '[data-tour="coach-audit-panel"]',
    description:
      "Maintain clinical oversight: review proposed AI meal adaptations before they take effect. Approve or reject actions with a single click.",
    keyPoints: [
      "Human-in-the-loop validation for automated adjustments.",
      "Coaches retain final authority over all meal adjustments.",
    ],
    preferredPlacement: "bottom",
  },
  {
    title: "Direct Coach Messaging & Templates",
    category: "Communication",
    targetTab: "questions",
    selector: '[data-tour="coach-questions-panel"]',
    description:
      "Engage directly with your athletes. View message threads with logging context and send personalized notes or rapid coaching templates.",
    keyPoints: [
      "Bidirectional messaging with member logging context.",
      "Rapid one-click templates for common nutrition guidance.",
    ],
    preferredPlacement: "top",
  },
  {
    title: "Agent Operations & Gym Economics",
    category: "ROI & Impact",
    targetTab: "audit",
    selector: '[data-tour="coach-economics-card"]',
    description:
      "Review verifiable operational time savings, showing manual coach minutes saved per member without exaggerated health claims.",
    keyPoints: [
      "Verifiable breakdown of manual minutes vs. agent minutes.",
      "Calculated time savings allow focus on high-touch member care.",
    ],
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
        {/* Header: Badge, Step Indicator & Close */}
        <div className="flex items-center justify-between pb-2 border-b border-border/80">
          <div className="flex items-center gap-1.5">
            <span className="w-5 h-5 rounded-md bg-brand-tint text-brand flex items-center justify-center font-bold text-[10px]">
              <Compass className="w-3.5 h-3.5" />
            </span>
            <span className="text-[10px] font-semibold text-brand uppercase tracking-wider">
              {currentStep.category}
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
