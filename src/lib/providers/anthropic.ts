import { elapsedMs, publicProviderError, readText, readUsage, retryableStatus } from "@/lib/providers/http";
import type { CompletionResult } from "@/lib/providers/types";

export function maxOutputTokens(): number {
  const parsed = Number(process.env.EVAL_MAX_OUTPUT_TOKENS ?? "1024");
  if (!Number.isInteger(parsed) || parsed < 1) return 1024;
  return Math.min(parsed, 4096);
}

export async function completeAnthropic(input: {
  apiKey: string;
  baseUrl: string;
  model: string;
  system: string;
  user: string;
  signal: AbortSignal;
  fetchImpl?: typeof fetch;
  maxTokens?: number;
}): Promise<CompletionResult> {
  const started = Date.now();
  const fetchImpl = input.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await fetchImpl(`${input.baseUrl.replace(/\/$/, "")}/v1/messages`, {
      method: "POST",
      headers: {
        "x-api-key": input.apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: input.model,
        max_tokens: input.maxTokens ?? maxOutputTokens(),
        system: input.system,
        messages: [{ role: "user", content: input.user }],
      }),
      signal: input.signal,
    });
  } catch {
    if (input.signal.aborted) {
      return { ok: false, message: "Cancelled.", retryable: false, latencyMs: elapsedMs(started) };
    }
    return {
      ok: false,
      message: "The provider could not be reached.",
      retryable: true,
      latencyMs: elapsedMs(started),
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      message: publicProviderError(response.status, await response.text(), input.apiKey),
      retryable: retryableStatus(response.status),
      latencyMs: elapsedMs(started),
    };
  }

  const payload = (await response.json()) as { content?: unknown; usage?: unknown };
  const text = readText(payload.content);
  if (!text) {
    return {
      ok: false,
      message: "The model returned an empty reply.",
      retryable: false,
      latencyMs: elapsedMs(started),
    };
  }
  const usage = readUsage(payload.usage);
  return {
    ok: true,
    text,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    latencyMs: elapsedMs(started),
  };
}
