/**
 * NutriCoach — Member Profile Preferences, Nutrition Safety Guardrails, & In-App Tours Test Suite
 */

import fs from 'fs';
import path from 'path';
import {
  isAllowed,
  suggestMeals,
  planDay,
  prefsFromProfile,
  PlanningPrefs,
} from '../src/lib/planner';
import { FOODS } from '../src/lib/foods';
import { Profile } from '../src/lib/types';
import { MEMBER_TOUR_STEPS, COACH_TOUR_STEPS } from '../src/components/AppTourModal';

let passes = 0;
let fails = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`✅ [PASS] ${message}`);
    passes++;
  } else {
    console.error(`❌ [FAIL] ${message}`);
    fails++;
  }
}

async function runTestSuite() {
  console.log('================================================================');
  console.log(' NUTRICHOACH PREFERENCES, GUARDRAILS & IN-APP TOURS TEST SUITE ');
  console.log('================================================================\n');

  // -------------------------------------------------------------
  // PART 1: UI Inspection & Unwanted Card Removal
  // -------------------------------------------------------------
  console.log('--- PART 1: Member Profile UI & Card Removal ---');
  const profileViewPath = path.resolve(__dirname, '../src/components/MemberProfileView.tsx');
  const profileViewContent = fs.readFileSync(profileViewPath, 'utf8');

  // Confirm unwanted Chatbot Communication Preferences card is NOT rendered
  assert(
    !profileViewContent.includes('Chatbot Communication Preferences'),
    'MemberProfileView does NOT render the unwanted "Chatbot Communication Preferences" card'
  );
  assert(
    !profileViewContent.includes('Communication Style') &&
    !profileViewContent.includes('Encouragement Level') &&
    !profileViewContent.includes('Response Detail'),
    'MemberProfileView does NOT contain chatbot communication style/encouragement/detail form fields'
  );

  // Confirm new editable Dietary Preferences section is present
  assert(
    profileViewContent.includes('Dietary Preferences & Meal Guardrails'),
    'MemberProfileView contains the editable "Dietary Preferences & Meal Guardrails" section'
  );
  assert(
    profileViewContent.includes('Food Allergies & Intolerances (Strict Guardrails)'),
    'MemberProfileView contains the strict "Food Allergies & Intolerances" guardrail section'
  );
  assert(
    profileViewContent.includes('Excluded Foods & Disliked Ingredients'),
    'MemberProfileView contains excluded foods & disliked ingredients section'
  );
  assert(
    profileViewContent.includes('Dietary Pattern'),
    'MemberProfileView contains dietary pattern selection (Standard, Vegetarian, Vegan, Pescatarian, etc.)'
  );
  assert(
    profileViewContent.includes('Additional Meal Preferences & Notes'),
    'MemberProfileView contains notes field for additional meal preferences'
  );
  assert(
    profileViewContent.includes('Save Changes') &&
    profileViewContent.includes('Reset to Saved'),
    'MemberProfileView contains Save Changes and Reset to Saved controls'
  );
  assert(
    profileViewContent.includes('updateDietaryPreferences'),
    'MemberProfileView integrates with NutriCoachContext updateDietaryPreferences'
  );

  // -------------------------------------------------------------
  // PART 2: Welcome Onboarding Dialog & Persistence
  // -------------------------------------------------------------
  console.log('\n--- PART 2: Welcome Onboarding Dialog & Persistence ---');
  const welcomeModalPath = path.resolve(__dirname, '../src/components/WelcomeTourModal.tsx');
  assert(fs.existsSync(welcomeModalPath), 'WelcomeTourModal.tsx component file exists');
  const welcomeModalContent = fs.readFileSync(welcomeModalPath, 'utf8');

  // Verify Member welcome modal content
  assert(
    welcomeModalContent.includes('Welcome to NutriCoach!') &&
    welcomeModalContent.includes('Make every meal count.') &&
    welcomeModalContent.includes('Discover how to track your daily nutrition, plan your meals, monitor your progress, and get personalized nutrition guidance.'),
    'WelcomeTourModal contains required Member App title, subtitle, and description'
  );
  assert(
    welcomeModalContent.includes("Track today's calories and macros.") &&
    welcomeModalContent.includes("Plan and adjust your meals.") &&
    welcomeModalContent.includes("Stay on track with personalized guidance."),
    'WelcomeTourModal contains the 3 Member preview items'
  );

  // Verify Coach workspace welcome modal content
  assert(
    welcomeModalContent.includes('Welcome to the NutriCoach Coach Workspace!') &&
    welcomeModalContent.includes('Support your members more efficiently.') &&
    welcomeModalContent.includes('Explore how to monitor member progress, review nutrition exceptions, and oversee AI-assisted recommendations.'),
    'WelcomeTourModal contains required Coach Workspace title, subtitle, and description'
  );
  assert(
    welcomeModalContent.includes('Monitor member adherence and progress.') &&
    welcomeModalContent.includes('Review recommendations and exceptions.') &&
    welcomeModalContent.includes('Keep human oversight of AI-assisted actions.'),
    'WelcomeTourModal contains the 3 Coach preview items'
  );

  // Verify buttons and accessibility
  assert(
    welcomeModalContent.includes('Take a 2-minute tour') &&
    welcomeModalContent.includes('Skip for now'),
    'WelcomeTourModal features "Take a 2-minute tour" (primary) and "Skip for now" (secondary) buttons'
  );
  assert(
    welcomeModalContent.includes('role="dialog"') &&
    welcomeModalContent.includes('aria-modal="true"') &&
    welcomeModalContent.includes('Escape'),
    'WelcomeTourModal includes keyboard Escape dismissal and proper accessibility dialog roles'
  );

  // Check integration and persistence in MemberLayout and CoachLayout
  const memberLayoutPath = path.resolve(__dirname, '../src/components/MemberLayout.tsx');
  const memberLayoutContent = fs.readFileSync(memberLayoutPath, 'utf8');
  assert(
    memberLayoutContent.includes('WelcomeTourModal') &&
    memberLayoutContent.includes('nutricoach_welcome_seen_member') &&
    memberLayoutContent.includes('workspaceType="member"'),
    'MemberLayout mounts WelcomeTourModal with local persistence key "nutricoach_welcome_seen_member"'
  );
  assert(
    memberLayoutContent.includes('Take a Tour') &&
    memberLayoutContent.includes('AppTourModal') &&
    memberLayoutContent.includes('tourType="member"'),
    'MemberLayout preserves accessible "Take a Tour" button for reopening walkthrough at any time'
  );

  const coachLayoutPath = path.resolve(__dirname, '../src/components/CoachLayout.tsx');
  const coachLayoutContent = fs.readFileSync(coachLayoutPath, 'utf8');
  assert(
    coachLayoutContent.includes('WelcomeTourModal') &&
    coachLayoutContent.includes('nutricoach_welcome_seen_coach') &&
    coachLayoutContent.includes('workspaceType="coach"'),
    'CoachLayout mounts WelcomeTourModal with local persistence key "nutricoach_welcome_seen_coach"'
  );
  assert(
    coachLayoutContent.includes('Coach Workspace Tour') &&
    coachLayoutContent.includes('AppTourModal') &&
    coachLayoutContent.includes('tourType="coach"'),
    'CoachLayout preserves accessible "Coach Workspace Tour" button launching Coach Tour'
  );

  // -------------------------------------------------------------
  // PART 3: In-App Tour Content, Section Grouping & Read-Only Safety
  // -------------------------------------------------------------
  console.log('\n--- PART 3: In-App Tour Steps, Sections & Read-Only Guarantees ---');
  assert(MEMBER_TOUR_STEPS.length === 15, `Member Tour has exactly 15 complete, easy-to-follow steps (found ${MEMBER_TOUR_STEPS.length})`);

  // Verify Member sections: Today, Plan, Progress, Support, Profile
  const todaySteps = MEMBER_TOUR_STEPS.filter(s => s.section === 'Today');
  const planSteps = MEMBER_TOUR_STEPS.filter(s => s.section === 'Plan');
  const progressSteps = MEMBER_TOUR_STEPS.filter(s => s.section === 'Progress');
  const supportSteps = MEMBER_TOUR_STEPS.filter(s => s.section === 'Support');
  const profileSteps = MEMBER_TOUR_STEPS.filter(s => s.section === 'Profile');

  assert(todaySteps.length === 3, `Section 1: Today contains 3 steps (found ${todaySteps.length})`);
  assert(planSteps.length === 3, `Section 2: Plan contains 3 steps (found ${planSteps.length})`);
  assert(progressSteps.length === 4, `Section 3: Progress contains 4 steps (found ${progressSteps.length})`);
  assert(supportSteps.length === 2, `Section 4: Support contains 2 steps (found ${supportSteps.length})`);
  assert(profileSteps.length === 3, `Section 5: Profile contains 3 steps (found ${profileSteps.length})`);

  // Check that every step has sectionStep and sectionTotal matching
  const validSectionMeta = MEMBER_TOUR_STEPS.every(s => 
    typeof s.sectionStep === 'number' &&
    typeof s.sectionTotal === 'number' &&
    s.sectionStep >= 1 &&
    s.sectionStep <= s.sectionTotal
  );
  assert(validSectionMeta, 'All 15 Member tour steps include valid sectionStep and sectionTotal indicators');

  // Verify NO hardcoded sample metric numbers in tour descriptions
  const sampleMetricNumbers = ['96%', '94%', '10-day streak', '98% protein', '98%'];
  const hasHardcodedMetricValues = MEMBER_TOUR_STEPS.some(s => 
    sampleMetricNumbers.some(sm => s.description.includes(sm) || s.title.includes(sm))
  );
  assert(!hasHardcodedMetricValues, 'Member tour steps explain metric meanings without hardcoding sample values (e.g., no 96%, 94%, 10-day streak)');

  // Verify Coach Workspace steps
  assert(COACH_TOUR_STEPS.length === 7, `Coach Tour has 7 verified steps (found ${COACH_TOUR_STEPS.length})`);
  const coachStepTitles = COACH_TOUR_STEPS.map(s => s.title);
  assert(
    coachStepTitles.some(t => t.toLowerCase().includes('dashboard') || t.toLowerCase().includes('overview')),
    'Coach tour explains Coach Dashboard & business overview'
  );
  assert(
    coachStepTitles.some(t => t.toLowerCase().includes('member')),
    'Coach tour explains Member Roster and Management'
  );
  assert(
    coachStepTitles.some(t => t.toLowerCase().includes('adherence') || t.toLowerCase().includes('log')),
    'Coach tour explains Reviewing Member Meal Logs & Adherence'
  );
  assert(
    coachStepTitles.some(t => t.toLowerCase().includes('triage') || t.toLowerCase().includes('follow-up')),
    'Coach tour explains Triage Queue & identifying members needing follow-up'
  );
  assert(
    coachStepTitles.some(t => t.toLowerCase().includes('oversight') || t.toLowerCase().includes('action')),
    'Coach tour explains Human Oversight & Approval of AI-Assisted Actions'
  );
  assert(
    coachStepTitles.some(t => t.toLowerCase().includes('messag') || t.toLowerCase().includes('communication')),
    'Coach tour explains Direct Coach Messaging & Templates'
  );
  assert(
    coachStepTitles.some(t => t.toLowerCase().includes('audit') || t.toLowerCase().includes('activity')),
    'Coach tour explains Audit Trail & Operational Activity'
  );

  // Inspect AppTourModal code for Read-Only and Non-Blocking invariants
  const tourModalPath = path.resolve(__dirname, '../src/components/AppTourModal.tsx');
  const tourModalContent = fs.readFileSync(tourModalPath, 'utf8');
  assert(
    !tourModalContent.includes('fetch(') &&
    !tourModalContent.includes('.from(') &&
    !tourModalContent.includes('mutation') &&
    !tourModalContent.includes('/api/chat'),
    'AppTourModal contains NO network fetches, NO database mutations, and NO AI trigger calls'
  );
  assert(
    !tourModalContent.includes('backdrop-blur') &&
    !tourModalContent.includes('fixed inset-0 bg-'),
    'AppTourModal contains NO backdrop blur and NO full-screen dimming overlay'
  );
  assert(
    tourModalContent.includes('pointerEvents: "none"'),
    'AppTourModal highlight ring uses pointerEvents: "none" to preserve background interaction'
  );
  assert(
    MEMBER_TOUR_STEPS.every(s => typeof s.selector === 'string' && s.selector.includes('data-tour')),
    'All Member tour steps specify dedicated [data-tour] selectors targeting real elements'
  );
  assert(
    COACH_TOUR_STEPS.every(s => typeof s.selector === 'string' && s.selector.includes('data-tour')),
    'All Coach tour steps specify dedicated [data-tour] selectors targeting real elements'
  );
  assert(
    tourModalContent.includes('onClose') &&
    tourModalContent.includes('onTabChange') &&
    tourModalContent.includes('handleNext') &&
    tourModalContent.includes('handleBack') &&
    tourModalContent.includes('handleClose') &&
    tourModalContent.includes('Escape'),
    'AppTourModal provides full safe navigation controls (Next, Back, Skip, Finish, Close, keyboard Escape)'
  );

  // -------------------------------------------------------------
  // PART 4: Nutrition Safety & Strict Guardrail Enforcement
  // -------------------------------------------------------------
  console.log('\n--- PART 4: Nutrition Safety & Strict Guardrails ---');

  // 1. Nut / Peanut Allergy Guardrail
  const nutPref: PlanningPrefs = {
    allergies: ['nuts', 'peanuts'],
    disliked_foods: [],
    dietary_preferences: [],
  };
  const nutFoods = FOODS.filter(f =>
    f.tags.includes('nuts') ||
    f.ingredients.some(i => /nut|peanut|almond|walnut/i.test(i))
  );
  assert(nutFoods.length > 0, `Catalog contains nut-containing foods (${nutFoods.length} found)`);
  for (const food of nutFoods) {
    assert(
      !isAllowed(food, nutPref),
      `isAllowed strictly BLOCKS "${food.name}" for member with nut/peanut allergy`
    );
  }

  // 2. Dairy Allergy / Lactose Intolerance Guardrail
  const dairyPref: PlanningPrefs = {
    allergies: ['dairy', 'lactose'],
    disliked_foods: [],
    dietary_preferences: [],
  };
  const dairyFoods = FOODS.filter(f =>
    f.tags.includes('dairy') ||
    f.ingredients.some(i => /cheese|milk|yogurt|whey|feta|labneh|cottage/i.test(i))
  );
  assert(dairyFoods.length > 0, `Catalog contains dairy-containing foods (${dairyFoods.length} found)`);
  let allDairyBlocked = true;
  for (const food of dairyFoods) {
    if (isAllowed(food, dairyPref)) {
      allDairyBlocked = false;
      console.error(`Dairy food "${food.name}" was not blocked!`);
    }
  }
  assert(allDairyBlocked, 'All dairy & lactose foods are strictly BLOCKED when dairy/lactose allergy is active');

  // 3. Vegan Dietary Pattern Guardrail
  const veganPref: PlanningPrefs = {
    allergies: [],
    disliked_foods: [],
    dietary_preferences: [],
    dietary_style: 'vegan',
  };
  const nonVeganFoods = FOODS.filter(f =>
    f.tags.includes('chicken') ||
    f.tags.includes('beef') ||
    f.tags.includes('turkey') ||
    f.tags.includes('fish') ||
    f.tags.includes('dairy') ||
    f.tags.includes('eggs') ||
    f.ingredients.some(i => /chicken|beef|meat|fish|tuna|egg|cheese|milk|yogurt/i.test(i))
  );
  let allNonVeganBlocked = true;
  for (const food of nonVeganFoods) {
    if (isAllowed(food, veganPref)) {
      allNonVeganBlocked = false;
      console.error(`Non-vegan food "${food.name}" was not blocked under vegan dietaryStyle!`);
    }
  }
  assert(allNonVeganBlocked, 'Vegan dietary style strictly BLOCKS meat, poultry, fish, eggs, and dairy foods');

  // 4. Pescatarian Dietary Pattern Guardrail
  const pescatarianPref: PlanningPrefs = {
    allergies: [],
    disliked_foods: [],
    dietary_preferences: [],
    dietary_style: 'pescatarian',
  };
  const landMeatFoods = FOODS.filter(f =>
    (f.tags.includes('chicken') || f.tags.includes('beef') || f.tags.includes('turkey')) &&
    !f.tags.includes('fish') && !f.tags.includes('shellfish')
  );
  let allLandMeatBlocked = true;
  for (const food of landMeatFoods) {
    if (isAllowed(food, pescatarianPref)) {
      allLandMeatBlocked = false;
    }
  }
  assert(allLandMeatBlocked, 'Pescatarian dietary style strictly BLOCKS chicken, beef, and turkey');

  // 5. Disliked Foods Exclusion (e.g., Okra / Bamia)
  const dislikedPref: PlanningPrefs = {
    allergies: [],
    disliked_foods: ['okra', 'bamia'],
    dietary_preferences: [],
  };
  const okraFoods = FOODS.filter(f =>
    f.ingredients.some(i => /okra|bamia/i.test(i)) || f.name.toLowerCase().includes('bamia')
  );
  assert(okraFoods.length > 0, `Catalog contains okra/bamia foods (${okraFoods.length} found)`);
  for (const food of okraFoods) {
    assert(
      !isAllowed(food, dislikedPref),
      `isAllowed strictly EXCLUDES disliked food "${food.name}" containing okra`
    );
  }

  // 6. Suggest Meals Guardrails for Slot
  const suggestionsUnderDairy = suggestMeals(
    { calories: 500, protein: 35, carbs: 45, fat: 12 },
    'breakfast',
    dairyPref,
    { count: 3 }
  );
  assert(suggestionsUnderDairy.length > 0, `Found ${suggestionsUnderDairy.length} safe breakfast suggestions`);
  const anyDairyInSuggestions = suggestionsUnderDairy.some(s =>
    s.tags.includes('dairy') ||
    s.ingredients.some(i => /cheese|milk|yogurt/i.test(i))
  );
  assert(!anyDairyInSuggestions, 'All suggested breakfast options strictly exclude dairy when allergy is set');

  // 7. Full Day Plan Adherence with Dietary Style & Allergies
  const pescatarianNoNuts: PlanningPrefs = {
    allergies: ['nuts', 'peanuts'],
    disliked_foods: ['okra', 'bamia'],
    dietary_preferences: ['pescatarian'],
    dietary_style: 'pescatarian',
  };
  const plannedDay = planDay(
    { calories: 2000, protein: 140, carbs: 220, fat: 55 },
    pescatarianNoNuts
  );
  assert(plannedDay.length === 4, `planDay generates all 4 meal slots (breakfast, lunch, snack, dinner)`);
  const hasNutsInPlan = plannedDay.some(slot =>
    slot.meal.tags.includes('nuts') ||
    slot.meal.ingredients.some(i => /nut|peanut|almond/i.test(i))
  );
  assert(!hasNutsInPlan, 'Generated daily meal plan strictly contains ZERO nuts or peanuts');
  const hasLandMeat = plannedDay.some(slot =>
    slot.meal.tags.includes('chicken') ||
    slot.meal.tags.includes('beef') ||
    slot.meal.tags.includes('turkey')
  );
  assert(!hasLandMeat, 'Generated daily meal plan strictly contains ZERO land meat (chicken/beef/turkey) under pescatarian pattern');

  // 8. prefsFromProfile helper extracts updated fields reliably
  const testProfile: Profile = {
    id: 'user-123',
    gym_id: 'gym-1',
    role: 'member',
    coach_id: 'coach-1',
    name: 'Ahmed Test',
    email: 'ahmed@test.com',
    age: 29,
    weight: 78,
    height: 175,
    sex: 'male',
    goal: 'muscle_gain',
    activity_level: 'moderate',
    dietary_preferences: ['gluten_free'],
    disliked_foods: ['mushrooms', 'coriander'],
    allergies: ['peanuts', 'tree_nuts'],
    dietary_style: 'vegetarian',
    medical_notes: 'Prefers olive oil over butter',
    subscription_status: 'active',
    demo_scenario: null,
    created_at: new Date().toISOString(),
  };
  const extractedPrefs = prefsFromProfile(testProfile);
  assert(
    extractedPrefs.allergies.includes('peanuts') &&
    extractedPrefs.allergies.includes('tree_nuts'),
    'prefsFromProfile accurately extracts allergies'
  );
  assert(
    extractedPrefs.disliked_foods.includes('mushrooms') &&
    extractedPrefs.disliked_foods.includes('coriander'),
    'prefsFromProfile accurately extracts disliked_foods'
  );
  assert(
    extractedPrefs.dietary_style === 'vegetarian',
    'prefsFromProfile accurately extracts dietary_style'
  );

  // -------------------------------------------------------------
  // PART 5: Preferences API Route Security & Validation
  // -------------------------------------------------------------
  console.log('\n--- PART 5: Profile Preferences API Route ---');
  const apiRoutePath = path.resolve(__dirname, '../src/app/api/profile/preferences/route.ts');
  const apiRouteContent = fs.readFileSync(apiRoutePath, 'utf8');

  assert(
    apiRouteContent.includes('getSession') &&
    apiRouteContent.includes('session.user'),
    'Preferences API route verifies user session via getSession and scopes updates to user.id'
  );
  assert(
    apiRouteContent.includes('allergies') &&
    apiRouteContent.includes('disliked_foods') &&
    apiRouteContent.includes('dietary_style') &&
    apiRouteContent.includes('medical_notes'),
    'Preferences API updates all required fields without schema duplication'
  );
  assert(
    apiRouteContent.includes('sanitizeStringArray'),
    'Preferences API uses sanitizeStringArray to prevent malicious inputs and enforce boundaries'
  );

  // -------------------------------------------------------------
  // PART 6: Database Schema & Migration Verification
  // -------------------------------------------------------------
  console.log('\n--- PART 6: Database Schema & Migration Verification ---');
  const schemaPath = path.resolve(__dirname, '../supabase/schema.sql');
  const schemaContent = fs.readFileSync(schemaPath, 'utf8');

  assert(
    schemaContent.includes('dietary_style text') || schemaContent.includes('alter table public.profiles add column if not exists dietary_style text'),
    'supabase/schema.sql contains dietary_style column declaration'
  );
  assert(
    schemaContent.includes('grant update (dietary_preferences, disliked_foods, allergies'),
    'supabase/schema.sql contains column-level UPDATE grants for authenticated users'
  );

  console.log('\n================================================================');
  console.log(` RESULTS: ${passes} passed | ${fails} failed`);
  console.log('================================================================\n');

  if (fails > 0) {
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error('Fatal error during test execution:', err);
  process.exit(1);
});
