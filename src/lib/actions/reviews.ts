"use server";

import { redirect } from "next/navigation";
import { clearReview, saveReview } from "@/lib/db/mutations";
import { getRun } from "@/lib/db/queries";
import { restoreDemoReviews } from "@/lib/db/seed";
import { getDatabase } from "@/lib/db/server";
import { nowIso, refreshProject, safeReturn } from "@/lib/actions/shared";
import { DEMO_RUN_ID } from "@/lib/demo/content";
import type { ActionState, Decision } from "@/lib/types";

export async function recordReview(
  projectId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const gradeId = String(formData.get("gradeId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  const returnTo = safeReturn(projectId, String(formData.get("returnTo") ?? ""));
  if (decision !== "pass" && decision !== "fail") {
    return { error: "Choose whether this check passes or fails." };
  }
  const database = await getDatabase();
  const result = saveReview(database, {
    gradeId,
    decision: decision as Decision,
    note,
    now: nowIso(),
  });
  if (!result.ok) return { error: result.error };
  if (result.value.projectId !== projectId) return { error: "That check is not in this project." };
  refreshProject(projectId);
  redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}notice=saved`);
}

export async function removeReview(projectId: string, formData: FormData): Promise<void> {
  const gradeId = String(formData.get("gradeId") ?? "");
  const returnTo = safeReturn(projectId, String(formData.get("returnTo") ?? ""));
  const database = await getDatabase();
  const result = clearReview(database, gradeId, nowIso());
  if (!result.ok || result.value.projectId !== projectId) {
    redirect(`/projects/${projectId}/failures?error=not-found`);
  }
  refreshProject(projectId);
  redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}notice=saved`);
}

export async function resetSampleReviews(projectId: string, runId: string): Promise<void> {
  const database = await getDatabase();
  const run = getRun(database, runId);
  if (!run || run.projectId !== projectId || run.id !== DEMO_RUN_ID) {
    redirect(`/projects/${projectId}/failures?error=sample-locked`);
  }
  restoreDemoReviews(database);
  refreshProject(projectId);
  redirect(`/projects/${projectId}/failures?run=${runId}&notice=reset`);
}
