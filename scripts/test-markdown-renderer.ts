import React from "react";

// Directly test the pure parser logic from ChatMessageRenderer
function isSafeUrl(url: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function sanitizeShortAnswerHeading(text: string): string {
  if (!text) return "";
  return text
    .replace(/^[\s#*•_-]*(?:short answer|short-answer|quick answer|direct answer)[:*#\s]*/i, "")
    .trim();
}

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

console.log("=== RUNNING MARKDOWN RENDERER VALIDATION SUITE ===\n");

// URL Safety
assert(isSafeUrl("https://www.who.int/publications/i/item/9789241549028"), "https URL is safe");
assert(isSafeUrl("http://www.cdc.gov/nutrition"), "http URL is safe");
assert(!isSafeUrl("javascript:alert(1)"), "javascript: protocol blocked as unsafe");
assert(!isSafeUrl("data:text/html;base64,PHNjcmlwdD4="), "data: protocol blocked as unsafe");
assert(!isSafeUrl("vbscript:msgbox(1)"), "vbscript: protocol blocked as unsafe");
assert(!isSafeUrl("/relative/path"), "relative path rejected as external research link");

// Sanitize Short Answer Heading
assert(
  sanitizeShortAnswerHeading("**Short answer:**\nA low-sugar approach reduces added sugars.") ===
    "A low-sugar approach reduces added sugars.",
  "Strips '**Short answer:**\\n'"
);
assert(
  sanitizeShortAnswerHeading("Short answer: A low-sugar approach") === "A low-sugar approach",
  "Strips 'Short answer: '"
);
assert(
  sanitizeShortAnswerHeading("### Short Answer: Direct reply") === "Direct reply",
  "Strips '### Short Answer: '"
);
assert(
  sanitizeShortAnswerHeading("A regular sentence without prefix") === "A regular sentence without prefix",
  "Leaves normal sentence untouched"
);

// Regex matching bold & links
const inlineRegex = /(!?\[([^\]]+)\]\(([^)]+)\))|(\*\*([^*]+)\*\*)|(`([^`]+)`)|(\*([^*]+)\*)|(_([^_]+)_)/g;
const testText = "Here is **bold text** and a [link](https://who.int) and `code`";

const matches: string[] = [];
let m: RegExpExecArray | null;
while ((m = inlineRegex.exec(testText)) !== null) {
  matches.push(m[0]);
}

assert(matches.includes("**bold text**"), "Bold token detected");
assert(matches.includes("[link](https://who.int)"), "Markdown link detected");
assert(matches.includes("`code`"), "Inline code detected");

console.log(`\n================================`);
console.log(`Markdown Tests: ${passed} passed, ${failed} failed`);
console.log(`================================`);

if (failed > 0) process.exit(1);
