"use client";
import React, { useState } from "react";
import { ArrowUp, BookOpen, Check, ChevronRight, ExternalLink, MessageSquare, Plus, RefreshCw, Sparkles, Utensils, X } from "lucide-react";
import { addDays, formatDay } from "@/lib/dates";
import { useNutriCoach } from "./NutriCoachContext";
import type { MealSnapshot, MealType, AgentResponseContract, AgentResearchSource } from "@/lib/types";

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

interface CuisineMealTemplate {
  slot: MealType;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  ingredients: string[];
  tags: string[];
}

interface CuisineTemplate {
  id: string;
  name: string;
  keywords: string[];
  summary: string;
  meals: CuisineMealTemplate[];
}

interface CuisineCardData {
  cuisineName: string;
  dayLabel: string;
  dayOffset: number;
  targetDate: string;
  totalCalories: number;
  totalProtein: number;
  meals: { slot: string; name: string; calories: number; protein: number }[];
}

interface AssistantMessage {
  id: string;
  sender: "user" | "agent";
  text: string;
  intent?: string;
  action?: string;
  suggestedFollowUps?: string[];
  mealPlanCard?: MealPlanActionCardData;
  alternativesCard?: AlternativesCardData;
  dayClarification?: DayClarificationData;
  exclusionPrompt?: ExclusionPromptData;
  cuisineCard?: CuisineCardData;
  coachAlert?: {
    reason: string;
    priority: "low" | "medium" | "high";
    recommendedAction: string;
  };
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
  researchSources?: AgentResearchSource[];
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

const CUISINE_TEMPLATES: CuisineTemplate[] = [
  {
    id: "italian",
    name: "Italian",
    keywords: ["italian", "italy", "piccata", "spigola", "ricotta", "frittata"],
    summary: "Spinach frittata, Chicken piccata with whole wheat penne, Ricotta snack, and Herb-crusted sea bass",
    meals: [
      {
        slot: "breakfast",
        name: "Frittata with spinach, cherry tomatoes & whole grain sourdough",
        calories: 420,
        protein: 28,
        carbs: 32,
        fat: 18,
        ingredients: ["eggs", "spinach", "cherry tomatoes", "whole grain sourdough", "olive oil"],
        tags: ["italian", "breakfast", "high-protein"],
      },
      {
        slot: "lunch",
        name: "Grilled chicken piccata with whole wheat penne & arugula salad",
        calories: 540,
        protein: 46,
        carbs: 52,
        fat: 14,
        ingredients: ["chicken breast", "whole wheat penne", "lemon caper sauce", "arugula", "parmesan"],
        tags: ["italian", "lunch", "high-protein"],
      },
      {
        slot: "snack",
        name: "Low-fat ricotta with fresh figs or sliced pear & walnuts",
        calories: 220,
        protein: 14,
        carbs: 20,
        fat: 10,
        ingredients: ["low-fat ricotta", "fresh figs", "walnuts", "honey drizzle"],
        tags: ["italian", "snack", "dairy"],
      },
      {
        slot: "dinner",
        name: "Herb-crusted sea bass (spigola) with roasted zucchini, capers & olive oil",
        calories: 480,
        protein: 42,
        carbs: 24,
        fat: 16,
        ingredients: ["sea bass fillet", "roasted zucchini", "capers", "olive oil", "fresh oregano"],
        tags: ["italian", "dinner", "pescatarian"],
      },
    ],
  },
  {
    id: "egyptian",
    name: "Egyptian",
    keywords: ["egyptian", "egypt", "baladi", "ful", "kofta", "areesh", "koshary"],
    summary: "Ful medames with boiled eggs, Grilled chicken with jasmine rice, Greek yogurt, and Lean beef kofta",
    meals: [
      {
        slot: "breakfast",
        name: "Ful medames with boiled eggs, cumin & baladi bread",
        calories: 450,
        protein: 28,
        carbs: 52,
        fat: 14,
        ingredients: ["fava beans", "2 boiled eggs", "baladi bread", "tahini", "cumin", "olive oil"],
        tags: ["egyptian", "breakfast", "high-fiber"],
      },
      {
        slot: "lunch",
        name: "Grilled chicken breast with jasmine rice & green salad",
        calories: 520,
        protein: 45,
        carbs: 55,
        fat: 12,
        ingredients: ["chicken breast", "jasmine rice", "green salad", "olive oil"],
        tags: ["egyptian", "lunch", "high-protein"],
      },
      {
        slot: "snack",
        name: "Greek yogurt with honey & raw almonds",
        calories: 240,
        protein: 22,
        carbs: 24,
        fat: 7,
        ingredients: ["greek yogurt", "honey", "raw almonds"],
        tags: ["egyptian", "snack", "high-protein"],
      },
      {
        slot: "dinner",
        name: "Lean beef kofta with tahini & baladi bread",
        calories: 480,
        protein: 40,
        carbs: 42,
        fat: 16,
        ingredients: ["lean beef kofta", "tahini", "baladi bread", "grilled parsley salad"],
        tags: ["egyptian", "dinner", "high-protein"],
      },
    ],
  },
  {
    id: "mediterranean",
    name: "Mediterranean",
    keywords: ["mediterranean", "greek", "souvlaki", "feta", "tzatziki"],
    summary: "Greek omelet with feta, Salmon quinoa bowl, Roasted chickpeas, and Souvlaki skewers with tzatziki",
    meals: [
      {
        slot: "breakfast",
        name: "Greek omelet with feta, olives, and tomato slice",
        calories: 400,
        protein: 28,
        carbs: 20,
        fat: 22,
        ingredients: ["eggs", "feta cheese", "kalamata olives", "tomatoes", "whole wheat toast"],
        tags: ["mediterranean", "breakfast", "high-protein"],
      },
      {
        slot: "lunch",
        name: "Tuna or grilled salmon quinoa bowl with lemon-herb dressing",
        calories: 530,
        protein: 44,
        carbs: 48,
        fat: 16,
        ingredients: ["grilled salmon", "quinoa", "cucumbers", "cherry tomatoes", "lemon-herb dressing"],
        tags: ["mediterranean", "lunch", "omega-3"],
      },
      {
        slot: "snack",
        name: "Roasted chickpeas with sea salt & paprika",
        calories: 210,
        protein: 18,
        carbs: 24,
        fat: 4,
        ingredients: ["roasted chickpeas", "paprika", "olive oil", "sea salt"],
        tags: ["mediterranean", "snack", "high-fiber"],
      },
      {
        slot: "dinner",
        name: "Souvlaki skewers with tzatziki and grilled vegetables",
        calories: 490,
        protein: 42,
        carbs: 36,
        fat: 16,
        ingredients: ["chicken souvlaki skewers", "tzatziki", "grilled bell peppers", "pita bread"],
        tags: ["mediterranean", "dinner", "high-protein"],
      },
    ],
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
    activeTargets,
    weeklySmoothingEnabled,
    weeklyRebalanceInfo,
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
    "Create tomorrow's plan using Italian foods",
    "Replace tomorrow's breakfast",
    "I want to eat ice cream tomorrow",
    "Change tomorrow's snack to Greek yogurt",
    "Create tomorrow's plan using Egyptian foods",
  ];

  // Robust Intent Parsing Engine
  const parseIntent = (prompt: string) => {
    const p = prompt.toLowerCase();

    // 0. Cuisine Matching
    let matchedCuisine: CuisineTemplate | null = null;
    for (const c of CUISINE_TEMPLATES) {
      if (c.keywords.some((kw) => p.includes(kw))) {
        matchedCuisine = c;
        break;
      }
    }

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
      const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
      const matchedDayIndex = dayNames.findIndex((d) => p.includes(d));
      if (matchedDayIndex >= 0) {
        const todayIndex = new Date(state.today).getDay();
        let diff = (matchedDayIndex - todayIndex + 7) % 7;
        if (diff === 0 && !p.includes("today")) diff = 7;
        dayOffset = diff;
        dayLabel = dayNames[matchedDayIndex].charAt(0).toUpperCase() + dayNames[matchedDayIndex].slice(1);
      } else {
        isAmbiguousDay = true;
        // Default cuisine / full day requests to Tomorrow if no day explicitly specified
        if (matchedCuisine || p.includes("plan")) {
          dayOffset = 1;
          dayLabel = "Tomorrow";
        }
      }
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
    let intentType: "replace_slot" | "specific_food" | "cuisine_plan" | "log_meal" | "general" = "general";

    const isCuisineRequest = matchedCuisine !== null && (
      p.includes("plan") ||
      p.includes("create") ||
      p.includes("switch") ||
      p.includes("food") ||
      p.includes("foods") ||
      p.includes("cuisine") ||
      p.includes("make") ||
      p.includes("generate") ||
      p.includes("using") ||
      p.includes("italian") ||
      p.includes("egyptian") ||
      p.includes("mediterranean") ||
      p.includes("greek")
    );

    const isLogMealIntent =
      (p.startsWith("ate ") ||
       p.startsWith("logged ") ||
       p.startsWith("i ate ") ||
       p.startsWith("i had ") ||
       p.includes(" i ate ") ||
       p.includes(" i had ") ||
       p.includes(" logged a ") ||
       p.includes(" eaten ")) &&
      !p.includes("create") &&
      !p.includes("plan") &&
      !p.includes("replace") &&
      !p.includes("switch") &&
      !p.includes("using");

    if (isCuisineRequest) {
      intentType = "cuisine_plan";
    } else if (isLogMealIntent) {
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
      matchedCuisine,
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

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          currentDate: state.today,
          userProfile: activeProfile,
          targets: activeTargets,
          plannedMeals: state.plannedMeals[state.activeMemberId] || [],
          todayMealLogs,
          recentHistory: aiMessages.slice(-10),
        }),
      });

      if (res.ok) {
        const data: AgentResponseContract = await res.json();
        console.log("[NutriCoach] CHAT RESPONSE", data);

        let mealPlanCard: MealPlanActionCardData | undefined;
        let alternativesCard: AlternativesCardData | undefined;
        let dayClarification: DayClarificationData | undefined;
        let exclusionPrompt: ExclusionPromptData | undefined;
        let cuisineCard: CuisineCardData | undefined;
        let pendingConfirmation: AssistantMessage["pendingConfirmation"];

        // If proposed meal requires user confirmation
        if (data.proposedMeal && data.requiresConfirmation) {
          const slot = (data.targetSlot || "dinner") as MealType;
          const targetDay = data.targetDay || "today";
          const dayOffset = targetDay === "tomorrow" ? 1 : 0;
          const targetDate = addDays(state.today, dayOffset);

          mealPlanCard = {
            icon: "🍽️",
            foodName: data.proposedMeal.title,
            targetDayLabel: targetDay === "tomorrow" ? "Tomorrow" : "Today",
            targetDate,
            dayOffset,
            targetSlot: slot,
            calories: data.proposedMeal.calories,
            protein: data.proposedMeal.protein,
            carbs: data.proposedMeal.carbs,
            fat: data.proposedMeal.fat,
            subtext: data.remainingTargetsNote || "Dinner will be automatically adjusted to keep targets balanced.",
            confirmed: false,
          };
        }

        // If mutation is approved and verified by application
        if (data.shouldMutatePlan && data.proposedMeal && data.proposedMeal.title && data.targetSlot) {
          const targetDay = data.targetDay || "today";
          const dayOffset = targetDay === "tomorrow" ? 1 : 0;
          const targetDate = addDays(state.today, dayOffset);

          console.log("MUTATION REQUEST:", {
            memberId: state.activeMemberId,
            targetDay,
            targetDate,
            targetSlot: data.targetSlot,
            proposedMeal: data.proposedMeal,
          });

          if (data.action === "log_meal") {
            logMeal({
              mealName: data.proposedMeal.title,
              mealType: data.targetSlot as MealType,
              notes: "Logged via Ask NutriCoach",
            });
          } else {
            replaceMealSlot({
              mealType: data.targetSlot as MealType,
              date: targetDate,
              meal: {
                meal_name: data.proposedMeal.title,
                calories: data.proposedMeal.calories,
                protein: data.proposedMeal.protein,
                carbs: data.proposedMeal.carbs,
                fat: data.proposedMeal.fat,
                ingredients: data.proposedMeal.ingredients || [],
                tags: [data.targetSlot, "agent"],
              },
              source: "agent",
              rebalanceDinner: data.targetSlot !== "dinner",
            });
          }
        }

        const agentReplyMsg: AssistantMessage = {
          id: `ai-${Date.now()}`,
          sender: "agent",
          text: data.replyText,
          intent: data.intent,
          action: data.action,
          suggestedFollowUps: data.suggestedFollowUps,
          mealPlanCard,
          alternativesCard,
          dayClarification,
          exclusionPrompt,
          cuisineCard,
          coachAlert: data.coachFollowup
            ? {
                reason: data.coachFollowup.reason,
                priority: data.coachFollowup.priority,
                recommendedAction: data.coachFollowup.recommendedAction,
              }
            : undefined,
          pendingConfirmation,
          researchSources: data.researchSources && data.researchSources.length > 0 ? data.researchSources : undefined,
          time: "Just now",
        };

        setAiMessages((prev) => [...prev, agentReplyMsg]);
        setLoading(false);
        return;
      }

      // Non-2xx response from /api/chat
      const errorData = await res.json().catch(() => null);
      console.error("[NutriCoach] /api/chat error HTTP", res.status, errorData);

      const errorMessage =
        errorData?.replyText ||
        errorData?.error ||
        "I couldn't process that request right now. No meal plan changes were made.";

      const errorReplyMsg: AssistantMessage = {
        id: `ai-${Date.now()}`,
        sender: "agent",
        text: errorMessage,
        time: "Just now",
      };

      setAiMessages((prev) => [...prev, errorReplyMsg]);
      setLoading(false);
      return;
    } catch (err: any) {
      console.error("[NutriCoach] /api/chat network/fetch error:", err);
      const networkErrorMsg: AssistantMessage = {
        id: `ai-${Date.now()}`,
        sender: "agent",
        text: "I couldn't connect to NutriCoach right now. Please check your network connection and try again.",
        time: "Just now",
      };
      setAiMessages((prev) => [...prev, networkErrorMsg]);
      setLoading(false);
      return;
    }
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
    console.log("[NutriCoach] APPLYING MEAL", {
      memberId: state.activeMemberId,
      date: card.targetDate,
      slot: card.targetSlot,
      meal: card.foodName,
    });

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
      rebalanceDinner: card.targetSlot !== "dinner",
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

              {/* Dynamic Cuisine Plan Card */}
              {m.cuisineCard && (
                <div className="bg-surface rounded-lg border border-border p-3 space-y-2 mt-2 shadow-hairline">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-brand">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>✓ {m.cuisineCard.dayLabel} updated to {m.cuisineCard.cuisineName} Cuisine</span>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 bg-brand-tint text-brand rounded font-medium border border-[#D5E6D2]">
                      {m.cuisineCard.totalCalories} kcal · {m.cuisineCard.totalProtein}g Protein
                    </span>
                  </div>

                  <div className="space-y-1.5 pt-1 border-t border-border/60 text-[11px]">
                    {m.cuisineCard.meals.map((meal) => (
                      <div key={meal.slot} className="flex items-start justify-between gap-2 text-ink-secondary">
                        <div className="min-w-0 truncate">
                          <span className="font-semibold text-ink-primary">{meal.slot}: </span>
                          <span className="text-ink-secondary">{meal.name}</span>
                        </div>
                        <span className="text-ink-muted text-[10px] shrink-0 font-medium">{meal.calories} kcal ({meal.protein}g P)</span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-1.5 flex items-center justify-end border-t border-border/60">
                    <button
                      onClick={() => handleViewInMealPlan(m.cuisineCard!.dayOffset)}
                      className="text-xs font-medium text-brand hover:text-brand-hover bg-brand-tint hover:bg-brand-tint/80 px-2.5 py-1 rounded border border-[#D5E6D2] transition-colors flex items-center gap-1"
                    >
                      <span>View in Weekly Meal Plan</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* Grounded Research Sources Card */}
              {m.researchSources && m.researchSources.length > 0 && (
                <div className="space-y-2 mt-2">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-ink-secondary">
                    <BookOpen className="w-3.5 h-3.5 text-brand" />
                    <span>Trusted Nutrition Sources ({m.researchSources.length})</span>
                  </div>
                  <div className="grid gap-2">
                    {m.researchSources.map((source, sIdx) => (
                      <div
                        key={sIdx}
                        className="bg-surface rounded-lg border border-border/80 hover:border-brand/40 p-3 space-y-1.5 shadow-hairline transition-all"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-semibold text-xs text-ink-primary leading-snug line-clamp-2">
                            {source.title}
                          </h4>
                          <span className="shrink-0 text-[10px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded bg-brand-tint text-brand border border-[#D5E6D2]">
                            {source.sourceType ? source.sourceType.replace("_", " ") : "source"}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-[10px] text-ink-muted">
                          <span className="font-medium text-ink-secondary">{source.sourceName}</span>
                          {source.publishedDate && (
                            <>
                              <span>•</span>
                              <span>{source.publishedDate}</span>
                            </>
                          )}
                        </div>

                        {source.summary && (
                          <p className="text-[11px] text-ink-muted leading-relaxed line-clamp-3">
                            {source.summary}
                          </p>
                        )}

                        <div className="pt-1 flex items-center justify-between border-t border-border/50">
                          <a
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:text-brand-hover hover:underline transition-colors"
                          >
                            <span>Read source</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick Suggested Follow-up reply buttons */}
              {m.suggestedFollowUps && m.suggestedFollowUps.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {m.suggestedFollowUps.map((chip, chipIdx) => (
                    <button
                      key={chipIdx}
                      onClick={() => handleSend(chip)}
                      className="text-[11px] bg-surface hover:bg-surface-subtle text-ink-primary hover:text-brand px-2.5 py-1 rounded-md border border-border hover:border-brand/40 transition-colors font-medium shadow-hairline text-left"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              )}

              {/* Coach Alert Notice */}
              {m.coachAlert && (
                <div className="bg-surface rounded-md border border-brand/40 p-2.5 space-y-1 text-xs bg-brand-tint/30 shadow-hairline">
                  <div className="flex items-center gap-1.5 font-semibold text-brand text-[11px]">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Coach Action Drafted ({m.coachAlert.priority} priority)</span>
                  </div>
                  <p className="text-[10px] text-ink-muted leading-tight">{m.coachAlert.reason}</p>
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





