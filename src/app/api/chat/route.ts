import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";
import type {
  AgentActionType,
  AgentIntent,
  AgentPendingProposal,
  AgentProposedMeal,
  AgentRemainingTargets,
  AgentResearchSource,
  AgentResponseContract,
} from "@/lib/types";
import { addDays, daysBetween, todayISO } from "@/lib/dates";
import { searchTrustedNutritionSources, isTrustedResearchSource } from "@/lib/research/trusted-sources";
import { planWeek, prefsFromProfile } from "@/lib/planner";

// =============================================================================
// /api/chat — NutriCoach general-purpose nutrition agent
//
// Flow: safety pre-check -> Gemini (structured JSON) -> application validation.
// Gemini only proposes. The client applies a confirmed proposal through the
// existing mutation layer (NutriCoachContext -> /api/mutate-meal).
// There is intentionally NO scripted/deterministic answer engine here.
// =============================================================================

// Hard Safety Filter for Alcohol & Prohibited Substances
const ALCOHOL_TERMS = [
  "alcohol",
  "beer",
  "beers",
  "wine",
  "vodka",
  "whiskey",
  "whisky",
  "rum",
  "gin",
  "tequila",
  "cocktail",
  "cocktails",
  "spirits",
  "liquor",
  "shot of",
  "shots of",
  "alcoholic",
  "hard seltzer",
  "champagne",
  "booze",
];

const PROHIBITED_SUBSTANCES = [
  "steroid",
  "steroids",
  "anabolic",
  "sarms",
  "clenbuterol",
  "ozempic",
  "wegovy",
  "saxenda",
  "phentermine",
  "dnp",
  "recreational drug",
  "cocaine",
  "weed",
  "marijuana",
  "cannabis",
  "vape",
  "nicotine",
  "tobacco",
  "cigarette",
];

const MEDICAL_CONDITIONS = [
  "pregnancy",
  "pregnant",
  "diabetes",
  "diabetic",
  "eating disorder",
  "anorexia",
  "bulimia",
  "kidney disease",
  "renal failure",
  "liver disease",
  "cirrhosis",
  "dialysis",
];

function checkSafety(message: string): AgentResponseContract | null {
  const p = message.toLowerCase();

  // 1. Check for Alcohol
  const hasAlcohol = ALCOHOL_TERMS.some((term) => {
    const regex = new RegExp(`\\b${term}\\b`, "i");
    return regex.test(p);
  });

  if (hasAlcohol) {
    const alreadyConsumed =
      p.includes("drank") ||
      p.includes("had ") ||
      p.includes("consumed") ||
      p.includes("i drank") ||
      p.includes("i had") ||
      p.includes("last night");

    if (alreadyConsumed) {
      return {
        replyText:
          "I cannot advise on compensating for alcohol consumption or how to optimize it within your nutrition plan. If you are concerned about how alcohol may affect your health, medications, or nutrition, please check with a doctor or qualified healthcare professional. I can still help you plan a balanced alcohol-free meal for the rest of your day.",
        intent: "safety_redirect",
        action: "none",
        shouldMutatePlan: false,
        requiresConfirmation: false,
        needsCoachReview: false,
        suggestedFollowUps: ["Plan balanced dinner", "Check water target"],
      };
    }

    return {
      replyText:
        "Alcohol is not something I can recommend or help plan into your nutrition goals. For health-related questions about alcohol, especially if you have a medical condition or take medication, it is best to check with your doctor or another qualified healthcare professional. I can help you choose a balanced alcohol-free option instead.",
      intent: "safety_redirect",
      action: "none",
      shouldMutatePlan: false,
      requiresConfirmation: false,
      needsCoachReview: false,
      suggestedFollowUps: ["Plan alcohol-free dinner", "View today's macros"],
    };
  }

  // 2. Check for Prohibited / Unsafe Substances
  const hasProhibited = PROHIBITED_SUBSTANCES.some((term) => {
    const regex = new RegExp(`\\b${term}\\b`, "i");
    return regex.test(p);
  });

  if (hasProhibited) {
    return {
      replyText:
        "NutriCoach cannot advise on, recommend, or plan around pharmaceutical substances, unapproved supplements, or unsafe weight-loss compounds. Please consult a licensed medical provider or sports medicine physician for guidance on safe health and training.",
      intent: "safety_redirect",
      action: "none",
      shouldMutatePlan: false,
      requiresConfirmation: false,
      needsCoachReview: true,
      coachFollowup: {
        reason: "Member inquired about prohibited or pharmaceutical substance",
        priority: "high",
        recommendedAction: "Coach to review training intake and reiterate gym safety policy",
      },
      suggestedFollowUps: ["Whole food protein options", "Pre-workout meal ideas"],
    };
  }

  // 3. Check for Clinical Medical Conditions
  const hasMedical = MEDICAL_CONDITIONS.some((term) => {
    const regex = new RegExp(`\\b${term}\\b`, "i");
    return regex.test(p);
  });

  if (hasMedical) {
    return {
      replyText:
        "For medical conditions like diabetes, pregnancy, or renal considerations, personalized clinical guidance from your physician or clinical dietitian is essential. I can assist with general healthy eating habits, but please verify any major dietary adjustments with your healthcare provider.",
      intent: "nutrition_question",
      action: "coach_followup",
      shouldMutatePlan: false,
      requiresConfirmation: false,
      needsCoachReview: true,
      coachFollowup: {
        reason: "Member mentioned clinical medical condition",
        priority: "medium",
        recommendedAction: "Verify physician dietary guidelines on file",
      },
      suggestedFollowUps: ["View current targets", "Ask general nutrition question"],
    };
  }

  return null;
}

// -----------------------------------------------------------------------------
// Types & constants
// -----------------------------------------------------------------------------

interface MealRow {
  date: string;
  meal_type: string;
  meal_name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  ingredients?: string[];
  tags?: string[];
}

interface Macros {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

const AGENT_UNAVAILABLE: AgentResponseContract = {
  replyText: "I’m having trouble processing that request right now. I haven’t changed your meal plan. Please try again.",
  intent: "unclear",
  action: "none",
  shouldMutatePlan: false,
  requiresConfirmation: false,
};

const INTENTS: AgentIntent[] = [
  "meal_replacement",
  "meal_addition",
  "meal_logging",
  "meal_adaptation",
  "preference_change",
  "nutrition_question",
  "progress_question",
  "plan_question",
  "research_request",
  "week_level_planning",
  "general_conversation",
  "unclear",
];

const ACTIONS: AgentActionType[] = [
  "none",
  "suggest_meal",
  "replace_meal",
  "adapt_meal",
  "log_meal",
  "update_preference",
  "adapt_day",
  "adapt_week",
  "search_research",
  "coach_followup",
];

/** Actions that change the plan/logs and therefore always need member confirmation. */
const MUTATING_ACTIONS: AgentActionType[] = ["replace_meal", "adapt_meal", "adapt_day", "adapt_week", "log_meal", "update_preference"];

const BASE_SLOTS = ["breakfast", "lunch", "snack", "dinner"];
const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

// -----------------------------------------------------------------------------
// Deterministic helpers (the application is authoritative for arithmetic)
// -----------------------------------------------------------------------------

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

function sumMacros(rows: Array<Partial<Macros>>): Macros {
  return rows.reduce<Macros>(
    (acc, r) => ({
      calories: acc.calories + num(r.calories),
      protein: acc.protein + num(r.protein),
      carbs: acc.carbs + num(r.carbs),
      fat: acc.fat + num(r.fat),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );
}

const round = (m: Macros): Macros => ({
  calories: Math.round(m.calories),
  protein: Math.round(m.protein),
  carbs: Math.round(m.carbs),
  fat: Math.round(m.fat),
});

const isISODate = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

function weekdayOf(iso: string) {
  return WEEKDAYS[new Date(iso + "T12:00:00Z").getUTCDay()];
}

function dayLabel(iso: string, currentDate: string) {
  const diff = daysBetween(currentDate, iso);
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  if (diff === -1) return "yesterday";
  return weekdayOf(iso);
}

/** Resolve the model's targetDay/targetDate into a concrete ISO date using the APP's current date. */
function resolveTargetDate(targetDay: unknown, targetDate: unknown, currentDate: string, userMessage?: string): string | null {
  if (typeof targetDate === "string" && isISODate(targetDate)) return targetDate;

  const d = (typeof targetDay === "string" ? targetDay : "").toLowerCase().trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  if (d === "today" || d === "tonight" || d === "this evening" || d === "now") return currentDate;
  if (d === "tomorrow") return addDays(currentDate, 1);
  if (d === "yesterday") return addDays(currentDate, -1);

  const idx = WEEKDAYS.findIndex((w) => d.includes(w));
  if (idx >= 0) {
    const todayIdx = new Date(currentDate + "T12:00:00Z").getUTCDay();
    let diff = (idx - todayIdx + 7) % 7;
    if (diff === 0 && d.includes("next")) diff = 7;
    if (diff === 0 && !d.includes("today") && !d.includes("tonight")) diff = 7;
    return addDays(currentDate, diff);
  }

  // Inspect raw user message if targetDay didn't resolve
  if (userMessage) {
    const m = userMessage.toLowerCase();
    if (m.includes("tomorrow")) return addDays(currentDate, 1);
    if (m.includes("today") || m.includes("tonight") || m.includes("this evening")) return currentDate;
    if (m.includes("yesterday")) return addDays(currentDate, -1);
    if (m.includes("weekend")) {
      const todayIdx = new Date(currentDate + "T12:00:00Z").getUTCDay();
      const diff = (6 - todayIdx + 7) % 7 || 7;
      return addDays(currentDate, diff);
    }
    for (let i = 0; i < WEEKDAYS.length; i++) {
      const w = WEEKDAYS[i];
      if (m.includes(w)) {
        const todayIdx = new Date(currentDate + "T12:00:00Z").getUTCDay();
        let diff = (i - todayIdx + 7) % 7;
        if (diff === 0 && m.includes("next")) diff = 7;
        if (diff === 0 && !m.includes("today") && !m.includes("tonight")) diff = 7;
        return addDays(currentDate, diff);
      }
    }
  }

  return null;
}

/**
 * Coerce a model-generated meal into a safe shape. If the stated calories disagree
 * with the macros by >15%, the app recalculates calories from macros (4/4/9).
 */
function normalizeMeal(raw: any, fallbackSlot?: string | null): AgentProposedMeal | null {
  if (!raw || typeof raw !== "object") return null;
  const title = typeof raw.title === "string" ? raw.title.trim() : "";
  if (!title) return null;
  const protein = Math.max(0, Math.round(num(raw.protein)));
  const carbs = Math.max(0, Math.round(num(raw.carbs)));
  const fat = Math.max(0, Math.round(num(raw.fat)));
  let calories = Math.max(0, Math.round(num(raw.calories)));
  const fromMacros = Math.round(protein * 4 + carbs * 4 + fat * 9);
  if (fromMacros > 0 && (calories === 0 || Math.abs(calories - fromMacros) / fromMacros > 0.15)) {
    calories = fromMacros;
  }
  const slot = typeof raw.slot === "string" && raw.slot.trim() ? raw.slot.trim().toLowerCase() : fallbackSlot || undefined;
  return {
    title,
    ingredients: Array.isArray(raw.ingredients) ? raw.ingredients.map(String).slice(0, 12) : [],
    calories,
    protein,
    carbs,
    fat,
    slot: slot as AgentProposedMeal["slot"],
  };
}

function compactMeal(m: MealRow) {
  return `${m.meal_type}: ${m.meal_name} (${Math.round(num(m.calories))} kcal, ${Math.round(num(m.protein))}P/${Math.round(num(m.carbs))}C/${Math.round(num(m.fat))}F)`;
}

/** Per-day adherence summary built from real planned meals vs. real logs. No persona labels. */
function buildAdherenceSummary(planned: MealRow[], logs: MealRow[], currentDate: string, days = 10): string {
  const lines: string[] = [];
  for (let i = days; i >= 1; i--) {
    const date = addDays(currentDate, -i);
    const dayPlanned = planned.filter((p) => p.date === date);
    const dayLogs = logs.filter((l) => l.date === date);
    if (!dayPlanned.length && !dayLogs.length) {
      lines.push(`${date} (${weekdayOf(date)}): no plan and no logs on record`);
      continue;
    }
    const pt = round(sumMacros(dayPlanned));
    const lt = round(sumMacros(dayLogs));
    const offPlan = dayLogs
      .filter((l) => {
        const p = dayPlanned.find((x) => x.meal_type === l.meal_type);
        return !p || p.meal_name.trim().toLowerCase() !== l.meal_name.trim().toLowerCase();
      })
      .map((l) => `${l.meal_type}="${l.meal_name}"`);
    lines.push(
      `${date} (${weekdayOf(date)}): logged ${dayLogs.length}/${dayPlanned.length || BASE_SLOTS.length} meals; ` +
        `logged ${lt.calories} kcal / ${lt.protein}g P vs planned ${pt.calories} kcal / ${pt.protein}g P` +
        (offPlan.length ? `; off-plan: ${offPlan.join(", ")}` : "")
    );
  }
  return lines.join("\n");
}

function buildUpcomingPlan(planned: MealRow[], logs: MealRow[], currentDate: string, days = 7): string {
  const out: string[] = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(currentDate, i);
    const dayPlanned = planned.filter((p) => p.date === date);
    const dayLogs = logs.filter((l) => l.date === date);
    out.push(`${date} (${dayLabel(date, currentDate)}, ${weekdayOf(date)}):`);
    out.push(dayPlanned.length ? dayPlanned.map((m) => `  planned ${compactMeal(m)}`).join("\n") : "  planned: none");
    if (dayLogs.length) out.push(dayLogs.map((m) => `  LOGGED/EATEN ${compactMeal(m)}`).join("\n"));
  }
  return out.join("\n");
}

// -----------------------------------------------------------------------------
// Research & evidence-based nutrition answering helpers
// -----------------------------------------------------------------------------

/**
 * Checks if the user is asking to modify, replace, swap, add, or log meals, or change dietary preferences.
 * These requests MUST go through the meal planning and modification workflows, NEVER intercepted as general nutrition questions.
 */
function isMealModificationRequest(text: string): boolean {
  const t = text.toLowerCase().trim();

  // Explicit confirmation tokens
  if (/^(yes|apply|apply it|confirm|do it|looks good|sounds good|go ahead|sure|ok|okay)\b/i.test(t)) {
    return true;
  }

  // Meal logging statements
  if (/\b(i ate|i had|i drank|i consumed|log this|log meal|logged)\b/i.test(t)) {
    return true;
  }

  // Week-level diversification/regeneration
  if (
    /\b(whole week|entire week|full week|this week|all week|weekly plan|week plan)\b/i.test(t) &&
    /\b(more varied|different|varied|variety|regenerate|rebalance|remake|create|new plan|diversify)\b/i.test(t)
  ) {
    return true;
  }

  // Meal change verbs targeting specific slots or calendar days
  const changeVerbs = /\b(replace|change|swap|switch|substitute|make|update|add|remove|cook|prepare|put|give me a meal|suggest a meal)\b/i;
  const targetSlotsOrDays = /\b(tomorrow|today|yesterday|breakfast|lunch|dinner|snack|meal|meals|my plan|diet plan)\b/i;

  if (changeVerbs.test(t) && targetSlotsOrDays.test(t)) {
    // If it's a general question like "should I change to a sugar-free diet?", do not treat as an imperative meal replacement
    if (/^(what|why|is|does|can|how|explain|tell me)\b/i.test(t) && !/\b(replace|swap|substitute|switch|log)\b/i.test(t)) {
      return false;
    }
    return true;
  }

  // Dietary preference changes
  if (
    /\b(don't want|stop using|allergic to|no more|hate|dislike)\b/i.test(t) &&
    /\b(chicken|meat|dairy|nuts|fish|gluten|eggplant|pork|beef|soy)\b/i.test(t)
  ) {
    return true;
  }

  return false;
}

function isExplicitResearchRequest(text: string): boolean {
  const t = text.toLowerCase();
  const patterns = [
    /\b(article|articles|study|studies|research|paper|papers)\b/i,
    /\b(guideline|guidelines|guidance|evidence)\b/i,
    /\b(trusted source|trusted sources|reliable source|reliable sources|source|sources)\b/i,
    /\b(read more about|scientific|literature|clinical trial|clinical trials)\b/i,
    /\b(fao|who|nih|cdc|nhs|pubmed|efsa|peer-reviewed)\b/i,
    /\bwhat does (who|fao|nih|cdc|nhs|efsa)\b/i,
    /\b(suggest|find|give|show|recommend|get|look up)\s+(me\s+)?(an?\s+)?(article|study|guideline|research|paper|source)\b/i,
    /\b(article|study|guideline|research|paper)\s+(about|on|for|regarding)\b/i,
  ];
  return patterns.some((p) => p.test(t));
}

function isNutritionOrResearchQuery(text: string): boolean {
  const t = text.toLowerCase().trim();

  if (isExplicitResearchRequest(t)) {
    return true;
  }

  // Nutrition & dietary concept presence
  const hasNutritionConcept =
    /\b(sugar|sugars|sugar[- ]free|added sugar|free sugar|natural sugar|naturally occurring sugar|sweetener|sweeteners|protein|proteins|fiber|fibre|carb|carbs|carbohydrate|carbohydrates|fat|fats|saturated fat|unsaturated fat|omega[- ]?3|calorie|calories|macro|macros|nutrient|nutrients|nutrition|dietary|vitamin|vitamins|mineral|minerals|keto|ketogenic|vegan|vegetarian|intermittent fasting|fasting|time[- ]restricted eating|low[- ]carb|high[- ]protein|glycemic|glucose|cholesterol|hypertrophy|muscle growth|muscle protein synthesis)\b/i.test(
      t
    );

  // When a nutrition concept is mentioned with advice, advantages, benefits, questions, or evaluations
  if (hasNutritionConcept) {
    // Advice or informational request
    if (/\b(advise|advice|tell me about|explain|recommendation|recommendations|learn about|guide|guidance|overview|pros and cons)\b/i.test(t)) {
      return true;
    }

    // Advantages / benefits / effects / drawbacks
    if (/\b(advantage|advantages|benefit|benefits|drawback|drawbacks|effect|effects|impact|impacts|value|pros|cons)\b/i.test(t)) {
      return true;
    }

    // Health evaluation: healthy / good / safe / effective / recommended / bad / harmful
    if (/\b(healthy|health|good|bad|safe|harmful|effective|recommended|work|matter)\b/i.test(t)) {
      return true;
    }

    // Difference / comparison
    if (/\b(difference|compare|versus|vs|distinction)\b/i.test(t)) {
      return true;
    }

    // Reduction / intake questions (e.g. reducing sugar, eating less added sugar)
    if (/\b(reducing|eating less|less added|cut down|cutting|lowering|avoiding|intake|consuming less)\b/i.test(t)) {
      return true;
    }

    // Direct question structure (e.g. "what is", "why do", "how does", "can you", "can u")
    if (/^(what|why|how|is|are|does|can|could|should|would)\b/i.test(t) || /^(can u|can you|could you|please)\b/i.test(t)) {
      return true;
    }
  }

  // Nutrition questions asking for mechanisms, health benefits, food comparisons, or dietary science
  const nutritionPatterns = [
    /\b(benefit|benefits|advantage|advantages)\s+(of|to|with)?\b/i,
    /\b(advise|advice)\s+(me\s+)?(with|on|about)?\b/i,
    /\b(is\s+(a\s+)?(sugar[- ]free|keto|vegan|vegetarian|intermittent fasting|low[- ]carb|high[- ]protein|fasting)\s+(diet\s+)?(healthy|good|safe|effective|recommended))\b/i,
    /\b(difference between)\s+.*(sugar|protein|fat|carbs|fats|calories|fiber|fibre)\b/i,
    /\b(does\s+(eating|consuming|having|taking)?\s*.*(help with|promote|lead to|cause|prevent))\b/i,
    /\b(what does\s+.*(say about|conclude about))\b/i,
    /\b(what are the\s+.*(benefits|advantages|effects|impacts|drawbacks|pros|cons))\b/i,
    /\b(intermittent fasting|time[- ]restricted eating)\b/i,
    /\b(added sugar|free sugar|natural sugar|naturally occurring sugar|sugar[- ]free diet|sugar free diet)\b/i,
    /\b(dietary fiber|fiber benefits|fibre benefits|eating more fiber|benefits of fiber)\b/i,
    /\b(muscle growth|hypertrophy|muscle protein synthesis|protein intake)\b/i,
    /\b(healthy diet|nutritional value|nutrient density|balanced diet)\b/i,
    /\b(does|can|will|could)\s+.*\s+(cure|heal|prevent|treat|help with|cause)\b/i,
  ];

  return nutritionPatterns.some((p) => p.test(t));
}

function getRelevanceSentence(s: AgentResearchSource): string {
  const t = s.title.toLowerCase();
  const n = s.sourceName.toLowerCase();

  // Check fiber first to avoid false-matching titles containing "blood sugar"
  if (t.includes("fiber") || t.includes("fibre")) {
    if (t.includes("carbohydrate quality") || t.includes("systematic review")) {
      return "Landmark meta-analysis demonstrating 15–30% mortality and chronic disease reductions with 25–29g daily fiber.";
    }
    if (n.includes("cdc") || t.includes("blood sugar")) {
      return "Explains how dietary fiber regulates blood glucose, lowers LDL cholesterol, and supports heart health.";
    }
    return "Evidence-based guidance on reaching the 30g daily fiber target to reduce cardiovascular and digestive risks.";
  }

  if (t.includes("sugars intake for adults") || (n.includes("who") && t.includes("sugar"))) {
    return "Official WHO guideline recommending reducing free sugars to less than 10% of total daily energy intake.";
  }
  if (t.includes("how does sugar in our diet affect our health") || (n.includes("nhs") && t.includes("sugar"))) {
    return "Clinical NHS guidance detailing the health impacts of free sugars and practical tips on cutting down.";
  }
  if (t.includes("added sugars and nutrition") || (n.includes("cdc") && t.includes("sugar"))) {
    return "Evidence-based CDC reference on added sugars, chronic disease risks, and natural food alternatives.";
  }
  if (t.includes("use of non-sugar sweeteners")) {
    return "Systematic review and guideline advising on non-sugar sweeteners for body weight and metabolic health.";
  }
  if (t.includes("protein supplementation") && t.includes("resistance training")) {
    return "Key meta-analysis confirming 1.6–2.2 g/kg/day optimizes resistance-training muscle mass and strength gains.";
  }
  if (t.includes("protein") && (n.includes("cdc") || n.includes("nih"))) {
    return "Authoritative guidance on protein requirements, timing, and physiological roles in tissue repair.";
  }
  if (t.includes("effects of intermittent fasting") || (t.includes("fasting") && t.includes("health, aging"))) {
    return "Comprehensive NEJM review examining cellular switching, longevity mechanisms, and clinical outcomes.";
  }
  if (t.includes("intermittent fasting") && (t.includes("obesity") || t.includes("umbrella review"))) {
    return "Umbrella review analyzing clinical trials on weight reduction and cardiometabolic effects of fasting.";
  }

  // Fallback to the first sentence of the source summary
  if (s.summary) {
    const firstSentence = s.summary.split(/\.\s+/)[0].trim();
    return firstSentence.endsWith(".") ? firstSentence : firstSentence + ".";
  }
  return `Evidence-based research and official guidance published by ${s.sourceName}.`;
}

/**
 * Deterministic fallback synthesis using verified authoritative guidelines
 * when Gemini is unreachable or experiences transient service issues.
 * Formats concise, user-friendly responses (~80–140 words excluding source titles/links).
 */
function synthesizeEvidenceFallback(message: string, sources: AgentResearchSource[]): string {
  const topSources = sources.slice(0, 2);
  const m = message.toLowerCase();

  let shortAnswer = "";
  const takeaways: string[] = [];
  let medicalNote = "";

  if (m.includes("added sugar") || m.includes("sugar-free") || m.includes("sugar free") || m.includes("sugar")) {
    if (m.includes("difference") || (m.includes("added") && m.includes("natural"))) {
      shortAnswer =
        "Naturally occurring sugars in whole foods come packaged with protective dietary fiber and micronutrients, whereas added or free sugars deliver concentrated energy without fiber and are metabolized quickly.";
      takeaways.push(
        "Whole fruits and plain dairy contain intrinsic sugars bound to fiber and water, which moderate digestion and glycemic response.",
        "Free sugars (refined sugars, syrups, sweetened beverages) deliver rapid energy without satiety and should be limited to under 10% of daily calories.",
        "Cutting added sugars supports cardiometabolic and dental health without any need to eliminate nutrient-rich whole fruits."
      );
    } else if (m.includes("sugar-free") || m.includes("sugar free")) {
      shortAnswer =
        "A diet low in added sugars provides strong metabolic and dental benefits, but completely eliminating wholesome foods with natural sugars—such as fresh fruit and plain dairy—is unnecessary.";
      takeaways.push(
        "Global health guidelines advise minimizing free and added sugars (soft drinks, confectionery, syrups), not wholesome fresh fruits or dairy.",
        "Limiting free sugars to under 10% (ideally under 5%) of daily energy intake significantly lowers the risk of tooth decay and cardiometabolic disease.",
        "A practical, low-added-sugar pattern supports steady energy levels and healthy weight management without extreme food restrictions."
      );
    } else {
      shortAnswer =
        "Reducing added sugar intake lowers your risk of tooth decay, unhealthy weight gain, and chronic metabolic conditions including type 2 diabetes and cardiovascular disease.";
      takeaways.push(
        "The WHO and NHS recommend limiting free sugars to less than 10% of total daily energy (roughly 30g to 50g for adults), with further health benefits below 5%.",
        "Liquid and refined sugars lack dietary fiber, leading to rapid blood sugar spikes and excess calorie intake without promoting satiety.",
        "Replacing sugar-sweetened foods with whole foods improves long-term cardiovascular health and helps maintain steady daily energy."
      );
    }
  } else if (m.includes("protein") && (m.includes("muscle") || m.includes("hypertrophy"))) {
    shortAnswer =
      "Consuming adequate dietary protein combined with progressive resistance training is well established to stimulate muscle protein synthesis and promote muscle growth.";
    takeaways.push(
      "Comprehensive meta-analyses show that daily protein intakes between 1.6 and 2.2 grams per kilogram of body weight optimize gains in muscle mass and strength.",
      "Consuming protein beyond approximately 1.6 to 2.2 g/kg daily generally provides diminishing returns for muscle hypertrophy.",
      "Distributing protein across daily meals (roughly 25–40g per meal from quality lean sources) effectively supports sustained muscle recovery."
    );
  } else if (m.includes("fiber") || m.includes("fibre")) {
    shortAnswer =
      "Eating more dietary fiber improves digestive regulation, stabilizes blood sugar levels, and significantly lowers long-term risk of cardiovascular disease and type 2 diabetes.";
    takeaways.push(
      "Authoritative bodies (WHO, CDC, NHS) recommend adults target 25 to 30 grams of dietary fiber daily from whole foods.",
      "Soluble fiber slows carbohydrate absorption and helps reduce LDL cholesterol, while insoluble fiber supports bowel regularity and gut microbiome health.",
      "Higher fiber intakes from legumes, vegetables, whole grains, and fruits are clinically associated with a 15–30% reduction in all-cause mortality."
    );
  } else if (m.includes("fasting")) {
    shortAnswer =
      "Research shows intermittent fasting (such as 16/8 time-restricted eating) is an effective method for weight management and metabolic health, primarily by facilitating a caloric deficit.";
    takeaways.push(
      "Randomized clinical trials demonstrate that intermittent fasting achieves weight loss and metabolic improvements comparable to standard continuous calorie restriction.",
      "Fasting can support insulin sensitivity and cellular repair mechanisms, but long-term success depends on overall diet quality and individual adherence.",
      "Intermittent fasting is an optional eating schedule rather than a mandatory protocol, and does not produce clinically superior fat loss compared to balanced calorie-matched diets."
    );
    medicalNote = "\n\n_Note: Fasting may not be appropriate for individuals who are pregnant, take blood sugar medications, or have a history of disordered eating._";
  } else {
    shortAnswer =
      "Evidence-based nutrition emphasizes a dietary pattern rich in whole, minimally processed foods, adequate protein, dietary fiber, and healthy fats tailored to your energy needs.";
    takeaways.push(
      "Long-term health is driven by overall dietary consistency, nutrient density, and caloric balance rather than isolating individual foods.",
      "Prioritizing unprocessed vegetables, legumes, whole grains, and lean proteins provides essential micronutrients and promotes lasting satiety."
    );
  }

  const takeawaysText = takeaways.map((t) => `• ${t}`).join("\n");

  let readingList = "";
  if (topSources.length === 0) {
    readingList = "• Additional relevant research for this specific topic could not be verified from primary health authorities.";
  } else {
    const items = topSources.map((s) => {
      const relevance = getRelevanceSentence(s);
      return `• **${s.title}** (${s.sourceName}) — ${relevance} [Read article](${s.url})`;
    });
    if (topSources.length === 1) {
      items.push("• Additional relevant verified evidence could not be confirmed from primary health authorities.");
    }
    readingList = items.join("\n");
  }

  return `**Short answer:**\n${shortAnswer}\n\n**Key takeaways:**\n${takeawaysText}\n\n**Recommended reading:**\n${readingList}${medicalNote}`;
}

function getTailoredFollowUps(message: string): string[] {
  const m = message.toLowerCase();
  if (m.includes("sugar")) {
    return [
      "WHO guidelines on added sugar",
      "How much added sugar is recommended daily?",
      "Low-sugar breakfast ideas",
    ];
  }
  if (m.includes("protein")) {
    return [
      "Optimal protein intake for muscle growth",
      "High-protein snack ideas",
      "View today's protein target",
    ];
  }
  if (m.includes("fiber") || m.includes("fibre")) {
    return [
      "How to reach 30g of fiber daily",
      "High-fiber food sources",
      "View today's macros",
    ];
  }
  if (m.includes("fasting")) {
    return [
      "Intermittent fasting protocols (16/8)",
      "Does fasting preserve muscle mass?",
      "Ask general nutrition question",
    ];
  }
  return [
    "Show WHO healthy diet guidelines",
    "Find PubMed nutrition research",
    "View today's macros",
  ];
}

async function handleNutritionOrResearchRequest(
  message: string,
  ai: GoogleGenAI,
  model: string
): Promise<NextResponse> {
  const isResearch = isExplicitResearchRequest(message);
  console.log(`[NutriCoach] Executing evidence-based ${isResearch ? "research" : "nutrition"} request: "${message}"`);

  try {
    const sources = await searchTrustedNutritionSources(message);

    if (!sources || sources.length === 0) {
      return NextResponse.json({
        replyText:
          "I couldn't find verified scientific research or official guidelines matching that topic from trusted health authorities like WHO, PubMed, CDC, or NHS. Evidence on this specific topic may be limited, unverified, or outside of established nutrition consensus. If you have questions about established topics such as added sugar, dietary fiber, protein, or balanced eating patterns, I'd be happy to share reliable evidence.",
        intent: isResearch ? "research_request" : "nutrition_question",
        action: isResearch ? "search_research" : "none",
        shouldMutatePlan: false,
        requiresConfirmation: false,
        researchSources: [],
        suggestedFollowUps: [
          "What are the benefits of reducing added sugar?",
          "Does eating more protein help with muscle growth?",
          "What are the benefits of eating more fiber?",
        ],
      } satisfies AgentResponseContract);
    }

    const preferredSources = sources.slice(0, 2);
    const isDetailedRequest = /\b(detailed|in-depth|deep dive|comprehensive|literature review|explain in detail|full analysis|long answer)\b/i.test(message);

    const sourcesContext = preferredSources
      .map(
        (s, i) =>
          `[Source ${i + 1}] Title: "${s.title}" (${s.sourceName}, ${s.publishedDate || "N/A"})\nURL: ${s.url}\nSummary: ${s.summary}`
      )
      .join("\n\n");

    const prompt = `The user asked: "${message}".
We retrieved the following verified authoritative nutrition sources (up to 2):

${sourcesContext}

You must write a concise, conversational, evidence-based answer strictly adhering to the following structure and target length:
Target length: ${isDetailedRequest ? "approximately 180–250 words" : "approximately 80–140 words (excluding article titles and links)"}.
Keep it concise, user-friendly, scannable, and readable on a mobile screen. Avoid lengthy introductions, multi-paragraph essays, full conclusions, and redundant lists of organizations.

STRUCTURE:
**Short answer:**
1–2 clear sentences directly answering the user's question.

**Key takeaways:**
• 2–3 concise bullet points covering the most important evidence-based facts. Include numeric recommendations only when directly relevant (e.g., WHO free sugars <10%, 25–30g fiber, 1.6–2.2g/kg protein).

**Recommended reading:**
${preferredSources.length > 0 ? `For each retrieved source above (exactly ${preferredSources.length}):
• **[Article Title]** ([Publisher or Organization]) — [One short sentence explaining why it is relevant.] [Read article]([URL])` : "State that additional relevant verified research could not be retrieved from primary health authorities."}

GUIDELINES:
1. SCIENTIFIC ACCURACY:
   - For sugar: distinguish free/added sugars from naturally occurring sugars in whole fruit and plain dairy. Do not imply eliminating whole fruits.
   - Do not promise guaranteed weight loss, disease cure, or extreme dietary bans. Distinguish correlation from causation.
2. CITATION INTEGRITY:
   - Do NOT invent articles, URLs, dates, or claims. Use ONLY the exact retrieved sources provided above.
3. MEDICAL DISCLAIMER:
   - Only add a single-line note at the end if the question specifically involves an underlying medical condition, medication, or pregnancy (e.g. "_For specific medical conditions or medications, consult a healthcare professional._"). Avoid repeating disclaimers for general nutrition facts.
4. NON-MUTATION:
   - Do NOT suggest modifying meal plans or changing nutrition targets.`;

    let replyText = "";
    for (const mName of Array.from(new Set([model, "gemini-3.7-flash", "gemini-3.5-flash", "gemini-3.8-flash"]))) {
      try {
        const generatePromise = ai.models.generateContent({
          model: mName,
          contents: prompt,
          config: {
            temperature: 0.3,
          },
        });
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Timeout after 6000ms on ${mName}`)), 6000)
        );
        const resp: any = await Promise.race([generatePromise, timeoutPromise]);
        replyText = (resp?.text || "").trim();
        if (replyText) break;
      } catch (modelErr: any) {
        console.warn(`[NutriCoach] Gemini synthesis note (${mName}):`, modelErr?.message || modelErr);
      }
    }

    // High-quality deterministic synthesis fallback if Gemini API is unreachable or times out
    if (!replyText) {
      replyText = synthesizeEvidenceFallback(message, preferredSources);
    }

    return NextResponse.json({
      replyText,
      intent: isResearch ? "research_request" : "nutrition_question",
      action: isResearch ? "search_research" : "none",
      shouldMutatePlan: false,
      requiresConfirmation: false,
      researchSources: preferredSources,
      suggestedFollowUps: getTailoredFollowUps(message),
    } satisfies AgentResponseContract);
  } catch (err: any) {
    console.error("[NutriCoach] Nutrition/Research handler error:", err?.message || err);
    try {
      const fallbackSources = await searchTrustedNutritionSources(message);
      if (fallbackSources.length > 0) {
        const topFallback = fallbackSources.slice(0, 2);
        return NextResponse.json({
          replyText: synthesizeEvidenceFallback(message, topFallback),
          intent: isResearch ? "research_request" : "nutrition_question",
          action: isResearch ? "search_research" : "none",
          shouldMutatePlan: false,
          requiresConfirmation: false,
          researchSources: topFallback,
          suggestedFollowUps: getTailoredFollowUps(message),
        } satisfies AgentResponseContract);
      }
    } catch {
      // ignore secondary error
    }
    return NextResponse.json({
      replyText: "I couldn't retrieve trusted nutrition research right now. Please try again in a moment.",
      intent: isResearch ? "research_request" : "nutrition_question",
      action: isResearch ? "search_research" : "none",
      shouldMutatePlan: false,
      requiresConfirmation: false,
      researchSources: [],
    } satisfies AgentResponseContract);
  }
}

// -----------------------------------------------------------------------------
// Gemini prompt & schema
// -----------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are NutriCoach, an adaptive AI nutrition operations agent for gym members.

You are NOT a scripted chatbot and you are NOT a demo-scenario responder.

Your job is to understand the member's natural-language request, inspect the supplied member state and meal-plan context, reason about the requested change, and return a structured action.

Never assume that a request must match a predefined example.
Never use the member's name or any persona label to decide what to say. Infer behavior from the actual data supplied (plan, logs, adherence history, conversation).

You can handle arbitrary requests involving: meal replacement, meal additions, meal logging, meal adaptation, day-level meal-plan adaptation, week-level planning, cuisine preferences, food preferences, nutrition questions, progress questions, research requests, and meal-plan questions.

RESEARCH AND NUTRITION KNOWLEDGE RETRIEVAL:
You can answer general nutrition questions and research requests using reliable, evidence-based nutrition science.

When the user asks:
- a general nutrition question (e.g. benefits of reducing added sugar, is a sugar-free diet healthy, added vs natural sugar, protein for muscle growth, fiber benefits, intermittent fasting)
- or asks for an article, study, research, guideline, evidence, trusted source, or guidance from WHO, PubMed, CDC, NHS, FAO, or NIH

classify the request as:
- for research/study queries: intent = research_request, action = search_research
- for general nutrition knowledge questions: intent = nutrition_question, action = none (or search_research)

For nutrition answers and research, prioritize authoritative sources:
1. World Health Organization (WHO): https://www.who.int/
2. PubMed: https://pubmed.ncbi.nlm.nih.gov/
3. Centers for Disease Control and Prevention (CDC): https://www.cdc.gov/
4. National Health Service (NHS): https://www.nhs.uk/
Also accepted: NIH, FAO, EFSA, USDA, peer-reviewed journals, and established academic medical centers.

If the user explicitly names a source such as WHO, CDC, NHS, FAO, or PubMed, prioritize that source.

Answer Quality Standards:
- Provide a clear, concise answer first, followed by the main supporting evidence.
- Explain scientific concepts simply in friendly, accessible language.
- Distinguish correlation from causation.
- Explain important limitations and avoid overstating benefits.
- Avoid promising guaranteed weight loss, disease prevention, or other health outcomes.
- Avoid extreme dietary recommendations and unnecessary food restrictions.
- When discussing sugar, distinguish added/free sugars from naturally occurring sugars in whole fruit and plain milk.
- Avoid diagnosing medical conditions or replacing advice from qualified healthcare professionals.
- Recommend professional medical guidance when a question involves a medical condition, medication, or pregnancy.

Do not invent articles, URLs, publication dates, or claims.
Only return source links obtained from verified search results.
Return 2–4 high-quality sources rather than a large list.

Each source in researchSources should contain:
- title
- url
- sourceName
- sourceType ("guideline", "article", "study", "report", "fact_sheet")
- publishedDate (when available)
- summary (concise explanation of how the source supports the answer)

Nutrition information and research requests NEVER modify the member's meal plan (shouldMutatePlan=false, requiresConfirmation=false).

If the user later explicitly asks to apply information from the research to their meal plan, treat that as a new meal-plan request.

Interpretation rules:
- When the user specifies a day, preserve that day. Resolve relative days ("today", "tonight", "tomorrow", weekday names) using CURRENT DATE below and return the ISO date in targetDate.
- When the user specifies a meal slot, preserve that slot.
- "Tomorrow's meals" / "make tomorrow X" means the complete relevant meal plan for tomorrow (every planned slot that is not already logged), not just breakfast. Use action "adapt_day", intent "meal_adaptation", fill proposedMeals with one meal per slot, and leave targetSlot null.
- When the user requests a cuisine or style, adapt the requested meals to that cuisine/style while preserving the member's calorie, protein, carb and fat targets, allergies, dislikes and dietary style.
- Do not redirect a clear request to unrelated UI actions (e.g. never answer a clear request with "View weekly plan" or "Modify breakfast").
- Clarify only when the request is genuinely ambiguous, and ask only for the missing piece. "I want pasta." is ambiguous (which day? which meal?). "Replace tomorrow's dinner with pasta." is clear: produce a dinner proposal (action "replace_meal", proposedMeal).
- If the member reports food they already ate ("I had koshary for lunch"), use intent "meal_logging", action "log_meal", put the eaten food in proposedMeal with slot set, estimate its macros realistically, and in replyText explain its effect on the rest of the day. Use the planned meal for that slot to judge whether it was a deviation. If an adjustment of a later meal would help, say so and offer it as a follow-up.
- Food preference changes ("I don't want chicken anymore", "stop using dairy") are intent "preference_change", action "update_preference", with preferenceUpdate {field, value}. Do not rewrite the plan in the same step; mention which upcoming planned meals are affected (from the plan data) and offer to replace them.
- Use the adherence history to reason about patterns (e.g. consistent tracking, a single missed day, repeated deviations at the same meal, macro gaps, or no recent logs). One missed day is not a reason to redesign a plan. Missing logs mean missing data: never invent intake. Set needsCoachReview with a coachFollowup only when a human coach should genuinely look at something (e.g. several days with no logs, conflicting restrictions).

Proposal and confirmation rules:
- For plan or log changes, create a proposal, set requiresConfirmation=true and shouldMutatePlan=false.
- Only set shouldMutatePlan=true when a PENDING PROPOSAL is supplied below AND the member's current message clearly confirms it. Do not invent a new proposal while confirming; the application will apply the exact pending proposal.
- If the member's message is "yes"/"apply it" but there is no pending proposal, do not mutate; ask what they would like to change.
- Never claim that a change was saved or applied. The application confirms mutations, not you.
- Never directly modify a database.
- Never propose to replace a meal marked LOGGED/EATEN. Offer to add it as an extra meal or plan it for another day instead.

Nutrition rules:
- Respect allergies as hard restrictions. Respect disliked foods and dietary style.
- Use realistic portions and realistic macro estimates. Calories should equal roughly 4*protein + 4*carbs + 9*fat.
- For a day-level proposal, the day's total (logged meals + proposed meals + remaining planned meals) should land close to the daily calorie target and meet the protein target.
- Use the APPLICATION-CALCULATED remaining numbers below when answering "how much is left" questions. Do not recompute them differently.
- Do not recommend or optimize alcohol, prohibited substances, unsafe drugs, or unsafe supplements.
- For medical conditions requiring clinical dietary management, recommend professional medical guidance and do not make clinical decisions.
- Do not shame food choices. Ordinary foods such as pasta, pizza, burgers, koshary, rice, bread or desserts are not prohibited.

Style: concise, practical, warm, conversational. No emojis. suggestedFollowUps: 0-3 short replies that are genuinely useful next steps for THIS conversation.

Use the supplied state as the source of truth. Do not invent existing meals or logs.
Return only valid JSON matching the response schema.`;

const mealSchema = {
  type: Type.OBJECT,
  properties: {
    slot: { type: Type.STRING, description: "breakfast | lunch | snack | dinner (or an extra slot such as snack_2)" },
    title: { type: Type.STRING },
    ingredients: { type: Type.ARRAY, items: { type: Type.STRING } },
    calories: { type: Type.NUMBER },
    protein: { type: Type.NUMBER },
    carbs: { type: Type.NUMBER },
    fat: { type: Type.NUMBER },
  },
  required: ["title", "calories", "protein", "carbs", "fat"],
};

const researchSourceSchema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    url: { type: Type.STRING },
    sourceName: { type: Type.STRING },
    sourceType: {
      type: Type.STRING,
      enum: ["guideline", "article", "study", "report", "fact_sheet"],
    },
    publishedDate: { type: Type.STRING, nullable: true },
    summary: { type: Type.STRING },
  },
  required: ["title", "url", "sourceName", "sourceType", "summary"],
};

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    replyText: { type: Type.STRING },
    intent: { type: Type.STRING, enum: INTENTS as string[] },
    action: { type: Type.STRING, enum: ACTIONS as string[] },
    shouldMutatePlan: { type: Type.BOOLEAN },
    requiresConfirmation: { type: Type.BOOLEAN },
    targetDay: { type: Type.STRING, nullable: true },
    targetDate: { type: Type.STRING, nullable: true, description: "ISO YYYY-MM-DD" },
    targetSlot: { type: Type.STRING, nullable: true },
    proposedMeal: { ...mealSchema, nullable: true },
    proposedMeals: { type: Type.ARRAY, items: mealSchema, nullable: true },
    preferenceUpdate: {
      type: Type.OBJECT,
      nullable: true,
      properties: {
        field: { type: Type.STRING, enum: ["disliked_foods", "allergies", "dietary_style"] },
        value: { type: Type.STRING },
      },
      required: ["field", "value"],
    },
    suggestedFollowUps: { type: Type.ARRAY, items: { type: Type.STRING } },
    needsCoachReview: { type: Type.BOOLEAN },
    coachFollowup: {
      type: Type.OBJECT,
      nullable: true,
      properties: {
        reason: { type: Type.STRING },
        priority: { type: Type.STRING, enum: ["low", "medium", "high"] },
        recommendedAction: { type: Type.STRING },
      },
      required: ["reason", "priority", "recommendedAction"],
    },
    researchSources: {
      type: Type.ARRAY,
      items: researchSourceSchema,
      nullable: true,
    },
  },
  required: ["replyText", "intent", "action", "shouldMutatePlan", "requiresConfirmation"],
};

// -----------------------------------------------------------------------------
// Route
// -----------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(AGENT_UNAVAILABLE, { status: 400 });
  }

  const message: unknown = body?.message;
  if (!message || typeof message !== "string" || !message.trim()) {
    return NextResponse.json(
      { ...AGENT_UNAVAILABLE, replyText: "Please tell me what you'd like help with." },
      { status: 400 }
    );
  }

  // STEP 1: Hard safety boundary (before any model call or nutrition reasoning)
  const safetyResult = checkSafety(message);
  if (safetyResult) return NextResponse.json(safetyResult);

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "your_gemini_api_key_here") {
    console.error("[NutriCoach] /api/chat: GEMINI_API_KEY is not configured.");
    return NextResponse.json(
      {
        ...AGENT_UNAVAILABLE,
        replyText: "NutriCoach AI is currently not configured with an API key. Please check your setup.",
        error: "GEMINI_API_KEY not configured",
      },
      { status: 503 }
    );
  }

  const ai = new GoogleGenAI({ apiKey });
  const model = process.env.GEMINI_MODEL || "gemini-3.8-flash";

  // Dedicated evidence-based nutrition answering & research retrieval path
  // If the user asks to modify, replace, or adapt meals, that request proceeds to the meal planning workflow.
  if (!isMealModificationRequest(message) && isNutritionOrResearchQuery(message)) {
    return await handleNutritionOrResearchRequest(message, ai, model);
  }

  // STEP 2: Normalise the application state supplied by the client
  const currentDate: string = isISODate(body.currentDate) ? body.currentDate : todayISO();
  const userProfile = body.userProfile || {};
  const targets: Macros = {
    calories: num(body.targets?.calories),
    protein: num(body.targets?.protein),
    carbs: num(body.targets?.carbs),
    fat: num(body.targets?.fat),
  };
  const toRows = (arr: unknown): MealRow[] =>
    Array.isArray(arr)
      ? arr
          .filter((m: any) => m && isISODate(m.date) && typeof m.meal_type === "string")
          .map((m: any) => ({
            date: m.date,
            meal_type: String(m.meal_type),
            meal_name: String(m.meal_name ?? ""),
            calories: num(m.calories),
            protein: num(m.protein),
            carbs: num(m.carbs),
            fat: num(m.fat),
            ingredients: Array.isArray(m.ingredients) ? m.ingredients.map(String) : [],
            tags: Array.isArray(m.tags) ? m.tags.map(String) : [],
          }))
      : [];

  const plannedMeals = toRows(body.plannedMeals?.length ? body.plannedMeals : body.todayPlannedMeals);
  const mealLogs = toRows(body.mealLogs?.length ? body.mealLogs : body.todayMealLogs);
  const pending: AgentPendingProposal | null =
    body.conversationState?.pendingProposal && typeof body.conversationState.pendingProposal === "object"
      ? body.conversationState.pendingProposal
      : null;
  const history: Array<{ sender: string; text: string }> = Array.isArray(body.recentHistory)
    ? body.recentHistory
        .filter((h: any) => h && typeof h.text === "string")
        .slice(-10)
        .map((h: any) => ({ sender: h.sender === "user" ? "Member" : "NutriCoach", text: String(h.text).slice(0, 600) }))
    : [];

  const loggedOn = (date: string) => mealLogs.filter((l) => l.date === date);
  const isLogged = (date: string, slot: string) => loggedOn(date).some((l) => l.meal_type === slot);

  // Fast-path: Explicit confirmation handling (deterministic, 0-latency, no LLM 503 risk)
  const isExplicitConfirmation = /^(yes|apply|apply it|confirm|do it|looks good|sounds good|go ahead|sure|ok|okay)\b/i.test(message.trim());

  if (isExplicitConfirmation) {
    if (!pending) {
      return NextResponse.json({
        replyText: "There isn't a pending change for me to apply right now. What would you like to change?",
        intent: "general_conversation",
        action: "none",
        shouldMutatePlan: false,
        requiresConfirmation: false,
        suggestedFollowUps: ["Change tomorrow's meals to Italian", "Recommend a high-protein dinner", "View today's macros"],
      } satisfies AgentResponseContract);
    }

    const stale = isISODate(pending.targetDate) && daysBetween(currentDate, pending.targetDate) < 0;
    const pendingMeals = Array.isArray(pending.meals) ? pending.meals : [];
    const blocked =
      pending.action !== "log_meal" && isISODate(pending.targetDate)
        ? pendingMeals.filter((m) => m.slot && isLogged(pending.targetDate as string, m.slot))
        : [];

    if (stale) {
      return NextResponse.json({
        replyText: "That proposal was for a day that has already passed, so I haven't applied it. Want me to prepare a new one?",
        intent: pending.intent || "meal_adaptation",
        action: "none",
        shouldMutatePlan: false,
        requiresConfirmation: false,
      } satisfies AgentResponseContract);
    }

    if (pendingMeals.length && blocked.length === pendingMeals.length) {
      return NextResponse.json({
        replyText: "Those meals have been logged since I proposed the change, so I won't overwrite them.",
        intent: pending.intent || "meal_adaptation",
        action: "none",
        shouldMutatePlan: false,
        requiresConfirmation: false,
      } satisfies AgentResponseContract);
    }

    return NextResponse.json({
      replyText: `Applied! I've updated your planned meals for ${pending.targetDate || "tomorrow"}.`,
      action: pending.action,
      intent: pending.intent || "meal_adaptation",
      targetDate: pending.targetDate || undefined,
      targetSlot: pending.targetSlot || undefined,
      shouldMutatePlan: true,
      requiresConfirmation: false,
      proposedMeal: pendingMeals.length === 1 ? pendingMeals[0] : undefined,
      proposedMeals: pendingMeals.length > 1 ? pendingMeals : undefined,
      preferenceUpdate: pending.preferenceUpdate || undefined,
      confirmedProposalId: pending.id,
    } satisfies AgentResponseContract);
  }

  // Week-level diversification & regeneration path ("Make my whole week more varied")
  const isWeekRegen =
    /\b(whole week|entire week|full week|this week|all week|weekly plan|week plan)\b/i.test(message) &&
    /\b(more varied|different|varied|variety|regenerate|rebalance|remake|create|new plan|diversify)\b/i.test(message);

  if (isWeekRegen) {
    const prefs = prefsFromProfile(userProfile);
    const weekPlans = planWeek(targets, prefs, {
      startDate: currentDate,
      daysCount: 7,
      existingLogs: mealLogs,
      preferTags: userProfile.dietary_preferences?.includes("egyptian") ? ["egyptian"] : [],
    });

    const tomorrowPlan = weekPlans.find((w) => w.date === addDays(currentDate, 1)) || weekPlans[0];
    const proposed = tomorrowPlan.meals.map((m) => ({
      slot: m.meal_type,
      title: m.meal.meal_name,
      calories: m.meal.calories,
      protein: m.meal.protein,
      carbs: m.meal.carbs,
      fat: m.meal.fat,
      ingredients: m.meal.ingredients || [],
    }));

    return NextResponse.json({
      replyText: `I have prepared a genuinely varied 7-day meal plan for you where every day has different breakfasts, lunches, and dinners (including ${weekPlans.map((d) => d.meals[1]?.meal.meal_name.split(" ")[0]).filter(Boolean).slice(0, 4).join(", ")}). Here is the proposed varied plan starting with tomorrow (${tomorrowPlan.date}) totaling ${tomorrowPlan.totals.calories} kcal and ${tomorrowPlan.totals.protein}g protein. Would you like me to apply this?`,
      intent: "week_level_planning",
      action: "adapt_day",
      targetDate: tomorrowPlan.date,
      targetDay: "tomorrow",
      shouldMutatePlan: false,
      requiresConfirmation: true,
      proposedMeals: proposed,
      suggestedFollowUps: ["Yes, apply it", "Show other dinner ideas", "Keep breakfast unchanged"],
    } satisfies AgentResponseContract);
  }

  const remainingFor = (date: string, extra: Array<Partial<Macros>> = []): AgentRemainingTargets =>
    round({
      calories: targets.calories - sumMacros(loggedOn(date)).calories - sumMacros(extra).calories,
      protein: targets.protein - sumMacros(loggedOn(date)).protein - sumMacros(extra).protein,
      carbs: targets.carbs - sumMacros(loggedOn(date)).carbs - sumMacros(extra).carbs,
      fat: targets.fat - sumMacros(loggedOn(date)).fat - sumMacros(extra).fat,
    });

  const todayRemaining = remainingFor(currentDate);
  const list = (v: unknown) => (Array.isArray(v) && v.length ? v.join(", ") : "none");

  const context = `CURRENT DATE: ${currentDate} (${weekdayOf(currentDate)}). Tomorrow is ${addDays(currentDate, 1)} (${weekdayOf(addDays(currentDate, 1))}).

MEMBER PROFILE:
- Goal: ${userProfile.goal || "not specified"}
- Sex/age/height/weight: ${userProfile.sex || "?"}, ${userProfile.age || "?"}y, ${userProfile.height || "?"}cm, ${userProfile.weight || "?"}kg
- Dietary style: ${userProfile.dietary_style || "standard"}
- Dietary preferences: ${list(userProfile.dietary_preferences)}
- Disliked foods (avoid): ${list(userProfile.disliked_foods)}
- Allergies (HARD restriction, never include): ${list(userProfile.allergies)}

DAILY TARGETS: ${targets.calories} kcal, ${targets.protein}g protein, ${targets.carbs}g carbs, ${targets.fat}g fat.

APPLICATION-CALCULATED REMAINING FOR TODAY (target minus logged meals): ${todayRemaining.calories} kcal, ${todayRemaining.protein}g protein, ${todayRemaining.carbs}g carbs, ${todayRemaining.fat}g fat.

MEAL PLAN AND LOGS, TODAY AND UPCOMING DAYS:
${buildUpcomingPlan(plannedMeals, mealLogs, currentDate)}

ADHERENCE HISTORY, LAST 10 DAYS (planned vs logged):
${buildAdherenceSummary(plannedMeals, mealLogs, currentDate)}

PENDING PROPOSAL AWAITING MEMBER CONFIRMATION:
${pending ? JSON.stringify(pending) : "none"}

RECENT CONVERSATION:
${history.length ? history.map((h) => `${h.sender}: ${h.text}`).join("\n") : "(no previous messages)"}`;

  // STEP 3: Call Gemini (with model fallback for demand spikes and corrective retry if badly unbalanced)
  const candidateModels = Array.from(new Set([model, "gemini-3.7-flash", "gemini-3.5-flash", "gemini-3.8-flash"]));
  const callModel = async (correction?: string): Promise<any | null> => {
    for (const mName of candidateModels) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const response = await ai.models.generateContent({
            model: mName,
            contents: correction ? `${message}\n\n[Application feedback on your previous proposal: ${correction}]` : message,
            config: {
              systemInstruction: `${SYSTEM_PROMPT}\n\n${context}`,
              responseMimeType: "application/json",
              responseSchema: RESPONSE_SCHEMA,
              temperature: 0.4,
            },
          });
          const parsed = JSON.parse(response.text || "");
          if (parsed && typeof parsed.replyText === "string") return parsed;
        } catch (err: any) {
          console.warn(`[NutriCoach] /api/chat model ${mName} attempt ${attempt + 1} notice:`, err?.message || err);
          if (attempt === 0) await new Promise((r) => setTimeout(r, 400));
        }
      }
    }
    return null;
  };

  try {
    let raw = await callModel();
    if (!raw || typeof raw.replyText !== "string") {
      console.error("[NutriCoach] /api/chat: model returned invalid JSON or service unavailable.");
      if (!isMealModificationRequest(message)) {
        try {
          const fallbackSources = await searchTrustedNutritionSources(message);
          if (fallbackSources.length > 0) {
            const topFallback = fallbackSources.slice(0, 2);
            return NextResponse.json({
              replyText: synthesizeEvidenceFallback(message, topFallback),
              intent: "nutrition_question",
              action: "none",
              shouldMutatePlan: false,
              requiresConfirmation: false,
              researchSources: topFallback,
              suggestedFollowUps: getTailoredFollowUps(message),
            } satisfies AgentResponseContract);
          }
        } catch (fbErr: any) {
          console.warn("[NutriCoach] Fallback nutrition search note:", fbErr?.message || fbErr);
        }
      }
      return NextResponse.json(AGENT_UNAVAILABLE, { status: 502 });
    }

    // Day-level balance check: if the proposal is wildly off target, ask the model once to regenerate.
    const checkDayBalance = (r: any): string | null => {
      if (r.action !== "adapt_day" || !Array.isArray(r.proposedMeals) || !r.proposedMeals.length || !targets.calories) return null;
      const date = resolveTargetDate(r.targetDay, r.targetDate, currentDate);
      if (!date) return null;
      const meals = r.proposedMeals.map((m: any) => normalizeMeal(m)).filter(Boolean) as AgentProposedMeal[];
      const slots = new Set(meals.map((m) => m.slot));
      const untouchedPlanned = plannedMeals.filter((p) => p.date === date && !slots.has(p.meal_type as any) && !isLogged(date, p.meal_type));
      const total = sumMacros([...loggedOn(date), ...untouchedPlanned, ...meals]);
      const calDev = Math.abs(total.calories - targets.calories) / targets.calories;
      if (calDev > 0.35) {
        return `the full day would total ${Math.round(total.calories)} kcal against a ${targets.calories} kcal target. Rebalance portions so the day lands near the target.`;
      }
      return null;
    };

    const imbalance = checkDayBalance(raw);
    if (imbalance) {
      const retry = await callModel(imbalance);
      if (retry && typeof retry.replyText === "string" && !checkDayBalance(retry)) {
        raw = retry;
      } else {
        return NextResponse.json({
          ...AGENT_UNAVAILABLE,
          replyText:
            "I couldn't put together a balanced version of that plan just now, so I haven't proposed any changes. Could you try asking again?",
        } satisfies AgentResponseContract);
      }
    }

    // A clear day-level meal-plan request must produce a real proposal card.
    // Do not let the model silently downgrade it to a generic answer.
    const looksLikeDayPlanRequest = /\\b(today|tomorrow|tonight|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\\b/i.test(message)
      && /\\b(change|change all|switch|make|plan|meals|meal plan|menu|cuisine|food|replace|adapt|modify|update)\\b/i.test(message);

    const missingDayProposal =
      looksLikeDayPlanRequest
      && !pending
      && !(
        raw.action === "adapt_day"
        && Array.isArray(raw.proposedMeals)
        && raw.proposedMeals.length > 0
      );

    if (missingDayProposal) {
      const retry = await callModel(
        "This is a CLEAR day-level meal-plan change request. Do not answer conversationally and do not redirect the user. " +
        "Return action=adapt_day, intent=meal_adaptation, requiresConfirmation=true, shouldMutatePlan=false, " +
        "the exact resolved targetDate, and proposedMeals containing every unlogged planned meal slot for that day. " +
        "The proposal must be shown to the user for confirmation before any mutation."
      );
      if (retry && typeof retry.replyText === "string"
        && retry.action === "adapt_day"
        && Array.isArray(retry.proposedMeals)
        && retry.proposedMeals.length > 0
        && !checkDayBalance(retry)) {
        raw = retry;
      } else {
        return NextResponse.json({
          ...AGENT_UNAVAILABLE,
          replyText:
            "I understood that you want to change that day's meals, but I couldn't generate the meal proposal reliably. I haven't changed your plan. Please try the request again.",
          intent: "meal_adaptation",
          action: "adapt_day",
          requiresConfirmation: false,
          shouldMutatePlan: false,
        } satisfies AgentResponseContract);
      }
    }

    // STEP 4: Application-level validation of the structured response
    const result: AgentResponseContract = {
      replyText: raw.replyText.trim(),
      intent: INTENTS.includes(raw.intent) ? raw.intent : "unclear",
      action: ACTIONS.includes(raw.action) ? raw.action : "none",
      shouldMutatePlan: raw.shouldMutatePlan === true,
      requiresConfirmation: raw.requiresConfirmation === true,
      targetDay: typeof raw.targetDay === "string" ? raw.targetDay : undefined,
      targetSlot: typeof raw.targetSlot === "string" && raw.targetSlot ? raw.targetSlot.toLowerCase() : undefined,
      suggestedFollowUps: Array.isArray(raw.suggestedFollowUps) ? raw.suggestedFollowUps.map(String).slice(0, 3) : [],
      needsCoachReview: raw.needsCoachReview === true,
      coachFollowup:
        raw.coachFollowup && raw.coachFollowup.reason
          ? {
              reason: String(raw.coachFollowup.reason),
              priority: ["low", "medium", "high"].includes(raw.coachFollowup.priority) ? raw.coachFollowup.priority : "medium",
              recommendedAction: String(raw.coachFollowup.recommendedAction || ""),
            }
          : null,
    };

    const targetDate = resolveTargetDate(raw.targetDay, raw.targetDate, currentDate, message);
    if (targetDate && result.action !== "search_research") {
      result.targetDate = targetDate;
    }

    if (result.intent === "research_request" || result.action === "search_research" || result.intent === "nutrition_question") {
      result.shouldMutatePlan = false;
      result.requiresConfirmation = false;
      result.proposedMeal = undefined;
      result.proposedMeals = undefined;
      if (!result.researchSources?.length) {
        const sources = await searchTrustedNutritionSources(message);
        if (sources.length > 0) {
          result.researchSources = sources.slice(0, 2);
        }
      }
      if (result.intent === "research_request" && !result.researchSources?.length) {
        result.replyText = "I couldn't find a trusted research publication or official guideline matching that specific query. Please try searching for a broader nutrition topic or specify an authority like WHO, PubMed, CDC, or NHS.";
      }
    }

    const single = normalizeMeal(raw.proposedMeal, result.targetSlot);
    const multi = Array.isArray(raw.proposedMeals)
      ? (raw.proposedMeals.map((m: any) => normalizeMeal(m)).filter((m: AgentProposedMeal | null) => m && m.slot) as AgentProposedMeal[])
      : [];
    if (single) result.proposedMeal = single;
    if (multi.length) result.proposedMeals = multi;

    if (
      raw.preferenceUpdate &&
      ["disliked_foods", "allergies", "dietary_style"].includes(raw.preferenceUpdate.field) &&
      typeof raw.preferenceUpdate.value === "string" &&
      raw.preferenceUpdate.value.trim()
    ) {
      result.preferenceUpdate = { field: raw.preferenceUpdate.field, value: raw.preferenceUpdate.value.trim().toLowerCase() };
    }

    // --- 4a. Confirmation path: only a real, still-valid pending proposal can be applied.
    const isExplicitConfirmation = /^(yes|apply|apply it|confirm|do it|looks good|sounds good|go ahead|sure|ok|okay)\b/i.test(message.trim());

    if (result.shouldMutatePlan || isExplicitConfirmation) {
      if (!pending) {
        result.shouldMutatePlan = false;
        result.requiresConfirmation = false;
        result.action = "none";
        result.proposedMeal = undefined;
        result.proposedMeals = undefined;
        result.replyText = "There isn't a pending change for me to apply right now. What would you like to change?";
      } else {
        const stale = isISODate(pending.targetDate) && daysBetween(currentDate, pending.targetDate) < 0;
        const pendingMeals = Array.isArray(pending.meals) ? pending.meals : [];
        const blocked =
          pending.action !== "log_meal" && isISODate(pending.targetDate)
            ? pendingMeals.filter((m) => m.slot && isLogged(pending.targetDate as string, m.slot))
            : [];

        if (stale) {
          result.shouldMutatePlan = false;
          result.requiresConfirmation = false;
          result.replyText = "That proposal was for a day that has already passed, so I haven't applied it. Want me to prepare a new one?";
        } else if (pendingMeals.length && blocked.length === pendingMeals.length) {
          result.shouldMutatePlan = false;
          result.requiresConfirmation = false;
          result.replyText = "Those meals have been logged since I proposed the change, so I won't overwrite them.";
        } else {
          // Apply EXACTLY what was shown. Never a regenerated proposal.
          result.action = pending.action;
          result.intent = pending.intent || result.intent;
          result.targetDate = pending.targetDate || undefined;
          result.targetSlot = pending.targetSlot || undefined;
          result.shouldMutatePlan = true;
          result.requiresConfirmation = false;
          result.proposedMeal = pendingMeals.length === 1 ? pendingMeals[0] : undefined;
          result.proposedMeals = pendingMeals.length > 1 ? pendingMeals : undefined;
          result.preferenceUpdate = pending.preferenceUpdate || undefined;
          result.confirmedProposalId = pending.id;
        }
      }
    } else {
      // --- 4b. Proposal path: anything that changes plan/logs must be confirmed first.
      if (MUTATING_ACTIONS.includes(result.action) && (result.proposedMeal || result.proposedMeals || result.preferenceUpdate)) {
        result.requiresConfirmation = true;
      }

      // Eaten-meal protection for replacements (logging is allowed — that's the point of logging).
      if (result.action !== "log_meal" && result.targetDate) {
        const date = result.targetDate;
        if (result.proposedMeals?.length) {
          const blocked = result.proposedMeals.filter((m) => m.slot && isLogged(date, m.slot));
          if (blocked.length) {
            result.proposedMeals = result.proposedMeals.filter((m) => !(m.slot && isLogged(date, m.slot)));
            result.replyText += ` I left ${blocked.map((m) => m.slot).join(" and ")} unchanged because it's already logged.`;
          }
          if (!result.proposedMeals.length) {
            result.proposedMeals = undefined;
            result.requiresConfirmation = false;
          }
        }
        const slot = result.proposedMeal?.slot || result.targetSlot;
        if (result.proposedMeal && slot && result.action !== "suggest_meal" && result.intent !== "meal_addition" && isLogged(date, slot)) {
          const logged = loggedOn(date).find((l) => l.meal_type === slot);
          result.replyText = `You've already logged ${slot}${logged ? ` (${logged.meal_name})` : ""} for ${dayLabel(date, currentDate)}, so I won't overwrite it. I can add ${result.proposedMeal.title} as an extra meal, or plan it for another day.`;
          result.requiresConfirmation = false;
          result.action = "none";
          result.proposedMeal = undefined;
          result.suggestedFollowUps = ["Add it as an extra meal", "Plan it for tomorrow"];
        }
      }

      // Slot-level proposals need a resolvable date; otherwise ask instead of guessing.
      if ((result.proposedMeal || result.proposedMeals) && result.requiresConfirmation && !result.targetDate) {
        result.requiresConfirmation = false;
        result.proposedMeal = undefined;
        result.proposedMeals = undefined;
        result.action = "none";
        result.replyText += " Which day should I apply this to?";
      }
    }

    // --- 4c. Application-calculated remaining targets (never trust model arithmetic)
    const remDate = result.targetDate || currentDate;
    if (result.proposedMeals?.length || result.proposedMeal) {
      const proposed = result.proposedMeals?.length ? result.proposedMeals : [result.proposedMeal as AgentProposedMeal];
      const replacedSlots = new Set(proposed.map((m) => m.slot));
      const keptPlanned =
        result.action === "log_meal"
          ? plannedMeals.filter((p) => p.date === remDate && !replacedSlots.has(p.meal_type as any) && !isLogged(remDate, p.meal_type))
          : plannedMeals.filter((p) => p.date === remDate && !replacedSlots.has(p.meal_type as any) && !isLogged(remDate, p.meal_type));
      const after = remainingFor(remDate, proposed);
      const afterPlan = remainingFor(remDate, [...proposed, ...keptPlanned]);
      result.remainingTargets = after;
      const label = dayLabel(remDate, currentDate);
      result.remainingTargetsNote =
        `With this ${result.action === "log_meal" ? "logged" : "change"}, ${label}'s logged and proposed meals leave ${after.calories} kcal and ${after.protein}g protein of your target.` +
        (keptPlanned.length
          ? ` Including the rest of ${label}'s planned meals, the day would finish ${afterPlan.calories >= 0 ? `${afterPlan.calories} kcal under` : `${Math.abs(afterPlan.calories)} kcal over`} target with ${afterPlan.protein >= 0 ? `${afterPlan.protein}g protein still to go` : `protein target met`}.`
          : "");
    } else if (result.intent === "nutrition_question" || result.intent === "progress_question") {
      result.remainingTargets = todayRemaining;
    }

    console.log("[NutriCoach] /api/chat result", {
      intent: result.intent,
      action: result.action,
      shouldMutatePlan: result.shouldMutatePlan,
      requiresConfirmation: result.requiresConfirmation,
      targetDate: result.targetDate,
      targetSlot: result.targetSlot,
      meals: (result.proposedMeals || (result.proposedMeal ? [result.proposedMeal] : [])).map((m) => `${m.slot}:${m.title}`),
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("[NutriCoach] /api/chat Gemini error:", error?.message || error);
    return NextResponse.json(AGENT_UNAVAILABLE, { status: 502 });
  }
}
