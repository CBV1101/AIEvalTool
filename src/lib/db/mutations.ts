import type { DatabaseSync } from "node:sqlite";
import { fingerprintProject, fingerprintSetup } from "@/lib/eval/fingerprint";
import { judgeRequirement, mapLimit } from "@/lib/eval/grader";
import type { CompleteCall } from "@/lib/eval/execute";
import { completeWithProvider, providerAvailability } from "@/lib/providers";
import { demoOutput } from "@/lib/eval/execute";
import { buildEvaluationPrompt, composePrompt } from "@/lib/eval/prompts";
import { captureSnapshot, parseRunSnapshot, serializeSnapshot } from "@/lib/eval/snapshot";
import { applicableRequirements } from "@/lib/scenarios/links";
import {
  getProject,
  getReferenceMaterial,
  getRequirement,
  getRun,
  getScenario,
  getVersion,
  listReferenceMaterials,
  listRequirements,
  listResponses,
  listScenarios,
  listVersions,
  nextPosition,
  requirementInUse,
  scenarioInUse,
  versionInUse,
} from "@/lib/db/queries";
import { get, run, transaction } from "@/lib/db/sql";
import type {
  ProjectInput,
  ReferenceInput,
  RequirementInput,
  ScenarioInput,
  VersionInput,
} from "@/lib/validators";
import type { ResponseSource, RunMode, RunSource, ScenarioSet } from "@/lib/types";

export type Result<T = undefined> =
  | { ok: true; value: T }
  | { ok: false; error: string };

const DEMO_LOCK =
  "The demo project is locked so the sample story stays intact. Copy it to change the setup.";
const IN_USE =
  "This is already part of an evaluation. Keep it so those results stay readable, or delete the evaluation first.";

function fail(error: string): Result<never> {
  return { ok: false, error };
}

function touch(db: DatabaseSync, projectId: string, now: string): void {
  run(db, "UPDATE projects SET updated_at = ? WHERE id = ?", [now, projectId]);
}

export function insertProject(
  db: DatabaseSync,
  input: ProjectInput & { id: string; now: string },
): Result<{ id: string }> {
  run(
    db,
    `INSERT INTO projects (
      id, name, feature_summary, decision_note, min_pass_rate, grader_provider, grader_model,
      is_demo, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
    [
      input.id,
      input.name,
      input.featureSummary,
      input.decisionNote,
      input.minPassRate,
      input.graderProvider ?? "openai",
      input.graderModel ?? "",
      input.now,
      input.now,
    ],
  );
  return { ok: true, value: { id: input.id } };
}

export function updateProject(
  db: DatabaseSync,
  projectId: string,
  input: ProjectInput,
  now: string,
): Result {
  const project = getProject(db, projectId);
  if (!project) return fail("That project could not be found.");
  if (project.isDemo) return fail(DEMO_LOCK);
  run(
    db,
    `UPDATE projects
     SET name = ?, feature_summary = ?, decision_note = ?, min_pass_rate = ?,
         grader_provider = ?, grader_model = ?, updated_at = ?
     WHERE id = ?`,
    [
      input.name,
      input.featureSummary,
      input.decisionNote,
      input.minPassRate,
      input.graderProvider,
      input.graderModel,
      now,
      projectId,
    ],
  );
  return { ok: true, value: undefined };
}

export function deleteProject(db: DatabaseSync, projectId: string, confirm: string): Result {
  const project = getProject(db, projectId);
  if (!project) return fail("That project could not be found.");
  if (project.isDemo) return fail(DEMO_LOCK);
  if (confirm !== "yes") return fail("Confirm the deletion to remove this project.");
  run(db, "DELETE FROM projects WHERE id = ?", [projectId]);
  return { ok: true, value: undefined };
}

export function copyProject(
  db: DatabaseSync,
  sourceId: string,
  newId: string,
  now: string,
): Result<{ id: string }> {
  const project = getProject(db, sourceId);
  if (!project) return fail("That project could not be found.");
  const requirements = listRequirements(db, sourceId);
  const scenarios = listScenarios(db, sourceId);
  const versions = listVersions(db, sourceId);
  const name = (
    project.isDemo ? `${project.name} (your copy)` : `Copy of ${project.name}`
  ).slice(0, 80);

  transaction(db, () => {
    run(
      db,
      `INSERT INTO projects (
        id, name, feature_summary, decision_note, min_pass_rate, grader_provider, grader_model,
        is_demo, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      [
        newId,
        name,
        project.featureSummary,
        project.decisionNote,
        project.minPassRate,
        project.graderProvider,
        project.graderModel,
        now,
        now,
      ],
    );
    const requirementIds = new Map<string, string>();
    for (const requirement of requirements) {
      const id = crypto.randomUUID();
      requirementIds.set(requirement.id, id);
      run(
        db,
        `INSERT INTO requirements (
          id, project_id, title, details, pass_guidance, fail_guidance, critical, priority, pass_percent,
          check_type, check_config, position, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          newId,
          requirement.title,
          requirement.details,
          requirement.passGuidance,
          requirement.failGuidance,
          requirement.critical ? 1 : 0,
          requirement.priority,
          requirement.passPercent,
          requirement.checkType,
          JSON.stringify(requirement.checkConfig),
          requirement.position,
          now,
          now,
        ],
      );
    }
    for (const scenario of scenarios) {
      const id = crypto.randomUUID();
      run(
        db,
        `INSERT INTO scenarios (
          id, project_id, title, customer_input, situation, good_looks_like, reference_answer,
          category, dataset, applies_to_all, position, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          newId,
          scenario.title,
          scenario.customerInput,
          scenario.situation,
          scenario.goodLooksLike,
          scenario.referenceAnswer,
          scenario.category,
          scenario.dataset,
          scenario.appliesToAll ? 1 : 0,
          scenario.position,
          now,
          now,
        ],
      );
      if (!scenario.appliesToAll) {
        for (const requirementId of scenario.requirementIds) {
          const copiedRequirementId = requirementIds.get(requirementId);
          if (!copiedRequirementId) continue;
          run(
            db,
            "INSERT INTO scenario_requirements (scenario_id, requirement_id) VALUES (?, ?)",
            [id, copiedRequirementId],
          );
        }
      }
    }
    for (const material of listReferenceMaterials(db, sourceId)) {
      run(
        db,
        `INSERT INTO reference_materials (
          id, project_id, title, body, kind, position, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          crypto.randomUUID(),
          newId,
          material.title,
          material.body,
          material.kind,
          material.position,
          now,
          now,
        ],
      );
    }
    for (const version of versions) {
      run(
        db,
        `INSERT INTO prompt_versions (
          id, project_id, name, change_notes, instructions, message_template, provider, model,
          position, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          crypto.randomUUID(),
          newId,
          version.name,
          version.changeNotes,
          version.instructions,
          version.messageTemplate,
          version.provider,
          version.model,
          version.position,
          now,
          now,
        ],
      );
    }
  });

  return { ok: true, value: { id: newId } };
}

export function insertRequirement(
  db: DatabaseSync,
  projectId: string,
  id: string,
  input: RequirementInput,
  now: string,
): Result {
  const project = getProject(db, projectId);
  if (!project) return fail("That project could not be found.");
  if (project.isDemo) return fail(DEMO_LOCK);
  const position = nextPosition(db, "requirements", projectId);
  transaction(db, () => {
    run(
      db,
        `INSERT INTO requirements (
        id, project_id, title, details, pass_guidance, fail_guidance, critical, priority, pass_percent,
        check_type, check_config, position, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        projectId,
        input.title,
        input.details,
        input.passGuidance,
        input.failGuidance,
        input.critical ? 1 : 0,
        input.priority,
        input.passPercent,
        input.checkType,
        JSON.stringify(input.checkConfig),
        position,
        now,
        now,
      ],
    );
    touch(db, projectId, now);
  });
  return { ok: true, value: undefined };
}

export function updateRequirement(
  db: DatabaseSync,
  projectId: string,
  requirementId: string,
  input: RequirementInput,
  now: string,
): Result {
  const project = getProject(db, projectId);
  if (!project) return fail("That project could not be found.");
  if (project.isDemo) return fail(DEMO_LOCK);
  const requirement = getRequirement(db, requirementId);
  if (!requirement || requirement.projectId !== projectId) {
    return fail("That requirement could not be found.");
  }
  transaction(db, () => {
    run(
      db,
      `UPDATE requirements
       SET title = ?, details = ?, pass_guidance = ?, fail_guidance = ?, critical = ?, priority = ?,
           pass_percent = ?, check_type = ?, check_config = ?, updated_at = ?
       WHERE id = ?`,
      [
        input.title,
        input.details,
        input.passGuidance,
        input.failGuidance,
        input.critical ? 1 : 0,
        input.priority,
        input.passPercent,
        input.checkType,
        JSON.stringify(input.checkConfig),
        now,
        requirementId,
      ],
    );
    touch(db, projectId, now);
  });
  return { ok: true, value: undefined };
}

export function deleteRequirement(
  db: DatabaseSync,
  projectId: string,
  requirementId: string,
): Result {
  const project = getProject(db, projectId);
  if (!project) return fail("That project could not be found.");
  if (project.isDemo) return fail(DEMO_LOCK);
  const requirement = getRequirement(db, requirementId);
  if (!requirement || requirement.projectId !== projectId) {
    return fail("That requirement could not be found.");
  }
  if (requirementInUse(db, requirementId)) return fail(IN_USE);
  transaction(db, () => {
    run(db, "DELETE FROM requirements WHERE id = ?", [requirementId]);
    touch(db, projectId, new Date().toISOString());
  });
  return { ok: true, value: undefined };
}

export function moveRequirement(
  db: DatabaseSync,
  projectId: string,
  requirementId: string,
  direction: "up" | "down",
  now: string,
): Result {
  return moveRow(db, "requirements", projectId, requirementId, direction, now);
}

export function insertScenario(
  db: DatabaseSync,
  projectId: string,
  id: string,
  input: ScenarioInput,
  now: string,
): Result {
  const project = getProject(db, projectId);
  if (!project) return fail("That project could not be found.");
  if (project.isDemo) return fail(DEMO_LOCK);
  const position = nextPosition(db, "scenarios", projectId);
  transaction(db, () => {
    run(
      db,
        `INSERT INTO scenarios (
        id, project_id, title, customer_input, situation, good_looks_like, reference_answer,
        category, dataset, applies_to_all, position, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        projectId,
        input.title,
        input.customerInput,
        input.situation,
        input.goodLooksLike,
        input.referenceAnswer,
        input.category,
        input.dataset,
        input.appliesToAll ? 1 : 0,
        position,
        now,
        now,
      ],
    );
    replaceScenarioLinks(db, id, input);
    touch(db, projectId, now);
  });
  return { ok: true, value: undefined };
}

export function updateScenario(
  db: DatabaseSync,
  projectId: string,
  scenarioId: string,
  input: ScenarioInput,
  now: string,
): Result {
  const project = getProject(db, projectId);
  if (!project) return fail("That project could not be found.");
  if (project.isDemo) return fail(DEMO_LOCK);
  const scenario = getScenario(db, scenarioId);
  if (!scenario || scenario.projectId !== projectId) {
    return fail("That scenario could not be found.");
  }
  transaction(db, () => {
    run(
      db,
      `UPDATE scenarios
       SET title = ?, customer_input = ?, situation = ?, good_looks_like = ?, reference_answer = ?,
           category = ?, dataset = ?, applies_to_all = ?, updated_at = ?
       WHERE id = ?`,
      [
        input.title,
        input.customerInput,
        input.situation,
        input.goodLooksLike,
        input.referenceAnswer,
        input.category,
        input.dataset,
        input.appliesToAll ? 1 : 0,
        now,
        scenarioId,
      ],
    );
    replaceScenarioLinks(db, scenarioId, input);
    touch(db, projectId, now);
  });
  return { ok: true, value: undefined };
}

export function deleteScenario(db: DatabaseSync, projectId: string, scenarioId: string): Result {
  const project = getProject(db, projectId);
  if (!project) return fail("That project could not be found.");
  if (project.isDemo) return fail(DEMO_LOCK);
  const scenario = getScenario(db, scenarioId);
  if (!scenario || scenario.projectId !== projectId) {
    return fail("That scenario could not be found.");
  }
  if (scenarioInUse(db, scenarioId)) return fail(IN_USE);
  transaction(db, () => {
    run(db, "DELETE FROM scenarios WHERE id = ?", [scenarioId]);
    touch(db, projectId, new Date().toISOString());
  });
  return { ok: true, value: undefined };
}

export function moveScenario(
  db: DatabaseSync,
  projectId: string,
  scenarioId: string,
  direction: "up" | "down",
  now: string,
): Result {
  return moveRow(db, "scenarios", projectId, scenarioId, direction, now);
}

function replaceScenarioLinks(db: DatabaseSync, scenarioId: string, input: ScenarioInput): void {
  run(db, "DELETE FROM scenario_requirements WHERE scenario_id = ?", [scenarioId]);
  if (input.appliesToAll) return;
  for (const requirementId of input.requirementIds) {
    run(db, "INSERT INTO scenario_requirements (scenario_id, requirement_id) VALUES (?, ?)", [
      scenarioId,
      requirementId,
    ]);
  }
}

export function insertScenarios(
  db: DatabaseSync,
  projectId: string,
  inputs: ScenarioInput[],
  now: string,
): Result<{ count: number }> {
  const project = getProject(db, projectId);
  if (!project) return fail("That project could not be found.");
  if (project.isDemo) return fail(DEMO_LOCK);
  if (inputs.length === 0) return fail("There are no valid scenarios to import.");
  transaction(db, () => {
    let position = nextPosition(db, "scenarios", projectId);
    for (const input of inputs) {
      const id = crypto.randomUUID();
      run(
        db,
        `INSERT INTO scenarios (
          id, project_id, title, customer_input, situation, good_looks_like, reference_answer,
          category, dataset, applies_to_all, position, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          projectId,
          input.title,
          input.customerInput,
          input.situation,
          input.goodLooksLike,
          input.referenceAnswer,
          input.category,
          input.dataset,
          input.appliesToAll ? 1 : 0,
          position,
          now,
          now,
        ],
      );
      replaceScenarioLinks(db, id, input);
      position += 1;
    }
    touch(db, projectId, now);
  });
  return { ok: true, value: { count: inputs.length } };
}

export function insertReference(
  db: DatabaseSync,
  projectId: string,
  id: string,
  input: ReferenceInput,
  now: string,
): Result {
  const project = getProject(db, projectId);
  if (!project) return fail("That project could not be found.");
  if (project.isDemo) return fail(DEMO_LOCK);
  const position = nextPosition(db, "reference_materials", projectId);
  transaction(db, () => {
    run(
      db,
      `INSERT INTO reference_materials (
        id, project_id, title, body, kind, position, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, projectId, input.title, input.body, input.kind, position, now, now],
    );
    touch(db, projectId, now);
  });
  return { ok: true, value: undefined };
}

export function updateReference(
  db: DatabaseSync,
  projectId: string,
  materialId: string,
  input: ReferenceInput,
  now: string,
): Result {
  const project = getProject(db, projectId);
  if (!project) return fail("That project could not be found.");
  if (project.isDemo) return fail(DEMO_LOCK);
  const material = getReferenceMaterial(db, materialId);
  if (!material || material.projectId !== projectId) {
    return fail("That reference could not be found.");
  }
  transaction(db, () => {
    run(
      db,
      "UPDATE reference_materials SET title = ?, body = ?, kind = ?, updated_at = ? WHERE id = ?",
      [input.title, input.body, input.kind, now, materialId],
    );
    touch(db, projectId, now);
  });
  return { ok: true, value: undefined };
}

export function deleteReference(db: DatabaseSync, projectId: string, materialId: string): Result {
  const project = getProject(db, projectId);
  if (!project) return fail("That project could not be found.");
  if (project.isDemo) return fail(DEMO_LOCK);
  const material = getReferenceMaterial(db, materialId);
  if (!material || material.projectId !== projectId) {
    return fail("That reference could not be found.");
  }
  transaction(db, () => {
    run(db, "DELETE FROM reference_materials WHERE id = ?", [materialId]);
    touch(db, projectId, new Date().toISOString());
  });
  return { ok: true, value: undefined };
}

export function insertVersion(
  db: DatabaseSync,
  projectId: string,
  id: string,
  input: VersionInput,
  now: string,
): Result {
  const project = getProject(db, projectId);
  if (!project) return fail("That project could not be found.");
  if (project.isDemo) return fail(DEMO_LOCK);
  const position = nextPosition(db, "prompt_versions", projectId);
  transaction(db, () => {
    run(
      db,
      `INSERT INTO prompt_versions (
        id, project_id, name, change_notes, instructions, message_template, provider, model,
        position, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        projectId,
        input.name,
        input.changeNotes,
        input.instructions,
        input.messageTemplate,
        input.provider,
        input.model,
        position,
        now,
        now,
      ],
    );
    touch(db, projectId, now);
  });
  return { ok: true, value: undefined };
}

export function updateVersion(
  db: DatabaseSync,
  projectId: string,
  versionId: string,
  input: VersionInput,
  now: string,
): Result {
  const project = getProject(db, projectId);
  if (!project) return fail("That project could not be found.");
  if (project.isDemo) return fail(DEMO_LOCK);
  const version = getVersion(db, versionId);
  if (!version || version.projectId !== projectId) {
    return fail("That prompt version could not be found.");
  }
  transaction(db, () => {
    run(
      db,
      `UPDATE prompt_versions
       SET name = ?, change_notes = ?, instructions = ?, message_template = ?, provider = ?, model = ?, updated_at = ?
       WHERE id = ?`,
      [
        input.name,
        input.changeNotes,
        input.instructions,
        input.messageTemplate,
        input.provider,
        input.model,
        now,
        versionId,
      ],
    );
    touch(db, projectId, now);
  });
  return { ok: true, value: undefined };
}

export function deleteVersion(db: DatabaseSync, projectId: string, versionId: string): Result {
  const project = getProject(db, projectId);
  if (!project) return fail("That project could not be found.");
  if (project.isDemo) return fail(DEMO_LOCK);
  const version = getVersion(db, versionId);
  if (!version || version.projectId !== projectId) {
    return fail("That prompt version could not be found.");
  }
  if (versionInUse(db, versionId)) return fail(IN_USE);
  transaction(db, () => {
    run(db, "DELETE FROM prompt_versions WHERE id = ?", [versionId]);
    touch(db, projectId, new Date().toISOString());
  });
  return { ok: true, value: undefined };
}

export function moveVersion(
  db: DatabaseSync,
  projectId: string,
  versionId: string,
  direction: "up" | "down",
  now: string,
): Result {
  return moveRow(db, "prompt_versions", projectId, versionId, direction, now);
}

function moveRow(
  db: DatabaseSync,
  table: "requirements" | "scenarios" | "prompt_versions",
  projectId: string,
  id: string,
  direction: "up" | "down",
  now: string,
): Result {
  const project = getProject(db, projectId);
  if (!project) return fail("That project could not be found.");
  if (project.isDemo) return fail(DEMO_LOCK);
  const rows = runList(db, table, projectId);
  const index = rows.findIndex((row) => row.id === id);
  if (index < 0) return fail("That item could not be found.");
  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (swapWith < 0 || swapWith >= rows.length) return { ok: true, value: undefined };
  const current = rows[index];
  const neighbor = rows[swapWith];
  transaction(db, () => {
    run(db, `UPDATE ${table} SET position = ? WHERE id = ?`, [neighbor.position, current.id]);
    run(db, `UPDATE ${table} SET position = ? WHERE id = ?`, [current.position, neighbor.id]);
    touch(db, projectId, now);
  });
  return { ok: true, value: undefined };
}

function runList(
  db: DatabaseSync,
  table: "requirements" | "scenarios" | "prompt_versions",
  projectId: string,
): { id: string; position: number }[] {
  if (table === "requirements") {
    return listRequirements(db, projectId).map((item) => ({ id: item.id, position: item.position }));
  }
  if (table === "scenarios") {
    return listScenarios(db, projectId).map((item) => ({ id: item.id, position: item.position }));
  }
  return listVersions(db, projectId).map((item) => ({ id: item.id, position: item.position }));
}

export function createRun(
  db: DatabaseSync,
  input: {
    id: string;
    projectId: string;
    name: string;
    versionAId: string;
    versionBId: string;
    scenarioIds: string[];
    now: string;
    dataset?: ScenarioSet;
    repetitions?: number;
    mode?: RunMode;
  },
): Result<{ id: string }> {
  const project = getProject(db, input.projectId);
  if (!project) return fail("That project could not be found.");
  const versions = listVersions(db, input.projectId);
  const versionA = versions.find((version) => version.id === input.versionAId);
  const versionB = versions.find((version) => version.id === input.versionBId);
  if (!versionA || !versionB) return fail("Choose two prompt versions from this project.");
  if (versionA.id === versionB.id) return fail("Choose two different prompt versions.");
  const scenarios = listScenarios(db, input.projectId).filter((scenario) =>
    input.scenarioIds.includes(scenario.id),
  );
  if (scenarios.length === 0) return fail("Choose at least one scenario.");
  const requirements = listRequirements(db, input.projectId);
  if (requirements.length === 0) {
    return fail("Add at least one requirement before running an evaluation.");
  }
  const mode = input.mode ?? "unset";
  const repetitions = input.repetitions ?? 1;
  if (!Number.isInteger(repetitions) || repetitions < 1 || repetitions > 3) {
    return fail("Choose 1, 2, or 3 repetitions.");
  }
  if (mode === "live") {
    const running = get<{ id: string }>(
      db,
      "SELECT id FROM evaluation_runs WHERE project_id = ? AND status = 'running' LIMIT 1",
      [input.projectId],
    );
    if (running) {
      return fail("An evaluation is already running. Wait for it to finish or cancel it.");
    }
    for (const version of [versionA, versionB]) {
      if (!version.model.trim()) {
        return fail(`Enter a model identifier for ${version.name} before running a live evaluation.`);
      }
    }
  }
  const materials = listReferenceMaterials(db, input.projectId);
  const dataset = input.dataset ?? scenarios[0]?.dataset ?? "development";
  const snapshot = captureSnapshot({
    capturedAt: input.now,
    dataset,
    repetitions,
    mode,
    minPassRate: project.minPassRate,
    requirements,
    scenarios,
    materials,
    versions: [versionA, versionB],
  });
  const status = mode === "live" ? "running" : mode === "demo" ? "ready" : "draft";
  const responseSource = mode === "demo" ? "demo" : "unset";

  transaction(db, () => {
    run(
      db,
      `INSERT INTO evaluation_runs (
        id, project_id, name, version_a_id, version_b_id, version_a_name, version_b_name,
        status, response_source, is_sample, min_pass_rate, setup_fingerprint, dataset, repetitions,
        mode, cancel_requested, snapshot_json, created_at, graded_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, '', ?, ?, ?, 0, ?, ?, NULL)`,
      [
        input.id,
        input.projectId,
        input.name,
        versionA.id,
        versionB.id,
        versionA.name,
        versionB.name,
        status,
        responseSource,
        project.minPassRate,
        dataset,
        repetitions,
        mode,
        serializeSnapshot(snapshot),
        input.now,
      ],
    );
    for (const scenario of scenarios) {
      for (let repetition = 1; repetition <= repetitions; repetition += 1) {
        for (const version of [versionA, versionB]) {
          const prompt = buildEvaluationPrompt({
            instructions: version.instructions,
            template: version.messageTemplate,
            customerInput: scenario.customerInput,
            situation: scenario.situation,
            materials,
          });
          const demo = mode === "demo";
          run(
            db,
            `INSERT INTO responses (
              id, run_id, scenario_id, version_id, repetition, scenario_title, scenario_position,
              customer_input, situation, good_looks_like, output_text, source, prompt_snapshot,
              call_status, error_text, provider, model, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', ?, ?, ?, ?)`,
            [
              crypto.randomUUID(),
              input.id,
              scenario.id,
              version.id,
              repetition,
              scenario.title,
              scenario.position,
              scenario.customerInput,
              scenario.situation,
              scenario.goodLooksLike,
              demo ? demoOutput(scenario.goodLooksLike) : "",
              demo ? "demo" : "empty",
              prompt.snapshot,
              demo ? "recorded" : mode === "live" ? "pending" : "recorded",
              version.provider,
              version.model,
              input.now,
              input.now,
            ],
          );
        }
      }
    }
    touch(db, input.projectId, input.now);
  });

  return { ok: true, value: { id: input.id } };
}

export function requestRunCancel(db: DatabaseSync, projectId: string, runId: string): Result {
  const runRecord = getRun(db, runId);
  if (!runRecord || runRecord.projectId !== projectId) {
    return fail("That evaluation could not be found.");
  }
  if (runRecord.status !== "running") return { ok: true, value: undefined };
  run(db, "UPDATE evaluation_runs SET cancel_requested = 1 WHERE id = ?", [runId]);
  return { ok: true, value: undefined };
}

export function saveReplies(
  db: DatabaseSync,
  runId: string,
  texts: Record<string, string>,
  now: string,
): Result {
  const runRecord = getRun(db, runId);
  if (!runRecord) return fail("That evaluation could not be found.");
  if (runRecord.isSample) {
    return fail("Sample replies are fixed. Start your own evaluation to paste new replies.");
  }
  const responses = listResponses(db, runId);
  transaction(db, () => {
    for (const response of responses) {
      if (!(response.id in texts)) continue;
      const output = texts[response.id] ?? "";
      const unchanged = response.outputText === output;
      const keep =
        unchanged &&
        (response.source === "model" || response.source === "demo" || response.source === "sample");
      const source: ResponseSource = !output.trim() ? "empty" : keep ? response.source : "pasted";
      run(
        db,
        "UPDATE responses SET output_text = ?, source = ?, updated_at = ? WHERE id = ?",
        [output, source, now, response.id],
      );
    }
    touch(db, runRecord.projectId, now);
  });
  return { ok: true, value: undefined };
}

export function setReply(
  db: DatabaseSync,
  responseId: string,
  outputText: string,
  source: ResponseSource,
  now: string,
): Result {
  const response = get<{ run_id: string }>(
    db,
    "SELECT run_id FROM responses WHERE id = ?",
    [responseId],
  );
  if (!response) return fail("That reply slot could not be found.");
  const runRecord = getRun(db, response.run_id);
  if (!runRecord) return fail("That evaluation could not be found.");
  if (runRecord.isSample) {
    return fail("Sample replies are fixed. Start your own evaluation to generate new replies.");
  }
  transaction(db, () => {
    run(
      db,
      "UPDATE responses SET output_text = ?, source = ?, updated_at = ? WHERE id = ?",
      [outputText, source, now, responseId],
    );
    touch(db, runRecord.projectId, now);
  });
  return { ok: true, value: undefined };
}

export async function gradeRun(
  db: DatabaseSync,
  runId: string,
  now: string,
  options: { complete?: CompleteCall } = {},
): Promise<Result> {
  const runRecord = getRun(db, runId);
  if (!runRecord) return fail("That evaluation could not be found.");
  if (runRecord.isSample) {
    return fail(
      "Sample results are fixed so the walkthrough stays reliable. Start your own evaluation to grade new replies.",
    );
  }
  const project = getProject(db, runRecord.projectId);
  if (!project) return fail("That project could not be found.");
  if (runRecord.status === "running") return fail("This evaluation is still running.");
  const snapshot = parseRunSnapshot(runRecord.snapshotJson);
  const requirements = snapshot ? snapshot.requirements : listRequirements(db, project.id);
  if (requirements.length === 0) return fail("Add at least one requirement before grading.");
  const scenarios = snapshot ? snapshot.scenarios : listScenarios(db, project.id);
  const versions = snapshot ? snapshot.versions : listVersions(db, project.id);
  const scenarioById = new Map(scenarios.map((scenario) => [scenario.id, scenario]));
  const versionById = new Map(versions.map((version) => [version.id, version]));
  const responses = listResponses(db, runId);
  const gradable = responses.filter(
    (response) => response.callStatus !== "failed" && response.callStatus !== "cancelled",
  );
  if (gradable.some((response) => response.callStatus === "pending" || response.callStatus === "running")) {
    return fail("This evaluation is still running.");
  }
  const materials = snapshot ? snapshot.materials : listReferenceMaterials(db, project.id);
  const graderModel = project.graderModel.trim();
  const grader = graderModel
    ? { provider: project.graderProvider, model: graderModel }
    : null;
  const keys = providerAvailability();
  const complete: CompleteCall | null = !grader
    ? null
    : (options.complete ??
      (keys[grader.provider]
        ? completeWithProvider
        : async () => ({
            ok: false,
            message: `No ${grader.provider === "anthropic" ? "Anthropic" : "OpenAI"} API key is configured on the server.`,
            retryable: false,
            latencyMs: 0,
          })));
  const judgments = new Map<string, Awaited<ReturnType<typeof judgeRequirement>>>();
  const jobs: { key: string; responseId: string; requirementId: string }[] = [];
  for (const response of responses) {
    const scenario = scenarioById.get(response.scenarioId);
    const applicable = scenario ? applicableRequirements(scenario, requirements) : requirements;
    for (const requirement of applicable) {
      const key = `${response.id}:${requirement.id}`;
      jobs.push({ key, responseId: response.id, requirementId: requirement.id });
    }
  }
  await mapLimit(jobs, 3, async (job) => {
    const response = responses.find((item) => item.id === job.responseId);
    const requirement = requirements.find((item) => item.id === job.requirementId);
    if (!response || !requirement) return;
    const scenario = scenarioById.get(response.scenarioId);
    const responseMissing =
      response.callStatus === "failed" ||
      response.callStatus === "cancelled" ||
      response.outputText.trim() === "";
    judgments.set(
      job.key,
      await judgeRequirement({
        responseText: response.outputText,
        responseMissing,
        demo: runRecord.mode === "demo",
        requirement,
        scenario: {
          title: scenario?.title ?? response.scenarioTitle,
          customerInput: scenario?.customerInput ?? response.customerInput,
          situation: scenario?.situation ?? response.situation,
          goodLooksLike: scenario?.goodLooksLike ?? response.goodLooksLike,
        },
        materials,
        grader,
        complete,
      }),
    );
  });

  transaction(db, () => {
    if (!snapshot) {
      for (const response of responses) {
        const scenario = scenarioById.get(response.scenarioId);
        const version = versionById.get(response.versionId);
        const customerInput = scenario?.customerInput ?? response.customerInput;
        const situation = scenario?.situation ?? response.situation;
        const prompt = version
          ? composePrompt(version.instructions, version.messageTemplate, customerInput, situation)
          : response.promptSnapshot;
        run(
          db,
          `UPDATE responses
           SET scenario_title = ?, scenario_position = ?, customer_input = ?, situation = ?,
               good_looks_like = ?, prompt_snapshot = ?, updated_at = ?
           WHERE id = ?`,
          [
            scenario?.title ?? response.scenarioTitle,
            scenario?.position ?? response.scenarioPosition,
            customerInput,
            situation,
            scenario?.goodLooksLike ?? response.goodLooksLike,
            prompt,
            now,
            response.id,
          ],
        );
      }
    }

    const placeholders = requirements.map(() => "?").join(", ");
    run(
      db,
      `DELETE FROM grades
       WHERE response_id IN (SELECT id FROM responses WHERE run_id = ?)
         AND requirement_id NOT IN (${placeholders})`,
      [runId, ...requirements.map((requirement) => requirement.id)],
    );

    for (const response of responses) {
      const scenario = scenarioById.get(response.scenarioId);
      const applicable = scenario ? applicableRequirements(scenario, requirements) : requirements;
      if (applicable.length === 0) {
        run(db, "DELETE FROM grades WHERE response_id = ?", [response.id]);
        continue;
      }
      const applicableIds = applicable.map((requirement) => requirement.id);
      run(
        db,
        `DELETE FROM grades
         WHERE response_id = ?
           AND requirement_id NOT IN (${applicableIds.map(() => "?").join(", ")})`,
        [response.id, ...applicableIds],
      );
      for (const requirement of applicable) {
        const graded = judgments.get(`${response.id}:${requirement.id}`);
        run(
          db,
          `INSERT INTO grades (
            id, response_id, requirement_id, requirement_title, requirement_position, priority,
            pass_percent, critical, check_type, automatic_outcome, explanation,
            ai_verdict, ai_explanation, ai_evidence, deterministic_outcome, deterministic_explanation
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(response_id, requirement_id) DO UPDATE SET
            requirement_title = excluded.requirement_title,
            requirement_position = excluded.requirement_position,
            priority = excluded.priority,
            pass_percent = excluded.pass_percent,
            critical = excluded.critical,
            check_type = excluded.check_type,
            automatic_outcome = excluded.automatic_outcome,
            explanation = excluded.explanation,
            ai_verdict = excluded.ai_verdict,
            ai_explanation = excluded.ai_explanation,
            ai_evidence = excluded.ai_evidence,
            deterministic_outcome = excluded.deterministic_outcome,
            deterministic_explanation = excluded.deterministic_explanation`,
          [
            crypto.randomUUID(),
            response.id,
            requirement.id,
            requirement.title,
            requirement.position,
            requirement.priority,
            requirement.passPercent,
            requirement.critical ? 1 : 0,
            requirement.checkType,
            graded?.automaticOutcome ?? "needs_review",
            graded?.explanation ?? "This requirement was not graded, so this is not a pass.",
            graded?.aiVerdict ?? "",
            graded?.aiExplanation ?? "",
            graded?.aiEvidence ?? "",
            graded?.deterministicOutcome ?? "",
            graded?.deterministicExplanation ?? "",
          ],
        );
      }
    }

    const sources = new Set(gradable.map((response) => response.source));
    let responseSource: RunSource = "mixed";
    if (sources.size === 1) {
      const only = [...sources][0];
      responseSource =
        only === "model" || only === "pasted" || only === "sample" || only === "demo" ? only : "pasted";
    }
    const versionA = versionById.get(runRecord.versionAId);
    const versionB = versionById.get(runRecord.versionBId);
    const fingerprint = snapshot
      ? fingerprintSetup({
          minPassRate: snapshot.minPassRate,
          requirements: snapshot.requirements,
          scenarios: snapshot.scenarios,
          versions: snapshot.versions,
          materials: snapshot.materials,
        })
      : fingerprintProject(
          project,
          listRequirements(db, project.id),
          listScenarios(db, project.id),
          listVersions(db, project.id),
          listReferenceMaterials(db, project.id),
        );
    run(
      db,
      `UPDATE evaluation_runs
       SET status = 'graded', response_source = ?, min_pass_rate = ?, setup_fingerprint = ?,
           graded_at = ?, version_a_name = ?, version_b_name = ?, grader_provider = ?, grader_model = ?
       WHERE id = ?`,
      [
        responseSource,
        snapshot?.minPassRate ?? project.minPassRate,
        fingerprint,
        now,
        versionA?.name ?? runRecord.versionAName,
        versionB?.name ?? runRecord.versionBName,
        grader?.provider ?? "",
        grader?.model ?? "",
        runId,
      ],
    );
    touch(db, project.id, now);
  });

  return { ok: true, value: undefined };
}

export function deleteRun(db: DatabaseSync, projectId: string, runId: string): Result {
  const runRecord = getRun(db, runId);
  if (!runRecord || runRecord.projectId !== projectId) {
    return fail("That evaluation could not be found.");
  }
  if (runRecord.isSample) {
    return fail("The sample evaluation stays in the demo so you can come back to it.");
  }
  transaction(db, () => {
    run(db, "DELETE FROM evaluation_runs WHERE id = ?", [runId]);
    touch(db, projectId, new Date().toISOString());
  });
  return { ok: true, value: undefined };
}

export function saveReview(
  db: DatabaseSync,
  input: { gradeId: string; decision: "pass" | "fail"; note: string; now: string },
): Result<{ projectId: string; runId: string }> {
  const located = locateGrade(db, input.gradeId);
  if (!located) return fail("That check could not be found.");
  if (input.note.length > 500) return fail("The note must be 500 characters or fewer.");
  const existing = located.reviewId;
  transaction(db, () => {
    if (existing) {
      run(
        db,
        "UPDATE human_reviews SET decision = ?, note = ?, updated_at = ? WHERE grade_id = ?",
        [input.decision, input.note, input.now, input.gradeId],
      );
    } else {
      run(
        db,
        `INSERT INTO human_reviews (id, grade_id, decision, note, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [crypto.randomUUID(), input.gradeId, input.decision, input.note, input.now, input.now],
      );
    }
    touch(db, located.projectId, input.now);
  });
  return { ok: true, value: { projectId: located.projectId, runId: located.runId } };
}

export function clearReview(
  db: DatabaseSync,
  gradeId: string,
  now: string,
): Result<{ projectId: string; runId: string }> {
  const located = locateGrade(db, gradeId);
  if (!located) return fail("That check could not be found.");
  transaction(db, () => {
    run(db, "DELETE FROM human_reviews WHERE grade_id = ?", [gradeId]);
    touch(db, located.projectId, now);
  });
  return { ok: true, value: { projectId: located.projectId, runId: located.runId } };
}

function locateGrade(db: DatabaseSync, gradeId: string) {
  const statement = db.prepare(
    `SELECT grades.id AS grade_id, responses.run_id AS run_id, evaluation_runs.project_id AS project_id,
            human_reviews.id AS review_id
     FROM grades
     JOIN responses ON responses.id = grades.response_id
     JOIN evaluation_runs ON evaluation_runs.id = responses.run_id
     LEFT JOIN human_reviews ON human_reviews.grade_id = grades.id
     WHERE grades.id = ?`,
  );
  const row = statement.get(gradeId) as
    | { grade_id: string; run_id: string; project_id: string; review_id: string | null }
    | undefined;
  if (!row) return undefined;
  return { projectId: row.project_id, runId: row.run_id, reviewId: row.review_id };
}
