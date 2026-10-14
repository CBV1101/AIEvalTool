"use server";

import { redirect } from "next/navigation";
import {
  createRun,
  deleteRun,
  gradeRun,
  saveReplies,
} from "@/lib/db/mutations";
import { listResponses, listScenarios, listVersions } from "@/lib/db/queries";
import { getDatabase } from "@/lib/db/server";
import { nowIso, refreshProject } from "@/lib/actions/shared";
import { startRunExecution } from "@/lib/eval/jobs";
import { providerAvailability } from "@/lib/providers";
import type { ActionState, ScenarioSet } from "@/lib/types";

export async function startRun(
  projectId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const versionAId = String(formData.get("versionAId") ?? "");
  const versionBId = String(formData.get("versionBId") ?? "");
  const requestedName = String(formData.get("name") ?? "").trim();
  const datasetValue = String(formData.get("dataset") ?? "development");
  const modeValue = String(formData.get("mode") ?? "paste");
  const repetitions = Number(formData.get("repetitions") ?? "1");
  if (datasetValue !== "development" && datasetValue !== "holdout") {
    return { error: "Choose the development set or the holdout set." };
  }
  if (modeValue !== "live" && modeValue !== "demo" && modeValue !== "paste") {
    return { error: "Choose a live run, demo mode, or a paste worksheet." };
  }
  const dataset = datasetValue as ScenarioSet;
  const database = await getDatabase();
  const versions = listVersions(database, projectId);
  const versionA = versions.find((version) => version.id === versionAId);
  const versionB = versions.find((version) => version.id === versionBId);
  const name =
    requestedName ||
    (versionA && versionB ? `${versionA.name} vs ${versionB.name}` : "Comparison");
  if (name.length > 80) return { error: "The evaluation name must be 80 characters or fewer." };
  if (modeValue === "live") {
    const keys = providerAvailability();
    for (const version of [versionA, versionB]) {
      if (!version) continue;
      if (!keys[version.provider]) {
        return {
          error: `No ${version.provider === "anthropic" ? "Anthropic" : "OpenAI"} API key is configured. Use demo mode, or add the key on the server and restart.`,
        };
      }
    }
  }
  const scenarioIds = listScenarios(database, projectId)
    .filter((scenario) => scenario.dataset === dataset)
    .map((scenario) => scenario.id);
  if (scenarioIds.length === 0) {
    return { error: `Add a ${dataset === "holdout" ? "holdout" : "development"} scenario first.` };
  }
  const id = crypto.randomUUID();
  const result = createRun(database, {
    id,
    projectId,
    name,
    versionAId,
    versionBId,
    scenarioIds,
    now: nowIso(),
    dataset,
    repetitions,
    mode: modeValue === "paste" ? "unset" : modeValue,
  });
  if (!result.ok) return { error: result.error };
  if (modeValue === "live") startRunExecution(id);
  refreshProject(projectId);
  redirect(`/projects/${projectId}/compare/${id}`);
}

export async function submitReplies(
  projectId: string,
  runId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const database = await getDatabase();
  const responses = listResponses(database, runId);
  const texts: Record<string, string> = {};
  for (const response of responses) {
    const value = formData.get(`reply:${response.id}`);
    texts[response.id] = typeof value === "string" ? value : "";
  }
  const saved = saveReplies(database, runId, texts, nowIso());
  if (!saved.ok) return { error: saved.error };
  if (String(formData.get("intent") ?? "") !== "grade") {
    refreshProject(projectId);
    redirect(`/projects/${projectId}/compare/${runId}?notice=replies-saved`);
  }
  const result = await gradeRun(database, runId, nowIso());
  if (!result.ok) return { error: result.error };
  refreshProject(projectId);
  redirect(`/projects/${projectId}/compare/${runId}?notice=graded`);
}

export async function removeRun(projectId: string, runId: string): Promise<void> {
  const database = await getDatabase();
  const result = deleteRun(database, projectId, runId);
  refreshProject(projectId);
  if (!result.ok) redirect(`/projects/${projectId}/compare?error=sample-locked`);
  redirect(`/projects/${projectId}/compare?notice=deleted`);
}
