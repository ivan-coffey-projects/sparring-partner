import { generateText, Output, type LanguageModel } from "ai";
import { graderOutputSchema, type GraderOutput } from "@/llm/schemas";

const GRADER_TIMEOUT_MS = 2 * 60 * 1000;
const GRADER_MAX_OUTPUT_TOKENS = 8192;

/** Generate JSON-mode output, then validate it locally for provider compatibility. */
export async function generateGraderOutput(
  model: LanguageModel,
  system: string,
  userPrompt: string,
): Promise<GraderOutput> {
  const result = await generateText({
    model,
    maxOutputTokens: GRADER_MAX_OUTPUT_TOKENS,
    timeout: { totalMs: GRADER_TIMEOUT_MS },
    output: Output.json({
      name: "sales_grading",
      description: "Citation-backed scores and coaching for a sales conversation.",
    }),
    system,
    messages: [{ role: "user", content: userPrompt }],
  });

  return graderOutputSchema.parse(result.output);
}
