import { generateText } from "ai";
import type { HiddenFactDefinition, MoveAnalysis } from "@/engine/types";
import { moveAnalysisSchema } from "@/llm/schemas";
import { parseJsonObject } from "@/llm/json-output";
import { callWithFallback } from "@/llm/with-fallback";
import {
  ANALYZER_STATE_TAG,
  embedStateBlock,
  type AnalyzerStateBlock,
} from "@/llm/state-blocks";

export interface TranscriptLine {
  speaker: "rep" | "prospect";
  text: string;
}

/** Extra context for analyzing a written (async-channel) rep message. */
export interface WrittenContext {
  channel: string;
  isFirstTouch: boolean;
  isFollowUpIntoSilence: boolean;
}

/**
 * Classifies the rep's latest move. The analyzer is the only model that sees
 * the full hidden file mid-call — it never produces prospect speech, so it
 * cannot leak. Its output feeds the deterministic engine, which makes every
 * decision that matters.
 */
export async function analyzeRepMove(
  facts: HiddenFactDefinition[],
  transcript: TranscriptLine[],
  repMessage: string,
  writtenContext?: WrittenContext,
): Promise<MoveAnalysis> {
  const stateBlock: AnalyzerStateBlock = {
    facts: facts.map((f) => ({
      topic: f.topic,
      label: f.label,
      truth: f.truth,
    })),
    ...(writtenContext ? { writtenContext } : {}),
  };

  const jsonShape = writtenContext
    ? 'JSON shape: {"moveTypes":["open_question"|"closed_question"|"blunt_qualifying"|"reflection"|"rapport"|"pitch"|"concession_request"|"close_attempt"|"other",...],"reflectionTargets":[{"topic":"string","accuracy":0}],"pitchDetected":false,"pressure":0,"written":{"relevance":0,"addsNewValue":true,"ctaCount":0,"ctaType":"none"|"interest"|"meeting_time"|"question"|"resource"}}'
    : 'JSON shape: {"moveTypes":["open_question"|"closed_question"|"blunt_qualifying"|"reflection"|"rapport"|"pitch"|"concession_request"|"close_attempt"|"other",...],"reflectionTargets":[{"topic":"string","accuracy":0}],"pitchDetected":false,"pressure":0}';

  const system = [
    writtenContext
      ? `You are a silent sales-message analyst. The rep is messaging a prospect over ${writtenContext.channel}. Classify the rep's latest message.`
      : "You are a silent sales-call analyst. Classify the sales rep's latest message.",
    "You know the prospect's ACTUAL situation (their hidden file, below).",
    "Score `reflectionTargets` accuracy by comparing what the rep reflected against the hidden truths — not against what the prospect has said out loud.",
    "A reflection is any attempt to restate/label the prospect's situation ('sounds like…', 'it seems…').",
    "A blunt_qualifying move is a cold budget/authority/timeline question asked without having earned it.",
    ...(writtenContext
      ? [
          "Also produce the `written` object:",
          "- relevance: how specifically the message ties to THIS prospect's actual world (their company, role, situation). Token flattery and generic compliments score LOW; a correct, load-bearing reference to their reality scores HIGH.",
          "- addsNewValue: for follow-ups, whether the message brings anything the prospect didn't already have. A bare bump is false.",
          "- ctaCount/ctaType: how many distinct asks, and the primary one (interest = 'worth a look?' style permission ask; meeting_time = a concrete calendar/time ask).",
        ]
      : []),
    "Respond with a JSON object only — no markdown, no preamble.",
    jsonShape,
    "moveTypes must contain at least one value. accuracy and pressure are 0..1.",
    "",
    embedStateBlock(ANALYZER_STATE_TAG, stateBlock),
  ].join("\n");

  const conversation = transcript
    .map((line) => `${line.speaker === "rep" ? "REP" : "PROSPECT"}: ${line.text}`)
    .join("\n");

  const { value } = await callWithFallback("analyzer", async (model) => {
    const { text } = await generateText({
      model,
      maxOutputTokens: 2048,
      system,
      messages: [
        {
          role: "user",
          content: `Conversation so far:\n${conversation || "(call just started)"}\n\nClassify the rep's latest message:\n${repMessage}`,
        },
      ],
    });
    return parseJsonObject(text, moveAnalysisSchema);
  });

  return value;
}
