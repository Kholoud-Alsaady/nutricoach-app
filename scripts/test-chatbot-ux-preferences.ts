import { formatNutritionResponse, synthesizeEvidenceFallback } from "../src/lib/research/nutrition-formatter";
import { searchTrustedNutritionSources } from "../src/lib/research/trusted-sources";
import {
  DEFAULT_CHATBOT_PREFERENCES,
  type ChatbotPreferences,
  type Profile,
} from "../src/lib/types";

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`✅ [PASS] ${msg}`);
    passed++;
  } else {
    console.error(`❌ [FAIL] ${msg}`);
    failed++;
  }
}

async function runTestSuite() {
  console.log("=== RUNNING CHATBOT UX, MARKDOWN, AND PREFERENCES TEST SUITE ===\n");

  // TEST 1: Nutrition response formatting - begins directly without "Short answer:" heading
  console.log("--- 1. Nutrition Formatter & 'Short answer:' Removal ---");
  const sources = await searchTrustedNutritionSources("sugar free diet advantages");
  const formatted = formatNutritionResponse(
    "A diet low in added sugars provides strong metabolic and dental benefits.",
    "sugar free diet advantages",
    sources.slice(0, 2),
    false
  );

  assert(!formatted.includes("**Short answer:**"), "Formatted output does NOT contain '**Short answer:**'");
  assert(!formatted.startsWith("Short answer:"), "Formatted output does NOT start with 'Short answer:'");
  assert(formatted.includes("**Key takeaways:**"), "Formatted output includes '**Key takeaways:**'");
  assert(formatted.includes("**Recommended reading:**"), "Formatted output includes '**Recommended reading:**'");
  assert(formatted.startsWith("A diet low in added sugars"), "Formatted output begins directly with the answer");

  // TEST 2: Source limit - maximum 2 sources
  console.log("\n--- 2. Research Source Constraints ---");
  const links = formatted.match(/\[Read article\]/g) || [];
  assert(links.length <= 2, `Recommended reading contains at most 2 sources (found: ${links.length})`);
  assert(sources.length > 0, "Retrieved sources from trusted authorities");

  // TEST 3: Greeting message logic simulation (mirrors route.ts logic)
  console.log("\n--- 3. Natural Greetings & Personalization ---");
  
  function testIsGreeting(text: string): boolean {
    const clean = text.trim().toLowerCase().replace(/[!.,?؛،~-]+/g, " ").trim();
    const arabicGreetings = /^(مرحبا|مرحباً|أهلا|اهلا|أهلاً|اهلا وسهلا|أهلا وسهلا|السلام عليكم|صباح الخير|مساء الخير|هاي|هلا|حياك الله)$/i;
    if (arabicGreetings.test(clean)) return true;
    const englishGreetings = /^(hi|hello|hey|hey there|hello there|good morning|good afternoon|good evening|howdy|greetings|salut|bonjour|hola|ciao)(?:\s+(?:there|coach|nutricoach|team))?$/i;
    if (englishGreetings.test(clean)) return true;
    const greetingPlusPolite = /^(hi|hello|hey|good morning|good afternoon|good evening|أهلا|مرحبا|السلام عليكم)\b.*?(how are you|how are you doing|how's it going|what's up|how do you do|كيف حالك|شخبارك)/i;
    if (greetingPlusPolite.test(clean) && clean.length < 50) return true;
    return false;
  }

  function testBuildGreeting(
    profile: { name?: string },
    prefs: ChatbotPreferences,
    msg: string
  ): string {
    const isArabic = /[\u0600-\u06FF]/.test(msg) || prefs.language === "ar";
    let name = (prefs.preferred_name || "").trim();
    if (!name && profile?.name) {
      name = profile.name.trim().split(" ")[0];
    }
    if (name.toLowerCase() === "member" || name.toLowerCase() === "demo member") {
      name = "";
    }

    if (isArabic) {
      if (prefs.communication_style === "direct_concise") {
        return name ? `أهلاً ${name}. كيف يمكنني مساعدتك في خطتك الغذائية اليوم؟` : "أهلاً بك. كيف يمكنني مساعدتك في خطتك الغذائية اليوم؟";
      }
      if (prefs.communication_style === "friendly_conversational") {
        return name ? `أهلاً ${name}! يسعدني التحدث معك اليوم. كيف تسير أمورك؟` : "أهلاً بك! يسعدني التحدث معك اليوم. كيف تسير أمورك؟";
      }
      if (prefs.communication_style === "detailed_educational") {
        return name ? `أهلاً ${name}! مرحباً بك. أنا هنا لمساعدتك في استكشاف العلوم التغذوية ومراجعة خطتك الغذائية.` : "أهلاً بك! مرحباً بك. أنا هنا لمساعدتك في استكشاف العلوم التغذوية ومراجعة خطتك الغذائية.";
      }
      return name ? `مرحباً ${name}! كيف حالك اليوم؟ أنا هنا لمساعدتك في تحقيق أهدافك الغذائية.` : "مرحباً بك! كيف حالك اليوم؟ أنا هنا لمساعدتك في تحقيق أهدافك الغذائية.";
    }

    switch (prefs.communication_style) {
      case "friendly_conversational":
        return name ? `Hey ${name}! Great to see you. How's your day going? What are we working on today?` : "Hey there! Great to see you. How's your day going? What can I help you with today?";
      case "direct_concise":
        return name ? `Hello ${name}. How can I assist with your nutrition today?` : "Hello. How can I assist with your nutrition today?";
      case "detailed_educational":
        return name ? `Hello, ${name}! Welcome back. Whether you'd like to explore nutritional science, refine your daily targets, or review your meal plan, I'm here to help.` : "Hello! Welcome back. Whether you'd like to explore nutritional science, refine your daily targets, or review your meal plan, I'm here to help.";
      case "professional_supportive":
      default:
        return name ? `Hello, ${name}! How are you doing today? I'm here to help you work toward your nutrition goals.` : "Hello! How are you doing today? I'm here to help you work toward your nutrition goals.";
    }
  }

  // Greeting detector checks
  assert(testIsGreeting("hello"), "Detects 'hello' as greeting");
  assert(testIsGreeting("Hi!"), "Detects 'Hi!' as greeting");
  assert(testIsGreeting("Hey coach"), "Detects 'Hey coach' as greeting");
  assert(testIsGreeting("Good morning"), "Detects 'Good morning' as greeting");
  assert(testIsGreeting("مرحبا"), "Detects Arabic 'مرحبا' as greeting");
  assert(!testIsGreeting("can u advice me with sugar free diet"), "'can u advice me with sugar free diet' is NOT a simple greeting");
  assert(!testIsGreeting("replace dinner with pasta"), "'replace dinner with pasta' is NOT a greeting");

  // Greeting personalization checks
  const omarProfile = { name: "Omar Farouk" };
  const customPref: ChatbotPreferences = {
    ...DEFAULT_CHATBOT_PREFERENCES,
    preferred_name: "Omar",
  };

  const omarGreeting = testBuildGreeting(omarProfile, customPref, "hello");
  assert(
    omarGreeting === "Hello, Omar! How are you doing today? I'm here to help you work toward your nutrition goals.",
    `Default example matched: "${omarGreeting}"`
  );

  // Missing name does NOT fabricate a name
  const anonProfile = { name: "" };
  const anonPref: ChatbotPreferences = {
    ...DEFAULT_CHATBOT_PREFERENCES,
    preferred_name: null,
  };
  const anonGreeting = testBuildGreeting(anonProfile, anonPref, "hello");
  assert(
    anonGreeting === "Hello! How are you doing today? I'm here to help you work toward your nutrition goals.",
    `No fabricated name when unconfigured: "${anonGreeting}"`
  );
  assert(!anonGreeting.includes("null") && !anonGreeting.includes("undefined"), "No undefined/null tokens in greeting");

  // Communication style differentiation
  const directPref: ChatbotPreferences = { ...customPref, communication_style: "direct_concise" };
  const directGreeting = testBuildGreeting(omarProfile, directPref, "hello");
  assert(directGreeting === "Hello Omar. How can I assist with your nutrition today?", `Direct style matched: "${directGreeting}"`);

  const friendlyPref: ChatbotPreferences = { ...customPref, communication_style: "friendly_conversational" };
  const friendlyGreeting = testBuildGreeting(omarProfile, friendlyPref, "hello");
  assert(friendlyGreeting.includes("Hey Omar!"), `Friendly style matched: "${friendlyGreeting}"`);

  // Arabic greeting check
  const arabicGreeting = testBuildGreeting(omarProfile, customPref, "مرحبا");
  assert(arabicGreeting.includes("مرحباً Omar!"), `Arabic greeting with name matched: "${arabicGreeting}"`);

  // Greetings do NOT return articles or plans
  assert(!omarGreeting.includes("[Read article]"), "Greeting does not return article links");
  assert(!omarGreeting.includes("kcal"), "Greeting does not return calorie calculations");
  assert(!omarGreeting.includes("Breakfast"), "Greeting does not return meal plans");

  // TEST 4: Chatbot Preferences defaults and types
  console.log("\n--- 4. Preferences Structure & Security Defaults ---");
  assert(DEFAULT_CHATBOT_PREFERENCES.communication_style === "professional_supportive", "Default style is professional_supportive");
  assert(DEFAULT_CHATBOT_PREFERENCES.encouragement_level === "balanced", "Default encouragement is balanced");
  assert(DEFAULT_CHATBOT_PREFERENCES.response_detail === "standard", "Default response detail is standard");
  assert(DEFAULT_CHATBOT_PREFERENCES.language === "auto", "Default language is auto");

  console.log(`\n================================`);
  console.log(`Test Results: ${passed} passed, ${failed} failed`);
  console.log(`================================`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
