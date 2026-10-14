import { getDatabase } from "@/lib/db/server";
import { getProject } from "@/lib/db/queries";
import { SCENARIO_CSV_TEMPLATE } from "@/lib/scenarios/csv";

export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  const database = await getDatabase();
  const project = getProject(database, projectId);
  if (!project) return new Response("Project not found", { status: 404 });
  return new Response(SCENARIO_CSV_TEMPLATE, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="scenario-template.csv"',
    },
  });
}
