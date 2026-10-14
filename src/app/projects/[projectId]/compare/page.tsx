import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { DatabaseSync } from "node:sqlite";
import { removeRun, startRun } from "@/lib/actions/runs";
import { RunConfigForm } from "@/components/run-config";
import { RunMeta } from "@/components/run-results";
import { Notice, Pill } from "@/components/ui";
import { getDatabase } from "@/lib/db/server";
import {
  getProject,
  getRunBundle,
  listRequirements,
  listRuns,
  listScenarios,
  listVersions,
} from "@/lib/db/queries";
import { describeCheck } from "@/lib/eval/grading";
import { formatWhen } from "@/lib/eval/text";
import { verdictShort } from "@/lib/eval/release";
import { reportFromBundle } from "@/lib/eval/report";
import { priorityLabel } from "@/lib/labels";
import { providerAvailability } from "@/lib/providers";
import { errorText, noticeText } from "@/lib/notices";
import type { EvaluationRun } from "@/lib/types";

export const metadata = { title: "Version comparison" };

export default function ComparePage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<p className="loading">Loading comparisons…</p>}>
      <Compare params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Compare({
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
  const requirements = listRequirements(database, projectId);
  const scenarios = listScenarios(database, projectId);
  const versions = listVersions(database, projectId);
  const runs = listRuns(database, projectId);
  const ready = requirements.length > 0 && scenarios.length > 0 && versions.length >= 2;
  const sampleRuns = runs.filter((run) => run.isSample);
  const yourRuns = runs.filter((run) => !run.isSample);

  return (
    <div className="stack-lg">
      <Notice notice={noticeText(query.notice)} error={errorText(query.error)} />
      <header className="stack">
        <p className="eyebrow">Version comparison</p>
        <h2>Run an evaluation and compare two prompts</h2>
        <p className="lede">
          A run sends the same scenarios to two prompt versions, saves each reply, then grades those
          replies against your requirements. Pass rate is the share of scored checks that passed.
        </p>
      </header>

      <section className="panel stack" aria-labelledby="bar-heading">
        <h2 id="bar-heading">Release criteria</h2>
        <p>
          A version meets the release bar for the next grade when at least{" "}
          <strong>{project.minPassRate}%</strong> of scored checks pass, and every blocker and
          important requirement meets its own bar. Helpful requirements are reported and still count
          toward the pass rate, but they do not veto release on their own. Human-only checks count
          after someone records a decision.
        </p>
        {requirements.length === 0 ? (
          <p>
            <Link href={`/projects/${projectId}/setup#requirements`}>Add requirements</Link> to define
            the bar.
          </p>
        ) : (
          <ul className="plain-list">
            {requirements.map((requirement) => (
              <li key={requirement.id}>
                <strong>{requirement.title}</strong> · {priorityLabel(requirement.priority)} ·{" "}
                {requirement.passPercent}% of scenarios ·{" "}
                {describeCheck(requirement.checkType, requirement.checkConfig)}
              </li>
            ))}
          </ul>
        )}
      </section>

      {ready ? (
        <section className="panel stack" aria-labelledby="new-run-heading">
          <h2 id="new-run-heading">New evaluation</h2>
          <RunConfigForm
            action={startRun.bind(null, projectId)}
            versions={versions.map((version) => ({
              id: version.id,
              name: version.name,
              provider: version.provider,
              model: version.model,
            }))}
            keys={providerAvailability()}
            counts={{
              development: scenarios.filter((scenario) => scenario.dataset === "development").length,
              holdout: scenarios.filter((scenario) => scenario.dataset === "holdout").length,
            }}
          />
        </section>
      ) : (
        <section className="panel stack">
          <h2>Finish test setup before running</h2>
          <ul className="plain-list">
            <li>
              {requirements.length > 0 ? (
                `${requirements.length} requirements ready`
              ) : (
                <Link href={`/projects/${projectId}/setup#requirements`}>Add a requirement</Link>
              )}
            </li>
            <li>
              {scenarios.length > 0 ? (
                `${scenarios.length} scenarios ready`
              ) : (
                <Link href={`/projects/${projectId}/setup#scenarios`}>Add a scenario</Link>
              )}
            </li>
            <li>
              {versions.length >= 2 ? (
                `${versions.length} prompt versions ready`
              ) : (
                <Link href={`/projects/${projectId}/setup#versions`}>Add two prompt versions</Link>
              )}
            </li>
          </ul>
        </section>
      )}

      <RunSection
        title="Sample evaluation"
        empty="This project has no sample evaluation."
        runs={sampleRuns.map((run) => summarizeRun(database, projectId, run))}
        hideEmpty={!project.isDemo}
      />
      <RunSection
        title="Your evaluations"
        empty={
          project.isDemo
            ? "Evaluations you start here are yours. They stay separate from the sample results."
            : "No evaluations yet. Start one after the setup above is complete."
        }
        runs={yourRuns.map((run) => summarizeRun(database, projectId, run))}
      />
    </div>
  );
}

function summarizeRun(database: DatabaseSync, projectId: string, run: EvaluationRun) {
  const bundle = run.status === "graded" ? getRunBundle(database, run.id) : undefined;
  const report = bundle ? reportFromBundle(bundle) : null;
  const summary = report
    ? `${run.versionAName} ${verdictShort(report.versionA, run.mode === "demo")}. ${run.versionBName} ${verdictShort(report.versionB, run.mode === "demo")}.`
    : "Replies are not graded yet.";
  return { run, projectId, summary };
}

function RunSection({
  title,
  empty,
  runs,
  hideEmpty = false,
}: {
  title: string;
  empty: string;
  runs: { run: EvaluationRun; projectId: string; summary: string }[];
  hideEmpty?: boolean;
}) {
  if (hideEmpty && runs.length === 0) return null;
  return (
    <section className="stack">
      <h2>{title}</h2>
      {runs.length === 0 ? (
        <p className="panel">{empty}</p>
      ) : (
        <div className="stack">
          {runs.map(({ run, projectId, summary }) => (
            <article className="panel stack" key={run.id}>
              <div className="inline-actions">
                <h3>
                  <Link href={`/projects/${projectId}/compare/${run.id}`}>{run.name}</Link>
                </h3>
                {run.isSample ? <Pill tone="sample">Sample data</Pill> : null}
              </div>
              <RunMeta run={run} />
              <p className="meta">
                {run.versionAName} vs {run.versionBName} · {formatWhen(run.gradedAt ?? run.createdAt)}
              </p>
              <p>{summary}</p>
              <div className="btn-row">
                <Link className="btn" href={`/projects/${projectId}/compare/${run.id}`}>
                  {run.status === "graded" ? "Open comparison" : "Continue evaluation"}
                </Link>
                {run.status === "graded" ? (
                  <Link className="btn" href={`/projects/${projectId}/failures?run=${run.id}`}>
                    Review failures
                  </Link>
                ) : null}
                {run.isSample ? null : (
                  <form action={removeRun.bind(null, projectId, run.id)}>
                    <button className="btn btn-danger" type="submit">
                      Delete evaluation
                    </button>
                  </form>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
