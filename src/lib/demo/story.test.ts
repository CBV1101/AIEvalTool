import assert from "node:assert/strict";
import test from "node:test";
import { countWords } from "@/lib/eval/text";
import {
  DEMO_REQUIREMENT_IDS,
  DEMO_SCENARIO_IDS,
  DEMO_VERSION_IDS,
  demoReplies,
} from "@/lib/demo/content";
import { demoChecks, demoVerdicts } from "@/lib/demo/story";

test("sample replies tell a release story", () => {
  const verdicts = demoVerdicts();
  assert.equal(verdicts.direct.incomplete, false);
  assert.equal(verdicts.careful.incomplete, false);
  assert.equal(verdicts.careful.ready, false);
  assert.ok(
    verdicts.careful.reasons.some((reason) => reason.includes("Does not invent a refund")),
    verdicts.careful.reasons.join("\n"),
  );
  assert.ok(
    verdicts.careful.watch.some((item) => item.includes("Stays under 120 words")),
    verdicts.careful.watch.join("\n"),
  );
  const policy = (verdict: typeof verdicts.direct) =>
    verdict.requirements.find((requirement) => requirement.title === "Does not invent a refund");
  const ack = (verdict: typeof verdicts.direct) =>
    verdict.requirements.find((requirement) => requirement.title === "Acknowledges the customer's situation");
  assert.ok((policy(verdicts.direct)?.passed ?? 0) > (policy(verdicts.careful)?.passed ?? 0));
  assert.ok((ack(verdicts.careful)?.passed ?? 0) > (ack(verdicts.direct)?.passed ?? 0));
});

test("careful replies miss only length on the two long scenarios", () => {
  const longIds = new Set([DEMO_SCENARIO_IDS.invoice, DEMO_SCENARIO_IDS.plan]);
  for (const reply of demoReplies) {
    const words = countWords(reply.text);
    if (reply.versionId === DEMO_VERSION_IDS.careful && longIds.has(reply.scenarioId as typeof DEMO_SCENARIO_IDS.invoice)) {
      assert.ok(words > 120, `${reply.scenarioId} has ${words} words`);
    } else {
      assert.ok(words <= 120, `${reply.versionId} ${reply.scenarioId} has ${words} words`);
    }
  }

  const checks = demoChecks().filter(
    (check) =>
      check.versionId === DEMO_VERSION_IDS.careful &&
      check.requirementId === DEMO_REQUIREMENT_IDS.length,
  );
  const failed = checks.filter((check) => check.outcome === "fail").map((check) => check.scenarioId);
  assert.deepEqual(failed.sort(), [DEMO_SCENARIO_IDS.invoice, DEMO_SCENARIO_IDS.plan].sort());
});

test("the more helpful version violates the refund policy more often", () => {
  const policyFails = (versionId: string) =>
    demoChecks().filter(
      (check) =>
        check.versionId === versionId &&
        check.requirementId === DEMO_REQUIREMENT_IDS.policy &&
        check.outcome === "fail",
    );
  const directFails = policyFails(DEMO_VERSION_IDS.direct);
  const carefulFails = policyFails(DEMO_VERSION_IDS.careful);
  assert.equal(directFails.length, 0);
  assert.ok(carefulFails.length > directFails.length);
  assert.ok(carefulFails.some((check) => check.scenarioId === DEMO_SCENARIO_IDS.student));
  assert.ok(carefulFails.some((check) => check.scenarioId === DEMO_SCENARIO_IDS.double));

  const helpfulPasses = (versionId: string, requirementId: string) =>
    demoChecks().filter(
      (check) => check.versionId === versionId && check.requirementId === requirementId && check.outcome === "pass",
    ).length;
  assert.ok(helpfulPasses(DEMO_VERSION_IDS.careful, DEMO_REQUIREMENT_IDS.ack) > helpfulPasses(DEMO_VERSION_IDS.direct, DEMO_REQUIREMENT_IDS.ack));
  assert.ok(helpfulPasses(DEMO_VERSION_IDS.careful, DEMO_REQUIREMENT_IDS.next) > helpfulPasses(DEMO_VERSION_IDS.direct, DEMO_REQUIREMENT_IDS.next));
});
