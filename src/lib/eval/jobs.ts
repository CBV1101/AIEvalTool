import { executeRun } from "@/lib/eval/execute";
import { getDatabase } from "@/lib/db/server";

const globalJobs = globalThis as unknown as { evalJobs?: Map<string, AbortController> };

function jobs(): Map<string, AbortController> {
  globalJobs.evalJobs ??= new Map();
  return globalJobs.evalJobs;
}

export function startRunExecution(runId: string): void {
  const active = jobs();
  if (active.has(runId)) return;
  const abort = new AbortController();
  active.set(runId, abort);
  void (async () => {
    try {
      const database = await getDatabase();
      await executeRun(database, runId, { signal: abort.signal });
    } finally {
      active.delete(runId);
    }
  })();
}

export function cancelRunExecution(runId: string): void {
  jobs().get(runId)?.abort();
}
