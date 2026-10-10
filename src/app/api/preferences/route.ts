import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  ChatbotPreferences,
  DEFAULT_CHATBOT_PREFERENCES,
  CommunicationStyle,
  EncouragementLevel,
  ResponseDetail,
  ChatLanguagePreference,
} from "@/lib/types";

const VALID_STYLES: CommunicationStyle[] = [
  "professional_supportive",
  "friendly_conversational",
  "direct_concise",
  "detailed_educational",
];

const VALID_ENCOURAGEMENTS: EncouragementLevel[] = ["gentle", "balanced", "minimal"];

const VALID_DETAILS: ResponseDetail[] = ["concise", "standard", "detailed"];

const VALID_LANGUAGES: ChatLanguagePreference[] = ["auto", "en", "ar"];

function sanitizePreferences(input: any): ChatbotPreferences {
  const commStyle = VALID_STYLES.includes(input?.communication_style)
    ? input.communication_style
    : DEFAULT_CHATBOT_PREFERENCES.communication_style;

  const encLevel = VALID_ENCOURAGEMENTS.includes(input?.encouragement_level)
    ? input.encouragement_level
    : DEFAULT_CHATBOT_PREFERENCES.encouragement_level;

  const respDetail = VALID_DETAILS.includes(input?.response_detail)
    ? input.response_detail
    : DEFAULT_CHATBOT_PREFERENCES.response_detail;

  const lang = VALID_LANGUAGES.includes(input?.language)
    ? input.language
    : DEFAULT_CHATBOT_PREFERENCES.language;

  let prefName = input?.preferred_name;
  if (typeof prefName === "string") {
    prefName = prefName.trim().slice(0, 50) || null;
  } else {
    prefName = null;
  }

  return {
    communication_style: commStyle,
    encouragement_level: encLevel,
    response_detail: respDetail,
    preferred_name: prefName,
    language: lang,
  };
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session || !session.user) {
      return NextResponse.json({
        success: true,
        preferences: DEFAULT_CHATBOT_PREFERENCES,
        isGuestOrDemo: true,
      });
    }

    const { db, user } = session;
    const { data: profile, error } = await db
      .from("profiles")
      .select("chatbot_preferences")
      .eq("id", user.id)
      .single();

    if (error) {
      console.warn("[NutriCoach] /api/preferences GET warning:", error.message);
      return NextResponse.json({
        success: true,
        preferences: DEFAULT_CHATBOT_PREFERENCES,
      });
    }

    const prefs = profile?.chatbot_preferences
      ? sanitizePreferences(profile.chatbot_preferences)
      : DEFAULT_CHATBOT_PREFERENCES;

    return NextResponse.json({ success: true, preferences: prefs });
  } catch (err: any) {
    console.error("[NutriCoach] /api/preferences GET error:", err?.message || err);
    return NextResponse.json({
      success: true,
      preferences: DEFAULT_CHATBOT_PREFERENCES,
    });
  }
}

export async function POST(req: NextRequest) {
  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid JSON payload" },
        { status: 400 }
      );
    }

    const cleanPreferences = sanitizePreferences(body?.preferences || body);

    const session = await getSession();
    if (!session || !session.user) {
      // Unauthenticated / demo mode: return sanitized preferences for local storage persistence
      return NextResponse.json({
        success: true,
        preferences: cleanPreferences,
        isGuestOrDemo: true,
      });
    }

    const { db, user } = session;

    // Persist to user's profile row in Supabase
    const { error: updateError } = await db
      .from("profiles")
      .update({ chatbot_preferences: cleanPreferences } as any)
      .eq("id", user.id);

    if (updateError) {
      console.error("[NutriCoach] Failed to persist chatbot_preferences:", updateError.message);
      return NextResponse.json(
        { success: false, error: updateError.message || "Failed to persist preferences to database" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      preferences: cleanPreferences,
    });
  } catch (err: any) {
    console.error("[NutriCoach] /api/preferences POST unexpected error:", err?.message || err);
    return NextResponse.json(
      { success: false, error: err?.message || "Internal server error saving preferences" },
      { status: 500 }
    );
  }
}
