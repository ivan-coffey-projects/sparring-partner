/**
 * Machine-readable JSON blocks embedded in prompts. Real models read them as
 * structured context; the deterministic mock models parse them to behave
 * consistently with the engine. One prompt, two audiences.
 */

export function embedStateBlock(tag: string, value: unknown): string {
  return `<${tag}>\n${JSON.stringify(value, null, 2)}\n</${tag}>`;
}

export function parseStateBlock<T>(text: string, tag: string): T | null {
  const match = text.match(new RegExp(`<${tag}>\\s*([\\s\\S]*?)\\s*</${tag}>`));
  if (!match) return null;
  try {
    return JSON.parse(match[1]) as T;
  } catch {
    return null;
  }
}

// ── Block payloads ───────────────────────────────────────────────────────────

/** Embedded in the prospect system prompt. NEVER contains locked truths. */
export interface ProspectStateBlock {
  prospectName: string;
  /** Which channel this conversation happens on ("call" for phone). */
  channel: string;
  band: "engaged" | "cooling" | "impatient";
  patience: number;
  unlockedFacts: Array<{ label: string; topic: string; truth: string }>;
  lockedFacts: Array<{ label: string; topic: string; politeLie: string }>;
  /** Labels of facts that unlocked THIS turn — surface them naturally. */
  justUnlocked: string[];
}

export const PROSPECT_STATE_TAG = "sp-call-state";

/** Embedded in the analyzer system prompt (analyzer never speaks to the rep). */
export interface AnalyzerStateBlock {
  facts: Array<{ topic: string; label: string; truth: string }>;
  /** Present for async written channels: what the analyzer must also read. */
  writtenContext?: {
    channel: string;
    isFirstTouch: boolean;
    isFollowUpIntoSilence: boolean;
  };
}

export const ANALYZER_STATE_TAG = "sp-analyzer-state";

/** Embedded in the grader prompt. */
export interface GraderStateBlock {
  turns: Array<{ idx: number; speaker: "rep" | "prospect" | "system"; text: string }>;
  /** The channel the conversation happened on. */
  channel: string;
  entries: Array<{ number: string; title: string }>;
  criteria: Array<{
    criterionId: string;
    label: string;
    methodologyEntryNumbers: string[];
  }>;
  events: GraderEngineEvent[];
  outcome: string;
  factsUnlocked: number;
  factsTotal: number;
}

export const GRADER_STATE_TAG = "sp-grading-state";

/** Engine-observed events handed to the grader as ground truth. */
export type GraderEngineEvent =
  | { kind: "monologue"; turnIdx: number; wordCount: number }
  | { kind: "early_pitch"; turnIdx: number }
  | { kind: "blunt_question"; turnIdx: number }
  | { kind: "stacked_questions"; turnIdx: number }
  | { kind: "pressure"; turnIdx: number }
  | { kind: "accurate_reflection"; turnIdx: number; topic: string }
  | { kind: "fact_unlocked"; turnIdx: number; label: string }
  | { kind: "concession_rejected"; turnIdx: number; reason: string }
  | { kind: "concession_approved"; turnIdx: number; concessionType: string }
  | { kind: "hang_up"; turnIdx: number }
  // Async written channels (engagement engine):
  | { kind: "wall_of_text"; turnIdx: number; charCount: number }
  | { kind: "pitch_first_touch"; turnIdx: number }
  | { kind: "no_question"; turnIdx: number }
  | { kind: "multi_cta"; turnIdx: number }
  | { kind: "spam_signals"; turnIdx: number }
  | { kind: "self_focused"; turnIdx: number }
  | { kind: "guilt_trip"; turnIdx: number }
  | { kind: "too_soon_follow_up"; turnIdx: number }
  | { kind: "no_new_value"; turnIdx: number }
  | { kind: "relevant_personalization"; turnIdx: number }
  | { kind: "clear_cta"; turnIdx: number }
  | { kind: "patient_follow_up"; turnIdx: number }
  /** The prospect stayed silent after this rep message. */
  | { kind: "no_reply"; turnIdx: number }
  /** The rep let simulated time pass before acting again. */
  | { kind: "waited"; turnIdx: number; minutes: number }
  | { kind: "ghosted"; turnIdx: number }
  | { kind: "opted_out"; turnIdx: number };
