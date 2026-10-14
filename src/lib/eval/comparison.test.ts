import assert from "node:assert/strict";
import test from "node:test";
import {
  costLabelForVersion,
  inconsistentVerdicts,
  presentedVerdict,
  requirementChanges,
  tradeoffSummary,
  versionMetrics,
} from "@/lib/eval/comparison";
import { verdictForChecks, verdictHeadline, type GradedCheck } from "@/lib/eval/release";
import type { ResponseRecord } from "@/lib/types";

function check(overrides: Partial<GradedCheck> & Pick<GradedCheck, "outcome" | "requirementId" | "versionId">): GradedCheck {
  return {
    gradeId: overrides.gradeId ?? `${overrides.versionId}-${overrides.requirementId}-${overrides.scenarioId ?? "scenario"}`,
    responseId: overrides.responseId ?? "response",
    requirementTitle: overrides.requirementTitle ?? overrides.requirementId,
    requirementPosition: overrides.requirementPosition ?? 1,
    priority: overrides.priority ?? "important",
    passPercent: overrides.passPercent ?? 80,
    critical: overrides.critical ?? false,
    scenarioId: overrides.scenarioId ?? "scenario",
    scenarioTitle: overrides.scenarioTitle ?? "Scenario",
    scenarioPosition: 1,
    category: "normal",
    repetition: overrides.repetition ?? 1,
    automaticOutcome: overrides.outcome,
    explanation: "",
    aiVerdict: "",
    aiExplanation: "",
    aiEvidence: "",
    deterministicOutcome: "",
    deterministicExplanation: "",
    outputText: "",
    customerInput: "",
    situation: "",
    goodLooksLike: "",
    promptSnapshot: "",
    review: null,
    ...overrides,
  };
}

function response(overrides: Partial<ResponseRecord> = {}): ResponseRecord {
  return {
    id: "response",
    runId: "run",
    scenarioId: "scenario",
    versionId: "a",
    scenarioTitle: "Scenario",
    scenarioPosition: 1,
    customerInput: "Hello",
    situation: "",
    goodLooksLike: "Help",
    outputText: "Reply",
    source: "model",
    promptSnapshot: "",
    repetition: 1,
    callStatus: "succeeded",
    latencyMs: 100,
    inputTokens: 10,
    outputTokens: 20,
    errorText: "",
    provider: "openai",
    model: "priced-model",
    createdAt: "2026-10-14T00:00:00.000Z",
    updatedAt: "2026-10-14T00:00:00.000Z",
    ...overrides,
  };
}

test("release status uses the three configured labels", () => {
  const ready = verdictForChecks("a", "A", [check({ outcome: "pass", requirementId: "policy", versionId: "a", critical: true })], 80);
  const blocked = verdictForChecks(
    "a",
    "A",
    [check({ outcome: "fail", requirementId: "policy", versionId: "a", critical: true, requirementTitle: "Follows refund policy" })],
    80,
  );
  const waiting = verdictForChecks(
    "a",
    "A",
    [check({ outcome: "needs_review", requirementId: "policy", versionId: "a", requirementTitle: "Follows refund policy" })],
    80,
  );
  assert.equal(verdictHeadline(ready, false), "Meets configured criteria");
  assert.equal(verdictHeadline(blocked, false), "Does not meet configured criteria");
  assert.equal(verdictHeadline(waiting, false), "Incomplete: review or execution required");
  assert.ok(blocked.reasons.some((reason) => reason.includes("Follows refund policy")));
});

test("an execution error makes the release status incomplete", () => {
  const ready = verdictForChecks("a", "A", [check({ outcome: "pass", requirementId: "policy", versionId: "a" })], 50);
  const shown = presentedVerdict(ready, 1);
  assert.equal(shown.incomplete, true);
  assert.equal(shown.ready, false);
  assert.equal(verdictHeadline(shown, false), "Incomplete: review or execution required");
});

test("version metrics keep pass rate, review, and cost separate", () => {
  const checks = [
    check({ outcome: "pass", requirementId: "policy", versionId: "a", critical: true, review: { id: "r", decision: "pass", note: "", createdAt: "", updatedAt: "" } }),
    check({ outcome: "fail", requirementId: "tone", versionId: "a", gradeId: "tone", critical: true, scenarioId: "other" }),
    check({ outcome: "needs_review", requirementId: "handoff", versionId: "a", gradeId: "handoff", scenarioId: "third" }),
  ];
  const priced = versionMetrics("a", "A", checks, [response()], "live", {
    "priced-model": { inputPerMillion: 1, outputPerMillion: 2 },
  });
  assert.equal(priced.passed, 1);
  assert.equal(priced.eligible, 2);
  assert.equal(priced.criticalFailures, 1);
  assert.equal(priced.unresolvedReviews, 1);
  assert.equal(priced.humanReviewed, 1);
  assert.equal(priced.averageLatencyMs, 100);
  assert.equal(priced.inputTokens, 10);
  assert.equal(priced.outputTokens, 20);
  assert.equal(costLabelForVersion(priced).startsWith("Estimated cost $"), true);

  const unpriced = versionMetrics("a", "A", checks, [response({ model: "unknown-model" })], "live", {});
  assert.equal(costLabelForVersion(unpriced), "Cost unavailable.");

  const pasted = versionMetrics("a", "A", checks, [response({ source: "pasted", latencyMs: null, inputTokens: null, outputTokens: null })], "unset", {});
  assert.equal(pasted.averageLatencyMs, null);
  assert.equal(costLabelForVersion(pasted), "Cost unavailable.");
});

test("requirement changes keep a trade-off visible", () => {
  const checks = [
    check({ outcome: "fail", requirementId: "policy", requirementTitle: "Policy", versionId: "a", requirementPosition: 1 }),
    check({ outcome: "pass", requirementId: "policy", requirementTitle: "Policy", versionId: "b", requirementPosition: 1 }),
    check({ outcome: "pass", requirementId: "length", requirementTitle: "Length", versionId: "a", requirementPosition: 2, priority: "helpful" }),
    check({ outcome: "fail", requirementId: "length", requirementTitle: "Length", versionId: "b", requirementPosition: 2, priority: "helpful" }),
  ];
  const versionA = verdictForChecks("a", "Direct", checks.filter((item) => item.versionId === "a"), 50);
  const versionB = verdictForChecks("b", "Careful", checks.filter((item) => item.versionId === "b"), 50);
  const changes = requirementChanges(versionA, versionB);
  assert.deepEqual(
    changes.map((change) => change.direction),
    ["b_higher", "a_higher"],
  );
  const summary = tradeoffSummary(changes, "Direct", "Careful");
  assert.ok(summary?.includes("Direct is higher on Length"));
  assert.ok(summary?.includes("Careful is higher on Policy"));
});

test("repeated runs surface inconsistent verdicts for one scenario", () => {
  const checks = [
    check({ outcome: "pass", requirementId: "policy", requirementTitle: "Policy", versionId: "a", repetition: 1, scenarioTitle: "Refund" }),
    check({ outcome: "fail", requirementId: "policy", requirementTitle: "Policy", versionId: "a", repetition: 2, gradeId: "second" }),
    check({ outcome: "pass", requirementId: "policy", requirementTitle: "Policy", versionId: "a", repetition: 1, scenarioId: "stable", gradeId: "stable-1" }),
    check({ outcome: "pass", requirementId: "policy", requirementTitle: "Policy", versionId: "a", repetition: 2, scenarioId: "stable", gradeId: "stable-2" }),
  ];
  const found = inconsistentVerdicts(checks, new Map([["a", "Direct"]]));
  assert.equal(found.length, 1);
  assert.equal(found[0]?.scenarioTitle, "Refund");
  assert.deepEqual(
    found[0]?.outcomes.map((item) => item.outcome),
    ["pass", "fail"],
  );
});
