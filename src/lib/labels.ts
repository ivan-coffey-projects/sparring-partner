import type { CallOutcome, Channel } from "@/engine/types";

/** Short UI label for a channel. */
export function channelLabel(channel: Channel): string {
  switch (channel) {
    case "call":
      return "Phone call";
    case "sms":
      return "Text (SMS)";
    case "email":
      return "Email";
    case "dm_instagram":
      return "Instagram DM";
    case "dm_linkedin":
      return "LinkedIn DM";
    default: {
      const exhaustive: never = channel;
      throw new Error(`Unhandled channel: ${String(exhaustive)}`);
    }
  }
}

/** Prose noun for a channel, for prompts and sentences. */
export function channelNoun(channel: Channel): string {
  switch (channel) {
    case "call":
      return "a phone call";
    case "sms":
      return "text message (SMS)";
    case "email":
      return "email";
    case "dm_instagram":
      return "Instagram direct messages";
    case "dm_linkedin":
      return "LinkedIn direct messages";
    default: {
      const exhaustive: never = channel;
      throw new Error(`Unhandled channel: ${String(exhaustive)}`);
    }
  }
}

export function outcomeLabel(outcome: CallOutcome | null): string {
  if (outcome === null) return "In progress";
  switch (outcome) {
    case "meeting_booked":
      return "Meeting booked";
    case "hung_up":
      return "They hung up";
    case "rep_ended":
      return "You ended it";
    case "ghosted":
      return "They went dark";
    case "opted_out":
      return "They opted out";
    default: {
      const exhaustive: never = outcome;
      throw new Error(`Unhandled outcome: ${String(exhaustive)}`);
    }
  }
}
