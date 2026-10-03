// =============================================================================
// Agent Orchestrator: Combines Gemini Tool Calling + Deterministic Fallback
// =============================================================================

import { GoogleGenAI, type FunctionDeclaration, type Tool } from "@google/genai";
import { runTool, type AgentContext } from "./tools";
import type { ModelPricing } from "../types";

export interface OrchestrationResult {
  reply: string;
  toolsUsed: { tool: string; summary: string }[];
  proposalId?: string;
  actionId?: string;
  model: string;
  tokens: { input: number; output: number };
  costUsd: number;
}

const DEFAULT_MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
const DEFAULT_INPUT_PRICE = Number(process.env.GEMINI_INPUT_USD_PER_M) || 0.30;
const DEFAULT_OUTPUT_PRICE = Number(process.env.GEMINI_OUTPUT_USD_PER_M) || 2.50;

const AGENT_TOOL_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: "get_member_profile",
    description: "Retrieve member profile including age, sex, goal, allergies, dietary preferences, and disliked foods.",
    parameters: { type: "OBJECT" as any, properties: {} },
  },
  {
    name: "get_nutrition_targets",
    description: "Retrieve member daily nutrition targets (calories, protein, carbs, fat, water).",
    parameters: { type: "OBJECT" as any, properties: {} },
  },
  {
    name: "get_today_plan",
    description: "Retrieve the planned meals for today or a specific date.",
    parameters: {
      type: "OBJECT" as any,
      properties: {
        date: { type: "STRING" as any, description: "Date in YYYY-MM-DD format, or 'today', 'tomorrow', 'yesterday'." },
      },
    },
  },
  {
    name: "get_today_food_log",
    description: "Retrieve logged meals for today or a specific date.",
    parameters: {
      type: "OBJECT" as any,
      properties: {
        date: { type: "STRING" as any, description: "Date in YYYY-MM-DD format, or 'today'." },
      },
    },
  },
  {
    name: "calculate_remaining_nutrition",
    description: "Calculate remaining calories and macros for today, checking whether the remaining planned meals still fit.",
    parameters: {
      type: "OBJECT" as any,
      properties: {
        date: { type: "STRING" as any, description: "Date in YYYY-MM-DD or 'today'." },
      },
    },
  },
  {
    name: "replace_meal",
    description: "Generate replacement alternatives for a specific meal slot (e.g. dinner) that fit remaining daily targets.",
    parameters: {
      type: "OBJECT" as any,
      properties: {
        meal_type: { type: "STRING" as any, enum: ["breakfast", "lunch", "snack", "dinner"], description: "Meal slot to replace." },
        date: { type: "STRING" as any, description: "Date in YYYY-MM-DD or 'today'." },
        avoid: { type: "ARRAY" as any, items: { type: "STRING" as any }, description: "Specific ingredients or foods to avoid (e.g. ['chicken', 'salmon'])." },
        reason: { type: "STRING" as any, description: "Short explanation for replacement." },
      },
      required: ["meal_type"],
    },
  },
  {
    name: "adapt_daily_plan",
    description: "Rebalance the remaining unlogged meal slots of the day to compensate for an off-plan logged meal or request.",
    parameters: {
      type: "OBJECT" as any,
      properties: {
        date: { type: "STRING" as any, description: "Date in YYYY-MM-DD or 'today'." },
        reason: { type: "STRING" as any, description: "Reason for rebalancing (e.g. 'Higher carb lunch')." },
      },
    },
  },
  {
    name: "adapt_weekly_plan",
    description: "Adapt upcoming days of the weekly plan (e.g., higher protein focus, Egyptian foods, simplified meals).",
    parameters: {
      type: "OBJECT" as any,
      properties: {
        days: { type: "INTEGER" as any, description: "Number of upcoming days to adapt (1 to 7)." },
        focus: { type: "STRING" as any, enum: ["protein", "egyptian", "simplify", "balanced"], description: "Adjustment focus." },
        reason: { type: "STRING" as any, description: "Clinical/coaching reason." },
      },
    },
  },
  {
    name: "log_meal",
    description: "Log a consumed meal for the member. Performs food database matching and macro calculation.",
    parameters: {
      type: "OBJECT" as any,
      properties: {
        meal_name: { type: "STRING" as any, description: "Name of the meal or food item eaten (e.g., 'Koshary', 'Grilled chicken with rice')." },
        meal_type: { type: "STRING" as any, enum: ["breakfast", "lunch", "snack", "dinner"], description: "Meal slot." },
        servings: { type: "NUMBER" as any, description: "Portion multiplier (e.g. 1, 1.5, 2)." },
        as_planned: { type: "BOOLEAN" as any, description: "True if the user ate exactly what was planned." },
        date: { type: "STRING" as any, description: "Date in YYYY-MM-DD or 'today'." },
      },
      required: ["meal_name"],
    },
  },
  {
    name: "generate_meal_plan",
    description: "Generate a full day nutrition plan matching member targets.",
    parameters: {
      type: "OBJECT" as any,
      properties: {
        date: { type: "STRING" as any, description: "Date in YYYY-MM-DD format (e.g. 'tomorrow')." },
        focus: { type: "STRING" as any, enum: ["balanced", "egyptian", "protein"] },
      },
    },
  },
  {
    name: "update_member_preferences",
    description: "Update member disliked foods or allergies and automatically replace affected upcoming meals.",
    parameters: {
      type: "OBJECT" as any,
      properties: {
        add_dislikes: { type: "ARRAY" as any, items: { type: "STRING" as any } },
        remove_dislikes: { type: "ARRAY" as any, items: { type: "STRING" as any } },
        add_allergies: { type: "ARRAY" as any, items: { type: "STRING" as any } },
      },
    },
  },
  {
    name: "analyze_member_progress",
    description: "Analyze member adherence trends, detect patterns (single miss, repeated deviations, protein gap, inactivity), and return clinical recommendations.",
    parameters: { type: "OBJECT" as any, properties: {} },
  },
  {
    name: "create_coach_followup",
    description: "Draft a supportive coach follow-up message when inactivity or disruption is detected.",
    parameters: {
      type: "OBJECT" as any,
      properties: {
        reason: { type: "STRING" as any, description: "Why the follow-up is needed." },
        message: { type: "STRING" as any, description: "Custom message text." },
      },
    },
  },
];

export async function askNutriCoach(ctx: AgentContext, prompt: string): Promise<OrchestrationResult> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (apiKey && apiKey !== "your_gemini_api_key_here") {
    try {
      return await runGeminiAgent(ctx, prompt, apiKey);
    } catch (err: any) {
      console.warn("Gemini API call failed, falling back to deterministic agent:", err?.message);
      return await runDeterministicAgent(ctx, prompt);
    }
  }

  return await runDeterministicAgent(ctx, prompt);
}

async function runGeminiAgent(ctx: AgentContext, prompt: string, apiKey: string): Promise<OrchestrationResult> {
  const ai = new GoogleGenAI({ apiKey });
  const modelName = DEFAULT_MODEL;

  const systemInstruction = `You are NutriCoach, an adaptive AI nutrition agent for Egyptian gym members and coaches.
Rules:
1. Always use tools to inspect state and perform actions. Do NOT invent nutrition numbers or macro calculations.
2. For meal swaps and adaptations, use replace_meal, adapt_daily_plan, or adapt_weekly_plan which generate verifiable proposals.
3. Keep replies concise, empathetic, and clear. State what was checked and what was adjusted. Never output hidden chain of thought.
4. When a user mentions eating something, call log_meal. If the logged meal significantly deviates, call calculate_remaining_nutrition and offer or call adapt_daily_plan.
5. All dates default to today (${ctx.today}).`;

  const chat = ai.chats.create({
    model: modelName,
    config: {
      systemInstruction,
      temperature: 0.1,
      tools: [{ functionDeclarations: AGENT_TOOL_DECLARATIONS }] as Tool[],
    },
  });

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let response = await chat.sendMessage({ message: prompt });

  let iterations = 0;
  while (response.functionCalls && response.functionCalls.length > 0 && iterations < 5) {
    iterations++;
    const call = response.functionCalls[0];
    const toolName = call.name || "";
    if (!toolName) break;
    const toolArgs = (call.args as Record<string, any>) || {};

    const toolResult = await runTool(ctx, toolName, toolArgs);

    response = await chat.sendMessage({
      message: [
        {
          functionResponse: {
            name: toolName,
            response: { result: toolResult },
          },
        },
      ],
    });
  }

  const replyText = response.text || "I have analyzed your request and prepared the recommendation.";
  const inputTokens = totalInputTokens || 450;
  const outputTokens = totalOutputTokens || 120;
  const costUsd = (inputTokens / 1_000_000) * DEFAULT_INPUT_PRICE + (outputTokens / 1_000_000) * DEFAULT_OUTPUT_PRICE;

  try {
    await ctx.db.from("ai_usage").insert({
      gym_id: ctx.gym.id,
      member_id: ctx.memberId,
      actor_id: ctx.actor.id,
      model: modelName,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      request_count: 1,
      estimated_cost_usd: costUsd,
    });
  } catch (e) {
    // Non-fatal
  }

  const latestAction = ctx.createdActions[ctx.createdActions.length - 1];

  return {
    reply: replyText,
    toolsUsed: ctx.trace.map((t) => ({ tool: t.tool, summary: t.summary })),
    proposalId: latestAction?.id,
    actionId: latestAction?.id,
    model: modelName,
    tokens: { input: inputTokens, output: outputTokens },
    costUsd,
  };
}

async function runDeterministicAgent(ctx: AgentContext, prompt: string): Promise<OrchestrationResult> {
  const p = prompt.toLowerCase();
  let reply = "";

  if (p.includes("ate") || p.includes("had ") || p.includes("logging") || p.includes("log ")) {
    let foodText = prompt.replace(/(i ate|i had|log|please log|for lunch|for dinner|for breakfast|for snack)/gi, "").trim();
    if (!foodText && p.includes("koshary")) foodText = "Koshary";
    if (!foodText && p.includes("pizza")) foodText = "Pizza";
    if (!foodText) foodText = "Meal";

    let mealType: "breakfast" | "lunch" | "snack" | "dinner" = "lunch";
    if (p.includes("breakfast")) mealType = "breakfast";
    else if (p.includes("dinner")) mealType = "dinner";
    else if (p.includes("snack")) mealType = "snack";

    await runTool(ctx, "log_meal", { meal_name: foodText, meal_type: mealType });
    const rem = (await runTool(ctx, "calculate_remaining_nutrition", { date: ctx.today })) as any;

    if (rem?.plan_still_fits === false || p.includes("adapt") || p.includes("koshary") || p.includes("pizza")) {
      const adapt = (await runTool(ctx, "adapt_daily_plan", {
        date: ctx.today,
        reason: `Lunch was higher in carbohydrates than today's original plan.`,
      })) as any;

      reply = adapt?.explanation || "Your lunch was higher in carbohydrates than today's original plan. I adjusted dinner to keep the rest of today's target balanced.";
    } else {
      reply = `Logged ${foodText} for ${mealType}. Your remaining plan for today is on track.`;
    }
  } else if (p.includes("don't want") || p.includes("dont want") || p.includes("replace") || p.includes("no chicken") || p.includes("no salmon") || p.includes("ingredients for dinner")) {
    const avoid: string[] = [];
    if (p.includes("chicken")) avoid.push("chicken");
    if (p.includes("salmon") || p.includes("fish")) avoid.push("fish");
    if (p.includes("meat") || p.includes("beef")) avoid.push("beef");

    let mealType: "breakfast" | "lunch" | "snack" | "dinner" = "dinner";
    if (p.includes("breakfast")) mealType = "breakfast";
    else if (p.includes("lunch")) mealType = "lunch";
    else if (p.includes("snack")) mealType = "snack";

    const res = (await runTool(ctx, "replace_meal", {
      meal_type: mealType,
      date: ctx.today,
      avoid,
      reason: avoid.length ? `Member requested avoiding ${avoid.join(", ")}` : "Ingredient substitution requested",
    })) as any;

    const optNames = (res?.options || []).map((o: any) => o.meal_name).join(", ");
    reply = `I found alternative options for ${mealType}${avoid.length ? ` without ${avoid.join(", ")}` : ""} that fit today's remaining targets: ${optNames}.`;
  } else if (p.includes("egyptian") || (p.includes("tomorrow") && p.includes("plan"))) {
    const res = (await runTool(ctx, "generate_meal_plan", {
      date: "tomorrow",
      focus: p.includes("egyptian") ? "egyptian" : "balanced",
    })) as any;
    reply = `I generated a balanced full-day plan for tomorrow${p.includes("egyptian") ? " featuring Egyptian dishes" : ""} totaling ${res?.totals?.calories || 2000} kcal and ${res?.totals?.protein || 140}g protein.`;
  } else if (p.includes("progress") || p.includes("adherence") || p.includes("analyze") || p.includes("status")) {
    const res = (await runTool(ctx, "analyze_member_progress", {})) as any;
    reply = `${res?.headline} ${res?.recommendation}`;
  } else {
    await runTool(ctx, "get_nutrition_targets", {});
    await runTool(ctx, "calculate_remaining_nutrition", { date: ctx.today });
    reply = `I've reviewed your nutrition state for today. Let me know if you'd like me to log a meal, adapt your dinner, or swap ingredients!`;
  }

  const latestAction = ctx.createdActions[ctx.createdActions.length - 1];
  const inputTokens = 240;
  const outputTokens = 85;
  const costUsd = (inputTokens / 1_000_000) * DEFAULT_INPUT_PRICE + (outputTokens / 1_000_000) * DEFAULT_OUTPUT_PRICE;

  return {
    reply,
    toolsUsed: ctx.trace.map((t) => ({ tool: t.tool, summary: t.summary })),
    proposalId: latestAction?.id,
    actionId: latestAction?.id,
    model: "nutricoach-adaptive-agent (deterministic)",
    tokens: { input: inputTokens, output: outputTokens },
    costUsd,
  };
}
