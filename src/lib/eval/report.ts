import {
  effectiveOutcome,
  verdictForChecks,
  type GradedCheck,
  type VersionVerdict,
} from "@/lib/eval/release";
import type {
  EvaluationRun,
  GradeRecord,
  ResponseRecord,
  ReviewRecord,
  Scenario,
  ScenarioCategory,
} from "@/lib/types";

export type RunBundle = {
  run: EvaluationRun;
  responses: ResponseRecord[];
  grades: GradeRecord[];
  reviews: ReviewRecord[];
};

export type VersionReport = {
  versionA: VersionVerdict;
  versionB: VersionVerdict;
};

export function checksFromBundle(
  bundle: RunBundle,
  scenarios: Pick<Scenario, "id" | "category">[] = [],
): GradedCheck[] {
  const reviewsByGrade = new Map(bundle.reviews.map((review) => [review.gradeId, review]));
  const responsesById = new Map(bundle.responses.map((response) => [response.id, response]));
  const categories = new Map<string, ScenarioCategory>(scenarios.map((scenario) => [scenario.id, scenario.category]));
  const checks: GradedCheck[] = [];

  for (const grade of bundle.grades) {
    const response = responsesById.get(grade.responseId);
    if (!response) continue;
    const review = reviewsByGrade.get(grade.id) ?? null;
    checks.push({
      gradeId: grade.id,
      responseId: response.id,
      requirementId: grade.requirementId,
      requirementTitle: grade.requirementTitle,
      requirementPosition: grade.requirementPosition,
      priority: grade.priority,
      passPercent: grade.passPercent,
      critical: grade.critical,
      scenarioId: response.scenarioId,
      scenarioTitle: response.scenarioTitle,
      scenarioPosition: response.scenarioPosition,
      category: categories.get(response.scenarioId) ?? "normal",
      repetition: response.repetition,
      versionId: response.versionId,
      outcome: effectiveOutcome(grade.automaticOutcome, review?.decision ?? null),
      automaticOutcome: grade.automaticOutcome,
      explanation: grade.explanation,
      aiVerdict: grade.aiVerdict,
      aiExplanation: grade.aiExplanation,
      aiEvidence: grade.aiEvidence,
      deterministicOutcome: grade.deterministicOutcome,
      deterministicExplanation: grade.deterministicExplanation,
      outputText: response.outputText,
      customerInput: response.customerInput,
      situation: response.situation,
      goodLooksLike: response.goodLooksLike,
      promptSnapshot: response.promptSnapshot,
      review: review
        ? {
            id: review.id,
            decision: review.decision,
            note: review.note,
            createdAt: review.createdAt,
            updatedAt: review.updatedAt,
          }
        : null,
    });
  }

  return checks;
}

export function reportFromBundle(bundle: RunBundle): VersionReport {
  const checks = checksFromBundle(bundle);
  return {
    versionA: verdictForChecks(
      bundle.run.versionAId,
      bundle.run.versionAName,
      checks.filter((check) => check.versionId === bundle.run.versionAId),
      bundle.run.minPassRate,
    ),
    versionB: verdictForChecks(
      bundle.run.versionBId,
      bundle.run.versionBName,
      checks.filter((check) => check.versionId === bundle.run.versionBId),
      bundle.run.minPassRate,
    ),
  };
}

export type ScenarioCell = {
  versionId: string;
  versionName: string;
  responseId: string;
  repetition: number;
  outputText: string;
  promptSnapshot: string;
  source: ResponseRecord["source"];
  callStatus: ResponseRecord["callStatus"];
  latencyMs: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  errorText: string;
  provider: string;
  model: string;
  passed: number;
  failed: number;
  unreviewed: number;
  failedTitles: string[];
  checks: GradedCheck[];
};

export type ScenarioSummary = {
  scenarioId: string;
  title: string;
  position: number;
  customerInput: string;
  situation: string;
  goodLooksLike: string;
  cells: ScenarioCell[];
};

export function scenarioSummaries(bundle: RunBundle, checks: GradedCheck[]): ScenarioSummary[] {
  const versions = [
    { id: bundle.run.versionAId, name: bundle.run.versionAName },
    { id: bundle.run.versionBId, name: bundle.run.versionBName },
  ];
  const byScenario = new Map<string, ScenarioSummary>();

  for (const response of bundle.responses) {
    const summary = byScenario.get(response.scenarioId) ?? {
      scenarioId: response.scenarioId,
      title: response.scenarioTitle,
      position: response.scenarioPosition,
      customerInput: response.customerInput,
      situation: response.situation,
      goodLooksLike: response.goodLooksLike,
      cells: [],
    };
    byScenario.set(response.scenarioId, summary);
  }

  for (const summary of byScenario.values()) {
    const responses = bundle.responses
      .filter((item) => item.scenarioId === summary.scenarioId)
      .sort((a, b) => a.repetition - b.repetition || versionOrder(a.versionId) - versionOrder(b.versionId));
    summary.cells = responses.map((response) => {
      const version = versions.find((item) => item.id === response.versionId);
      const cellChecks = checks
        .filter((check) => check.responseId === response.id)
        .sort((a, b) => a.requirementPosition - b.requirementPosition);
      return {
        versionId: response.versionId,
        versionName: version?.name ?? response.versionId,
        responseId: response.id,
        repetition: response.repetition,
        outputText: response.outputText,
        promptSnapshot: response.promptSnapshot,
        source: response.source,
        callStatus: response.callStatus,
        latencyMs: response.latencyMs,
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
        errorText: response.errorText,
        provider: response.provider,
        model: response.model,
        passed: cellChecks.filter((check) => check.outcome === "pass").length,
        failed: cellChecks.filter((check) => check.outcome === "fail").length,
        unreviewed: cellChecks.filter(
          (check) => check.outcome === "unreviewed" || check.outcome === "needs_review",
        ).length,
        failedTitles: cellChecks
          .filter((check) => check.outcome === "fail")
          .map((check) => check.requirementTitle),
        checks: cellChecks,
      };
    });
    function versionOrder(versionId: string): number {
      return versionId === bundle.run.versionAId ? 0 : 1;
    }
  }

  return [...byScenario.values()].sort((a, b) => a.position - b.position);
}

export function preferredRun<T extends { status: string; isSample: boolean; gradedAt: string | null; createdAt: string }>(
  runs: T[],
): T | null {
  const graded = runs.filter((run) => run.status === "graded");
  const own = graded.filter((run) => !run.isSample);
  const pool = own.length > 0 ? own : graded.filter((run) => run.isSample);
  pool.sort((a, b) => (b.gradedAt ?? b.createdAt).localeCompare(a.gradedAt ?? a.createdAt));
  return pool[0] ?? null;
}
