import { RETRYABLE_STATUSES } from "@/lib/providers/types";

export function tokenCount(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) return null;
  return value;
}

export function readUsage(usage: unknown): { inputTokens: number | null; outputTokens: number | null } {
  if (!usage || typeof usage !== "object") return { inputTokens: null, outputTokens: null };
  const record = usage as Record<string, unknown>;
  return {
    inputTokens: tokenCount(record.prompt_tokens ?? record.input_tokens),
    outputTokens: tokenCount(record.completion_tokens ?? record.output_tokens),
  };
}

export function readText(content: unknown): string {
  if (typeof content === "string") return content.trim();
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => {
      if (!part || typeof part !== "object" || !("text" in part)) return "";
      return typeof part.text === "string" ? part.text : "";
    })
    .join("")
    .trim();
}

export function publicProviderError(status: number, body: string, secret: string): string {
  let compact = body.replace(/\s+/g, " ").trim().slice(0, 240);
  if (secret) compact = compact.split(secret).join("[redacted]");
  if (!compact) return `The provider returned status ${status}.`;
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string } | string };
    const message =
      typeof parsed.error === "string"
        ? parsed.error
        : typeof parsed.error?.message === "string"
          ? parsed.error.message
          : "";
    if (message) {
      const cleaned = secret ? message.split(secret).join("[redacted]") : message;
      return `The provider returned status ${status}: ${cleaned.replace(/\s+/g, " ").trim().slice(0, 240)}`;
    }
  } catch {
    // The body is not JSON. The compact text above is enough.
  }
  return `The provider returned status ${status}: ${compact}`;
}

export function retryableStatus(status: number): boolean {
  return RETRYABLE_STATUSES.has(status);
}

export function elapsedMs(started: number): number {
  return Math.max(0, Date.now() - started);
}
