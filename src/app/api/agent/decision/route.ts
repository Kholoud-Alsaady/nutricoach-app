import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { decideProposal } from "@/lib/agent/executor";
import type { AgentAction } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { actionId, decision, optionIndex, note } = body;

    // 1. Input Validation
    if (!actionId || typeof actionId !== "string") {
      return NextResponse.json(
        { success: false, error: "Validation failed: missing actionId." },
        { status: 400 }
      );
    }

    if (decision !== "approve" && decision !== "reject") {
      return NextResponse.json(
        { success: false, error: "Validation failed: decision must be 'approve' or 'reject'." },
        { status: 400 }
      );
    }

    // 2. Authentication & Session check
    const session = await getSession();

    const callerRole = session?.profile?.role || body.callerRole;
    const isCoachRequiredDemo = actionId === "act-ahmed-audit" || actionId === "act-youssef-audit";

    // Prevent members from approving actions requiring coach approval
    if (isCoachRequiredDemo && callerRole === "member" && decision === "approve") {
      return NextResponse.json(
        { success: false, error: "Forbidden: This action requires coach approval." },
        { status: 403 }
      );
    }

    // State guard for demo actions passed with currentStatus
    if (body.currentStatus === "executed" || body.currentStatus === "rejected") {
      return NextResponse.json(
        {
          success: false,
          error: `Action has already been ${body.currentStatus}.`,
          currentStatus: body.currentStatus,
        },
        { status: 400 }
      );
    }

    if (!session || !session.user) {
      // Guest or Demo mode
      if (actionId.startsWith("act-") || actionId.startsWith("demo-")) {
        return NextResponse.json({
          success: true,
          isDemo: true,
          actionId,
          decision,
          message: `Demo action ${actionId} successfully ${decision === "approve" ? "approved" : "rejected"}.`,
        });
      }

      return NextResponse.json(
        { success: false, error: "Authentication required to decide agent actions." },
        { status: 401 }
      );
    }

    const { db, user, profile, gym } = session;

    // 3. Check action in database
    const { data: action, error: fetchErr } = await db
      .from("agent_actions")
      .select("*")
      .eq("id", actionId)
      .single<AgentAction>();

    if (fetchErr || !action) {
      // If it's a demo action not found in Supabase
      if (actionId.startsWith("act-") || actionId.startsWith("demo-")) {
        return NextResponse.json({
          success: true,
          isDemo: true,
          actionId,
          decision,
          message: `Demo action ${actionId} processed.`,
        });
      }

      return NextResponse.json(
        { success: false, error: `Action ${actionId} not found: ${fetchErr?.message || "Record does not exist"}` },
        { status: 404 }
      );
    }

    // 4. Role Authorization Guard: Member cannot approve actions requiring coach approval
    if (action.requires_coach_approval && profile.role === "member") {
      return NextResponse.json(
        { success: false, error: "Forbidden: This action requires coach approval." },
        { status: 403 }
      );
    }

    // 5. State Guard: Prevent decided actions from being re-decided
    if (action.execution_status === "executed" || action.execution_status === "rejected") {
      return NextResponse.json(
        {
          success: false,
          error: `Action has already been ${action.execution_status}.`,
          currentStatus: action.execution_status,
        },
        { status: 400 }
      );
    }

    // 6. Execute decision via executor
    const result = await decideProposal({
      db,
      gym,
      actionId,
      decision,
      decidedBy: {
        id: user.id,
        role: profile.role,
        name: profile.name,
      },
      note: note || (decision === "approve" ? "Approved by coach" : "Declined by coach"),
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      action: result.action,
      message: result.message,
    });
  } catch (error: any) {
    console.error("[NutriCoach] /api/agent/decision error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
