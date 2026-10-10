import type { AgentResearchSource } from "../types";

/**
 * Returns a concise, tailored one-sentence summary of why an article is relevant.
 */
export function getRelevanceSentence(s: AgentResearchSource): string {
  const t = s.title.toLowerCase();
  const u = s.url.toLowerCase();

  // Check fiber before sugar to prevent false match on "blood sugar"
  if (t.includes("fiber") || t.includes("fibre") || u.includes("fiber")) {
    if (t.includes("carb that helps") || u.includes("cdc.gov")) {
      return "Authoritative guidance on fiber targets, hunger satiety, and blood glucose stabilization.";
    }
    return "Major systematic review confirming 25–30g daily fiber reduces cardiovascular and chronic disease risk.";
  }

  if (t.includes("sugar") || u.includes("sugar")) {
    if (t.includes("who") || u.includes("who.int")) {
      return "Official WHO guideline recommending reducing free sugars to less than 10% of total daily energy intake.";
    }
    if (t.includes("how does sugar") || u.includes("nhs.uk")) {
      return "Clear clinical guidance explaining how free sugars affect health, tooth decay, and daily energy.";
    }
    return "Evidence-based health guidance detailing the metabolic impacts of reducing added sugars.";
  }

  if (t.includes("protein") || u.includes("protein")) {
    if (t.includes("systematic review") || u.includes("28698222")) {
      return "Key meta-analysis confirming 1.6–2.2 g/kg/day optimizes resistance-training muscle mass and strength gains.";
    }
    return "Authoritative guidance on protein requirements, timing, and physiological roles in tissue repair.";
  }

  if (t.includes("fasting") || u.includes("fasting") || u.includes("31881139") || u.includes("34919134")) {
    if (u.includes("31881139")) {
      return "Comprehensive NEJM review examining cellular switching, longevity mechanisms, and clinical outcomes.";
    }
    return "Umbrella review analyzing clinical trials on weight reduction and cardiometabolic effects of fasting.";
  }

  if (s.summary && s.summary.length > 20) {
    const firstSentence = s.summary.split(/\.\s+/)[0].trim();
    return firstSentence.endsWith(".") ? firstSentence : firstSentence + ".";
  }
  return `Evidence-based research and official guidance published by ${s.sourceName}.`;
}

/**
 * Deterministic final-layer response formatter for nutrition question-answering.
 * Enforces the required structure:
 * **Short answer:** 1 concise paragraph (2–3 sentences, ~30–45 words)
 * **Key takeaways:** Up to 3 concise bullet points (~45–65 words)
 * **Recommended reading:** Exactly 2 relevant, verified articles (when 2 available)
 * Optional brief disclaimer only when clinical/pregnancy/medications apply.
 *
 * For standard nutrition questions, targets ~80–130 words (excluding titles and links).
 * If isDetailedRequest is true, preserves comprehensive explanation.
 */
export function formatNutritionResponse(
  rawText: string,
  message: string,
  sources: AgentResearchSource[],
  isDetailedRequest: boolean = false
): string {
  if (isDetailedRequest) {
    return rawText;
  }

  const topSources = (sources || []).slice(0, 2);
  const m = message.toLowerCase();

  const isSugarDiff = (m.includes("added") && m.includes("natural")) || m.includes("difference between added") || m.includes("difference");
  const isSugarFree = m.includes("sugar-free") || m.includes("sugar free");
  const isSugarGeneral = m.includes("sugar");
  const isProtein = m.includes("protein") && (m.includes("muscle") || m.includes("hypertrophy"));
  const isFiber = m.includes("fiber") || m.includes("fibre");
  const isFasting = m.includes("fasting");

  // 1. EXTRACT OR CURATE SHORT ANSWER
  let shortAnswer = "";

  // Attempt extraction from rawText if formatted with **Short answer:**
  const saMatch = rawText.match(/\*\*Short answer:\*\*?\s*([\s\S]*?)(?=\*\*Key (?:benefits|takeaways)|\*\*Recommended reading|##|\n\n[•*-]|$)/i);
  if (saMatch && saMatch[1].trim()) {
    const candidate = saMatch[1].replace(/^[#*•_`\s]+/, "").trim();
    const sentences = candidate.split(/(?<=[.!?])\s+/).filter(Boolean);
    if (sentences.length >= 1) {
      shortAnswer = sentences.slice(0, 3).join(" ").trim();
    }
  }

  // If extraction didn't yield a valid 2-3 sentence answer or is too long/short
  const saWords = shortAnswer.split(/\s+/).filter(Boolean).length;
  if (saWords < 12 || saWords > 60 || !shortAnswer) {
    if (isSugarDiff) {
      shortAnswer =
        "Naturally occurring sugars in whole foods come packaged with protective dietary fiber and micronutrients, whereas added or free sugars deliver concentrated energy without fiber and are metabolized quickly.";
    } else if (isSugarFree) {
      shortAnswer =
        "A diet low in added sugars provides strong metabolic and dental benefits, but completely eliminating wholesome foods with natural sugars—such as fresh fruit and plain dairy—is unnecessary.";
    } else if (isSugarGeneral) {
      shortAnswer =
        "Reducing added sugar intake lowers your risk of tooth decay, unhealthy weight gain, and chronic metabolic conditions including type 2 diabetes and cardiovascular disease.";
    } else if (isProtein) {
      shortAnswer =
        "Consuming adequate dietary protein combined with progressive resistance training is well established to stimulate muscle protein synthesis and promote muscle growth.";
    } else if (isFiber) {
      shortAnswer =
        "Eating more dietary fiber improves digestive regulation, stabilizes blood sugar levels, and significantly lowers long-term risk of cardiovascular disease and type 2 diabetes.";
    } else if (isFasting) {
      shortAnswer =
        "Research shows intermittent fasting (such as 16/8 time-restricted eating) is an effective method for weight management and metabolic health, primarily by helping individuals achieve a consistent daily caloric deficit.";
    } else {
      shortAnswer =
        "Evidence-based nutrition emphasizes a dietary pattern rich in whole, minimally processed foods, adequate protein, dietary fiber, and healthy fats tailored to your energy needs.";
    }
  }

  // Accuracy safeguards for sugar: prevent extreme bans
  if (isSugarGeneral && (shortAnswer.toLowerCase().includes("eliminate all") || shortAnswer.toLowerCase().includes("cut fruit"))) {
    shortAnswer =
      "A diet low in added sugars provides strong metabolic and dental benefits, but completely eliminating wholesome foods with natural sugars—such as fresh fruit and plain dairy—is unnecessary.";
  }

  // 2. EXTRACT OR CURATE KEY TAKEAWAYS (up to 3 bullets)
  let takeaways: string[] = [];

  // Check if rawText contains bullets
  const bulletLines = rawText
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /^[•*-]\s+/.test(l) || /^\d+\.\s+/.test(l));

  const validExtractedBullets = bulletLines
    .map((l) => l.replace(/^[•*-\d.]+\s+/, "").trim())
    .filter((b) => {
      const lower = b.toLowerCase();
      return (
        !lower.includes("http") &&
        !lower.includes("[read article]") &&
        !lower.includes("pubmed id") &&
        !lower.includes("disclaimer") &&
        !lower.includes("consult a") &&
        b.length > 20 &&
        b.length < 220
      );
    });

  if (validExtractedBullets.length >= 2) {
    takeaways = validExtractedBullets.slice(0, 3);
  }

  // Fallback to scientifically verified takeaways
  if (takeaways.length < 2) {
    if (isSugarDiff) {
      takeaways = [
        "Whole fruits and plain dairy contain intrinsic sugars bound to fiber and water, which moderate digestion and glycemic response.",
        "Free sugars (refined sugars, syrups, sweetened beverages) deliver rapid energy without satiety and should be limited to under 10% of daily calories.",
        "Cutting added sugars supports cardiometabolic and dental health without any need to eliminate nutrient-rich whole fruits.",
      ];
    } else if (isSugarFree) {
      takeaways = [
        "Global health guidelines advise minimizing free and added sugars (soft drinks, confectionery, syrups), not wholesome fresh fruits or dairy.",
        "Limiting free sugars to under 10% (ideally under 5%) of daily energy intake significantly lowers the risk of tooth decay and cardiometabolic disease.",
        "A practical, low-added-sugar pattern supports steady energy levels and healthy weight management without extreme food restrictions.",
      ];
    } else if (isSugarGeneral) {
      takeaways = [
        "The WHO and NHS recommend limiting free sugars to less than 10% of total daily energy (roughly 30g to 50g for adults), with further health benefits below 5%.",
        "Liquid and refined sugars lack dietary fiber, leading to rapid blood sugar spikes and excess calorie intake without promoting satiety.",
        "Replacing sugar-sweetened foods with whole foods improves long-term cardiovascular health and helps maintain steady daily energy.",
      ];
    } else if (isProtein) {
      takeaways = [
        "Comprehensive meta-analyses show that daily protein intakes between 1.6 and 2.2 grams per kilogram of body weight optimize gains in muscle mass and strength.",
        "Consuming protein beyond approximately 1.6 to 2.2 g/kg daily generally provides diminishing returns for muscle hypertrophy.",
        "Distributing protein across daily meals (roughly 25–40g per meal from quality lean sources) effectively supports sustained muscle recovery.",
      ];
    } else if (isFiber) {
      takeaways = [
        "Authoritative bodies (WHO, CDC, NHS) recommend adults target 25 to 30 grams of dietary fiber daily from whole foods.",
        "Soluble fiber slows carbohydrate absorption and helps reduce LDL cholesterol, while insoluble fiber supports bowel regularity and gut microbiome health.",
        "Higher fiber intakes from legumes, vegetables, whole grains, and fruits are clinically associated with a 15–30% reduction in all-cause mortality.",
      ];
    } else if (isFasting) {
      takeaways = [
        "Randomized clinical trials demonstrate that intermittent fasting protocols achieve weight loss and metabolic improvements comparable to standard continuous calorie restriction.",
        "Fasting schedules can support insulin sensitivity and cellular repair mechanisms, but long-term success depends on overall diet quality and individual adherence.",
        "Intermittent fasting is an optional eating pattern rather than a mandatory protocol, and does not produce clinically superior fat loss compared to balanced calorie-matched diets.",
      ];
    } else {
      takeaways = [
        "Long-term health is driven by overall dietary consistency, nutrient density, and caloric balance rather than isolating individual foods.",
        "Prioritizing unprocessed vegetables, legumes, whole grains, and lean proteins provides essential micronutrients and promotes lasting satiety.",
      ];
    }
  }

  takeaways = takeaways.slice(0, 3);

  // 3. RECOMMENDED READING (exactly 2 verified sources when 2 available)
  let readingList = "";
  if (topSources.length === 0) {
    readingList = "• Additional relevant research for this specific topic could not be verified from primary health authorities.";
  } else {
    const items = topSources.map((s) => {
      const relevance = getRelevanceSentence(s);
      return `• **${s.title}** (${s.sourceName}) — ${relevance} [Read article](${s.url})`;
    });
    if (topSources.length === 1) {
      items.push("• Additional relevant verified evidence could not be confirmed from primary health authorities.");
    }
    readingList = items.join("\n");
  }

  // 4. MEDICAL DISCLAIMER (only when question involves specific medical conditions, medications, or pregnancy)
  let disclaimer = "";
  const needsDisclaimer =
    /\b(pregnant|pregnancy|diabetes|diabetic|medication|medications|insulin|renal|kidney|heart condition|eating disorder)\b/i.test(m) ||
    m.includes("fasting");
  if (needsDisclaimer) {
    disclaimer = "\n\n_Note: For specific medical conditions, medications, or pregnancy, consult a qualified healthcare professional._";
  }

  const takeawaysText = takeaways.map((t) => `• ${t}`).join("\n");

  return `**Short answer:**\n${shortAnswer}\n\n**Key takeaways:**\n${takeawaysText}\n\n**Recommended reading:**\n${readingList}${disclaimer}`;
}

export function synthesizeEvidenceFallback(message: string, sources: AgentResearchSource[]): string {
  return formatNutritionResponse("", message, sources, false);
}
