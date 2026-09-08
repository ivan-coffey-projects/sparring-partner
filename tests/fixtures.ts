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
import type { Channel, ConcessionCaps, PatienceConfig } from "@/engine/types";

export const DEFAULT_PATIENCE: PatienceConfig = {
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

export const DEFAULT_CAPS: ConcessionCaps = {
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

export interface Fixture {
  trainerId: string;
  repId: string;
  prospectId: string;
  drillId: string;
  scorecardId: string;
  methodologyId: string;
  factIds: { budget: string; incumbent: string; timeline: string };
}

export const BUDGET_TRUTH =
  "There is $78k earmarked this fiscal year for routing software, tucked inside the ops-modernization line.";
export const BUDGET_LIE =
  "Honestly, there's maybe $25-30k in the budget for something like this, if that.";
export const INCUMBENT_TRUTH =
  "They renewed RouteMaster fourteen months ago and it is failing — dispatchers keep a shadow spreadsheet because the optimizer chokes on multi-stop loads.";
export const INCUMBENT_LIE = "Our current system does the job, more or less.";
export const TIMELINE_TRUTH =
  "Peak-season contract negotiations start in ten weeks; unfixed routing means eating another year.";
export const TIMELINE_LIE = "No particular timeline — we're just looking around.";

export function insertFixture(
  overrides: {
    patienceConfig?: Partial<PatienceConfig>;
    concessionCaps?: Partial<ConcessionCaps>;
    channel?: Channel;
    /** Empty string = the rep opens the thread (async channels only). */
    openingLine?: string;
  } = {},
): Fixture {
  const now = Date.now();
  const trainerId = newId();
  const repId = newId();
  db.insert(users)
    .values([
      {
        id: trainerId,
        email: `trainer-${trainerId}@test.local`,
        name: "Test Trainer",
        passwordHash: hashPassword("password-123"),
        role: "trainer",
        createdAt: now,
      },
      {
        id: repId,
        email: `rep-${repId}@test.local`,
        name: "Test Rep",
        passwordHash: hashPassword("password-123"),
        role: "rep",
        createdAt: now,
      },
    ])
    .run();

  const methodologyId = newId();
  db.insert(methodologies)
    .values({
      id: methodologyId,
      trainerId,
      name: "Test Methodology",
      description: "",
      createdAt: now,
    })
    .run();

  const entrySpecs = [
    { number: "1.2", title: "Earn each fact" },
    { number: "2.1", title: "Reflect before you redirect" },
    { number: "2.3", title: "One question at a time" },
    { number: "3.1", title: "No pitch before pain" },
    { number: "3.2", title: "Talk less" },
    { number: "4.1", title: "Never pressure the close" },
    { number: "4.2", title: "Trade, don't cave" },
    { number: "5.1", title: "Qualify with permission" },
  ];
  const entryIds = new Map<string, string>();
  db.insert(methodologyEntries)
    .values(
      entrySpecs.map((spec, i) => {
        const id = newId();
        entryIds.set(spec.number, id);
        return {
          id,
          methodologyId,
          number: spec.number,
          title: spec.title,
          text: `${spec.title} — full methodology text.`,
          sortOrder: i,
        };
      }),
    )
    .run();

  const scorecardId = newId();
  db.insert(scorecards)
    .values({
      id: scorecardId,
      trainerId,
      methodologyId,
      name: "Test Scorecard",
      createdAt: now,
    })
    .run();
  db.insert(scorecardCriteria)
    .values([
      {
        id: newId(),
        scorecardId,
        label: "Discovery before pitch",
        description: "",
        weight: 1.5,
        methodologyEntryIds: [entryIds.get("3.1")!, entryIds.get("1.2")!],
        sortOrder: 0,
      },
      {
        id: newId(),
        scorecardId,
        label: "Reflective listening",
        description: "",
        weight: 1.5,
        methodologyEntryIds: [entryIds.get("2.1")!],
        sortOrder: 1,
      },
      {
        id: newId(),
        scorecardId,
        label: "Air-time control",
        description: "",
        weight: 1,
        methodologyEntryIds: [entryIds.get("3.2")!, entryIds.get("2.3")!],
        sortOrder: 2,
      },
    ])
    .run();

  const prospectId = newId();
  db.insert(prospects)
    .values({
      id: prospectId,
      trainerId,
      name: "Dana Whitfield",
      jobTitle: "VP of Operations",
      company: "Corvid Freight",
      persona: "Sharp, courteous, permanently short on time.",
      dealContext: "",
      openingLine: overrides.openingLine ?? "This is Dana. What's this about?",
      patienceConfig: { ...DEFAULT_PATIENCE, ...overrides.patienceConfig },
      concessionCaps: { ...DEFAULT_CAPS, ...overrides.concessionCaps },
      createdAt: now,
    })
    .run();

  const budgetFactId = newId();
  const incumbentFactId = newId();
  const timelineFactId = newId();
  db.insert(hiddenFacts)
    .values([
      {
        id: budgetFactId,
        prospectId,
        label: "The actual budget",
        topic: "budget",
        truth: BUDGET_TRUTH,
        politeLie: BUDGET_LIE,
        unlockRule: { type: "reflection", topic: "budget", minAccuracy: 0.7 },
        sortOrder: 0,
      },
      {
        id: incumbentFactId,
        prospectId,
        label: "The embarrassed incumbent",
        topic: "incumbent",
        truth: INCUMBENT_TRUTH,
        politeLie: INCUMBENT_LIE,
        unlockRule: {
          type: "reflection",
          topic: "incumbent",
          minAccuracy: 0.75,
        },
        sortOrder: 1,
      },
      {
        id: timelineFactId,
        prospectId,
        label: "The real deadline",
        topic: "timeline",
        truth: TIMELINE_TRUTH,
        politeLie: TIMELINE_LIE,
        unlockRule: { type: "trust", minTrust: 20 },
        sortOrder: 2,
      },
    ])
    .run();

  const drillId = newId();
  db.insert(drills)
    .values({
      id: drillId,
      trainerId,
      prospectId,
      scorecardId,
      title: "Test drill",
      channel: overrides.channel ?? "call",
      briefing: "Discovery call.",
      createdAt: now,
    })
    .run();
  db.insert(drillAssignments)
    .values({ id: newId(), drillId, repId, createdAt: now })
    .run();

  return {
    trainerId,
    repId,
    prospectId,
    drillId,
    scorecardId,
    methodologyId,
    factIds: {
      budget: budgetFactId,
      incumbent: incumbentFactId,
      timeline: timelineFactId,
    },
  };
}
