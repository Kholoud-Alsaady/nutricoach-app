import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { isTrustedResearchSource, searchTrustedNutritionSources } from "../src/lib/research/trusted-sources";
import { addDays, todayISO } from "../src/lib/dates";

async function runTests() {
  console.log("=================================================");
  console.log("🧪 NutriCoach Hardened Agent Verification Suite");
  console.log("=================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}${detail ? ` - ${detail}` : ""}`);
      failed++;
    }
  }

  // ---------------------------------------------------------------------------
  // TEST SET A: Hard Trust Filter & Research Retrieval
  // ---------------------------------------------------------------------------
  console.log("--- Testing Research & Trust Filter ---");

  // Test 9 Check: Untrusted domains must be rejected
  const untrustedExamples = [
    "https://www.random-diet-blog.com/sugar-free",
    "https://medium.com/@user/keto-guide",
    "https://reddit.com/r/nutrition/comments/xyz",
    "https://buzzfeed.com/health/10-foods",
    "http://super-health-tips.co/weightloss"
  ];
  for (const url of untrustedExamples) {
    assert(!isTrustedResearchSource(url), `Untrusted URL rejected: ${url}`);
  }

  // Authoritative domains must be accepted
  const trustedExamples = [
    "https://www.who.int/news-room/fact-sheets/detail/healthy-diet",
    "https://www.fao.org/nutrition/education/food-dietary-guidelines/en/",
    "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8900000/",
    "https://www.cdc.gov/nutrition/healthy-eating/index.html",
    "https://ods.od.nih.gov/factsheets/DietarySupplements-HealthProfessional/",
    "https://www.efsa.europa.eu/en/topics/topic/dietary-reference-values"
  ];
  for (const url of trustedExamples) {
    assert(isTrustedResearchSource(url), `Trusted URL accepted: ${url}`);
  }

  // Test 5: "Recommend an article about sugar-free diets."
  console.log("\nSearching for 'Recommend an article about sugar-free diets'...");
  const sugarResults = await searchTrustedNutritionSources("Recommend an article about sugar-free diets");
  assert(sugarResults.length > 0, "Test 5: Real research results returned for sugar-free diets");
  assert(sugarResults.every(r => isTrustedResearchSource(r.url)), "Test 5: ALL returned URLs are strictly trusted authoritative domains");
  assert(sugarResults.every(r => r.url.startsWith("http") && !r.url.includes("example.com")), "Test 5: No fabricated URLs or placeholders");

  // Test 6: "Find me something from FAO about healthy diets."
  console.log("\nSearching for 'Find me something from FAO about healthy diets'...");
  const faoResults = await searchTrustedNutritionSources("Find me something from FAO about healthy diets");
  assert(faoResults.length > 0, "Test 6: Real results returned for FAO query");
  assert(faoResults.some(r => r.sourceName.toUpperCase().includes("FAO") || r.url.includes("fao.org")), "Test 6: FAO source explicitly prioritized when user requested FAO");
  assert(faoResults.every(r => isTrustedResearchSource(r.url)), "Test 6: ALL returned URLs pass hard trust filter");

  // ---------------------------------------------------------------------------
  // TEST SET B: Date Resolution
  // ---------------------------------------------------------------------------
  console.log("\n--- Testing Relative Date Resolution ---");
  const baseDate = "2026-10-05"; // Monday
  const tomorrow = addDays(baseDate, 1);
  assert(tomorrow === "2026-10-06", "Date resolution: tomorrow from 2026-10-05 is 2026-10-06");

  // ---------------------------------------------------------------------------
  // TEST SET C: API Logic & Mutation Security
  // ---------------------------------------------------------------------------
  console.log("\n--- Testing Mutation Security & Confirmation Flow ---");

  // Test 7: User says "Yes" with NO pending proposal
  const mockChatRequestNoPending = {
    message: "Yes.",
    currentDate: "2026-10-05",
    targets: { calories: 2400, protein: 180, carbs: 240, fat: 80 },
    userProfile: { goal: "Hypertrophy", dietary_style: "standard" },
    conversationState: undefined
  };

  // Import chat POST handler directly
  const { POST: chatHandler } = await import("../src/app/api/chat/route");
  
  const reqNoPending = new Request("http://localhost:3000/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(mockChatRequestNoPending)
  });

  const resNoPending = await chatHandler(reqNoPending as any);
  const dataNoPending = await resNoPending.json();
  assert(dataNoPending.shouldMutatePlan === false, "Test 7: 'Yes' with no pending proposal does NOT mutate plan");
  assert(dataNoPending.replyText.toLowerCase().includes("pending") || dataNoPending.replyText.toLowerCase().includes("what would you like"), "Test 7: Clarification asked when confirming without pending proposal");

  // Test 2: User says "Yes, apply it" with an active pending proposal
  const mockPendingProposal = {
    id: "prop-test-123",
    action: "adapt_day",
    intent: "meal_adaptation",
    targetDate: "2026-10-06",
    meals: [
      { slot: "breakfast", title: "Italian Frittata with Ricotta", calories: 450, protein: 32, carbs: 25, fat: 22 },
      { slot: "lunch", title: "Wholewheat Pasta Pomodoro with Grilled Chicken", calories: 650, protein: 50, carbs: 70, fat: 16 },
      { slot: "snack", title: "Prosciutto wrapped Melon & Mozzarella", calories: 250, protein: 18, carbs: 15, fat: 12 },
      { slot: "dinner", title: "Baked Sea Bass Mediterranean with Polenta", calories: 600, protein: 48, carbs: 55, fat: 18 }
    ],
    summary: "Italian meal plan for tomorrow"
  };

  const reqWithPending = new Request("http://localhost:3000/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: "Yes, apply it.",
      currentDate: "2026-10-05",
      targets: { calories: 2400, protein: 180, carbs: 240, fat: 80 },
      userProfile: { goal: "Hypertrophy", dietary_style: "standard" },
      conversationState: { pendingProposal: mockPendingProposal }
    })
  });

  const resWithPending = await chatHandler(reqWithPending as any);
  const dataWithPending = await resWithPending.json();
  assert(dataWithPending.shouldMutatePlan === true, "Test 2: 'Yes, apply it' with pending proposal sets shouldMutatePlan = true");
  assert(dataWithPending.requiresConfirmation === false, "Test 2: Confirmed proposal does not ask for re-confirmation");
  assert(dataWithPending.proposedMeals?.length === 4, "Test 2: Preserves exact proposed meals from pending proposal without regenerating");
  assert(dataWithPending.targetDate === "2026-10-06", "Test 2: Preserves exact targetDate (2026-10-06)");

  // Test 1: Day-level adaptation request: "Change tomorrow's meals to Italian."
  console.log("\nCalling Gemini for: 'Change tomorrow's meals to Italian.'...");
  const reqItalian = new Request("http://localhost:3000/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: "Change tomorrow's meals to Italian.",
      currentDate: "2026-10-05",
      targets: { calories: 2400, protein: 180, carbs: 240, fat: 80 },
      userProfile: { goal: "Hypertrophy", dietary_style: "standard", allergies: [], disliked_foods: [] },
      plannedMeals: [
        { date: "2026-10-06", meal_type: "breakfast", meal_name: "Oatmeal", calories: 400, protein: 20, carbs: 60, fat: 8 },
        { date: "2026-10-06", meal_type: "lunch", meal_name: "Chicken Bowl", calories: 600, protein: 45, carbs: 60, fat: 15 },
        { date: "2026-10-06", meal_type: "snack", meal_name: "Greek Yogurt", calories: 200, protein: 20, carbs: 15, fat: 4 },
        { date: "2026-10-06", meal_type: "dinner", meal_name: "Salmon", calories: 600, protein: 45, carbs: 45, fat: 20 }
      ]
    })
  });

  const resItalian = await chatHandler(reqItalian as any);
  const dataItalian = await resItalian.json();
  assert(dataItalian.shouldMutatePlan === false, "Test 1: Proposal sets shouldMutatePlan = false (no premature mutation)");
  assert(dataItalian.requiresConfirmation === true, "Test 1: Proposal sets requiresConfirmation = true");
  assert(dataItalian.targetDate === "2026-10-06", `Test 1: targetDate resolved correctly to tomorrow (2026-10-06), got: ${dataItalian.targetDate}`);
  assert(Array.isArray(dataItalian.proposedMeals) && dataItalian.proposedMeals.length > 0, "Test 1: Proposed meals array generated for full day");

  // Test: Single-slot adaptation: "Change tomorrow's dinner to pasta."
  console.log("\nCalling Gemini for: \"Change tomorrow's dinner to pasta.\"...");
  const reqDinner = new Request("http://localhost:3000/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: "Change tomorrow's dinner to pasta.",
      currentDate: "2026-10-05",
      targets: { calories: 2400, protein: 180, carbs: 240, fat: 80 },
      userProfile: { goal: "Hypertrophy", dietary_style: "standard", allergies: [], disliked_foods: [] },
      plannedMeals: [
        { date: "2026-10-06", meal_type: "breakfast", meal_name: "Oatmeal", calories: 400, protein: 20, carbs: 60, fat: 8 },
        { date: "2026-10-06", meal_type: "lunch", meal_name: "Chicken Bowl", calories: 600, protein: 45, carbs: 60, fat: 15 },
        { date: "2026-10-06", meal_type: "snack", meal_name: "Greek Yogurt", calories: 200, protein: 20, carbs: 15, fat: 4 },
        { date: "2026-10-06", meal_type: "dinner", meal_name: "Salmon", calories: 600, protein: 45, carbs: 45, fat: 20 }
      ]
    })
  });
  const resDinner = await chatHandler(reqDinner as any);
  const dataDinner = await resDinner.json();
  assert(dataDinner.targetSlot === "dinner" || dataDinner.proposedMeals?.length === 1, "Single slot dinner adaptation targets only dinner");
  assert(dataDinner.requiresConfirmation === true, "Single slot adaptation requires confirmation");
  assert(dataDinner.shouldMutatePlan === false, "Single slot adaptation does not mutate prematurely");

  // Test: Week-level diversity: "Make my whole week more varied."
  console.log("\nCalling for: \"Make my whole week more varied.\"...");
  const reqWeek = new Request("http://localhost:3000/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: "Make my whole week more varied.",
      currentDate: "2026-10-05",
      targets: { calories: 2400, protein: 180, carbs: 240, fat: 80 },
      userProfile: { goal: "Hypertrophy", dietary_style: "standard", allergies: [], disliked_foods: [] }
    })
  });
  const resWeek = await chatHandler(reqWeek as any);
  const dataWeek = await resWeek.json();
  assert(dataWeek.intent === "week_level_planning" || dataWeek.action === "adapt_week" || dataWeek.action === "adapt_day", "Identifies week-level variety request");
  assert(dataWeek.requiresConfirmation === true, "Week-level variety proposal requires confirmation");

  // Test 8: Force /api/mutate-meal to fail and verify response contract
  console.log("\nTesting mutation API error handling...");
  const { POST: mutateHandler } = await import("../src/app/api/mutate-meal/route");
  const badMutateReq = new Request("http://localhost:3000/api/mutate-meal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      memberId: "invalid-member",
      targetDate: "invalid-date"
    })
  });
  const badMutateRes = await mutateHandler(badMutateReq as any);
  const badMutateData = await badMutateRes.json();
  assert(badMutateData.success === false, "Test 8: Failed mutation returns success = false");
  assert(typeof badMutateData.error === "string", "Test 8: Error message is descriptive and returned to caller");

  console.log("\n=================================================");
  console.log(`Summary: Passed: ${passed} | Failed: ${failed}`);
  console.log("=================================================");
  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error("Test execution threw exception:", err);
  process.exit(1);
});
