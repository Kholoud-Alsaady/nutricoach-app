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
import { FOODS, findFood, foodCalories } from "@/lib/foods";

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
function resolveTargetDate(targetDay: unknown, targetDate: unknown, currentDate: string): string | null {
  if (typeof targetDate === "string" && isISODate(targetDate)) return targetDate;
  if (typeof targetDay !== "string" || !targetDay.trim()) return null;
  const d = targetDay.toLowerCase().trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  if (d === "today" || d === "tonight" || d === "this evening" || d === "now") return currentDate;
  if (d === "tomorrow") return addDays(currentDate, 1);
  if (d === "yesterday") return addDays(currentDate, -1);
  const idx = WEEKDAYS.findIndex((w) => d.includes(w));
  if (idx >= 0) {
    const todayIdx = new Date(currentDate + "T12:00:00Z").getUTCDay();
    let diff = (idx - todayIdx + 7) % 7;
    if (diff === 0 && d.includes("next")) diff = 7;
    return addDays(currentDate, diff);
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
// Research & web grounding helpers
// -----------------------------------------------------------------------------

function isResearchQuery(text: string): boolean {
  const t = text.toLowerCase();
  const patterns = [
    /\b(article|articles|study|studies|research|paper|papers)\b/i,
    /\b(guideline|guidelines|guidance|evidence)\b/i,
    /\b(trusted source|trusted sources|reliable source|reliable sources|source|sources)\b/i,
    /\b(read more about|scientific|literature|clinical trial|clinical trials)\b/i,
    /\b(fao|who|nih|cdc|pubmed|peer-reviewed)\b/i,
    /\bwhat does (who|fao|nih|cdc)\b/i,
    /\bsuggest (me )?(an )?article\b/i,
    /\b(article|study|guideline|research|paper) (about|on|for)\b/i,
  ];
  return patterns.some((p) => p.test(t));
}

function isTrustedResearchSource(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return (
      hostname.endsWith("fao.org") ||
      hostname.endsWith("who.int") ||
      hostname.endsWith("nih.gov") ||
      hostname.endsWith("cdc.gov") ||
      hostname.endsWith("ncbi.nlm.nih.gov") ||
      hostname.endsWith(".gov") ||
      hostname.endsWith(".edu") ||
      hostname.endsWith("efsa.europa.eu") ||
      hostname.endsWith("cochranelibrary.com") ||
      hostname.endsWith("sciencedirect.com") ||
      hostname.endsWith("nature.com") ||
      hostname.endsWith("thelancet.com") ||
      hostname.endsWith("bmj.com") ||
      hostname.endsWith("jamanetwork.com") ||
      hostname.endsWith("nutrition.org") ||
      hostname.endsWith("eatright.org") ||
      hostname.endsWith("cambridge.org") ||
      hostname.endsWith("oxfordacademic.com") ||
      hostname.endsWith("oup.com") ||
      hostname.endsWith("springer.com") ||
      hostname.endsWith("frontiersin.org") ||
      hostname.endsWith("mdpi.com")
    );
  } catch {
    return false;
  }
}

function inferSourceName(url: string, title?: string): string {
  const lowerUrl = url.toLowerCase();
  const lowerTitle = (title || "").toLowerCase();
  if (lowerUrl.includes("who.int") || lowerTitle.includes("world health organization") || lowerTitle.includes("who")) {
    return "World Health Organization (WHO)";
  }
  if (lowerUrl.includes("fao.org") || lowerTitle.includes("food and agriculture organization") || lowerTitle.includes("fao")) {
    return "Food and Agriculture Organization (FAO)";
  }
  if (lowerUrl.includes("ncbi.nlm.nih.gov") || lowerUrl.includes("pubmed") || lowerTitle.includes("pubmed")) {
    return "PubMed / National Institutes of Health";
  }
  if (lowerUrl.includes("nih.gov") || lowerTitle.includes("nih")) {
    return "National Institutes of Health (NIH)";
  }
  if (lowerUrl.includes("cdc.gov") || lowerTitle.includes("cdc")) {
    return "Centers for Disease Control and Prevention (CDC)";
  }
  if (lowerUrl.includes("efsa.europa.eu")) {
    return "European Food Safety Authority (EFSA)";
  }
  if (lowerUrl.includes("harvard.edu")) {
    return "Harvard T.H. Chan School of Public Health";
  }
  if (lowerUrl.includes("sciencedirect.com") || lowerUrl.includes("nature.com") || lowerUrl.includes("thelancet.com") || lowerUrl.includes("bmj.com")) {
    return "Peer-Reviewed Medical Journal";
  }
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    return hostname.charAt(0).toUpperCase() + hostname.slice(1);
  } catch {
    return "Authoritative Nutrition Source";
  }
}

function inferSourceType(url: string, title?: string): "guideline" | "article" | "study" | "report" | "fact_sheet" {
  const combined = `${url} ${title || ""}`.toLowerCase();
  if (combined.includes("fact-sheet") || combined.includes("factsheet") || combined.includes("fact sheet")) return "fact_sheet";
  if (combined.includes("guideline") || combined.includes("guidance") || combined.includes("recommendation") || combined.includes("standard")) return "guideline";
  if (combined.includes("study") || combined.includes("trial") || combined.includes("pubmed") || combined.includes("pmc") || combined.includes("doi.org")) return "study";
  if (combined.includes("report") || combined.includes("technical paper")) return "report";
  return "article";
}

function inferTitleFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const last = pathname.split("/").filter(Boolean).pop() || "";
    const clean = last.replace(/[-_]/g, " ").replace(/\.(html|php|asp|pdf)$/i, "");
    if (clean.length > 3) {
      return clean.charAt(0).toUpperCase() + clean.slice(1);
    }
  } catch {
    // fallback
  }
  return "Nutrition Guidelines & Research";
}

async function handleResearchRequest(
  message: string,
  ai: GoogleGenAI,
  model: string
): Promise<NextResponse> {
  console.log("[NutriCoach] Research request:", message);

  const lower = message.toLowerCase();
  const wantsFao = /\bfao\b/i.test(message) || lower.includes("food and agriculture");
  const wantsWho = /\bwho\b/i.test(message) || lower.includes("world health organization");
  const wantsStudy = /\b(study|studies|trial|trials|paper|papers|pubmed|peer-reviewed)\b/i.test(message);

  let searchPrompt = message;
  if (wantsFao) {
    searchPrompt += "\n[Search focus: official FAO publications, guidelines and articles from fao.org]";
  } else if (wantsWho) {
    searchPrompt += "\n[Search focus: official WHO guidance, guidelines and fact sheets from who.int]";
  } else if (wantsStudy) {
    searchPrompt += "\n[Search focus: peer-reviewed research papers and PubMed/NIH scientific studies]";
  } else if (lower.includes("sugar")) {
    searchPrompt += "\n[Search focus: official WHO and FAO guidance on free sugars, healthy diets, and sugar reduction]";
  }

  const RESEARCH_SYSTEM_INSTRUCTION = `You are NutriCoach's nutrition research assistant.

The user is asking for nutrition information, articles, studies, guidelines, or trusted sources.

Use Google Search grounding to find current, verifiable sources.

Prioritize authoritative nutrition sources.

Preferred sources:
1. FAO (fao.org)
2. WHO (who.int)
3. NIH (nih.gov, ncbi.nlm.nih.gov)
4. CDC (cdc.gov)
5. PubMed / peer-reviewed journals
6. Official government health agencies
7. Universities and established research institutions

If the user explicitly requests FAO, prioritize fao.org.
If the user explicitly requests WHO, prioritize who.int.
If the user explicitly requests a study or paper, prioritize PubMed and peer-reviewed sources.

Do not invent:
- article titles
- URLs
- publication dates
- study findings
- organizations

Only mention information supported by the retrieved sources.

For a general article request, return 2–4 strong sources.

Give a short, useful explanation of what each source is about.

Do not modify the user's meal plan.
Do not create meal proposals.
Do not calculate or change nutrition targets unless the user separately asks for that.

Keep the response concise and useful.`;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: searchPrompt,
      config: {
        systemInstruction: RESEARCH_SYSTEM_INSTRUCTION,
        tools: [{ googleSearch: {} }],
        temperature: 0.2,
      },
    });

    const answer = (response.text || "").trim();
    const groundingMetadata = response.candidates?.[0]?.groundingMetadata;

    console.log("[NutriCoach] Grounding queries:", groundingMetadata?.webSearchQueries);

    const rawChunks = groundingMetadata?.groundingChunks || [];
    const seenUris = new Set<string>();
    const extractedChunks: Array<{ uri: string; title: string }> = [];

    for (const chunk of rawChunks) {
      const uri = chunk.web?.uri;
      const title = (chunk.web?.title || "").trim();
      if (uri && typeof uri === "string" && uri.startsWith("http") && !seenUris.has(uri.toLowerCase())) {
        seenUris.add(uri.toLowerCase());
        extractedChunks.push({ uri, title });
      }
    }

    // Score by authority and user preference
    const scoredChunks = extractedChunks.map((c) => {
      let score = 0;
      const u = c.uri.toLowerCase();
      if (wantsFao && u.includes("fao.org")) score += 200;
      if (wantsWho && u.includes("who.int")) score += 200;
      if (wantsStudy && (u.includes("pubmed") || u.includes("ncbi") || u.includes("nih.gov"))) score += 200;

      if (u.includes("who.int")) score += 100;
      else if (u.includes("fao.org")) score += 100;
      else if (u.includes("nih.gov") || u.includes("cdc.gov") || u.includes("ncbi.nlm.nih.gov")) score += 80;
      else if (isTrustedResearchSource(c.uri)) score += 50;
      else score += 10;

      return { ...c, score };
    });

    scoredChunks.sort((a, b) => b.score - a.score);

    const trustedOnly = scoredChunks.filter((c) => isTrustedResearchSource(c.uri));
    const selectedChunks = (trustedOnly.length >= 2 ? trustedOnly : scoredChunks).slice(0, 4);

    const researchSources: AgentResearchSource[] = selectedChunks.map((c) => {
      const sourceName = inferSourceName(c.uri, c.title);
      const sourceType = inferSourceType(c.uri, c.title);
      return {
        title: c.title || inferTitleFromUrl(c.uri),
        url: c.uri,
        sourceName,
        sourceType,
        summary: `Evidence-based nutrition guidance and research from ${sourceName}.`,
      };
    });

    console.log("[NutriCoach] Grounding sources:", researchSources);

    const cleanReplyText = answer || "I found reliable sources on that topic. You can review the details below.";

    const contract: AgentResponseContract = {
      replyText: cleanReplyText,
      intent: "research_request",
      action: "search_research",
      shouldMutatePlan: false,
      requiresConfirmation: false,
      researchSources,
      suggestedFollowUps: [
        "Apply this to tomorrow's plan",
        "Ask another nutrition question",
      ],
    };

    return NextResponse.json(contract);
  } catch (error: any) {
    console.error("[NutriCoach] Research grounding failed:", error);
    return NextResponse.json(
      {
        ...AGENT_UNAVAILABLE,
        replyText: "I couldn't fetch live research sources right now. Please check your connection or try again in a moment.",
        intent: "research_request",
        action: "search_research",
        error: error?.message || "Research grounding failed",
      },
      { status: 502 }
    );
  }
}

// -----------------------------------------------------------------------------
// Gemini prompt & schema
// -----------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are NutriCoach, a friendly nutrition assistant inside a gym app for Egyptian gym members. Answer the user's actual question in 2-5 sentences. Use the member context provided for personal numbers; never invent numbers. Help with meal ideas (prefer Egyptian foods), swaps, macro questions, and plan questions. If asked for an article or a link, do NOT invent URLs or titles. Instead, give a short summary of the topic and suggest searching reputable sources (for example the NHS, Harvard T.H. Chan School of Public Health, or the WHO). You give general nutrition guidance, not medical advice. For medical conditions, allergies, pregnancy, under-18s, or signs of disordered eating, tell the member to talk to their coach or a qualified professional. Do not recommend extreme calorie restriction.

Return only valid JSON matching the response schema.

Operational guidelines:
- If proposing a meal swap, snack, or addition, set proposedMeal with { slot, title, calories, protein, carbs, fat, ingredients } and requiresConfirmation=true, shouldMutatePlan=false.
- If the user reports eating a meal, set intent="meal_logging", action="log_meal", proposedMeal with realistic macros, requiresConfirmation=true, shouldMutatePlan=false.
- If confirming an existing pending proposal (e.g. "yes", "apply it"), set shouldMutatePlan=true.
- Do not mutate plan without prior pending confirmation.`;;

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


function buildOfflineFallback(
  message: string,
  memberContext: {
    name: string;
    goal: string;
    dailyTargets: Macros;
    remainingToday: AgentRemainingTargets;
    dietaryPreferences: {
      dietaryStyle: string;
      allergies: string[];
      dislikedFoods: string[];
    };
    todayLoggedMeals: Array<{
      mealType: string;
      mealName: string;
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
    }>;
  },
  currentDate: string
): AgentResponseContract {
  const text = message.trim();
  const lower = text.toLowerCase();
  const remaining = memberContext.remainingToday;

  // 1. Greeting -> short friendly greeting, plus a one-line offer of what the bot can do
  if (/^\s*(hi|hello|hey|salam|marhaba|good (morning|afternoon|evening)|greetings|howdy|yo)\b/i.test(text)) {
    return {
      replyText: "Hello! I'm NutriCoach, your nutrition assistant. I can help with your meal ideas, swapping upcoming meals, tracking today's macros, or exploring balanced Egyptian foods.",
      intent: "general_conversation",
      action: "none",
      shouldMutatePlan: false,
      requiresConfirmation: false,
      isOffline: true,
      offlineReason: "AI unavailable, using offline mode",
      suggestedFollowUps: [
        "How much protein do I have left?",
        "What can I eat for dinner?",
        "Suggest breakfast ideas",
      ],
    };
  }

  // 2. "remaining", "left", "macros" -> the remaining-macros summary
  if (/\b(remaining|left|macros?|calories? left|protein left|how much (calories?|protein|carbs?|fat)? (do i have|is)? left)\b/i.test(text)) {
    return {
      replyText: `You have ${remaining.calories} kcal and ${remaining.protein}g protein remaining today (along with ${remaining.carbs}g carbs and ${remaining.fat}g fat). Let me know if you would like a meal suggestion to hit your target.`,
      intent: "nutrition_question",
      action: "none",
      shouldMutatePlan: false,
      requiresConfirmation: false,
      remainingTargets: remaining,
      isOffline: true,
      offlineReason: "AI unavailable, using offline mode",
      suggestedFollowUps: [
        "What can I eat for dinner?",
        "Suggest a high-protein snack",
      ],
    };
  }

  // Article or research query in offline mode -> falls into anything else below
  const isArticleOrResearch = /\b(article|articles|study|studies|guideline|guidelines|paper|papers|research|link|url)\b/i.test(text);

  // 3. "log", "I ate" -> help log a meal using the existing flow
  if (/\b(log|i ate|i had|had|ate|eating|tracked|logging)\b/i.test(text)) {
    const matched = findFood(text);
    if (matched) {
      let slot = "lunch";
      if (lower.includes("breakfast")) slot = "breakfast";
      else if (lower.includes("lunch")) slot = "lunch";
      else if (lower.includes("dinner")) slot = "dinner";
      else if (lower.includes("snack")) slot = "snack";
      else if (matched.meal_types.length) slot = matched.meal_types[0];

      const cals = foodCalories(matched);
      return {
        replyText: `I found ${matched.name} (${cals} kcal · ${matched.protein}g P · ${matched.carbs}g C · ${matched.fat}g F). Would you like to confirm logging this for your ${slot}?`,
        intent: "meal_logging",
        action: "log_meal",
        targetDay: "today",
        targetSlot: slot,
        proposedMeal: {
          slot,
          title: matched.name,
          calories: cals,
          protein: matched.protein,
          carbs: matched.carbs,
          fat: matched.fat,
          ingredients: matched.ingredients,
        },
        shouldMutatePlan: false,
        requiresConfirmation: true,
        isOffline: true,
        offlineReason: "AI unavailable, using offline mode",
        suggestedFollowUps: [`Confirm logging ${matched.name}`],
      };
    }

    return {
      replyText: "What did you eat and for which meal (breakfast, lunch, snack, or dinner)? Tell me the food name and portion so I can help log it.",
      intent: "meal_logging",
      action: "none",
      shouldMutatePlan: false,
      requiresConfirmation: false,
      isOffline: true,
      offlineReason: "AI unavailable, using offline mode",
    };
  }

  // 4. Meal swap, snack or breakfast ideas -> suggest 2-3 meals from existing Egyptian food database that fit remaining macros
  if (
    !isArticleOrResearch &&
    /\b(swap|replace|change|switch|snack|breakfast|lunch|dinner|what can i eat|what to eat|meal ideas?|food ideas?|suggest|recommend)\b/i.test(text)
  ) {
    let slot: "breakfast" | "lunch" | "dinner" | "snack" = "dinner";
    if (lower.includes("breakfast")) slot = "breakfast";
    else if (lower.includes("snack")) slot = "snack";
    else if (lower.includes("lunch")) slot = "lunch";
    else if (lower.includes("dinner") || lower.includes("eat for dinner")) slot = "dinner";

    // Egyptian planning foods first
    const egyptianCandidates = FOODS.filter(
      (f) =>
        f.planning &&
        f.tags.includes("egyptian") &&
        (slot === "breakfast"
          ? f.meal_types.includes("breakfast")
          : slot === "snack"
          ? f.meal_types.includes("snack")
          : f.meal_types.includes("lunch") || f.meal_types.includes("dinner"))
    );

    const pool = [...egyptianCandidates];
    if (pool.length < 3) {
      const general = FOODS.filter(
        (f) =>
          f.planning &&
          (slot === "breakfast"
            ? f.meal_types.includes("breakfast")
            : slot === "snack"
            ? f.meal_types.includes("snack")
            : f.meal_types.includes("lunch") || f.meal_types.includes("dinner"))
      );
      for (const g of general) {
        if (!pool.some((p) => p.id === g.id)) pool.push(g);
        if (pool.length >= 3) break;
      }
    }

    const suggestions = pool.slice(0, 3);
    const formatted = suggestions
      .map(
        (s, i) =>
          `${i + 1}. **${s.name}** (${foodCalories(s)} kcal · ${s.protein}g P · ${s.carbs}g C · ${s.fat}g F)`
      )
      .join("\n");

    const first = suggestions[0];
    const proposedMeal: AgentProposedMeal | undefined = first
      ? {
          slot,
          title: first.name,
          calories: foodCalories(first),
          protein: first.protein,
          carbs: first.carbs,
          fat: first.fat,
          ingredients: first.ingredients,
        }
      : undefined;

    return {
      replyText: `Here are 3 Egyptian ${slot} ideas that fit your remaining targets:\n\n${formatted}\n\nLet me know if you would like me to set one for your meal plan.`,
      intent: "meal_replacement",
      action: "suggest_meal",
      targetDay: "today",
      targetSlot: slot,
      proposedMeal,
      shouldMutatePlan: false,
      requiresConfirmation: true,
      isOffline: true,
      offlineReason: "AI unavailable, using offline mode",
      suggestedFollowUps: [
        `Add ${suggestions[0]?.name || "this meal"} to today`,
        "Suggest a different meal",
      ],
    };
  }

  // 5. anything else -> say honestly: "I can't answer that in offline mode. I can help with your meals, macros and plan."
  return {
    replyText: "I can't answer that in offline mode. I can help with your meals, macros and plan.",
    intent: "unclear",
    action: "none",
    shouldMutatePlan: false,
    requiresConfirmation: false,
    isOffline: true,
    offlineReason: "AI unavailable, using offline mode",
    suggestedFollowUps: [
      "How much protein do I have left?",
      "What can I eat for dinner?",
    ],
  };
}

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

  // Hard safety boundary
  const safetyResult = checkSafety(message);
  if (safetyResult) return NextResponse.json(safetyResult);

  // Normalise state
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
  const remainingFor = (date: string, extra: Array<Partial<Macros>> = []): AgentRemainingTargets =>
    round({
      calories: targets.calories - sumMacros(loggedOn(date)).calories - sumMacros(extra).calories,
      protein: targets.protein - sumMacros(loggedOn(date)).protein - sumMacros(extra).protein,
      carbs: targets.carbs - sumMacros(loggedOn(date)).carbs - sumMacros(extra).carbs,
      fat: targets.fat - sumMacros(loggedOn(date)).fat - sumMacros(extra).fat,
    });

  const todayRemaining = remainingFor(currentDate);

  const compactMemberContext = {
    name: userProfile.name || "Member",
    goal: userProfile.goal || "Healthy nutrition",
    dailyTargets: targets,
    remainingToday: todayRemaining,
    dietaryPreferences: {
      dietaryStyle: userProfile.dietary_style || "balanced",
      allergies: userProfile.allergies || [],
      dislikedFoods: userProfile.disliked_foods || [],
    },
    todayLoggedMeals: loggedOn(currentDate).map((l) => ({
      mealType: l.meal_type,
      mealName: l.meal_name,
      calories: l.calories,
      protein: l.protein,
      carbs: l.carbs,
      fat: l.fat,
    })),
  };

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "your_gemini_api_key_here") {
    console.error("[NutriCoach] /api/chat: GEMINI_API_KEY is not configured. Using offline fallback.");
    const fallback = buildOfflineFallback(message, compactMemberContext, currentDate);
    return NextResponse.json(fallback);
  }

  const ai = new GoogleGenAI({ apiKey });
  const model = process.env.GEMINI_MODEL || "gemini-flash-latest";

  // Dedicated first-class research request path if live search preferred
  if (isResearchQuery(message)) {
    try {
      return await handleResearchRequest(message, ai, model);
    } catch (researchErr: any) {
      console.error("[NutriCoach] Research request error:", researchErr?.message || researchErr);
      const fallback = buildOfflineFallback(message, compactMemberContext, currentDate);
      return NextResponse.json(fallback);
    }
  }

  const list = (v: unknown) => (Array.isArray(v) && v.length ? v.join(", ") : "none");

  const context = `MEMBER CONTEXT (use these exact numbers for personal data):
${JSON.stringify(compactMemberContext, null, 2)}

RECENT CHAT HISTORY (last 10 messages):
${history.length ? history.map((h) => `${h.sender}: ${h.text}`).join("\n") : "(no previous messages)"}

USER MESSAGE:
"${message}"`;

  const callModel = async (correction?: string): Promise<any | null> => {
    const response = await ai.models.generateContent({
      model,
      contents: correction ? `${message}\n\n[Feedback: ${correction}]` : message,
      config: {
        systemInstruction: `${SYSTEM_PROMPT}\n\n${context}`,
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
        temperature: 0.3,
      },
    });
    try {
      return JSON.parse(response.text || "");
    } catch {
      return null;
    }
  };

  try {
    let raw = await callModel();
    if (!raw) {
      console.error("[NutriCoach] /api/chat: model returned invalid JSON. Using offline fallback.");
      const fallback = buildOfflineFallback(message, compactMemberContext, currentDate);
      return NextResponse.json(fallback);
    }

    const result: AgentResponseContract = {
      replyText: String(raw.replyText || "I'm here to help with your nutrition and meals."),
      intent: INTENTS.includes(raw.intent) ? raw.intent : "unclear",
      action: ACTIONS.includes(raw.action) ? raw.action : "none",
      shouldMutatePlan: raw.shouldMutatePlan === true,
      requiresConfirmation: raw.requiresConfirmation === true,
      targetDay: raw.targetDay === "tomorrow" ? "tomorrow" : "today",
      targetSlot: BASE_SLOTS.includes(raw.targetSlot) ? raw.targetSlot : undefined,
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

    const targetDate = resolveTargetDate(raw.targetDay, raw.targetDate, currentDate);
    if (targetDate) result.targetDate = targetDate;

    let single = normalizeMeal(raw.proposedMeal, result.targetSlot);
    let multi = Array.isArray(raw.proposedMeals)
      ? (raw.proposedMeals.map((m: any) => normalizeMeal(m)).filter((m: AgentProposedMeal | null) => m && m.slot) as AgentProposedMeal[])
      : [];

    // Deterministic macro calibration from FOODS database (Requirement e)
    if (single) {
      const match = findFood(single.title);
      if (match) {
        single.title = match.name;
        single.calories = foodCalories(match);
        single.protein = match.protein;
        single.carbs = match.carbs;
        single.fat = match.fat;
        single.ingredients = match.ingredients;
      } else {
        single.calories = Math.round(single.protein * 4 + single.carbs * 4 + single.fat * 9);
      }
      result.proposedMeal = single;
    }
    if (multi.length) {
      for (const m of multi) {
        const match = findFood(m.title);
        if (match) {
          m.title = match.name;
          m.calories = foodCalories(match);
          m.protein = match.protein;
          m.carbs = match.carbs;
          m.fat = match.fat;
          m.ingredients = match.ingredients;
        } else {
          m.calories = Math.round(m.protein * 4 + m.carbs * 4 + m.fat * 9);
        }
      }
      result.proposedMeals = multi;
    }

    if (
      raw.preferenceUpdate &&
      ["disliked_foods", "allergies", "dietary_style"].includes(raw.preferenceUpdate.field) &&
      typeof raw.preferenceUpdate.value === "string" &&
      raw.preferenceUpdate.value.trim()
    ) {
      result.preferenceUpdate = { field: raw.preferenceUpdate.field, value: raw.preferenceUpdate.value.trim().toLowerCase() };
    }

    // Confirmation & mutation validation
    if (result.shouldMutatePlan) {
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
          result.action = pending.action;
          result.intent = pending.intent || result.intent;
          result.targetDate = pending.targetDate || undefined;
          result.targetSlot = pending.targetSlot || undefined;
          result.requiresConfirmation = false;
          result.proposedMeal = pendingMeals.length === 1 ? pendingMeals[0] : undefined;
          result.proposedMeals = pendingMeals.length > 1 ? pendingMeals : undefined;
          result.preferenceUpdate = pending.preferenceUpdate || undefined;
          result.confirmedProposalId = pending.id;
        }
      }
    } else {
      if (MUTATING_ACTIONS.includes(result.action) && (result.proposedMeal || result.proposedMeals || result.preferenceUpdate)) {
        result.requiresConfirmation = true;
      }
    }

    const remDate = result.targetDate || currentDate;
    if (result.proposedMeals?.length || result.proposedMeal) {
      const proposed = result.proposedMeals?.length ? result.proposedMeals : [result.proposedMeal as AgentProposedMeal];
      const after = remainingFor(remDate, proposed);
      result.remainingTargets = after;
    } else if (result.intent === "nutrition_question" || result.intent === "progress_question") {
      result.remainingTargets = todayRemaining;
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("[NutriCoach] /api/chat Gemini error:", error?.message || error);
    const fallback = buildOfflineFallback(message, compactMemberContext, currentDate);
    return NextResponse.json(fallback);
  }
}
