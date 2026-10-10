import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { searchTrustedNutritionSources, isTrustedResearchSource, TRUSTED_DOMAINS } from "../src/lib/research/trusted-sources";
import { POST as chatHandler } from "../src/app/api/chat/route";
import type { AgentResponseContract } from "../src/lib/types";

async function runNutritionEvidenceTests() {
  console.log("==========================================================");
  console.log("🧪 NutriCoach Nutrition Knowledge & Source Reliability Tests");
  console.log("==========================================================\n");

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

  // -------------------------------------------------------------------------
  // 1. Authoritative Domain & Source Trust Verification
  // -------------------------------------------------------------------------
  console.log("--- 1. Testing Domain & Whitelist Reliability ---");
  assert(TRUSTED_DOMAINS.includes("who.int"), "WHO (who.int) is in trusted whitelist");
  assert(TRUSTED_DOMAINS.includes("cdc.gov"), "CDC (cdc.gov) is in trusted whitelist");
  assert(TRUSTED_DOMAINS.includes("nhs.uk"), "NHS (nhs.uk) is in trusted whitelist");
  assert(TRUSTED_DOMAINS.includes("pubmed.ncbi.nlm.nih.gov"), "PubMed is in trusted whitelist");

  assert(isTrustedResearchSource("https://www.who.int/publications/i/item/9789241549028"), "WHO URL accepted");
  assert(isTrustedResearchSource("https://www.cdc.gov/nutrition/data-statistics/added-sugars.html"), "CDC URL accepted");
  assert(isTrustedResearchSource("https://www.nhs.uk/live-well/eat-well/food-types/how-does-sugar-in-our-diet-affect-our-health/"), "NHS URL accepted");
  assert(isTrustedResearchSource("https://pubmed.ncbi.nlm.nih.gov/28698222/"), "PubMed URL accepted");
  assert(!isTrustedResearchSource("https://fakedietblog.com/miracle-cure"), "Untrusted diet blog strictly rejected");
  assert(!isTrustedResearchSource("https://random-keto.org/tips"), "Untrusted site strictly rejected");

  // -------------------------------------------------------------------------
  // 2. Scenario: Benefits of reducing added sugar
  // -------------------------------------------------------------------------
  console.log("\n--- 2. Scenario: Benefits of Reducing Added Sugar ---");
  const sugarReq = new Request("http://localhost:3000/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "What are the benefits of reducing added sugar?" }),
  });
  const sugarRes = await chatHandler(sugarReq as any);
  const sugarData: AgentResponseContract = await sugarRes.json();

  assert(sugarData.shouldMutatePlan === false, "Sugar question does NOT mutate meal plan");
  assert(sugarData.requiresConfirmation === false, "Sugar question does NOT require confirmation");
  assert(!sugarData.proposedMeal && !sugarData.proposedMeals, "Sugar question does NOT propose meals");
  assert(Array.isArray(sugarData.researchSources) && sugarData.researchSources.length > 0, "Returns genuine research sources");
  assert(sugarData.researchSources!.every((s) => isTrustedResearchSource(s.url)), "All sugar source URLs are verified trusted domains");
  assert(sugarData.researchSources!.some((s) => s.url.includes("who.int") || s.url.includes("cdc.gov") || s.url.includes("nhs.uk") || s.url.includes("pubmed")), "Sources include preferred bodies (WHO/CDC/NHS/PubMed)");
  assert(sugarData.replyText.length > 100, "Provides clear, comprehensive answer");
  assert(sugarData.researchSources!.every((s) => s.title && s.url && s.summary), "All sources contain title, url, and explanatory summary");

  // -------------------------------------------------------------------------
  // 3. Scenario: Sugar-free diets distinguishing added vs naturally occurring sugar
  // -------------------------------------------------------------------------
  console.log("\n--- 3. Scenario: Sugar-Free Diet (Added vs Natural Sugar) ---");
  const sugarFreeReq = new Request("http://localhost:3000/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "Is a sugar-free diet healthy?" }),
  });
  const sugarFreeRes = await chatHandler(sugarFreeReq as any);
  const sugarFreeData: AgentResponseContract = await sugarFreeRes.json();

  assert(sugarFreeData.shouldMutatePlan === false, "Sugar-free question does NOT mutate meal plan");
  assert(Array.isArray(sugarFreeData.researchSources) && sugarFreeData.researchSources.length > 0, "Returns trusted sources for sugar-free question");
  const textLower = sugarFreeData.replyText.toLowerCase();
  const distinguishesSugar =
    (textLower.includes("added") || textLower.includes("free sugar")) &&
    (textLower.includes("natural") || textLower.includes("fruit") || textLower.includes("whole"));
  assert(distinguishesSugar, "Answer distinguishes added/free sugars from naturally occurring sugars in whole foods");

  // -------------------------------------------------------------------------
  // 4. Scenario: Difference between added and natural sugar
  // -------------------------------------------------------------------------
  console.log("\n--- 4. Scenario: Difference Between Added & Naturally Occurring Sugar ---");
  const diffReq = new Request("http://localhost:3000/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "What is the difference between added sugar and naturally occurring sugar?" }),
  });
  const diffRes = await chatHandler(diffReq as any);
  const diffData: AgentResponseContract = await diffRes.json();

  assert(diffData.shouldMutatePlan === false, "Difference question does NOT mutate meal plan");
  assert(Array.isArray(diffData.researchSources) && diffData.researchSources.length > 0, "Returns sources explaining sugar differences");
  assert(diffData.researchSources!.some((s) => s.url.includes("nhs.uk") || s.url.includes("cdc.gov") || s.url.includes("who.int") || s.url.includes("pubmed")), "Includes official guidance (NHS/CDC/WHO/PubMed)");

  // -------------------------------------------------------------------------
  // 5. Scenario: Protein intake and muscle growth
  // -------------------------------------------------------------------------
  console.log("\n--- 5. Scenario: Protein & Muscle Growth ---");
  const proteinReq = new Request("http://localhost:3000/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "Does eating more protein help with muscle growth?" }),
  });
  const proteinRes = await chatHandler(proteinReq as any);
  const proteinData: AgentResponseContract = await proteinRes.json();

  assert(proteinData.shouldMutatePlan === false, "Protein question does NOT mutate meal plan");
  assert(Array.isArray(proteinData.researchSources) && proteinData.researchSources.length > 0, "Returns sources for protein and muscle growth");
  assert(proteinData.researchSources!.some((s) => s.url.includes("pubmed") || s.url.includes("nih.gov")), "Includes peer-reviewed PubMed/NIH evidence");

  // -------------------------------------------------------------------------
  // 6. Scenario: Dietary fiber benefits
  // -------------------------------------------------------------------------
  console.log("\n--- 6. Scenario: Benefits of Dietary Fiber ---");
  const fiberReq = new Request("http://localhost:3000/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "What are the benefits of eating more fiber?" }),
  });
  const fiberRes = await chatHandler(fiberReq as any);
  const fiberData: AgentResponseContract = await fiberRes.json();

  assert(fiberData.shouldMutatePlan === false, "Fiber question does NOT mutate meal plan");
  assert(Array.isArray(fiberData.researchSources) && fiberData.researchSources.length > 0, "Returns authoritative sources for fiber");
  assert(fiberData.researchSources!.some((s) => s.url.includes("cdc.gov") || s.url.includes("nhs.uk") || s.url.includes("who.int") || s.url.includes("pubmed")), "Includes CDC/NHS/WHO/PubMed fiber sources");

  // -------------------------------------------------------------------------
  // 7. Scenario: Intermittent fasting scientific evidence & limitations
  // -------------------------------------------------------------------------
  console.log("\n--- 7. Scenario: Intermittent Fasting Science & Limitations ---");
  const fastingReq = new Request("http://localhost:3000/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "What does scientific research say about intermittent fasting?" }),
  });
  const fastingRes = await chatHandler(fastingReq as any);
  const fastingData: AgentResponseContract = await fastingRes.json();

  assert(fastingData.shouldMutatePlan === false, "Fasting question does NOT mutate meal plan");
  assert(Array.isArray(fastingData.researchSources) && fastingData.researchSources.length > 0, "Returns peer-reviewed sources for intermittent fasting");
  assert(fastingData.researchSources!.some((s) => s.url.includes("pubmed")), "Includes PubMed clinical reviews (e.g. NEJM / JAMA)");

  // -------------------------------------------------------------------------
  // 8. Scenario: Limited or unverified scientific evidence
  // -------------------------------------------------------------------------
  console.log("\n--- 8. Scenario: Topic With Limited / Unavailable Scientific Evidence ---");
  const limitedReq = new Request("http://localhost:3000/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "Does crystal frequency water vibration cure chronic metabolic aging?" }),
  });
  const limitedRes = await chatHandler(limitedReq as any);
  const limitedData: AgentResponseContract = await limitedRes.json();

  assert(limitedData.shouldMutatePlan === false, "Unverified topic does NOT mutate meal plan");
  assert(!limitedData.researchSources || limitedData.researchSources.length === 0, "Never fabricates sources when scientific evidence is unverified or non-existent");
  const limitedText = limitedData.replyText.toLowerCase();
  assert(limitedText.includes("couldn't find") || limitedText.includes("limited") || limitedText.includes("verified"), "Honestly communicates that evidence is unavailable or unverified");

  // -------------------------------------------------------------------------
  // 9. Scenario: Meal Modification Isolation (MUST NOT BE INTERCEPTED)
  // -------------------------------------------------------------------------
  console.log("\n--- 9. Scenario: Meal Plan Modification Isolation ---");
  const replaceMealReq = new Request("http://localhost:3000/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: "Replace tomorrow's breakfast with a sugar-free alternative.",
      currentDate: "2026-10-05",
      targets: { calories: 2400, protein: 180, carbs: 240, fat: 80 },
      plannedMeals: [
        { date: "2026-10-06", meal_type: "breakfast", meal_name: "Pancakes with Syrup", calories: 500, protein: 15, carbs: 80, fat: 12 },
        { date: "2026-10-06", meal_type: "lunch", meal_name: "Chicken Rice", calories: 600, protein: 45, carbs: 60, fat: 15 },
        { date: "2026-10-06", meal_type: "snack", meal_name: "Greek Yogurt", calories: 200, protein: 20, carbs: 15, fat: 4 },
        { date: "2026-10-06", meal_type: "dinner", meal_name: "Salmon", calories: 600, protein: 45, carbs: 45, fat: 20 },
      ],
    }),
  });
  const replaceMealRes = await chatHandler(replaceMealReq as any);
  const replaceMealData: AgentResponseContract = await replaceMealRes.json();

  assert(replaceMealData.requiresConfirmation === true, "Meal change request correctly requires confirmation");
  assert(replaceMealData.shouldMutatePlan === false, "Meal change proposal does not prematurely mutate before confirmation");
  assert(replaceMealData.targetSlot === "breakfast" || replaceMealData.proposedMeal?.slot === "breakfast", "Target slot correctly identified as breakfast");
  assert(replaceMealData.targetDate === "2026-10-06", "Target date correctly resolved to tomorrow (2026-10-06)");
  assert(Boolean(replaceMealData.proposedMeal !== undefined || (replaceMealData.proposedMeals && replaceMealData.proposedMeals.length > 0)), "Generates actual proposed meal instead of research redirect");

  // -------------------------------------------------------------------------
  // 10. Scenario: Confirmation Flow Still Applies Proposal
  // -------------------------------------------------------------------------
  console.log("\n--- 10. Scenario: Confirmation Flow Still Applies Pending Proposal ---");
  const pendingProposal = {
    id: "prop-sugar-free-101",
    action: "replace_meal" as const,
    intent: "meal_replacement" as const,
    targetDate: "2026-10-06",
    targetSlot: "breakfast",
    meals: [{ slot: "breakfast" as const, title: "Spinach & Egg White Scramble with Avocado", calories: 420, protein: 32, carbs: 8, fat: 28 }],
    summary: "Sugar-free breakfast alternative for tomorrow",
  };
  const confirmReq = new Request("http://localhost:3000/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: "Yes, apply it.",
      currentDate: "2026-10-05",
      targets: { calories: 2400, protein: 180, carbs: 240, fat: 80 },
      conversationState: { pendingProposal },
    }),
  });
  const confirmRes = await chatHandler(confirmReq as any);
  const confirmData: AgentResponseContract = await confirmRes.json();

  assert(confirmData.shouldMutatePlan === true, "Explicit confirmation sets shouldMutatePlan = true");
  assert(confirmData.requiresConfirmation === false, "Confirmed proposal does not ask for re-confirmation");
  assert(confirmData.confirmedProposalId === "prop-sugar-free-101", "Confirms exact pending proposal ID");
  assert(confirmData.proposedMeal?.title === "Spinach & Egg White Scramble with Avocado", "Preserves exact proposed meal from pending proposal");

  // -------------------------------------------------------------------------
  // 11. Scenario: Natural Variations of Nutrition Questions
  // -------------------------------------------------------------------------
  console.log("\n--- 11. Scenario: Natural Variations of Nutrition Questions ---");
  const testVariations = [
    "can u advice me with the sugar free diet advantages",
    "Can you advise me on the advantages of a sugar-free diet?",
    "What are the benefits of reducing sugar?",
    "Is a sugar-free diet healthy?",
    "What are the advantages of eating less added sugar?",
  ];

  for (const q of testVariations) {
    const varReq = new Request("http://localhost:3000/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: q }),
    });
    const varRes = await chatHandler(varReq as any);
    const varData: AgentResponseContract = await varRes.json();

    assert(varRes.status === 200, `Query "${q}" returns status 200`);
    assert(varData.intent === "nutrition_question" || varData.intent === "research_request", `Query "${q}" routed to nutrition/research intent`);
    assert(varData.shouldMutatePlan === false, `Query "${q}" does not mutate meal plan`);
    assert(varData.requiresConfirmation === false, `Query "${q}" does not require confirmation`);
    assert(!varData.proposedMeal && !varData.proposedMeals, `Query "${q}" does not propose meals`);
    assert(!varData.replyText.toLowerCase().includes("haven't changed your meal plan. please try again"), `Query "${q}" does NOT return generic AGENT_UNAVAILABLE error`);
    assert(Array.isArray(varData.researchSources) && varData.researchSources.length > 0, `Query "${q}" returns verified research sources`);
    assert(varData.researchSources!.every((s) => isTrustedResearchSource(s.url)), `All sources for "${q}" pass hard trust filter`);
  }

  console.log("\n==========================================================");
  console.log(`Results: ${passed} passed | ${failed} failed`);
  console.log("==========================================================");
  if (failed > 0) process.exit(1);
  process.exit(0);
}

runNutritionEvidenceTests().catch((err) => {
  console.error("Test execution threw error:", err);
  process.exit(1);
});
