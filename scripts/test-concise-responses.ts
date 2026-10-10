import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { POST as chatHandler } from "../src/app/api/chat/route";
import { isTrustedResearchSource } from "../src/lib/research/trusted-sources";

function countBodyWords(text: string): number {
  // Count words in core response (Short answer + Key takeaways), excluding source titles, links, and reading list
  const coreBody = text.split(/\*\*Recommended reading:\*\*/i)[0] || text;
  const stripped = coreBody
    .replace(/[#*•_`]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return stripped.split(/\s+/).filter(Boolean).length;
}

async function main() {
  console.log("==================================================================");
  console.log("🧪 NutriCoach Response Length, Formatting & 2-Article Test Suite");
  console.log("==================================================================\n");

  const prompts = [
    {
      q: "Can you advise me about the advantages of a sugar-free diet?",
      type: "nutrition",
      expectedTopic: "sugar",
    },
    {
      q: "What are the benefits of eating more fiber?",
      type: "nutrition",
      expectedTopic: "fiber",
    },
    {
      q: "Does eating more protein help with muscle growth?",
      type: "nutrition",
      expectedTopic: "protein",
    },
    {
      q: "What does research say about intermittent fasting?",
      type: "nutrition",
      expectedTopic: "fasting",
    },
  ];

  let passed = 0;
  let failed = 0;

  const assert = (condition: boolean, msg: string) => {
    if (condition) {
      console.log(`✅ [PASS] ${msg}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${msg}`);
      failed++;
    }
  };

  for (const item of prompts) {
    console.log(`\n--- Testing Nutrition Prompt: "${item.q}" ---`);
    const req = new Request("http://localhost:3000/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: item.q }),
    });

    const res = await chatHandler(req as any);
    const data = await res.json();

    assert(res.status === 200, `Returns HTTP 200`);
    assert(data.intent === "nutrition_question" || data.intent === "research_request", `Intent is nutrition_question`);
    assert(data.shouldMutatePlan === false, `Does NOT mutate meal plan`);
    assert(data.requiresConfirmation === false, `Does NOT require confirmation`);
    assert(!data.proposedMeal && !data.proposedMeals, `Does NOT propose meals`);

    // Sources: exactly 2 verified sources
    assert(Array.isArray(data.researchSources), `Returns researchSources array`);
    assert(data.researchSources.length === 2, `Returns EXACTLY TWO verified sources (got: ${data.researchSources?.length})`);
    assert(data.researchSources.every((s: any) => isTrustedResearchSource(s.url)), `All sources pass hard trust filter`);

    // Two complementary/different sources when available
    if (data.researchSources.length === 2) {
      console.log(`  Article 1: "${data.researchSources[0].title}" (${data.researchSources[0].sourceName})`);
      console.log(`  Article 2: "${data.researchSources[1].title}" (${data.researchSources[1].sourceName})`);
    }

    // Structure checks
    const reply = data.replyText || "";
    assert(reply.includes("**Short answer:**"), `Contains "**Short answer:**" section`);
    assert(reply.includes("**Key takeaways:**"), `Contains "**Key takeaways:**" section`);
    assert(reply.includes("**Recommended reading:**"), `Contains "**Recommended reading:**" section`);

    // Key takeaways should have 2 or 3 bullet points
    const takeawaysMatch = reply.match(/•\s+/g);
    assert(Boolean(takeawaysMatch && takeawaysMatch.length >= 2), `Includes 2-3 concise bullet points`);

    // Word count check
    const wordCount = countBodyWords(reply);
    console.log(`  Approximate body word count: ${wordCount} words`);
    assert(wordCount >= 60 && wordCount <= 170, `Response length is concise (target ~80–140 words, got: ${wordCount})`);

    // Disclaimers: avoid long repetitive disclaimers
    const isRepeatedDisclaimer = reply.includes("This information is educational and does not constitute medical diagnosis or individual clinical advice. Please consult a qualified healthcare professional");
    assert(!isRepeatedDisclaimer, `Does not repeat long boilerplate disclaimer`);

    console.log("\n[Snippet of Reply]:\n" + reply);
  }

  // 5. Test Meal Change Prompt: "Replace tomorrow's breakfast with a sugar-free alternative."
  console.log("\n--- Testing Meal Modification Prompt: \"Replace tomorrow's breakfast with a sugar-free alternative.\" ---");
  const mealReq = new Request("http://localhost:3000/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: "Replace tomorrow's breakfast with a sugar-free alternative.",
      currentDate: "2026-10-05",
      targets: { calories: 2400, protein: 180, carbs: 240, fat: 80 },
      plannedMeals: [
        { date: "2026-10-06", meal_type: "breakfast", meal_name: "Pancakes with Maple Syrup", calories: 600, protein: 15, carbs: 90, fat: 15 },
        { date: "2026-10-06", meal_type: "lunch", meal_name: "Turkey Breast Wrap", calories: 750, protein: 55, carbs: 65, fat: 22 },
        { date: "2026-10-06", meal_type: "dinner", meal_name: "Grilled Steak with Potatoes", calories: 850, protein: 65, carbs: 55, fat: 35 },
      ],
    }),
  });
  const mealRes = await chatHandler(mealReq as any);
  const mealData = await mealRes.json();

  assert(mealRes.status === 200, `Meal request returns HTTP 200`);
  assert(mealData.intent === "meal_replacement" || mealData.action === "replace_meal", `Routed to meal change workflow`);
  assert(mealData.shouldMutatePlan === false, `Does NOT mutate meal plan prematurely`);
  assert(mealData.requiresConfirmation === true, `Requires user confirmation before mutating`);
  assert(mealData.targetSlot === "breakfast" || mealData.proposedMeal?.slot === "breakfast", `Identifies target slot as breakfast`);
  assert(Boolean(mealData.proposedMeal || (mealData.proposedMeals && mealData.proposedMeals.length > 0)), `Proposes concrete replacement meal`);

  console.log("\n==================================================================");
  console.log(`Results: ${passed} passed | ${failed} failed`);
  console.log("==================================================================");

  if (failed > 0) process.exit(1);
  process.exit(0);
}

main().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
