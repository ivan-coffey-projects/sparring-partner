/**
 * Core engine types. Everything in `src/engine` is deterministic, pure, and
 * LLM-free: the four load-bearing mechanisms (hidden-file unlocking, patience,
 * concession caps, citation gating) live here so they can be unit-tested and
 * can never be prompt-injected away.
 */

// ── Channels ─────────────────────────────────────────────────────────────────

/**
 * Training channels. `call` is the original synchronous phone call; the rest
 * are asynchronous written channels where silence, cadence, and message craft
 * are the mechanics. Channel behavior parameters live in
 * `src/engine/channels.ts` and cite `docs/research/*.md`.
 */
export const CHANNELS = [
  "call",
  "sms",
  "email",
  "dm_instagram",
  "dm_linkedin",
] as const;

export type Channel = (typeof CHANNELS)[number];

export const ASYNC_CHANNELS = [
  "sms",
  "email",
  "dm_instagram",
  "dm_linkedin",
] as const;

export type AsyncChannel = (typeof ASYNC_CHANNELS)[number];

export function isAsyncChannel(channel: Channel): channel is AsyncChannel {
  return channel !== "call";
}

// ── Rep move analysis (produced by the analyzer model, consumed by engine) ──

export const MOVE_TYPES = [
  "open_question",
  "closed_question",
  "blunt_qualifying",
  "reflection",
  "rapport",
  "pitch",
  "concession_request",
  "close_attempt",
  "other",
] as const;

export type MoveType = (typeof MOVE_TYPES)[number];

export interface ReflectionTarget {
  /** Topic key the reflection touches (matched against hidden-fact topics). */
  topic: string;
  /** 0..1 — how accurately the rep reflected the prospect's actual situation. */
  accuracy: number;
}

export interface MoveAnalysis {
  moveTypes: MoveType[];
  reflectionTargets: ReflectionTarget[];
  /** True when the rep is presenting product/solution rather than discovering. */
  pitchDetected: boolean;
  /** 0..1 — how much pressure/pushiness the rep applied this turn. */
  pressure: number;
  /** Present on async written channels only. */
  written?: WrittenAnalysis;
}

/**
 * Extra analyzer read for written channels. Grounded in docs/research:
 * relevance (load-bearing personalization) beats token personalization
 * (email-channel.md §B3); every follow-up must add new value
 * (email-channel.md §B6, sms-channel.md §A5).
 */
export interface WrittenAnalysis {
  /** 0..1 — how specifically this message ties to THIS prospect's world. */
  relevance: number;
  /** For follow-ups into silence: does the message add anything new? */
  addsNewValue: boolean;
  /** Number of distinct asks (CTAs) in the message. */
  ctaCount: number;
  /** The primary ask, if any. */
  ctaType: "none" | "interest" | "meeting_time" | "question" | "resource";
}

/** Metrics computed in code from the raw rep message — never by a model. */
export interface TurnMetrics {
  wordCount: number;
  questionCount: number;
}

/**
 * Code-computed metrics for a written rep message (async channels).
 * Deliberately model-free: length bands, spam triggers, reading grade, and
 * self-focus are un-charmable arithmetic. Thresholds and their evidence live
 * in `src/engine/channels.ts`.
 */
/**
 * One word as a speech-to-text engine reports it. Times are seconds from the
 * start of the recording. `speaker` is the diarised channel — on a live call
 * the rep and the prospect are separate streams, so this is a label, not a
 * guess the engine has to make.
 */
export interface TranscribedWord {
  text: string;
  startSeconds: number;
  endSeconds: number;
  speaker: "rep" | "prospect";
}

/**
 * Code-computed speech metrics for one call, derived from word timestamps.
 *
 * Pre-registered as H6 in docs/research/voice-channel.md: these enter the score
 * only if they agree with a human annotator inside the thresholds recorded
 * there (filler count within +/-15%, talk/listen ratio within +/-5 points).
 * Until that comparison has been run they are reported to the rep as
 * directional and excluded from scoring. Either way the computation lives here
 * in engine code rather than in a provider instruction.
 */
export interface SpeechMetrics {
  /** Filler words spoken by the rep. */
  fillerCount: number;
  /** Fillers per 100 rep words — comparable across turns of any length. */
  fillerRatePer100Words: number;
  /** Seconds the rep spoke. */
  repSpeakingSeconds: number;
  /** Seconds the prospect spoke. */
  prospectSpeakingSeconds: number;
  /**
   * Rep share of total speaking time, 0..1. Silence belongs to neither side and
   * is excluded, so this is talk/listen rather than talk/elapsed.
   */
  repTalkRatio: number;
  /** Longest unbroken rep stretch, in seconds. */
  longestMonologueSeconds: number;
  /** Rep words per minute over the time the rep was actually speaking. */
  repWordsPerMinute: number;
  /** Rep words counted — the denominator behind the rates above. */
  repWordCount: number;
}

export interface WrittenMetrics extends TurnMetrics {
  charCount: number;
  linkCount: number;
  emojiCount: number;
  exclamationCount: number;
  /** Words in ALL CAPS (length ≥ 3). */
  allCapsWords: number;
  /** Spam-filter trigger phrases found (email-channel.md §B5). */
  spamTriggerHits: string[];
  /** Value-free bump phrases ("just following up", "any thoughts") — measured
   * reply-killers (email-channel.md §B6: "Thoughts?" −20% meetings). */
  guiltTripHits: string[];
  /** Flesch-Kincaid grade estimate. Target ≤ 5–6 (email-channel.md §B2). */
  readingGrade: number;
  /** I/we-vs-you ratio, 0..1 — high = talking about yourself (§B3). */
  selfFocusRatio: number;
  /** Email only: metrics for the subject line of the message, if present. */
  subject?: {
    charCount: number;
    wordCount: number;
    spamTriggerHits: string[];
    isQuestion: boolean;
  };
}

// ── Patience ─────────────────────────────────────────────────────────────────

export interface PatienceConfig {
  /** Starting patience, 0..100. */
  initial: number;
  /** Words per rep turn before the monologue penalty starts. */
  monologueWordThreshold: number;
  /** Patience lost per word over the threshold. */
  monologuePenaltyPerWord: number;
  /** Flat penalty for pitching before the discovery gate is met. */
  earlyPitchPenalty: number;
  /** Hidden facts that must be unlocked before a pitch is "earned". */
  discoveryGate: number;
  /** Flat penalty for a blunt qualifying question. */
  bluntQuestionPenalty: number;
  /** Flat penalty for stacking 3+ questions into one turn. */
  stackedQuestionPenalty: number;
  /** Scale for pressure penalty (applied as pressure × this value). */
  pressurePenaltyScale: number;
  /** Patience regained for an accurate reflection. */
  reflectionRegen: number;
  /** Patience regained for a good open question. */
  openQuestionRegen: number;
  /** Cap on total regen in a single turn. */
  maxRegenPerTurn: number;
}

export const PATIENCE_DELTA_REASONS = [
  "monologue",
  "early_pitch",
  "blunt_question",
  "stacked_questions",
  "pressure",
  "accurate_reflection",
  "open_question",
] as const;

export type PatienceDeltaReason = (typeof PATIENCE_DELTA_REASONS)[number];

/**
 * Delta reasons specific to written channels (the engagement engine).
 * Evidence for each lives in docs/research/{sms,email}-channel.md.
 */
export const WRITTEN_DELTA_REASONS = [
  "wall_of_text",
  "pitch_first_touch",
  "no_question",
  "multi_cta",
  "spam_signals",
  "self_focused",
  "guilt_trip",
  "too_soon_follow_up",
  "no_new_value",
  "relevant_personalization",
  "clear_cta",
  "patient_follow_up",
] as const;

export type WrittenDeltaReason = (typeof WRITTEN_DELTA_REASONS)[number];

export type DeltaReason = PatienceDeltaReason | WrittenDeltaReason;

export interface PatienceDelta {
  reason: DeltaReason;
  /** Signed: negative drains patience, positive restores it. */
  amount: number;
}

export interface PatienceTurnResult {
  /** Patience after this turn, clamped to 0..100. */
  value: number;
  deltas: PatienceDelta[];
  /** True when patience hit 0 — the prospect hangs up. */
  hangUp: boolean;
}

/** Patience band used to shape the prospect's tone. */
export type PatienceBand = "engaged" | "cooling" | "impatient" | "done";

// ── Engagement (the async channels' analogue of patience) ────────────────────

/**
 * Per-channel behavior knobs for the engagement engine. Values are
 * research-derived defaults in `src/engine/channels.ts`; the prospect's
 * `patienceConfig.initial` still sets the starting engagement so trainers can
 * tune difficulty per persona. Engagement shares the 0..100 scale, the delta
 * plumbing, and the persisted `patience` column with the call engine.
 */
export interface EngagementConfig {
  /** No length penalty at or below this many characters. */
  idealMaxChars: number;
  /** Engagement lost per character over idealMaxChars. */
  perCharPenalty: number;
  /** Wall-of-text threshold: flat extra penalty at/above this. */
  hardMaxChars: number;
  wallOfTextPenalty: number;
  /** Pitching in the very first rep message of the thread. */
  pitchFirstTouchPenalty: number;
  /** A message with no question and no ask at all. */
  noQuestionPenalty: number;
  /** Three or more questions stacked into one message. */
  stackedQuestionPenalty: number;
  /** More than one distinct ask in one message. */
  multiCtaPenalty: number;
  /** Per spam-trigger phrase (subject-line hits count double on email). */
  spamSignalPenalty: number;
  /** Applied when the message is mostly about the sender (ratio > 0.6). */
  selfFocusPenalty: number;
  /** Scale for pressure penalty (pressure × this, above 0.5). */
  pressurePenaltyScale: number;
  /** Value-free bump phrases ("just following up"). */
  guiltTripPenalty: number;
  /** Minimum simulated gap before following up into silence. */
  minFollowUpGapMinutes: number;
  tooSoonFollowUpPenalty: number;
  /** Follow-up into silence that adds nothing new. */
  noNewValuePenalty: number;
  /** Regen: load-bearing personalization/relevance (analyzer ≥ 0.6). */
  relevanceRegen: number;
  /** Regen: accurate reflection (hidden-file mechanics work over text too). */
  reflectionRegen: number;
  /** Regen: exactly one clear, low-friction ask. */
  clearCtaRegen: number;
  /** Regen: waited past the gap AND added new value. */
  patientFollowUpRegen: number;
  maxRegenPerTurn: number;
  /** The prospect replies when post-turn engagement ≥ this. */
  replyThreshold: number;
  /** Terminal ghost after this many consecutive unanswered rep messages. */
  ghostAfterUnanswered: number;
  /** Below this engagement, pressure/spam triggers an explicit opt-out. */
  optOutBelowEngagement: number;
  /** Simulated reply delay (minutes) by engagement band. */
  replyDelayMinutes: { fast: number; medium: number; slow: number };
}

/** Live per-thread state for async channels, persisted on the call row. */
export interface ChannelState {
  /** Simulated minutes elapsed since the thread opened. */
  simClockMinutes: number;
  /** Sim-clock reading when the rep last sent a message, if any. */
  lastRepMessageAtMinutes: number | null;
  /** Consecutive rep messages since the prospect last replied. */
  unansweredStreak: number;
}

export type AsyncTerminal = "none" | "ghosted" | "opted_out";

export interface EngagementTurnResult {
  /** Engagement after this message, clamped 0..100. */
  value: number;
  deltas: PatienceDelta[];
  /** Set when the thread just died (ghost or explicit opt-out). */
  terminal: AsyncTerminal;
}

export interface ReplyDecision {
  replies: boolean;
  /** Simulated minutes before the reply lands (0 when silent). */
  delayMinutes: number;
}

// ── Trust & hidden-fact unlocking ────────────────────────────────────────────

export type UnlockRule =
  | {
      type: "reflection";
      /** Topic the reflection must touch (matches ReflectionTarget.topic). */
      topic: string;
      /** Minimum reflection accuracy, 0..1. */
      minAccuracy: number;
    }
  | {
      type: "trust";
      /** Minimum cumulative trust score (see applyTrust). */
      minTrust: number;
    };

export interface HiddenFactDefinition {
  id: string;
  /** Short trainer-facing label, e.g. "Actual budget". */
  label: string;
  /** Topic key, e.g. "budget" — what reflections are matched against. */
  topic: string;
  /** The real answer. Only ever enters a prompt after unlocking. */
  truth: string;
  /** What the prospect says while the fact is locked. */
  politeLie: string;
  rule: UnlockRule;
}

export interface UnlockState {
  unlockedFactIds: string[];
  /** Cumulative trust score, accrued from good moves. */
  trust: number;
  /**
   * How many accurate reflections the rep has landed across the whole call.
   * Gates `trust`-type unlock rules: trust alone is grindable, because any
   * question earns a little of it, so a fact that opens on trust must also be
   * preceded by at least one demonstration of understanding.
   */
  reflectionsEarned: number;
}

export interface UnlockTurnResult {
  state: UnlockState;
  newlyUnlockedFactIds: string[];
}

// ── Concessions ──────────────────────────────────────────────────────────────

/**
 * Buyer-side commitments the prospect can be talked into. Each is hard-capped
 * in code — the model requests, the engine decides.
 */
export const CONCESSION_TYPES = [
  "meeting",
  "intro",
  "pilot",
  "timeline_change",
] as const;

export type ConcessionType = (typeof CONCESSION_TYPES)[number];

export interface ConcessionRequest {
  type: ConcessionType;
  /** For pilots: proposed pilot budget in dollars. Ignored for other types. */
  value?: number;
}

export interface ConcessionCaps {
  /** Hidden facts that must be unlocked before a meeting can be agreed. */
  meetingRequiresFactsUnlocked: number;
  /** Minimum patience for the prospect to agree to a meeting. */
  meetingRequiresPatienceAtLeast: number;
  /** Whether the prospect may ever intro the rep to the real signer. */
  allowIntro: boolean;
  /** Facts required before an intro. */
  introRequiresFactsUnlocked: number;
  /** Whether the prospect may ever agree to a paid pilot on this call. */
  allowPilot: boolean;
  /** Maximum pilot budget the prospect can ever commit to, in dollars. */
  maxPilotBudget: number;
  /** Facts required before a pilot. */
  pilotRequiresFactsUnlocked: number;
  /** Whether the prospect may agree to accelerate their timeline. */
  allowTimelineChange: boolean;
  /** Hard ceiling on total approved concessions in one call. */
  maxConcessionsTotal: number;
}

export interface ConcessionContext {
  patience: number;
  factsUnlockedCount: number;
  approvedConcessionCount: number;
}

export type ConcessionVerdict =
  | { approved: true }
  | { approved: false; reason: string };

export interface ConcessionLogEntry {
  turnIdx: number;
  request: ConcessionRequest;
  verdict: ConcessionVerdict;
}

// ── Grading / citation gate ──────────────────────────────────────────────────

export const COACHING_SEVERITIES = ["critical", "major", "minor"] as const;
export type CoachingSeverity = (typeof COACHING_SEVERITIES)[number];

/** A coaching point exactly as the grader model emitted it — untrusted. */
export interface RawCoachingPoint {
  methodologyEntryNumber: string;
  transcriptQuote: string;
  /** Index into the call's turns that the quote allegedly comes from. */
  turnIdx: number;
  comment: string;
  severity: CoachingSeverity;
}

export interface MethodologyEntryRef {
  id: string;
  number: string;
  title: string;
  text: string;
}

export interface TranscriptTurnRef {
  idx: number;
  /** "system" rows are wait/annotation markers on async channels. */
  speaker: "rep" | "prospect" | "system";
  text: string;
}

/** A coaching point that survived the citation gate. */
export interface GatedCoachingPoint extends RawCoachingPoint {
  methodologyEntryId: string;
  methodologyEntryTitle: string;
  methodologyEntryText: string;
}

export const DROP_REASONS = [
  "unknown_entry",
  "bad_turn_ref",
  "quote_not_found",
] as const;

export type DropReason = (typeof DROP_REASONS)[number];

export interface DroppedCoachingPoint {
  point: RawCoachingPoint;
  reason: DropReason;
}

export interface CitationGateResult {
  kept: GatedCoachingPoint[];
  dropped: DroppedCoachingPoint[];
}

// ── Call outcome ─────────────────────────────────────────────────────────────

export const CALL_OUTCOMES = [
  "hung_up",
  "meeting_booked",
  "rep_ended",
  /** Async channels: the prospect stopped replying for good. */
  "ghosted",
  /** Async channels: explicit STOP / unsubscribe / block. */
  "opted_out",
] as const;

export type CallOutcome = (typeof CALL_OUTCOMES)[number];
