import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";

export async function POST(req: NextRequest) {
  try {
    const { message, currentPlan, userProfile, targetDay = "tomorrow" } = await req.json();

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === "your_gemini_api_key_here") {
      return NextResponse.json({
        replyText: "Running on local deterministic engine (no live GEMINI_API_KEY).",
        intent: "GENERAL_QUESTION",
      });
    }

    const ai = new GoogleGenAI({ apiKey });
    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

    const systemInstruction = `
You are NutriCoach, an intelligent clinical sports nutrition agent.
User Profile:
- Goal: ${userProfile?.goal || "Hypertrophy & Strength"}
- Daily Targets: ${userProfile?.calories || 2400} kcal, ${userProfile?.protein || 170}g protein
- Excluded Foods / Dislikes: ${userProfile?.disliked_foods?.join(", ") || "None"}
- Allergies: ${userProfile?.allergies?.join(", ") || "None"}

Your job:
1. Analyze the user's message: "${message}".
2. Detect intent:
   - "FULL_DAY_REPLAN": User wants a specific cuisine or dietary theme for a given day (e.g., "Italian", "Egyptian", "High Protein", "Mediterranean").
   - "REPLACE_MEAL": User wants to swap or replace one meal slot (Breakfast, Lunch, Snack, Dinner).
   - "ADD_FOOD": User wants to add an extra snack or treat.
   - "GENERAL_QUESTION": Questions about hydration, timing, soreness, etc.
3. If replanning or replacing, ALWAYS respect calorie/protein targets, exclusions, and allergies.
4. Return a structured JSON response matching the schema.
`;

    const response = await ai.models.generateContent({
      model,
      contents: message,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            replyText: { 
              type: Type.STRING, 
              description: "Warm, concise, professional message explaining the change." 
            },
            intent: { 
              type: Type.STRING, 
              enum: ["FULL_DAY_REPLAN", "REPLACE_MEAL", "ADD_FOOD", "GENERAL_QUESTION"] 
            },
            targetDay: { 
              type: Type.STRING, 
              description: "today, tomorrow, or day name" 
            },
            cuisine: {
              type: Type.STRING,
              description: "Cuisine name if full day replan (e.g. Italian, Egyptian, Mediterranean)",
            },
            updatedMeals: {
              type: Type.ARRAY,
              description: "The replacement meal or 4 full-day meals if replanning",
              items: {
                type: Type.OBJECT,
                properties: {
                  slot: { type: Type.STRING, enum: ["breakfast", "lunch", "snack", "dinner"] },
                  title: { type: Type.STRING },
                  ingredients: { type: Type.STRING },
                  calories: { type: Type.NUMBER },
                  protein: { type: Type.NUMBER },
                  carbs: { type: Type.NUMBER },
                  fat: { type: Type.NUMBER },
                },
                required: ["slot", "title", "ingredients", "calories", "protein", "carbs", "fat"],
              },
            },
          },
          required: ["replyText", "intent"],
        },
      },
    });

    const parsed = JSON.parse(response.text || "{}");
    return NextResponse.json(parsed);
  } catch (error: any) {
    console.error("Gemini API error:", error);
    return NextResponse.json(
      { replyText: "Sorry, I could not process that request right now.", intent: "GENERAL_QUESTION", error: error?.message },
      { status: 500 }
    );
  }
}
