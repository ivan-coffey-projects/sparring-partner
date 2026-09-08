import type { z } from "zod";

/** Pull the first JSON object out of a model reply (raw or fenced). */
export function extractJsonObject(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = (fenced?.[1] ?? text).trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new Error("No JSON object in model output.");
  }
  return JSON.parse(raw.slice(start, end + 1)) as unknown;
}

export function parseJsonObject<T>(text: string, schema: z.ZodType<T>): T {
  return schema.parse(extractJsonObject(text));
}
