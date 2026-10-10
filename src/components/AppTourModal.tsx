"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Compass,
  HelpCircle,
  Sparkles,
  X,
} from "lucide-react";

export interface TourStep {
  title: string;
  category: string;
  targetTab?: string;
  description: string;
  keyPoints: string[];
  interfaceTip?: string;
}

export const MEMBER_TOUR_STEPS: TourStep[] = [
  {
    title: "Member Dashboard & Nutrition Overview",
    category: "Today Overview",
    targetTab: "today",
    description:
      "Your daily command center shows real-time progress toward your energy and macronutrient targets. Track calories, protein, carbohydrates, and fats calculated specifically for your body and fitness goals.",
    keyPoints: [
      "Live macro bars update as meals are logged throughout the day.",
      "Today's Curated Tip provides evidence-based daily nutrition insights.",
      "Adaptive adjustment proposals appear dynamically if deviations occur.",
    ],
    interfaceTip: "Located in the 'Today' tab at the top of your workspace.",
  },
  {
    title: "Personalized Daily Meal Plan",
    category: "Daily Meals",
    targetTab: "today",
    description:
      "Review your planned breakfast, lunch, snack, and dinner. Each recipe is balanced to fit your targets, incorporating Egyptian and international wholesome foods.",
    keyPoints: [
      "Displays planned calorie and protein distribution per meal slot.",
      "One-click 'Log as Planned' confirms exact meal adherence.",
      "Click 'Swap' on any meal card to explore coach-verified alternatives.",
    ],
    interfaceTip: "Scroll down the 'Today' view to browse individual meal cards.",
  },
  {
    title: "Dietary Preferences, Allergies & Intolerances",
    category: "Safety Guardrails",
    targetTab: "profile",
    description:
      "Manage your strict safety guardrails and taste preferences directly in your profile. Allergies and intolerances serve as hard constraints across all meal generation.",
    keyPoints: [
      "Allergies & intolerances (e.g. peanuts, lactose, gluten) are strictly excluded.",
      "Excluded foods (e.g. tuna, chicken, mushrooms) are skipped by the planner.",
      "Dietary pattern options include Standard, Vegetarian, Vegan, Pescatarian, and Keto.",
      "Add custom allergens or excluded ingredients and click 'Save Changes' to update.",
    ],
    interfaceTip: "Accessible under the 'Profile' tab in the left sidebar.",
  },
  {
    title: "Meal Logging & Completed Meals",
    category: "Tracking",
    targetTab: "today",
    description:
      "Accurately record what you ate. You can log planned meals with one click, or log off-plan foods to let the system understand your real daily intake.",
    keyPoints: [
      "Logs automatically update remaining calories and macros.",
      "Deviations are detected without guilt, shame, or judgment.",
      "Eaten meals are locked to protect historical adherence records.",
    ],
    interfaceTip: "Use the '+ Log Extra Meal' or 'Log as Planned' buttons on meal cards.",
  },
  {
    title: "Adaptive Meal Swaps & Auto-Balance",
    category: "Meal Adaptation",
    targetTab: "plan",
    description:
      "Need a change? NutriCoach adapts your upcoming meals to keep your weekly energy balanced without forcing rigid, repetitive meals.",
    keyPoints: [
      "Weekly Auto-Balance smoothly spreads minor calorie deviations over upcoming days.",
      "Meal swaps respect all saved allergies, dislikes, and dietary patterns.",
      "Pending proposals always require your clear confirmation before changing your plan.",
    ],
    interfaceTip: "Explore upcoming days and weekly variations in the 'Meal Plan' tab.",
  },
  {
    title: "Ask NutriCoach AI Assistant",
    category: "AI Nutritionist",
    targetTab: "today",
    description:
      "Ask general nutrition questions, explore scientific research, or request meal changes in conversational natural language.",
    keyPoints: [
      "Evidence-based responses cite authoritative sources like WHO, PubMed, and CDC.",
      "Greetings receive natural, personalized responses using your preferred name.",
      "Plan adjustments trigger an interactive confirmation card before applying.",
    ],
    interfaceTip: "Always available in the 'Ask NutriCoach' right sidebar panel.",
  },
  {
    title: "Adherence History & Progress Trends",
    category: "Analytics",
    targetTab: "progress",
    description:
      "Review historical tracking consistency, macro hit rates, and adherence trends over the past 7–10 days to understand long-term habit sustainability.",
    keyPoints: [
      "Inspect planned vs. logged calorie deviances day by day.",
      "Visual adherence badges highlight consistent tracking habits.",
      "Quantitative target deltas track weight and body composition goals.",
    ],
    interfaceTip: "Click 'Progress' in the left sidebar to view telemetry trends.",
  },
  {
    title: "Member Profile & Coach Verified Targets",
    category: "Settings",
    targetTab: "profile",
    description:
      "Your member profile contains your calibrated BMR targets, activity level, personal goals, and editable dietary preferences.",
    keyPoints: [
      "Prescribed daily calorie, protein, carbohydrate, and fat targets.",
      "Activity level and personal identity identity settings.",
      "Quick access to update safety guardrails whenever your dietary needs change.",
    ],
    interfaceTip: "Click 'Profile' in the navigation sidebar anytime.",
  },
];

export const COACH_TOUR_STEPS: TourStep[] = [
  {
    title: "Coach Dashboard & Business Overview",
    category: "Overview",
    targetTab: "overview",
    description:
      "Welcome to your gym coaching hub. Monitor your entire roster of active members, overall team consistency, and high-level engagement at a glance.",
    keyPoints: [
      "Track active member count, stable adherence, and triage exceptions.",
      "Aggregate weekly consistency graph highlights 7-day adherence trends.",
      "Quantifies automated AI adaptations and coach hours returned to your team.",
    ],
    interfaceTip: "Located on the 'Overview' tab in the coach navigation sidebar.",
  },
  {
    title: "Member Management & App Preview",
    category: "Members",
    targetTab: "overview",
    description:
      "Inspect individual athletes on your roster. You can preview any member's app interface in real time to understand their daily plan from their perspective.",
    keyPoints: [
      "Browse active members and their prescribed goals (fat loss, hypertrophy, maintenance).",
      "One-click 'Preview App' allows inspecting any athlete's live dashboard.",
      "Seamless role switching lets you test and verify changes instantly.",
    ],
    interfaceTip: "Click 'Preview Layla's App' or any member card to preview.",
  },
  {
    title: "Reviewing Member Logs & Adherence",
    category: "Tracking",
    targetTab: "overview",
    description:
      "Review real-time meal logging patterns across your gym. Catch adherence gaps early before they become persistent training setbacks.",
    keyPoints: [
      "Examine planned vs. logged macros across breakfast, lunch, snack, and dinner.",
      "Identify patterns such as protein deficits or weekend carbohydrate surges.",
      "Verifiable adherence data replaces guesswork with clear habit telemetry.",
    ],
    interfaceTip: "Review the 'Team Consistency & Weekly Adherence' panel.",
  },
  {
    title: "Identifying Members Needing Follow-up",
    category: "Triage",
    targetTab: "triage",
    description:
      "The 'Needs Attention' triage queue flags athletes who experienced deviations, missed multiple days of tracking, or have pending adaptations.",
    keyPoints: [
      "Prioritizes athletes based on behavioral exceptions and logging gaps.",
      "Contextual badges show issue types (e.g. Dinner Rebalance, Inactivity).",
      "Enables proactive outreach before members lose momentum.",
    ],
    interfaceTip: "Switch to 'Needs Attention' in the coach navigation sidebar.",
  },
  {
    title: "Reviewing Exceptions & Human Coach Review",
    category: "Action Review",
    targetTab: "audit",
    description:
      "Human-in-the-loop oversight: review proposed meal adaptations before they take effect. Approve or reject AI proposals with a single click.",
    keyPoints: [
      "AI prepares reasoned meal proposals with macro balancing rationale.",
      "Coaches retain final authority to approve or reject actions.",
      "Ensures professional clinical and athletic standards are strictly maintained.",
    ],
    interfaceTip: "Check pending actions in 'Agent Activity Log' or triage queue.",
  },
  {
    title: "Direct Coach Messaging & Rapid Templates",
    category: "Communication",
    targetTab: "questions",
    description:
      "Engage directly with your athletes. Reply to incoming member questions using pre-calibrated quick templates or custom personalized coaching notes.",
    keyPoints: [
      "View member question threads with full context on their latest logs.",
      "One-click fast coaching templates for common nutrition guidance.",
      "Direct communication builds coach trust and keeps athletes motivated.",
    ],
    interfaceTip: "Select 'Member Questions' in the coach navigation sidebar.",
  },
  {
    title: "Agent Operations & Gym Economics",
    category: "ROI & Impact",
    targetTab: "audit",
    description:
      "Inspect the operations audit log to see exactly how the AI agent supports your workflow, including calculated manual minutes saved per member.",
    keyPoints: [
      "Verifiable breakdown of manual minutes vs. agent minutes per operation.",
      "Calculated time savings allow coaches to focus on high-touch member care.",
      "Engagement indicators reflect real app activity without exaggerated health claims.",
    ],
    interfaceTip: "Open 'Agent Activity Log' in the coach navigation sidebar.",
  },
];

interface AppTourModalProps {
  isOpen: boolean;
  onClose: () => void;
  tourType: "member" | "coach";
  onTabChange?: (tab: string) => void;
  initialTab?: string;
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

  // Sync background tab when step changes
  useEffect(() => {
    if (isOpen && steps[currentStepIndex]?.targetTab && onTabChange) {
      onTabChange(steps[currentStepIndex].targetTab!);
    }
  }, [isOpen, currentStepIndex, steps, onTabChange]);

  const handleClose = useCallback(() => {
    // Restore initial tab if provided
    if (initialTab && onTabChange) {
      onTabChange(initialTab);
    }
    setCurrentStepIndex(0);
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

  if (!isOpen) return null;

  const currentStep = steps[currentStepIndex];
  const isFirst = currentStepIndex === 0;
  const isLast = currentStepIndex === steps.length - 1;
  const progressPercent = Math.round(((currentStepIndex + 1) / steps.length) * 100);

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
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${tourType === "member" ? "Member" : "Coach"} App Tour`}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-primary/50 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="bg-surface rounded-xl border border-border shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        {/* Header Banner */}
        <div className="bg-canvas border-b border-border px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-brand-tint text-brand flex items-center justify-center font-bold text-xs">
              <Compass className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-ink-primary">
                  {tourType === "member" ? "Member App Tour" : "Coach Workspace Tour"}
                </span>
                <span className="text-[10px] text-ink-muted bg-surface-subtle px-1.5 py-0.5 rounded border border-border">
                  Step {currentStepIndex + 1} of {steps.length}
                </span>
              </div>
              <p className="text-[10px] text-brand font-medium">{currentStep.category}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="text-ink-muted hover:text-ink-primary p-1.5 rounded-md hover:bg-surface-subtle transition-colors"
            aria-label="Close tour"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-surface-subtle h-1">
          <div
            className="bg-brand h-1 transition-all duration-300 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          <div>
            <h3 className="text-sm font-semibold text-ink-primary tracking-tight">
              {currentStep.title}
            </h3>
            <p className="text-xs text-ink-secondary leading-relaxed mt-1.5">
              {currentStep.description}
            </p>
          </div>

          {/* Key Highlights */}
          <div className="space-y-2 bg-surface-subtle p-3.5 rounded-lg border border-border">
            <span className="text-[10px] text-ink-muted uppercase tracking-wider block font-semibold">
              Key Capabilities:
            </span>
            <ul className="space-y-2 text-xs text-ink-primary">
              {currentStep.keyPoints.map((point, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-brand shrink-0 mt-0.5" />
                  <span className="leading-snug text-[11px]">{point}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Interface Tip */}
          {currentStep.interfaceTip && (
            <div className="flex items-center gap-2 text-[11px] text-ink-muted italic bg-brand-tint/40 px-3 py-2 rounded-md border border-[#D5E6D2]">
              <Sparkles className="w-3.5 h-3.5 text-brand shrink-0" />
              <span>{currentStep.interfaceTip}</span>
            </div>
          )}
        </div>

        {/* Footer Navigation Controls */}
        <div className="bg-canvas border-t border-border px-5 py-3.5 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleClose}
            className="text-xs font-medium text-ink-muted hover:text-ink-primary transition-colors px-2 py-1"
          >
            Skip Tour
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleBack}
              disabled={isFirst}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium text-ink-primary bg-surface border border-border hover:bg-surface-subtle transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-hairline"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>

            <button
              type="button"
              onClick={handleNext}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-semibold text-white bg-brand hover:bg-brand-hover transition-colors shadow-hairline"
            >
              <span>{isLast ? "Finish Tour" : "Next"}</span>
              {!isLast && <ArrowRight className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
