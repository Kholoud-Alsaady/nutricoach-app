"use client";

import React, { useState } from "react";
import { ArrowUp, Check, ChevronRight, MessageSquare, Plus, Sparkles, Utensils } from "lucide-react";
import { addDays, formatDay } from "@/lib/dates";
import { type AgentActionCard, useNutriCoach } from "./NutriCoachContext";
import type { MealSnapshot, MealType } from "@/lib/types";

interface MealPlanActionCardData {
  icon: string;
  foodName: string;
  targetDayLabel: string;
  targetDate: string;
  dayOffset: number;
  targetSlot: MealType;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  subtext: string;
  confirmed: boolean;
}

interface AssistantMessage {
  id: string;
  sender: "user" | "agent";
  text: string;
  actionCard?: AgentActionCard;
  mealPlanCard?: MealPlanActionCardData;
  pendingConfirmation?: {
    mealName: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    mealType: string;
    targetDate: string;
    isExtraSnack?: boolean;
  };
  time: string;
}

interface KnownFood {
  keywords: string[];
  name: string;
  icon: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  defaultSlot: MealType;
  ingredients: string[];
  tags: string[];
}

const KNOWN_FOODS: KnownFood[] = [
  {
    keywords: ["ice cream", "gelato", "icecream"],
    name: "Vanilla Ice Cream",
    icon: "🍦",
    calories: 250,
    protein: 4,
    carbs: 32,
    fat: 12,
    defaultSlot: "snack",
    ingredients: ["milk", "cream", "sugar", "vanilla extract"],
    tags: ["snack", "sweet", "treat"],
  },
  {
    keywords: ["greek yogurt", "yogurt", "yoghurt", "laban"],
    name: "Greek Yogurt with Mixed Berries & Chia",
    icon: "🥣",
    calories: 340,
    protein: 24,
    carbs: 32,
    fat: 8,
    defaultSlot: "breakfast",
    ingredients: ["greek yogurt", "blueberries", "strawberries", "chia seeds"],
    tags: ["breakfast", "high-protein", "dairy"],
  },
  {
    keywords: ["protein bar", "chocolate bar", "energy bar"],
    name: "Double Chocolate Protein Bar",
    icon: "🍫",
    calories: 220,
    protein: 20,
    carbs: 22,
    fat: 6,
    defaultSlot: "snack",
    ingredients: ["whey protein isolate", "cocoa", "almonds", "dates"],
    tags: ["snack", "high-protein"],
  },
  {
    keywords: ["pudding", "chocolate pudding", "custard"],
    name: "Dark Chocolate Protein Pudding",
    icon: "🍮",
    calories: 240,
    protein: 16,
    carbs: 28,
    fat: 6,
    defaultSlot: "snack",
    ingredients: ["skim milk", "cocoa", "casein protein", "stevia"],
    tags: ["snack", "dessert"],
  },
  {
    keywords: ["salmon", "seared salmon", "grilled salmon"],
    name: "Seared Salmon with Quinoa & Asparagus",
    icon: "🐟",
    calories: 540,
    protein: 42,
    carbs: 35,
    fat: 22,
    defaultSlot: "dinner",
    ingredients: ["salmon fillet", "quinoa", "asparagus", "lemon", "olive oil"],
    tags: ["dinner", "pescatarian", "omega-3"],
  },
  {
    keywords: ["sea bass", "fish", "tuna", "tilapia"],
    name: "Grilled Sea Bass with Brown Rice & Tahini",
    icon: "🐠",
    calories: 480,
    protein: 44,
    carbs: 40,
    fat: 14,
    defaultSlot: "dinner",
    ingredients: ["sea bass", "brown rice", "tahini", "lemon", "cumin"],
    tags: ["dinner", "egyptian", "pescatarian"],
  },
  {
    keywords: ["chicken rice", "chicken breast", "chicken", "shish taouk"],
    name: "Grilled Chicken Breast with Jasmine Rice",
    icon: "🍗",
    calories: 520,
    protein: 45,
    carbs: 55,
    fat: 12,
    defaultSlot: "lunch",
    ingredients: ["chicken breast", "jasmine rice", "steamed broccoli", "olive oil"],
    tags: ["lunch", "high-protein", "lean"],
  },
  {
    keywords: ["ful", "ful medames", "foul"],
    name: "Ful Medames with Boiled Eggs & Cumin Tahini",
    icon: "🧆",
    calories: 450,
    protein: 28,
    carbs: 52,
    fat: 14,
    defaultSlot: "breakfast",
    ingredients: ["fava beans", "eggs", "baladi bread", "tahini", "cumin"],
    tags: ["breakfast", "egyptian", "vegetarian"],
  },
  {
    keywords: ["koshary", "kushari"],
    name: "Authentic Egyptian Koshary with Dukkah",
    icon: "🍲",
    calories: 650,
    protein: 18,
    carbs: 115,
    fat: 12,
    defaultSlot: "lunch",
    ingredients: ["rice", "lentils", "pasta", "chickpeas", "crispy onions", "spiced tomato sauce"],
    tags: ["lunch", "egyptian", "high-carb"],
  },
  {
    keywords: ["pizza"],
    name: "Artisan Neapolitan Pizza (2 Slices)",
    icon: "🍕",
    calories: 680,
    protein: 28,
    carbs: 75,
    fat: 28,
    defaultSlot: "lunch",
    ingredients: ["flour crust", "mozzarella", "tomato sauce", "basil", "olive oil"],
    tags: ["lunch", "italian"],
  },
  {
    keywords: ["burger", "cheeseburger"],
    name: "Lean Beef Burger with Sweet Potato Wedges",
    icon: "🍔",
    calories: 620,
    protein: 38,
    carbs: 50,
    fat: 26,
    defaultSlot: "lunch",
    ingredients: ["lean beef patty", "whole grain bun", "sweet potato", "lettuce", "tomato"],
    tags: ["lunch", "high-protein"],
  },
  {
    keywords: ["shake", "protein shake", "whey", "smoothie"],
    name: "Whey Isolate Protein Shake with Banana",
    icon: "🥤",
    calories: 240,
    protein: 30,
    carbs: 22,
    fat: 3,
    defaultSlot: "snack",
    ingredients: ["whey isolate", "almond milk", "banana"],
    tags: ["snack", "post-workout"],
  },
  {
    keywords: ["apple", "banana", "fruit", "berries", "orange"],
    name: "Fresh Seasonal Fruit Bowl",
    icon: "🍎",
    calories: 140,
    protein: 2,
    carbs: 34,
    fat: 0,
    defaultSlot: "snack",
    ingredients: ["apple", "banana", "strawberries"],
    tags: ["snack", "fruit", "clean"],
  },
  {
    keywords: ["egg", "eggs", "omelet", "scramble"],
    name: "Egg White & Spinach Omelet with Baladi Toast",
    icon: "🍳",
    calories: 380,
    protein: 30,
    carbs: 28,
    fat: 14,
    defaultSlot: "breakfast",
    ingredients: ["whole eggs", "egg whites", "spinach", "baladi bread", "olive oil"],
    tags: ["breakfast", "high-protein"],
  },
  {
    keywords: ["salad", "tuna salad", "greek salad"],
    name: "Mediterranean Tuna Garden Salad",
    icon: "🥗",
    calories: 320,
    protein: 32,
    carbs: 14,
    fat: 14,
    defaultSlot: "lunch",
    ingredients: ["solid tuna in water", "cucumbers", "tomatoes", "olives", "feta", "olive oil"],
    tags: ["lunch", "salad", "keto-friendly"],
  },
];

export function AskNutriCoachPanel() {
  const {
    state,
    confirmAddMeal,
    replaceMealSlot,
    replaceMeal,
    logMeal,
    todayRemainingMacros,
    setActiveTab,
    setSelectedPlanDayOffset,
  } = useNutriCoach();

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const [aiMessages, setAiMessages] = useState<AssistantMessage[]>([
    {
      id: "ai-init-1",
      sender: "agent",
      text: "Hello! I'm NutriCoach, your adaptive nutrition AI assistant. Ask me to adjust foods, modify tomorrow's plan, calculate macros, or rebalance your daily targets.",
      time: "Online",
    },
  ]);

  const quickPrompts = [
    "I want to eat ice cream tomorrow",
    "Change tomorrow's snack to Greek yogurt",
    "I don't have chicken tonight",
    "Create tomorrow's plan using Egyptian foods",
  ];

  // Intent parsing helper
  const parseIntent = (prompt: string) => {
    const p = prompt.toLowerCase();

    // 1. Target Day
    let dayOffset = 0;
    let dayLabel = "Today";
    if (p.includes("tomorrow") || p.includes("tmrw")) {
      dayOffset = 1;
      dayLabel = "Tomorrow";
    } else if (p.includes("day after tomorrow") || p.includes("in 2 days")) {
      dayOffset = 2;
      dayLabel = "Day After Tomorrow";
    } else if (p.includes("today") || p.includes("tonight")) {
      dayOffset = 0;
      dayLabel = "Today";
    } else {
      // Default to tomorrow if user mentions wanting to plan or change a future slot
      dayOffset = p.includes("breakfast") || p.includes("plan") || p.includes("eat") ? 1 : 0;
      dayLabel = dayOffset === 1 ? "Tomorrow" : "Today";
    }
    const targetDate = addDays(state.today, dayOffset);

    // 2. Target Slot
    let targetSlot: MealType = "snack";
    if (p.includes("breakfast") || p.includes("morning")) {
      targetSlot = "breakfast";
    } else if (p.includes("lunch") || p.includes("afternoon")) {
      targetSlot = "lunch";
    } else if (p.includes("snack") || p.includes("treat") || p.includes("dessert")) {
      targetSlot = "snack";
    } else if (p.includes("dinner") || p.includes("evening") || p.includes("night")) {
      targetSlot = "dinner";
    }

    // 3. Food item matching
    let matchedFood: KnownFood | null = null;
    for (const food of KNOWN_FOODS) {
      if (food.keywords.some((kw) => p.includes(kw))) {
        matchedFood = food;
        break;
      }
    }

    // If slot was not explicitly specified, use food's default slot
    if (!p.includes("breakfast") && !p.includes("lunch") && !p.includes("snack") && !p.includes("dinner") && matchedFood) {
      targetSlot = matchedFood.defaultSlot;
    }

    return {
      dayOffset,
      dayLabel,
      targetDate,
      targetSlot,
      matchedFood,
    };
  };

  const handleSend = async (promptText?: string) => {
    const text = promptText || input;
    if (!text.trim() || loading) return;

    const userMsg: AssistantMessage = {
      id: `usr-${Date.now()}`,
      sender: "user",
      text,
      time: "Just now",
    };

    setAiMessages((prev) => [...prev, userMsg]);
    if (!promptText) setInput("");
    setLoading(true);

    const p = text.toLowerCase();

    setTimeout(() => {
      let reply = "";
      let actionCard: AgentActionCard | undefined;
      let mealPlanCard: MealPlanActionCardData | undefined;
      let pendingConfirmation: AssistantMessage["pendingConfirmation"];

      const intent = parseIntent(text);

      // Handle specific intent flows
      if (intent.matchedFood) {
        const food = intent.matchedFood;
        const slotTitle = intent.targetSlot.charAt(0).toUpperCase() + intent.targetSlot.slice(1);

        reply = `I've prepared ${intent.dayLabel}'s ${slotTitle} with ${food.name} (~${food.calories} kcal). Dinner will be automatically adjusted to keep your daily target perfectly balanced.`;

        mealPlanCard = {
          icon: food.icon,
          foodName: food.name,
          targetDayLabel: intent.dayLabel,
          targetDate: intent.targetDate,
          dayOffset: intent.dayOffset,
          targetSlot: intent.targetSlot,
          calories: food.calories,
          protein: food.protein,
          carbs: food.carbs,
          fat: food.fat,
          subtext: `Dinner adjusted to keep ${intent.dayLabel.toLowerCase()} balanced.`,
          confirmed: false,
        };
      } else if (p.includes("chicken") || p.includes("replace") || p.includes("don't have") || p.includes("dont have") || p.includes("no chicken")) {
        const avoid = p.includes("chicken") || p.includes("no chicken") || p.includes("don't have chicken") ? ["chicken"] : [];
        replaceMeal({ mealType: "dinner", avoid, reason: "Member ingredient preference" });
        reply = `I found 3 high-protein dinner alternatives without ${avoid.join(", ") || "chicken"}. You can preview and choose your favorite.`;
        actionCard = {
          type: "plan_updated",
          title: "Dinner Alternatives Ready",
          details: "3 high-protein options ready for selection",
          actionLabel: "Review Alternatives",
          targetTab: "today",
        };
      } else if (p.includes("egyptian") || p.includes("full plan")) {
        // Prepare Egyptian plan for tomorrow
        const fulMedames = KNOWN_FOODS.find((f) => f.keywords.includes("ful"))!;
        const chickenRice = KNOWN_FOODS.find((f) => f.keywords.includes("chicken rice"))!;
        const yogurt = KNOWN_FOODS.find((f) => f.keywords.includes("greek yogurt"))!;
        const seaBass = KNOWN_FOODS.find((f) => f.keywords.includes("sea bass"))!;

        const tomorrowDate = addDays(state.today, 1);
        replaceMealSlot({ mealType: "breakfast", date: tomorrowDate, meal: { meal_name: fulMedames.name, calories: fulMedames.calories, protein: fulMedames.protein, carbs: fulMedames.carbs, fat: fulMedames.fat, ingredients: fulMedames.ingredients, tags: fulMedames.tags }, source: "agent", rebalanceDinner: false });
        replaceMealSlot({ mealType: "lunch", date: tomorrowDate, meal: { meal_name: chickenRice.name, calories: chickenRice.calories, protein: chickenRice.protein, carbs: chickenRice.carbs, fat: chickenRice.fat, ingredients: chickenRice.ingredients, tags: chickenRice.tags }, source: "agent", rebalanceDinner: false });
        replaceMealSlot({ mealType: "snack", date: tomorrowDate, meal: { meal_name: yogurt.name, calories: yogurt.calories, protein: yogurt.protein, carbs: yogurt.carbs, fat: yogurt.fat, ingredients: yogurt.ingredients, tags: yogurt.tags }, source: "agent", rebalanceDinner: false });
        replaceMealSlot({ mealType: "dinner", date: tomorrowDate, meal: { meal_name: seaBass.name, calories: seaBass.calories, protein: seaBass.protein, carbs: seaBass.carbs, fat: seaBass.fat, ingredients: seaBass.ingredients, tags: seaBass.tags }, source: "agent", rebalanceDinner: false });

        reply = `I've updated Tomorrow's full plan with authentic Egyptian favorites (Ful & eggs, Grilled chicken with jasmine rice, Greek yogurt, and Grilled sea bass) calibrated to your calorie goal.`;
        actionCard = {
          type: "plan_updated",
          title: "Tomorrow's Egyptian Plan Applied",
          details: "4 authentic Egyptian meals configured",
          actionLabel: "View in Meal Plan",
          targetTab: "plan",
        };
      } else if (p.includes("ate ") || p.includes("logged") || p.includes("had ")) {
        logMeal({ mealName: "Logged Meal", mealType: "lunch", notes: "Logged via Ask NutriCoach" });
        reply = `I've logged that for your lunch and rebalanced your remaining daily dinner targets accordingly.`;
        actionCard = {
          type: "logged",
          title: "Meal Logged & Rebalanced",
          details: "Lunch logged · Dinner adapted",
          actionLabel: "View Today's Meals",
          targetTab: "today",
        };
      } else {
        reply = `You have ${todayRemainingMacros.calories} kcal and ${todayRemainingMacros.protein}g protein remaining today. Let me know if you'd like to eat a specific item (e.g. ice cream, Greek yogurt, salmon), replace a meal, or adapt tomorrow's plan!`;
      }

      const agentReplyMsg: AssistantMessage = {
        id: `ai-${Date.now()}`,
        sender: "agent",
        text: reply,
        actionCard,
        mealPlanCard,
        pendingConfirmation,
        time: "Just now",
      };

      setAiMessages((prev) => [...prev, agentReplyMsg]);
      setLoading(false);
    }, 350);
  };

  // State mutation handler for interactive Meal Plan confirmation card
  const handleApplyMealPlanCard = (msgId: string, card: MealPlanActionCardData) => {
    // 1. Mutate application meal plan state with auto-dinner rebalance
    replaceMealSlot({
      mealType: card.targetSlot,
      date: card.targetDate,
      meal: {
        meal_name: card.foodName,
        calories: card.calories,
        protein: card.protein,
        carbs: card.carbs,
        fat: card.fat,
        ingredients: [card.foodName.toLowerCase()],
        tags: [card.targetSlot, "agent", "rebalanced"],
      },
      source: "agent",
      rebalanceDinner: true,
    });

    // 2. Mark card as confirmed in message stream
    setAiMessages((prev) =>
      prev.map((m) =>
        m.id === msgId && m.mealPlanCard
          ? { ...m, mealPlanCard: { ...m.mealPlanCard, confirmed: true } }
          : m
      )
    );
  };

  // Switch to Meal Plan tab and navigate directly to target day
  const handleViewInMealPlan = (dayOffset: number) => {
    setSelectedPlanDayOffset(dayOffset);
    setActiveTab("plan");
  };

  const handleConfirmAdd = (
    conf: NonNullable<AssistantMessage["pendingConfirmation"]>,
    choice: "today" | "tomorrow"
  ) => {
    const targetDate = choice === "today" ? state.today : addDays(state.today, 1);
    confirmAddMeal({
      mealName: conf.mealName,
      calories: conf.calories,
      protein: conf.protein,
      carbs: conf.carbs,
      fat: conf.fat,
      mealType: conf.mealType,
      targetDate,
      asLogged: choice === "today",
    });

    setAiMessages((prev) => [
      ...prev,
      {
        id: `ai-conf-${Date.now()}`,
        sender: "agent",
        text: `Done! Added ${conf.mealName} (${conf.calories} kcal) to ${choice === "today" ? "Today" : "Tomorrow"}'s meal stream.`,
        time: "Just now",
      },
    ]);
  };

  return (
    <aside className="w-[340px] shrink-0 border-l border-border bg-canvas flex flex-col justify-between h-screen sticky top-0 px-4 py-5 select-none">
      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-brand-tint text-brand flex items-center justify-center font-medium">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-ink-primary">Ask NutriCoach</h3>
              <p className="text-[10px] text-ink-muted">Personal Nutrition Assistant</p>
            </div>
          </div>
          <span className="text-[10px] text-brand bg-brand-tint px-2 py-0.5 rounded font-medium border border-[#D5E6D2] flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-brand" />
            Online
          </span>
        </div>

        {/* Quick Suggestion Pills */}
        <div className="space-y-1.5">
          <div className="text-[10px] font-medium text-ink-muted uppercase tracking-wider">
            Suggested Prompts
          </div>
          <div className="flex flex-col gap-1">
            {quickPrompts.map((p) => (
              <button
                key={p}
                onClick={() => handleSend(p)}
                className="text-[11px] bg-surface hover:bg-surface-subtle text-ink-secondary hover:text-ink-primary px-2.5 py-1.5 rounded-md border border-border hover:border-brand/40 transition-colors text-left truncate"
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Messages Stream */}
      <div className="flex-1 overflow-y-auto my-3 space-y-2.5 pr-1 text-xs">
        {aiMessages.map((m, idx) => {
          const isUser = m.sender === "user";

          return (
            <div
              key={m.id || idx}
              className={`p-3 rounded-lg border text-xs leading-relaxed space-y-2 ${
                isUser
                  ? "bg-surface text-ink-primary border-border ml-4 shadow-hairline"
                  : "bg-[#FAFBF9] text-ink-primary border-border mr-2 shadow-hairline"
              }`}
            >
              <div className="flex items-center justify-between text-[10px] text-ink-muted">
                <span className="font-semibold text-ink-primary">
                  {isUser ? "You" : "NutriCoach"}
                </span>
                <span>{m.time}</span>
              </div>

              <p className="text-xs text-ink-secondary leading-relaxed">{m.text}</p>

              {/* Interactive Meal Plan Confirmation Action Card */}
              {m.mealPlanCard && (
                <div className="bg-surface rounded-lg border border-border p-3 space-y-2 mt-2 shadow-hairline">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{m.mealPlanCard.icon}</span>
                      <div>
                        <div className="font-semibold text-xs text-ink-primary">
                          {m.mealPlanCard.targetDayLabel}&apos;s {m.mealPlanCard.targetSlot.charAt(0).toUpperCase() + m.mealPlanCard.targetSlot.slice(1)}: {m.mealPlanCard.foodName}
                        </div>
                        <div className="text-[10px] text-brand font-medium">
                          ~{m.mealPlanCard.calories} kcal ({m.mealPlanCard.protein}g P · {m.mealPlanCard.carbs}g C · {m.mealPlanCard.fat}g F)
                        </div>
                      </div>
                    </div>
                  </div>

                  <p className="text-[11px] text-ink-muted">
                    {m.mealPlanCard.subtext}
                  </p>

                  <div className="pt-1.5 flex items-center justify-between gap-2 border-t border-border/60">
                    {!m.mealPlanCard.confirmed ? (
                      <button
                        onClick={() => handleApplyMealPlanCard(m.id, m.mealPlanCard!)}
                        className="w-full text-xs font-semibold text-white bg-brand hover:bg-brand-hover px-3 py-1.5 rounded-md shadow-hairline transition-colors flex items-center justify-center gap-1.5"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Confirm & Apply to Plan</span>
                      </button>
                    ) : (
                      <div className="w-full flex items-center justify-between gap-2">
                        <span className="text-[11px] text-brand font-medium flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" />
                          <span>Applied to Plan</span>
                        </span>
                        <button
                          onClick={() => handleViewInMealPlan(m.mealPlanCard!.dayOffset)}
                          className="text-xs font-medium text-ink-primary hover:text-brand bg-surface-subtle hover:bg-surface px-2.5 py-1 rounded border border-border transition-colors flex items-center gap-1"
                        >
                          <span>View in Meal Plan</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Conversational Verification Card */}
              {m.pendingConfirmation && (
                <div className="bg-surface rounded-md border border-border p-3 space-y-2 mt-2 shadow-hairline">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-ink-primary">
                      {m.pendingConfirmation.mealName}
                    </span>
                    <span className="text-[10px] text-brand font-semibold">
                      {m.pendingConfirmation.calories} kcal
                    </span>
                  </div>

                  <div className="text-[10px] text-ink-muted">
                    {m.pendingConfirmation.protein}g Protein · {m.pendingConfirmation.carbs}g Carbs · {m.pendingConfirmation.fat}g Fat
                  </div>

                  <div className="pt-1 flex items-center justify-end gap-2">
                    <button
                      onClick={() => handleConfirmAdd(m.pendingConfirmation!, "today")}
                      className="text-xs font-medium text-white bg-brand hover:bg-brand-hover px-3 py-1.5 rounded shadow-hairline transition-colors flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add to Today</span>
                    </button>
                    <button
                      onClick={() => handleConfirmAdd(m.pendingConfirmation!, "tomorrow")}
                      className="text-xs text-ink-secondary hover:text-ink-primary bg-surface-subtle hover:bg-surface px-2.5 py-1.5 rounded border border-border transition-colors"
                    >
                      Schedule for Tomorrow
                    </button>
                  </div>
                </div>
              )}

              {/* Standard Inline Action Card */}
              {m.actionCard && (
                <div className="bg-surface rounded-md border border-border p-2.5 space-y-1.5 mt-2 shadow-hairline">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-[11px] text-ink-primary">{m.actionCard.title}</span>
                    <span className="text-[10px] text-brand font-medium">Ready</span>
                  </div>
                  <p className="text-[11px] text-ink-muted">{m.actionCard.details}</p>

                  {m.actionCard.targetTab && (
                    <div className="pt-1 flex items-center justify-end">
                      <button
                        onClick={() => {
                          if (m.actionCard!.targetTab === "plan") {
                            setSelectedPlanDayOffset(1);
                          }
                          setActiveTab(m.actionCard!.targetTab!);
                        }}
                        className="text-xs font-medium text-ink-primary hover:text-brand bg-surface-subtle hover:bg-surface px-2.5 py-1 rounded border border-border transition-colors flex items-center gap-1"
                      >
                        <span>{m.actionCard.actionLabel}</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {loading && (
          <div className="p-2.5 rounded-lg bg-surface border border-border text-xs text-ink-muted animate-pulse flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-brand" />
            <span>NutriCoach is personalizing your recommendation...</span>
          </div>
        )}
      </div>

      {/* Input Box */}
      <div className="relative pt-2 border-t border-border">
        <input
          type="text"
          placeholder="Ask NutriCoach or describe what you'd like to eat..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          className="w-full text-xs bg-surface border border-border rounded-lg pl-3 pr-8 py-2 text-ink-primary focus:outline-none focus:border-brand shadow-hairline"
        />
        <button
          onClick={() => handleSend()}
          disabled={!input.trim() || loading}
          className="absolute right-1.5 top-3.5 w-6 h-6 rounded bg-brand text-white flex items-center justify-center disabled:opacity-40 hover:bg-brand-hover transition-colors shadow-hairline"
        >
          <ArrowUp className="w-3.5 h-3.5" />
        </button>
      </div>
    </aside>
  );
}




