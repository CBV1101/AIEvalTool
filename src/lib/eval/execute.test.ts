import assert from "node:assert/strict";
import test from "node:test";
import { openDatabase } from "@/lib/db/connection";
import {
  createRun,
  insertProject,
  insertRequirement,
  insertScenario,
  insertVersion,
  updateScenario,
} from "@/lib/db/mutations";
import { getRun, listResponses } from "@/lib/db/queries";
import { executeRun } from "@/lib/eval/execute";
import { parseRunSnapshot, snapshotDrift } from "@/lib/eval/snapshot";
import { scenarioToInput } from "@/lib/validators";
import { listScenarios } from "@/lib/db/queries";

const now = "2026-10-13T00:00:00.000Z";

function seed(db: ReturnType<typeof openDatabase>) {
  insertProject(db, {
    id: "project",
    name: "Refunds",
    featureSummary: "Explains refunds.",
    decisionNote: "",
    minPassRate: 80,
    graderProvider: "openai",
    graderModel: "",
    now,
  });
  insertRequirement(
    db,
    "project",
    "req",
    {
      title: "Follows refund policy",
      details: "Responses must follow the supplied refund policy.",
      passGuidance: "Explains eligibility.",
      failGuidance: "Offers a refund the policy does not allow.",
      critical: true,
      priority: "important",
      passPercent: 100,
      checkType: "human_only",
      checkConfig: { phrases: [], minWords: null, maxWords: null },
    },
    now,
  );
  insertScenario(
    db,
    "project",
    "scenario",
    {
      title: "Double charge",
      customerInput: "I was charged twice.",
      situation: "Two charges posted today.",
      goodLooksLike: "Explain the duplicate without promising a refund.",
      referenceAnswer: "",
      category: "normal",
      dataset: "development",
      appliesToAll: true,
      requirementIds: [],
    },
    now,
  );
  insertVersion(
    db,
    "project",
    "version-a",
    {
      name: "Version A",
      changeNotes: "",
      instructions: "Be brief.",
      messageTemplate: "Customer message:\n{input}\n\nSituation:\n{situation}",
      provider: "openai",
      model: "entered-model-a",
    },
    now,
  );
  insertVersion(
    db,
    "project",
    "version-b",
    {
      name: "Version B",
      changeNotes: "",
      instructions: "Be careful.",
      messageTemplate: "Customer message:\n{input}\n\nSituation:\n{situation}",
      provider: "anthropic",
      model: "entered-model-b",
    },
    now,
  );
}

test("a live run retries a transient error, then keeps the saved reply after setup edits", async () => {
  const db = openDatabase(":memory:");
  seed(db);
  const created = createRun(db, {
    id: "run",
    projectId: "project",
    name: "Live",
    versionAId: "version-a",
    versionBId: "version-b",
    scenarioIds: ["scenario"],
    now,
    dataset: "development",
    repetitions: 1,
    mode: "live",
  });
  assert.equal(created.ok, true);
  const blocked = createRun(db, {
    id: "run-2",
    projectId: "project",
    name: "Second",
    versionAId: "version-a",
    versionBId: "version-b",
    scenarioIds: ["scenario"],
    now,
    dataset: "development",
    repetitions: 1,
    mode: "live",
  });
  assert.equal(blocked.ok, false);

  let calls = 0;
  await executeRun(db, "run", {
    concurrency: 2,
    complete: async (input) => {
      calls += 1;
      if (calls === 1) {
        return { ok: false, message: "busy", retryable: true, latencyMs: 4 };
      }
      return {
        ok: true,
        text: `Reply from ${input.model}`,
        inputTokens: 8,
        outputTokens: 3,
        latencyMs: 15,
      };
    },
  });

  const finished = getRun(db, "run");
  assert.ok(finished);
  assert.equal(finished.status, "ready");
  const responses = listResponses(db, "run");
  assert.equal(responses.length, 2);
  assert.ok(responses.every((response) => response.source === "model"));
  assert.ok(responses.every((response) => response.callStatus === "succeeded"));
  assert.ok(responses.every((response) => response.inputTokens === 8 && response.outputTokens === 3));
  assert.ok(responses.every((response) => response.customerInput === "I was charged twice."));
  assert.ok(responses.every((response) => response.promptSnapshot.includes("Reference material:")));
  assert.equal(responses[0]?.promptSnapshot === responses[1]?.promptSnapshot, false);

  const scenario = listScenarios(db, "project")[0];
  updateScenario(
    db,
    "project",
    scenario.id,
    { ...scenarioToInput(scenario), customerInput: "This edit should not change the run." },
    "2026-10-13T01:00:00.000Z",
  );
  const after = listResponses(db, "run");
  assert.ok(after.every((response) => response.customerInput === "I was charged twice."));
  const snapshot = parseRunSnapshot(finished.snapshotJson);
  assert.ok(snapshot);
  assert.equal(
    snapshotDrift(snapshot, {
      minPassRate: 80,
      requirements: snapshot.requirements,
      scenarios: listScenarios(db, "project"),
      materials: [],
      versions: snapshot.versions.map((version) => ({
        ...version,
        projectId: "project",
        createdAt: now,
        updatedAt: now,
      })),
    }),
    true,
  );
  db.close();
});

test("demo mode stores placeholder replies without latency or token measurements", () => {
  const db = openDatabase(":memory:");
  seed(db);
  const created = createRun(db, {
    id: "demo-run",
    projectId: "project",
    name: "Demo",
    versionAId: "version-a",
    versionBId: "version-b",
    scenarioIds: ["scenario"],
    now,
    dataset: "development",
    repetitions: 2,
    mode: "demo",
  });
  assert.equal(created.ok, true);
  const run = getRun(db, "demo-run");
  assert.ok(run);
  assert.equal(run.mode, "demo");
  assert.equal(run.status, "ready");
  assert.equal(run.responseSource, "demo");
  const responses = listResponses(db, "demo-run");
  assert.equal(responses.length, 4);
  assert.ok(responses.every((response) => response.source === "demo"));
  assert.ok(responses.every((response) => response.latencyMs === null));
  assert.ok(responses.every((response) => response.inputTokens === null && response.outputTokens === null));
  assert.match(responses[0]?.outputText ?? "", /not produced by a model/i);
  db.close();
});

test("cancellation does not call the provider for a run that is already cancelled", async () => {
  const db = openDatabase(":memory:");
  seed(db);
  createRun(db, {
    id: "cancel-run",
    projectId: "project",
    name: "Cancel",
    versionAId: "version-a",
    versionBId: "version-b",
    scenarioIds: ["scenario"],
    now,
    mode: "live",
  });
  db.prepare("UPDATE evaluation_runs SET cancel_requested = 1 WHERE id = ?").run("cancel-run");
  let calls = 0;
  await executeRun(db, "cancel-run", {
    complete: async () => {
      calls += 1;
      return { ok: true, text: "should not run", inputTokens: 1, outputTokens: 1, latencyMs: 1 };
    },
  });
  assert.equal(calls, 0);
  const run = getRun(db, "cancel-run");
  assert.equal(run?.status, "cancelled");
  const responses = listResponses(db, "cancel-run");
  assert.ok(responses.every((response) => response.callStatus === "cancelled"));
  assert.ok(responses.every((response) => response.outputText === ""));
  db.close();
});
