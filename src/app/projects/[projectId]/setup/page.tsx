import { Suspense } from "react";
import { notFound } from "next/navigation";
import { SetupBoard } from "@/components/setup-board";
import { Notice } from "@/components/ui";
import { getDatabase } from "@/lib/db/server";
import {
  getProject,
  listReferenceMaterials,
  listRequirements,
  listScenarios,
  listVersions,
} from "@/lib/db/queries";
import { errorText, noticeText } from "@/lib/notices";

export const metadata = { title: "Test setup" };

export default function SetupPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<p className="loading">Loading test setup…</p>}>
      <Setup params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Setup({
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
  return (
    <div className="stack-lg">
      <Notice notice={noticeText(query.notice)} error={errorText(query.error)} />
      <SetupBoard
        project={project}
        requirements={listRequirements(database, projectId)}
        scenarios={listScenarios(database, projectId)}
        versions={listVersions(database, projectId)}
        materials={listReferenceMaterials(database, projectId)}
      />
    </div>
  );
}
