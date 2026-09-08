import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";
import {
  mockAnalyzerModel,
  mockGraderModel,
  mockProspectModel,
} from "@/llm/mock";

export type ModelRole = "prospect" | "analyzer" | "grader";

export type ProviderName = "openai" | "anthropic" | "openai-compatible" | "mock";

const DEFAULT_MODELS: Record<ModelRole, string> = {
  prospect: "gpt-5.2-mini",
  analyzer: "gpt-5.2-mini",
  grader: "gpt-5.2",
};

export function isMockMode(): boolean {
  return process.env.SP_MOCK_LLM === "1";
}

function providerFor(role: ModelRole): ProviderName {
  if (isMockMode()) return "mock";
  const raw =
    process.env[`SP_${role.toUpperCase()}_PROVIDER`] ?? "openai";
  if (
    raw === "openai" ||
    raw === "anthropic" ||
    raw === "openai-compatible" ||
    raw === "mock"
  ) {
    return raw;
  }
  throw new Error(`Unknown provider "${raw}" for role "${role}".`);
}

function envOrUndefined(name: string): string | undefined {
  const value = process.env[name];
  return value && value.length > 0 ? value : undefined;
}

function roleEnv(role: ModelRole, suffix: string): string | undefined {
  return envOrUndefined(`SP_${role.toUpperCase()}_${suffix}`);
}

export function modelIdFor(role: ModelRole): string {
  return roleEnv(role, "MODEL") ?? DEFAULT_MODELS[role];
}

/** OpenAI-compatible endpoint for a role. Per-role settings take precedence. */
export function compatibleEndpoint(role: ModelRole): {
  baseURL: string;
  apiKey: string | undefined;
} {
  const baseURL =
    roleEnv(role, "BASE_URL") ??
    envOrUndefined("SP_OPENAI_COMPATIBLE_BASE_URL") ??
    "";
  const apiKey =
    roleEnv(role, "API_KEY") ??
    envOrUndefined("SP_OPENAI_COMPATIBLE_API_KEY");
  return { baseURL, apiKey };
}

export function fallbackModelId(): string | undefined {
  return envOrUndefined("SP_FALLBACK_MODEL");
}

/** Optional OpenAI-compatible endpoint used when a primary request fails. */
export function fallbackEndpoint(): { baseURL: string; apiKey: string | undefined } {
  const baseURL =
    envOrUndefined("SP_FALLBACK_BASE_URL") ??
    envOrUndefined("SP_OPENAI_COMPATIBLE_BASE_URL") ??
    "";
  const apiKey =
    envOrUndefined("SP_FALLBACK_API_KEY") ??
    envOrUndefined("SP_OPENAI_COMPATIBLE_API_KEY");
  return { baseURL, apiKey };
}

export function resolveFallbackModel(): LanguageModel {
  const { baseURL, apiKey } = fallbackEndpoint();
  const modelId = fallbackModelId();
  if (!baseURL || !apiKey || !modelId) {
    throw new Error(
      "Fallback model requires a model ID, compatible base URL, and API key.",
    );
  }
  return createOpenAICompatible({
    name: "sp-fallback",
    baseURL,
    apiKey,
  })(modelId);
}

function mockModelFor(role: ModelRole): LanguageModel {
  switch (role) {
    case "prospect":
      return mockProspectModel();
    case "analyzer":
      return mockAnalyzerModel();
    case "grader":
      return mockGraderModel();
    default: {
      const exhaustive: never = role;
      throw new Error(`Unhandled role: ${String(exhaustive)}`);
    }
  }
}

/**
 * Resolves the model for a role from environment configuration.
 * SP_MOCK_LLM=1 forces the deterministic mocks for every role.
 */
export function resolveModel(role: ModelRole): LanguageModel {
  const provider = providerFor(role);
  const modelId = modelIdFor(role);
  switch (provider) {
    case "mock":
      return mockModelFor(role);
    case "openai": {
      if (!process.env.OPENAI_API_KEY) {
        throw new Error(
          `OPENAI_API_KEY is not set (needed for the ${role} model). Set it, pick another provider, or run with SP_MOCK_LLM=1.`,
        );
      }
      return createOpenAI({ apiKey: process.env.OPENAI_API_KEY })(modelId);
    }
    case "anthropic": {
      if (!process.env.ANTHROPIC_API_KEY) {
        throw new Error(
          `ANTHROPIC_API_KEY is not set (needed for the ${role} model). Set it, pick another provider, or run with SP_MOCK_LLM=1.`,
        );
      }
      return createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })(modelId);
    }
    case "openai-compatible": {
      const { baseURL, apiKey } = compatibleEndpoint(role);
      if (!baseURL) {
        throw new Error(
          `SP_OPENAI_COMPATIBLE_BASE_URL is not set (needed for the ${role} model).`,
        );
      }
      return createOpenAICompatible({
        name: `sp-${role}`,
        baseURL,
        apiKey,
      })(modelId);
    }
    default: {
      const exhaustive: never = provider;
      throw new Error(`Unhandled provider: ${String(exhaustive)}`);
    }
  }
}

/** Human-readable model label persisted on reports. */
export function modelLabel(role: ModelRole): string {
  return isMockMode()
    ? "sparring-mock"
    : `${providerFor(role)}/${modelIdFor(role)}`;
}
