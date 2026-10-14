import type { DatabaseSync } from "node:sqlite";
import {
  mapGrade,
  mapMaterial,
  mapProject,
  mapRequirement,
  mapResponse,
  mapReview,
  mapRun,
  mapScenario,
  mapVersion,
} from "@/lib/db/mappers";
import { all, get } from "@/lib/db/sql";
import type { RunBundle } from "@/lib/eval/report";
import type {
  EvaluationRun,
  GradeRecord,
  Project,
  PromptVersion,
  ReferenceMaterial,
  Requirement,
  ResponseRecord,
  ReviewRecord,
  Scenario,
} from "@/lib/types";

export function listProjects(db: DatabaseSync): Project[] {
  return all<Parameters<typeof mapProject>[0]>(
    db,
    "SELECT * FROM projects ORDER BY updated_at DESC, name COLLATE NOCASE",
  ).map(mapProject);
}

export function getProject(db: DatabaseSync, id: string): Project | undefined {
  const row = get<Parameters<typeof mapProject>[0]>(
    db,
    "SELECT * FROM projects WHERE id = ?",
    [id],
  );
  return row ? mapProject(row) : undefined;
}

export function listRequirements(db: DatabaseSync, projectId: string): Requirement[] {
  return all<Parameters<typeof mapRequirement>[0]>(
    db,
    "SELECT * FROM requirements WHERE project_id = ? ORDER BY position, title",
    [projectId],
  ).map(mapRequirement);
}

export function getRequirement(db: DatabaseSync, id: string): Requirement | undefined {
  const row = get<Parameters<typeof mapRequirement>[0]>(
    db,
    "SELECT * FROM requirements WHERE id = ?",
    [id],
  );
  return row ? mapRequirement(row) : undefined;
}

function attachRequirementLinks(db: DatabaseSync, scenarios: Scenario[]): Scenario[] {
  if (scenarios.length === 0) return scenarios;
  const ids = scenarios.map((scenario) => scenario.id);
  const placeholders = ids.map(() => "?").join(", ");
  const links = all<{ scenario_id: string; requirement_id: string }>(
    db,
    `SELECT scenario_id, requirement_id FROM scenario_requirements
     WHERE scenario_id IN (${placeholders})
     ORDER BY requirement_id`,
    ids,
  );
  const byScenario = new Map<string, string[]>();
  for (const link of links) {
    const list = byScenario.get(link.scenario_id) ?? [];
    list.push(link.requirement_id);
    byScenario.set(link.scenario_id, list);
  }
  return scenarios.map((scenario) => ({
    ...scenario,
    requirementIds: scenario.appliesToAll ? [] : (byScenario.get(scenario.id) ?? []),
  }));
}

export function listScenarios(db: DatabaseSync, projectId: string): Scenario[] {
  const scenarios = all<Parameters<typeof mapScenario>[0]>(
    db,
    "SELECT * FROM scenarios WHERE project_id = ? ORDER BY position, title",
    [projectId],
  ).map(mapScenario);
  return attachRequirementLinks(db, scenarios);
}

export function getScenario(db: DatabaseSync, id: string): Scenario | undefined {
  const row = get<Parameters<typeof mapScenario>[0]>(
    db,
    "SELECT * FROM scenarios WHERE id = ?",
    [id],
  );
  if (!row) return undefined;
  return attachRequirementLinks(db, [mapScenario(row)])[0];
}

export function listReferenceMaterials(db: DatabaseSync, projectId: string): ReferenceMaterial[] {
  return all<Parameters<typeof mapMaterial>[0]>(
    db,
    "SELECT * FROM reference_materials WHERE project_id = ? ORDER BY position, title",
    [projectId],
  ).map(mapMaterial);
}

export function getReferenceMaterial(db: DatabaseSync, id: string): ReferenceMaterial | undefined {
  const row = get<Parameters<typeof mapMaterial>[0]>(
    db,
    "SELECT * FROM reference_materials WHERE id = ?",
    [id],
  );
  return row ? mapMaterial(row) : undefined;
}

export function listVersions(db: DatabaseSync, projectId: string): PromptVersion[] {
  return all<Parameters<typeof mapVersion>[0]>(
    db,
    "SELECT * FROM prompt_versions WHERE project_id = ? ORDER BY position, name",
    [projectId],
  ).map(mapVersion);
}

export function getVersion(db: DatabaseSync, id: string): PromptVersion | undefined {
  const row = get<Parameters<typeof mapVersion>[0]>(
    db,
    "SELECT * FROM prompt_versions WHERE id = ?",
    [id],
  );
  return row ? mapVersion(row) : undefined;
}

export function listRuns(db: DatabaseSync, projectId: string): EvaluationRun[] {
  return all<Parameters<typeof mapRun>[0]>(
    db,
    "SELECT * FROM evaluation_runs WHERE project_id = ? ORDER BY created_at DESC",
    [projectId],
  ).map(mapRun);
}

export function getRun(db: DatabaseSync, id: string): EvaluationRun | undefined {
  const row = get<Parameters<typeof mapRun>[0]>(
    db,
    "SELECT * FROM evaluation_runs WHERE id = ?",
    [id],
  );
  return row ? mapRun(row) : undefined;
}

export function listResponses(db: DatabaseSync, runId: string): ResponseRecord[] {
  return all<Parameters<typeof mapResponse>[0]>(
    db,
    "SELECT * FROM responses WHERE run_id = ? ORDER BY scenario_position, repetition, version_id",
    [runId],
  ).map(mapResponse);
}

export function listGradesForRun(db: DatabaseSync, runId: string): GradeRecord[] {
  return all<Parameters<typeof mapGrade>[0]>(
    db,
    `SELECT grades.* FROM grades
     JOIN responses ON responses.id = grades.response_id
     WHERE responses.run_id = ?
     ORDER BY grades.requirement_position, responses.scenario_position`,
    [runId],
  ).map(mapGrade);
}

export function listReviewsForRun(db: DatabaseSync, runId: string): ReviewRecord[] {
  return all<Parameters<typeof mapReview>[0]>(
    db,
    `SELECT human_reviews.* FROM human_reviews
     JOIN grades ON grades.id = human_reviews.grade_id
     JOIN responses ON responses.id = grades.response_id
     WHERE responses.run_id = ?`,
    [runId],
  ).map(mapReview);
}

export function getRunBundle(db: DatabaseSync, runId: string): RunBundle | undefined {
  const run = getRun(db, runId);
  if (!run) return undefined;
  return {
    run,
    responses: listResponses(db, runId),
    grades: listGradesForRun(db, runId),
    reviews: listReviewsForRun(db, runId),
  };
}

export function nextPosition(
  db: DatabaseSync,
  table: "requirements" | "scenarios" | "prompt_versions" | "reference_materials",
  projectId: string,
): number {
  const row = get<{ max_position: number | null }>(
    db,
    `SELECT MAX(position) AS max_position FROM ${table} WHERE project_id = ?`,
    [projectId],
  );
  return (row?.max_position ?? 0) + 1;
}

export function requirementInUse(db: DatabaseSync, id: string): boolean {
  return Boolean(get(db, "SELECT id FROM grades WHERE requirement_id = ? LIMIT 1", [id]));
}

export function scenarioInUse(db: DatabaseSync, id: string): boolean {
  return Boolean(get(db, "SELECT id FROM responses WHERE scenario_id = ? LIMIT 1", [id]));
}

export function versionInUse(db: DatabaseSync, id: string): boolean {
  return Boolean(
    get(
      db,
      "SELECT id FROM evaluation_runs WHERE version_a_id = ? OR version_b_id = ? LIMIT 1",
      [id, id],
    ),
  );
}

export function getGrade(db: DatabaseSync, id: string): GradeRecord | undefined {
  const row = get<Parameters<typeof mapGrade>[0]>(db, "SELECT * FROM grades WHERE id = ?", [id]);
  return row ? mapGrade(row) : undefined;
}

export function getReviewForGrade(db: DatabaseSync, gradeId: string): ReviewRecord | undefined {
  const row = get<Parameters<typeof mapReview>[0]>(
    db,
    "SELECT * FROM human_reviews WHERE grade_id = ?",
    [gradeId],
  );
  return row ? mapReview(row) : undefined;
}
