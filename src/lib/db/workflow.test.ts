import assert from "node:assert/strict";
import test from "node:test";
import { openDatabase } from "@/lib/db/connection";
import { copyProject, createRun, gradeRun, saveReplies, saveReview } from "@/lib/db/mutations";
import { getProject, getRun, getRunBundle, listRuns } from "@/lib/db/queries";
import { ensureDemo } from "@/lib/db/seed";
import { fingerprintProject } from "@/lib/eval/fingerprint";
import { checksFromBundle, reportFromBundle } from "@/lib/eval/report";
import { DEMO_PROJECT_ID, DEMO_RUN_ID } from "@/lib/demo/content";
import { listReferenceMaterials, listRequirements, listScenarios, listVersions } from "@/lib/db/queries";

test("demo seed stays labeled as sample data and matches the release story", async () => {
  const db = openDatabase(":memory:");
  ensureDemo(db);
  const project = getProject(db, DEMO_PROJECT_ID);
  assert.ok(project);
  assert.equal(project.isDemo, true);

  const bundle = getRunBundle(db, DEMO_RUN_ID);
  assert.ok(bundle);
  assert.equal(bundle.run.isSample, true);
  assert.equal(bundle.run.responseSource, "sample");
  assert.ok(bundle.responses.every((response) => response.source === "sample"));
  assert.ok(bundle.responses.every((response) => response.outputText.length > 0));

  const report = reportFromBundle(bundle);
  assert.equal(report.versionA.ready, false);
  assert.equal(report.versionB.ready, false);
  assert.ok(
    report.versionB.reasons.some((reason) => reason.includes("Does not invent a refund")),
    report.versionB.reasons.join("\n"),
  );

  const fingerprint = fingerprintProject(
    project,
    listRequirements(db, project.id),
    listScenarios(db, project.id),
    listVersions(db, project.id),
    listReferenceMaterials(db, project.id),
  );
  assert.equal(listScenarios(db, project.id).length, 20);
  assert.equal(listReferenceMaterials(db, project.id).length, 2);
  assert.equal(bundle.run.setupFingerprint, fingerprint);

  const sampleGrade = await gradeRun(db, DEMO_RUN_ID, "2026-04-01T00:00:00.000Z");
  assert.equal(sampleGrade.ok, false);

  db.close();
});

test("a copied project can be graded without touching sample results", async () => {
  const db = openDatabase(":memory:");
  ensureDemo(db);
  const copied = copyProject(db, DEMO_PROJECT_ID, "project-copy", "2026-04-02T00:00:00.000Z");
  assert.equal(copied.ok, true);
  if (!copied.ok) return;

  const copy = getProject(db, copied.value.id);
  assert.ok(copy);
  assert.equal(copy.isDemo, false);

  const versions = listVersions(db, copy.id);
  const scenarios = listScenarios(db, copy.id);
  const created = createRun(db, {
    id: "run-copy",
    projectId: copy.id,
    name: "My comparison",
    versionAId: versions[0].id,
    versionBId: versions[1].id,
    scenarioIds: scenarios.map((scenario) => scenario.id),
    now: "2026-04-02T00:05:00.000Z",
  });
  assert.equal(created.ok, true);

  const bundle = getRunBundle(db, "run-copy");
  assert.ok(bundle);
  assert.equal(bundle.run.isSample, false);
  const texts = Object.fromEntries(
    bundle.responses.map((response) => [response.id, "I can't help with that. You can contact the billing team."]),
  );
  assert.equal(saveReplies(db, "run-copy", texts, "2026-04-02T00:06:00.000Z").ok, true);
  assert.equal((await gradeRun(db, "run-copy", "2026-04-02T00:07:00.000Z")).ok, true);

  const graded = getRunBundle(db, "run-copy");
  assert.ok(graded);
  assert.equal(graded.run.status, "graded");
  assert.equal(graded.run.isSample, false);
  assert.equal(graded.grades.length, scenarios.length * 2 * listRequirements(db, copy.id).length);

  const runs = listRuns(db, DEMO_PROJECT_ID);
  assert.equal(runs.length, 1);
  assert.equal(runs[0].isSample, true);

  const frozen = getRun(db, "run-copy");
  assert.ok(frozen);
  const snapshotBefore = frozen.snapshotJson;
  const gradedAt = frozen.gradedAt;
  const target = graded.grades[0];
  assert.ok(target);
  const reviewed = saveReview(db, {
    gradeId: target.id,
    decision: "fail",
    note: "Human override for the release score.",
    now: "2026-04-02T00:08:00.000Z",
  });
  assert.equal(reviewed.ok, true);
  const after = getRun(db, "run-copy");
  assert.ok(after);
  assert.equal(after.snapshotJson, snapshotBefore);
  assert.equal(after.gradedAt, gradedAt);
  const refreshed = getRunBundle(db, "run-copy");
  assert.ok(refreshed);
  const updated = checksFromBundle(refreshed).find((check) => check.gradeId === target.id);
  assert.equal(updated?.outcome, "fail");
  assert.equal(updated?.review?.decision, "fail");
  assert.equal(updated?.aiVerdict, target.aiVerdict);

  db.close();
});
