import type { LanguageModel } from "ai";
import {
  fallbackModelId,
  isMockMode,
  modelIdFor,
  resolveFallbackModel,
  resolveModel,
  type ModelRole,
} from "@/llm/models";

export interface FallbackResult<T> {
  value: T;
  usedFallback: boolean;
  modelId: string;
}

/**
 * Run `fn` on the role's primary model. If an optional fallback is configured,
 * retry once when the primary request fails.
 */
export async function callWithFallback<T>(
  role: ModelRole,
  fn: (model: LanguageModel) => Promise<T>,
): Promise<FallbackResult<T>> {
  const primaryId = modelIdFor(role);
  try {
    return {
      value: await fn(resolveModel(role)),
      usedFallback: false,
      modelId: isMockMode() ? "sparring-mock" : primaryId,
    };
  } catch (error) {
    const fallbackId = fallbackModelId();
    if (isMockMode() || !fallbackId || primaryId === fallbackId) throw error;
    try {
      return {
        value: await fn(resolveFallbackModel()),
        usedFallback: true,
        modelId: fallbackId,
      };
    } catch {
      throw error;
    }
  }
}
