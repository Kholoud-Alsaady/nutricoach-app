import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt, memberProfile, targets, currentMeals } = body;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === "your_gemini_api_key_here") {
      return NextResponse.json({
        success: false,
        fallback: true,
        message: "No live GEMINI_API_KEY configured. Running built-in adaptive engine.",
      });
    }

    const ai = new GoogleGenAI({ apiKey });
    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

    const systemInstruction = `You are NutriCoach, an adaptive AI clinical nutrition operations copilot for gym members and fitness coaches.
Member Profile:
- Name: ${memberProfile?.name || "Athlete"}
- Sex: ${memberProfile?.sex || "Not specified"}
- Age: ${memberProfile?.age || 26}
- Height: ${memberProfile?.height || 175} cm
- Weight: ${memberProfile?.weight || 75} kg
- Goal: ${memberProfile?.goal || "Maintenance"}
- Daily Calorie Target: ${targets?.calories || 2000} kcal
- Daily Protein Target: ${targets?.protein || 140} g
- Disliked Foods (Excluded): ${(memberProfile?.disliked_foods || []).join(", ") || "None"}
- Allergies (Strict Exclusion): ${(memberProfile?.allergies || []).join(", ") || "None"}

Rules:
1. Always respect strict allergy exclusions and member preferences.
2. For cuisine generation (e.g. Italian, Egyptian, Mediterranean), provide high-protein, balanced meal choices matching the daily target.
3. Keep tone concise, professional, empathetic, and encouraging.`;

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.2,
      },
    });

    const reply = response.text || "Analyzed with NutriCoach AI.";

    return NextResponse.json({
      success: true,
      reply,
      model,
      usage: {
        inputTokens: response.usageMetadata?.promptTokenCount || 0,
        outputTokens: response.usageMetadata?.candidatesTokenCount || 0,
        totalTokens: response.usageMetadata?.totalTokenCount || 0,
      },
    });
  } catch (error: any) {
    console.error("Gemini API Error:", error?.message || error);
    return NextResponse.json({
      success: false,
      fallback: true,
      error: error?.message || "Gemini API unavailable",
    });
  }
}
