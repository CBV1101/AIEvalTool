import { connection } from "next/server";
import { getDatabase } from "@/lib/db/server";
import { buildExport } from "@/lib/eval/export-load";

export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string; runId: string }> },
) {
  await connection();
  const { projectId, runId } = await context.params;
  const exported = buildExport(await getDatabase(), projectId, runId);
  if (!exported) return new Response("Evaluation not found", { status: 404 });
  return new Response(exported.csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${exported.csvName}"`,
      "Cache-Control": "no-store",
    },
  });
}
