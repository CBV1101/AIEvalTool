import assert from "node:assert/strict";
import test from "node:test";
import { decisionReport, detailedResultsCsv } from "@/lib/eval/export";
import { verdictForChecks } from "@/lib/eval/release";
import { checksFromBundle, type RunBundle } from "@/lib/eval/report";
import type { EvaluationRun, GradeRecord, ResponseRecord } from "@/lib/types";

function run(): EvaluationRun {
  return {
    id: "run",
    projectId: "project",
    name: "Billing check",
    versionAId: "a",
    versionBId: "b",
    versionAName: "Direct",
    versionBName: "Careful",
    status: "graded",
    responseSource: "model",
    isSample: false,
    minPassRate: 80,
    setupFingerprint: "fingerprint",
    dataset: "holdout",
    repetitions: 2,
    mode: "live",
    cancelRequested: false,
    snapshotJson: "{\"capturedAt\":\"frozen\"}",
    graderProvider: "openai",
    graderModel: "grader-model",
    createdAt: "2026-10-14T00:00:00.000Z",
    gradedAt: "2026-10-14T01:00:00.000Z",
  };
}

function response(id: string, versionId: string, repetition: number): ResponseRecord {
  return {
    id,
    runId: "run",
    scenarioId: "refund",
    versionId,
    scenarioTitle: "Refund",
    scenarioPosition: 1,
    customerInput: "Can I get a refund?",
    situation: "",
    goodLooksLike: "Explain the policy.",
    outputText: versionId === "a" ? "Here is a full refund." : "I can check the policy.",
    source: "model",
    promptSnapshot: "",
    repetition,
    callStatus: "succeeded",
    latencyMs: 80,
    inputTokens: 5,
    outputTokens: 7,
    errorText: "",
    provider: "openai",
    model: "model-under-test",
    createdAt: "2026-10-14T00:00:00.000Z",
    updatedAt: "2026-10-14T00:00:00.000Z",
  };
}

function grade(responseId: string, outcome: GradeRecord["automaticOutcome"]): GradeRecord {
  return {
    id: `grade-${responseId}`,
    responseId,
    requirementId: "policy",
    requirementTitle: "Follows refund policy",
    requirementPosition: 1,
    priority: "important",
    passPercent: 100,
    critical: true,
    checkType: "human_only",
    automaticOutcome: outcome,
    explanation: outcome === "fail" ? "Offered a refund." : "Stayed with the policy.",
    aiVerdict: outcome,
    aiExplanation: outcome === "fail" ? "Offered a refund." : "Stayed with the policy.",
    aiEvidence: outcome === "fail" ? "full refund, today" : "policy",
    deterministicOutcome: "",
    deterministicExplanation: "",
  };
}

test("csv export includes both versions and quotes evidence", () => {
  const bundle: RunBundle = {
    run: run(),
    responses: [response("ra1", "a", 1), response("ra2", "a", 2), response("rb1", "b", 1), response("rb2", "b", 2)],
    grades: [
      grade("ra1", "fail"),
      grade("ra2", "pass"),
      grade("rb1", "pass"),
      grade("rb2", "pass"),
    ],
    reviews: [],
  };
  const csv = detailedResultsCsv(bundle, [{ id: "refund", category: "edge" }]);
  assert.match(csv, /Direct/);
  assert.match(csv, /Careful/);
  assert.match(csv, /Follows refund policy/);
  assert.match(csv, /"full refund, today"/);
  assert.match(csv, /edge/);
  assert.equal(csv.trim().split("\n").length, 5);
});

test("the decision report lists settings, coverage, and both release statuses", () => {
  const bundle: RunBundle = {
    run: run(),
    responses: [response("ra1", "a", 1), response("rb1", "b", 1)],
    grades: [grade("ra1", "fail"), grade("rb1", "pass")],
    reviews: [
      {
        id: "review",
        gradeId: "grade-rb1",
        decision: "pass",
        note: "Checked against the policy.",
        createdAt: "2026-10-14T02:00:00.000Z",
        updatedAt: "2026-10-14T02:00:00.000Z",
      },
    ],
  };
  const checks = checksFromBundle(bundle, [{ id: "refund", category: "edge" }]);
  const report = decisionReport(
    bundle,
    {
      versionA: verdictForChecks("a", "Direct", checks.filter((check) => check.versionId === "a"), 80),
      versionB: verdictForChecks("b", "Careful", checks.filter((check) => check.versionId === "b"), 80),
    },
    [{ id: "refund", category: "edge" }],
    [
      { id: "a", name: "Direct", provider: "openai", model: "model-under-test" },
      { id: "b", name: "Careful", provider: "openai", model: "model-under-test" },
    ],
    {},
  );
  assert.match(report, /not a guarantee of production performance/);
  assert.match(report, /Scenario set: holdout/);
  assert.match(report, /Repetitions: 2/);
  assert.match(report, /Does not meet configured criteria/);
  assert.match(report, /Meets configured criteria/);
  assert.match(report, /Follows refund policy/);
  assert.match(report, /reviewed by a person/);
  assert.match(report, /Cost unavailable\./);
  assert.equal(report.includes("Here is a full refund."), false);
});
