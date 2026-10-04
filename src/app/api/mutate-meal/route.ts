import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DEMO_GYM_ID } from "@/lib/agent/seed-data";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      memberId,
      targetDate,
      targetSlot,
      meal,
      actionType = "replace_meal",
      userRequest,
      summary,
      rebalanceDinner = true,
      gymId = DEMO_GYM_ID,
    } = body;

    console.log("MUTATION REQUEST:", {
      memberId,
      targetDate,
      targetSlot,
      meal,
      actionType,
      userRequest,
    });

    // 1. Validation
    if (!memberId || !targetDate || !targetSlot || !meal || !meal.meal_name) {
      console.warn("MUTATION VALIDATION FAILED: Missing required fields");
      return NextResponse.json(
        { success: false, error: "Validation failed: missing required fields for meal mutation." },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // 2. Protected Logged Meals Check
    const { data: existingLogs, error: logErr } = await supabase
      .from("meal_logs")
      .select("id, meal_name")
      .eq("member_id", memberId)
      .eq("date", targetDate)
      .eq("meal_type", targetSlot);

    if (!logErr && existingLogs && existingLogs.length > 0) {
      console.warn(`MUTATION PREVENTED: ${targetSlot} on ${targetDate} is already logged.`);
      return NextResponse.json(
        {
          success: false,
          error: `Meal in slot '${targetSlot}' for date '${targetDate}' is already logged as eaten.`,
          isLogged: true,
        },
        { status: 409 }
      );
    }

    // 3. Find or create active plan in nutrition_plans
    const { data: plans } = await supabase
      .from("nutrition_plans")
      .select("id")
      .eq("member_id", memberId)
      .eq("status", "active")
      .order("start_date", { ascending: false })
      .limit(1);

    let planId = plans?.[0]?.id;
    if (!planId) {
      const { data: newPlan, error: planErr } = await supabase
        .from("nutrition_plans")
        .insert({
          member_id: memberId,
          start_date: targetDate,
          end_date: targetDate,
          status: "active",
        })
        .select("id")
        .single();

      if (!planErr && newPlan) {
        planId = newPlan.id;
      } else {
        planId = `plan-${memberId}`;
      }
    }

    // 4. Upsert meal into planned_meals
    const mealPayload = {
      plan_id: planId,
      member_id: memberId,
      date: targetDate,
      meal_type: targetSlot,
      meal_name: meal.meal_name,
      calories: Number(meal.calories) || 0,
      protein: Number(meal.protein) || 0,
      carbs: Number(meal.carbs) || 0,
      fat: Number(meal.fat) || 0,
      ingredients: meal.ingredients || [],
      tags: meal.tags || [targetSlot, "agent"],
      source: "agent",
      updated_at: new Date().toISOString(),
    };

    const { data: updatedMeal, error: upsertErr } = await supabase
      .from("planned_meals")
      .upsert(mealPayload, { onConflict: "plan_id,date,meal_type" })
      .select("*")
      .single();

    if (upsertErr) {
      console.warn("Supabase upsert error on planned_meals, attempting delete & insert fallback:", upsertErr.message);
      await supabase
        .from("planned_meals")
        .delete()
        .eq("member_id", memberId)
        .eq("date", targetDate)
        .eq("meal_type", targetSlot);

      await supabase.from("planned_meals").insert(mealPayload);
    }

    console.log("SUPABASE UPDATE RESULT (planned_meals):", {
      success: !upsertErr,
      meal: updatedMeal || mealPayload,
      error: upsertErr?.message,
    });

    // 5. Record agent action in agent_actions
    const actionPayload = {
      member_id: memberId,
      gym_id: gymId,
      initiated_by: memberId,
      action_type: actionType,
      user_request: userRequest || `Update ${targetSlot} to ${meal.meal_name}`,
      summary: summary || `Updated ${targetSlot} to ${meal.meal_name} (${meal.calories} kcal)`,
      tools_used: [
        { tool: "replace_meal", summary: `Assigned ${meal.meal_name} to ${targetDate} ${targetSlot}` },
        { tool: "calculate_remaining_nutrition", summary: "Recalculated daily macro balance" },
      ],
      proposed_change: null,
      requires_coach_approval: false,
      approved: true,
      execution_status: "executed",
      decided_by: memberId,
      decided_at: new Date().toISOString(),
      decision_note: "Approved by member in Ask NutriCoach",
      estimated_manual_minutes: 8,
      estimated_agent_minutes: 0.5,
      estimated_minutes_saved: 8,
      estimated_cost_value: 26.67,
      created_at: new Date().toISOString(),
    };

    const { error: actionErr } = await supabase.from("agent_actions").insert(actionPayload);
    if (actionErr) {
      console.warn("Supabase agent_actions insert note:", actionErr.message);
    }

    return NextResponse.json({
      success: true,
      memberId,
      targetDate,
      targetSlot,
      meal: mealPayload,
      action: actionPayload,
    });
  } catch (error: any) {
    console.error("Mutation API route error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Internal server error during mutation" },
      { status: 500 }
    );
  }
}
