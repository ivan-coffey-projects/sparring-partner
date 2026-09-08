import type { UIMessage } from "ai";
import type {
  CallOutcome,
  ConcessionType,
  PatienceBand,
  PatienceDelta,
} from "@/engine/types";

/** Data parts streamed alongside the prospect's reply. */
export interface TurnMetaData {
  patience: number;
  band: PatienceBand;
  deltas: PatienceDelta[];
  unlocked: Array<{ id: string; label: string }>;
  factsUnlockedCount: number;
  factsTotal: number;
}

export interface CallStatusData {
  status: "live" | "ended";
  outcome: CallOutcome | null;
}

export interface ConcessionData {
  concessionType: ConcessionType;
  approved: boolean;
}

export type SparringDataParts = {
  "turn-meta": TurnMetaData;
  "call-status": CallStatusData;
  concession: ConcessionData;
};

export type SparringUIMessage = UIMessage<unknown, SparringDataParts>;

/** Extracts the plain text of a UI message (rep input or prospect reply). */
export function uiMessageText(message: SparringUIMessage): string {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");
}
