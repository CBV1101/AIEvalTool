import { requestRunCancel } from "@/lib/db/mutations";
import { getRun } from "@/lib/db/queries";
import { getDatabase } from "@/lib/db/server";
import { cancelRunExecution, startRunExecution } from "@/lib/eval/jobs";
import { all } from "@/lib/db/sql";

export async function GET(request: Request, context: { params: Promise<{ runId: string }> }) {
  const { runId } = await context.params;
  const projectId = new URL(request.url).searchParams.get("projectId") ?? "";
  const database = await getDatabase();
  const run = getRun(database, runId);
  if (!run || run.projectId !== projectId) {
    return Response.json({ error: "That evaluation could not be found." }, { status: 404 });
  }
  if (run.status === "running") startRunExecution(runId);
  const counts = all<{ call_status: string; count: number }>(
    database,
    "SELECT call_status, COUNT(*) AS count FROM responses WHERE run_id = ? GROUP BY call_status",
    [runId],
  );
  const byStatus = Object.fromEntries(counts.map((row) => [row.call_status, row.count]));
  const pending = byStatus.pending ?? 0;
  const running = byStatus.running ?? 0;
  const succeeded = byStatus.succeeded ?? 0;
  const failed = byStatus.failed ?? 0;
  const cancelled = byStatus.cancelled ?? 0;
  const recorded = byStatus.recorded ?? 0;
  const total = pending + running + succeeded + failed + cancelled + recorded;
  return Response.json({
    status: run.status,
    mode: run.mode,
    total,
    finished: succeeded + failed + cancelled + recorded,
    pending,
    running,
    succeeded,
    failed,
    cancelled,
  });
}

export async function POST(request: Request, context: { params: Promise<{ runId: string }> }) {
  const { runId } = await context.params;
  const projectId = new URL(request.url).searchParams.get("projectId") ?? "";
  const body = (await request.json().catch(() => null)) as { intent?: string } | null;
  if (body?.intent !== "cancel") {
    return Response.json({ error: "Choose cancel." }, { status: 400 });
  }
  const database = await getDatabase();
  const result = requestRunCancel(database, projectId, runId);
  if (!result.ok) return Response.json({ error: result.error }, { status: 404 });
  cancelRunExecution(runId);
  startRunExecution(runId);
  return Response.json({ ok: true });
}
