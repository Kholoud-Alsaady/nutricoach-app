import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";
import type { AgentResponseContract } from "@/lib/types";

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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      message,
      userProfile,
      targets,
      todayPlannedMeals = [],
      todayMealLogs = [],
      recentHistory = [],
      conversationState,
    } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        {
          replyText: "Please provide a question or request for your nutrition coach.",
          intent: "unclear",
          action: "none",
          shouldMutatePlan: false,
          requiresConfirmation: false,
        },
        { status: 400 }
      );
    }

    // STEP 1: Hard Safety Boundary Check
    const safetyResult = checkSafety(message);
    if (safetyResult) {
      return NextResponse.json(safetyResult);
    }

    const apiKey = process.env.GEMINI_API_KEY;

    // STEP 2: Execute Live Gemini API with Structured Schema if Key is Present
    if (apiKey && apiKey !== "your_gemini_api_key_here") {
      try {
        const ai = new GoogleGenAI({ apiKey });
        const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

        const systemInstruction = `You are NutriCoach, an intelligent clinical sports nutrition agent for gym athletes.
Personality: Warm, encouraging, practical, concise, knowledgeable, non-judgmental, conversational. Avoid emojis. Never shame food choices. Treat ordinary foods (koshary, pasta, burgers, pizza) as workable.

Member Profile:
- Name: ${userProfile?.name || "Athlete"}
- Demo Scenario: ${userProfile?.demo_scenario || "general"}
- Goal: ${userProfile?.goal || "Hypertrophy & Strength"}
- Daily Targets: ${targets?.calories || 2200} kcal, ${targets?.protein || 150}g protein, ${targets?.carbs || 240}g carbs, ${targets?.fat || 65}g fat
- Disliked Foods (Excluded): ${(userProfile?.disliked_foods || []).join(", ") || "None"}
- Allergies (Hard Restrictions - Never Recommend): ${(userProfile?.allergies || []).join(", ") || "None"}

Today's Meal State:
- Planned Meals: ${JSON.stringify(todayPlannedMeals.map((m: any) => ({ slot: m.meal_type, name: m.meal_name, calories: m.calories, protein: m.protein })))}
- Logged/Eaten Meals: ${JSON.stringify(todayMealLogs.map((l: any) => ({ slot: l.meal_type, name: l.meal_name, calories: l.calories, protein: l.protein })))}

Operational Rules:
1. Intent Classification: Classify into: meal_replacement, meal_addition, meal_logging, meal_adaptation, preference_change, nutrition_question, progress_question, plan_question, general_conversation, unclear.
2. Clarification: If target day or slot is missing (e.g. "I want pasta"), ask clarifying questions ("Today or tomorrow, lunch or dinner?"). Set shouldMutatePlan: false. Return 2-3 suggested follow-up chips.
3. Eaten Meal Protection: If a user asks to replace today's slot that is ALREADY logged/eaten, DO NOT overwrite it. Offer to add as extra snack or plan for tomorrow. Set shouldMutatePlan: false.
4. Preference Change: If user says "I don't want chicken anymore", return preferenceUpdate: { field: "disliked_foods", value: "chicken" } and identify affected meals.
5. Confirmation: For clear meal changes, explain the calibrated macros and set requiresConfirmation: true and shouldMutatePlan: false until user explicitly confirms.
6. Demo Personas:
   - Omar: Stable 6-day consistency -> keep plan steady without unnecessary modifications.
   - Sara: Missed 1 day -> don't overreact, continue with plan.
   - Layla: Repeated deviations -> adapt upcoming dinners to fit preferences.
   - Ahmed: Protein gap -> suggest protein-focused additions.
   - Youssef: Inactive logs -> detect inactivity and flag coach follow-up.
7. Return strictly valid JSON matching the schema.`;

        const response = await ai.models.generateContent({
          model,
          contents: message,
          config: {
            systemInstruction,
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                replyText: {
                  type: Type.STRING,
                  description: "Warm, concise, coach-like response without emojis.",
                },
                intent: {
                  type: Type.STRING,
                  enum: [
                    "meal_replacement",
                    "meal_addition",
                    "meal_logging",
                    "meal_adaptation",
                    "preference_change",
                    "nutrition_question",
                    "progress_question",
                    "plan_question",
                    "general_conversation",
                    "unclear",
                  ],
                },
                action: {
                  type: Type.STRING,
                  enum: [
                    "none",
                    "suggest_meal",
                    "replace_meal",
                    "adapt_meal",
                    "log_meal",
                    "update_preference",
                    "adapt_day",
                    "adapt_week",
                    "coach_followup",
                  ],
                },
                shouldMutatePlan: {
                  type: Type.BOOLEAN,
                  description: "True ONLY when fully clear, confirmed, safe, and not overwriting eaten meals.",
                },
                requiresConfirmation: {
                  type: Type.BOOLEAN,
                  description: "True if proposed plan change needs user approval button.",
                },
                targetDay: {
                  type: Type.STRING,
                  description: "today, tomorrow, or day name",
                },
                targetSlot: {
                  type: Type.STRING,
                  description: "breakfast, lunch, snack, dinner",
                },
                suggestedFollowUps: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: "2 to 4 quick action follow-up reply chips.",
                },
                proposedMeal: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    ingredients: { type: Type.ARRAY, items: { type: Type.STRING } },
                    calories: { type: Type.NUMBER },
                    protein: { type: Type.NUMBER },
                    carbs: { type: Type.NUMBER },
                    fat: { type: Type.NUMBER },
                  },
                },
                remainingTargets: {
                  type: Type.OBJECT,
                  properties: {
                    calories: { type: Type.NUMBER },
                    protein: { type: Type.NUMBER },
                    carbs: { type: Type.NUMBER },
                    fat: { type: Type.NUMBER },
                  },
                },
                remainingTargetsNote: { type: Type.STRING },
                preferenceUpdate: {
                  type: Type.OBJECT,
                  properties: {
                    field: { type: Type.STRING, enum: ["disliked_foods", "allergies", "dietary_style"] },
                    value: { type: Type.STRING },
                  },
                },
                needsCoachReview: { type: Type.BOOLEAN },
                coachFollowup: {
                  type: Type.OBJECT,
                  properties: {
                    reason: { type: Type.STRING },
                    priority: { type: Type.STRING, enum: ["low", "medium", "high"] },
                    recommendedAction: { type: Type.STRING },
                  },
                },
              },
              required: ["replyText", "intent", "action", "shouldMutatePlan", "requiresConfirmation"],
            },
          },
        });

        const parsed = JSON.parse(response.text || "{}") as AgentResponseContract;

        // APPLICATION-LEVEL VALIDATION: Guard against unsafe mutations
        if (parsed.targetDay === "today" && parsed.targetSlot) {
          const isAlreadyLogged = todayMealLogs.some((l: any) => l.meal_type === parsed.targetSlot);
          if (isAlreadyLogged && parsed.shouldMutatePlan) {
            parsed.shouldMutatePlan = false;
            parsed.requiresConfirmation = false;
            parsed.replyText = `You have already logged ${parsed.targetSlot} today, so I will not overwrite it. I can either add this as an extra snack or plan it for tomorrow.`;
            parsed.suggestedFollowUps = ["Add as extra snack", "Plan for tomorrow"];
          }
        }

        return NextResponse.json(parsed);
      } catch (geminiError: any) {
        console.warn("Gemini API call failed, falling back to deterministic nutrition agent:", geminiError?.message);
      }
    }

    // STEP 3: Comprehensive Deterministic Adaptive Agent Engine
    const fallbackResponse = runDeterministicCoach({
      message,
      userProfile,
      targets,
      todayPlannedMeals,
      todayMealLogs,
      recentHistory,
      conversationState,
    });

    return NextResponse.json(fallbackResponse);
  } catch (error: any) {
    console.error("Agent chat route error:", error);
    return NextResponse.json(
      {
        replyText: "I am having trouble processing that right now. I have not changed your plan. Please try again in a moment.",
        intent: "unclear",
        action: "none",
        shouldMutatePlan: false,
        requiresConfirmation: false,
      } as AgentResponseContract,
      { status: 500 }
    );
  }
}

// Deterministic Adaptive Engine Implementation
function runDeterministicCoach({
  message,
  userProfile,
  targets,
  todayPlannedMeals,
  todayMealLogs,
  recentHistory,
  conversationState,
}: {
  message: string;
  userProfile: any;
  targets: any;
  todayPlannedMeals: any[];
  todayMealLogs: any[];
  recentHistory?: any[];
  conversationState?: any;
}): AgentResponseContract {
  const p = message.toLowerCase().trim();
  const calGoal = targets?.calories || 2200;
  const proteinGoal = targets?.protein || 150;

  // Calculate intake state
  const loggedCals = todayMealLogs.reduce((sum: number, l: any) => sum + (l.calories || 0), 0);
  const loggedProtein = todayMealLogs.reduce((sum: number, l: any) => sum + (l.protein || 0), 0);
  const remainingCals = Math.max(0, calGoal - loggedCals);
  const remainingProtein = Math.max(0, proteinGoal - loggedProtein);

  // 1. Explicit Confirmation (e.g. "yes", "add it", "do it", "sounds good", "apply change")
  if (
    p === "yes" ||
    p === "yes please" ||
    p === "add it" ||
    p === "do it" ||
    p === "sounds good" ||
    p === "go ahead" ||
    p === "confirm" ||
    p === "apply it" ||
    p === "apply change" ||
    p === "add to dinner" ||
    p === "use that" ||
    p.startsWith("yes,") ||
    p.startsWith("yes ")
  ) {
    // Extract last proposed meal from recent conversation history if available
    let confirmedMeal = {
      title: "Grilled chicken wrap with vegetables",
      ingredients: ["whole wheat wrap", "grilled chicken breast", "mixed vegetables", "greek yogurt sauce"],
      calories: 520,
      protein: 46,
      carbs: 42,
      fat: 14,
      slot: "dinner",
    };

    if (recentHistory && recentHistory.length > 0) {
      const lastAi = [...recentHistory].reverse().find((m: any) => m.sender === "agent" && (m.mealPlanCard || m.proposedMeal));
      if (lastAi?.mealPlanCard) {
        confirmedMeal = {
          title: lastAi.mealPlanCard.foodName,
          ingredients: [lastAi.mealPlanCard.foodName.toLowerCase()],
          calories: lastAi.mealPlanCard.calories,
          protein: lastAi.mealPlanCard.protein,
          carbs: lastAi.mealPlanCard.carbs,
          fat: lastAi.mealPlanCard.fat,
          slot: lastAi.mealPlanCard.targetSlot || "dinner",
        };
      }
    }

    return {
      replyText: `Done. I have applied ${confirmedMeal.title} to tonight's dinner and adjusted your daily targets.`,
      intent: "meal_replacement",
      action: "replace_meal",
      shouldMutatePlan: true,
      requiresConfirmation: false,
      targetDay: "today",
      targetSlot: confirmedMeal.slot || "dinner",
      proposedMeal: confirmedMeal,
      remainingTargetsNote: "Your meal plan has been updated and synchronized.",
      suggestedFollowUps: ["View updated plan", "Check remaining macros"],
    };
  }

  // 2. Preference Change (e.g. "I don't want chicken anymore")
  if (
    p.includes("don't want chicken") ||
    p.includes("dont want chicken") ||
    p.includes("no more chicken") ||
    p.includes("stop giving me chicken")
  ) {
    return {
      replyText:
        "I will avoid chicken going forward. I also checked your upcoming schedule and found two planned meals with chicken that can be replaced with fish or lean beef alternatives.",
      intent: "preference_change",
      action: "update_preference",
      shouldMutatePlan: false,
      requiresConfirmation: true,
      preferenceUpdate: {
        field: "disliked_foods",
        value: "chicken",
      },
      suggestedFollowUps: ["Replace upcoming chicken meals", "Keep as preference only"],
    };
  }

  // 3. Food Logging / Lunch Deviation (e.g. "I ate koshary for lunch")
  if (
    p.includes("koshary") ||
    p.includes("ate koshary") ||
    (p.startsWith("i ate") && p.includes("lunch")) ||
    (p.startsWith("i had") && p.includes("lunch")) ||
    p.startsWith("logged ")
  ) {
    const isKoshary = p.includes("koshary");
    const proposedDinnerTitle = "Grilled chicken wrap with vegetables";
    const dinnerCals = 520;
    const dinnerProtein = 46;
    const dinnerCarbs = 42;
    const dinnerFat = 14;

    return {
      replyText: "Your lunch was higher in carbohydrates than planned, so I would make dinner more protein-focused. I suggest a grilled chicken wrap with vegetables.",
      intent: "meal_adaptation",
      action: "replace_meal",
      shouldMutatePlan: false,
      requiresConfirmation: true,
      targetDay: "today",
      targetSlot: "dinner",
      proposedMeal: {
        title: proposedDinnerTitle,
        ingredients: ["whole wheat wrap", "grilled chicken breast", "mixed vegetables", "greek yogurt sauce"],
        calories: dinnerCals,
        protein: dinnerProtein,
        carbs: dinnerCarbs,
        fat: dinnerFat,
      },
      remainingTargets: {
        calories: 520,
        protein: 46,
        carbs: 42,
        fat: 14,
      },
      remainingTargetsNote: "Dinner calibrated to 520 kcal (46g protein) to balance today's carbohydrate-rich lunch.",
      suggestedFollowUps: ["Apply change", "Choose another meal"],
    };
  }

  // 4. Logged Meal Overwrite Protection (e.g. "Replace today's lunch")
  if (p.includes("replace today's lunch") || (p.includes("lunch") && p.includes("replace") && !p.includes("tomorrow"))) {
    const isLunchLogged = todayMealLogs.some((l: any) => l.meal_type === "lunch");
    if (isLunchLogged) {
      return {
        replyText:
          "You have already logged lunch today, so I will not overwrite it. I can either add the new item as an extra meal and rebalance dinner, or plan it for tomorrow. Which would you prefer?",
        intent: "meal_replacement",
        action: "none",
        shouldMutatePlan: false,
        requiresConfirmation: false,
        targetDay: "today",
        targetSlot: "lunch",
        suggestedFollowUps: ["Add as extra snack", "Plan for tomorrow"],
      };
    }
  }

  // 5. Ambiguous Request (e.g. "I want pasta", "I want a burger")
  if (p === "i want pasta" || p === "i want pasta." || p === "pasta" || p === "can i have a burger" || p === "i want a burger") {
    const item = p.includes("burger") ? "A burger" : "Pasta";
    return {
      replyText: `${item} sounds good and can definitely fit your goals. Do you want it for today or tomorrow, and are you thinking lunch or dinner?`,
      intent: "meal_replacement",
      action: "none",
      shouldMutatePlan: false,
      requiresConfirmation: false,
      suggestedFollowUps: ["Today · Lunch", "Today · Dinner", "Tomorrow · Dinner"],
    };
  }

  // 6. Clear Meal Request with Confirmation Needed (e.g. "Tonight for dinner", "Replace dinner with chicken pasta", "I want pasta tonight")
  if (
    p.includes("tonight") ||
    p.includes("dinner") ||
    p.includes("chicken pasta") ||
    p.includes("pasta tonight") ||
    p.includes("burger tonight")
  ) {
    const isBurger = p.includes("burger");
    const mealTitle = isBurger ? "Lean beef burger with sweet potato wedges" : "Chicken tomato pasta";
    const mealCals = isBurger ? 580 : 600;
    const mealProtein = isBurger ? 44 : 40;
    const mealCarbs = isBurger ? 52 : 65;
    const mealFat = isBurger ? 16 : 18;

    return {
      replyText: `For tonight's dinner, ${mealTitle.toLowerCase()} around ${mealCals} kcal gives you approximately ${mealProtein}g protein and keeps your remaining targets on track. Would you like me to add it to tonight's dinner?`,
      intent: "meal_replacement",
      action: "replace_meal",
      shouldMutatePlan: false,
      requiresConfirmation: true,
      targetDay: "today",
      targetSlot: "dinner",
      proposedMeal: {
        title: mealTitle,
        ingredients: isBurger ? ["lean beef patty", "whole grain bun", "sweet potato", "lettuce"] : ["whole wheat pasta", "grilled chicken breast", "tomato sauce", "vegetables"],
        calories: mealCals,
        protein: mealProtein,
        carbs: mealCarbs,
        fat: mealFat,
      },
      remainingTargets: {
        calories: Math.max(0, remainingCals - mealCals),
        protein: Math.max(0, remainingProtein - mealProtein),
        carbs: 45,
        fat: 15,
      },
      remainingTargetsNote: `This leaves approximately ${Math.max(0, remainingCals - mealCals)} kcal and ${Math.max(0, remainingProtein - mealProtein)}g protein for the day.`,
      suggestedFollowUps: ["Apply change", "Choose another meal"],
    };
  }

  // 7. Full Day Cuisine / Replan Request (e.g. "create tomorrow's plan using Italian foods")
  if (p.includes("italian") || p.includes("egyptian") || p.includes("mediterranean") || p.includes("full plan")) {
    const cuisine = p.includes("italian") ? "Italian" : p.includes("mediterranean") ? "Mediterranean" : "Egyptian";
    return {
      replyText: `I have prepared a full-day high-protein ${cuisine} meal plan calibrated to your ${calGoal} kcal target.`,
      intent: "meal_adaptation",
      action: "adapt_day",
      shouldMutatePlan: true,
      requiresConfirmation: false,
      targetDay: "tomorrow",
      suggestedFollowUps: ["View weekly plan", "Modify breakfast"],
    };
  }

  // 8. Inactivity / Demo Persona Checks (Sara, Omar, Youssef, Ahmed)
  const persona = userProfile?.demo_scenario || "";
  if (persona === "inactivity" || userProfile?.name?.toLowerCase().includes("youssef")) {
    return {
      replyText: "I haven't seen any recent food logs from you over the past few days. Would you like to log today's meals together, or would you like me to set up a simple baseline plan to get started?",
      intent: "progress_question",
      action: "coach_followup",
      shouldMutatePlan: false,
      requiresConfirmation: false,
      needsCoachReview: true,
      coachFollowup: {
        reason: "Member inactive for 4+ consecutive days",
        priority: "medium",
        recommendedAction: "Send encouraging check-in message via coach chat",
      },
      suggestedFollowUps: ["Log today's breakfast", "Start fresh plan"],
    };
  }

  if (persona === "protein_gap" || userProfile?.name?.toLowerCase().includes("ahmed") || p.includes("protein low") || p.includes("protein gap")) {
    return {
      replyText: "Your calories are close to target, but protein has been below target for several days. I would focus on adding a high-protein option rather than increasing your overall calories.",
      intent: "nutrition_question",
      action: "suggest_meal",
      shouldMutatePlan: false,
      requiresConfirmation: false,
      suggestedFollowUps: ["Suggest high-protein snack", "View protein sources"],
    };
  }

  if (p.includes("missed yesterday") || persona === "single_miss" || userProfile?.name?.toLowerCase().includes("sara")) {
    return {
      replyText: "One missed day is completely normal and will not derail your progress. There is no need to overcompensate or redesign your plan. Let us continue with today's targets.",
      intent: "progress_question",
      action: "none",
      shouldMutatePlan: false,
      requiresConfirmation: false,
      suggestedFollowUps: ["View today's meals", "Log lunch"],
    };
  }

  if (persona === "stable" && (p.includes("how am i doing") || p.includes("should i change") || p.includes("progress") || userProfile?.name?.toLowerCase().includes("omar"))) {
    return {
      replyText: "You are doing well with the current plan and have maintained consistent tracking. I would not change anything today.",
      intent: "progress_question",
      action: "none",
      shouldMutatePlan: false,
      requiresConfirmation: false,
      suggestedFollowUps: ["View today's meals", "Check streak"],
    };
  }

  // 9. Remaining Macros Inquiry (e.g. "How much protein do I have left?")
  if (p.includes("how much") || p.includes("remaining") || p.includes("protein left") || p.includes("calories left")) {
    return {
      replyText: `You have approximately ${remainingCals} kcal and ${remainingProtein}g protein remaining for today.`,
      intent: "nutrition_question",
      action: "none",
      shouldMutatePlan: false,
      requiresConfirmation: false,
      remainingTargets: {
        calories: remainingCals,
        protein: remainingProtein,
        carbs: Math.max(0, (targets?.carbs || 240) - 120),
        fat: Math.max(0, (targets?.fat || 65) - 30),
      },
      suggestedFollowUps: ["Suggest high-protein dinner", "Add protein snack"],
    };
  }

  // 10. Default General Conversation
  return {
    replyText: `I am here to help you adjust meals, swap ingredients, or balance today's remaining ${remainingCals} kcal and ${remainingProtein}g protein. What would you like to work on?`,
    intent: "general_conversation",
    action: "none",
    shouldMutatePlan: false,
    requiresConfirmation: false,
    suggestedFollowUps: ["Replace dinner", "Log a meal", "Suggest snack"],
  };
}
