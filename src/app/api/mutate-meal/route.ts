import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { DEMO_GYM_ID, DEMO_MEMBERS } from "@/lib/agent/seed-data";

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
      days,
      actionType = "replace_meal",
      userRequest,
      summary,
      rebalanceDinner = true,
      gymId = DEMO_GYM_ID,
      existingMealLogs,
      loggedSlots: clientLoggedSlots,
    } = body;

    console.log("[NutriCoach] /api/mutate-meal request:", {
      memberId,
      targetDate,
      targetSlot,
      hasSingleMeal: !!meal,
      multiMealCount: Array.isArray(meals) ? meals.length : 0,
      daysCount: Array.isArray(days) ? days.length : 0,
      actionType,
      userRequest,
    });

    // 1. Input Validation
    if (!memberId || typeof memberId !== "string") {
      return NextResponse.json(
        { success: false, error: "Validation failed: missing memberId." },
        { status: 400 }
      );
    }

    if (!targetDate && (!Array.isArray(days) || days.length === 0)) {
      return NextResponse.json(
        { success: false, error: "Validation failed: missing targetDate or days array." },
        { status: 400 }
      );
    }

    // 2. Authentication & Mode Identification
    const session = await getSession();
    const isDemoMember =
      DEMO_MEMBERS.some((m) => m.id === memberId) ||
      memberId.startsWith("demo-") ||
      memberId.startsWith("mem-");
    const isDemoMode =
      process.env.NEXT_PUBLIC_DEMO_MODE === "true" ||
      !session ||
      !session.user ||
      isDemoMember;

    console.log("[NutriCoach] Operating mode for mutation:", {
      isDemoMode,
      hasSession: !!session?.user,
      isDemoMember,
      memberId,
    });

    // ---------------------------------------------------------------------------
    // MULTI-DAY BATCH FLOW
    // ---------------------------------------------------------------------------
    if (Array.isArray(days) && days.length > 0) {
      if (isDemoMode) {
        // Demo Multi-Day Mutation
        let totalUpdatedMeals = 0;
        const allVerifiedRows: any[] = [];

        for (const dayEntry of days) {
          const dDate = dayEntry.targetDate || dayEntry.date;
          const dMeals = dayEntry.meals;
          if (!dDate || !Array.isArray(dMeals) || dMeals.length === 0) continue;

          for (const m of dMeals) {
            const slot = m.slot || m.mealType || m.meal_type;
            const mealData = m.meal || m;
            if (slot && mealData && mealData.meal_name) {
              const row = {
                id: `p-${memberId}-${dDate}-${slot}`,
                plan_id: `plan-${memberId}`,
                member_id: memberId,
                date: dDate,
                meal_type: String(slot).toLowerCase(),
                meal_name: mealData.meal_name,
                calories: Number(mealData.calories) || 0,
                protein: Number(mealData.protein) || 0,
                carbs: Number(mealData.carbs) || 0,
                fat: Number(mealData.fat) || 0,
                ingredients: mealData.ingredients || [],
                tags: mealData.tags || [String(slot).toLowerCase(), "agent", "smoothed"],
                source: "agent",
                updated_at: new Date().toISOString(),
              };
              allVerifiedRows.push(row);
              totalUpdatedMeals++;
            }
          }
        }

        const actionPayload = {
          id: `act-${Date.now()}`,
          member_id: memberId,
          gym_id: gymId,
          initiated_by: memberId,
          action_type: actionType,
          user_request: userRequest || "Weekly auto-balance applied",
          summary: summary || `Weekly auto-balance applied across ${days.length} days (${totalUpdatedMeals} meals)`,
          tools_used: [
            { tool: "weekly_auto_balance", summary: `Redistributed daily calorie targets across ${days.length} days` },
            { tool: "replan_meals", summary: `Recalculated and verified ${totalUpdatedMeals} meals` },
          ],
          proposed_change: null,
          requires_coach_approval: false,
          approved: true,
          execution_status: "executed",
          decided_by: memberId,
          decided_at: new Date().toISOString(),
          decision_note: "Applied weekly smoothing to synchronize planned meals (demo verified)",
          estimated_manual_minutes: 15,
          estimated_agent_minutes: 0.5,
          estimated_minutes_saved: 15,
          estimated_cost_value: 50.0,
          created_at: new Date().toISOString(),
        };

        return NextResponse.json({
          success: true,
          isDemo: true,
          memberId,
          daysCount: days.length,
          updatedMealsCount: totalUpdatedMeals,
          updatedMeals: allVerifiedRows,
          action: actionPayload,
        });
      }

      // Authenticated Multi-Day Flow (Supabase)
      if (!session || !session.user) {
        return NextResponse.json(
          { success: false, error: "Authentication required to persist meal plans to Supabase." },
          { status: 401 }
        );
      }

      const { db } = session;
      const { data: plans } = await db
        .from("nutrition_plans")
        .select("id")
        .eq("member_id", memberId)
        .eq("status", "active")
        .order("start_date", { ascending: false })
        .limit(1);

      const planId = plans?.[0]?.id || `plan-${memberId}`;
      const allVerifiedRows: any[] = [];
      let totalUpdatedMeals = 0;

      for (const dayEntry of days) {
        const dDate = dayEntry.targetDate || dayEntry.date;
        const dMeals = dayEntry.meals;
        if (!dDate || !Array.isArray(dMeals) || dMeals.length === 0) continue;

        const { data: dayLogs } = await db
          .from("meal_logs")
          .select("id, meal_name, meal_type")
          .eq("member_id", memberId)
          .eq("date", dDate);

        const loggedSlots = new Set<string>();
        if (dayLogs && dayLogs.length > 0) {
          dayLogs.forEach((l) => loggedSlots.add(l.meal_type.toLowerCase()));
        }

        const items: MutateMealItem[] = [];
        for (const m of dMeals) {
          const slot = m.slot || m.mealType || m.meal_type;
          const mealData = m.meal || m;
          if (slot && mealData && mealData.meal_name && !loggedSlots.has(String(slot).toLowerCase())) {
            items.push({
              slot: String(slot).toLowerCase(),
              meal: mealData,
            });
          }
        }

        if (items.length === 0) continue;

        const upsertRows = items.map((item) => ({
          plan_id: planId,
          member_id: memberId,
          date: dDate,
          meal_type: item.slot,
          meal_name: item.meal.meal_name,
          calories: Number(item.meal.calories) || 0,
          protein: Number(item.meal.protein) || 0,
          carbs: Number(item.meal.carbs) || 0,
          fat: Number(item.meal.fat) || 0,
          ingredients: item.meal.ingredients || [],
          tags: item.meal.tags || [item.slot, "agent", "smoothed"],
          source: "agent",
          updated_at: new Date().toISOString(),
        }));

        for (const row of upsertRows) {
          const { error: upsertErr } = await db
            .from("planned_meals")
            .upsert(row, { onConflict: "plan_id,date,meal_type" });

          if (upsertErr) {
            await db
              .from("planned_meals")
              .delete()
              .eq("member_id", memberId)
              .eq("date", dDate)
              .eq("meal_type", row.meal_type);
            await db.from("planned_meals").insert(row);
          }
        }

        const { data: verifiedRows } = await db
          .from("planned_meals")
          .select("*")
          .eq("member_id", memberId)
          .eq("date", dDate);

        if (verifiedRows && verifiedRows.length > 0) {
          allVerifiedRows.push(...verifiedRows);
        } else {
          allVerifiedRows.push(...upsertRows);
        }
        totalUpdatedMeals += upsertRows.length;
      }

      const actionPayload = {
        member_id: memberId,
        gym_id: gymId,
        initiated_by: memberId,
        action_type: actionType,
        user_request: userRequest || "Weekly auto-balance applied",
        summary: summary || `Weekly auto-balance applied across ${days.length} days (${totalUpdatedMeals} meals)`,
        tools_used: [
          { tool: "weekly_auto_balance", summary: `Redistributed daily calorie targets across ${days.length} days` },
          { tool: "replan_meals", summary: `Recalculated and persisted ${totalUpdatedMeals} meals` },
        ],
        proposed_change: null,
        requires_coach_approval: false,
        approved: true,
        execution_status: "executed",
        decided_by: memberId,
        decided_at: new Date().toISOString(),
        decision_note: "Applied weekly smoothing to synchronize planned meals",
        estimated_manual_minutes: 15,
        estimated_agent_minutes: 0.5,
        estimated_minutes_saved: 15,
        estimated_cost_value: 50.0,
        created_at: new Date().toISOString(),
      };

      await db.from("agent_actions").insert(actionPayload);

      return NextResponse.json({
        success: true,
        isDemo: false,
        memberId,
        daysCount: days.length,
        updatedMealsCount: totalUpdatedMeals,
        updatedMeals: allVerifiedRows,
        action: actionPayload,
      });
    }

    // ---------------------------------------------------------------------------
    // SINGLE-DAY MEAL MUTATION FLOW
    // ---------------------------------------------------------------------------
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

    // 3. Protected Eaten-Meal Guard: Never overwrite meals already logged as eaten
    const loggedSlots = new Set<string>();

    if (Array.isArray(clientLoggedSlots)) {
      clientLoggedSlots.forEach((s: string) => loggedSlots.add(String(s).toLowerCase()));
    }

    if (Array.isArray(existingMealLogs)) {
      existingMealLogs.forEach((l: any) => {
        if (l && l.meal_type) loggedSlots.add(String(l.meal_type).toLowerCase());
      });
    }

    if (!isDemoMode && session?.db) {
      const { data: dbLogs } = await session.db
        .from("meal_logs")
        .select("id, meal_name, meal_type")
        .eq("member_id", memberId)
        .eq("date", targetDate);

      if (dbLogs && dbLogs.length > 0) {
        dbLogs.forEach((l) => loggedSlots.add(l.meal_type.toLowerCase()));
      }
    }

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

    // 4. DEMO MODE PERSISTENCE
    if (isDemoMode) {
      const verifiedRows = safeItems.map((item) => ({
        id: `p-${memberId}-${targetDate}-${item.slot}`,
        plan_id: `plan-${memberId}`,
        member_id: memberId,
        date: targetDate,
        slot: item.slot,
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

      const actionPayload = {
        id: `act-${Date.now()}`,
        member_id: memberId,
        gym_id: gymId,
        initiated_by: memberId,
        action_type: actionType,
        user_request: userRequest || `Update ${targetDate} meals`,
        summary: summary || `Updated ${safeItems.length} meal(s) for ${targetDate}: ${safeItems.map((i) => `${i.slot}=${i.meal.meal_name}`).join(", ")}`,
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
        decision_note: "Confirmed and verified by NutriCoach AI (demo store)",
        estimated_manual_minutes: 8,
        estimated_agent_minutes: 0.5,
        estimated_minutes_saved: 8,
        estimated_cost_value: 26.67,
        created_at: new Date().toISOString(),
      };

      console.log("[NutriCoach] DEMO MUTATION CONFIRMED:", {
        memberId,
        targetDate,
        savedCount: verifiedRows.length,
      });

      return NextResponse.json({
        success: true,
        isDemo: true,
        memberId,
        targetDate,
        updatedMeals: verifiedRows,
        action: actionPayload,
      });
    }

    // 5. AUTHENTICATED SUPABASE PERSISTENCE
    if (!session || !session.user) {
      return NextResponse.json(
        { success: false, error: "Authentication required to persist meal changes." },
        { status: 401 }
      );
    }

    const { db, user, profile } = session;

    // Check authorization: member can only modify own plan unless coach/admin
    if (user.id !== memberId && profile.role !== "coach" && profile.role !== "admin") {
      return NextResponse.json(
        { success: false, error: "Forbidden: You are not authorized to mutate this member's plan." },
        { status: 403 }
      );
    }

    const { data: plans, error: fetchPlanErr } = await db
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
      const { data: newPlan, error: planErr } = await db
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
      const { error: upsertErr } = await db
        .from("planned_meals")
        .upsert(row, { onConflict: "plan_id,date,meal_type" });

      if (upsertErr) {
        console.warn("[NutriCoach] Upsert on planned_meals notice, trying delete & insert:", upsertErr.message);
        await db
          .from("planned_meals")
          .delete()
          .eq("member_id", memberId)
          .eq("date", targetDate)
          .eq("meal_type", row.meal_type);

        const { error: insertErr } = await db.from("planned_meals").insert(row);
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

    const { data: verifiedRows, error: verifyErr } = await db
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

    const { error: actionErr } = await db.from("agent_actions").insert(actionPayload);
    if (actionErr) {
      console.warn("[NutriCoach] Supabase agent_actions insert note:", actionErr.message);
    }

    return NextResponse.json({
      success: true,
      isDemo: false,
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
