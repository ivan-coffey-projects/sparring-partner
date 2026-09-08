import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import type {
  CallOutcome,
  Channel,
  ChannelState,
  ConcessionCaps,
  ConcessionLogEntry,
  MoveAnalysis,
  PatienceConfig,
  PatienceDelta,
  UnlockRule,
  WrittenMetrics,
} from "@/engine/types";

// ── Users & auth ─────────────────────────────────────────────────────────────

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").$type<"trainer" | "rep">().notNull(),
  createdAt: integer("created_at").notNull(),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: integer("expires_at").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const invites = sqliteTable("invites", {
  id: text("id").primaryKey(),
  token: text("token").notNull().unique(),
  role: text("role").$type<"trainer" | "rep">().notNull(),
  createdBy: text("created_by")
    .notNull()
    .references(() => users.id),
  usedByUserId: text("used_by_user_id").references(() => users.id),
  expiresAt: integer("expires_at").notNull(),
  createdAt: integer("created_at").notNull(),
});

// ── Methodology (the citable unit) ───────────────────────────────────────────

export const methodologies = sqliteTable("methodologies", {
  id: text("id").primaryKey(),
  trainerId: text("trainer_id")
    .notNull()
    .references(() => users.id),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  createdAt: integer("created_at").notNull(),
});

export const methodologyEntries = sqliteTable("methodology_entries", {
  id: text("id").primaryKey(),
  methodologyId: text("methodology_id")
    .notNull()
    .references(() => methodologies.id, { onDelete: "cascade" }),
  /** Trainer-facing citation number, e.g. "3.2". Unique per methodology. */
  number: text("number").notNull(),
  title: text("title").notNull(),
  text: text("text").notNull(),
  sortOrder: integer("sort_order").notNull(),
});

// ── Scorecards ───────────────────────────────────────────────────────────────

export const scorecards = sqliteTable("scorecards", {
  id: text("id").primaryKey(),
  trainerId: text("trainer_id")
    .notNull()
    .references(() => users.id),
  methodologyId: text("methodology_id")
    .notNull()
    .references(() => methodologies.id),
  name: text("name").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const scorecardCriteria = sqliteTable("scorecard_criteria", {
  id: text("id").primaryKey(),
  scorecardId: text("scorecard_id")
    .notNull()
    .references(() => scorecards.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  description: text("description").notNull().default(""),
  weight: real("weight").notNull().default(1),
  /** Methodology entries this criterion is graded against. */
  methodologyEntryIds: text("methodology_entry_ids", { mode: "json" })
    .$type<string[]>()
    .notNull(),
  sortOrder: integer("sort_order").notNull(),
});

// ── Prospects (personas) & the hidden file ───────────────────────────────────

export const prospects = sqliteTable("prospects", {
  id: text("id").primaryKey(),
  trainerId: text("trainer_id")
    .notNull()
    .references(() => users.id),
  name: text("name").notNull(),
  jobTitle: text("job_title").notNull(),
  company: text("company").notNull(),
  /** Free-text persona: personality, context, how they talk. */
  persona: text("persona").notNull(),
  /** Trainer notes: the real deal this was modeled on. Never enters prompts. */
  dealContext: text("deal_context").notNull().default(""),
  openingLine: text("opening_line").notNull(),
  patienceConfig: text("patience_config", { mode: "json" })
    .$type<PatienceConfig>()
    .notNull(),
  concessionCaps: text("concession_caps", { mode: "json" })
    .$type<ConcessionCaps>()
    .notNull(),
  createdAt: integer("created_at").notNull(),
});

export const hiddenFacts = sqliteTable("hidden_facts", {
  id: text("id").primaryKey(),
  prospectId: text("prospect_id")
    .notNull()
    .references(() => prospects.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  topic: text("topic").notNull(),
  truth: text("truth").notNull(),
  politeLie: text("polite_lie").notNull(),
  unlockRule: text("unlock_rule", { mode: "json" }).$type<UnlockRule>().notNull(),
  sortOrder: integer("sort_order").notNull(),
});

// ── Drills & assignments ─────────────────────────────────────────────────────

export const drills = sqliteTable("drills", {
  id: text("id").primaryKey(),
  trainerId: text("trainer_id")
    .notNull()
    .references(() => users.id),
  prospectId: text("prospect_id")
    .notNull()
    .references(() => prospects.id),
  scorecardId: text("scorecard_id")
    .notNull()
    .references(() => scorecards.id),
  title: text("title").notNull(),
  /** Which channel this drill trains ("call" | "sms" | "email" | "dm_…"). */
  channel: text("channel").$type<Channel>().notNull().default("call"),
  /** Instructions shown to the rep before the call. */
  briefing: text("briefing").notNull().default(""),
  createdAt: integer("created_at").notNull(),
});

export const drillAssignments = sqliteTable("drill_assignments", {
  id: text("id").primaryKey(),
  drillId: text("drill_id")
    .notNull()
    .references(() => drills.id, { onDelete: "cascade" }),
  repId: text("rep_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: integer("created_at").notNull(),
});

// ── Calls, turns, reports ────────────────────────────────────────────────────

export const calls = sqliteTable("calls", {
  id: text("id").primaryKey(),
  drillId: text("drill_id")
    .notNull()
    .references(() => drills.id),
  repId: text("rep_id")
    .notNull()
    .references(() => users.id),
  status: text("status").$type<"live" | "ended">().notNull(),
  outcome: text("outcome").$type<CallOutcome>(),
  patience: real("patience").notNull(),
  trust: real("trust").notNull().default(0),
  reflectionsEarned: integer("reflections_earned").notNull().default(0),
  unlockedFactIds: text("unlocked_fact_ids", { mode: "json" })
    .$type<string[]>()
    .notNull(),
  concessionLog: text("concession_log", { mode: "json" })
    .$type<ConcessionLogEntry[]>()
    .notNull(),
  /** Async channels only: sim clock + unanswered-streak state. */
  channelState: text("channel_state", { mode: "json" }).$type<ChannelState>(),
  startedAt: integer("started_at").notNull(),
  endedAt: integer("ended_at"),
});

export interface TurnAnalysisRecord {
  analysis: MoveAnalysis;
  metrics:
    | { wordCount: number; questionCount: number }
    | WrittenMetrics;
  patience: number;
  patienceDeltas: PatienceDelta[];
  newlyUnlockedFactIds: string[];
}

/** Channel extras persisted per turn. */
export interface TurnMeta {
  /** Email: subject line of this message. */
  subject?: string;
  /** Prospect turns on async channels: simulated minutes before it landed. */
  delayMinutes?: number;
  /** System turns: how long the rep waited, in simulated minutes. */
  waitedMinutes?: number;
}

export const callTurns = sqliteTable("call_turns", {
  id: text("id").primaryKey(),
  callId: text("call_id")
    .notNull()
    .references(() => calls.id, { onDelete: "cascade" }),
  idx: integer("idx").notNull(),
  speaker: text("speaker").$type<"rep" | "prospect" | "system">().notNull(),
  text: text("text").notNull(),
  /** Present on rep turns: the engine's full read of the move. */
  analysis: text("analysis", { mode: "json" }).$type<TurnAnalysisRecord>(),
  /** Channel extras (subject line, simulated delays, waits). */
  meta: text("meta", { mode: "json" }).$type<TurnMeta>(),
  createdAt: integer("created_at").notNull(),
});

export interface CriterionScoreRecord {
  criterionId: string;
  label: string;
  weight: number;
  /** 0..5 */
  score: number;
  rationale: string;
  /** Citation backing the rationale; absent → "no citable coaching" state. */
  citation: {
    methodologyEntryId: string;
    methodologyEntryNumber: string;
    transcriptQuote: string;
    turnIdx: number;
  } | null;
}

export interface CoachingPointRecord {
  methodologyEntryId: string;
  methodologyEntryNumber: string;
  methodologyEntryTitle: string;
  methodologyEntryText: string;
  transcriptQuote: string;
  turnIdx: number;
  comment: string;
  severity: "critical" | "major" | "minor";
}

export interface DroppedPointRecord {
  methodologyEntryNumber: string;
  transcriptQuote: string;
  turnIdx: number;
  comment: string;
  severity: "critical" | "major" | "minor";
  reason: "unknown_entry" | "bad_turn_ref" | "quote_not_found";
}

// ── Reviews (real uploaded artifacts, scored) ────────────────────────────────

/** One parsed line of an uploaded artifact. Same shape the citation gate eats. */
export interface ReviewTurnRecord {
  idx: number;
  speaker: "rep" | "prospect" | "system";
  text: string;
}

export const reviews = sqliteTable("reviews", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  /** What kind of artifact this is. */
  channel: text("channel").$type<Channel>().notNull(),
  /** Funnel stage — CTA grading flips between cold and active (research). */
  stage: text("stage").$type<"cold" | "active">().notNull().default("cold"),
  title: text("title").notNull(),
  /** The artifact exactly as pasted. Ground truth for the citation gate. */
  rawText: text("raw_text").notNull(),
  /** Structured turns; every text is a verbatim substring of rawText. */
  turns: text("turns", { mode: "json" }).$type<ReviewTurnRecord[]>().notNull(),
  /** Scorecard to grade against (a channel playbook or trainer's own). */
  scorecardId: text("scorecard_id")
    .notNull()
    .references(() => scorecards.id),
  status: text("status")
    .$type<"pending" | "grading" | "ready" | "failed">()
    .notNull(),
  overallScore: real("overall_score"),
  criteriaScores: text("criteria_scores", { mode: "json" }).$type<
    CriterionScoreRecord[]
  >(),
  coachingPoints: text("coaching_points", { mode: "json" }).$type<
    CoachingPointRecord[]
  >(),
  droppedPoints: text("dropped_points", { mode: "json" }).$type<
    DroppedPointRecord[]
  >(),
  graderModel: text("grader_model"),
  error: text("error"),
  createdAt: integer("created_at").notNull(),
  gradingStartedAt: integer("grading_started_at"),
  gradedAt: integer("graded_at"),
});

export const reports = sqliteTable("reports", {
  id: text("id").primaryKey(),
  callId: text("call_id")
    .notNull()
    .unique()
    .references(() => calls.id, { onDelete: "cascade" }),
  status: text("status")
    .$type<"pending" | "grading" | "ready" | "failed">()
    .notNull(),
  overallScore: real("overall_score"),
  criteriaScores: text("criteria_scores", { mode: "json" }).$type<
    CriterionScoreRecord[]
  >(),
  coachingPoints: text("coaching_points", { mode: "json" }).$type<
    CoachingPointRecord[]
  >(),
  droppedPoints: text("dropped_points", { mode: "json" }).$type<
    DroppedPointRecord[]
  >(),
  graderModel: text("grader_model"),
  error: text("error"),
  createdAt: integer("created_at").notNull(),
  gradingStartedAt: integer("grading_started_at"),
  gradedAt: integer("graded_at"),
});
