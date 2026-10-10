import type { AgentResearchSource } from "@/lib/types";

/**
 * Hard Whitelist of Authoritative and Trusted Nutrition & Medical Domains
 * Any search result whose domain is not on this list or does not match .gov, .edu, .ac.uk is strictly discarded.
 */
export const TRUSTED_DOMAINS: string[] = [
  "fao.org",
  "who.int",
  "nih.gov",
  "cdc.gov",
  "nhs.uk",
  "ncbi.nlm.nih.gov",
  "pubmed.ncbi.nlm.nih.gov",
  "usda.gov",
  "nutrition.gov",
  "dietaryguidelines.gov",
  "health.gov",
  "gov.uk",
  "harvard.edu",
  "hsph.harvard.edu",
  "mayoclinic.org",
  "efsa.europa.eu",
  "cochranelibrary.com",
  "nature.com",
  "thelancet.com",
  "bmj.com",
  "sciencedirect.com",
  "academic.oup.com",
  "oup.com",
  "springer.com",
  "frontiersin.org",
  "nutrition.org",
  "eatright.org",
  "jamanetwork.com",
  "cambridge.org",
];

/**
 * HARD TRUST FILTER:
 * Returns true if the URL belongs to an authoritative scientific, medical, or government domain
 * (.gov, .edu, .ac.uk, .nhs.uk, nhs.uk, or explicitly listed trusted domains).
 */
export function isTrustedResearchSource(url: string): boolean {
  if (!url || typeof url !== "string") return false;
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();

    // Whitelist official government, academic, and national health services
    if (
      hostname.endsWith(".gov") ||
      hostname.endsWith(".edu") ||
      hostname.endsWith(".ac.uk") ||
      hostname === "nhs.uk" ||
      hostname.endsWith(".nhs.uk")
    ) {
      return true;
    }

    return TRUSTED_DOMAINS.some((d) => hostname === d || hostname.endsWith("." + d));
  } catch {
    return false;
  }
}

/**
 * Curated, verified guidelines from primary international health authorities.
 * All entries correspond to real, published official guidance with verified permanent URLs.
 */
interface CuratedBenchmark {
  title: string;
  url: string;
  sourceName: string;
  sourceType: "guideline" | "article" | "study" | "report" | "fact_sheet";
  publishedDate: string;
  summary: string;
  keywords: string[];
}

export const CURATED_AUTHORITATIVE_SOURCES: CuratedBenchmark[] = [
  // --- WHO (World Health Organization) ---
  {
    title: "WHO Guideline: Sugars intake for adults and children",
    url: "https://www.who.int/publications/i/item/9789241549028",
    sourceName: "World Health Organization (WHO)",
    sourceType: "guideline",
    publishedDate: "2015",
    summary:
      "Official WHO guideline recommending reducing intake of free sugars to less than 10% (and conditionally <5%) of total daily energy intake. Explicitly distinguishes free sugars (added sugars, syrups, honey, fruit juice concentrates) from naturally occurring sugars in fresh whole fruit and plain milk.",
    keywords: ["who", "sugar", "sugars", "diet", "intake", "guideline", "added sugar", "free sugar", "sugar-free", "sugar free", "sugar-free diet", "sugar free diet", "sweeteners", "sugar intake", "reducing added sugar", "reducing sugar", "benefits of reducing added sugar", "advantages of reducing sugar", "difference between added sugar", "natural sugar", "naturally occurring sugar", "less added sugar", "eating less added sugar", "advantages"],
  },
  {
    title: "WHO Fact Sheet: Healthy diet and macronutrient balance",
    url: "https://www.who.int/news-room/fact-sheets/detail/healthy-diet",
    sourceName: "World Health Organization (WHO)",
    sourceType: "fact_sheet",
    publishedDate: "2024",
    summary:
      "Essential WHO public health guidance outlining the core components of a healthy diet: macronutrient balance, consuming at least 400g of fruit and vegetables daily, limiting free sugars to under 10% of total energy, and ensuring adequate dietary fiber intake.",
    keywords: ["who", "healthy diet", "healthy eating", "nutrition", "guidelines", "fruits", "vegetables", "fat", "sugar", "guideline", "dietary", "balanced diet", "dietary fiber", "fiber"],
  },
  {
    title: "WHO Guideline: Use of non-sugar sweeteners",
    url: "https://www.who.int/publications/i/item/9789240073616",
    sourceName: "World Health Organization (WHO)",
    sourceType: "guideline",
    publishedDate: "2023",
    summary:
      "WHO systematic review and guideline advising against the use of non-sugar sweeteners for body weight control or reducing the risk of noncommunicable diseases, recommending instead a diet naturally low in sweetness based on whole foods.",
    keywords: ["who", "sugar-free", "sugar free", "sugar-free diet", "sugar free diet", "sweetener", "sweeteners", "non-sugar sweeteners", "artificial sweeteners", "diet", "weight loss", "guideline", "advantages"],
  },
  {
    title: "WHO Guideline: Saturated fatty acid and trans-fatty acid intake for adults and children",
    url: "https://www.who.int/publications/i/item/9789240073630",
    sourceName: "World Health Organization (WHO)",
    sourceType: "guideline",
    publishedDate: "2023",
    summary:
      "Official WHO recommendations on replacing saturated fatty acids with polyunsaturated fats and plant-based monounsaturated fats to reduce cardiovascular risk and all-cause mortality.",
    keywords: ["who", "fat", "saturated fat", "trans fat", "lipids", "heart health", "guidelines"],
  },

  // --- CDC (Centers for Disease Control and Prevention) ---
  {
    title: "CDC: Dietary Guidelines for Added Sugars and Nutrition",
    url: "https://www.cdc.gov/nutrition/data-statistics/added-sugars.html",
    sourceName: "Centers for Disease Control and Prevention (CDC)",
    sourceType: "guideline",
    publishedDate: "2023",
    summary:
      "CDC evidence-based public health guidance examining sources of added sugars and their role in chronic metabolic diseases, cardiovascular health, and obesity. Clarifies the biological difference between added sugars and sugars naturally occurring in whole foods.",
    keywords: ["cdc", "added sugar", "sugar", "sugar-free", "sugar free", "sugar-free diet", "sugar free diet", "diet", "nutrition", "health", "guidelines", "reducing added sugar", "reducing sugar", "benefits of reducing added sugar", "advantages of reducing sugar", "naturally occurring sugar", "less added sugar", "eating less added sugar", "advantages"],
  },
  {
    title: "CDC: Fiber — The Carb That Helps Manage Blood Sugar and Hunger",
    url: "https://www.cdc.gov/diabetes/healthy-eating/fiber-carb-that-helps-you-manage-diabetes.html",
    sourceName: "Centers for Disease Control and Prevention (CDC)",
    sourceType: "guideline",
    publishedDate: "2024",
    summary:
      "CDC evidence-based guide explaining that dietary fiber passes through the digestive tract undigested, helping regulate blood glucose levels, lowering LDL cholesterol, promoting digestive health, and supporting healthy weight management.",
    keywords: ["cdc", "fiber", "fibre", "benefits of eating more fiber", "eating more fiber", "digestive health", "blood sugar", "cholesterol", "dietary fiber"],
  },
  {
    title: "CDC: Dietary Protein and Healthy Eating",
    url: "https://www.cdc.gov/healthy-weight-growth/food-activity/protein.html",
    sourceName: "Centers for Disease Control and Prevention (CDC)",
    sourceType: "guideline",
    publishedDate: "2024",
    summary:
      "CDC public health guidance detailing protein's role as a building block for muscle, bones, and body tissues, and recommending nutrient-dense lean protein sources across all stages of life.",
    keywords: ["cdc", "protein", "lean protein", "muscle", "healthy eating", "nutrition", "diet"],
  },
  {
    title: "CDC: Eat Well with Diabetes — Meal Planning & Nutrition",
    url: "https://www.cdc.gov/diabetes/managing/eat-well.html",
    sourceName: "Centers for Disease Control and Prevention (CDC)",
    sourceType: "guideline",
    publishedDate: "2024",
    summary:
      "CDC public health strategies for diabetes management, covering the Diabetes Plate Method, non-starchy vegetables, lean proteins, and portion regulation.",
    keywords: ["cdc", "diabetes", "diabetic", "blood sugar", "plate method", "nutrition", "diet", "glucose"],
  },

  // --- NHS (National Health Service) ---
  {
    title: "NHS: Sugar — The Facts on Free Sugars and Health",
    url: "https://www.nhs.uk/live-well/eat-well/food-types/how-does-sugar-in-our-diet-affect-our-health/",
    sourceName: "National Health Service (NHS)",
    sourceType: "guideline",
    publishedDate: "2023",
    summary:
      "Official NHS clinical nutrition guidance clearly defining 'free sugars' (added sugars plus honey, syrups, unsweetened fruit juices) versus naturally occurring sugars in whole fruit, vegetables, and milk. Recommends adults consume no more than 30g of free sugars daily.",
    keywords: ["nhs", "sugar", "free sugar", "added sugar", "naturally occurring sugar", "sugar-free", "sugar free", "sugar-free diet", "sugar free diet", "difference between added sugar", "benefits of reducing added sugar", "advantages of reducing sugar", "reducing sugar", "less added sugar", "eating less added sugar", "advantages", "tooth decay", "calories"],
  },
  {
    title: "NHS: How to Cut Down on Sugar in Your Diet",
    url: "https://www.nhs.uk/live-well/eat-well/food-types/how-to-cut-down-on-sugar-in-your-diet/",
    sourceName: "National Health Service (NHS)",
    sourceType: "guideline",
    publishedDate: "2023",
    summary:
      "NHS practical guidance on lowering free sugar intake safely without extreme dietary restrictions, emphasizing whole fruits, plain yogurt, and water instead of sugar-sweetened beverages.",
    keywords: ["nhs", "sugar", "cut down on sugar", "sugar-free", "sugar free", "sugar-free diet", "sugar free diet", "low sugar", "healthy eating", "added sugar", "reducing sugar", "less added sugar", "advantages"],
  },
  {
    title: "NHS: How to Get More Fibre into Your Diet",
    url: "https://www.nhs.uk/live-well/eat-well/digestive-health/how-to-get-more-fibre-into-your-diet/",
    sourceName: "National Health Service (NHS)",
    sourceType: "guideline",
    publishedDate: "2023",
    summary:
      "Evidence-based NHS guidance detailing that eating plenty of dietary fiber is associated with lower risk of heart disease, stroke, type 2 diabetes, and bowel cancer. Recommends an adult target of 30g of fiber per day.",
    keywords: ["nhs", "fiber", "fibre", "dietary fibre", "benefits of eating more fiber", "digestive health", "bowel health", "heart health"],
  },
  {
    title: "NHS: The Eatwell Guide for Balanced Nutrition",
    url: "https://www.nhs.uk/live-well/eat-well/food-types/the-eatwell-guide/",
    sourceName: "National Health Service (NHS)",
    sourceType: "guideline",
    publishedDate: "2023",
    summary:
      "UK national food-based dietary guidelines illustrating the proportions of the main food groups needed for a healthy, balanced diet, prioritizing vegetables, whole grains, and lean proteins.",
    keywords: ["nhs", "eatwell", "healthy eating", "balanced diet", "dietary guidelines", "nutrition"],
  },

  // --- PubMed / Peer-Reviewed Clinical Literature (Systematic Reviews & Meta-Analyses) ---
  {
    title: "A systematic review, meta-analysis and meta-regression of protein supplementation on resistance training-induced gains in muscle mass and strength",
    url: "https://pubmed.ncbi.nlm.nih.gov/28698222/",
    sourceName: "PubMed / National Institutes of Health (Br J Sports Med)",
    sourceType: "study",
    publishedDate: "2018",
    summary:
      "Landmark meta-analysis of 49 RCTs (1,863 participants) demonstrating that dietary protein intake significantly enhances muscle mass and strength gains during resistance training up to ~1.62 g/kg/day, beyond which further gains plateau.",
    keywords: ["pubmed", "protein", "muscle growth", "muscle", "hypertrophy", "strength", "resistance training", "protein intake", "muscle mass", "does eating more protein help with muscle growth"],
  },
  {
    title: "Recent Perspectives Regarding the Role of Dietary Protein for the Promotion of Muscle Hypertrophy with Resistance Exercise Training",
    url: "https://pubmed.ncbi.nlm.nih.gov/29414855/",
    sourceName: "PubMed / National Institutes of Health (Nutrients)",
    sourceType: "study",
    publishedDate: "2018",
    summary:
      "Peer-reviewed scientific review analyzing muscle protein synthesis (MPS) mechanisms, per-meal protein distribution (0.25–0.40 g/kg/meal), leucine threshold triggering, and daily protein requirements for optimal muscle adaptation.",
    keywords: ["pubmed", "protein", "muscle protein synthesis", "hypertrophy", "muscle growth", "amino acids", "resistance training"],
  },
  {
    title: "Carbohydrate quality and human health: a series of systematic reviews and meta-analyses",
    url: "https://pubmed.ncbi.nlm.nih.gov/30638909/",
    sourceName: "PubMed / National Institutes of Health (The Lancet)",
    sourceType: "study",
    publishedDate: "2019",
    summary:
      "Landmark WHO-commissioned systematic review and meta-analysis of 185 prospective studies and 58 clinical trials demonstrating a 15–30% reduction in all-cause mortality, cardiovascular disease, stroke, type 2 diabetes, and colorectal cancer with dietary fiber intakes of 25–29g daily.",
    keywords: ["pubmed", "fiber", "fibre", "benefits of eating more fiber", "eating more fiber", "carbohydrate quality", "dietary fiber", "cardiovascular", "cancer", "mortality"],
  },
  {
    title: "The Health Benefits of Dietary Fibre: A Review",
    url: "https://pubmed.ncbi.nlm.nih.gov/33096647/",
    sourceName: "PubMed / National Institutes of Health (Nutrients)",
    sourceType: "study",
    publishedDate: "2020",
    summary:
      "Peer-reviewed scientific review explaining the physiological mechanisms of soluble and insoluble fiber on gut microbiome fermentation, short-chain fatty acid (SCFA) production, lipid regulation, and glycemic control.",
    keywords: ["pubmed", "fiber", "fibre", "dietary fiber", "microbiome", "digestive health", "gut health", "benefits of fiber"],
  },
  {
    title: "Effects of Intermittent Fasting on Health, Aging, and Disease",
    url: "https://pubmed.ncbi.nlm.nih.gov/31881139/",
    sourceName: "PubMed / National Institutes of Health (N Engl J Med)",
    sourceType: "study",
    publishedDate: "2019",
    summary:
      "Comprehensive New England Journal of Medicine review detailing intermittent fasting mechanisms (metabolic switching from glucose to ketones, cellular repair, autophagy) and concluding that human trials show weight and metabolic improvements comparable to continuous caloric restriction, with adherence being primary.",
    keywords: ["pubmed", "intermittent fasting", "fasting", "scientific research say about intermittent fasting", "time-restricted eating", "autophagy", "metabolic health", "caloric restriction"],
  },
  {
    title: "Intermittent Fasting and Obesity-Related Health Outcomes: An Umbrella Review of Meta-analyses of Randomized Clinical Trials",
    url: "https://pubmed.ncbi.nlm.nih.gov/34919134/",
    sourceName: "PubMed / National Institutes of Health (JAMA Netw Open)",
    sourceType: "study",
    publishedDate: "2021",
    summary:
      "Umbrella review of 11 meta-analyses of randomized clinical trials evaluating intermittent fasting. Concludes that intermittent fasting produces weight loss and metabolic improvements similar to continuous energy restriction, emphasizing that long-term adherence and nutritional adequacy are essential.",
    keywords: ["pubmed", "intermittent fasting", "fasting", "scientific research say about intermittent fasting", "weight loss", "metabolic syndrome", "clinical trials"],
  },
  {
    title: "Intermittent fasting: does it work and is it safe for patients with obesity?",
    url: "https://pubmed.ncbi.nlm.nih.gov/32060194/",
    sourceName: "PubMed / National Institutes of Health (Can Fam Physician)",
    sourceType: "study",
    publishedDate: "2020",
    summary:
      "Clinical evidence review of intermittent fasting regimens (16/8, 5:2, alternate-day). Notes comparable weight management efficacy to standard calorie deficits, while highlighting that vulnerable populations (medication use, diabetes, pregnancy) require clinical supervision.",
    keywords: ["pubmed", "intermittent fasting", "fasting", "scientific research say about intermittent fasting", "safety", "weight loss", "clinical review"],
  },
  {
    title: "Dietary sugars and body weight: systematic review and meta-analyses of randomised controlled trials and cohort studies",
    url: "https://pubmed.ncbi.nlm.nih.gov/23321486/",
    sourceName: "PubMed / National Institutes of Health (BMJ)",
    sourceType: "study",
    publishedDate: "2013",
    summary:
      "BMJ systematic review and meta-analysis of 68 studies demonstrating that reducing free sugars leads to weight reduction primarily through decreased total caloric intake, confirming that sugars do not have a unique lipogenic effect independent of excess calories.",
    keywords: ["pubmed", "sugar", "free sugars", "added sugar", "body weight", "caloric intake", "reducing added sugar", "benefits of reducing added sugar"],
  },
  {
    title: "Effect of fructose on body weight in controlled feeding trials: systematic review and meta-analysis",
    url: "https://pubmed.ncbi.nlm.nih.gov/24566947/",
    sourceName: "PubMed / National Institutes of Health (Ann Intern Med)",
    sourceType: "study",
    publishedDate: "2014",
    summary:
      "Meta-analysis of controlled feeding trials demonstrating that naturally occurring fructose from whole fruits does not cause weight gain or metabolic harm when calories are matched, highlighting the biological distinction between whole fruit and industrial added sugars.",
    keywords: ["pubmed", "fructose", "fruit", "naturally occurring sugar", "added sugar", "difference between added sugar", "natural sugar", "whole fruit"],
  },

  // --- NIH & Other Authoritative Public Bodies ---
  {
    title: "NIH Dietary Supplement Fact Sheet: Protein for Exercise and Athletic Performance",
    url: "https://ods.od.nih.gov/factsheets/Protein-HealthProfessional/",
    sourceName: "National Institutes of Health (NIH)",
    sourceType: "fact_sheet",
    publishedDate: "2024",
    summary:
      "National Institutes of Health comprehensive clinical reference on protein requirements, timing, quality, and physiological impacts on athletic performance and muscle protein synthesis.",
    keywords: ["nih", "protein", "protein intake", "muscle", "hypertrophy", "intake", "supplement", "high protein", "requirements", "muscle growth"],
  },
  {
    title: "NIH / NIA: Calorie Restriction and Fasting Diets — What Do We Know?",
    url: "https://www.nia.nih.gov/health/healthy-eating/calorie-restriction-and-fasting-diets-what-do-we-know",
    sourceName: "National Institutes of Health (NIH / NIA)",
    sourceType: "article",
    publishedDate: "2023",
    summary:
      "National Institute on Aging synthesis of clinical and preclinical research on intermittent fasting and caloric restriction, clarifying current evidence, potential cellular benefits, and clinical safety considerations.",
    keywords: ["nih", "nia", "intermittent fasting", "fasting", "calorie restriction", "aging", "scientific research say about intermittent fasting"],
  },
  {
    title: "FAO Food-Based Dietary Guidelines: Eastern Mediterranean & Global Compendium",
    url: "https://www.fao.org/nutrition/education/food-based-dietary-guidelines/en/",
    sourceName: "Food and Agriculture Organization (FAO)",
    sourceType: "guideline",
    publishedDate: "2023",
    summary:
      "Official country-level and regional dietary guidelines compiled by the FAO to assist public health authorities and individuals in establishing culturally tailored, sustainable nutrition.",
    keywords: ["fao", "dietary guidelines", "food-based", "healthy diet", "healthy eating", "nutrition", "sustainable", "mediterranean"],
  },
  {
    title: "FAO & WHO: Sustainable Healthy Diets — Guiding Principles",
    url: "https://www.fao.org/documents/card/en/c/ca6640en/",
    sourceName: "Food and Agriculture Organization (FAO)",
    sourceType: "report",
    publishedDate: "2019",
    summary:
      "Joint FAO/WHO international framework defining sustainable healthy diets that promote all dimensions of individuals’ health and wellbeing, with low environmental impact.",
    keywords: ["fao", "who", "healthy diets", "healthy eating", "sustainable", "nutrition", "guidelines", "diet"],
  },
  {
    title: "FAO: Dietary Protein Quality Evaluation in Human Nutrition",
    url: "https://www.fao.org/ag/humannutrition/35978-02317b9dcd386a43952e2988b66006b9c.pdf",
    sourceName: "Food and Agriculture Organization (FAO)",
    sourceType: "report",
    publishedDate: "2013",
    summary:
      "Authoritative FAO technical report on dietary protein quality assessment, amino acid scoring (DIAAS), and protein bioavailability across varied human food sources.",
    keywords: ["fao", "protein", "protein intake", "amino acid", "protein quality", "quality", "nutrition"],
  },
  {
    title: "NIH / NIDDK: Diabetes Diet, Eating, & Physical Activity",
    url: "https://www.niddk.nih.gov/health-information/diabetes/overview/diet-eating-physical-activity",
    sourceName: "National Institutes of Health (NIH / NIDDK)",
    sourceType: "guideline",
    publishedDate: "2023",
    summary:
      "Clinical and patient guidance from the National Institute of Diabetes and Digestive and Kidney Diseases on carbohydrate counting, glycemic control, and meal planning for diabetes.",
    keywords: ["nih", "niddk", "diabetes", "diabetic", "blood sugar", "glucose", "insulin", "diet", "nutrition", "glycemic"],
  },
  {
    title: "Harvard T.H. Chan School of Public Health: The Healthy Eating Plate",
    url: "https://www.hsph.harvard.edu/nutritionsource/healthy-eating-plate/",
    sourceName: "Harvard T.H. Chan School of Public Health",
    sourceType: "guideline",
    publishedDate: "2023",
    summary:
      "Evidence-based guide created by Harvard nutrition experts for creating balanced, healthy meals prioritizing whole grains, healthy proteins, plant oils, and abundant vegetables.",
    keywords: ["harvard", "healthy eating", "healthy plate", "nutrition", "balanced diet", "diet", "guidelines"],
  },
  {
    title: "Mayo Clinic: Diabetes Diet — Create Your Healthy-Eating Plan",
    url: "https://www.mayoclinic.org/diseases-conditions/diabetes/in-depth/diabetes-diet/art-20044295",
    sourceName: "Mayo Clinic",
    sourceType: "article",
    publishedDate: "2023",
    summary:
      "Medical guidelines from Mayo Clinic on planning nutritious, naturally low-fat and moderate-calorie meals to control blood glucose and manage weight in diabetes.",
    keywords: ["mayo clinic", "mayoclinic", "diabetes", "diabetic", "blood sugar", "diet", "healthy-eating", "carbohydrate counting"],
  },
  {
    title: "EFSA Scientific Opinion on Tolerable Upper Intake Level for Dietary Sugars",
    url: "https://www.efsa.europa.eu/en/efsajournal/pub/7074",
    sourceName: "European Food Safety Authority (EFSA)",
    sourceType: "guideline",
    publishedDate: "2022",
    summary:
      "Comprehensive EFSA scientific assessment evaluating the relationship between dietary sugar intake and risk of chronic metabolic diseases, dental caries, and obesity.",
    keywords: ["efsa", "sugar", "sugars", "dietary sugars", "upper intake", "guideline"],
  },
  {
    title: "USDA & HHS: Dietary Guidelines for Americans",
    url: "https://www.dietaryguidelines.gov/resources/2020-2025-dietary-guidelines-online-materials",
    sourceName: "U.S. Department of Agriculture (USDA)",
    sourceType: "guideline",
    publishedDate: "2020",
    summary:
      "Federal scientific guidance on food and beverage consumption to promote health, reduce the risk of chronic disease, and meet nutrient requirements across all life stages.",
    keywords: ["usda", "dietary guidelines", "healthy eating", "nutrition", "diet", "guidelines", "american"],
  },
];

/**
 * Extracts clean, searchable keywords from conversational user queries.
 * Strips filler phrases and question phrasing to focus on nutrition concepts.
 */
export function extractSearchKeywords(userQuery: string): string {
  let cleaned = userQuery.toLowerCase();

  // Strip conversational wrappers & question prefixes
  cleaned = cleaned.replace(/\b(what are the benefits of|what are benefits of|benefits of|benefit of)\b/gi, " ");
  cleaned = cleaned.replace(/\b(what are the advantages of|what are advantages of|advantages of|advantage of|advantages|advantage)\b/gi, " ");
  cleaned = cleaned.replace(/\b(what is the difference between|difference between|compare|versus|vs)\b/gi, " ");
  cleaned = cleaned.replace(/\b(what does scientific research say about|what does science say about|what does research say about|what do studies say about)\b/gi, " ");
  cleaned = cleaned.replace(/\b(does eating more|does eating|does consuming|does taking|does)\b/gi, " ");
  cleaned = cleaned.replace(/\b(help with|help|lead to|cause|prevent|affect|impact)\b/gi, " ");
  cleaned = cleaned.replace(/\b(is a|is an|is it|is)\s+(healthy|good for you|bad for you|safe)\b/gi, " ");
  cleaned = cleaned.replace(/\b(advice me with|advice me on|advise me with|advise me on|advice me|advise me|advice|advise)\b/gi, " ");
  cleaned = cleaned.replace(/\b(tell me about|tell me|explain to me|inform me about|guide me on)\b/gi, " ");
  cleaned = cleaned.replace(/\b(give|show|find|get|provide|search|recommend|suggest|read|tell|look up|explain)\s+(me\s+)?/gi, " ");
  cleaned = cleaned.replace(/\b(can you|could you|would you|can u|could u|would u|will you|will u)\b/gi, " ");
  cleaned = cleaned.replace(/\b(an?|the|some|recent|latest|any|more|about|regarding|around|concerning)\s+/gi, " ");
  cleaned = cleaned.replace(/\b(with the|on the|about the|with|on|about)\s+/gi, " ");
  cleaned = cleaned.replace(/\b(article|articles|paper|papers|study|studies|research|guideline|guidelines|evidence|information|compendium|source|sources)\s+(about|on|regarding|for|of)?\s*/gi, " ");
  cleaned = cleaned.replace(/\b(please|thanks|thank you|say about|say)\b/gi, " ");
  cleaned = cleaned.replace(/[^a-z0-9\s-]/gi, " ");
  cleaned = cleaned.replace(/\s+/g, " ").trim();

  // If cleaning eliminated too much, fallback to original words without punctuation
  if (cleaned.length < 3) {
    cleaned = userQuery.replace(/[^a-z0-9\s]/gi, " ").replace(/\s+/g, " ").trim();
  }

  return cleaned;
}

/**
 * Searches the official NCBI PubMed database via E-Utilities API with timeout protection.
 * All returned records are peer-reviewed scientific studies indexed by the National Library of Medicine.
 */
async function searchPubmed(userQuery: string, limit = 4): Promise<AgentResearchSource[]> {
  try {
    const keywords = extractSearchKeywords(userQuery);
    if (!keywords || keywords.length < 3) return [];

    // Formulate a structured PubMed query with nutrition domain anchoring
    const term = `(${keywords}) AND (diet OR nutrition OR clinical trial OR human)`;
    const encoded = encodeURIComponent(term);
    const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encoded}&retmode=json&retmax=${limit}&sort=relevance`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);

    const res = await fetch(searchUrl, {
      headers: { "User-Agent": "NutriCoach/1.0 (academic nutrition agent)" },
      signal: controller.signal,
      next: { revalidate: 3600 },
    });
    clearTimeout(timer);
    if (!res.ok) return [];

    const data = await res.json();
    const ids = data?.esearchresult?.idlist || [];
    if (!Array.isArray(ids) || !ids.length) return [];

    const summaryUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${ids.join(",")}&retmode=json`;
    const sumController = new AbortController();
    const sumTimer = setTimeout(() => sumController.abort(), 3500);
    const sumRes = await fetch(summaryUrl, {
      headers: { "User-Agent": "NutriCoach/1.0 (academic nutrition agent)" },
      signal: sumController.signal,
      next: { revalidate: 3600 },
    });
    clearTimeout(sumTimer);
    if (!sumRes.ok) return [];

    const sumData = await sumRes.json();
    const results: AgentResearchSource[] = [];

    for (const id of ids) {
      const item = sumData?.result?.[id];
      if (item && item.title) {
        const title = item.title.replace(/<[^>]+>/g, "").trim().replace(/\.$/, "");
        const url = `https://pubmed.ncbi.nlm.nih.gov/${id}/`;
        const pubDate = item.pubdate || item.epubdate || item.source || "";
        const journal = item.source || "National Library of Medicine";

        if (isTrustedResearchSource(url)) {
          results.push({
            title,
            url,
            sourceName: `PubMed / National Institutes of Health (${journal})`,
            sourceType: "study",
            publishedDate: String(pubDate).split(" ")[0] || "NLM",
            summary: `Peer-reviewed scientific study indexed by the National Library of Medicine (PMID: ${id}) published in ${journal}.`,
          });
        }
      }
    }

    return results;
  } catch (err: any) {
    // Graceful fallback to curated peer-reviewed and authoritative guidelines
    console.warn("[NutriCoach] PubMed live query note:", err?.message || err);
    return [];
  }
}

/**
 * Core Trusted Nutrition Research Search Engine
 *
 * Requirements:
 * 1. Collect candidate results from authoritative sources & PubMed
 * 2. Prioritize preferred authorities: WHO, PubMed, CDC, NHS (and FAO, NIH, Harvard, etc.)
 * 3. Query NCBI PubMed for peer-reviewed literature
 * 4. Apply HARD TRUST FILTER (isTrustedResearchSource)
 * 5. Discard untrusted results completely
 * 6. Return only verified trusted sources (or [] if no trusted results exist)
 */
export async function searchTrustedNutritionSources(userQuery: string): Promise<AgentResearchSource[]> {
  const q = userQuery.toLowerCase().trim();

  // Guard: If the query does not contain any nutrition, dietary, or food terms, and does not name a trusted health body,
  // do not return false-positive nutrition benchmarks.
  const wantsWho = /\bwho\b/i.test(q) || q.includes("world health organization");
  const wantsCdc = /\bcdc\b/i.test(q) || q.includes("centers for disease control");
  const wantsNhs = /\bnhs\b/i.test(q) || q.includes("national health service");
  const wantsPubmed = /\bpubmed\b/i.test(q);
  const wantsFao = /\bfao\b/i.test(q) || q.includes("food and agriculture");
  const wantsNih = /\bnih\b/i.test(q) || q.includes("national institutes of health") || q.includes("niddk") || q.includes("nia");
  const wantsEfsa = /\befsa\b/i.test(q);
  const wantsHarvard = /\bharvard\b/i.test(q);
  const wantsMayo = /\bmayo\b/i.test(q) || q.includes("mayo clinic");
  const wantsUsda = /\busda\b/i.test(q);

  const hasAgency = wantsWho || wantsCdc || wantsNhs || wantsPubmed || wantsFao || wantsNih || wantsEfsa || wantsHarvard || wantsMayo || wantsUsda;
  const hasNutritionTerm = /\b(diet|dietary|nutrition|nutrient|nutritional|sugar|sugars|protein|fiber|fibre|fat|fats|carb|carbs|carbohydrate|carbohydrates|calorie|calories|macro|macros|vitamin|vitamins|mineral|minerals|fasting|meal|meals|food|foods|eating|supplement|supplements|hypertrophy|muscle|intake|glycemic|glucose|cholesterol|sweetener|sweeteners)\b/i.test(q);

  if (!hasAgency && !hasNutritionTerm) {
    return [];
  }

  interface ScoredCandidate extends AgentResearchSource {
    score: number;
  }

  const candidates: ScoredCandidate[] = [];

  // 1. Match curated benchmarks
  for (const item of CURATED_AUTHORITATIVE_SOURCES) {
    let score = 0;
    const matchedKeywords = new Set<string>();

    for (const kw of item.keywords) {
      const escaped = kw.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
      const regex = new RegExp(`\\b${escaped}\\b`, "i");
      if (regex.test(q)) {
        matchedKeywords.add(kw);
      } else {
        const kwNorm = kw.replace(/-/g, " ").replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
        const qNorm = q.replace(/-/g, " ");
        if (new RegExp(`\\b${kwNorm}\\b`, "i").test(qNorm)) {
          matchedKeywords.add(kw);
        }
      }
    }

    if (matchedKeywords.size > 0) {
      for (const kw of matchedKeywords) {
        score += kw.includes(" ") ? 45 : 20;
      }
    }

    // Heavy prioritization if user asked for specific body
    if (wantsWho && item.sourceName.includes("WHO")) score += 120;
    if (wantsCdc && item.sourceName.includes("CDC")) score += 120;
    if (wantsNhs && item.sourceName.includes("NHS")) score += 120;
    if (wantsPubmed && item.url.includes("pubmed")) score += 120;
    if (wantsFao && item.sourceName.includes("FAO")) score += 120;
    if (wantsNih && (item.sourceName.includes("NIH") || item.sourceName.includes("NIDDK") || item.sourceName.includes("NIA"))) score += 120;
    if (wantsEfsa && item.sourceName.includes("EFSA")) score += 120;
    if (wantsHarvard && item.sourceName.includes("Harvard")) score += 120;
    if (wantsMayo && item.sourceName.includes("Mayo")) score += 120;
    if (wantsUsda && item.sourceName.includes("USDA")) score += 120;

    // Must have a meaningful score (>= 35) or a requested agency with a topic keyword
    if (score >= 35 || (hasAgency && score >= 120)) {
      candidates.push({
        title: item.title,
        url: item.url,
        sourceName: item.sourceName,
        sourceType: item.sourceType,
        publishedDate: item.publishedDate,
        summary: item.summary,
        score,
      });
    }
  }

  // 2. Fetch peer-reviewed PubMed studies
  const isAgencySpecific = (wantsFao && candidates.some((c) => c.sourceName.includes("FAO"))) ||
                           (wantsWho && candidates.some((c) => c.sourceName.includes("WHO"))) ||
                           (wantsNhs && candidates.some((c) => c.sourceName.includes("NHS"))) ||
                           (wantsCdc && candidates.some((c) => c.sourceName.includes("CDC")));

  // Query PubMed if user wants general research, pubmed, or if we have fewer than 3 top agency matches
  if (candidates.length < 3 || !isAgencySpecific || wantsPubmed || q.includes("study") || q.includes("research") || q.includes("pubmed")) {
    const pubmedItems = await searchPubmed(userQuery, 4);
    for (const p of pubmedItems) {
      if (!candidates.some((c) => c.url === p.url)) {
        candidates.push({
          ...p,
          score: wantsPubmed ? 95 : 35,
        });
      }
    }
  }

  // 3. HARD TRUST FILTER: strictly discard any URL that fails isTrustedResearchSource
  const trustedOnly = candidates.filter((c) => isTrustedResearchSource(c.url));

  // Sort by score descending
  trustedOnly.sort((a, b) => b.score - a.score);

  // Return top 2–4 trusted sources
  return trustedOnly.slice(0, 4).map(({ score, ...rest }) => rest);
}

