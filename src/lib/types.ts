// Shared domain types for NutriCoach. These mirror the Supabase tables.

export type Role = "admin" | "coach" | "member";
export type MealType = "breakfast" | "lunch" | "snack" | "dinner" | "snack_2" | "pre_workout" | "post_workout" | "dessert" | "late_night" | string;
export const MEAL_TYPES: string[] = ["breakfast", "lunch", "snack", "dinner", "snack_2", "pre_workout", "post_workout", "dessert", "late_night"];

export interface Macros {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface MemberMessage {
  id: string;
  member_id: string;
  sender: "member" | "coach" | "agent";
  text: string;
  actionCard?: {
    type: "plan_updated" | "logged" | "info" | "question_sent";
    title: string;
    details: string;
    actionLabel: string;
    targetTab?: "plan" | "today" | "progress";
  };
  pendingConfirmation?: {
    type: "add_meal";
    mealName: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    mealType: string;
    targetDate: string;
    isExtraSnack?: boolean;
  };
  created_at: string;
}

export interface Gym {
  id: string;
  name: string;
  subscription_price: number;
  traditional_nutrition_price: number;
  estimated_coach_hourly_value: number;
  estimated_manual_minutes_per_member: number;
  estimated_agent_minutes_per_member: number;
  ai_cost: number;
  infrastructure_cost: number;
  modeled_member_count: number;
  usd_to_egp: number;
}

export interface Profile {
  id: string;
  gym_id: string;
  role: Role;
  coach_id: string | null;
  name: string;
  email: string | null;
  age: number | null;
  sex: string | null;
  height: number | null;
  weight: number | null;
  goal: string | null;
  target_delta?: number | null;
  target_unit?: string | null;
  activity_level: string | null;
  dietary_preferences: string[];
  disliked_foods: string[];
  allergies: string[];
  medical_notes: string | null;
  subscription_status: string;
  demo_scenario: string | null;
  created_at: string;
}

export interface Targets extends Macros {
  id: string;
  member_id: string;
  water: number;
  meals_per_day: number;
  updated_at: string;
}

export interface PlannedMeal extends Macros {
  id: string;
  plan_id: string;
  member_id: string;
  date: string;
  meal_type: MealType;
  meal_name: string;
  ingredients: string[];
  tags: string[];
  source: string;
  updated_at: string;
}

export interface MealLog extends Macros {
  id: string;
  member_id: string;
  date: string;
  meal_type: MealType;
  meal_name: string;
  notes: string | null;
  matched_plan: boolean;
  estimated: boolean;
  created_at: string;
}

/** A meal as proposed by the agent (not yet saved). */
export interface MealSnapshot extends Macros {
  meal_name: string;
  ingredients: string[];
  tags: string[];
}

export interface MealChange {
  date: string;
  meal_type: MealType;
  before: MealSnapshot | null;
  after: MealSnapshot;
}

export interface VerificationCheck {
  label: string;
  ok: boolean;
  detail: string;
}

export interface Verification {
  ok: boolean;
  checks: VerificationCheck[];
}

export type ProposalKind =
  | "replace_meal"
  | "adapt_daily_plan"
  | "adapt_weekly_plan"
  | "generate_meal_plan"
  | "update_preferences"
  | "coach_followup"
  | "insight";

/** Stored in agent_actions.proposed_change */
export interface ProposedChange {
  kind: ProposalKind;
  title: string;
  explanation: string;
  changes?: MealChange[];
  /** replace_meal: the member picks one option, which becomes changes[0].after */
  options?: MealSnapshot[];
  selected_option?: number;
  preference_update?: { add_dislikes: string[]; remove_dislikes: string[]; add_allergies: string[] };
  followup?: { followup_id: string; message: string; reason: string };
  verification?: Verification;
  safety_note?: string;
  edited_by_coach?: boolean;
}

export type ExecutionStatus = "proposed" | "pending_coach" | "executed" | "rejected";

export interface AgentAction {
  id: string;
  member_id: string;
  gym_id: string | null;
  initiated_by: string | null;
  action_type: string;
  user_request: string | null;
  summary: string | null;
  tools_used: ToolTraceEntry[];
  proposed_change: ProposedChange | null;
  requires_coach_approval: boolean;
  approved: boolean | null;
  execution_status: ExecutionStatus;
  decided_by: string | null;
  decided_at: string | null;
  decision_note: string | null;
  estimated_manual_minutes: number;
  estimated_agent_minutes: number;
  estimated_minutes_saved: number;
  estimated_cost_value: number;
  created_at: string;
}

export interface ToolTraceEntry {
  tool: string;
  args?: Record<string, unknown>;
  summary: string;
}

export interface CoachFollowup {
  id: string;
  member_id: string;
  coach_id: string | null;
  agent_action_id: string | null;
  reason: string | null;
  message: string;
  status: "draft" | "sent" | "dismissed";
  created_at: string;
  decided_at: string | null;
}

export interface AiUsage {
  id: string;
  gym_id?: string | null;
  member_id: string | null;
  actor_id?: string | null;
  model: string;
  input_tokens: number;
  output_tokens: number;
  request_count: number;
  estimated_cost_usd: number;
  created_at: string;
}

export interface ModelPricing {
  model: string;
  input_usd_per_million: number;
  output_usd_per_million: number;
}
