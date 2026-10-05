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

    // Hard trust boundary: research cards must contain ONLY approved authoritative domains.
    // Never fall back to arbitrary Google results just because fewer than two trusted
    // sources were found. It is better to return a clear "no trusted source found"
    // response than to surface an untrusted article.
    const trustedOnly = scoredChunks.filter((c) => isTrustedResearchSource(c.uri));
    const selectedChunks = trustedOnly.slice(0, 4);

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

const SYSTEM_PROMPT = `You are NutriCoach, an adaptive AI nutrition operations agent for gym members.

You are NOT a scripted chatbot and you are NOT a demo-scenario responder.

Your job is to understand the member's natural-language request, inspect the supplied member state and meal-plan context, reason about the requested change, and return a structured action.

Never assume that a request must match a predefined example.
Never use the member's name or any persona label to decide what to say. Infer behavior from the actual data supplied (plan, logs, adherence history, conversation).

You can handle arbitrary requests involving: meal replacement, meal additions, meal logging, meal adaptation, day-level meal-plan adaptation, week-level planning, cuisine preferences, food preferences, nutrition questions, progress questions, research requests, and meal-plan questions.

RESEARCH AND INFORMATION RETRIEVAL:
You can handle research requests.

When the user asks for:
- an article
- a study
- research
- a guideline
- evidence
- a trusted source
- official nutrition guidance
- information from FAO, WHO, NIH, CDC, PubMed, or another named authority

classify the request as:
intent = research_request
action = search_research

Use web search grounding when available.

For nutrition research, prioritize authoritative sources.
Preferred sources include:
FAO, WHO, NIH, CDC, official government health agencies, PubMed, peer-reviewed journals, universities, and established research institutions.

If the user explicitly names a source such as FAO or WHO, prioritize that source.

Do not invent articles, URLs, publication dates, or claims.
Only return source links obtained from the search results.

Return 2–4 high-quality sources rather than a large list.

Each source in researchSources should contain:
- title
- url
- sourceName
- sourceType ("guideline", "article", "study", "report", "fact_sheet")
- publishedDate (when available)
- summary (short, informative summary)

Research requests never modify the member's meal plan (shouldMutatePlan=false, requiresConfirmation=false).

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
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

  // Dedicated first-class research request path
  if (isResearchQuery(message)) {
    return await handleResearchRequest(message, ai, model);
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

  // STEP 3: Call Gemini (with one corrective retry if a day-level proposal is badly unbalanced)
  const callModel = async (correction?: string): Promise<any | null> => {
    const response = await ai.models.generateContent({
      model,
      contents: correction ? `${message}\n\n[Application feedback on your previous proposal: ${correction}]` : message,
      config: {
        systemInstruction: `${SYSTEM_PROMPT}\n\n${context}`,
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
        temperature: 0.4,
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
    if (!raw || typeof raw.replyText !== "string") {
      console.error("[NutriCoach] /api/chat: model returned invalid JSON.");
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

    const targetDate = resolveTargetDate(raw.targetDay, raw.targetDate, currentDate);
    if (targetDate) result.targetDate = targetDate;if (targetDate && result.action !== "search_research") result.targetDate = targetDate;

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
          // Apply EXACTLY what was shown. Never a regenerated proposal.
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
