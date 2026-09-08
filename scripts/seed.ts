/**
 * Seed a playable demo dataset:
 *  - trainer  coach@sparring.local / coach-demo-1
 *  - rep      rep@sparring.local   / rep-demo-1
 *  - "Reflective Discovery" methodology (numbered, citable entries)
 *  - a discovery-call scorecard mapped to those entries
 *  - Dana Whitfield — a prospect modeled on a deal being lost to inertia,
 *    with a five-fact hidden file and hard concession caps
 *  - one drill assigned to the rep
 *
 * Idempotent: exits early if the demo trainer already exists.
 */
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  drillAssignments,
  drills,
  hiddenFacts,
  methodologies,
  methodologyEntries,
  prospects,
  scorecardCriteria,
  scorecards,
  users,
} from "@/db/schema";
import { hashPassword } from "@/auth/password";
import { newId } from "@/lib/ids";
import type { ConcessionCaps, PatienceConfig } from "@/engine/types";
import { ensureChannelContent } from "./seed-channels";

const now = Date.now();

const existing = db
  .select({ id: users.id })
  .from(users)
  .where(eq(users.email, "coach@sparring.local"))
  .get();

if (existing) {
  console.log("Base seed already present.");
  // Channel playbooks are additive — keep existing installs current.
  ensureChannelContent();
  process.exit(0);
}

// ── Users ────────────────────────────────────────────────────────────────────

const trainerId = newId();
const repId = newId();

db.insert(users)
  .values([
    {
      id: trainerId,
      email: "coach@sparring.local",
      name: "Morgan Hale",
      passwordHash: hashPassword("coach-demo-1"),
      role: "trainer",
      createdAt: now,
    },
    {
      id: repId,
      email: "rep@sparring.local",
      name: "Jamie Torres",
      passwordHash: hashPassword("rep-demo-1"),
      role: "rep",
      createdAt: now,
    },
  ])
  .run();

// ── Methodology: Reflective Discovery ────────────────────────────────────────

const methodologyId = newId();

db.insert(methodologies)
  .values({
    id: methodologyId,
    trainerId,
    name: "Reflective Discovery",
    description:
      "A discovery-first selling methodology: earn every fact, reflect before you redirect, and never pitch into a vacuum.",
    createdAt: now,
  })
  .run();

const entries: Array<{ number: string; title: string; text: string }> = [
  {
    number: "1.1",
    title: "Open with their world, not yours",
    text: "The first two minutes belong to the prospect's situation. Do not mention your product, your company, or your calendar until they have said something true about their world.",
  },
  {
    number: "1.2",
    title: "Earn each fact before you use it",
    text: "Treat every disclosure as something you earned, not something you extracted. If you have not demonstrated that you understand their situation, you have not earned the next fact.",
  },
  {
    number: "2.1",
    title: "Reflect before you redirect",
    text: "Before steering the conversation, prove you heard them: restate their situation in your own words and let them correct you. An accurate reflection opens doors a question cannot.",
  },
  {
    number: "2.2",
    title: "Ask calibrated open questions",
    text: "Prefer 'how' and 'what' questions that invite a story over questions that can be answered in one word. A calibrated question hands the prospect the pen.",
  },
  {
    number: "2.3",
    title: "One question at a time",
    text: "Stacked questions signal a script. Ask one question, then be quiet. The silence after a good question is where discovery happens.",
  },
  {
    number: "3.1",
    title: "No pitch before pain",
    text: "Presenting a solution before the prospect has voiced a concrete cost of the status quo turns you into a brochure. Hold the pitch until at least two real facts about their situation are on the table.",
  },
  {
    number: "3.2",
    title: "Talk less than you think you are",
    text: "If a single turn runs past ninety words, you are monologuing. Prospects forgive many things; being lectured is not one of them.",
  },
  {
    number: "4.1",
    title: "Never pressure the close",
    text: "A close the prospect did not build with you will not survive procurement. Pressure buys polite exits, not signatures.",
  },
  {
    number: "4.2",
    title: "Trade, don't cave",
    text: "Every commitment you ask for must be attached to something the prospect gets. Asking for a meeting without giving a reason to meet is asking for a favor.",
  },
  {
    number: "5.1",
    title: "Qualify with permission, not interrogation",
    text: "Budget, authority, and timeline questions asked cold produce polite fiction. Earn permission first — reflect their situation, then ask, and the number you get will be real.",
  },
];

const entryIdsByNumber = new Map<string, string>();
db.insert(methodologyEntries)
  .values(
    entries.map((entry, i) => {
      const id = newId();
      entryIdsByNumber.set(entry.number, id);
      return {
        id,
        methodologyId,
        number: entry.number,
        title: entry.title,
        text: entry.text,
        sortOrder: i,
      };
    }),
  )
  .run();

function entryIds(...numbers: string[]): string[] {
  return numbers.map((n) => {
    const id = entryIdsByNumber.get(n);
    if (!id) throw new Error(`Unknown methodology entry number: ${n}`);
    return id;
  });
}

// ── Scorecard ────────────────────────────────────────────────────────────────

const scorecardId = newId();

db.insert(scorecards)
  .values({
    id: scorecardId,
    trainerId,
    methodologyId,
    name: "Discovery Call Scorecard",
    createdAt: now,
  })
  .run();

db.insert(scorecardCriteria)
  .values([
    {
      id: newId(),
      scorecardId,
      label: "Discovery before pitch",
      description:
        "Did the rep hold the pitch until real pain was on the table?",
      weight: 1.5,
      methodologyEntryIds: entryIds("3.1", "1.2"),
      sortOrder: 0,
    },
    {
      id: newId(),
      scorecardId,
      label: "Reflective listening",
      description:
        "Did the rep reflect the prospect's situation accurately before redirecting?",
      weight: 1.5,
      methodologyEntryIds: entryIds("2.1", "2.2"),
      sortOrder: 1,
    },
    {
      id: newId(),
      scorecardId,
      label: "Air-time control",
      description: "Did the rep keep turns short and ask one question at a time?",
      weight: 1,
      methodologyEntryIds: entryIds("3.2", "2.3"),
      sortOrder: 2,
    },
    {
      id: newId(),
      scorecardId,
      label: "Qualification craft",
      description:
        "Were budget/authority/timeline questions earned rather than interrogated?",
      weight: 1,
      methodologyEntryIds: entryIds("5.1", "1.1"),
      sortOrder: 3,
    },
    {
      id: newId(),
      scorecardId,
      label: "Concession discipline",
      description:
        "Did the rep trade for commitments instead of pressuring or begging?",
      weight: 1,
      methodologyEntryIds: entryIds("4.1", "4.2"),
      sortOrder: 4,
    },
  ])
  .run();

// ── Prospect: Dana Whitfield ─────────────────────────────────────────────────

const patienceConfig: PatienceConfig = {
  initial: 62,
  monologueWordThreshold: 90,
  monologuePenaltyPerWord: 0.25,
  earlyPitchPenalty: 14,
  discoveryGate: 2,
  bluntQuestionPenalty: 8,
  stackedQuestionPenalty: 6,
  pressurePenaltyScale: 10,
  reflectionRegen: 7,
  openQuestionRegen: 3,
  maxRegenPerTurn: 10,
};

const concessionCaps: ConcessionCaps = {
  meetingRequiresFactsUnlocked: 2,
  meetingRequiresPatienceAtLeast: 40,
  allowIntro: true,
  introRequiresFactsUnlocked: 3,
  allowPilot: false,
  maxPilotBudget: 0,
  pilotRequiresFactsUnlocked: 5,
  allowTimelineChange: false,
  maxConcessionsTotal: 2,
};

const prospectId = newId();

db.insert(prospects)
  .values({
    id: prospectId,
    trainerId,
    name: "Dana Whitfield",
    jobTitle: "VP of Operations",
    company: "Corvid Freight",
    persona: [
      "Dana runs operations for Corvid Freight, a 400-truck regional carrier.",
      "She is sharp, courteous, and permanently short on time. She has sat through",
      "dozens of software pitches and can smell a script in one sentence. She answers",
      "politely but gives nothing away for free. She warms up noticeably when someone",
      "actually understands the operational reality of freight — driver churn, missed",
      "windows, re-planning at 5am — and cools fast when someone talks at her.",
      "She speaks in short, concrete sentences and occasionally deflects with dry humor.",
    ].join(" "),
    dealContext: [
      "Modeled on the Meridian deal we lost in Q2: mid-market logistics, incumbent",
      "renewal 14 months ago, champion embarrassed to admit the tool she picked is",
      "failing. Our rep pitched features in minute three and got a polite 'send me a deck'.",
    ].join(" "),
    openingLine:
      "This is Dana. I've got a hard stop in twenty minutes — what's this about?",
    patienceConfig,
    concessionCaps,
    createdAt: now,
  })
  .run();

db.insert(hiddenFacts)
  .values([
    {
      id: newId(),
      prospectId,
      label: "The actual budget",
      topic: "budget",
      truth:
        "There is $78k earmarked this fiscal year for routing software, tucked inside the ops-modernization line. She quotes a lower number to vendors to keep negotiating room.",
      politeLie:
        "Honestly, there's maybe $25–30k in the budget for something like this, if that.",
      unlockRule: { type: "reflection", topic: "budget", minAccuracy: 0.7 },
      sortOrder: 0,
    },
    {
      id: newId(),
      prospectId,
      label: "Who really signs",
      topic: "authority",
      truth:
        "CFO Marcus Yuen signs anything over $50k. Dana can only approve $15k herself, and she got burned last year bringing Marcus a half-baked proposal — she won't do that again without a rock-solid case.",
      politeLie: "It'd be my call at the end of the day.",
      unlockRule: { type: "reflection", topic: "authority", minAccuracy: 0.7 },
      sortOrder: 1,
    },
    {
      id: newId(),
      prospectId,
      label: "The embarrassed incumbent",
      topic: "incumbent",
      truth:
        "They renewed RouteMaster for three years just 14 months ago — on Dana's recommendation. It's failing: dispatchers keep a shadow spreadsheet because the optimizer can't handle multi-stop loads. She's embarrassed and defensive about it.",
      politeLie: "Our current system does the job, more or less.",
      unlockRule: { type: "reflection", topic: "incumbent", minAccuracy: 0.75 },
      sortOrder: 2,
    },
    {
      id: newId(),
      prospectId,
      label: "What the failure costs",
      topic: "pain_cost",
      truth:
        "Mis-routed loads cost roughly $40k last quarter, and her best ops lead quit over the 5am manual re-planning grind. That resignation letter is why she took this call.",
      politeLie: "There's the occasional hiccup, nothing dramatic.",
      unlockRule: { type: "trust", minTrust: 12 },
      sortOrder: 3,
    },
    {
      id: newId(),
      prospectId,
      label: "The real deadline",
      topic: "timeline",
      truth:
        "Peak-season contract negotiations start in 10 weeks. If routing isn't fixed by then, she's locked into another year of the same — which is why she's quietly evaluating alternatives now.",
      politeLie: "No particular timeline — we're just looking around.",
      unlockRule: { type: "trust", minTrust: 20 },
      sortOrder: 4,
    },
  ])
  .run();

// ── Drill ────────────────────────────────────────────────────────────────────

const drillId = newId();

db.insert(drills)
  .values({
    id: drillId,
    trainerId,
    prospectId,
    scorecardId,
    title: "Cold discovery: the guarded VP",
    briefing: [
      "Dana agreed to twenty minutes after a warm intro from a mutual contact.",
      "You sell route-optimization software. Your job on this call is NOT to pitch —",
      "it's to understand her world well enough that she tells you what's really",
      "going on, and to leave with a next step she actually wants.",
      "Watch your air-time. She's been pitched at before.",
    ].join(" "),
    createdAt: now,
  })
  .run();

db.insert(drillAssignments)
  .values({ id: newId(), drillId, repId, createdAt: now })
  .run();

console.log("Seeded demo data:");
console.log("  trainer  coach@sparring.local / coach-demo-1");
console.log("  rep      rep@sparring.local   / rep-demo-1");
console.log(`  prospect Dana Whitfield (${prospectId})`);
console.log(`  drill    Cold discovery: the guarded VP (${drillId})`);

ensureChannelContent();
