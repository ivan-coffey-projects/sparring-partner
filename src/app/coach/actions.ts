"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray, notInArray } from "drizzle-orm";
import { z } from "zod";
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
} from "@/db/schema";
import { requireUser } from "@/auth/session";
import { createInvite } from "@/auth/actions";
import { newId } from "@/lib/ids";
import { CHANNELS } from "@/engine/types";

// ── Invites ──────────────────────────────────────────────────────────────────

export async function createInviteAction(
  role: "trainer" | "rep",
): Promise<{ token: string }> {
  const token = await createInvite(role);
  return { token };
}

// ── Prospects ────────────────────────────────────────────────────────────────

const unlockRuleSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("reflection"),
    topic: z.string().trim().min(1),
    minAccuracy: z.number().min(0).max(1),
  }),
  z.object({ type: z.literal("trust"), minTrust: z.number().min(0) }),
]);

const factSchema = z.object({
  id: z.string().nullable(),
  label: z.string().trim().min(1, "Every fact needs a label."),
  topic: z.string().trim().min(1, "Every fact needs a topic key."),
  truth: z.string().trim().min(1, "Every fact needs the truth."),
  politeLie: z.string().trim().min(1, "Every fact needs its polite lie."),
  unlockRule: unlockRuleSchema,
});

const patienceConfigSchema = z.object({
  initial: z.number().min(1).max(100),
  monologueWordThreshold: z.number().min(10).max(500),
  monologuePenaltyPerWord: z.number().min(0).max(5),
  earlyPitchPenalty: z.number().min(0).max(100),
  discoveryGate: z.number().int().min(0).max(20),
  bluntQuestionPenalty: z.number().min(0).max(100),
  stackedQuestionPenalty: z.number().min(0).max(100),
  pressurePenaltyScale: z.number().min(0).max(100),
  reflectionRegen: z.number().min(0).max(50),
  openQuestionRegen: z.number().min(0).max(50),
  maxRegenPerTurn: z.number().min(0).max(50),
});

const concessionCapsSchema = z.object({
  meetingRequiresFactsUnlocked: z.number().int().min(0).max(20),
  meetingRequiresPatienceAtLeast: z.number().min(0).max(100),
  allowIntro: z.boolean(),
  introRequiresFactsUnlocked: z.number().int().min(0).max(20),
  allowPilot: z.boolean(),
  maxPilotBudget: z.number().min(0),
  pilotRequiresFactsUnlocked: z.number().int().min(0).max(20),
  allowTimelineChange: z.boolean(),
  maxConcessionsTotal: z.number().int().min(0).max(10),
});

const prospectPayloadSchema = z.object({
  id: z.string().nullable(),
  name: z.string().trim().min(1, "Name is required."),
  jobTitle: z.string().trim().min(1, "Job title is required."),
  company: z.string().trim().min(1, "Company is required."),
  persona: z.string().trim().min(1, "Persona is required."),
  dealContext: z.string().trim(),
  openingLine: z.string().trim().min(1, "Opening line is required."),
  patienceConfig: patienceConfigSchema,
  concessionCaps: concessionCapsSchema,
  facts: z.array(factSchema).min(1, "A prospect needs at least one hidden fact."),
});

export type ProspectPayload = z.infer<typeof prospectPayloadSchema>;

export interface SaveResult {
  error: string | null;
}

export async function saveProspectAction(
  payload: ProspectPayload,
): Promise<SaveResult> {
  const trainer = await requireUser("trainer");
  const parsed = prospectPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const data = parsed.data;
  const now = Date.now();

  let prospectId = data.id;
  if (prospectId) {
    const existing = db
      .select()
      .from(prospects)
      .where(eq(prospects.id, prospectId))
      .get();
    if (!existing || existing.trainerId !== trainer.id) {
      return { error: "Prospect not found." };
    }
    db.update(prospects)
      .set({
        name: data.name,
        jobTitle: data.jobTitle,
        company: data.company,
        persona: data.persona,
        dealContext: data.dealContext,
        openingLine: data.openingLine,
        patienceConfig: data.patienceConfig,
        concessionCaps: data.concessionCaps,
      })
      .where(eq(prospects.id, prospectId))
      .run();
  } else {
    prospectId = newId();
    db.insert(prospects)
      .values({
        id: prospectId,
        trainerId: trainer.id,
        name: data.name,
        jobTitle: data.jobTitle,
        company: data.company,
        persona: data.persona,
        dealContext: data.dealContext,
        openingLine: data.openingLine,
        patienceConfig: data.patienceConfig,
        concessionCaps: data.concessionCaps,
        createdAt: now,
      })
      .run();
  }

  const keptIds = data.facts
    .map((f) => f.id)
    .filter((id): id is string => id !== null);
  if (keptIds.length > 0) {
    db.delete(hiddenFacts)
      .where(
        and(
          eq(hiddenFacts.prospectId, prospectId),
          notInArray(hiddenFacts.id, keptIds),
        ),
      )
      .run();
  } else {
    db.delete(hiddenFacts).where(eq(hiddenFacts.prospectId, prospectId)).run();
  }
  data.facts.forEach((fact, i) => {
    if (fact.id) {
      db.update(hiddenFacts)
        .set({
          label: fact.label,
          topic: fact.topic,
          truth: fact.truth,
          politeLie: fact.politeLie,
          unlockRule: fact.unlockRule,
          sortOrder: i,
        })
        .where(eq(hiddenFacts.id, fact.id))
        .run();
    } else {
      db.insert(hiddenFacts)
        .values({
          id: newId(),
          prospectId,
          label: fact.label,
          topic: fact.topic,
          truth: fact.truth,
          politeLie: fact.politeLie,
          unlockRule: fact.unlockRule,
          sortOrder: i,
        })
        .run();
    }
  });

  revalidatePath("/coach/prospects");
  redirect("/coach/prospects");
}

// ── Methodology ──────────────────────────────────────────────────────────────

const methodologyPayloadSchema = z.object({
  id: z.string().nullable(),
  name: z.string().trim().min(1, "Name is required."),
  description: z.string().trim(),
  entries: z
    .array(
      z.object({
        id: z.string().nullable(),
        number: z.string().trim().min(1, "Every entry needs a number."),
        title: z.string().trim().min(1, "Every entry needs a title."),
        text: z.string().trim().min(1, "Every entry needs its text."),
      }),
    )
    .min(1, "A methodology needs at least one numbered entry."),
});

export type MethodologyPayload = z.infer<typeof methodologyPayloadSchema>;

export async function saveMethodologyAction(
  payload: MethodologyPayload,
): Promise<SaveResult> {
  const trainer = await requireUser("trainer");
  const parsed = methodologyPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const data = parsed.data;
  const numbers = data.entries.map((e) => e.number);
  if (new Set(numbers).size !== numbers.length) {
    return { error: "Entry numbers must be unique." };
  }
  const now = Date.now();

  let methodologyId = data.id;
  if (methodologyId) {
    const existing = db
      .select()
      .from(methodologies)
      .where(eq(methodologies.id, methodologyId))
      .get();
    if (!existing || existing.trainerId !== trainer.id) {
      return { error: "Methodology not found." };
    }
    db.update(methodologies)
      .set({ name: data.name, description: data.description })
      .where(eq(methodologies.id, methodologyId))
      .run();
  } else {
    methodologyId = newId();
    db.insert(methodologies)
      .values({
        id: methodologyId,
        trainerId: trainer.id,
        name: data.name,
        description: data.description,
        createdAt: now,
      })
      .run();
  }

  const keptIds = data.entries
    .map((e) => e.id)
    .filter((id): id is string => id !== null);
  const removed = db
    .select({ id: methodologyEntries.id })
    .from(methodologyEntries)
    .where(eq(methodologyEntries.methodologyId, methodologyId))
    .all()
    .map((r) => r.id)
    .filter((id) => !keptIds.includes(id));

  if (removed.length > 0) {
    db.delete(methodologyEntries)
      .where(inArray(methodologyEntries.id, removed))
      .run();
    // Scrub dangling references from scorecard criteria.
    const cards = db
      .select()
      .from(scorecards)
      .where(eq(scorecards.methodologyId, methodologyId))
      .all();
    for (const card of cards) {
      const criteria = db
        .select()
        .from(scorecardCriteria)
        .where(eq(scorecardCriteria.scorecardId, card.id))
        .all();
      for (const criterion of criteria) {
        const filtered = criterion.methodologyEntryIds.filter(
          (id) => !removed.includes(id),
        );
        if (filtered.length !== criterion.methodologyEntryIds.length) {
          db.update(scorecardCriteria)
            .set({ methodologyEntryIds: filtered })
            .where(eq(scorecardCriteria.id, criterion.id))
            .run();
        }
      }
    }
  }

  data.entries.forEach((entry, i) => {
    if (entry.id) {
      db.update(methodologyEntries)
        .set({
          number: entry.number,
          title: entry.title,
          text: entry.text,
          sortOrder: i,
        })
        .where(eq(methodologyEntries.id, entry.id))
        .run();
    } else {
      db.insert(methodologyEntries)
        .values({
          id: newId(),
          methodologyId,
          number: entry.number,
          title: entry.title,
          text: entry.text,
          sortOrder: i,
        })
        .run();
    }
  });

  revalidatePath("/coach/methodology");
  redirect("/coach/methodology");
}

// ── Scorecards ───────────────────────────────────────────────────────────────

const scorecardPayloadSchema = z.object({
  id: z.string().nullable(),
  name: z.string().trim().min(1, "Name is required."),
  methodologyId: z.string().min(1, "Pick a methodology."),
  criteria: z
    .array(
      z.object({
        id: z.string().nullable(),
        label: z.string().trim().min(1, "Every criterion needs a label."),
        description: z.string().trim(),
        weight: z.number().min(0.1).max(10),
        methodologyEntryIds: z
          .array(z.string())
          .min(1, "Every criterion must cite at least one methodology entry."),
      }),
    )
    .min(1, "A scorecard needs at least one criterion."),
});

export type ScorecardPayload = z.infer<typeof scorecardPayloadSchema>;

export async function saveScorecardAction(
  payload: ScorecardPayload,
): Promise<SaveResult> {
  const trainer = await requireUser("trainer");
  const parsed = scorecardPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const data = parsed.data;

  const validEntryIds = new Set(
    db
      .select({ id: methodologyEntries.id })
      .from(methodologyEntries)
      .where(eq(methodologyEntries.methodologyId, data.methodologyId))
      .all()
      .map((r) => r.id),
  );
  for (const criterion of data.criteria) {
    if (criterion.methodologyEntryIds.some((id) => !validEntryIds.has(id))) {
      return {
        error: `"${criterion.label}" cites entries outside the chosen methodology.`,
      };
    }
  }

  const now = Date.now();
  let scorecardId = data.id;
  if (scorecardId) {
    const existing = db
      .select()
      .from(scorecards)
      .where(eq(scorecards.id, scorecardId))
      .get();
    if (!existing || existing.trainerId !== trainer.id) {
      return { error: "Scorecard not found." };
    }
    db.update(scorecards)
      .set({ name: data.name, methodologyId: data.methodologyId })
      .where(eq(scorecards.id, scorecardId))
      .run();
  } else {
    scorecardId = newId();
    db.insert(scorecards)
      .values({
        id: scorecardId,
        trainerId: trainer.id,
        methodologyId: data.methodologyId,
        name: data.name,
        createdAt: now,
      })
      .run();
  }

  const keptIds = data.criteria
    .map((c) => c.id)
    .filter((id): id is string => id !== null);
  if (keptIds.length > 0) {
    db.delete(scorecardCriteria)
      .where(
        and(
          eq(scorecardCriteria.scorecardId, scorecardId),
          notInArray(scorecardCriteria.id, keptIds),
        ),
      )
      .run();
  } else {
    db.delete(scorecardCriteria)
      .where(eq(scorecardCriteria.scorecardId, scorecardId))
      .run();
  }
  data.criteria.forEach((criterion, i) => {
    if (criterion.id) {
      db.update(scorecardCriteria)
        .set({
          label: criterion.label,
          description: criterion.description,
          weight: criterion.weight,
          methodologyEntryIds: criterion.methodologyEntryIds,
          sortOrder: i,
        })
        .where(eq(scorecardCriteria.id, criterion.id))
        .run();
    } else {
      db.insert(scorecardCriteria)
        .values({
          id: newId(),
          scorecardId,
          label: criterion.label,
          description: criterion.description,
          weight: criterion.weight,
          methodologyEntryIds: criterion.methodologyEntryIds,
          sortOrder: i,
        })
        .run();
    }
  });

  revalidatePath("/coach/scorecards");
  redirect("/coach/scorecards");
}

// ── Drills ───────────────────────────────────────────────────────────────────

const drillPayloadSchema = z.object({
  id: z.string().nullable(),
  title: z.string().trim().min(1, "Title is required."),
  channel: z.enum(CHANNELS),
  briefing: z.string().trim(),
  prospectId: z.string().min(1, "Pick a prospect."),
  scorecardId: z.string().min(1, "Pick a scorecard."),
  repIds: z.array(z.string()),
});

export type DrillPayload = z.infer<typeof drillPayloadSchema>;

export async function saveDrillAction(
  payload: DrillPayload,
): Promise<SaveResult> {
  const trainer = await requireUser("trainer");
  const parsed = drillPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const data = parsed.data;
  const now = Date.now();

  let drillId = data.id;
  if (drillId) {
    const existing = db
      .select()
      .from(drills)
      .where(eq(drills.id, drillId))
      .get();
    if (!existing || existing.trainerId !== trainer.id) {
      return { error: "Drill not found." };
    }
    db.update(drills)
      .set({
        title: data.title,
        channel: data.channel,
        briefing: data.briefing,
        prospectId: data.prospectId,
        scorecardId: data.scorecardId,
      })
      .where(eq(drills.id, drillId))
      .run();
  } else {
    drillId = newId();
    db.insert(drills)
      .values({
        id: drillId,
        trainerId: trainer.id,
        prospectId: data.prospectId,
        scorecardId: data.scorecardId,
        title: data.title,
        channel: data.channel,
        briefing: data.briefing,
        createdAt: now,
      })
      .run();
  }

  const existingAssignments = db
    .select()
    .from(drillAssignments)
    .where(eq(drillAssignments.drillId, drillId))
    .all();
  const existingRepIds = new Set(existingAssignments.map((a) => a.repId));
  const wantedRepIds = new Set(data.repIds);

  for (const assignment of existingAssignments) {
    if (!wantedRepIds.has(assignment.repId)) {
      db.delete(drillAssignments)
        .where(eq(drillAssignments.id, assignment.id))
        .run();
    }
  }
  for (const repId of wantedRepIds) {
    if (!existingRepIds.has(repId)) {
      db.insert(drillAssignments)
        .values({ id: newId(), drillId, repId, createdAt: now })
        .run();
    }
  }

  revalidatePath("/coach/drills");
  redirect("/coach/drills");
}
