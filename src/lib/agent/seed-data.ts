// =============================================================================
// Seed Data: 6 Demo Members + Coach + Gym
// =============================================================================

import { addDays, todayISO } from "../dates";
import { FOODS, foodToSnapshot } from "../foods";
import type { Gym, Profile, Targets, PlannedMeal, MealLog } from "../types";

export const DEMO_GYM_ID = "00000000-0000-0000-0000-000000000001";
export const DEMO_COACH_ID = "00000000-0000-0000-0000-000000000002";
export const DEMO_ADMIN_ID = "00000000-0000-0000-0000-000000000003";

export const DEMO_GYM: Gym = {
  id: DEMO_GYM_ID,
  name: "Olympia Fitness Heliopolis",
  subscription_price: 500, // EGP / member / month
  traditional_nutrition_price: 300, // EGP / member / month
  estimated_coach_hourly_value: 200, // EGP / hr
  estimated_manual_minutes_per_member: 120, // mins / month
  estimated_agent_minutes_per_member: 30, // mins / month
  ai_cost: 10, // EGP / member / month
  infrastructure_cost: 1500, // EGP / month
  modeled_member_count: 50,
  usd_to_egp: 48,
};

export const DEMO_COACH: Profile = {
  id: DEMO_COACH_ID,
  gym_id: DEMO_GYM_ID,
  role: "coach",
  coach_id: null,
  name: "Coach Karim El-Sayed",
  email: "karim@olympiafit.eg",
  age: 32,
  sex: "male",
  height: 182,
  weight: 84,
  goal: "Staff Coach",
  activity_level: "very_active",
  dietary_preferences: [],
  disliked_foods: [],
  allergies: [],
  medical_notes: null,
  subscription_status: "active",
  demo_scenario: null,
  created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
};

export interface DemoMemberSpec {
  id: string;
  name: string;
  email: string;
  age: number;
  sex: "male" | "female";
  height: number;
  weight: number;
  goal: string;
  activity_level: string;
  dietary_preferences: string[];
  disliked_foods: string[];
  allergies: string[];
  scenario: "stable" | "single_miss" | "repeated_deviation" | "protein_gap" | "preference_shift" | "inactive";
  scenarioLabel: string;
  scenarioDescription: string;
  targets: { calories: number; protein: number; carbs: number; fat: number; water: number };
}

export const DEMO_MEMBERS: DemoMemberSpec[] = [
  {
    id: "00000000-0000-0000-0000-000000000011",
    name: "Omar Hassan",
    email: "omar@example.com",
    age: 28,
    sex: "male",
    height: 178,
    weight: 79,
    goal: "Lean Muscle Gain",
    activity_level: "moderate",
    dietary_preferences: [],
    disliked_foods: [],
    allergies: [],
    scenario: "stable",
    scenarioLabel: "Consistent progress (6 days)",
    scenarioDescription: "Follows plan with high adherence. Agent recognizes stability and avoids unnecessary changes.",
    targets: { calories: 2300, protein: 160, carbs: 250, fat: 70, water: 3 },
  },
  {
    id: "00000000-0000-0000-0000-000000000012",
    name: "Sara Mahmoud",
    email: "sara@example.com",
    age: 26,
    sex: "female",
    height: 165,
    weight: 62,
    goal: "Fat Loss & Tone",
    activity_level: "moderate",
    dietary_preferences: [],
    disliked_foods: [],
    allergies: [],
    scenario: "single_miss",
    scenarioLabel: "One missed day",
    scenarioDescription: "Missed logging yesterday. Agent avoids overreacting, maintaining plan and monitoring.",
    targets: { calories: 1750, protein: 120, carbs: 180, fat: 55, water: 2.5 },
  },
  {
    id: "00000000-0000-0000-0000-000000000013",
    name: "Layla Mostafa",
    email: "layla@example.com",
    age: 27,
    sex: "female",
    height: 168,
    weight: 66,
    goal: "Recomposition & Fat Loss",
    activity_level: "moderate",
    dietary_preferences: [],
    disliked_foods: [],
    allergies: [],
    scenario: "repeated_deviation",
    scenarioLabel: "Repeated deviations (Koshary / Pizza)",
    scenarioDescription: "Frequent off-plan carbohydrate spikes on weekends. Agent detects pattern and adapts dinner / weekly plan.",
    targets: { calories: 2000, protein: 140, carbs: 210, fat: 62, water: 2.5 },
  },
  {
    id: "00000000-0000-0000-0000-000000000014",
    name: "Ahmed Nabil",
    email: "ahmed@example.com",
    age: 31,
    sex: "male",
    height: 180,
    weight: 88,
    goal: "Hypertrophy & Strength",
    activity_level: "active",
    dietary_preferences: [],
    disliked_foods: [],
    allergies: [],
    scenario: "protein_gap",
    scenarioLabel: "Protein gap (Calories on target)",
    scenarioDescription: "Hits calories but protein is under 80g / 170g target. Agent recommends protein-dense adjustments.",
    targets: { calories: 2400, protein: 170, carbs: 260, fat: 75, water: 3.5 },
  },
  {
    id: "00000000-0000-0000-0000-000000000015",
    name: "Mariam Farid",
    email: "mariam@example.com",
    age: 25,
    sex: "female",
    height: 162,
    weight: 58,
    goal: "Healthy Maintenance",
    activity_level: "light",
    dietary_preferences: ["pescatarian"],
    disliked_foods: ["chicken"],
    allergies: [],
    scenario: "preference_shift",
    scenarioLabel: "Changing preferences ('No chicken')",
    scenarioDescription: "Shifts food preferences. Agent updates preferences and replaces upcoming chicken dishes.",
    targets: { calories: 1800, protein: 110, carbs: 210, fat: 55, water: 2 },
  },
  {
    id: "00000000-0000-0000-0000-000000000016",
    name: "Youssef Adel",
    email: "youssef@example.com",
    age: 34,
    sex: "male",
    height: 175,
    weight: 92,
    goal: "Weight Loss",
    activity_level: "sedentary",
    dietary_preferences: [],
    disliked_foods: [],
    allergies: [],
    scenario: "inactive",
    scenarioLabel: "No recent logs (4+ days inactive)",
    scenarioDescription: "Stopped logging 4 days ago. Agent detects risk and drafts a coach follow-up check-in.",
    targets: { calories: 2100, protein: 150, carbs: 220, fat: 65, water: 3 },
  },
];
