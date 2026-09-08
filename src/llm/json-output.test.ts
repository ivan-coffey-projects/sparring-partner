import { describe, expect, it } from "vitest";
import { z } from "zod";
import { extractJsonObject, parseJsonObject } from "@/llm/json-output";

describe("extractJsonObject", () => {
  it("reads a fenced json block", () => {
    expect(extractJsonObject('noise\n```json\n{"a":1}\n```\n')).toEqual({ a: 1 });
  });

  it("reads a bare object with preamble", () => {
    expect(extractJsonObject('Sure.\n{"ok":true}')).toEqual({ ok: true });
  });
});

describe("parseJsonObject", () => {
  it("validates with zod", () => {
    const schema = z.object({ ok: z.boolean() });
    expect(parseJsonObject('{"ok":true}', schema)).toEqual({ ok: true });
  });
});
