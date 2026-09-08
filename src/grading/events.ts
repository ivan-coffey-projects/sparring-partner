import type { callTurns, calls } from "@/db/schema";
import type { GraderEngineEvent } from "@/llm/state-blocks";

type CallRow = typeof calls.$inferSelect;
type TurnRow = typeof callTurns.$inferSelect;

/**
 * Reconstructs the engine's ground-truth event log from persisted turn
 * analysis records. The grader receives these as facts it can lean on — it
 * still must cite the transcript for every point it makes.
 */
export function deriveEngineEvents(
  call: CallRow,
  turns: TurnRow[],
  factLabelsById: Map<string, string>,
): GraderEngineEvent[] {
  const events: GraderEngineEvent[] = [];

  for (const turn of turns) {
    if (turn.speaker !== "rep" || !turn.analysis) continue;
    const { analysis, patienceDeltas, newlyUnlockedFactIds } = turn.analysis;

    for (const delta of patienceDeltas) {
      switch (delta.reason) {
        case "monologue":
          events.push({
            kind: "monologue",
            turnIdx: turn.idx,
            wordCount: turn.analysis.metrics.wordCount,
          });
          break;
        case "early_pitch":
          events.push({ kind: "early_pitch", turnIdx: turn.idx });
          break;
        case "blunt_question":
          events.push({ kind: "blunt_question", turnIdx: turn.idx });
          break;
        case "stacked_questions":
          events.push({ kind: "stacked_questions", turnIdx: turn.idx });
          break;
        case "pressure":
          events.push({ kind: "pressure", turnIdx: turn.idx });
          break;
        case "accurate_reflection":
        case "open_question":
          // Positive deltas are covered below via reflectionTargets.
          break;
        case "wall_of_text":
          events.push({
            kind: "wall_of_text",
            turnIdx: turn.idx,
            charCount: turn.text.trim().length,
          });
          break;
        case "pitch_first_touch":
        case "no_question":
        case "multi_cta":
        case "spam_signals":
        case "self_focused":
        case "guilt_trip":
        case "too_soon_follow_up":
        case "no_new_value":
        case "relevant_personalization":
        case "clear_cta":
        case "patient_follow_up":
          events.push({ kind: delta.reason, turnIdx: turn.idx });
          break;
        default: {
          const exhaustive: never = delta.reason;
          throw new Error(`Unhandled delta reason: ${String(exhaustive)}`);
        }
      }
    }

    for (const target of analysis.reflectionTargets) {
      if (target.accuracy >= 0.6) {
        events.push({
          kind: "accurate_reflection",
          turnIdx: turn.idx,
          topic: target.topic,
        });
      }
    }

    for (const factId of newlyUnlockedFactIds) {
      events.push({
        kind: "fact_unlocked",
        turnIdx: turn.idx,
        label: factLabelsById.get(factId) ?? "Unknown fact",
      });
    }
  }

  for (const entry of call.concessionLog) {
    if (entry.verdict.approved) {
      events.push({
        kind: "concession_approved",
        turnIdx: entry.turnIdx,
        concessionType: entry.request.type,
      });
    } else {
      events.push({
        kind: "concession_rejected",
        turnIdx: entry.turnIdx,
        reason: entry.verdict.reason,
      });
    }
  }

  // Async cadence ground truth: waits, unanswered rep messages, terminals.
  for (const turn of turns) {
    if (turn.speaker === "system" && turn.meta?.waitedMinutes !== undefined) {
      events.push({
        kind: "waited",
        turnIdx: turn.idx,
        minutes: turn.meta.waitedMinutes,
      });
    }
    if (turn.speaker === "rep") {
      const followers = turns.filter(
        (t) => t.idx > turn.idx && t.speaker !== "system",
      );
      const answered = followers.some((t) => t.speaker === "prospect");
      const laterRepTurn = followers.some((t) => t.speaker === "rep");
      // Only flag silence that the rep actually experienced (a later rep
      // message exists, or the thread ended unanswered).
      if (!answered && (laterRepTurn || call.status === "ended")) {
        events.push({ kind: "no_reply", turnIdx: turn.idx });
      }
    }
  }

  const lastRepTurn = [...turns].reverse().find((t) => t.speaker === "rep");
  if (lastRepTurn) {
    if (call.outcome === "hung_up") {
      events.push({ kind: "hang_up", turnIdx: lastRepTurn.idx });
    } else if (call.outcome === "ghosted") {
      events.push({ kind: "ghosted", turnIdx: lastRepTurn.idx });
    } else if (call.outcome === "opted_out") {
      events.push({ kind: "opted_out", turnIdx: lastRepTurn.idx });
    }
  }

  return events.sort((a, b) => a.turnIdx - b.turnIdx);
}
