import { z } from "zod";
import { COACHING_SEVERITIES, MOVE_TYPES } from "@/engine/types";

/** Structured output the analyzer model must produce for every rep turn. */
export const moveAnalysisSchema = z.object({
  moveTypes: z
    .array(z.enum(MOVE_TYPES))
    .min(1)
    .describe("Every move type present in the rep's message."),
  reflectionTargets: z
    .array(
      z.object({
        topic: z
          .string()
          .describe("The hidden-fact topic key this reflection touches."),
        accuracy: z
          .number()
          .min(0)
          .max(1)
          .describe(
            "How accurately the rep reflected the prospect's ACTUAL situation (per the hidden file), 0..1.",
          ),
      }),
    )
    .describe("Present only when the rep reflected/labeled the prospect's situation."),
  pitchDetected: z
    .boolean()
    .describe("True when the rep is presenting product/solution."),
  pressure: z
    .number()
    .min(0)
    .max(1)
    .describe("How much pressure or pushiness the rep applied, 0..1."),
  written: z
    .object({
      relevance: z
        .number()
        .min(0)
        .max(1)
        .describe(
          "How specifically this message ties to THIS prospect's world (load-bearing personalization, not token flattery), 0..1.",
        ),
      addsNewValue: z
        .boolean()
        .describe(
          "Whether the message brings anything new (info, resource, angle) vs restating or bumping.",
        ),
      ctaCount: z
        .number()
        .int()
        .min(0)
        .describe("Number of distinct asks in the message."),
      ctaType: z
        .enum(["none", "interest", "meeting_time", "question", "resource"])
        .describe("The primary ask, if any."),
    })
    .optional()
    .describe("Written-channel read. Present only for async channels."),
});

export type MoveAnalysisOutput = z.infer<typeof moveAnalysisSchema>;

/** The concede tool's input — the only channel for prospect commitments. */
export const concedeInputSchema = z.object({
  type: z
    .enum(["meeting", "intro", "pilot", "timeline_change"])
    .describe("The commitment the prospect is inclined to make."),
  value: z
    .number()
    .optional()
    .describe("For pilots only: the proposed pilot budget in dollars."),
});

/** Structured output the grader model must produce. Untrusted until gated. */
export const graderOutputSchema = z.object({
  criteria: z.array(
    z.object({
      criterionId: z.string(),
      score: z.number().min(0).max(5),
      rationale: z.string(),
      citation: z
        .object({
          methodologyEntryNumber: z.string(),
          transcriptQuote: z
            .string()
            .describe("A VERBATIM quote from the cited turn."),
          turnIdx: z.number().int(),
        })
        .nullable()
        .describe(
          "The citation backing this score. Null only if nothing citable exists.",
        ),
    }),
  ),
  coachingPoints: z.array(
    z.object({
      methodologyEntryNumber: z
        .string()
        .describe("Must be a real numbered entry from the methodology."),
      transcriptQuote: z
        .string()
        .describe("A VERBATIM quote from the cited turn."),
      turnIdx: z.number().int(),
      comment: z.string(),
      severity: z.enum(COACHING_SEVERITIES),
    }),
  ),
});

export type GraderOutput = z.infer<typeof graderOutputSchema>;
