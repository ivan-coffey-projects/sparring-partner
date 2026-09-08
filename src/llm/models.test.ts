import { afterEach, describe, expect, it } from "vitest";
import {
  compatibleEndpoint,
  fallbackEndpoint,
  fallbackModelId,
  modelIdFor,
} from "@/llm/models";

const KEYS = [
  "SP_PROSPECT_MODEL",
  "SP_PROSPECT_BASE_URL",
  "SP_PROSPECT_API_KEY",
  "SP_OPENAI_COMPATIBLE_BASE_URL",
  "SP_OPENAI_COMPATIBLE_API_KEY",
  "SP_FALLBACK_MODEL",
  "SP_FALLBACK_API_KEY",
  "SP_FALLBACK_BASE_URL",
] as const;

const saved: Record<string, string | undefined> = {};

afterEach(() => {
  for (const key of KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

function snapshot() {
  for (const key of KEYS) saved[key] = process.env[key];
}

describe("compatibleEndpoint", () => {
  it("lets a per-role key override the shared compatible key", () => {
    snapshot();
    process.env.SP_OPENAI_COMPATIBLE_BASE_URL = "http://127.0.0.1:3100/v1";
    process.env.SP_OPENAI_COMPATIBLE_API_KEY = "shared-key";
    process.env.SP_PROSPECT_API_KEY = "role-key";
    process.env.SP_PROSPECT_BASE_URL = "http://127.0.0.1:3100/v1";
    const endpoint = compatibleEndpoint("prospect");
    expect(endpoint.apiKey).toBe("role-key");
    expect(endpoint.baseURL).toBe("http://127.0.0.1:3100/v1");
  });

  it("uses the shared compatible key when no role key is set", () => {
    snapshot();
    delete process.env.SP_PROSPECT_API_KEY;
    process.env.SP_OPENAI_COMPATIBLE_API_KEY = "shared-key";
    process.env.SP_OPENAI_COMPATIBLE_BASE_URL = "http://127.0.0.1:3100/v1";
    expect(compatibleEndpoint("grader").apiKey).toBe("shared-key");
  });
});

describe("modelIdFor", () => {
  it("reads SP_<ROLE>_MODEL", () => {
    snapshot();
    process.env.SP_PROSPECT_MODEL = "custom-prospect-model";
    expect(modelIdFor("prospect")).toBe("custom-prospect-model");
  });
});

describe("fallbackEndpoint", () => {
  it("prefers the fallback key over the shared compatible key", () => {
    snapshot();
    process.env.SP_OPENAI_COMPATIBLE_API_KEY = "shared-key";
    process.env.SP_FALLBACK_API_KEY = "fallback-key";
    expect(fallbackEndpoint().apiKey).toBe("fallback-key");
  });

  it("has no fallback model unless one is configured", () => {
    snapshot();
    delete process.env.SP_FALLBACK_MODEL;
    expect(fallbackModelId()).toBeUndefined();
  });
});
