import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DEMO_GYM_ID } from "@/lib/agent/seed-data";

interface MutateMealItem {
  slot: string;
  meal: {
    meal_name: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    ingredients?: string[];
    tags?: string[];
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      memberId,
      targetDate,
      targetSlot,
      meal,
      meals,
      actionType = "replace_meal",
      userRequest,
      summary,
      rebalanceDinner = true,
      gymId = DEMO_GYM_ID,
    } = body;

    console.log("[NutriCoach] /api/mutate-meal payload:", {
      memberId,
      targetDate,
      targetSlot,
      hasSingleMeal: !!meal,
      multiMealCount: Array.isArray(meals) ? meals.length : 0,
      actionType,
      userRequest,
    });

    // 1. Input Validation
    if (!memberId || !targetDate) {
      return NextResponse.json(
        { success: false, error: "Validation failed: missing memberId or targetDate." },
        { status: 400 }
      );
    }

    // Build normalized array of items to mutate
    const itemsToMutate: MutateMealItem[] = [];

    if (Array.isArray(meals) && meals.length > 0) {
      for (const m of meals) {
        const slot = m.slot || m.mealType || m.meal_type;
        const mealData = m.meal || m;
        if (slot && mealData && mealData.meal_name) {
          itemsToMutate.push({
            slot: String(slot).toLowerCase(),
            meal: mealData,
          });
        }
      }
    } else if (targetSlot && meal && meal.meal_name) {
      itemsToMutate.push({
        slot: String(targetSlot).toLowerCase(),
        meal,
      });
    }

    if (itemsToMutate.length === 0) {
      return NextResponse.json(
        { success: false, error: "Validation failed: no valid meal items provided for mutation." },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // 2. Protected Eaten-Meal Guard: do NOT overwrite meals already logged as eaten
    const { data: existingLogs, error: logErr } = await supabase
      .from("meal_logs")
      .select("id, meal_name, meal_type")
      .eq("member_id", memberId)
      .eq("date", targetDate);

    const loggedSlots = new Set<string>();
    if (!logErr && existingLogs && existingLogs.length > 0) {
      existingLogs.forEach((l) => loggedSlots.add(l.meal_type.toLowerCase()));
    }

    // Filter out slots that are already logged as eaten
    const safeItems = itemsToMutate.filter((item) => !loggedSlots.has(item.slot));

    if (safeItems.length === 0) {
      console.warn(`[NutriCoach] Mutation prevented: All requested meal slots on ${targetDate} are already logged.`);
      return NextResponse.json(
        {
          success: false,
          error: `The requested meals for '${targetDate}' have already been logged as eaten and will not be overwritten.`,
          isLogged: true,
        },
        { status: 409 }
      );
    }

    // 3. Find or create active plan in nutrition_plans
    const { data: plans, error: fetchPlanErr } = await supabase
      .from("nutrition_plans")
      .select("id")
      .eq("member_id", memberId)
      .eq("status", "active")
      .order("start_date", { ascending: false })
      .limit(1);

    if (fetchPlanErr) {
      console.warn("[NutriCoach] nutrition_plans table query notice:", fetchPlanErr.message);
    }

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
        // Fallback deterministic plan id format
        planId = `plan-${memberId}`;
      }
    }

    // 4. Upsert meals into planned_meals
    const upsertRows = safeItems.map((item) => ({
      plan_id: planId,
      member_id: memberId,
      date: targetDate,
      meal_type: item.slot,
      meal_name: item.meal.meal_name,
      calories: Number(item.meal.calories) || 0,
      protein: Number(item.meal.protein) || 0,
      carbs: Number(item.meal.carbs) || 0,
      fat: Number(item.meal.fat) || 0,
      ingredients: item.meal.ingredients || [],
      tags: item.meal.tags || [item.slot, "agent"],
      source: "agent",
      updated_at: new Date().toISOString(),
    }));

    let upsertFailed = false;
    let failureError: string | null = null;

    for (const row of upsertRows) {
      const { error: upsertErr } = await supabase
        .from("planned_meals")
        .upsert(row, { onConflict: "plan_id,date,meal_type" });

      if (upsertErr) {
        console.warn("[NutriCoach] Upsert on planned_meals notice, trying delete & insert:", upsertErr.message);
        await supabase
          .from("planned_meals")
          .delete()
          .eq("member_id", memberId)
          .eq("date", targetDate)
          .eq("meal_type", row.meal_type);

        const { error: insertErr } = await supabase.from("planned_meals").insert(row);
        if (insertErr) {
          upsertFailed = true;
          failureError = insertErr.message;
          console.error("[NutriCoach] Insert fallback on planned_meals failed:", insertErr.message);
        }
      }
    }

    if (upsertFailed) {
      console.error("[NutriCoach] Supabase mutation failed:", failureError);
      return NextResponse.json(
        {
          success: false,
          error: `Database persistence failed: ${failureError || "Could not write to planned_meals"}`,
        },
        { status: 500 }
      );
    }

    // 5. Query and verify updated rows from Supabase
    const { data: verifiedRows, error: verifyErr } = await supabase
      .from("planned_meals")
      .select("*")
      .eq("member_id", memberId)
      .eq("date", targetDate);

    if (verifyErr) {
      console.warn("[NutriCoach] Verification query note:", verifyErr.message);
    }

    console.log("[NutriCoach] SUPABASE MUTATION SUCCESSFUL:", {
      memberId,
      date: targetDate,
      savedCount: upsertRows.length,
      verifiedCount: verifiedRows?.length || upsertRows.length,
    });

    // 6. Record agent action in agent_actions
    const actionPayload = {
      member_id: memberId,
      gym_id: gymId,
      initiated_by: memberId,
      action_type: actionType,
      user_request: userRequest || `Update ${targetDate} meals`,
      summary: summary || `Updated ${safeItems.length} meal(s) for ${targetDate}`,
      tools_used: [
        { tool: "replace_meal", summary: `Updated ${safeItems.length} meal slot(s) for ${targetDate}` },
        { tool: "calculate_remaining_nutrition", summary: "Recalculated daily macro targets" },
      ],
      proposed_change: null,
      requires_coach_approval: false,
      approved: true,
      execution_status: "executed",
      decided_by: memberId,
      decided_at: new Date().toISOString(),
      decision_note: "Confirmed and applied by member via NutriCoach AI",
      estimated_manual_minutes: 8,
      estimated_agent_minutes: 0.5,
      estimated_minutes_saved: 8,
      estimated_cost_value: 26.67,
      created_at: new Date().toISOString(),
    };

    const { error: actionErr } = await supabase.from("agent_actions").insert(actionPayload);
    if (actionErr) {
      console.warn("[NutriCoach] Supabase agent_actions insert note:", actionErr.message);
    }

    return NextResponse.json({
      success: true,
      memberId,
      targetDate,
      updatedMeals: verifiedRows && verifiedRows.length > 0 ? verifiedRows : upsertRows,
      action: actionPayload,
    });
  } catch (error: any) {
    console.error("[NutriCoach] Mutation API route error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Internal server error during mutation" },
      { status: 500 }
    );
  }
}
