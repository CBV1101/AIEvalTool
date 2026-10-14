import { Suspense } from "react";
import Link from "next/link";
import { duplicateProject } from "@/lib/actions/projects";
import { homeOnboarding, Onboarding } from "@/components/onboarding";
import { AppLoading, Brand, Notice, Pill } from "@/components/ui";
import { getDatabase } from "@/lib/db/server";
import { getRunBundle, listProjects, listRequirements, listRuns, listScenarios, listVersions } from "@/lib/db/queries";
import { formatWhen } from "@/lib/eval/text";
import { preferredRun, reportFromBundle } from "@/lib/eval/report";
import { verdictShort } from "@/lib/eval/release";
import { DEMO_PROJECT_ID, DEMO_RUN_ID } from "@/lib/demo/content";
import { errorText, noticeText } from "@/lib/notices";
import type { Project } from "@/lib/types";

export default function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<AppLoading label="projects" />}>
      <Home searchParams={searchParams} />
    </Suspense>
  );
}

async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const database = await getDatabase();
  const projects = listProjects(database);
  const demo = projects.find((project) => project.id === DEMO_PROJECT_ID) ?? null;
  const yours = projects.filter((project) => !project.isDemo);

  return (
    <div className="page stack-lg">
      <header className="page-header">
        <Brand />
        <Link className="btn btn-primary" href="/projects/new">
          New project
        </Link>
      </header>
      <main id="main" className="stack-lg">
        <Notice notice={noticeText(params.notice)} error={errorText(params.error)} />
        <section className="stack">
          <h1>Compare prompt versions before you ship</h1>
          <p className="lede">
            A local workspace for product managers. Define what good looks like, try two instruction
            versions on the same scenarios, and see which one meets your release bar. No code
            required.
          </p>
        </section>

        <Onboarding steps={homeOnboarding(demo?.id ?? null, DEMO_RUN_ID)} />

        {demo ? <DemoCard project={demo} /> : null}

        <section className="stack" aria-labelledby="yours-heading">
          <h2 id="yours-heading">Your projects</h2>
          {yours.length === 0 ? (
            <div className="panel stack">
              <h3>No projects of your own yet</h3>
              <p>
                Projects you create show up here. The demo stays separate, and its sample results
                are never mixed into your evaluations.
              </p>
              <Link className="btn btn-primary" href="/projects/new">
                Create a project
              </Link>
            </div>
          ) : (
            <div className="grid-2">
              {yours.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          )}
        </section>
        <p className="footer-note">
          Local only. Evaluations stay in a SQLite file on this computer. There is no account,
          billing, or team space in this version.
        </p>
      </main>
    </div>
  );
}

async function DemoCard({ project }: { project: Project }) {
  const status = await describeProject(project.id);
  return (
    <section className="card demo-card stack" aria-labelledby="demo-heading">
      <p className="inline-actions">
        <Pill tone="sample">Sample data</Pill>
        <span className="eyebrow">Start here</span>
      </p>
      <h2 id="demo-heading">{project.name}</h2>
      <p>{project.featureSummary}</p>
      <p>{status}</p>
      <div className="btn-row">
        <Link className="btn btn-primary" href={`/projects/${project.id}/compare/${DEMO_RUN_ID}`}>
          Open the sample comparison
        </Link>
        <Link className="btn" href={`/projects/${project.id}/failures?run=${DEMO_RUN_ID}`}>
          Review sample failures
        </Link>
        <form action={duplicateProject.bind(null, project.id)}>
          <button className="btn" type="submit">
            Copy into your own project
          </button>
        </form>
      </div>
    </section>
  );
}

async function ProjectCard({ project }: { project: Project }) {
  const database = await getDatabase();
  const requirements = listRequirements(database, project.id);
  const scenarios = listScenarios(database, project.id);
  const versions = listVersions(database, project.id);
  const status = await describeProject(project.id);
  return (
    <article className="card stack">
      <h3>
        <Link href={`/projects/${project.id}`}>{project.name}</Link>
      </h3>
      <p>{project.featureSummary}</p>
      <p className="meta">
        {requirements.length} requirements · {scenarios.length} scenarios · {versions.length} versions · Updated{" "}
        {formatWhen(project.updatedAt)}
      </p>
      <p>{status}</p>
    </article>
  );
}

async function describeProject(projectId: string): Promise<string> {
  const database = await getDatabase();
  const preferred = preferredRun(listRuns(database, projectId));
  if (!preferred) return "No graded evaluation yet.";
  const bundle = getRunBundle(database, preferred.id);
  if (!bundle) return "No graded evaluation yet.";
  const report = reportFromBundle(bundle);
  const demo = preferred.mode === "demo";
  const prefix = preferred.isSample ? "Sample result. " : demo ? "Demo mode. " : "Latest evaluation. ";
  return `${prefix}${report.versionA.versionName} ${verdictShort(report.versionA, demo)}. ${report.versionB.versionName} ${verdictShort(report.versionB, demo)}.`;
}
