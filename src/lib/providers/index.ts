import { completeAnthropic } from "@/lib/providers/anthropic";
import { completeOpenAI } from "@/lib/providers/openai";
import type { CompletionRequest, CompletionResult } from "@/lib/providers/types";
import type { ProviderId } from "@/lib/types";

export type ProviderAvailability = Record<ProviderId, boolean>;

function clean(value: string | undefined): string {
  return value?.trim() ?? "";
}

export function providerAvailability(): ProviderAvailability {
  return {
    openai: clean(process.env.OPENAI_API_KEY).length > 0,
    anthropic: clean(process.env.ANTHROPIC_API_KEY).length > 0,
  };
}

export function providerLabel(provider: ProviderId): string {
  return provider === "anthropic" ? "Anthropic" : "OpenAI";
}

export async function completeWithProvider(
  request: CompletionRequest,
  fetchImpl?: typeof fetch,
): Promise<CompletionResult> {
  if (!request.model.trim()) {
    return {
      ok: false,
      message: "Enter a model identifier for this version before running a live evaluation.",
      retryable: false,
      latencyMs: 0,
    };
  }
  if (request.provider === "anthropic") {
    const apiKey = clean(process.env.ANTHROPIC_API_KEY);
    if (!apiKey) {
      return {
        ok: false,
        message: "No Anthropic API key is configured on the server.",
        retryable: false,
        latencyMs: 0,
      };
    }
    const baseUrl = clean(process.env.ANTHROPIC_BASE_URL) || "https://api.anthropic.com";
    return completeAnthropic({
      apiKey,
      baseUrl,
      model: request.model,
      system: request.system,
      user: request.user,
      signal: request.signal,
      fetchImpl,
    });
  }
  const apiKey = clean(process.env.OPENAI_API_KEY);
  if (!apiKey) {
    return {
      ok: false,
      message: "No OpenAI API key is configured on the server.",
      retryable: false,
      latencyMs: 0,
    };
  }
  const baseUrl = clean(process.env.OPENAI_BASE_URL) || "https://api.openai.com/v1";
  return completeOpenAI({
    apiKey,
    baseUrl,
    model: request.model,
    system: request.system,
    user: request.user,
    signal: request.signal,
    fetchImpl,
  });
}
