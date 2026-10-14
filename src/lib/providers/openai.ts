import { elapsedMs, publicProviderError, readText, readUsage, retryableStatus } from "@/lib/providers/http";
import type { CompletionResult } from "@/lib/providers/types";

export async function completeOpenAI(input: {
  apiKey: string;
  baseUrl: string;
  model: string;
  system: string;
  user: string;
  signal: AbortSignal;
  fetchImpl?: typeof fetch;
}): Promise<CompletionResult> {
  const started = Date.now();
  const fetchImpl = input.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await fetchImpl(`${input.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: input.model,
        temperature: 0,
        messages: [
          { role: "system", content: input.system },
          { role: "user", content: input.user },
        ],
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

  const payload = (await response.json()) as {
    choices?: { message?: { content?: unknown } }[];
    usage?: unknown;
  };
  const text = readText(payload.choices?.[0]?.message?.content);
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
