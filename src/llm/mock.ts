/**
 * Deterministic mock models (SP_MOCK_LLM=1). They implement the same
 * LanguageModelV4 contract as real providers, but compute their replies from
 * the prompt with plain heuristics. They power automated tests and keyless
 * demos — the engine (patience, unlocks, caps, citations) behaves identically
 * either way, because the engine never lives in the model.
 */
import type {
  LanguageModelV4,
  LanguageModelV4CallOptions,
  LanguageModelV4GenerateResult,
  LanguageModelV4StreamPart,
  LanguageModelV4Usage,
} from "@ai-sdk/provider";
import type { MoveAnalysisOutput, GraderOutput } from "@/llm/schemas";
import {
  ANALYZER_STATE_TAG,
  GRADER_STATE_TAG,
  PROSPECT_STATE_TAG,
  parseStateBlock,
  type AnalyzerStateBlock,
  type GraderEngineEvent,
  type GraderStateBlock,
  type ProspectStateBlock,
} from "@/llm/state-blocks";
import {
  lastConcedeToolResult,
  lastUserText,
  systemText,
} from "@/llm/prompt-text";
import { findGuiltTripPhrases } from "@/engine/written-metrics";
import type { MoveType, WrittenAnalysis } from "@/engine/types";

const ZERO_USAGE: LanguageModelV4Usage = {
  inputTokens: {
    total: undefined,
    noCache: undefined,
    cacheRead: undefined,
    cacheWrite: undefined,
  },
  outputTokens: { total: undefined, text: undefined, reasoning: undefined },
};

interface MockReply {
  text?: string;
  toolCall?: { toolName: string; input: string };
}

/** Builds a LanguageModelV4 whose replies are computed from the prompt. */
export function defineMockModel(
  modelId: string,
  compute: (options: LanguageModelV4CallOptions) => MockReply,
): LanguageModelV4 {
  function toResult(reply: MockReply): LanguageModelV4GenerateResult {
    const content: LanguageModelV4GenerateResult["content"] = [];
    if (reply.toolCall) {
      content.push({
        type: "tool-call",
        toolCallId: `mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        toolName: reply.toolCall.toolName,
        input: reply.toolCall.input,
      });
    }
    if (reply.text !== undefined) {
      content.push({ type: "text", text: reply.text });
    }
    return {
      content,
      finishReason: reply.toolCall
        ? { unified: "tool-calls", raw: undefined }
        : { unified: "stop", raw: undefined },
      usage: ZERO_USAGE,
      warnings: [],
    };
  }

  return {
    specificationVersion: "v4",
    provider: "sparring-mock",
    modelId,
    supportedUrls: {},
    doGenerate: async (options) => toResult(compute(options)),
    doStream: async (options) => {
      const result = toResult(compute(options));
      const parts: LanguageModelV4StreamPart[] = [
        { type: "stream-start", warnings: [] },
      ];
      for (const item of result.content) {
        if (item.type === "text") {
          parts.push({ type: "text-start", id: "t1" });
          for (const word of item.text.split(/(?<= )/)) {
            parts.push({ type: "text-delta", id: "t1", delta: word });
          }
          parts.push({ type: "text-end", id: "t1" });
        } else if (item.type === "tool-call") {
          parts.push(item);
        }
      }
      parts.push({
        type: "finish",
        finishReason: result.finishReason,
        usage: ZERO_USAGE,
      });
      return {
        stream: new ReadableStream<LanguageModelV4StreamPart>({
          start(controller) {
            for (const part of parts) controller.enqueue(part);
            controller.close();
          },
        }),
      };
    },
  };
}

// ── Shared text heuristics ───────────────────────────────────────────────────

const REFLECTION_PATTERN =
  /\b(sounds like|it sounds|seems like|it seems|if i('| a)m (hearing|reading)|so you('| a)re|let me make sure|reading between the lines|my sense is)\b/i;
const BLUNT_PATTERN =
  /\b(what('| i)s (your|the) budget|how much (budget|money)|who (signs|approves|makes the (final )?decision)|who('| i)s the decision[- ]maker|what('| i)s your timeline|when are you (buying|deciding)|do you have (a )?budget)\b/i;
const PITCH_PATTERN =
  /\b(our (product|platform|solution|software|engine|tool)|we (offer|provide|built|deliver)|let me (show|tell) you (about )?|our customers (love|see)|best[- ]in[- ]class|market[- ]leading)\b/i;
const OPEN_QUESTION_PATTERN =
  /\b(how|what|why|walk me through|tell me about|help me understand|talk me through|paint me a picture)\b/i;
const RAPPORT_PATTERN =
  /\b(thanks for (taking|making)|appreciate (you|the)|hope you('| a)re|good (morning|afternoon)|congrats)\b/i;
const CONCESSION_ASK_PATTERN =
  /\b(book|schedule|set up|put) (a|some|the)? ?(meeting|call|time|demo)|calendar|next (step|week)|worth (a|another) (conversation|call)|30 minutes|15 minutes|follow[- ]up call\b/i;
const INTRO_ASK_PATTERN =
  /\b(introduce me|intro to|connect me|loop in|bring in) (to )?(your|the)? ?(cfo|boss|team|finance|exec)|\bmeet (your|the) (cfo|cto|ceo|vp)\b/i;
const PRESSURE_PATTERN =
  /\b(need an answer|sign (today|now)|today only|last chance|expires|be honest with me|i('| wi)ll be blunt|you('| a)re losing money every day)\b/i;

const TOPIC_SYNONYMS: Record<string, RegExp> = {
  budget: /\b(budget|spend|pricing|price|cost you|dollars|funding)\b/i,
  authority:
    /\b(decision|sign[- ]?off|signs|approve|cfo|finance|stakeholder|committee|boss)\b/i,
  incumbent:
    /\b(current (system|tool|vendor|setup)|existing (system|tool)|today|routemaster|spreadsheet|workaround|shadow)\b/i,
  timeline: /\b(timeline|deadline|when|peak season|quarter|renewal|contract)\b/i,
  pain_cost:
    /\b(cost|costing|impact|pain|losing|lost loads|mis[- ]?rout|churn|quit|manual|5 ?am|re[- ]?plan)\b/i,
};

function topicMatches(topic: string, label: string, message: string): boolean {
  const lower = message.toLowerCase();
  if (lower.includes(topic.toLowerCase())) return true;
  const synonym = TOPIC_SYNONYMS[topic];
  if (synonym && synonym.test(message)) return true;
  const labelWords = label
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length >= 4);
  return labelWords.some((w) => lower.includes(w));
}

/**
 * Trainers write hidden-fact truths in the third person ("She got burned…");
 * the prospect speaks them in the first person. Real models rephrase
 * naturally — the mock needs a little deterministic grammar surgery.
 */
export function firstPersonize(text: string, prospectName: string): string {
  let result = text;
  const names = [prospectName, prospectName.split(" ")[0]]
    .filter((n) => n.length > 0)
    .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  for (const name of names) {
    result = result.replace(new RegExp(`\\b${name}'s\\b`, "g"), "my");
    result = result.replace(new RegExp(`\\b${name}\\b`, "g"), "I");
  }
  result = result
    .replace(/\b[Ss]he's\b|\b[Hh]e's\b/g, "I'm")
    .replace(/\b[Ss]he\b|\b[Hh]e\b/g, "I")
    .replace(/\bherself\b|\bhimself\b/g, "myself")
    .replace(/\b(her|his)\b/g, "my")
    .replace(/\b(Her|His)\b/g, "My");
  // Crude verb agreement for the swapped pronoun: "I quotes" → "I quote".
  const irregular: Record<string, string> = {
    is: "am",
    was: "was",
    has: "have",
    does: "do",
  };
  result = result.replace(/\bI ([a-z]+)\b/g, (match, verb: string) => {
    if (irregular[verb]) return `I ${irregular[verb]}`;
    if (verb.endsWith("s") && !verb.endsWith("ss") && verb.length > 3) {
      return `I ${verb.slice(0, -1)}`;
    }
    return match;
  });
  return result;
}

/** Signal words from a truth: distinctive tokens a good reflection would echo. */
function signalWords(truth: string): string[] {
  return [
    ...new Set(
      truth
        .toLowerCase()
        .replace(/[^a-z0-9$ ]+/g, " ")
        .split(/\s+/)
        .filter((w) => w.length >= 5),
    ),
  ];
}

// ── Mock analyzer ────────────────────────────────────────────────────────────

export function mockAnalyzerModel(): LanguageModelV4 {
  return defineMockModel("mock-analyzer", (options) => {
    const state = parseStateBlock<AnalyzerStateBlock>(
      systemText(options),
      ANALYZER_STATE_TAG,
    );
    // The analyzer's user prompt ends with the message to classify.
    const fullUserText = lastUserText(options);
    const marker = "Classify the rep's latest message:";
    const markerIdx = fullUserText.lastIndexOf(marker);
    const message =
      markerIdx >= 0
        ? fullUserText.slice(markerIdx + marker.length).trim()
        : fullUserText;
    const lower = message.toLowerCase();

    const moveTypes = new Set<MoveType>();
    const reflectionTargets: MoveAnalysisOutput["reflectionTargets"] = [];

    if (REFLECTION_PATTERN.test(message)) {
      moveTypes.add("reflection");
      for (const fact of state?.facts ?? []) {
        if (!topicMatches(fact.topic, fact.label, message)) continue;
        const signals = signalWords(fact.truth);
        const hits = signals.filter((w) => lower.includes(w)).length;
        reflectionTargets.push({
          topic: fact.topic,
          accuracy: hits >= 2 ? 0.85 : hits === 1 ? 0.75 : 0.5,
        });
      }
    }
    if (BLUNT_PATTERN.test(message)) moveTypes.add("blunt_qualifying");
    const pitchDetected = PITCH_PATTERN.test(message);
    if (pitchDetected) moveTypes.add("pitch");
    if (CONCESSION_ASK_PATTERN.test(message) || INTRO_ASK_PATTERN.test(message)) {
      moveTypes.add("concession_request");
    }
    if (message.includes("?") && !moveTypes.has("blunt_qualifying")) {
      moveTypes.add(
        OPEN_QUESTION_PATTERN.test(message) ? "open_question" : "closed_question",
      );
    }
    if (RAPPORT_PATTERN.test(message)) moveTypes.add("rapport");
    if (moveTypes.size === 0) moveTypes.add("other");

    const pressure = PRESSURE_PATTERN.test(message) ? 0.8 : pitchDetected ? 0.3 : 0.1;

    // Written-channel read, only when the engine asked for it.
    let written: WrittenAnalysis | undefined;
    if (state?.writtenContext) {
      const questionCount = (message.match(/\?/g) ?? []).length;
      const imperativeAsk =
        /\b(book|grab|pick) (a|some) time|calendly|let me know|check (it|this) out\b/i.test(
          message,
        );
      const ctaCount = Math.min(4, questionCount + (imperativeAsk && questionCount === 0 ? 1 : 0));
      const ctaType: WrittenAnalysis["ctaType"] =
        CONCESSION_ASK_PATTERN.test(message)
          ? "meeting_time"
          : /\bworth (a|another|exploring)|open to|interested in (seeing|hearing)\b/i.test(message)
            ? "interest"
            : questionCount > 0
              ? "question"
              : imperativeAsk
                ? "resource"
                : "none";
      const touchesProspectWorld =
        reflectionTargets.length > 0 ||
        (state?.facts ?? []).some((f) => topicMatches(f.topic, f.label, message));
      written = {
        relevance: touchesProspectWorld ? 0.75 : 0.2,
        addsNewValue:
          findGuiltTripPhrases(message).length === 0 &&
          message.trim().split(/\s+/).length > 8,
        ctaCount,
        ctaType,
      };
    }

    const analysis: MoveAnalysisOutput = {
      moveTypes: [...moveTypes],
      reflectionTargets,
      pitchDetected,
      pressure,
      ...(written ? { written } : {}),
    };
    return { text: JSON.stringify(analysis) };
  });
}

// ── Mock prospect ────────────────────────────────────────────────────────────

export function mockProspectModel(): LanguageModelV4 {
  return defineMockModel("mock-prospect", (options) => {
    const state = parseStateBlock<ProspectStateBlock>(
      systemText(options),
      PROSPECT_STATE_TAG,
    );
    const message = lastUserText(options);

    // Phase 2 of a concession: the engine has ruled; speak the verdict.
    const toolResult = lastConcedeToolResult(options);
    if (toolResult) {
      if (toolResult.approvedish) {
        return {
          text: "You know what — yes. Send me a calendar invite for next week and I'll make the time.",
        };
      }
      return {
        text: "I'm going to hold off on that for now. I'm not ready to commit to anything today.",
      };
    }

    // The rep is asking for a commitment → route it through the concede tool.
    if (INTRO_ASK_PATTERN.test(message)) {
      return {
        toolCall: {
          toolName: "concede",
          input: JSON.stringify({ type: "intro" }),
        },
      };
    }
    if (CONCESSION_ASK_PATTERN.test(message)) {
      return {
        toolCall: {
          toolName: "concede",
          input: JSON.stringify({ type: "meeting" }),
        },
      };
    }

    const band = state?.band ?? "engaged";

    const prospectName = state?.prospectName ?? "";

    // Something just unlocked → open up about it, naturally.
    const justUnlocked = state?.justUnlocked ?? [];
    if (justUnlocked.length > 0) {
      const revealed = (state?.unlockedFacts ?? []).filter((f) =>
        justUnlocked.includes(f.label),
      );
      if (revealed.length > 0) {
        const truths = revealed
          .map((f) => firstPersonize(f.truth, prospectName))
          .join(" And honestly? ");
        return {
          text: `…Okay, that's fair. ${truths}`,
        };
      }
    }

    // Asked about a locked topic → the polite lie, word for word.
    for (const fact of state?.lockedFacts ?? []) {
      if (topicMatches(fact.topic, fact.label, message)) {
        return { text: fact.politeLie };
      }
    }

    // Asked about an unlocked topic → candid.
    for (const fact of state?.unlockedFacts ?? []) {
      if (topicMatches(fact.topic, fact.label, message)) {
        return { text: firstPersonize(fact.truth, prospectName) };
      }
    }

    // Generic band-appropriate reply.
    switch (band) {
      case "engaged":
        return {
          text: "Fair question. Day to day it's dispatch juggling load boards and phone calls — where are you going with this?",
        };
      case "cooling":
        return { text: "Okay. I'm listening, but let's keep this moving." };
      case "impatient":
        return { text: "I have eight minutes. Where is this going?" };
      default: {
        const exhaustive: never = band;
        throw new Error(`Unhandled band: ${String(exhaustive)}`);
      }
    }
  });
}

// ── Mock grader ──────────────────────────────────────────────────────────────

const EVENT_ENTRY_MAP: Record<GraderEngineEvent["kind"], string | null> = {
  monologue: "3.2",
  early_pitch: "3.1",
  blunt_question: "5.1",
  stacked_questions: "2.3",
  pressure: "4.1",
  accurate_reflection: "2.1",
  fact_unlocked: "1.2",
  concession_rejected: "4.2",
  concession_approved: null,
  hang_up: null,
  // Written-channel events → the channel-playbook numbering skeleton
  // (1.x opener, 2.x message craft, 3.x cadence, 4.x asks, 5.x discipline).
  wall_of_text: "2.1",
  pitch_first_touch: "1.1",
  no_question: "2.2",
  multi_cta: "4.1",
  spam_signals: "2.4",
  self_focused: "2.3",
  guilt_trip: "3.2",
  too_soon_follow_up: "3.1",
  no_new_value: "3.2",
  relevant_personalization: "2.3",
  clear_cta: "4.1",
  patient_follow_up: "3.1",
  no_reply: null,
  waited: null,
  ghosted: null,
  opted_out: null,
};

function quoteFromTurn(
  turns: GraderStateBlock["turns"],
  turnIdx: number,
): string {
  const turn = turns.find((t) => t.idx === turnIdx);
  if (!turn) return "";
  const words = turn.text.split(/\s+/);
  return words.slice(0, Math.min(words.length, 12)).join(" ");
}

export function mockGraderModel(): LanguageModelV4 {
  return defineMockModel("mock-grader", (options) => {
    const fullText = `${systemText(options)}\n${lastUserText(options)}`;
    const state = parseStateBlock<GraderStateBlock>(fullText, GRADER_STATE_TAG);
    if (!state) {
      return {
        text: JSON.stringify({
          criteria: [],
          coachingPoints: [],
        } satisfies GraderOutput),
      };
    }

    const knownEntryNumbers = new Set(state.entries.map((e) => e.number));

    const coachingPoints: GraderOutput["coachingPoints"] = [];
    for (const event of state.events) {
      const entryNumber = EVENT_ENTRY_MAP[event.kind];
      if (!entryNumber || !knownEntryNumbers.has(entryNumber)) continue;
      const quote = quoteFromTurn(state.turns, event.turnIdx);
      if (!quote) continue;
      switch (event.kind) {
        case "monologue":
          coachingPoints.push({
            methodologyEntryNumber: entryNumber,
            transcriptQuote: quote,
            turnIdx: event.turnIdx,
            comment: `This turn ran ${event.wordCount} words — the prospect stopped listening halfway through. Cut it to one thought and one question.`,
            severity: event.wordCount > 150 ? "critical" : "major",
          });
          break;
        case "early_pitch":
          coachingPoints.push({
            methodologyEntryNumber: entryNumber,
            transcriptQuote: quote,
            turnIdx: event.turnIdx,
            comment:
              "You pitched before any real pain was on the table. The prospect had given you nothing yet — this is where the call started slipping.",
            severity: "major",
          });
          break;
        case "blunt_question":
          coachingPoints.push({
            methodologyEntryNumber: entryNumber,
            transcriptQuote: quote,
            turnIdx: event.turnIdx,
            comment:
              "A cold qualifying question. Notice the answer you got back — that number was a polite fiction. Earn it with a reflection first.",
            severity: "major",
          });
          break;
        case "stacked_questions":
          coachingPoints.push({
            methodologyEntryNumber: entryNumber,
            transcriptQuote: quote,
            turnIdx: event.turnIdx,
            comment:
              "Three questions in one breath reads as a script. Ask one, then wait.",
            severity: "minor",
          });
          break;
        case "pressure":
          coachingPoints.push({
            methodologyEntryNumber: entryNumber,
            transcriptQuote: quote,
            turnIdx: event.turnIdx,
            comment:
              "This is pressure, and the prospect felt it. You can hear the temperature drop in the next reply.",
            severity: "major",
          });
          break;
        case "accurate_reflection":
          coachingPoints.push({
            methodologyEntryNumber: entryNumber,
            transcriptQuote: quote,
            turnIdx: event.turnIdx,
            comment: `Strong reflection on ${event.topic} — this is the move that opened the door. Do this earlier and more often.`,
            severity: "minor",
          });
          break;
        case "concession_rejected":
          coachingPoints.push({
            methodologyEntryNumber: entryNumber,
            transcriptQuote: quote,
            turnIdx: event.turnIdx,
            comment: `You asked for a commitment you hadn't earned yet (${event.reason}). Trade something for it instead.`,
            severity: "major",
          });
          break;
        case "wall_of_text":
          coachingPoints.push({
            methodologyEntryNumber: entryNumber,
            transcriptQuote: quote,
            turnIdx: event.turnIdx,
            comment: `${event.charCount} characters in one message. On this channel that reads as a wall — the reply you didn't get is the evidence.`,
            severity: event.charCount > 600 ? "critical" : "major",
          });
          break;
        case "pitch_first_touch":
          coachingPoints.push({
            methodologyEntryNumber: entryNumber,
            transcriptQuote: quote,
            turnIdx: event.turnIdx,
            comment:
              "You pitched in the opener. On this channel that pattern-matches to spam before the second sentence is read.",
            severity: "critical",
          });
          break;
        case "no_question":
          coachingPoints.push({
            methodologyEntryNumber: entryNumber,
            transcriptQuote: quote,
            turnIdx: event.turnIdx,
            comment:
              "No question, no ask — a message that gives the prospect nothing to reply to usually gets exactly that.",
            severity: "major",
          });
          break;
        case "multi_cta":
          coachingPoints.push({
            methodologyEntryNumber: entryNumber,
            transcriptQuote: quote,
            turnIdx: event.turnIdx,
            comment:
              "More than one ask in a single message. Pick the one that matters and drop the rest.",
            severity: "minor",
          });
          break;
        case "spam_signals":
          coachingPoints.push({
            methodologyEntryNumber: entryNumber,
            transcriptQuote: quote,
            turnIdx: event.turnIdx,
            comment:
              "This wording trips spam filters and human spam-radar alike. Plain language would have landed better.",
            severity: "major",
          });
          break;
        case "self_focused":
          coachingPoints.push({
            methodologyEntryNumber: entryNumber,
            transcriptQuote: quote,
            turnIdx: event.turnIdx,
            comment:
              "This message is mostly about you and your product. Flip the ratio — their world first.",
            severity: "major",
          });
          break;
        case "guilt_trip":
          coachingPoints.push({
            methodologyEntryNumber: entryNumber,
            transcriptQuote: quote,
            turnIdx: event.turnIdx,
            comment:
              "A value-free bump. 'Just following up' is measured to hurt replies — bring something new or wait.",
            severity: "major",
          });
          break;
        case "too_soon_follow_up":
          coachingPoints.push({
            methodologyEntryNumber: entryNumber,
            transcriptQuote: quote,
            turnIdx: event.turnIdx,
            comment:
              "You followed up before the silence had done its work. Crowding the thread reads as pressure on this channel.",
            severity: "major",
          });
          break;
        case "no_new_value":
          coachingPoints.push({
            methodologyEntryNumber: entryNumber,
            transcriptQuote: quote,
            turnIdx: event.turnIdx,
            comment:
              "This follow-up added nothing the prospect didn't already have. Every touch needs a reason to exist.",
            severity: "major",
          });
          break;
        case "relevant_personalization":
          coachingPoints.push({
            methodologyEntryNumber: entryNumber,
            transcriptQuote: quote,
            turnIdx: event.turnIdx,
            comment:
              "This is load-bearing personalization — specific to their world and tied to the reason you're writing. Do this every time.",
            severity: "minor",
          });
          break;
        case "clear_cta":
          coachingPoints.push({
            methodologyEntryNumber: entryNumber,
            transcriptQuote: quote,
            turnIdx: event.turnIdx,
            comment:
              "One clear, low-friction ask — this is what a reply-able message looks like.",
            severity: "minor",
          });
          break;
        case "patient_follow_up":
          coachingPoints.push({
            methodologyEntryNumber: entryNumber,
            transcriptQuote: quote,
            turnIdx: event.turnIdx,
            comment:
              "Well-timed follow-up with something new in it — this is the move that revives quiet threads.",
            severity: "minor",
          });
          break;
        case "fact_unlocked":
        case "concession_approved":
        case "hang_up":
        case "no_reply":
        case "waited":
        case "ghosted":
        case "opted_out":
          break;
        default: {
          const exhaustive: never = event;
          throw new Error(`Unhandled event: ${JSON.stringify(exhaustive)}`);
        }
      }
      if (coachingPoints.length >= 6) break;
    }

    const negativeKinds = new Set([
      "monologue",
      "early_pitch",
      "blunt_question",
      "stacked_questions",
      "pressure",
      "concession_rejected",
      "wall_of_text",
      "pitch_first_touch",
      "no_question",
      "multi_cta",
      "spam_signals",
      "self_focused",
      "guilt_trip",
      "too_soon_follow_up",
      "no_new_value",
    ]);
    const positiveKinds = new Set([
      "accurate_reflection",
      "relevant_personalization",
      "clear_cta",
      "patient_follow_up",
    ]);

    const criteria: GraderOutput["criteria"] = state.criteria.map((criterion) => {
      const relevantEntries = new Set(criterion.methodologyEntryNumbers);
      let score = 4;
      let citedEvent: GraderEngineEvent | null = null;
      for (const event of state.events) {
        const entryNumber = EVENT_ENTRY_MAP[event.kind];
        if (!entryNumber || !relevantEntries.has(entryNumber)) continue;
        if (negativeKinds.has(event.kind)) {
          score -= 1.5;
          if (!citedEvent) citedEvent = event;
        } else if (positiveKinds.has(event.kind)) {
          score += 0.5;
          if (!citedEvent) citedEvent = event;
        }
      }
      score = Math.max(0, Math.min(5, Math.round(score * 2) / 2));
      const entryNumber = citedEvent ? EVENT_ENTRY_MAP[citedEvent.kind] : null;
      const quote = citedEvent
        ? quoteFromTurn(state.turns, citedEvent.turnIdx)
        : "";
      return {
        criterionId: criterion.criterionId,
        score,
        rationale: citedEvent
          ? score >= 4
            ? `Solid on ${criterion.label.toLowerCase()} — the cited moment shows the habit working.`
            : `The cited moment is where ${criterion.label.toLowerCase()} broke down; the pattern repeated through the call.`
          : `No decisive moments observed for ${criterion.label.toLowerCase()} this call.`,
        citation:
          citedEvent && entryNumber && quote
            ? {
                methodologyEntryNumber: entryNumber,
                transcriptQuote: quote,
                turnIdx: citedEvent.turnIdx,
              }
            : null,
      };
    });

    return { text: JSON.stringify({ criteria, coachingPoints }) };
  });
}
