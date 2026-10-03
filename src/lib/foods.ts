// Food & recipe catalog (per standard serving).
// Macros are per serving; calories are ALWAYS derived from macros via
// caloriesFromMacros(), never typed by hand.
//
// planning: true  -> the planner may put it in a meal plan
// planning: false -> common foods members eat that we can recognise when logged

import { caloriesFromMacros, normalizeMacros, scaleMacros } from "./nutrition";
import type { MealSnapshot, MealType } from "./types";

export interface Food {
  id: string;
  name: string;
  aliases: string[];
  meal_types: MealType[];
  protein: number;
  carbs: number;
  fat: number;
  ingredients: string[];
  /** Used for preference / allergy filtering. */
  tags: string[];
  planning: boolean;
}

const B: MealType[] = ["breakfast"];
const LD: MealType[] = ["lunch", "dinner"];
const S: MealType[] = ["snack"];
const ANY: MealType[] = ["breakfast", "lunch", "snack", "dinner"];

export const FOODS: Food[] = [
  // ---------------- Breakfast ----------------
  { id: "ful-eggs", name: "Ful medames with eggs & baladi bread", aliases: ["ful and eggs", "foul"], meal_types: B, protein: 28, carbs: 52, fat: 14, ingredients: ["fava beans", "2 eggs", "baladi bread", "olive oil", "cumin"], tags: ["egyptian", "legumes", "eggs", "gluten", "vegetarian"], planning: true },
  { id: "yogurt-oats", name: "Greek yogurt, oats & honey bowl", aliases: ["yogurt bowl", "oats bowl"], meal_types: B, protein: 30, carbs: 55, fat: 9, ingredients: ["greek yogurt", "oats", "honey", "banana"], tags: ["dairy", "vegetarian", "gluten"], planning: true },
  { id: "shakshuka", name: "Shakshuka with baladi bread", aliases: ["shakshouka"], meal_types: B, protein: 24, carbs: 40, fat: 18, ingredients: ["3 eggs", "tomato", "pepper", "onion", "baladi bread"], tags: ["egyptian", "eggs", "gluten", "vegetarian"], planning: true },
  { id: "eggwhite-omelette", name: "Egg-white omelette with cheese & toast", aliases: ["omelette", "omelet"], meal_types: B, protein: 34, carbs: 35, fat: 12, ingredients: ["egg whites", "1 egg", "light cheese", "wholewheat toast", "spinach"], tags: ["eggs", "dairy", "gluten", "vegetarian"], planning: true },
  { id: "egyptian-plate", name: "Egyptian breakfast plate (eggs, feta, vegetables)", aliases: ["feta and eggs"], meal_types: B, protein: 26, carbs: 38, fat: 18, ingredients: ["2 eggs", "feta", "tomato", "cucumber", "baladi bread"], tags: ["egyptian", "eggs", "dairy", "gluten", "vegetarian"], planning: true },
  { id: "oat-pancakes", name: "Oat pancakes with cottage cheese", aliases: ["pancakes"], meal_types: B, protein: 32, carbs: 50, fat: 10, ingredients: ["oats", "egg whites", "cottage cheese", "berries"], tags: ["eggs", "dairy", "gluten", "vegetarian"], planning: true },
  { id: "turkey-sandwich-b", name: "Smoked turkey & cheese wholewheat sandwich", aliases: ["turkey sandwich"], meal_types: B, protein: 30, carbs: 42, fat: 11, ingredients: ["smoked turkey", "light cheese", "wholewheat bread", "lettuce"], tags: ["turkey", "dairy", "gluten"], planning: true },
  { id: "overnight-oats", name: "Overnight oats with whey & banana", aliases: ["overnight oats"], meal_types: B, protein: 32, carbs: 60, fat: 8, ingredients: ["oats", "whey protein", "milk", "banana"], tags: ["dairy", "gluten", "vegetarian"], planning: true },
  { id: "areesh-plate", name: "Areesh cheese & labneh with baladi bread", aliases: ["areesh cheese"], meal_types: B, protein: 26, carbs: 45, fat: 10, ingredients: ["areesh cheese", "labneh", "baladi bread", "tomato", "mint"], tags: ["egyptian", "dairy", "gluten", "vegetarian"], planning: true },

  // ---------------- Lunch / dinner ----------------
  { id: "chicken-rice", name: "Grilled chicken breast with rice & salad", aliases: ["chicken and rice", "grilled chicken"], meal_types: LD, protein: 48, carbs: 65, fat: 12, ingredients: ["chicken breast", "white rice", "green salad", "olive oil"], tags: ["chicken"], planning: true },
  { id: "chicken-shawarma-plate", name: "Lean chicken shawarma plate", aliases: ["shawarma plate"], meal_types: LD, protein: 42, carbs: 55, fat: 18, ingredients: ["chicken thigh (skinless)", "rice", "tahini", "pickles", "salad"], tags: ["chicken", "egyptian"], planning: true },
  { id: "kofta-freekeh", name: "Kofta with freekeh & tahini salad", aliases: ["kofta"], meal_types: LD, protein: 38, carbs: 55, fat: 20, ingredients: ["lean beef kofta", "freekeh", "tahini", "salad"], tags: ["beef", "egyptian", "gluten"], planning: true },
  { id: "fish-rice", name: "Grilled tilapia (bolti) with rice & salad", aliases: ["grilled fish", "bolti", "tilapia"], meal_types: LD, protein: 44, carbs: 60, fat: 10, ingredients: ["tilapia", "sayadeya rice", "salad", "lemon"], tags: ["fish", "egyptian"], planning: true },
  { id: "molokhia-chicken", name: "Molokhia with chicken & rice", aliases: ["molokhia", "mloukhia"], meal_types: LD, protein: 40, carbs: 62, fat: 14, ingredients: ["molokhia", "chicken breast", "rice", "garlic", "coriander"], tags: ["chicken", "egyptian"], planning: true },
  { id: "lentil-chicken", name: "Lentil soup with grilled chicken", aliases: ["lentil soup", "shorbet ads"], meal_types: LD, protein: 42, carbs: 50, fat: 10, ingredients: ["red lentils", "chicken breast", "carrot", "cumin", "lemon"], tags: ["chicken", "legumes", "egyptian"], planning: true },
  { id: "beef-stirfry", name: "Beef & vegetable stir-fry with rice", aliases: ["beef stir fry"], meal_types: LD, protein: 40, carbs: 60, fat: 16, ingredients: ["lean beef strips", "mixed vegetables", "rice", "soy sauce"], tags: ["beef"], planning: true },
  { id: "tuna-pasta", name: "Tuna pasta salad", aliases: ["tuna pasta"], meal_types: LD, protein: 38, carbs: 62, fat: 12, ingredients: ["tuna in water", "wholewheat pasta", "corn", "light mayo", "vegetables"], tags: ["fish", "tuna", "gluten"], planning: true },
  { id: "egg-rice-bowl", name: "Egg and rice bowl with vegetables", aliases: ["egg rice bowl", "egg and rice"], meal_types: LD, protein: 30, carbs: 62, fat: 16, ingredients: ["3 eggs", "egg whites", "rice", "mixed vegetables", "spring onion"], tags: ["eggs", "vegetarian"], planning: true },
  { id: "turkey-wrap", name: "Turkey wrap with hummus", aliases: ["turkey wrap"], meal_types: LD, protein: 36, carbs: 48, fat: 14, ingredients: ["smoked turkey", "wholewheat tortilla", "hummus", "lettuce", "tomato"], tags: ["turkey", "gluten", "legumes"], planning: true },
  { id: "bamia-beef", name: "Bamia (okra) stew with beef & rice", aliases: ["bamia", "okra"], meal_types: LD, protein: 36, carbs: 58, fat: 16, ingredients: ["okra", "lean beef", "tomato sauce", "rice"], tags: ["beef", "egyptian"], planning: true },
  { id: "chickpea-bowl", name: "Chickpea & quinoa power bowl", aliases: ["chickpea bowl"], meal_types: LD, protein: 24, carbs: 70, fat: 16, ingredients: ["chickpeas", "quinoa", "feta", "cucumber", "tahini"], tags: ["legumes", "vegetarian", "dairy"], planning: true },
  { id: "salmon-sweetpotato", name: "Grilled salmon with sweet potato", aliases: ["salmon"], meal_types: LD, protein: 40, carbs: 45, fat: 22, ingredients: ["salmon fillet", "sweet potato", "broccoli"], tags: ["fish", "salmon"], planning: true },
  { id: "shrimp-rice", name: "Alexandrian shrimp with rice", aliases: ["shrimp", "gambari"], meal_types: LD, protein: 38, carbs: 60, fat: 10, ingredients: ["shrimp", "brown rice", "tomato", "garlic"], tags: ["shellfish", "seafood", "egyptian"], planning: true },
  { id: "chicken-potatoes", name: "Grilled chicken with roasted vegetables & potatoes", aliases: ["chicken and potatoes"], meal_types: LD, protein: 50, carbs: 55, fat: 18, ingredients: ["chicken breast", "potatoes", "zucchini", "carrots", "olive oil"], tags: ["chicken"], planning: true },
  { id: "salmon-rice", name: "Baked salmon with rice & greens", aliases: ["baked salmon"], meal_types: LD, protein: 42, carbs: 60, fat: 22, ingredients: ["salmon fillet", "rice", "green beans", "lemon"], tags: ["fish", "salmon"], planning: true },
  { id: "kofta-bread", name: "Lean kofta with baladi bread & salad", aliases: ["kofta sandwich"], meal_types: LD, protein: 40, carbs: 50, fat: 22, ingredients: ["lean beef kofta", "baladi bread", "tahini", "salad"], tags: ["beef", "gluten", "egyptian"], planning: true },
  { id: "tuna-sandwich", name: "Tuna sandwich on wholewheat bread", aliases: ["tuna sandwich"], meal_types: LD, protein: 34, carbs: 45, fat: 10, ingredients: ["tuna in water", "wholewheat bread", "lettuce", "tomato", "light mayo"], tags: ["fish", "tuna", "gluten"], planning: true },
  { id: "lentil-stew", name: "Lentil & vegetable stew with yogurt", aliases: ["lentil stew"], meal_types: LD, protein: 26, carbs: 65, fat: 10, ingredients: ["brown lentils", "carrot", "tomato", "greek yogurt"], tags: ["legumes", "dairy", "vegetarian", "egyptian"], planning: true },
  { id: "kebda", name: "Alexandrian kebda (liver) with baladi bread", aliases: ["kebda", "liver sandwich"], meal_types: LD, protein: 34, carbs: 48, fat: 14, ingredients: ["beef liver", "peppers", "garlic", "baladi bread"], tags: ["beef", "gluten", "egyptian"], planning: true },
  { id: "tilapia-freekeh", name: "Grilled tilapia with freekeh", aliases: ["fish with freekeh"], meal_types: LD, protein: 42, carbs: 50, fat: 10, ingredients: ["tilapia", "freekeh", "salad"], tags: ["fish", "gluten", "egyptian"], planning: true },
  { id: "chicken-fatta", name: "Light chicken fatta", aliases: ["fatta"], meal_types: LD, protein: 42, carbs: 70, fat: 18, ingredients: ["chicken breast", "rice", "toasted bread", "tomato-garlic sauce"], tags: ["chicken", "gluten", "egyptian"], planning: true },
  { id: "cottage-omelette", name: "Cottage-cheese omelette with salad & potatoes", aliases: ["cheese omelette"], meal_types: LD, protein: 32, carbs: 40, fat: 18, ingredients: ["3 eggs", "cottage cheese", "boiled potatoes", "salad"], tags: ["eggs", "dairy", "vegetarian"], planning: true },
  { id: "beef-pasta", name: "Lean beef bolognese with wholewheat pasta", aliases: ["bolognese"], meal_types: LD, protein: 40, carbs: 70, fat: 16, ingredients: ["lean minced beef", "wholewheat pasta", "tomato sauce"], tags: ["beef", "gluten"], planning: true },
  { id: "turkey-rice", name: "Turkey mince with rice & peas", aliases: ["turkey rice"], meal_types: LD, protein: 42, carbs: 62, fat: 12, ingredients: ["turkey mince", "rice", "peas", "carrot"], tags: ["turkey"], planning: true },

  // ---------------- Snacks ----------------
  { id: "yogurt-berries", name: "Greek yogurt with berries", aliases: ["greek yogurt", "yogurt"], meal_types: S, protein: 18, carbs: 20, fat: 3, ingredients: ["greek yogurt", "berries"], tags: ["dairy", "vegetarian"], planning: true },
  { id: "shake-banana", name: "Protein shake with banana", aliases: ["protein shake", "shake", "whey"], meal_types: S, protein: 27, carbs: 30, fat: 3, ingredients: ["whey protein", "banana", "water"], tags: ["dairy", "vegetarian"], planning: true },
  { id: "eggs-cucumber", name: "Boiled eggs & cucumber", aliases: ["boiled eggs"], meal_types: S, protein: 13, carbs: 4, fat: 10, ingredients: ["2 eggs", "cucumber"], tags: ["eggs", "vegetarian"], planning: true },
  { id: "hummus-veg", name: "Hummus with veggie sticks & wholewheat pita", aliases: ["hummus"], meal_types: S, protein: 9, carbs: 30, fat: 10, ingredients: ["hummus", "carrot", "cucumber", "wholewheat pita"], tags: ["legumes", "gluten", "vegetarian"], planning: true },
  { id: "cottage-dates", name: "Cottage cheese with dates", aliases: ["cottage cheese"], meal_types: S, protein: 16, carbs: 30, fat: 4, ingredients: ["cottage cheese", "3 dates"], tags: ["dairy", "egyptian", "vegetarian"], planning: true },
  { id: "nuts-apple", name: "Mixed nuts & apple", aliases: ["nuts", "almonds"], meal_types: S, protein: 6, carbs: 25, fat: 15, ingredients: ["mixed nuts", "apple"], tags: ["nuts", "vegetarian"], planning: true },
  { id: "tuna-ricecakes", name: "Tuna on rice cakes", aliases: ["rice cakes"], meal_types: S, protein: 22, carbs: 20, fat: 4, ingredients: ["tuna in water", "rice cakes"], tags: ["fish", "tuna"], planning: true },
  { id: "termis", name: "Termis (lupini beans)", aliases: ["termis", "lupini"], meal_types: S, protein: 16, carbs: 10, fat: 3, ingredients: ["lupini beans", "lemon", "cumin"], tags: ["legumes", "egyptian", "vegetarian"], planning: true },
  { id: "protein-bar", name: "Protein bar", aliases: ["bar"], meal_types: S, protein: 20, carbs: 22, fat: 7, ingredients: ["protein bar"], tags: ["dairy", "vegetarian"], planning: true },
  { id: "laban-dates", name: "Laban rayeb with oats", aliases: ["laban"], meal_types: S, protein: 12, carbs: 28, fat: 4, ingredients: ["laban rayeb", "oats"], tags: ["dairy", "egyptian", "vegetarian", "gluten"], planning: true },

  // ---------------- Common foods (logging only) ----------------
  { id: "koshary-large", name: "Koshary (large plate)", aliases: ["koshary", "koshari", "kushari", "koshery", "koshary"], meal_types: ANY, protein: 26, carbs: 160, fat: 18, ingredients: ["rice", "pasta", "lentils", "chickpeas", "fried onions", "tomato sauce"], tags: ["egyptian", "legumes", "gluten", "vegetarian"], planning: false },
  { id: "koshary-small", name: "Koshary (small plate)", aliases: ["small koshary"], meal_types: ANY, protein: 18, carbs: 110, fat: 12, ingredients: ["rice", "pasta", "lentils", "fried onions", "tomato sauce"], tags: ["egyptian", "legumes", "gluten", "vegetarian"], planning: false },
  { id: "pizza", name: "Pizza (2 slices)", aliases: ["pizza", "pepperoni pizza", "margherita"], meal_types: ANY, protein: 24, carbs: 70, fat: 26, ingredients: ["pizza dough", "cheese", "tomato sauce"], tags: ["gluten", "dairy"], planning: false },
  { id: "beef-shawarma-sandwich", name: "Beef shawarma sandwich", aliases: ["shawarma", "beef shawarma"], meal_types: ANY, protein: 28, carbs: 50, fat: 24, ingredients: ["beef shawarma", "bread", "tahini"], tags: ["beef", "gluten", "egyptian"], planning: false },
  { id: "chicken-shawarma-sandwich", name: "Chicken shawarma sandwich", aliases: ["chicken shawarma"], meal_types: ANY, protein: 30, carbs: 48, fat: 20, ingredients: ["chicken shawarma", "bread", "garlic sauce"], tags: ["chicken", "gluten", "egyptian"], planning: false },
  { id: "feteer", name: "Feteer meshaltet (quarter)", aliases: ["feteer", "fiteer"], meal_types: ANY, protein: 10, carbs: 60, fat: 34, ingredients: ["pastry", "ghee", "honey"], tags: ["gluten", "dairy", "egyptian", "vegetarian"], planning: false },
  { id: "burger-fries", name: "Burger with fries", aliases: ["burger", "hamburger", "cheeseburger"], meal_types: ANY, protein: 32, carbs: 95, fat: 45, ingredients: ["beef patty", "bun", "fries"], tags: ["beef", "gluten"], planning: false },
  { id: "ful-sandwich", name: "Ful sandwich", aliases: ["foul sandwich"], meal_types: ANY, protein: 10, carbs: 40, fat: 8, ingredients: ["fava beans", "baladi bread"], tags: ["egyptian", "legumes", "gluten", "vegetarian"], planning: false },
  { id: "taameya-sandwich", name: "Ta'ameya sandwich", aliases: ["taameya", "ta'ameya", "falafel"], meal_types: ANY, protein: 10, carbs: 45, fat: 15, ingredients: ["ta'ameya", "baladi bread", "tahini"], tags: ["egyptian", "legumes", "gluten", "vegetarian"], planning: false },
  { id: "fried-chicken", name: "Fried chicken meal (2 pieces + fries)", aliases: ["fried chicken", "broasted", "kfc"], meal_types: ANY, protein: 45, carbs: 70, fat: 50, ingredients: ["fried chicken", "fries"], tags: ["chicken", "gluten"], planning: false },
  { id: "basbousa", name: "Basbousa (1 piece)", aliases: ["basbousa"], meal_types: ANY, protein: 4, carbs: 48, fat: 14, ingredients: ["semolina", "syrup"], tags: ["gluten", "dairy", "egyptian", "vegetarian"], planning: false },
  { id: "om-ali", name: "Om Ali", aliases: ["om ali", "oum ali"], meal_types: ANY, protein: 10, carbs: 55, fat: 25, ingredients: ["pastry", "milk", "nuts"], tags: ["gluten", "dairy", "nuts", "egyptian", "vegetarian"], planning: false },
  { id: "macarona-bechamel", name: "Macarona bechamel", aliases: ["macarona", "bechamel"], meal_types: ANY, protein: 30, carbs: 65, fat: 30, ingredients: ["pasta", "minced beef", "bechamel"], tags: ["beef", "gluten", "dairy", "egyptian"], planning: false },
  { id: "mahshi", name: "Mahshi (plate)", aliases: ["mahshi", "stuffed vegetables"], meal_types: ANY, protein: 10, carbs: 70, fat: 15, ingredients: ["rice", "vegetables", "tomato sauce"], tags: ["egyptian", "vegetarian"], planning: false },
  { id: "pasta-tomato", name: "Pasta with tomato sauce", aliases: ["pasta", "spaghetti"], meal_types: ANY, protein: 16, carbs: 90, fat: 10, ingredients: ["pasta", "tomato sauce"], tags: ["gluten", "vegetarian"], planning: false },
  { id: "baladi-bread", name: "Baladi bread (1 loaf)", aliases: ["bread", "aish baladi", "pane"], meal_types: ANY, protein: 9, carbs: 50, fat: 2, ingredients: ["wholewheat flour"], tags: ["gluten", "egyptian", "vegetarian"], planning: false },
  { id: "banana", name: "Banana", aliases: ["banana"], meal_types: ANY, protein: 1, carbs: 27, fat: 0.4, ingredients: ["banana"], tags: ["vegetarian"], planning: false },
  { id: "apple", name: "Apple", aliases: ["apple"], meal_types: ANY, protein: 0.5, carbs: 25, fat: 0.3, ingredients: ["apple"], tags: ["vegetarian"], planning: false },
  { id: "sweet-potato-street", name: "Roasted sweet potato (batata)", aliases: ["batata", "sweet potato"], meal_types: ANY, protein: 4, carbs: 55, fat: 1, ingredients: ["sweet potato"], tags: ["egyptian", "vegetarian"], planning: false },
];

/** Food -> MealSnapshot, scaled to a number of servings. */
export function foodToSnapshot(food: Food, servings = 1): MealSnapshot {
  const base = normalizeMacros(food);
  const macros = servings === 1 ? base : scaleMacros(base, servings);
  return {
    meal_name: servings === 1 ? food.name : `${food.name} (${servings}× portion)`,
    ...macros,
    ingredients: food.ingredients,
    tags: food.tags,
  };
}

export function foodCalories(food: Food) {
  return caloriesFromMacros(food.protein, food.carbs, food.fat);
}

const norm = (s: string) =>
  s.toLowerCase().replace(/[’'`]/g, "").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

/**
 * Find the best catalog match for free text like "koshary" or "2 slices of pizza".
 * Returns null when nothing matches well enough (the caller must then ask the
 * user or rely on an explicit estimate).
 */
export function findFood(text: string): Food | null {
  const q = norm(text);
  if (!q) return null;
  let best: { food: Food; score: number } | null = null;
  for (const food of FOODS) {
    const names = [food.name, ...food.aliases].map(norm);
    for (const n of names) {
      let score = 0;
      if (q === n) score = 100;
      else if (q.includes(n)) score = 60 + n.length; // longer alias = more specific
      else if (n.includes(q) && q.length >= 4) score = 50 + q.length;
      else {
        const qt = new Set(q.split(" ").filter((t) => t.length > 2));
        const nt = n.split(" ").filter((t) => t.length > 2);
        const overlap = nt.filter((t) => qt.has(t)).length;
        if (overlap) score = (overlap / nt.length) * 45;
      }
      if (score > (best?.score ?? 0)) best = { food, score };
    }
  }
  return best && best.score >= 30 ? best.food : null;
}

/** Simple search for the logging autocomplete. */
export function searchFoods(text: string, limit = 6): Food[] {
  const q = norm(text);
  if (!q) return [];
  return FOODS.filter((f) => [f.name, ...f.aliases].some((n) => norm(n).includes(q))).slice(0, limit);
}
