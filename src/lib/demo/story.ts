import { gradeText } from "@/lib/eval/grading";
import {
  effectiveOutcome,
  verdictForChecks,
  type GradedCheck,
  type VersionVerdict,
} from "@/lib/eval/release";
import {
  DEMO_GRADED_AT,
  DEMO_MIN_PASS_RATE,
  DEMO_VERSION_IDS,
  demoReplies,
  demoRequirements,
  demoReviews,
  demoScenarios,
  demoVersions,
} from "@/lib/demo/content";

export function demoResponseId(versionId: string, scenarioId: string): string {
  return `demo-response-${versionId}-${scenarioId}`;
}

export function demoGradeId(
  versionId: string,
  scenarioId: string,
  requirementId: string,
): string {
  return `demo-grade-${versionId}-${scenarioId}-${requirementId}`;
}

export function demoReviewId(
  versionId: string,
  scenarioId: string,
  requirementId: string,
): string {
  return `demo-review-${versionId}-${scenarioId}-${requirementId}`;
}

export function demoChecks(): GradedCheck[] {
  const checks: GradedCheck[] = [];
  for (const reply of demoReplies) {
    const scenario = demoScenarios.find((item) => item.id === reply.scenarioId);
    if (!scenario) continue;
    for (const requirement of demoRequirements) {
      const graded = gradeText(
        reply.text,
        requirement.checkType,
        requirement.checkConfig,
      );
      const review = demoReviews.find(
        (item) =>
          item.scenarioId === reply.scenarioId &&
          item.versionId === reply.versionId &&
          item.requirementId === requirement.id,
      );
      checks.push({
        gradeId: demoGradeId(reply.versionId, reply.scenarioId, requirement.id),
        responseId: demoResponseId(reply.versionId, reply.scenarioId),
        requirementId: requirement.id,
        requirementTitle: requirement.title,
        requirementPosition: requirement.position,
        priority: requirement.priority,
        passPercent: requirement.passPercent,
        critical: requirement.critical,
        scenarioId: scenario.id,
        scenarioTitle: scenario.title,
        scenarioPosition: scenario.position,
        category: scenario.category,
        repetition: 1,
        versionId: reply.versionId,
        outcome: effectiveOutcome(graded.outcome, review?.decision ?? null),
        automaticOutcome: graded.outcome,
        explanation: graded.explanation,
        aiVerdict: "",
        aiExplanation: "",
        aiEvidence: "",
        deterministicOutcome: graded.outcome === "unreviewed" ? "" : graded.outcome,
        deterministicExplanation: graded.outcome === "unreviewed" ? "" : graded.explanation,
        outputText: reply.text,
        customerInput: scenario.customerInput,
        situation: scenario.situation,
        goodLooksLike: scenario.goodLooksLike,
        promptSnapshot: "",
        review: review
          ? {
              id: demoReviewId(reply.versionId, reply.scenarioId, requirement.id),
              decision: review.decision,
              note: review.note,
              createdAt: "2026-03-04T15:30:00.000Z",
              updatedAt: "2026-03-04T15:30:00.000Z",
            }
          : null,
      });
    }
  }
  return checks;
}

export function demoVerdicts(): { direct: VersionVerdict; careful: VersionVerdict } {
  const checks = demoChecks();
  const directVersion = demoVersions.find((version) => version.id === DEMO_VERSION_IDS.direct);
  const carefulVersion = demoVersions.find((version) => version.id === DEMO_VERSION_IDS.careful);
  return {
    direct: verdictForChecks(
      DEMO_VERSION_IDS.direct,
      directVersion?.name ?? "Direct v1",
      checks.filter((check) => check.versionId === DEMO_VERSION_IDS.direct),
      DEMO_MIN_PASS_RATE,
    ),
    careful: verdictForChecks(
      DEMO_VERSION_IDS.careful,
      carefulVersion?.name ?? "Careful v2",
      checks.filter((check) => check.versionId === DEMO_VERSION_IDS.careful),
      DEMO_MIN_PASS_RATE,
    ),
  };
}

export const demoGradedAt = DEMO_GRADED_AT;
