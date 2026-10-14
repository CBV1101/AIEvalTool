import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FailureBoard } from "@/components/failure-board";
import { Notice } from "@/components/ui";
import { getDatabase } from "@/lib/db/server";
import { getProject, getRunBundle, listReferenceMaterials, listRuns, listScenarios } from "@/lib/db/queries";
import { parseRunSnapshot } from "@/lib/eval/snapshot";
import { firstParam } from "@/lib/eval/text";
import { checksFromBundle, preferredRun, reportFromBundle } from "@/lib/eval/report";
import { errorText, noticeText } from "@/lib/notices";

export const metadata = { title: "Failure review" };

export default function FailuresPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<p className="loading">Loading failures…</p>}>
      <Failures params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Failures({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { projectId } = await params;
  const query = await searchParams;
  const database = await getDatabase();
  const project = getProject(database, projectId);
  if (!project) notFound();
  const graded = listRuns(database, projectId).filter((run) => run.status === "graded");
  if (graded.length === 0) {
    return (
      <div className="stack">
        <h2>Failure review</h2>
        <div className="panel stack">
          <h3>No graded evaluation yet</h3>
          <p>
            Run an evaluation from version comparison. Failures show up here after grading, ready
            for a person to confirm or overrule.
          </p>
          <Link className="btn btn-primary" href={`/projects/${projectId}/compare`}>
            Go to version comparison
          </Link>
        </div>
      </div>
    );
  }

  const requested = firstParam(query.run);
  const selected =
    graded.find((run) => run.id === requested) ?? preferredRun(graded) ?? graded[0];
  const bundle = getRunBundle(database, selected.id);
  if (!bundle) notFound();
  const snapshot = parseRunSnapshot(bundle.run.snapshotJson);
  const scenarios = snapshot?.scenarios ?? listScenarios(database, projectId);
  const materials = snapshot?.materials ?? listReferenceMaterials(database, projectId);

  return (
    <div className="stack-lg">
      <Notice notice={noticeText(query.notice)} error={errorText(query.error)} />
      <FailureBoard
        projectId={projectId}
        runs={graded}
        run={bundle.run}
        checks={checksFromBundle(bundle, scenarios)}
        verdicts={reportFromBundle(bundle)}
        materials={materials}
        filters={{
          version: firstParam(query.version) ?? "all",
          requirement: firstParam(query.requirement) ?? "all",
          category: firstParam(query.category) ?? "all",
          verdict: verdictFilter(firstParam(query.verdict), firstParam(query.show)),
        }}
      />
    </div>
  );
}

function verdictFilter(verdict: string | undefined, show: string | undefined): string {
  if (verdict && ["open", "fail", "needs_review", "unreviewed", "pass", "override", "decisions", "all"].includes(verdict)) {
    return verdict;
  }
  if (show === "passed") return "override";
  if (show === "decisions") return "decisions";
  if (show === "all") return "all";
  return "open";
}
