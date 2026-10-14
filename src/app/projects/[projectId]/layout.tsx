import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ProjectNav } from "@/components/project-nav";
import { AppLoading, Brand, Pill } from "@/components/ui";
import { getDatabase } from "@/lib/db/server";
import { getProject, getRunBundle, listRuns } from "@/lib/db/queries";
import { verdictShort } from "@/lib/eval/release";
import { preferredRun, reportFromBundle } from "@/lib/eval/report";

export default function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  return (
    <Suspense fallback={<AppLoading label="the project" />}>
      <LoadedProjectLayout params={params}>{children}</LoadedProjectLayout>
    </Suspense>
  );
}

async function LoadedProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const database = await getDatabase();
  const project = getProject(database, projectId);
  if (!project) notFound();
  const preferred = preferredRun(listRuns(database, projectId));
  const bundle = preferred ? getRunBundle(database, preferred.id) : undefined;
  const report = bundle && bundle.run.status === "graded" ? reportFromBundle(bundle) : null;
  const status = !report
    ? "No graded evaluation yet."
    : `${bundle?.run.isSample ? "Sample data. " : bundle?.run.mode === "demo" ? "Demo mode. " : "Latest evaluation. "}${report.versionA.versionName} ${verdictShort(report.versionA, bundle?.run.mode === "demo")}. ${report.versionB.versionName} ${verdictShort(report.versionB, bundle?.run.mode === "demo")}.`;

  return (
    <div className="page stack">
      <header className="topbar">
        <Brand />
        <div className="stack">
          <p className="eyebrow">{project.isDemo ? "Demo project" : "Project"}</p>
          <h1>{project.name}</h1>
          <p>{project.featureSummary}</p>
          <p>{status}</p>
        </div>
      </header>
      {project.isDemo ? (
        <p className="banner banner-sample">
          <Pill tone="sample">Sample project</Pill> The evaluation shipped with this demo is sample
          data, not a live model run. It stays separate from evaluations you create.
        </p>
      ) : null}
      <div className="shell-main">
        <ProjectNav projectId={project.id} />
        <main id="main">
          <Suspense fallback={<p className="loading">Loading this page…</p>}>{children}</Suspense>
        </main>
      </div>
      <p className="footer-note">Evaluations stay in a SQLite file on this computer.</p>
    </div>
  );
}
