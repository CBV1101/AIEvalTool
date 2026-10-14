import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RunProgress } from "@/components/run-progress";
import { RunResults } from "@/components/run-results";
import { Worksheet } from "@/components/worksheet";
import { Notice } from "@/components/ui";
import { getDatabase } from "@/lib/db/server";
import {
  getProject,
  getRun,
  getRunBundle,
  listReferenceMaterials,
  listRequirements,
  listResponses,
  listScenarios,
  listVersions,
} from "@/lib/db/queries";
import { fingerprintProject } from "@/lib/eval/fingerprint";
import { parseRunSnapshot, snapshotDrift } from "@/lib/eval/snapshot";
import { formatWhen } from "@/lib/eval/text";
import { reportFromBundle } from "@/lib/eval/report";
import { errorText, noticeText } from "@/lib/notices";
import type { Scenario } from "@/lib/types";

export const metadata = { title: "Evaluation" };

export default function RunPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string; runId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<p className="loading">Loading the evaluation…</p>}>
      <Run params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Run({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string; runId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { projectId, runId } = await params;
  const query = await searchParams;
  const database = await getDatabase();
  const project = getProject(database, projectId);
  const run = getRun(database, runId);
  if (!project || !run || run.projectId !== projectId) notFound();

  const requirements = listRequirements(database, projectId);
  const scenarios = listScenarios(database, projectId);
  const versions = listVersions(database, projectId);
  const materials = listReferenceMaterials(database, projectId);
  const responses = listResponses(database, runId);
  const bundle = getRunBundle(database, runId);
  if (!bundle) notFound();
  const snapshot = parseRunSnapshot(run.snapshotJson);
  const setupChanged = snapshot
    ? snapshotDrift(snapshot, { minPassRate: project.minPassRate, requirements, scenarios, versions, materials })
    : run.status === "graded" &&
      run.setupFingerprint.length > 0 &&
      run.setupFingerprint !== fingerprintProject(project, requirements, scenarios, versions, materials);

  const worksheetScenarios = scenariosForWorksheet(responses, snapshot?.scenarios ?? [], run.projectId);

  return (
    <div className="stack-lg">
      <Notice notice={noticeText(query.notice)} error={errorText(query.error)} />
      <header className="stack">
        <p className="eyebrow">Evaluation</p>
        <h2>{run.name}</h2>
        <p className="meta">
          {run.versionAName} vs {run.versionBName} · Started {formatWhen(run.createdAt)}
          {run.gradedAt ? ` · Graded ${formatWhen(run.gradedAt)}` : ""}
        </p>
        <p>
          <Link href={`/projects/${projectId}/compare`}>All evaluations</Link>
        </p>
      </header>

      {run.status === "graded" ? (
        <RunResults
          projectId={projectId}
          bundle={bundle}
          verdicts={reportFromBundle(bundle)}
          setupChanged={setupChanged}
          scenarios={snapshot?.scenarios ?? scenarios}
        />
      ) : null}

      {run.status === "running" ? <RunProgress projectId={projectId} runId={run.id} /> : null}
      {run.mode === "demo" && run.status !== "graded" ? (
        <p className="banner banner-sample">
          <strong>Demo mode.</strong> These replies were not produced by a model. Do not treat them
          as measurements.
        </p>
      ) : null}
      {run.isSample || run.status === "running" ? null : (
        <section className="stack">
          {run.status === "graded" ? (
            <details className="editor">
              <summary>Edit replies and grade again</summary>
              <Worksheet
                projectId={projectId}
                run={run}
                responses={responses}
                scenarios={worksheetScenarios}
                versions={snapshot?.versions ?? versions}
              />
            </details>
          ) : (
            <Worksheet
              projectId={projectId}
              run={run}
              responses={responses}
              scenarios={worksheetScenarios}
              versions={snapshot?.versions ?? versions}
            />
          )}
        </section>
      )}
    </div>
  );
}

function scenariosForWorksheet(
  responses: { scenarioId: string; scenarioTitle: string; scenarioPosition: number; customerInput: string; situation: string; goodLooksLike: string; createdAt: string; updatedAt: string }[],
  snapshots: Scenario[],
  projectId: string,
): Scenario[] {
  const ids = [...new Set(responses.map((response) => response.scenarioId))];
  return ids
    .map((id) => {
      const frozen = snapshots.find((scenario) => scenario.id === id);
      if (frozen) return frozen;
      const snapshot = responses.find((response) => response.scenarioId === id);
      if (!snapshot) return undefined;
      return {
        id,
        projectId,
        title: snapshot.scenarioTitle,
        customerInput: snapshot.customerInput,
        situation: snapshot.situation,
        goodLooksLike: snapshot.goodLooksLike,
        referenceAnswer: "",
        category: "normal" as const,
        dataset: "development" as const,
        appliesToAll: true,
        requirementIds: [],
        position: snapshot.scenarioPosition,
        createdAt: snapshot.createdAt,
        updatedAt: snapshot.updatedAt,
      } satisfies Scenario;
    })
    .filter((scenario): scenario is Scenario => Boolean(scenario))
    .sort((a, b) => a.position - b.position);
}
