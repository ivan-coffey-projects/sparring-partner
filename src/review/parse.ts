import type { ReviewTurnRecord } from "@/db/schema";

/**
 * Deterministic, code-only artifact parser. The user labels each message with
 * a speaker prefix ("Rep:", "Me:", "Them:", "Prospect:", a name…); rep-side
 * aliases map to `rep`, bracketed lines to `system`, everything else to
 * `prospect`. Unlabeled lines continue the previous message, so a pasted
 * email body keeps its paragraphs. Every turn's text is reproduced verbatim
 * from the paste — the citation gate depends on that.
 */

const REP_ALIASES = new Set([
  "rep",
  "me",
  "sales",
  "seller",
  "sdr",
  "ae",
  "agent",
  "you",
]);

const LABEL_PATTERN = /^([A-Za-z][A-Za-z0-9 .'’_-]{0,30}?)\s*[:>]\s?(.*)$/;

export interface ParsedArtifact {
  turns: ReviewTurnRecord[];
  /** Label → speaker mapping actually used, for display/debugging. */
  labels: Record<string, "rep" | "prospect">;
}

export class ArtifactParseError extends Error {}

export function parseArtifact(rawText: string): ParsedArtifact {
  const lines = rawText.replace(/\r\n/g, "\n").split("\n");
  const turns: ReviewTurnRecord[] = [];
  const labels: Record<string, "rep" | "prospect"> = {};
  // Held in an object so narrowing survives the closure assignments below.
  const state: {
    current: ReviewTurnRecord | null;
    pendingSubject: string | null;
  } = { current: null, pendingSubject: null };

  const flush = () => {
    if (state.current && state.current.text.trim().length > 0) {
      state.current.text = state.current.text.trim();
      turns.push(state.current);
    }
    state.current = null;
  };

  const open = (speaker: ReviewTurnRecord["speaker"], text: string) => {
    const withSubject =
      state.pendingSubject !== null ? `${state.pendingSubject}\n${text}` : text;
    state.pendingSubject = null;
    state.current = { idx: turns.length, speaker, text: withSubject };
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;

    // Bracketed annotations become system turns: "[2 days later]".
    if (/^\[.*\]$/.test(trimmed)) {
      flush();
      turns.push({ idx: turns.length, speaker: "system", text: trimmed });
      continue;
    }

    const match = trimmed.match(LABEL_PATTERN);
    if (match) {
      const rawLabel = match[1].trim();
      const key = rawLabel.toLowerCase();
      // "Subject" is email metadata, not a speaker — keep it inside the
      // message it belongs to so subject-line coaching can cite it.
      if (key === "subject") {
        if (state.current) {
          state.current.text += `\n${trimmed}`;
        } else {
          state.pendingSubject = trimmed;
        }
        continue;
      }
      const speaker: "rep" | "prospect" = REP_ALIASES.has(key)
        ? "rep"
        : (labels[rawLabel] ?? "prospect");
      labels[rawLabel] = speaker;
      flush();
      open(speaker, match[2] ?? "");
      continue;
    }

    // Continuation of the previous message.
    if (state.current) {
      state.current.text += `\n${trimmed}`;
    } else {
      // Leading unlabeled content: assume the artifact opens with the rep
      // (a cold email/text usually does).
      open("rep", trimmed);
    }
  }
  flush();

  // Re-index after flushing (system turns already claimed indices).
  turns.forEach((turn, i) => {
    turn.idx = i;
  });

  if (turns.length === 0) {
    throw new ArtifactParseError("Nothing to review — the paste is empty.");
  }
  if (!turns.some((t) => t.speaker === "rep")) {
    throw new ArtifactParseError(
      'No rep messages found. Prefix your own messages with "Rep:" or "Me:".',
    );
  }
  return { turns, labels };
}
