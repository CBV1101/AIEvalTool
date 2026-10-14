"use server";

import { redirect } from "next/navigation";
import {
  deleteReference,
  deleteRequirement,
  deleteScenario,
  deleteVersion,
  insertReference,
  insertRequirement,
  insertScenarios,
  insertScenario,
  insertVersion,
  moveRequirement,
  moveScenario,
  moveVersion,
  updateReference,
  updateRequirement,
  updateScenario,
  updateVersion,
} from "@/lib/db/mutations";
import { listRequirements } from "@/lib/db/queries";
import { getDatabase } from "@/lib/db/server";
import { nowIso, refreshProject } from "@/lib/actions/shared";
import { parseScenarioCsv, SCENARIO_CSV_HEADERS } from "@/lib/scenarios/csv";
import type { ActionState } from "@/lib/types";
import {
  parseReferenceForm,
  parseRequirementForm,
  parseScenarioForm,
  parseVersionForm,
} from "@/lib/validators";

export type ImportState = {
  error?: string;
  imported?: number;
  rows: { line: number; name: string; userInput: string; errors: string[] }[];
  csv: string;
  reviewed: boolean;
};

function setupError(projectId: string, hash: string): never {
  redirect(`/projects/${projectId}/setup?error=demo-locked#${hash}`);
}

function inUse(projectId: string, hash: string): never {
  redirect(`/projects/${projectId}/setup?error=in-use#${hash}`);
}

export async function createRequirement(
  projectId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = parseRequirementForm(formData);
  if (!parsed.ok) return { error: parsed.error };
  const database = await getDatabase();
  const result = insertRequirement(
    database,
    projectId,
    crypto.randomUUID(),
    parsed.value,
    nowIso(),
  );
  if (!result.ok) return { error: result.error };
  refreshProject(projectId);
  redirect(`/projects/${projectId}/setup?notice=saved#requirements`);
}

export async function saveRequirement(
  projectId: string,
  requirementId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = parseRequirementForm(formData);
  if (!parsed.ok) return { error: parsed.error };
  const database = await getDatabase();
  const result = updateRequirement(database, projectId, requirementId, parsed.value, nowIso());
  if (!result.ok) return { error: result.error };
  refreshProject(projectId);
  redirect(`/projects/${projectId}/setup?notice=saved#requirements`);
}

export async function removeRequirement(projectId: string, requirementId: string): Promise<void> {
  const database = await getDatabase();
  const result = deleteRequirement(database, projectId, requirementId);
  if (!result.ok) {
    if (result.error.includes("already part")) inUse(projectId, "requirements");
    setupError(projectId, "requirements");
  }
  refreshProject(projectId);
  redirect(`/projects/${projectId}/setup?notice=deleted#requirements`);
}

export async function reorderRequirement(
  projectId: string,
  requirementId: string,
  direction: "up" | "down",
): Promise<void> {
  const database = await getDatabase();
  const result = moveRequirement(database, projectId, requirementId, direction, nowIso());
  if (!result.ok) setupError(projectId, "requirements");
  refreshProject(projectId);
  redirect(`/projects/${projectId}/setup#requirements`);
}

export async function createScenario(
  projectId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const database = await getDatabase();
  const parsed = parseScenarioForm(formData, listRequirements(database, projectId));
  if (!parsed.ok) return { error: parsed.error };
  const result = insertScenario(database, projectId, crypto.randomUUID(), parsed.value, nowIso());
  if (!result.ok) return { error: result.error };
  refreshProject(projectId);
  redirect(`/projects/${projectId}/setup?notice=saved#scenarios`);
}

export async function saveScenario(
  projectId: string,
  scenarioId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const database = await getDatabase();
  const parsed = parseScenarioForm(formData, listRequirements(database, projectId));
  if (!parsed.ok) return { error: parsed.error };
  const result = updateScenario(database, projectId, scenarioId, parsed.value, nowIso());
  if (!result.ok) return { error: result.error };
  refreshProject(projectId);
  redirect(`/projects/${projectId}/setup?notice=saved#scenarios`);
}

export async function removeScenario(projectId: string, scenarioId: string): Promise<void> {
  const database = await getDatabase();
  const result = deleteScenario(database, projectId, scenarioId);
  if (!result.ok) {
    if (result.error.includes("already part")) inUse(projectId, "scenarios");
    setupError(projectId, "scenarios");
  }
  refreshProject(projectId);
  redirect(`/projects/${projectId}/setup?notice=deleted#scenarios`);
}

export async function reorderScenario(
  projectId: string,
  scenarioId: string,
  direction: "up" | "down",
): Promise<void> {
  const database = await getDatabase();
  const result = moveScenario(database, projectId, scenarioId, direction, nowIso());
  if (!result.ok) setupError(projectId, "scenarios");
  refreshProject(projectId);
  redirect(`/projects/${projectId}/setup#scenarios`);
}

export async function createVersion(
  projectId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = parseVersionForm(formData);
  if (!parsed.ok) return { error: parsed.error };
  const database = await getDatabase();
  const result = insertVersion(database, projectId, crypto.randomUUID(), parsed.value, nowIso());
  if (!result.ok) return { error: result.error };
  refreshProject(projectId);
  redirect(`/projects/${projectId}/setup?notice=saved#versions`);
}

export async function saveVersion(
  projectId: string,
  versionId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = parseVersionForm(formData);
  if (!parsed.ok) return { error: parsed.error };
  const database = await getDatabase();
  const result = updateVersion(database, projectId, versionId, parsed.value, nowIso());
  if (!result.ok) return { error: result.error };
  refreshProject(projectId);
  redirect(`/projects/${projectId}/setup?notice=saved#versions`);
}

export async function removeVersion(projectId: string, versionId: string): Promise<void> {
  const database = await getDatabase();
  const result = deleteVersion(database, projectId, versionId);
  if (!result.ok) {
    if (result.error.includes("already part")) inUse(projectId, "versions");
    setupError(projectId, "versions");
  }
  refreshProject(projectId);
  redirect(`/projects/${projectId}/setup?notice=deleted#versions`);
}

async function csvText(formData: FormData): Promise<{ csv: string; error?: string }> {
  const pasted = formData.get("csv");
  const pastedText = typeof pasted === "string" ? pasted : "";
  if (pastedText.trim()) return { csv: pastedText };
  const file = formData.get("file");
  if (file instanceof File && file.size > 0) {
    if (file.size > 500_000) {
      return { csv: "", error: "This CSV is larger than 500 KB. Split it into smaller files." };
    }
    return { csv: await file.text() };
  }
  return { csv: "", error: "Add a CSV file or paste CSV text." };
}

export async function reviewScenarioCsv(
  projectId: string,
  _prev: ImportState,
  formData: FormData,
): Promise<ImportState> {
  const loaded = await csvText(formData);
  if (loaded.error) return { error: loaded.error, rows: [], csv: "", reviewed: false };
  const database = await getDatabase();
  const requirements = listRequirements(database, projectId);
  const parsed = parseScenarioCsv(loaded.csv, requirements);
  if (parsed.fileError) {
    return { error: parsed.fileError, rows: [], csv: loaded.csv, reviewed: true };
  }
  const intent = formData.get("intent");
  if (intent === "import") {
    const valid = parsed.rows.flatMap((row) => (row.value ? [row.value] : []));
    const invalid = parsed.rows.filter((row) => row.errors.length > 0);
    if (valid.length === 0) {
      return {
        error: "Every row needs a fix before it can be imported.",
        rows: parsed.rows.map(presentRow),
        csv: loaded.csv,
        reviewed: true,
      };
    }
    const result = insertScenarios(database, projectId, valid, nowIso());
    if (!result.ok) return { error: result.error, rows: parsed.rows.map(presentRow), csv: loaded.csv, reviewed: true };
    refreshProject(projectId);
    const remaining = [parsed.header ?? SCENARIO_CSV_HEADERS.join(","), ...invalid.map((row) => row.source)]
      .join("\n");
    return {
      imported: result.value.count,
      rows: invalid.map(presentRow),
      csv: invalid.length > 0 ? remaining : "",
      reviewed: true,
    };
  }
  return { rows: parsed.rows.map(presentRow), csv: loaded.csv, reviewed: true };
}

function presentRow(row: { line: number; name: string; userInput: string; errors: string[] }) {
  return {
    line: row.line,
    name: row.name,
    userInput: row.userInput,
    errors: row.errors,
  };
}

export async function createReference(
  projectId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = parseReferenceForm(formData);
  if (!parsed.ok) return { error: parsed.error };
  const database = await getDatabase();
  const result = insertReference(database, projectId, crypto.randomUUID(), parsed.value, nowIso());
  if (!result.ok) return { error: result.error };
  refreshProject(projectId);
  redirect(`/projects/${projectId}/setup?notice=saved#reference`);
}

export async function saveReference(
  projectId: string,
  materialId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = parseReferenceForm(formData);
  if (!parsed.ok) return { error: parsed.error };
  const database = await getDatabase();
  const result = updateReference(database, projectId, materialId, parsed.value, nowIso());
  if (!result.ok) return { error: result.error };
  refreshProject(projectId);
  redirect(`/projects/${projectId}/setup?notice=saved#reference`);
}

export async function removeReference(projectId: string, materialId: string): Promise<void> {
  const database = await getDatabase();
  const result = deleteReference(database, projectId, materialId);
  if (!result.ok) setupError(projectId, "reference");
  refreshProject(projectId);
  redirect(`/projects/${projectId}/setup?notice=deleted#reference`);
}

export async function reorderVersion(
  projectId: string,
  versionId: string,
  direction: "up" | "down",
): Promise<void> {
  const database = await getDatabase();
  const result = moveVersion(database, projectId, versionId, direction, nowIso());
  if (!result.ok) setupError(projectId, "versions");
  refreshProject(projectId);
  redirect(`/projects/${projectId}/setup#versions`);
}
