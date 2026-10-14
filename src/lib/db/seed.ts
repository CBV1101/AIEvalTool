import type { DatabaseSync } from "node:sqlite";
import { composePrompt } from "@/lib/eval/prompts";
import { fingerprintSetup } from "@/lib/eval/fingerprint";
import {
  DEMO_CREATED_AT,
  DEMO_GRADED_AT,
  DEMO_PROJECT_ID,
  DEMO_RUN_CREATED_AT,
  DEMO_RUN_ID,
  DEMO_VERSION_IDS,
  demoProject,
  demoReplies,
  demoReferenceMaterials,
  demoRequirements,
  demoReviews,
  demoRunName,
  demoScenarios,
  demoVersions,
} from "@/lib/demo/content";
import { demoChecks, demoGradeId, demoResponseId, demoReviewId } from "@/lib/demo/story";
import { get, run, transaction } from "@/lib/db/sql";

function demoFingerprint(): string {
  return fingerprintSetup({
    minPassRate: demoProject.minPassRate,
    requirements: demoRequirements.map((requirement) => ({
      ...requirement,
      checkConfig: requirement.checkConfig,
    })),
    scenarios: demoScenarios.map((scenario) => ({
      ...scenario,
      appliesToAll: true,
      requirementIds: [] as string[],
    })),
    versions: demoVersions.map((version) => ({
      ...version,
      provider: "openai" as const,
      model: "",
    })),
    materials: demoReferenceMaterials,
  });
}

function writeDemoScenario(
  db: DatabaseSync,
  scenario: (typeof demoScenarios)[number],
  exists: boolean,
): void {
  if (exists) {
    run(
      db,
      `UPDATE scenarios
       SET title = ?, customer_input = ?, situation = ?, good_looks_like = ?, reference_answer = ?,
           category = ?, dataset = ?, applies_to_all = 1, position = ?
       WHERE id = ?`,
      [
        scenario.title,
        scenario.customerInput,
        scenario.situation,
        scenario.goodLooksLike,
        scenario.referenceAnswer,
        scenario.category,
        scenario.dataset,
        scenario.position,
        scenario.id,
      ],
    );
    return;
  }
  run(
    db,
    `INSERT INTO scenarios (
      id, project_id, title, customer_input, situation, good_looks_like, reference_answer,
      category, dataset, applies_to_all, position, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
    [
      scenario.id,
      DEMO_PROJECT_ID,
      scenario.title,
      scenario.customerInput,
      scenario.situation,
      scenario.goodLooksLike,
      scenario.referenceAnswer,
      scenario.category,
      scenario.dataset,
      scenario.position,
      DEMO_CREATED_AT,
      DEMO_CREATED_AT,
    ],
  );
}

export function ensureDemo(db: DatabaseSync): void {
  const existing = get(db, "SELECT id FROM projects WHERE id = ?", [DEMO_PROJECT_ID]);
  if (existing) {
    upgradeDemo(db);
    return;
  }

  const fingerprint = demoFingerprint();
  const direct = demoVersions.find((version) => version.id === DEMO_VERSION_IDS.direct);
  const careful = demoVersions.find((version) => version.id === DEMO_VERSION_IDS.careful);
  if (!direct || !careful) return;

  transaction(db, () => {
    run(
      db,
      `INSERT INTO projects (
        id, name, feature_summary, decision_note, min_pass_rate, is_demo, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
      [
        demoProject.id,
        demoProject.name,
        demoProject.featureSummary,
        demoProject.decisionNote,
        demoProject.minPassRate,
        DEMO_CREATED_AT,
        DEMO_GRADED_AT,
      ],
    );

    for (const requirement of demoRequirements) {
      run(
        db,
        `INSERT INTO requirements (
          id, project_id, title, details, pass_guidance, fail_guidance, critical, priority, pass_percent,
          check_type, check_config, position, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          requirement.id,
          DEMO_PROJECT_ID,
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
          DEMO_CREATED_AT,
          DEMO_CREATED_AT,
        ],
      );
    }

    for (const scenario of demoScenarios) {
      writeDemoScenario(db, scenario, false);
    }

    for (const material of demoReferenceMaterials) {
      run(
        db,
        `INSERT INTO reference_materials (
          id, project_id, title, body, kind, position, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          material.id,
          DEMO_PROJECT_ID,
          material.title,
          material.body,
          material.kind,
          material.position,
          DEMO_CREATED_AT,
          DEMO_CREATED_AT,
        ],
      );
    }

    for (const version of demoVersions) {
      run(
        db,
        `INSERT INTO prompt_versions (
          id, project_id, name, change_notes, instructions, message_template, position, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          version.id,
          DEMO_PROJECT_ID,
          version.name,
          version.changeNotes,
          version.instructions,
          version.messageTemplate,
          version.position,
          DEMO_CREATED_AT,
          DEMO_CREATED_AT,
        ],
      );
    }

    run(
      db,
      `INSERT INTO evaluation_runs (
        id, project_id, name, version_a_id, version_b_id, version_a_name, version_b_name,
        status, response_source, is_sample, min_pass_rate, setup_fingerprint, created_at, graded_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'graded', 'sample', 1, ?, ?, ?, ?)`,
      [
        DEMO_RUN_ID,
        DEMO_PROJECT_ID,
        demoRunName,
        direct.id,
        careful.id,
        direct.name,
        careful.name,
        demoProject.minPassRate,
        fingerprint,
        DEMO_RUN_CREATED_AT,
        DEMO_GRADED_AT,
      ],
    );

    for (const reply of demoReplies) {
      const scenario = demoScenarios.find((item) => item.id === reply.scenarioId);
      const version = demoVersions.find((item) => item.id === reply.versionId);
      if (!scenario || !version) continue;
      run(
        db,
        `INSERT INTO responses (
          id, run_id, scenario_id, version_id, scenario_title, scenario_position, customer_input,
          situation, good_looks_like, output_text, source, prompt_snapshot, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'sample', ?, ?, ?)`,
        [
          demoResponseId(reply.versionId, reply.scenarioId),
          DEMO_RUN_ID,
          reply.scenarioId,
          reply.versionId,
          scenario.title,
          scenario.position,
          scenario.customerInput,
          scenario.situation,
          scenario.goodLooksLike,
          reply.text,
          composePrompt(
            version.instructions,
            version.messageTemplate,
            scenario.customerInput,
            scenario.situation,
          ),
          DEMO_RUN_CREATED_AT,
          DEMO_GRADED_AT,
        ],
      );
    }

    for (const check of demoChecks()) {
      run(
        db,
        `INSERT INTO grades (
          id, response_id, requirement_id, requirement_title, requirement_position, priority,
          pass_percent, critical, check_type, automatic_outcome, explanation
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          check.gradeId,
          check.responseId,
          check.requirementId,
          check.requirementTitle,
          check.requirementPosition,
          check.priority,
          check.passPercent,
          check.critical ? 1 : 0,
          demoRequirements.find((item) => item.id === check.requirementId)?.checkType ?? "human_only",
          check.automaticOutcome,
          check.explanation,
        ],
      );
    }

    for (const review of demoReviews) {
      run(
        db,
        `INSERT INTO human_reviews (id, grade_id, decision, note, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          demoReviewId(review.versionId, review.scenarioId, review.requirementId),
          demoGradeId(review.versionId, review.scenarioId, review.requirementId),
          review.decision,
          review.note,
          DEMO_GRADED_AT,
          DEMO_GRADED_AT,
        ],
      );
    }
  });
}

function upgradeDemo(db: DatabaseSync): void {
  transaction(db, () => {
    for (const requirement of demoRequirements) {
      run(
        db,
        `UPDATE requirements
         SET title = ?, details = ?, pass_guidance = ?, fail_guidance = ?, critical = ?, priority = ?,
             pass_percent = ?, check_type = ?, check_config = ?, position = ?
         WHERE id = ? AND project_id = ?`,
        [
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
          requirement.id,
          DEMO_PROJECT_ID,
        ],
      );
    }

    for (const scenario of demoScenarios) {
      const existing = get(db, "SELECT id FROM scenarios WHERE id = ?", [scenario.id]);
      writeDemoScenario(db, scenario, Boolean(existing));
    }

    for (const material of demoReferenceMaterials) {
      const existing = get(db, "SELECT id FROM reference_materials WHERE id = ?", [material.id]);
      if (existing) {
        run(
          db,
          `UPDATE reference_materials
           SET title = ?, body = ?, kind = ?, position = ?
           WHERE id = ?`,
          [material.title, material.body, material.kind, material.position, material.id],
        );
      } else {
        run(
          db,
          `INSERT INTO reference_materials (
            id, project_id, title, body, kind, position, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            material.id,
            DEMO_PROJECT_ID,
            material.title,
            material.body,
            material.kind,
            material.position,
            DEMO_CREATED_AT,
            DEMO_CREATED_AT,
          ],
        );
      }
    }

    run(db, "UPDATE grades SET critical = ? WHERE id LIKE 'demo-grade-%' AND requirement_id = ?", [
      1,
      "demo-req-policy",
    ]);
    run(db, "UPDATE grades SET critical = ? WHERE id LIKE 'demo-grade-%' AND requirement_id = ?", [
      1,
      "demo-req-handoff",
    ]);
    run(
      db,
      `UPDATE projects
       SET feature_summary = ?, decision_note = ?, min_pass_rate = ?
       WHERE id = ?`,
      [demoProject.featureSummary, demoProject.decisionNote, demoProject.minPassRate, DEMO_PROJECT_ID],
    );
    for (const version of demoVersions) {
      run(
        db,
        `UPDATE prompt_versions
         SET name = ?, change_notes = ?, instructions = ?, message_template = ?, position = ?
         WHERE id = ? AND project_id = ?`,
        [
          version.name,
          version.changeNotes,
          version.instructions,
          version.messageTemplate,
          version.position,
          version.id,
          DEMO_PROJECT_ID,
        ],
      );
    }
    refreshSampleResults(db);
    run(db, "UPDATE evaluation_runs SET setup_fingerprint = ?, name = ?, version_a_name = ?, version_b_name = ? WHERE id = ?", [
      demoFingerprint(),
      demoRunName,
      demoVersions.find((version) => version.id === DEMO_VERSION_IDS.direct)?.name ?? "",
      demoVersions.find((version) => version.id === DEMO_VERSION_IDS.careful)?.name ?? "",
      DEMO_RUN_ID,
    ]);
  });
}

function refreshSampleResults(db: DatabaseSync): void {
  for (const reply of demoReplies) {
    run(db, "UPDATE responses SET output_text = ?, source = 'sample' WHERE id = ? AND run_id = ?", [
      reply.text,
      demoResponseId(reply.versionId, reply.scenarioId),
      DEMO_RUN_ID,
    ]);
  }
  for (const check of demoChecks()) {
    const requirement = demoRequirements.find((item) => item.id === check.requirementId);
    run(
      db,
      `UPDATE grades
       SET requirement_title = ?, priority = ?, pass_percent = ?, critical = ?, check_type = ?,
           automatic_outcome = ?, explanation = ?
       WHERE id = ?`,
      [
        check.requirementTitle,
        check.priority,
        check.passPercent,
        check.critical ? 1 : 0,
        requirement?.checkType ?? "human_only",
        check.automaticOutcome,
        check.explanation,
        check.gradeId,
      ],
    );
  }
  writeDemoReviews(db);
}

function writeDemoReviews(db: DatabaseSync): void {
  run(
    db,
    `DELETE FROM human_reviews
     WHERE grade_id IN (
       SELECT grades.id FROM grades
       JOIN responses ON responses.id = grades.response_id
       WHERE responses.run_id = ?
     )`,
    [DEMO_RUN_ID],
  );
  for (const review of demoReviews) {
    run(
      db,
      `INSERT INTO human_reviews (id, grade_id, decision, note, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        demoReviewId(review.versionId, review.scenarioId, review.requirementId),
        demoGradeId(review.versionId, review.scenarioId, review.requirementId),
        review.decision,
        review.note,
        DEMO_GRADED_AT,
        DEMO_GRADED_AT,
      ],
    );
  }
}

export function restoreDemoReviews(db: DatabaseSync): void {
  transaction(db, () => {
    writeDemoReviews(db);
  });
}
