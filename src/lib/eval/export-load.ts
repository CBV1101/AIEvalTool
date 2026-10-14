import type { DatabaseSync } from "node:sqlite";
import { getProject, getRunBundle, listScenarios } from "@/lib/db/queries";
import { all } from "@/lib/db/sql";
import { decisionReport, detailedResultsCsv, exportFileName } from "@/lib/eval/export";
import { reportFromBundle } from "@/lib/eval/report";
import { parseRunSnapshot, type RunSnapshot } from "@/lib/eval/snapshot";

export function buildExport(db: DatabaseSync, projectId: string, runId: string) {
  const project = getProject(db, projectId);
  const bundle = getRunBundle(db, runId);
  if (!project || !bundle || bundle.run.projectId !== projectId || bundle.run.status !== "graded") {
    return null;
  }
  const snapshot = parseRunSnapshot(bundle.run.snapshotJson);
  const scenarios = snapshot?.scenarios ?? listScenarios(db, projectId);
  const versions = versionsForReport(db, projectId, snapshot);
  return {
    csv: detailedResultsCsv(bundle, scenarios),
    csvName: exportFileName(bundle.run.name, "results"),
    markdown: decisionReport(bundle, reportFromBundle(bundle), scenarios, versions),
    markdownName: exportFileName(bundle.run.name, "decision"),
  };
}

function versionsForReport(db: DatabaseSync, projectId: string, snapshot: RunSnapshot | null) {
  const stored = snapshot?.versions ?? [];
  if (stored.length > 0 && stored.every((version) => version.provider === "openai" || version.provider === "anthropic")) {
    return stored;
  }
  return all<{ id: string; name: string; provider: string | null; model: string | null }>(
    db,
    "SELECT id, name, provider, model FROM prompt_versions WHERE project_id = ?",
    [projectId],
  ).map((row) => ({
    id: row.id,
    name: row.name,
    provider: row.provider === "anthropic" ? ("anthropic" as const) : ("openai" as const),
    model: row.model ?? "",
  }));
}
