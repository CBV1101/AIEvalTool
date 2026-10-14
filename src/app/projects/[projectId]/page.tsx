import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { getDatabase } from "@/lib/db/server";
import { getProject, listRuns } from "@/lib/db/queries";
import { preferredRun } from "@/lib/eval/report";

export default function ProjectIndex({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  return (
    <Suspense fallback={<p className="loading">Opening the project…</p>}>
      <Redirect params={params} />
    </Suspense>
  );
}

async function Redirect({ params }: { params: Promise<{ projectId: string }> }): Promise<React.ReactNode> {
  const { projectId } = await params;
  const database = await getDatabase();
  const project = getProject(database, projectId);
  if (!project) notFound();
  const preferred = preferredRun(listRuns(database, projectId));
  if (preferred) redirect(`/projects/${projectId}/compare/${preferred.id}`);
  redirect(project.isDemo ? `/projects/${projectId}/compare` : `/projects/${projectId}/setup`);
  return null;
}
