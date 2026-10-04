"use client";

import React, { useState } from "react";
import { ArrowUp, Check, ChevronRight, MessageSquare, Plus, RefreshCw, Sparkles, Utensils, X } from "lucide-react";
import { addDays, formatDay } from "@/lib/dates";
import { useNutriCoach } from "./NutriCoachContext";
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

interface AlternativesCardData {
  title: string;
  details: string;
  targetDayLabel: string;
  targetDate: string;
  dayOffset: number;
  targetSlot: MealType;
  options: MealSnapshot[];
  selectedMealName?: string;
}

interface DayClarificationData {
  originalPrompt: string;
  intentType: "replace_slot" | "specific_food";
  targetSlot: MealType;
  matchedFood?: KnownFood | null;
  avoid?: string[];
}

interface ExclusionPromptData {
  term: string;
  slot: MealType;
  dayOffset: number;
  dayLabel: string;
  targetDate: string;
  isAllergy: boolean;
  matchedFood?: KnownFood | null;
  safeAlternativeDesc: string;
}

interface AssistantMessage {
  id: string;
  sender: "user" | "agent";
  text: string;
  mealPlanCard?: MealPlanActionCardData;
  alternativesCard?: AlternativesCardData;
  dayClarification?: DayClarificationData;
  exclusionPrompt?: ExclusionPromptData;
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

interface ReviewModalState {
  targetDayLabel: string;
  targetDate: string;
  dayOffset: number;
  targetSlot: MealType;
  options: MealSnapshot[];
  msgId: string;
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

// Curated Alternatives Generator for each meal slot respecting exclusions & allergies
function getSlotAlternatives(
  slot: MealType,
  avoid: string[] = [],
  profileDislikes: string[] = [],
  profileAllergies: string[] = []
): MealSnapshot[] {
  const allAvoid = [...avoid, ...profileDislikes, ...profileAllergies].map((s) => s.toLowerCase());

  const isBlocked = (item: MealSnapshot) => {
    const text = (item.meal_name + " " + item.ingredients.join(" ") + " " + item.tags.join(" ")).toLowerCase();
    return allAvoid.some((a) => {
      const clean = a.replace(/^(no\s+|allergy:?\s*)/i, "").trim();
      if (!clean) return false;
      if (clean.includes("chicken") && text.includes("chicken")) return true;
      if (clean.includes("peanut") && (text.includes("peanut") || text.includes("nuts") || text.includes("almond"))) return true;
      if (clean.includes("dairy") && (text.includes("dairy") || text.includes("cheese") || text.includes("yogurt") || text.includes("whey") || text.includes("milk"))) return true;
      if (clean.includes("red meat") && (text.includes("beef") || text.includes("steak") || text.includes("kofta") || text.includes("burger"))) return true;
      if (clean.includes("gluten") && (text.includes("pasta") || text.includes("bread") || text.includes("toast") || text.includes("flour") || text.includes("wheat") || text.includes("freekeh"))) return true;
      if (clean.includes("shellfish") && (text.includes("shellfish") || text.includes("shrimp") || text.includes("prawn"))) return true;
      if (clean.includes("vegetarian") && !item.tags.includes("vegetarian")) return true;
      if (clean.includes("pescatarian") && !item.tags.includes("pescatarian") && !item.tags.includes("vegetarian") && !item.tags.includes("fish")) return true;
      return text.includes(clean);
    });
  };

  const pool: Record<MealType, MealSnapshot[]> = {
    breakfast: [
      {
        meal_name: "Greek yogurt, oats & honey bowl",
        calories: 420,
        protein: 30,
        carbs: 55,
        fat: 9,
        ingredients: ["greek yogurt", "oats", "honey", "banana"],
        tags: ["dairy", "vegetarian", "high-protein"],
      },
      {
        meal_name: "Ful medames with eggs & baladi bread",
        calories: 450,
        protein: 28,
        carbs: 52,
        fat: 14,
        ingredients: ["fava beans", "2 eggs", "baladi bread", "olive oil", "cumin"],
        tags: ["egyptian", "eggs", "high-fiber"],
      },
      {
        meal_name: "Egg-white omelette with light cheese & toast",
        calories: 380,
        protein: 34,
        carbs: 35,
        fat: 12,
        ingredients: ["egg whites", "1 egg", "light cheese", "wholewheat toast", "spinach"],
        tags: ["eggs", "lean", "high-protein"],
      },
      {
        meal_name: "Areesh cheese plate with tomatoes & olive oil",
        calories: 350,
        protein: 26,
        carbs: 30,
        fat: 12,
        ingredients: ["areesh cheese", "tomatoes", "cucumbers", "olive oil", "baladi bread"],
        tags: ["egyptian", "dairy", "vegetarian"],
      },
      {
        meal_name: "Overnight chia & oat bowl with fresh berries",
        calories: 360,
        protein: 20,
        carbs: 50,
        fat: 8,
        ingredients: ["oats", "chia seeds", "berries", "plant milk", "cinnamon"],
        tags: ["vegan", "dairy-free", "high-fiber"],
      },
    ],
    lunch: [
      {
        meal_name: "Grilled chicken breast with jasmine rice & salad",
        calories: 520,
        protein: 48,
        carbs: 55,
        fat: 12,
        ingredients: ["chicken breast", "jasmine rice", "green salad", "olive oil"],
        tags: ["chicken", "lean", "high-protein"],
      },
      {
        meal_name: "Grilled tilapia (bolti) with rice & salad",
        calories: 480,
        protein: 44,
        carbs: 55,
        fat: 10,
        ingredients: ["tilapia", "sayadeya rice", "salad", "lemon"],
        tags: ["fish", "egyptian", "pescatarian"],
      },
      {
        meal_name: "Mediterranean tuna pasta salad",
        calories: 490,
        protein: 38,
        carbs: 58,
        fat: 12,
        ingredients: ["tuna in water", "wholewheat pasta", "corn", "light mayo", "greens"],
        tags: ["fish", "tuna", "omega-3"],
      },
      {
        meal_name: "Lean beef kofta with freekeh & tahini salad",
        calories: 540,
        protein: 38,
        carbs: 52,
        fat: 18,
        ingredients: ["lean beef kofta", "freekeh", "tahini", "salad"],
        tags: ["beef", "egyptian", "high-protein"],
      },
      {
        meal_name: "Tofu & vegetable stir-fry with jasmine rice",
        calories: 460,
        protein: 32,
        carbs: 56,
        fat: 12,
        ingredients: ["firm tofu", "bell peppers", "edamame", "jasmine rice", "sesame oil"],
        tags: ["vegan", "plant-protein", "dairy-free"],
      },
    ],
    dinner: [
      {
        meal_name: "Seared salmon with sweet potato & steamed broccoli",
        calories: 530,
        protein: 40,
        carbs: 45,
        fat: 22,
        ingredients: ["salmon fillet", "sweet potato", "broccoli", "lemon"],
        tags: ["fish", "salmon", "omega-3", "pescatarian"],
      },
      {
        meal_name: "Grilled sea bass with brown rice & tahini",
        calories: 480,
        protein: 44,
        carbs: 40,
        fat: 14,
        ingredients: ["sea bass", "brown rice", "tahini", "greens"],
        tags: ["fish", "pescatarian", "egyptian"],
      },
      {
        meal_name: "Lean beef stir-fry with jasmine rice & broccoli",
        calories: 510,
        protein: 42,
        carbs: 48,
        fat: 15,
        ingredients: ["lean beef strips", "jasmine rice", "broccoli", "soy sauce"],
        tags: ["beef", "high-protein"],
      },
      {
        meal_name: "Tofu & vegetable stir-fry with jasmine rice",
        calories: 460,
        protein: 32,
        carbs: 56,
        fat: 12,
        ingredients: ["firm tofu", "bell peppers", "edamame", "jasmine rice", "sesame oil"],
        tags: ["vegan", "plant-protein", "dairy-free"],
      },
    ],
    snack: [
      {
        meal_name: "Greek yogurt with mixed berries & chia",
        calories: 210,
        protein: 20,
        carbs: 24,
        fat: 4,
        ingredients: ["greek yogurt", "blueberries", "chia seeds"],
        tags: ["dairy", "snack", "nut-free"],
      },
      {
        meal_name: "Fresh seasonal fruit bowl with pumpkin seeds",
        calories: 180,
        protein: 6,
        carbs: 32,
        fat: 5,
        ingredients: ["apple", "strawberries", "banana", "pumpkin seeds"],
        tags: ["snack", "nut-free", "dairy-free", "vegan"],
      },
      {
        meal_name: "Hard boiled eggs & sliced cucumber",
        calories: 160,
        protein: 14,
        carbs: 4,
        fat: 10,
        ingredients: ["2 eggs", "cucumber", "sea salt"],
        tags: ["snack", "eggs", "keto-friendly", "dairy-free", "nut-free"],
      },
      {
        meal_name: "Whey isolate protein shake with banana",
        calories: 240,
        protein: 30,
        carbs: 22,
        fat: 3,
        ingredients: ["whey protein", "banana", "water"],
        tags: ["snack", "post-workout", "nut-free"],
      },
      {
        meal_name: "Double chocolate protein bar",
        calories: 220,
        protein: 20,
        carbs: 22,
        fat: 6,
        ingredients: ["whey isolate", "cocoa", "almonds"],
        tags: ["snack", "high-protein"],
      },
    ],
  };

  const slotCandidates = pool[slot] || pool.snack;
  const filtered = slotCandidates.filter((m) => !isBlocked(m));
  return filtered.length >= 2 ? filtered.slice(0, 3) : slotCandidates.slice(0, 3);
}

function findExcludedMatch(
  prompt: string,
  profileDislikes: string[] = [],
  profileAllergies: string[] = []
): { isExcluded: boolean; term: string; isAllergy: boolean } | null {
  const p = prompt.toLowerCase();

  // 1. Check allergies first (critical guardrails)
  for (const allergy of profileAllergies) {
    const aLower = allergy.toLowerCase();
    const cleanAllergy = aLower.replace(/allergy|intolerance|\/|celiac/gi, "").trim();
    if (
      (cleanAllergy && p.includes(cleanAllergy)) ||
      (aLower.includes("peanut") && (p.includes("peanut") || p.includes("nuts") || p.includes("nut"))) ||
      (aLower.includes("lactose") && (p.includes("dairy") || p.includes("lactose") || p.includes("milk") || p.includes("cheese") || p.includes("yogurt"))) ||
      (aLower.includes("gluten") && (p.includes("gluten") || p.includes("bread") || p.includes("pasta") || p.includes("wheat") || p.includes("toast"))) ||
      (aLower.includes("shellfish") && (p.includes("shellfish") || p.includes("shrimp") || p.includes("prawn")))
    ) {
      return { isExcluded: true, term: allergy, isAllergy: true };
    }
  }

  // 2. Check disliked foods / exclusions
  for (const dislike of profileDislikes) {
    const dLower = dislike.toLowerCase();
    const cleanDislike = dLower.replace(/^no\s+/i, "").trim();
    if (
      (cleanDislike && p.includes(cleanDislike)) ||
      (dLower.includes("chicken") && (p.includes("chicken") || p.includes("poultry") || p.includes("wings"))) ||
      (dLower.includes("red meat") && (p.includes("red meat") || p.includes("beef") || p.includes("steak") || p.includes("kofta") || p.includes("burger"))) ||
      (dLower.includes("dairy") && (p.includes("dairy") || p.includes("milk") || p.includes("cheese") || p.includes("yogurt"))) ||
      (dLower.includes("pescatarian") && (p.includes("chicken") || p.includes("beef") || p.includes("meat"))) ||
      (dLower.includes("vegetarian") && (p.includes("chicken") || p.includes("beef") || p.includes("meat") || p.includes("fish") || p.includes("seafood")))
    ) {
      return { isExcluded: true, term: dislike, isAllergy: false };
    }
  }

  return null;
}

export function AskNutriCoachPanel() {
  const {
    state,
    activeProfile,
    confirmAddMeal,
    replaceMealSlot,
    logMeal,
    todayMealLogs,
    todayRemainingMacros,
    setActiveTab,
    setSelectedPlanDayOffset,
  } = useNutriCoach();

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [reviewModal, setReviewModal] = useState<ReviewModalState | null>(null);

  const [aiMessages, setAiMessages] = useState<AssistantMessage[]>([
    {
      id: "ai-init-1",
      sender: "agent",
      text: "Hello! I'm NutriCoach, your adaptive nutrition AI assistant. Ask me to adjust meals, swap tomorrow's breakfast, calculate macros, or rebalance your daily targets.",
      time: "Online",
    },
  ]);

  const quickPrompts = [
    "Replace tomorrow's breakfast",
    "I want to eat ice cream tomorrow",
    "Change tomorrow's snack to Greek yogurt",
    "I don't have chicken tonight",
    "Create tomorrow's plan using Egyptian foods",
  ];

  // Robust Intent Parsing Engine
  const parseIntent = (prompt: string) => {
    const p = prompt.toLowerCase();

    // 1. Target Day Extraction
    let dayOffset = 0;
    let dayLabel = "Today";
    let isAmbiguousDay = false;

    if (p.includes("tomorrow") || p.includes("tmrw")) {
      dayOffset = 1;
      dayLabel = "Tomorrow";
    } else if (p.includes("day after tomorrow") || p.includes("in 2 days")) {
      dayOffset = 2;
      dayLabel = "Day After Tomorrow";
    } else if (p.includes("today") || p.includes("tonight") || p.includes("this morning") || p.includes("this evening")) {
      dayOffset = 0;
      dayLabel = "Today";
    } else {
      isAmbiguousDay = true;
    }
    const targetDate = addDays(state.today, dayOffset);

    // 2. Target Slot Extraction
    let targetSlot: MealType = "snack";
    let slotSpecified = false;

    if (p.includes("breakfast") || p.includes("morning")) {
      targetSlot = "breakfast";
      slotSpecified = true;
    } else if (p.includes("lunch") || p.includes("afternoon")) {
      targetSlot = "lunch";
      slotSpecified = true;
    } else if (p.includes("snack") || p.includes("treat") || p.includes("dessert")) {
      targetSlot = "snack";
      slotSpecified = true;
    } else if (p.includes("dinner") || p.includes("evening") || p.includes("night") || p.includes("supper")) {
      targetSlot = "dinner";
      slotSpecified = true;
    }

    // 3. Avoid ingredient extraction
    const avoid: string[] = [];
    if (p.includes("no chicken") || p.includes("don't have chicken") || p.includes("dont have chicken") || p.includes("without chicken")) {
      avoid.push("chicken");
    }
    if (p.includes("no fish") || p.includes("no seafood")) {
      avoid.push("fish");
    }
    if (p.includes("no dairy") || p.includes("lactose")) {
      avoid.push("dairy");
    }

    // 4. Food item matching
    let matchedFood: KnownFood | null = null;
    for (const food of KNOWN_FOODS) {
      if (food.keywords.some((kw) => p.includes(kw))) {
        matchedFood = food;
        break;
      }
    }

    // If slot wasn't explicitly stated, use food's default slot
    if (!slotSpecified && matchedFood) {
      targetSlot = matchedFood.defaultSlot;
    }

    // 5. Intent Type
    let intentType: "replace_slot" | "specific_food" | "full_plan" | "log_meal" | "general" = "general";
    if (p.includes("egyptian") || p.includes("full plan")) {
      intentType = "full_plan";
    } else if (p.includes("ate ") || p.includes("logged") || p.includes("had ")) {
      intentType = "log_meal";
    } else if (p.includes("replace") || p.includes("swap") || p.includes("don't have") || p.includes("dont have") || p.includes("change to another") || p.includes("alternatives")) {
      intentType = "replace_slot";
    } else if (matchedFood) {
      intentType = "specific_food";
    }

    return {
      dayOffset,
      dayLabel,
      isAmbiguousDay,
      targetDate,
      targetSlot,
      matchedFood,
      avoid,
      intentType,
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
      let mealPlanCard: MealPlanActionCardData | undefined;
      let alternativesCard: AlternativesCardData | undefined;
      let dayClarification: DayClarificationData | undefined;
      let exclusionPrompt: ExclusionPromptData | undefined;
      let pendingConfirmation: AssistantMessage["pendingConfirmation"];

      const intent = parseIntent(text);
      const slotTitle = intent.targetSlot.charAt(0).toUpperCase() + intent.targetSlot.slice(1);

      // Check Profile Exclusion & Allergy Guardrails
      const exclusionMatch = findExcludedMatch(text, activeProfile.disliked_foods, activeProfile.allergies);

      // Branch 0: Profile Restriction / Allergy Guardrail Triggered (e.g. "Can I eat chicken tonight?")
      if (exclusionMatch) {
        const cleanTerm = exclusionMatch.term.replace(/^no\s+/i, "");
        if (exclusionMatch.isAllergy) {
          reply = `⚠️ Allergy Guardrail: Your profile is set to exclude ${exclusionMatch.term}. Eating this may cause adverse reactions. Would you like to view safe allergy-free alternatives (like Greek yogurt, pumpkin seeds, or fruit) instead?`;
        } else {
          reply = `Your profile is set to exclude ${cleanTerm}. Would you like to temporarily allow it, or choose a fish/lean beef alternative instead?`;
        }
        exclusionPrompt = {
          term: exclusionMatch.term,
          slot: intent.targetSlot,
          dayOffset: intent.dayOffset,
          dayLabel: intent.dayLabel,
          targetDate: intent.targetDate,
          isAllergy: exclusionMatch.isAllergy,
          matchedFood: intent.matchedFood,
          safeAlternativeDesc: exclusionMatch.isAllergy ? "Safe allergy-free alternative" : "Fish or lean beef alternative",
        };
      }
      // Branch A: Ambiguous day on a meal swap or food request -> Ask user with [ Today ] [ Tomorrow ] chips
      else if (intent.isAmbiguousDay && (intent.intentType === "replace_slot" || intent.intentType === "specific_food")) {
        reply = `Would you like to apply this to Today's ${slotTitle.toLowerCase()} or Tomorrow's ${slotTitle.toLowerCase()}?`;
        dayClarification = {
          originalPrompt: text,
          intentType: intent.intentType,
          targetSlot: intent.targetSlot,
          matchedFood: intent.matchedFood,
          avoid: intent.avoid,
        };
      }
      // Branch B: Eaten-Meal Guard for "Today"
      else if (intent.dayOffset === 0 && todayMealLogs.some((l) => l.meal_type === intent.targetSlot) && (intent.intentType === "replace_slot" || intent.intentType === "specific_food")) {
        const eatenLog = todayMealLogs.find((l) => l.meal_type === intent.targetSlot);
        reply = `Today's ${slotTitle} (${eatenLog?.meal_name || "Meal"}) has already been logged as eaten and cannot be replaced. Would you like to log this as an additional snack, or adjust your upcoming dinner to balance out?`;
        pendingConfirmation = intent.matchedFood
          ? {
              mealName: intent.matchedFood.name,
              calories: intent.matchedFood.calories,
              protein: intent.matchedFood.protein,
              carbs: intent.matchedFood.carbs,
              fat: intent.matchedFood.fat,
              mealType: "snack_2",
              targetDate: state.today,
              isExtraSnack: true,
            }
          : undefined;
      }
      // Branch C: Replace slot -> Offer 3 curated alternatives with [ Review Alternatives ] modal respecting exclusions
      else if (intent.intentType === "replace_slot") {
        const alternatives = getSlotAlternatives(
          intent.targetSlot,
          intent.avoid,
          activeProfile.disliked_foods,
          activeProfile.allergies
        );
        reply = `I found 3 high-protein alternatives for ${intent.dayLabel}'s ${slotTitle.toLowerCase()}${intent.avoid.length ? ` without ${intent.avoid.join(", ")}` : ""}. Review and choose your favorite below.`;

        alternativesCard = {
          title: `${intent.dayLabel}'s ${slotTitle} Alternatives Ready`,
          details: `3 curated ${intent.targetSlot} options (${alternatives[0].calories}-${alternatives[1].calories} kcal)`,
          targetDayLabel: intent.dayLabel,
          targetDate: intent.targetDate,
          dayOffset: intent.dayOffset,
          targetSlot: intent.targetSlot,
          options: alternatives,
        };
      }
      // Branch D: Specific food item requested (e.g. ice cream, Greek yogurt, salmon)
      else if (intent.intentType === "specific_food" && intent.matchedFood) {
        const food = intent.matchedFood;
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
      }
      // Branch E: Full Egyptian Plan
      else if (intent.intentType === "full_plan") {
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
      }
      // Branch F: Log Meal
      else if (intent.intentType === "log_meal") {
        logMeal({ mealName: "Logged Meal", mealType: "lunch", notes: "Logged via Ask NutriCoach" });
        reply = `I've logged that for your lunch and rebalanced your remaining daily dinner targets accordingly.`;
      }
      // Branch G: General inquiry
      else {
        reply = `You have ${todayRemainingMacros.calories} kcal and ${todayRemainingMacros.protein}g protein remaining today. Let me know if you'd like to replace tomorrow's breakfast, add a snack, or plan upcoming meals!`;
      }

      const agentReplyMsg: AssistantMessage = {
        id: `ai-${Date.now()}`,
        sender: "agent",
        text: reply,
        mealPlanCard,
        alternativesCard,
        dayClarification,
        exclusionPrompt,
        pendingConfirmation,
        time: "Just now",
      };

      setAiMessages((prev) => [...prev, agentReplyMsg]);
      setLoading(false);
    }, 300);
  };

  // Handle Ambiguity Day Choice [ Today ] / [ Tomorrow ]
  const handleDayChoice = (choice: "today" | "tomorrow", data: DayClarificationData) => {
    const dayOffset = choice === "today" ? 0 : 1;
    const dayLabel = choice === "today" ? "Today" : "Tomorrow";
    const targetDate = addDays(state.today, dayOffset);
    const slotTitle = data.targetSlot.charAt(0).toUpperCase() + data.targetSlot.slice(1);

    // Add user message
    const userMsg: AssistantMessage = {
      id: `usr-choice-${Date.now()}`,
      sender: "user",
      text: dayLabel,
      time: "Just now",
    };

    // Check Eaten-Meal Guard if choice is Today
    if (choice === "today" && todayMealLogs.some((l) => l.meal_type === data.targetSlot)) {
      const eatenLog = todayMealLogs.find((l) => l.meal_type === data.targetSlot);
      const agentMsg: AssistantMessage = {
        id: `ai-guard-${Date.now()}`,
        sender: "agent",
        text: `Today's ${slotTitle} (${eatenLog?.meal_name || "Meal"}) has already been logged as eaten and cannot be replaced. Would you like to log this as an additional snack, or adjust your upcoming dinner to balance out?`,
        pendingConfirmation: data.matchedFood
          ? {
              mealName: data.matchedFood.name,
              calories: data.matchedFood.calories,
              protein: data.matchedFood.protein,
              carbs: data.matchedFood.carbs,
              fat: data.matchedFood.fat,
              mealType: "snack_2",
              targetDate: state.today,
              isExtraSnack: true,
            }
          : undefined,
        time: "Just now",
      };
      setAiMessages((prev) => [...prev, userMsg, agentMsg]);
      return;
    }

    // If specific food
    if (data.intentType === "specific_food" && data.matchedFood) {
      const food = data.matchedFood;
      const agentMsg: AssistantMessage = {
        id: `ai-plan-${Date.now()}`,
        sender: "agent",
        text: `I've prepared ${dayLabel}'s ${slotTitle} with ${food.name} (~${food.calories} kcal). Dinner will be automatically adjusted to keep your daily target balanced.`,
        mealPlanCard: {
          icon: food.icon,
          foodName: food.name,
          targetDayLabel: dayLabel,
          targetDate,
          dayOffset,
          targetSlot: data.targetSlot,
          calories: food.calories,
          protein: food.protein,
          carbs: food.carbs,
          fat: food.fat,
          subtext: `Dinner adjusted to keep ${dayLabel.toLowerCase()} balanced.`,
          confirmed: false,
        },
        time: "Just now",
      };
      setAiMessages((prev) => [...prev, userMsg, agentMsg]);
      return;
    }

    // If replace slot -> generate alternatives
    const alternatives = getSlotAlternatives(
      data.targetSlot,
      data.avoid,
      activeProfile.disliked_foods,
      activeProfile.allergies
    );
    const agentMsg: AssistantMessage = {
      id: `ai-alt-${Date.now()}`,
      sender: "agent",
      text: `I found 3 high-protein alternatives for ${dayLabel}'s ${slotTitle.toLowerCase()}. Click below to review and choose your preferred meal.`,
      alternativesCard: {
        title: `${dayLabel}'s ${slotTitle} Alternatives Ready`,
        details: `3 curated ${data.targetSlot} options (${alternatives[0].calories}-${alternatives[1].calories} kcal)`,
        targetDayLabel: dayLabel,
        targetDate,
        dayOffset,
        targetSlot: data.targetSlot,
        options: alternatives,
      },
      time: "Just now",
    };

    setAiMessages((prev) => [...prev, userMsg, agentMsg]);
  };

  // Handle Exclusion Prompt Choices
  const handleAllowExcludedOnce = (data: ExclusionPromptData) => {
    const slotTitle = data.slot.charAt(0).toUpperCase() + data.slot.slice(1);
    const cleanTerm = data.term.replace(/^no\s+/i, "");

    const userMsg: AssistantMessage = {
      id: `usr-allow-${Date.now()}`,
      sender: "user",
      text: `Allow ${cleanTerm} for ${data.dayLabel.toLowerCase()}'s ${data.slot}`,
      time: "Just now",
    };

    const food = data.matchedFood || {
      name: `Prepared ${cleanTerm} dish`,
      calories: 520,
      protein: 45,
      carbs: 50,
      fat: 12,
      icon: "🍽️",
      keywords: [],
      defaultSlot: data.slot,
      ingredients: [cleanTerm.toLowerCase()],
      tags: [data.slot, "custom"],
    };

    const agentMsg: AssistantMessage = {
      id: `ai-allow-${Date.now()}`,
      sender: "agent",
      text: `Understood! Allowing ${cleanTerm} as a temporary exception for ${data.dayLabel}'s ${slotTitle.toLowerCase()}. Here is your calibrated meal card:`,
      mealPlanCard: {
        icon: food.icon,
        foodName: food.name,
        targetDayLabel: data.dayLabel,
        targetDate: data.targetDate,
        dayOffset: data.dayOffset,
        targetSlot: data.slot,
        calories: food.calories,
        protein: food.protein,
        carbs: food.carbs,
        fat: food.fat,
        subtext: `One-time exception approved. Dinner adjusted to keep ${data.dayLabel.toLowerCase()} on target.`,
        confirmed: false,
      },
      time: "Just now",
    };

    setAiMessages((prev) => [...prev, userMsg, agentMsg]);
  };

  const handleViewSafeAlternatives = (data: ExclusionPromptData) => {
    const slotTitle = data.slot.charAt(0).toUpperCase() + data.slot.slice(1);
    const cleanTerm = data.term.replace(/^no\s+/i, "");

    const userMsg: AssistantMessage = {
      id: `usr-safe-${Date.now()}`,
      sender: "user",
      text: `Choose safe alternatives for ${data.dayLabel.toLowerCase()}'s ${data.slot}`,
      time: "Just now",
    };

    const alternatives = getSlotAlternatives(
      data.slot,
      [cleanTerm],
      activeProfile.disliked_foods,
      activeProfile.allergies
    );

    const agentMsg: AssistantMessage = {
      id: `ai-safe-${Date.now()}`,
      sender: "agent",
      text: `Here are 3 verified high-protein alternatives for ${data.dayLabel}'s ${slotTitle.toLowerCase()} that strictly exclude ${cleanTerm}:`,
      alternativesCard: {
        title: `${data.dayLabel}'s Safe ${slotTitle} Alternatives`,
        details: `3 compliant options (${alternatives[0].calories}-${alternatives[1].calories} kcal) excluding ${cleanTerm}`,
        targetDayLabel: data.dayLabel,
        targetDate: data.targetDate,
        dayOffset: data.dayOffset,
        targetSlot: data.slot,
        options: alternatives,
      },
      time: "Just now",
    };

    setAiMessages((prev) => [...prev, userMsg, agentMsg]);
  };

  // Apply single food action card
  const handleApplyMealPlanCard = (msgId: string, card: MealPlanActionCardData) => {
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

    setAiMessages((prev) =>
      prev.map((m) =>
        m.id === msgId && m.mealPlanCard
          ? { ...m, mealPlanCard: { ...m.mealPlanCard, confirmed: true } }
          : m
      )
    );
  };

  // Open in-place review alternatives modal (NO PAGE REDIRECT)
  const handleOpenReviewModal = (msgId: string, card: AlternativesCardData) => {
    setReviewModal({
      targetDayLabel: card.targetDayLabel,
      targetDate: card.targetDate,
      dayOffset: card.dayOffset,
      targetSlot: card.targetSlot,
      options: card.options,
      msgId,
    });
  };

  // Select alternative in modal and apply to state
  const handleApplyAlternative = (modal: ReviewModalState, selected: MealSnapshot) => {
    replaceMealSlot({
      mealType: modal.targetSlot,
      date: modal.targetDate,
      meal: selected,
      source: "agent",
      rebalanceDinner: true,
    });

    const slotTitle = modal.targetSlot.charAt(0).toUpperCase() + modal.targetSlot.slice(1);

    // Update alternatives card to show selected meal and add confirmation note
    setAiMessages((prev) => [
      ...prev.map((m) =>
        m.id === modal.msgId && m.alternativesCard
          ? { ...m, alternativesCard: { ...m.alternativesCard, selectedMealName: selected.meal_name } }
          : m
      ),
      {
        id: `ai-conf-${Date.now()}`,
        sender: "agent",
        text: `✓ ${modal.targetDayLabel}'s ${slotTitle.toLowerCase()} updated to ${selected.meal_name} (${selected.calories} kcal). Your dinner has been calibrated to keep ${modal.targetDayLabel.toLowerCase()}'s calories on target.`,
        time: "Just now",
      },
    ]);

    setReviewModal(null);
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

              {/* Exclusion & Allergy Guardrail Warning Card */}
              {m.exclusionPrompt && (
                <div className="bg-surface rounded-md border border-[#FCA5A5]/80 p-3 space-y-2 mt-2 shadow-hairline bg-gradient-to-br from-[#FEF2F2]/60 to-surface">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-status-danger">
                    <span>⚠️ Guardrail Triggered: {m.exclusionPrompt.term}</span>
                  </div>
                  <p className="text-[11px] text-ink-muted leading-relaxed">
                    {m.exclusionPrompt.isAllergy
                      ? "High-risk allergen detected in request. Choose a certified safe alternative below:"
                      : "This item is in your profile exclusion list. Would you like to allow it once or choose a safe alternative?"}
                  </p>
                  <div className="pt-1 flex items-center gap-2">
                    {!m.exclusionPrompt.isAllergy && (
                      <button
                        onClick={() => handleAllowExcludedOnce(m.exclusionPrompt!)}
                        className="text-xs px-2.5 py-1.5 rounded-md bg-surface hover:bg-surface-subtle border border-border text-ink-primary font-medium transition-colors shadow-hairline"
                      >
                        Allow Once
                      </button>
                    )}
                    <button
                      onClick={() => handleViewSafeAlternatives(m.exclusionPrompt!)}
                      className="text-xs px-3 py-1.5 rounded-md bg-brand hover:bg-brand-hover text-white font-medium transition-colors shadow-hairline flex items-center gap-1"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>View Safe Alternatives</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Day Clarification Response Chips */}
              {m.dayClarification && (
                <div className="pt-1 flex items-center gap-2">
                  <button
                    onClick={() => handleDayChoice("today", m.dayClarification!)}
                    className="text-xs px-3 py-1 rounded-md bg-surface border border-border hover:border-brand/60 text-ink-primary font-medium transition-colors shadow-hairline"
                  >
                    Today
                  </button>
                  <button
                    onClick={() => handleDayChoice("tomorrow", m.dayClarification!)}
                    className="text-xs px-3 py-1 rounded-md bg-brand hover:bg-brand-hover text-white font-medium transition-colors shadow-hairline"
                  >
                    Tomorrow
                  </button>
                </div>
              )}

              {/* Interactive Alternatives Card */}
              {m.alternativesCard && (
                <div className="bg-surface rounded-lg border border-border p-3 space-y-2 mt-2 shadow-hairline">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-ink-primary">{m.alternativesCard.title}</span>
                    <span className="text-[10px] text-brand font-medium">Ready</span>
                  </div>
                  <p className="text-[11px] text-ink-muted">{m.alternativesCard.details}</p>

                  <div className="pt-1 flex items-center justify-between gap-2 border-t border-border/60">
                    {!m.alternativesCard.selectedMealName ? (
                      <button
                        onClick={() => handleOpenReviewModal(m.id, m.alternativesCard!)}
                        className="w-full text-xs font-semibold text-white bg-brand hover:bg-brand-hover px-3 py-1.5 rounded-md shadow-hairline transition-colors flex items-center justify-center gap-1.5"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Review Alternatives</span>
                      </button>
                    ) : (
                      <div className="w-full flex items-center justify-between gap-2">
                        <span className="text-[11px] text-brand font-medium flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" />
                          <span>Applied: {m.alternativesCard.selectedMealName}</span>
                        </span>
                        <button
                          onClick={() => handleViewInMealPlan(m.alternativesCard!.dayOffset)}
                          className="text-xs font-medium text-ink-primary hover:text-brand bg-surface-subtle hover:bg-surface px-2.5 py-1 rounded border border-border transition-colors flex items-center gap-1"
                        >
                          <span>View in Plan</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

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
                      <span>Add as Extra Snack</span>
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

      {/* IN-PLACE REVIEW ALTERNATIVES MODAL (NO DISORIENTING NAVIGATION) */}
      {reviewModal && (
        <div className="fixed inset-0 bg-ink-primary/20 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-surface rounded-xl border border-border max-w-lg w-full p-5 space-y-4 shadow-xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-sm font-semibold text-ink-primary flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-brand" />
                  <span>Select Alternative for {reviewModal.targetDayLabel}&apos;s {reviewModal.targetSlot.charAt(0).toUpperCase() + reviewModal.targetSlot.slice(1)}</span>
                </h3>
                <p className="text-[11px] text-ink-muted">
                  Target day: {formatDay(reviewModal.targetDate)} · Dinner will auto-rebalance to maintain calorie goal
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReviewModal(null)}
                className="p-1 text-ink-muted hover:text-ink-primary rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 3 Curated Options */}
            <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
              {reviewModal.options.map((opt, i) => (
                <div
                  key={i}
                  className="p-3 rounded-lg border border-border bg-surface hover:border-brand/40 transition-all flex items-center justify-between gap-3"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="font-semibold text-xs text-ink-primary truncate">{opt.meal_name}</div>
                    <div className="text-[11px] text-ink-muted flex items-center gap-2">
                      <span className="font-semibold text-brand">{opt.calories} kcal</span>
                      <span>·</span>
                      <span>{opt.protein}g P</span>
                      <span>·</span>
                      <span>{opt.carbs}g C</span>
                      <span>·</span>
                      <span>{opt.fat}g F</span>
                    </div>
                    {opt.ingredients && opt.ingredients.length > 0 && (
                      <div className="text-[10px] text-ink-secondary truncate">
                        Ingredients: {opt.ingredients.join(", ")}
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleApplyAlternative(reviewModal, opt)}
                    className="shrink-0 text-xs font-semibold text-white bg-brand hover:bg-brand-hover px-3.5 py-1.5 rounded-md shadow-hairline transition-colors flex items-center gap-1"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Select & Apply</span>
                  </button>
                </div>
              ))}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setReviewModal(null)}
                className="text-xs text-ink-secondary hover:text-ink-primary px-3 py-1.5 rounded-md border border-border hover:bg-surface-subtle"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}





