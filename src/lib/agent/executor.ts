// =============================================================================
// Executor: Applies approved agent proposals to Supabase tables.
// =============================================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import { impactFor } from "../impact";
import type { AgentAction, ExecutionStatus, Gym, MealChange, ProposedChange, Role } from "../types";

export interface DecisionResult {
  action: AgentAction;
  success: boolean;
  message: string;
}

export async function decideProposal(params: {
  db: SupabaseClient;
  gym: Gym;
  actionId: string;
  decision: "approve" | "reject";
  decidedBy: { id: string; role: Role; name?: string };
  editedChange?: ProposedChange;
  note?: string;
}): Promise<DecisionResult> {
  const { db, gym, actionId, decision, decidedBy, editedChange, note } = params;

  // Load the proposed action
  const { data: action, error: fetchErr } = await db
    .from("agent_actions")
    .select("*")
    .eq("id", actionId)
    .single<AgentAction>();

  if (fetchErr || !action) {
    return {
      action: null as any,
      success: false,
      message: `Action ${actionId} not found: ${fetchErr?.message}`,
    };
  }

  if (action.execution_status === "executed" || action.execution_status === "rejected") {
    return {
      action,
      success: true,
      message: `Action was already ${action.execution_status}.`,
    };
  }

  const proposal = editedChange || action.proposed_change;
  if (!proposal && decision === "approve") {
    return { action, success: false, message: "No proposal payload found on action." };
  }

  const now = new Date().toISOString();

  if (decision === "reject") {
    const { data: updated, error: updateErr } = await db
      .from("agent_actions")
      .update({
        execution_status: "rejected" as ExecutionStatus,
        approved: false,
        decided_by: decidedBy.id,
        decided_at: now,
        decision_note: note || "Declined by user",
      })
      .eq("id", actionId)
      .select("*")
      .single<AgentAction>();

    if (updateErr) throw new Error(updateErr.message);
    return { action: updated!, success: true, message: "Proposal was declined." };
  }

  // --- Decision is APPROVE: Execute based on proposal kind ---
  const memberId = action.member_id;

  if (proposal?.kind === "replace_meal" || proposal?.kind === "adapt_daily_plan" || proposal?.kind === "adapt_weekly_plan" || proposal?.kind === "generate_meal_plan") {
    const changes: MealChange[] = proposal.changes || [];
    
    // If selected_option is set on replace_meal, use that option as changes[0].after
    if (proposal.kind === "replace_meal" && proposal.options && proposal.selected_option !== undefined) {
      const selected = proposal.options[proposal.selected_option];
      if (selected && changes[0]) {
        changes[0].after = selected;
      }
    }

    for (const chg of changes) {
      // Find existing active plan for the member
      const { data: plans } = await db
        .from("nutrition_plans")
        .select("id")
        .eq("member_id", memberId)
        .eq("status", "active")
        .order("start_date", { ascending: false })
        .limit(1);

      let planId = plans?.[0]?.id;
      if (!planId) {
        // Create an active plan if none exists
        const { data: newPlan } = await db
          .from("nutrition_plans")
          .insert({
            member_id: memberId,
            start_date: chg.date,
            end_date: chg.date,
            status: "active",
          })
          .select("id")
          .single();
        planId = newPlan?.id;
      }

      // Upsert meal in planned_meals
      const { error: upsertErr } = await db.from("planned_meals").upsert(
        {
          plan_id: planId,
          member_id: memberId,
          date: chg.date,
          meal_type: chg.meal_type,
          meal_name: chg.after.meal_name,
          calories: chg.after.calories,
          protein: chg.after.protein,
          carbs: chg.after.carbs,
          fat: chg.after.fat,
          ingredients: chg.after.ingredients,
          tags: chg.after.tags,
          source: "agent",
          updated_at: now,
        },
        { onConflict: "plan_id,date,meal_type" }
      );

      if (upsertErr) {
        // Fallback without constraint if unique key differs
        await db.from("planned_meals").delete().eq("member_id", memberId).eq("date", chg.date).eq("meal_type", chg.meal_type);
        await db.from("planned_meals").insert({
          plan_id: planId,
          member_id: memberId,
          date: chg.date,
          meal_type: chg.meal_type,
          meal_name: chg.after.meal_name,
          calories: chg.after.calories,
          protein: chg.after.protein,
          carbs: chg.after.carbs,
          fat: chg.after.fat,
          ingredients: chg.after.ingredients,
          tags: chg.after.tags,
          source: "agent",
          updated_at: now,
        });
      }
    }
  } else if (proposal?.kind === "update_preferences") {
    // 1. Update preferences in profiles table
    const { data: profile } = await db.from("profiles").select("disliked_foods, allergies").eq("id", memberId).single();
    if (profile && proposal.preference_update) {
      const { add_dislikes, remove_dislikes, add_allergies } = proposal.preference_update;
      const currentDislikes: string[] = profile.disliked_foods || [];
      const currentAllergies: string[] = profile.allergies || [];
      const newDislikes = [...new Set([...currentDislikes.filter((d) => !remove_dislikes.includes(d)), ...add_dislikes])];
      const newAllergies = [...new Set([...currentAllergies, ...add_allergies])];

      await db.from("profiles").update({ disliked_foods: newDislikes, allergies: newAllergies }).eq("id", memberId);
    }

    // 2. Apply meal changes if any were generated
    if (proposal.changes?.length) {
      for (const chg of proposal.changes) {
        await db
          .from("planned_meals")
          .update({
            meal_name: chg.after.meal_name,
            calories: chg.after.calories,
            protein: chg.after.protein,
            carbs: chg.after.carbs,
            fat: chg.after.fat,
            ingredients: chg.after.ingredients,
            tags: chg.after.tags,
            source: "agent",
            updated_at: now,
          })
          .eq("member_id", memberId)
          .eq("date", chg.date)
          .eq("meal_type", chg.meal_type);
      }
    }
  } else if (proposal?.kind === "coach_followup") {
    // Mark follow-up as sent
    if (proposal.followup?.followup_id) {
      await db
        .from("coach_followups")
        .update({ status: "sent", decided_at: now, coach_id: decidedBy.id })
        .eq("id", proposal.followup.followup_id);
    }
  }

  // Calculate business impact values
  const impact = impactFor(action.action_type, gym.estimated_coach_hourly_value);

  // Update action to executed status
  const { data: updated, error: finishErr } = await db
    .from("agent_actions")
    .update({
      execution_status: "executed" as ExecutionStatus,
      approved: true,
      decided_by: decidedBy.id,
      decided_at: now,
      decision_note: note || (editedChange ? "Approved with edits" : "Approved by coach/member"),
      estimated_minutes_saved: impact.estimated_minutes_saved,
      estimated_cost_value: impact.estimated_cost_value,
      proposed_change: proposal,
    })
    .eq("id", actionId)
    .select("*")
    .single<AgentAction>();

  if (finishErr) throw new Error(finishErr.message);

  return {
    action: updated!,
    success: true,
    message: "Change approved and successfully applied.",
  };
}
