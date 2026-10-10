import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { POST as chatHandler } from "../src/app/api/chat/route";
import { formatNutritionResponse, synthesizeEvidenceFallback } from "../src/lib/research/nutrition-formatter";
import { isTrustedResearchSource, searchTrustedNutritionSources } from "../src/lib/research/trusted-sources";
import type { AgentResearchSource } from "../src/lib/types";

function countBodyWords(text: string): number {
  const coreBody = text.split(/\*\*Recommended reading:\*\*/i)[0] || text;
  const stripped = coreBody
    .replace(/[#*•_`]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return stripped.split(/\s+/).filter(Boolean).length;
}

async function runRegressionTestSuite() {
  console.log("==================================================================");
  console.log("🧪 NutriCoach Final-Layer Nutrition Formatting Regression Suite");
  console.log("==================================================================\n");

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

  // -------------------------------------------------------------------------
  // TEST 1: The exact prompt that previously produced the long response
  // -------------------------------------------------------------------------
  console.log("--- 1. Testing Live API Response for Exact Sugar-Free Query ---");
  const sugarQueries = [
    "can u advice me with the sugar free diet advantages",
    "What are the advantages of a sugar-free diet?",
  ];

  for (const q of sugarQueries) {
    console.log(`\nQuery: "${q}"`);
    const req = new Request("http://localhost:3000/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: q }),
    });

    const res = await chatHandler(req as any);
    const data = await res.json();

    assert(res.status === 200, `Returns HTTP 200`);
    assert(data.intent === "nutrition_question", `Intent is nutrition_question`);
    assert(data.shouldMutatePlan === false, `Does NOT mutate meal plan`);
    assert(data.requiresConfirmation === false, `Does NOT require confirmation`);
    assert(!data.proposedMeal && !data.proposedMeals, `Does NOT propose meals`);

    // Verify research sources in response
    assert(Array.isArray(data.researchSources), `Returns researchSources array`);
    assert(data.researchSources.length <= 2, `No more than two article recommendations appear (got: ${data.researchSources?.length})`);
    assert(data.researchSources.length === 2, `Returns exactly two verified sources`);
    assert(data.researchSources.every((s: any) => isTrustedResearchSource(s.url)), `All sources are genuine verified sources`);

    const reply = data.replyText || "";

    // Structure assertions
    assert(!reply.includes("**Short answer:**"), `Does NOT contain redundant "**Short answer:**" heading`);
    assert(reply.includes("**Key takeaways:**"), `Contains "**Key takeaways:**" section`);
    assert(reply.includes("**Recommended reading:**"), `Contains "**Recommended reading:**" section`);

    // Count bullets in takeaways
    const bulletMatches = reply.match(/•\s+/g) || [];
    // Reading list has 2 bullets, takeaways should have <= 3 bullets
    const takeawaysPart = reply.split(/\*\*Recommended reading:\*\*/i)[0] || "";
    const takeawayBullets = (takeawaysPart.match(/•\s+/g) || []).length;
    assert(takeawayBullets >= 2 && takeawayBullets <= 3, `Key takeaways contains 2–3 concise bullet points (got: ${takeawayBullets})`);

    // Count reading recommendations in replyText
    const readingPart = reply.split(/\*\*Recommended reading:\*\*/i)[1] || "";
    const readingLinks = (readingPart.match(/\[Read article\]/g) || []).length;
    assert(readingLinks === 2, `Recommended reading contains exactly two article links (got: ${readingLinks})`);

    // Word count check
    const bodyWords = countBodyWords(reply);
    console.log(`  Body word count: ${bodyWords} words (Target: 80–130)`);
    assert(bodyWords >= 70 && bodyWords <= 135, `Body word count is within concise target (~80–130 words, got: ${bodyWords})`);

    // Check no repetitive or redundant full-length disclaimers
    const hasLongDisclaimer = reply.includes("This information is educational and does not constitute medical diagnosis");
    assert(!hasLongDisclaimer, `Does not append lengthy boilerplate disclaimer`);

    // Check scientific nuance
    assert(
      reply.toLowerCase().includes("free") || reply.toLowerCase().includes("added"),
      `Distinguishes free/added sugars`
    );
    assert(
      !reply.toLowerCase().includes("eliminate all fruit") && !reply.toLowerCase().includes("stop eating fruit"),
      `Does not recommend eliminating wholesome fruits`
    );
    assert(
      !reply.toLowerCase().includes("guarantee weight loss") && !reply.toLowerCase().includes("cures diabetes"),
      `Avoids guaranteed weight loss or cure claims`
    );
  }

  // -------------------------------------------------------------------------
  // TEST 2: Unit test formatNutritionResponse with an unconstrained, messy LLM article
  // -------------------------------------------------------------------------
  console.log("\n--- 2. Testing formatNutritionResponse Against Unconstrained Verbose LLM Output ---");
  const messyLLMOutput = `
# Comprehensive Guide to Sugar-Free Diets: Advantages, Mechanisms, and Guidelines

Certainly! Here is an in-depth clinical analysis and complete literature review regarding sugar reduction.

### Introduction and Biological Mechanisms
Sugar consumption has reached unprecedented levels globally. When humans consume sucrose and high fructose corn syrup, hepatic lipogenesis increases dramatically. This biochemical pathway accelerates fatty liver disease and alters visceral adiposity. Furthermore, insulin spikes disrupt normal satiety signaling in the hypothalamic region of the central nervous system.

### Key Clinical Findings and Evidence
• Scientific study 1: Reducing sugar lowers cardiovascular disease risk by 38% according to several epidemiological cohorts.
• Scientific study 2: High sugar intake promotes Streptococcus mutans proliferation in oral biofilms, causing severe dental caries.
• Scientific study 3: Cutting sugary drinks leads to an average caloric reduction of 250 kcal daily.
• Extraneous point 4: You can read more about this study at https://pubmed.ncbi.nlm.nih.gov/1234567/ [Read article]
• Extraneous point 5: Always consult a doctor before changing your diet.

### Detailed Critical Analysis and Limitations
However, we must emphasize that correlation is not always causation. While observational studies show clear links between sugar intake and cardiometabolic syndrome, randomized controlled trials show varying results depending on energy balance.

### Extended Medical Disclaimer
Disclaimer: This information is for educational purposes only and should not be used as medical advice or clinical diagnosis. Always consult with a registered dietitian, physician, or other qualified healthcare provider.

### Full Summary and Conclusion
In conclusion, adopting a sugar-free lifestyle provides undeniable advantages for cardiovascular, dental, and metabolic wellness across all demographic categories.
`;

  const sampleSources: AgentResearchSource[] = [
    {
      title: "WHO Guideline: Sugars intake for adults and children",
      url: "https://www.who.int/publications/i/item/9789241549028",
      sourceName: "World Health Organization (WHO)",
      sourceType: "guideline",
      summary: "WHO recommends reducing free sugars intake to less than 10% of total energy.",
    },
    {
      title: "NHS: How does sugar in our diet affect our health?",
      url: "https://www.nhs.uk/live-well/eat-well/food-types/how-does-sugar-in-our-diet-affect-our-health/",
      sourceName: "National Health Service (NHS)",
      sourceType: "guideline",
      summary: "NHS advice on free sugars and dental and cardiovascular health.",
    },
    // Extraneous sources that should be discarded:
    {
      title: "Extra Article 3",
      url: "https://www.cdc.gov/nutrition/extra.html",
      sourceName: "CDC",
      sourceType: "article",
      summary: "Extra summary",
    },
    {
      title: "Extra Article 4",
      url: "https://pubmed.ncbi.nlm.nih.gov/99999/",
      sourceName: "PubMed",
      sourceType: "study",
      summary: "Extra summary 4",
    },
  ];

  const formattedMessy = formatNutritionResponse(
    messyLLMOutput,
    "can u advice me with the sugar free diet advantages",
    sampleSources,
    false
  );

  assert(!formattedMessy.includes("**Short answer:**"), `Formatter removes "**Short answer:**" heading and begins directly with answer`);
  assert(formattedMessy.includes("**Key takeaways:**"), `Formatter enforces "**Key takeaways:**"`);
  assert(formattedMessy.includes("**Recommended reading:**"), `Formatter enforces "**Recommended reading:**"`);
  assert(!formattedMessy.includes("# Comprehensive Guide"), `Eliminates full article headings`);
  assert(!formattedMessy.includes("### Introduction"), `Eliminates verbose introduction sections`);
  assert(!formattedMessy.includes("### Detailed Critical Analysis"), `Eliminates multi-page analysis`);
  assert(!formattedMessy.includes("Disclaimer: This information is for educational purposes only"), `Eliminates repetitive full-length disclaimer`);

  const messyBodyWords = countBodyWords(formattedMessy);
  console.log(`  Formatted body word count: ${messyBodyWords} words`);
  assert(messyBodyWords >= 70 && messyBodyWords <= 135, `Formatted verbose output into ~80–130 words (got: ${messyBodyWords})`);

  const messyReadingPart = formattedMessy.split(/\*\*Recommended reading:\*\*/i)[1] || "";
  const messyReadingLinks = (messyReadingPart.match(/\[Read article\]/g) || []).length;
  assert(messyReadingLinks === 2, `Strictly capped to exactly two reading links despite 4 sources supplied (got: ${messyReadingLinks})`);

  // -------------------------------------------------------------------------
  // TEST 3: Explicit Detailed Request Still Allows Longer Output
  // -------------------------------------------------------------------------
  console.log("\n--- 3. Testing Explicit Request for Detailed Article / Literature Review ---");
  const longDetailedText = "This is a detailed comprehensive literature review discussing fifty different trials... ".repeat(15);
  const formattedDetailed = formatNutritionResponse(
    longDetailedText,
    "Can you provide a detailed comprehensive literature review on dietary fiber?",
    sampleSources,
    true // isDetailedRequest = true
  );
  assert(formattedDetailed === longDetailedText, `Detailed request preserves comprehensive response without truncation`);

  // -------------------------------------------------------------------------
  // TEST 4: Meal Replacement & Confirmation Logic Strictly Protected
  // -------------------------------------------------------------------------
  console.log("\n--- 4. Testing Protection of Meal Replacement & Confirmation Workflow ---");
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
  assert(mealData.requiresConfirmation === true, `Requires confirmation before mutating`);
  assert(!mealData.replyText.includes("**Recommended reading:**"), `Meal proposal is NOT reformatted with nutrition reading list`);
  assert(!mealData.replyText.includes("**Short answer:**"), `Meal proposal preserves natural conversational proposal text`);

  // Now test confirmation of a pending proposal
  const confirmReq = new Request("http://localhost:3000/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: "Yes, apply it",
      currentDate: "2026-10-05",
      conversationState: {
        pendingProposal: {
          id: "prop-12345",
          action: "replace_meal",
          intent: "meal_replacement",
          targetDate: "2026-10-06",
          targetSlot: "breakfast",
          meals: [
            { slot: "breakfast", title: "Avocado Egg Toast", calories: 450, protein: 22, carbs: 35, fat: 24 },
          ],
        },
      },
    }),
  });

  const confirmRes = await chatHandler(confirmReq as any);
  const confirmData = await confirmRes.json();

  assert(confirmRes.status === 200, `Confirmation returns HTTP 200`);
  assert(confirmData.shouldMutatePlan === true, `Confirmation triggers shouldMutatePlan = true`);
  assert(confirmData.confirmedProposalId === "prop-12345", `Confirms exact proposal ID`);
  assert(!confirmData.replyText.includes("**Short answer:**"), `Confirmation response is not reformatted by nutrition formatter`);

  // -------------------------------------------------------------------------
  // TEST 5: Other Nutrition Topics (Fiber, Protein, Fasting)
  // -------------------------------------------------------------------------
  console.log("\n--- 5. Testing Other Nutrition Topics Final Output ---");
  const otherTopics = [
    { q: "What are the benefits of eating more fiber?", expected: "fiber" },
    { q: "Does eating more protein help with muscle growth?", expected: "protein" },
    { q: "What does research say about intermittent fasting?", expected: "fasting" },
  ];

  for (const item of otherTopics) {
    const req = new Request("http://localhost:3000/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: item.q }),
    });

    const res = await chatHandler(req as any);
    const data = await res.json();

    assert(res.status === 200, `Query "${item.q}" returns HTTP 200`);
    assert(data.researchSources?.length === 2, `Query "${item.q}" returns exactly two sources`);
    const count = countBodyWords(data.replyText || "");
    assert(count >= 60 && count <= 135, `Query "${item.q}" body is concise (~80–130 words, got: ${count})`);
  }

  console.log("\n==================================================================");
  console.log(`Regression Test Results: ${passed} passed | ${failed} failed`);
  console.log("==================================================================");

  if (failed > 0) process.exit(1);
  process.exit(0);
}

runRegressionTestSuite().catch((err) => {
  console.error("Test failure:", err);
  process.exit(1);
});
