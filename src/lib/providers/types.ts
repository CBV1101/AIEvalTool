import type { ProviderId } from "@/lib/types";

export type CompletionRequest = {
  provider: ProviderId;
  model: string;
  system: string;
  user: string;
  signal: AbortSignal;
};

export type CompletionResult =
  | {
      ok: true;
      text: string;
      inputTokens: number | null;
      outputTokens: number | null;
      latencyMs: number;
    }
  | {
      ok: false;
      message: string;
      retryable: boolean;
      latencyMs: number;
    };

export const RETRYABLE_STATUSES = new Set([408, 409, 429, 500, 502, 503, 504, 529]);
