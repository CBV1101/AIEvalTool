import assert from "node:assert/strict";
import test from "node:test";
import { verdictForChecks, verdictHeadline, type GradedCheck } from "@/lib/eval/release";

function check(overrides: Partial<GradedCheck> & Pick<GradedCheck, "outcome" | "requirementId">): GradedCheck {
  return {
    gradeId: overrides.gradeId ?? overrides.requirementId,
    responseId: "response",
    requirementTitle: overrides.requirementTitle ?? overrides.requirementId,
    requirementPosition: overrides.requirementPosition ?? 1,
    priority: overrides.priority ?? "helpful",
    passPercent: overrides.passPercent ?? 50,
    critical: overrides.critical ?? false,
    scenarioId: overrides.scenarioId ?? "scenario",
    scenarioTitle: "Scenario",
    scenarioPosition: 1,
    category: "normal",
    repetition: 1,
    versionId: "version",
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

test("a critical requirement blocks release when any scenario fails", () => {
  const verdict = verdictForChecks(
    "version",
    "Careful",
    [
      check({ requirementId: "policy", requirementTitle: "Follows refund policy", outcome: "pass", critical: true, scenarioId: "a" }),
      check({ requirementId: "policy", outcome: "fail", critical: true, scenarioId: "b", gradeId: "b" }),
    ],
    50,
  );
  assert.equal(verdict.ready, false);
  assert.ok(verdict.reasons.some((reason) => reason.includes("Any failure blocks release")));
});

test("an unresolved needs_review result blocks a release pass", () => {
  const verdict = verdictForChecks(
    "version",
    "Careful",
    [
      check({
        requirementId: "policy",
        outcome: "pass",
        priority: "helpful",
        passPercent: 50,
        scenarioId: "a",
      }),
      check({
        requirementId: "policy",
        outcome: "needs_review",
        priority: "helpful",
        passPercent: 50,
        scenarioId: "b",
        gradeId: "b",
      }),
    ],
    50,
  );
  assert.equal(verdict.ready, false);
  assert.ok(verdict.reasons.some((reason) => reason.includes("needs review")));
});

test("a helpful requirement below its bar does not block release", () => {
  const verdict = verdictForChecks(
    "version",
    "Careful",
    [
      check({ requirementId: "length", outcome: "pass", priority: "helpful", passPercent: 100, scenarioId: "a" }),
      check({
        requirementId: "length",
        outcome: "fail",
        priority: "helpful",
        passPercent: 100,
        scenarioId: "b",
        gradeId: "b",
      }),
    ],
    50,
  );
  assert.equal(verdict.ready, true);
  assert.equal(verdict.requirements[0]?.blocksRelease, false);
});

test("a human override replaces the release outcome and keeps the original judgment", () => {
  const before = verdictForChecks(
    "version",
    "Careful",
    [
      check({
        requirementId: "policy",
        requirementTitle: "Does not invent a refund",
        outcome: "fail",
        automaticOutcome: "fail",
        critical: true,
        aiVerdict: "fail",
      }),
    ],
    80,
  );
  assert.equal(before.ready, false);
  assert.equal(verdictHeadline(before, false), "Does not meet configured criteria");

  const after = verdictForChecks(
    "version",
    "Careful",
    [
      check({
        requirementId: "policy",
        requirementTitle: "Does not invent a refund",
        outcome: "pass",
        automaticOutcome: "fail",
        critical: true,
        aiVerdict: "fail",
        review: {
          id: "review",
          decision: "pass",
          note: "The quoted sentence does not promise a refund.",
          createdAt: "2026-10-14T10:00:00.000Z",
          updatedAt: "2026-10-14T10:05:00.000Z",
        },
      }),
    ],
    80,
  );
  assert.equal(after.ready, true);
  assert.equal(after.humanReviewed, 1);
  assert.equal(verdictHeadline(after, false), "Meets configured criteria");
});

test("repeated evaluations score every repetition instead of collapsing to one result", () => {
  const verdict = verdictForChecks(
    "version",
    "Direct",
    [
      check({ scenarioId: "refund", repetition: 1, outcome: "pass", requirementId: "policy", critical: true }),
      check({
        scenarioId: "refund",
        repetition: 2,
        outcome: "fail",
        requirementId: "policy",
        critical: true,
        gradeId: "second",
      }),
    ],
    100,
  );
  assert.equal(verdict.passed, 1);
  assert.equal(verdict.scored, 2);
  assert.equal(verdict.ready, false);
  assert.equal(verdict.requirements[0]?.passed, 1);
  assert.equal(verdict.requirements[0]?.scored, 2);
});
