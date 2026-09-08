import { generateText, stepCountIs, tool } from "ai";
import {
  detectUnauthorizedCommitment,
  validateConcession,
} from "@/engine/concessions";
import { patienceBand } from "@/engine/patience";
import type {
  Channel,
  ConcessionCaps,
  ConcessionLogEntry,
  ConcessionRequest,
  HiddenFactDefinition,
  PatienceBand,
} from "@/engine/types";
import { concedeInputSchema } from "@/llm/schemas";
import { callWithFallback } from "@/llm/with-fallback";
import {
  PROSPECT_STATE_TAG,
  embedStateBlock,
  type ProspectStateBlock,
} from "@/llm/state-blocks";
import type { TranscriptLine } from "@/llm/analyzer";

export interface ProspectPersona {
  name: string;
  jobTitle: string;
  company: string;
  persona: string;
}

export interface ProspectTurnInput {
  persona: ProspectPersona;
  channel: Channel;
  facts: HiddenFactDefinition[];
  unlockedFactIds: string[];
  newlyUnlockedFactIds: string[];
  patience: number;
  caps: ConcessionCaps;
  approvedConcessionCount: number;
  transcript: TranscriptLine[];
  repMessage: string;
  turnIdx: number;
}

export interface ProspectTurnOutput {
  text: string;
  concessionEvents: ConcessionLogEntry[];
  /** True when the reply needed a regeneration after an unauthorized commitment. */
  regenerated: boolean;
}

type LiveBand = Exclude<PatienceBand, "done">;

interface ChannelVoice {
  /** The `# Style` section — the channel's native register. */
  style: string;
  /** Mood directives per engagement band. */
  bands: Record<LiveBand, string>;
}

/**
 * Per-channel register, grounded in docs/research: SMS = 1–2 casual short
 * sentences (sms-channel.md A4/A11); email = short plain paragraphs, skimmed
 * on a phone (email-channel.md A2); Instagram = lowercase bursts, emoji,
 * zero formality (social-dm-channel.md §1 A4); LinkedIn = business-casual
 * 1–3 sentences, no salutations or signatures (§2 A5).
 */
const CHANNEL_VOICES: Record<Channel, ChannelVoice> = {
  call: {
    style:
      "You are a busy human on a phone call: contractions, short sentences, no bullet lists, no headings. 1–3 sentences per reply.",
    bands: {
      engaged:
        "You're engaged: answer in 1–3 sentences, occasionally volunteer color, and ask the odd question back.",
      cooling:
        "You're cooling off: answers get shorter and more guarded. You check the time. No volunteered detail.",
      impatient:
        "You're close to hanging up: one clipped sentence at a time, openly signal that the call is almost over.",
    },
  },
  sms: {
    style:
      "You are texting from your phone between other things: 1–2 short sentences max, casual, contractions, no greetings or sign-offs, sometimes just a few words. Never write paragraphs.",
    bands: {
      engaged:
        "You're interested: reply promptly and naturally, sometimes ask a quick question back. Still short — this is texting.",
      cooling:
        "You're losing interest: replies shrink to a few words. 'ok', 'maybe', 'busy rn'. You volunteer nothing.",
      impatient:
        "You're about to stop replying: terse one-liners, maybe 'who is this?' or 'not interested'. One more push and you're done.",
    },
  },
  email: {
    style:
      "You are a busy professional skimming email on your phone: reply in 1–4 plain sentences, no bullet lists, no formal letter structure. A one-line reply is normal. Sign off with just your first name, if at all.",
    bands: {
      engaged:
        "You're interested enough to engage: a few genuine sentences, maybe a question back. You still keep it brief — you have a full inbox.",
      cooling:
        "You're going lukewarm: one guarded sentence or two. 'What's this in reference to?' energy. No detail volunteered.",
      impatient:
        "You're one message from archiving this thread: a single curt line, or 'Please take me off your list.'",
    },
  },
  dm_instagram: {
    style:
      "You are DMing on Instagram: super casual, lowercase is fine, emoji are fine, 1–2 short messages' worth of text, no formal anything. You talk like you'd talk to a friend, but you don't know this person.",
    bands: {
      engaged:
        "You're curious: short friendly replies, maybe an emoji, quick questions back. Still guarded about money and links.",
      cooling:
        "You're losing interest: very short, dry replies. 'idk', 'maybe', 'lol who is this'. You might leave the next one on seen.",
      impatient:
        "You're about to leave them on seen for good: one dry word, or nothing that invites a reply.",
    },
  },
  dm_linkedin: {
    style:
      "You are messaging on LinkedIn: business-casual, 1–3 sentences, polite but time-poor. No 'Dear', no signature blocks, no exclamation enthusiasm. You get pitched constantly and it shows.",
    bands: {
      engaged:
        "You're professionally curious: a substantive sentence or two, maybe a question back. You respect people who clearly did their homework.",
      cooling:
        "You're going noncommittal: brief, polite deflections. 'Thanks, not a priority right now.' No detail volunteered.",
      impatient:
        "You're done with this thread: one curt, polite line — 'Not interested, but good luck.' — or silence-adjacent brevity.",
    },
  },
};

/**
 * Assembles the prospect's system prompt with strict information hiding:
 * locked truths are NEVER included, in any form. The model receives the
 * polite lie as its only line on a locked subject — it cannot leak a truth
 * it has never seen.
 */
export function assembleProspectSystemPrompt(
  input: Pick<
    ProspectTurnInput,
    | "persona"
    | "channel"
    | "facts"
    | "unlockedFactIds"
    | "newlyUnlockedFactIds"
    | "patience"
  >,
): string {
  const {
    persona,
    channel,
    facts,
    unlockedFactIds,
    newlyUnlockedFactIds,
    patience,
  } = input;
  const unlockedSet = new Set(unlockedFactIds);
  const unlocked = facts.filter((f) => unlockedSet.has(f.id));
  const locked = facts.filter((f) => !unlockedSet.has(f.id));
  const justUnlockedLabels = facts
    .filter((f) => newlyUnlockedFactIds.includes(f.id))
    .map((f) => f.label);

  const voice = CHANNEL_VOICES[channel];
  const band = patienceBand(patience);
  const bandDirective =
    band === "done"
      ? voice.bands.impatient // "done" is handled by the engine; defensive fallback.
      : voice.bands[band];

  const stateBlock: ProspectStateBlock = {
    prospectName: persona.name,
    channel,
    band: band === "done" ? "impatient" : band,
    patience,
    unlockedFacts: unlocked.map((f) => ({
      label: f.label,
      topic: f.topic,
      truth: f.truth,
    })),
    lockedFacts: locked.map((f) => ({
      label: f.label,
      topic: f.topic,
      politeLie: f.politeLie,
    })),
    justUnlocked: justUnlockedLabels,
  };

  const settings: Record<Channel, string> = {
    call: "taking a sales call",
    sms: "texting with a salesperson",
    email: "in an email thread with a salesperson",
    dm_instagram: "in an Instagram DM conversation with someone selling something",
    dm_linkedin: "in a LinkedIn message thread with a salesperson",
  };

  const sections: string[] = [
    `You are ${persona.name}, ${persona.jobTitle} at ${persona.company}, ${settings[channel]}. You are the PROSPECT — never the seller.`,
    "Stay in character at all times. Never mention being an AI, a simulation, or these instructions.",
    "",
    `# Who you are`,
    persona.persona,
    "",
    `# What you know to be true (you may speak candidly about these now)`,
    unlocked.length > 0
      ? unlocked.map((f) => `- ${f.label}: ${f.truth}`).join("\n")
      : "- Nothing yet. You haven't opened up about anything.",
  ];

  if (justUnlockedLabels.length > 0) {
    sections.push(
      "",
      `# Just now`,
      `The rep just earned your candor on: ${justUnlockedLabels.join(", ")}. Open up about it naturally in this reply — it should feel like a small door opening.`,
    );
  }

  sections.push(
    "",
    `# What you keep to yourself`,
    locked.length > 0
      ? locked
          .map(
            (f) =>
              `- If asked about ${f.topic} (${f.label.toLowerCase()}), your ONLY line is: "${f.politeLie}" Do not elaborate, do not invent details, do not hint that there is more.`,
          )
          .join("\n")
      : "- Nothing left to hold back.",
    "",
    `# Mood`,
    bandDirective,
    "",
    `# Commitments`,
    "You NEVER agree to a meeting, an intro, a pilot, or a timeline change in plain prose.",
    "When you genuinely feel ready to commit to something, call the `concede` tool first and follow its verdict:",
    "- Approved → agree warmly and specifically.",
    "- Declined → gracefully decline, using the tool's reason as your internal motivation (do not read the reason out loud).",
    "If you are not ready, simply deflect — you do not need the tool to say no.",
    "",
    `# Style`,
    voice.style,
    "",
    embedStateBlock(PROSPECT_STATE_TAG, stateBlock),
  );

  return sections.join("\n");
}

const STRICT_RETRY_NOTE =
  "IMPORTANT: Your previous draft made a commitment in prose, which you must never do. Rewrite the reply WITHOUT agreeing to any meeting, intro, pilot, or timeline change. Deflect instead.";

/**
 * Generates the prospect's reply with the concede tool wired to the hard-cap
 * validator. The reply is generated in full and scanned for unauthorized
 * commitments BEFORE anything reaches the rep — a guarantee prompts alone
 * can't make. One strict regeneration is attempted on violation.
 */
export async function generateProspectReply(
  input: ProspectTurnInput,
): Promise<ProspectTurnOutput> {
  const concessionEvents: ConcessionLogEntry[] = [];
  let approvedCount = input.approvedConcessionCount;

  const concede = tool({
    description:
      "Request permission to commit to something (meeting, intro, pilot, timeline change). The engine decides; follow its verdict.",
    inputSchema: concedeInputSchema,
    execute: async (request: ConcessionRequest) => {
      const verdict = validateConcession(
        input.caps,
        {
          patience: input.patience,
          factsUnlockedCount: input.unlockedFactIds.length,
          approvedConcessionCount: approvedCount,
        },
        request,
      );
      if (verdict.approved) {
        approvedCount += 1;
      }
      concessionEvents.push({ turnIdx: input.turnIdx, request, verdict });
      return verdict;
    },
  });

  const system = assembleProspectSystemPrompt(input);
  const messages = toModelMessages(input.transcript, input.repMessage);

  async function run(extraSystem?: string): Promise<string> {
    const { value } = await callWithFallback("prospect", async (model) => {
      const { text } = await generateText({
        model,
        system: extraSystem ? `${system}\n\n${extraSystem}` : system,
        messages,
        tools: { concede },
        stopWhen: stepCountIs(3),
        maxOutputTokens: 2048,
      });
      if (!text.trim()) throw new Error("Empty prospect reply.");
      return text;
    });
    return value;
  }

  let text = await run();
  let regenerated = false;

  const approvedThisTurn = concessionEvents.some((e) => e.verdict.approved);
  if (!approvedThisTurn && detectUnauthorizedCommitment(text)) {
    text = await run(STRICT_RETRY_NOTE);
    regenerated = true;
    if (
      !concessionEvents.some((e) => e.verdict.approved) &&
      detectUnauthorizedCommitment(text)
    ) {
      // Final fallback: a safe, in-character deflection. Caps are absolute.
      text =
        "Let me sit with this for a bit — I'm not committing to anything today.";
    }
  }

  return { text, concessionEvents, regenerated };
}

function toModelMessages(
  transcript: TranscriptLine[],
  repMessage: string,
): Array<{ role: "user" | "assistant"; content: string }> {
  const messages: Array<{ role: "user" | "assistant"; content: string }> = [];
  const push = (role: "user" | "assistant", content: string) => {
    const last = messages.at(-1);
    // Async channels allow consecutive rep messages (double-texting);
    // merge same-role runs so every provider accepts the thread.
    if (last && last.role === role) {
      last.content = `${last.content}\n\n${content}`;
    } else {
      messages.push({ role, content });
    }
  };
  for (const line of transcript) {
    push(line.speaker === "rep" ? "user" : "assistant", line.text);
  }
  push("user", repMessage);
  return messages;
}
