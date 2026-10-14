import type { DatabaseSync } from "node:sqlite";
import { buildEvaluationPrompt } from "@/lib/eval/prompts";
import { parseRunSnapshot } from "@/lib/eval/snapshot";
import { get, run } from "@/lib/db/sql";
import { completeWithProvider } from "@/lib/providers";
import type { CompletionResult } from "@/lib/providers/types";
import type { ProviderId } from "@/lib/types";

export type CompleteCall = (input: {
  provider: ProviderId;
  model: string;
  system: string;
  user: string;
  signal: AbortSignal;
}) => Promise<CompletionResult>;

const RETRY_DELAYS_MS = [400, 1200];

type PendingCall = {
  id: string;
  provider: string;
  model: string;
  customerInput: string;
  situation: string;
  versionId: string;
};

export function concurrencyLimit(): number {
  const parsed = Number(process.env.EVAL_RUN_CONCURRENCY ?? "3");
  if (!Number.isInteger(parsed)) return 3;
  return Math.min(4, Math.max(1, parsed));
}

export function demoOutput(expected: string): string {
  const behavior = expected.trim() || "No expected behavior was recorded.";
  return `Demo mode. This reply was not produced by a model. Do not treat it as a measurement.\n\nExpected behavior:\n${behavior}`;
}

export async function executeRun(
  db: DatabaseSync,
  runId: string,
  options: { signal?: AbortSignal; complete?: CompleteCall; concurrency?: number } = {},
): Promise<void> {
  const signal = options.signal ?? new AbortController().signal;
  const complete = options.complete ?? completeWithProvider;
  const runRow = get<{ status: string; snapshot_json: string }>(
    db,
    "SELECT status, snapshot_json FROM evaluation_runs WHERE id = ?",
    [runId],
  );
  if (!runRow || runRow.status !== "running") return;
  const snapshot = parseRunSnapshot(runRow.snapshot_json);
  if (!snapshot) {
    finishRun(db, runId, "ready");
    return;
  }
  const pending = db
    .prepare(
      `SELECT id, provider, model, customer_input, situation, version_id
       FROM responses
       WHERE run_id = ? AND call_status = 'pending'
       ORDER BY scenario_position, repetition, version_id`,
    )
    .all(runId) as {
    id: string;
    provider: string;
    model: string;
    customer_input: string;
    situation: string;
    version_id: string;
  }[];
  const calls: PendingCall[] = pending.map((row) => ({
    id: row.id,
    provider: row.provider,
    model: row.model,
    customerInput: row.customer_input,
    situation: row.situation,
    versionId: row.version_id,
  }));
  await mapPool(calls, options.concurrency ?? concurrencyLimit(), signal, async (call) => {
    await runCall(db, runId, snapshot, call, complete, signal);
  });
  const cancelled = signal.aborted || cancelRequested(db, runId);
  if (cancelled) {
    run(
      db,
      `UPDATE responses
       SET call_status = 'cancelled', error_text = 'Cancelled.', updated_at = ?
       WHERE run_id = ? AND call_status IN ('pending', 'running')`,
      [new Date().toISOString(), runId],
    );
  }
  finishRun(db, runId, cancelled ? "cancelled" : "ready");
}

async function runCall(
  db: DatabaseSync,
  runId: string,
  snapshot: NonNullable<ReturnType<typeof parseRunSnapshot>>,
  call: PendingCall,
  complete: CompleteCall,
  signal: AbortSignal,
): Promise<void> {
  if (signal.aborted || cancelRequested(db, runId)) return;
  const claimed = db
    .prepare(
      "UPDATE responses SET call_status = 'running', updated_at = ? WHERE id = ? AND call_status = 'pending'",
    )
    .run(new Date().toISOString(), call.id);
  if (claimed.changes !== 1) return;
  const version = snapshot.versions.find((item) => item.id === call.versionId);
  const provider: ProviderId = call.provider === "anthropic" ? "anthropic" : "openai";
  const prompt = buildEvaluationPrompt({
    instructions: version?.instructions ?? "",
    template: version?.messageTemplate ?? "",
    customerInput: call.customerInput,
    situation: call.situation,
    materials: snapshot.materials,
  });
  let result: CompletionResult = {
    ok: false,
    message: "The provider request did not finish.",
    retryable: false,
    latencyMs: 0,
  };
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    if (signal.aborted || cancelRequested(db, runId)) return;
    try {
      result = await complete({
        provider,
        model: call.model,
        system: prompt.system,
        user: prompt.user,
        signal,
      });
    } catch {
      result = {
        ok: false,
        message: "The provider could not be reached.",
        retryable: true,
        latencyMs: 0,
      };
    }
    if (result.ok || !result.retryable || attempt === RETRY_DELAYS_MS.length) break;
    await wait(RETRY_DELAYS_MS[attempt], signal);
  }
  if (signal.aborted || cancelRequested(db, runId)) {
    if (!result.ok) return;
  }
  const now = new Date().toISOString();
  if (result.ok) {
    run(
      db,
      `UPDATE responses
       SET output_text = ?, source = 'model', call_status = 'succeeded', latency_ms = ?,
           input_tokens = ?, output_tokens = ?, error_text = '', prompt_snapshot = ?, updated_at = ?
       WHERE id = ?`,
      [
        result.text,
        result.latencyMs,
        result.inputTokens,
        result.outputTokens,
        prompt.snapshot,
        now,
        call.id,
      ],
    );
    return;
  }
  run(
    db,
    `UPDATE responses
     SET call_status = 'failed', latency_ms = ?, error_text = ?, prompt_snapshot = ?, updated_at = ?
     WHERE id = ?`,
    [result.latencyMs, result.message, prompt.snapshot, now, call.id],
  );
}

function cancelRequested(db: DatabaseSync, runId: string): boolean {
  const row = get<{ cancel_requested: number }>(
    db,
    "SELECT cancel_requested FROM evaluation_runs WHERE id = ?",
    [runId],
  );
  return row?.cancel_requested === 1;
}

function finishRun(db: DatabaseSync, runId: string, status: "ready" | "cancelled"): void {
  const open = get<{ count: number }>(
    db,
    "SELECT COUNT(*) AS count FROM responses WHERE run_id = ? AND call_status IN ('pending', 'running')",
    [runId],
  );
  if ((open?.count ?? 0) > 0) return;
  const sources = db
    .prepare("SELECT DISTINCT source FROM responses WHERE run_id = ?")
    .all(runId) as { source: string }[];
  const responseSource = sources.length === 1 && sources[0]?.source === "model" ? "model" : "mixed";
  run(
    db,
    "UPDATE evaluation_runs SET status = ?, response_source = ? WHERE id = ? AND status = 'running'",
    [status, responseSource, runId],
  );
}

async function mapPool<T>(
  items: T[],
  limit: number,
  signal: AbortSignal,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let index = 0;
  const size = Math.min(limit, items.length);
  async function next(): Promise<void> {
    while (!signal.aborted) {
      const current = index;
      index += 1;
      if (current >= items.length) return;
      await worker(items[current]);
    }
  }
  await Promise.all(Array.from({ length: size }, () => next()));
}

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}
