"use client";

import React, { useState } from "react";
import { BookOpen, Sparkles, X, ChevronRight, Check } from "lucide-react";
import { useNutriCoach } from "./NutriCoachContext";

export function TodayTipCard() {
  const { activeProfile } = useNutriCoach();
  const [openModal, setOpenModal] = useState(false);

  const getTipContent = () => {
    const scenario = activeProfile?.demo_scenario;
    const name = activeProfile?.name?.toLowerCase() || "";

    const isDemoMember = [
      "00000000-0000-0000-0000-000000000011",
      "00000000-0000-0000-0000-000000000012",
      "00000000-0000-0000-0000-000000000013",
      "00000000-0000-0000-0000-000000000014",
      "00000000-0000-0000-0000-000000000015",
      "00000000-0000-0000-0000-000000000016",
    ].includes(activeProfile?.id);

    const isOnboarding =
      scenario === "onboarding" ||
      (!isDemoMember &&
        !name.includes("omar") &&
        !name.includes("sara") &&
        !name.includes("layla") &&
        !name.includes("ahmed") &&
        !name.includes("mariam") &&
        !name.includes("youssef"));

    if (isOnboarding) {
      return {
        badge: "Getting Started · Day 1",
        title: `Welcome to NutriCoach, ${activeProfile?.name || "Member"}`,
        summary:
          "Your adaptive nutrition journey starts today. Log your meals as you eat to establish your baseline and let AI personalize your daily targets.",
        readTime: "2 min read",
        articleTitle: "Getting Started: Building Your Personalized Nutrition Baseline",
        articleSections: [
          {
            heading: "How Adaptive Nutrition Works",
            text: `NutriCoach doesn't lock you into rigid diets. As you log your actual meals throughout the day, the AI automatically rebalances subsequent meals so you stay on track for your ${activeProfile?.goal || "goals"} without guilt.`,
          },
          {
            heading: "Your Biometric Profile & Goals",
            text: `Your daily targets are calibrated to your age, sex, weight, and activity level. Active dietary restrictions and allergen exclusions are strictly enforced across all recommended meal options.`,
          },
          {
            heading: "Day 1 Action Steps",
            text: "1. Review your planned meals for today under Meal Plan.\n2. Tap 'Log Eaten' as you finish each meal.\n3. Ask the AI assistant anytime if you need a quick swap or dining-out recommendation.",
          },
        ],
      };
    }

    if (scenario === "stable" || name.includes("omar")) {
      return {
        badge: "Hypertrophy & Protein Timing",
        title: "Optimizing Leucine Thresholds Between Meals",
        summary:
          "To maximize muscle protein synthesis, aim for 2.5–3.0g of leucine (~35g complete protein) every 3.5 to 4 hours rather than single large boluses.",
        readTime: "2 min read",
        articleTitle: "Optimizing Muscle Protein Synthesis Between Meals",
        articleSections: [
          {
            heading: "The Leucine Trigger Mechanism",
            text: "Muscle Protein Synthesis (MPS) operates on a refractory cycle. Consuming 30–40g of high-quality protein containing at least 2.7g leucine triggers the mTOR pathway. Once triggered, MPS peaks at 90 minutes and returns to baseline within 3 hours.",
          },
          {
            heading: "Optimal Distribution for Omar's 160g Target",
            text: "Instead of clustering 90g of protein into dinner, distributing your intake across 4 structured meals (36g breakfast, 58g lunch, 24g snack, 44g dinner) keeps amino acid availability elevated across your entire recovery window.",
          },
          {
            heading: "Post-Workout Nutrition Window",
            text: "Pairing your post-workout meal with 50–70g of complex carbohydrates helps replenish muscle glycogen stores and blunts cortisol without requiring unnatural calorie spikes.",
          },
        ],
      };
    }

    if (scenario === "repeated_deviation" || name.includes("layla")) {
      return {
        badge: "Glycemic Stability & Fat Loss",
        title: "Balancing Blood Sugar Without Cutting Staples",
        summary:
          "Pair high-carbohydrate meals like Koshary or rice dishes with dietary fiber and lean protein to blunt insulin spikes and sustain energy all afternoon.",
        readTime: "2 min read",
        articleTitle: "Balancing Blood Sugar Without Cutting Egyptian Staples",
        articleSections: [
          {
            heading: "Why Food Pairing Matters More Than Elimination",
            text: "When eating carbohydrate-rich meals like Koshary, adding a side of lemon-tahini greens or extra lentils slows gastric emptying. This transforms a sharp glucose spike into a gradual, sustained energy curve.",
          },
          {
            heading: "Managing Weekend Social Outings",
            text: "If you know dinner will feature pizza or dessert, keep your breakfast and lunch centered around lean proteins (egg whites, cottage cheese, grilled turkey) so you comfortably bank calories without feeling restricted.",
          },
          {
            heading: "Dinner Adaptation Strategy",
            text: "When lunch exceeds target carbohydrates, our AI automatically lowers dinner carbs while preserving protein, keeping your weekly fat loss trajectory fully intact.",
          },
        ],
      };
    }

    if (scenario === "preference_shift" || name.includes("mariam")) {
      return {
        badge: "Plant & Marine Nutrition",
        title: "Maximizing Plant Iron Absorption & Marine Omega-3s",
        summary:
          "Pairing non-heme iron from lentils and spinach with fresh lemon or citrus increases iron bioavailability by up to 300% on pescatarian diets.",
        readTime: "2 min read",
        articleTitle: "Maximizing Plant Iron & Marine Omega-3s on a Pescatarian Diet",
        articleSections: [
          {
            heading: "Enhancing Non-Heme Iron Absorption",
            text: "Plant-based iron is sensitive to dietary promoters. Squeezing fresh lemon over ful medames, spinach, or lentil soup converts ferric iron to the more absorbable ferrous form.",
          },
          {
            heading: "Marine Omega-3 Fatty Acids (EPA & DHA)",
            text: "Consuming grilled salmon or sea bass twice weekly provides optimal levels of anti-inflammatory EPA and DHA, supporting joint recovery and cognitive focus during heavy training blocks.",
          },
          {
            heading: "Meeting the 130g Protein Goal",
            text: "Combining eggs, cottage cheese, Greek yogurt, and legumes ensures a complete amino acid profile without relying on processed meat substitutes.",
          },
        ],
      };
    }

    if (scenario === "protein_gap" || name.includes("ahmed")) {
      return {
        badge: "Protein Density Strategy",
        title: "Easy High-Protein Swaps for Consistent Strength",
        summary:
          "Overcome fullness fatigue by integrating liquid protein and nutrient-dense dairy snacks like Greek yogurt and whey into your daily routine.",
        readTime: "2 min read",
        articleTitle: "Easy High-Protein Swaps to Hit 160g Daily Without Fatigue",
        articleSections: [
          {
            heading: "Overcoming Satiety Fatigue",
            text: "Chewing large volumes of solid chicken breast can cause digestive fullness. Liquid nutrition (whey isolate shakes with almond milk) and Greek yogurt provide 25-30g protein per serving with minimal gastrointestinal load.",
          },
          {
            heading: "Targeted Breakfast Upgrades",
            text: "Swapping standard pastries for 3 whole eggs with baladi bread and a scoop of protein adds +35g of protein to start your morning on track.",
          },
        ],
      };
    }

    if (scenario === "single_miss" || name.includes("sara")) {
      return {
        badge: "Behavioral Momentum",
        title: "Why One Missed Log Won't Derail Your Progress",
        summary:
          "Consistency over weeks matters far more than daily perfection. Learn how to resume your nutrition baseline immediately without overcompensating.",
        readTime: "2 min read",
        articleTitle: "Why One Missed Day Won't Derail Your Progress",
        articleSections: [
          {
            heading: "The Danger of Overcompensation",
            text: "When a meal is missed, the natural impulse is to drastically cut calories the next day. This triggers metabolic rebound and binge cravings. The optimal response is resuming your prescribed baseline plan.",
          },
          {
            heading: "Weekly Net Energy Balance",
            text: "Fat loss is dictated by your 7-day average energy deficit. A single untracked meal represents less than 4% of your weekly dietary volume.",
          },
        ],
      };
    }

    return {
      badge: "Nutrition Momentum",
      title: "The 60-Second Habit: Rebuilding Daily Tracking",
      summary:
        "Start by logging just one anchor meal per day to restore dietary mindfulness and reconnect with your personal fitness targets.",
      readTime: "2 min read",
      articleTitle: "The 60-Second Habit: Rebuilding Momentum",
      articleSections: [
        {
          heading: "Lowering the Barrier to Entry",
          text: "Tracking shouldn't feel like a chore. Use quick one-tap logs for your standard breakfast to lock in early morning momentum.",
        },
        {
          heading: "Coach Support & Simplification",
          text: "If 4-meal tracking feels overwhelming, ask Coach Ahmed in the chat to switch your plan to a simplified 2-meal template.",
        },
      ],
    };
  };

  const tip = getTipContent();

  return (
    <>
      <div className="bg-surface rounded-lg border border-border p-4 shadow-card hover:border-brand/30 transition-all flex items-start justify-between gap-4">
        <div className="space-y-1.5 flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] px-2 py-0.5 bg-brand-tint text-brand rounded font-medium border border-[#D5E6D2] uppercase tracking-wider">
              {tip.badge}
            </span>
            <span className="text-[11px] text-ink-muted flex items-center gap-1">
              <BookOpen className="w-3 h-3 text-ink-muted" />
              {tip.readTime}
            </span>
          </div>

          <h3 className="text-xs font-semibold text-ink-primary">{tip.title}</h3>
          <p className="text-xs text-ink-secondary leading-relaxed line-clamp-2">{tip.summary}</p>

          <button
            onClick={() => setOpenModal(true)}
            className="text-xs font-medium text-brand hover:text-brand-hover inline-flex items-center gap-1 pt-0.5 group"
          >
            <span>Read 2-min guide</span>
            <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
      </div>

      {/* Full 2-Minute Guide Modal */}
      {openModal && (
        <div className="fixed inset-0 bg-ink-primary/25 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-surface rounded-xl border border-border max-w-lg w-full p-6 space-y-4 shadow-xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="space-y-0.5">
                <span className="text-[10px] px-2 py-0.5 bg-brand-tint text-brand rounded font-medium border border-[#D5E6D2] uppercase tracking-wider">
                  {tip.badge}
                </span>
                <h3 className="text-sm font-semibold text-ink-primary">{tip.articleTitle}</h3>
              </div>
              <button
                onClick={() => setOpenModal(false)}
                className="p-1 text-ink-muted hover:text-ink-primary rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs text-ink-secondary leading-relaxed">
              {tip.articleSections.map((sec, idx) => (
                <div key={idx} className="space-y-1 bg-surface-subtle p-3 rounded-lg border border-border">
                  <h4 className="font-semibold text-ink-primary text-xs">{sec.heading}</h4>
                  <p className="text-ink-secondary">{sec.text}</p>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-border">
              <span className="text-[11px] text-ink-muted">Curated for {activeProfile.name}</span>
              <button
                onClick={() => setOpenModal(false)}
                className="text-xs font-medium text-white bg-brand hover:bg-brand-hover px-4 py-1.5 rounded-md shadow-hairline"
              >
                Got It, Thanks
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
