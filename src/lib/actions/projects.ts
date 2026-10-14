"use server";

import { redirect } from "next/navigation";
import { copyProject, deleteProject, insertProject, updateProject } from "@/lib/db/mutations";
import { getDatabase } from "@/lib/db/server";
import { nowIso, refreshProject } from "@/lib/actions/shared";
import type { ActionState } from "@/lib/types";
import { parseProjectForm } from "@/lib/validators";

export async function createProject(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = parseProjectForm(formData);
  if (!parsed.ok) return { error: parsed.error };
  const database = await getDatabase();
  const id = crypto.randomUUID();
  const result = insertProject(database, { ...parsed.value, id, now: nowIso() });
  if (!result.ok) return { error: result.error };
  refreshProject(id);
  redirect(`/projects/${id}/setup?notice=saved`);
}

export async function saveProject(
  projectId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = parseProjectForm(formData);
  if (!parsed.ok) return { error: parsed.error };
  const database = await getDatabase();
  const result = updateProject(database, projectId, parsed.value, nowIso());
  if (!result.ok) return { error: result.error };
  refreshProject(projectId);
  redirect(`/projects/${projectId}/setup?notice=saved`);
}

export async function removeProject(projectId: string, formData: FormData): Promise<void> {
  const database = await getDatabase();
  const confirm = String(formData.get("confirm") ?? "");
  const result = deleteProject(database, projectId, confirm);
  if (!result.ok) {
    const code = result.error.startsWith("Confirm") ? "confirm" : "demo-locked";
    redirect(`/projects/${projectId}/setup?error=${code}`);
  }
  refreshProject();
  redirect("/?notice=deleted");
}

export async function duplicateProject(projectId: string): Promise<void> {
  const database = await getDatabase();
  const id = crypto.randomUUID();
  const result = copyProject(database, projectId, id, nowIso());
  if (!result.ok) redirect(`/?error=not-found`);
  refreshProject(id);
  redirect(`/projects/${id}/setup?notice=copied`);
}
