import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

function sanitizeStringArray(arr: unknown, maxItems = 30, maxLength = 60): string[] {
  if (!Array.isArray(arr)) return [];
  const cleaned: string[] = [];
  const seen = new Set<string>();

  for (const item of arr) {
    if (typeof item === "string") {
      const trimmed = item.trim();
      const lower = trimmed.toLowerCase();
      if (trimmed.length > 0 && !seen.has(lower)) {
        seen.add(lower);
        cleaned.push(trimmed.slice(0, maxLength));
        if (cleaned.length >= maxItems) break;
      }
    }
  }

  return cleaned;
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session || !session.user) {
      return NextResponse.json({
        success: true,
        isGuestOrDemo: true,
      });
    }

    const { db, user } = session;
    const { data: profile, error } = await db
      .from("profiles")
      .select("allergies, disliked_foods, dietary_style, dietary_preferences, medical_notes")
      .eq("id", user.id)
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      preferences: {
        allergies: profile?.allergies || [],
        disliked_foods: profile?.disliked_foods || [],
        dietary_style: profile?.dietary_style || null,
        dietary_preferences: profile?.dietary_preferences || [],
        medical_notes: profile?.medical_notes || null,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ success: false, error: "Invalid JSON payload" }, { status: 400 });
    }

    const allergies = sanitizeStringArray(body?.allergies);
    const disliked_foods = sanitizeStringArray(body?.disliked_foods);
    const dietary_preferences = sanitizeStringArray(body?.dietary_preferences);
    const dietary_style = typeof body?.dietary_style === "string" ? body.dietary_style.trim().slice(0, 60) : null;
    const medical_notes = typeof body?.medical_notes === "string" ? body.medical_notes.trim().slice(0, 500) : null;

    const payloadToPersist = {
      allergies,
      disliked_foods,
      dietary_preferences,
      dietary_style,
      medical_notes,
    };

    const session = await getSession();
    if (!session || !session.user) {
      // Demo / unauthenticated mode: acknowledge sanitized data for local storage persistence
      return NextResponse.json({
        success: true,
        preferences: payloadToPersist,
        isGuestOrDemo: true,
      });
    }

    const { db, user } = session;

    // Authenticated user: persist to public.profiles via user-scoped update
    const { error: updateError } = await db
      .from("profiles")
      .update(payloadToPersist as any)
      .eq("id", user.id);

    if (updateError) {
      console.error("[NutriCoach] Failed to persist dietary preferences:", updateError.message);
      return NextResponse.json(
        { success: false, error: updateError.message || "Failed to update profile in database" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      preferences: payloadToPersist,
    });
  } catch (err: any) {
    console.error("[NutriCoach] /api/profile/preferences unexpected error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
