import type {
  LanguageModelV4CallOptions,
  LanguageModelV4Message,
} from "@ai-sdk/provider";

/**
 * Helpers for the deterministic mock models: extract plain text from a
 * LanguageModelV4 prompt without caring about part variants we don't use.
 */

export function systemText(options: LanguageModelV4CallOptions): string {
  return options.prompt
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n");
}

function messageText(message: LanguageModelV4Message): string {
  if (message.role === "system") return message.content;
  const chunks: string[] = [];
  for (const part of message.content) {
    if (typeof part === "object" && part !== null && "type" in part) {
      if (part.type === "text") {
        chunks.push(part.text);
      }
    }
  }
  return chunks.join("\n");
}

/** The last user-role message's text (the rep's most recent line). */
export function lastUserText(options: LanguageModelV4CallOptions): string {
  for (let i = options.prompt.length - 1; i >= 0; i--) {
    const message = options.prompt[i];
    if (message.role === "user") return messageText(message);
  }
  return "";
}

/**
 * Finds the most recent `concede` tool result in the prompt (present when the
 * model is called again after the engine ruled on a concession request).
 * Returns the serialized verdict, or null when no tool result exists.
 */
export function lastConcedeToolResult(
  options: LanguageModelV4CallOptions,
): { approvedish: boolean; raw: string } | null {
  for (let i = options.prompt.length - 1; i >= 0; i--) {
    const message = options.prompt[i];
    if (message.role === "user") break; // only look after the last user turn
    if (message.role !== "tool") continue;
    for (const part of message.content) {
      if (part.type === "tool-result" && part.toolName === "concede") {
        const raw = JSON.stringify(part.output);
        return { approvedish: raw.includes('"approved":true'), raw };
      }
    }
  }
  return null;
}
