import { formatPercent, formatScore, type GradedCheck, type RequirementResult, type VersionVerdict } from "@/lib/eval/release";
import { estimateCostUsd, readModelPricing, type TokenPrice } from "@/lib/providers/pricing";
import type { Outcome, ResponseRecord, RunMode } from "@/lib/types";

export const TEST_SET_NOTE =
  "This reflects the configured test set and is not a guarantee of production performance.";

export type VersionMetrics = {
  versionId: string;
  versionName: string;
  passed: number;
  eligible: number;
  criticalFailures: number;
  unresolvedReviews: number;
  executionErrors: number;
  humanReviewed: number;
  checkCount: number;
  averageLatencyMs: number | null;
  latencyMeasured: number;
  latencyMissing: number;
  inputTokens: number | null;
  outputTokens: number | null;
  tokensMeasured: number;
  tokensMissing: number;
  estimatedCostUsd: number | null;
};

export type RequirementChange = {
  requirementId: string;
  title: string;
  position: number;
  a: RequirementResult | null;
  b: RequirementResult | null;
  direction: "a_higher" | "b_higher" | "same" | "waiting";
};

export type InconsistentVerdict = {
  scenarioId: string;
  scenarioTitle: string;
  versionId: string;
  versionName: string;
  requirementId: string;
  requirementTitle: string;
  outcomes: { repetition: number; outcome: Outcome; gradeId: string }[];
};

export function versionMetrics(
  versionId: string,
  versionName: string,
  checks: GradedCheck[],
  responses: ResponseRecord[],
  mode: RunMode,
  prices: Record<string, TokenPrice> = readModelPricing(),
): VersionMetrics {
  const mine = checks.filter((check) => check.versionId === versionId);
  const replies = responses.filter((response) => response.versionId === versionId);
  const eligibleChecks = mine.filter((check) => check.outcome === "pass" || check.outcome === "fail");
  const passed = eligibleChecks.filter((check) => check.outcome === "pass").length;
  const measured = replies.filter((response) => isMeasured(response, mode));
  const withLatency = measured.filter((response) => response.latencyMs !== null);
  const withTokens = measured.filter(
    (response) => response.inputTokens !== null && response.outputTokens !== null,
  );
  const costs = measured.map((response) =>
    estimateCostUsd(response.model, response.inputTokens, response.outputTokens, prices),
  );
  const costKnown = measured.length > 0 && costs.every((cost) => cost !== null);

  return {
    versionId,
    versionName,
    passed,
    eligible: eligibleChecks.length,
    criticalFailures: mine.filter((check) => check.critical && check.outcome === "fail").length,
    unresolvedReviews: mine.filter(
      (check) => check.outcome === "needs_review" || check.outcome === "unreviewed",
    ).length,
    executionErrors: replies.filter((response) => isExecutionError(response, mode)).length,
    humanReviewed: mine.filter((check) => check.review).length,
    checkCount: mine.length,
    averageLatencyMs:
      withLatency.length === 0
        ? null
        : Math.round(withLatency.reduce((sum, response) => sum + (response.latencyMs ?? 0), 0) / withLatency.length),
    latencyMeasured: withLatency.length,
    latencyMissing: measured.length - withLatency.length,
    inputTokens:
      withTokens.length === 0 ? null : withTokens.reduce((sum, response) => sum + (response.inputTokens ?? 0), 0),
    outputTokens:
      withTokens.length === 0 ? null : withTokens.reduce((sum, response) => sum + (response.outputTokens ?? 0), 0),
    tokensMeasured: withTokens.length,
    tokensMissing: measured.length - withTokens.length,
    estimatedCostUsd: costKnown ? costs.reduce<number>((sum, cost) => sum + (cost ?? 0), 0) : null,
  };
}

export function passRateLabel(metrics: VersionMetrics): string {
  if (metrics.eligible === 0) return "No eligible checks";
  return `${formatScore(metrics.passed, metrics.eligible)} eligible`;
}

export function humanReviewLabel(metrics: VersionMetrics): string {
  if (metrics.checkCount === 0) return "No checks to review";
  return `${formatPercent(metrics.humanReviewed / metrics.checkCount)} of checks reviewed by a person (${metrics.humanReviewed} of ${metrics.checkCount})`;
}

export function latencyLabel(metrics: VersionMetrics): string {
  if (metrics.averageLatencyMs === null) return "Not measured.";
  const average = `Average ${metrics.averageLatencyMs} ms`;
  if (metrics.latencyMissing > 0) return `${average}. Some replies did not report latency.`;
  return average;
}

export function tokenLabel(metrics: VersionMetrics): string {
  if (metrics.inputTokens === null || metrics.outputTokens === null) return "Not measured.";
  const totals = `${metrics.inputTokens} in · ${metrics.outputTokens} out`;
  if (metrics.tokensMissing > 0) return `${totals}. Some replies did not report tokens.`;
  return totals;
}

export function costLabelForVersion(metrics: VersionMetrics): string {
  if (metrics.estimatedCostUsd === null) return "Cost unavailable.";
  return `Estimated cost $${metrics.estimatedCostUsd.toFixed(4)}`;
}

export function presentedVerdict(verdict: VersionVerdict, executionErrors: number): VersionVerdict {
  if (executionErrors <= 0) return verdict;
  const reason =
    executionErrors === 1
      ? "1 reply failed or was cancelled during execution."
      : `${executionErrors} replies failed or were cancelled during execution.`;
  const reasons = verdict.reasons.includes(reason) ? verdict.reasons : [reason, ...verdict.reasons];
  if (verdict.incomplete) return { ...verdict, reasons };
  return { ...verdict, ready: false, incomplete: true, reasons };
}

export function requirementChanges(
  versionA: VersionVerdict,
  versionB: VersionVerdict,
): RequirementChange[] {
  const ids = new Map<string, { title: string; position: number }>();
  for (const requirement of [...versionA.requirements, ...versionB.requirements]) {
    ids.set(requirement.requirementId, { title: requirement.title, position: requirement.position });
  }
  return [...ids.entries()]
    .map(([requirementId, meta]) => {
      const a = versionA.requirements.find((item) => item.requirementId === requirementId) ?? null;
      const b = versionB.requirements.find((item) => item.requirementId === requirementId) ?? null;
      return {
        requirementId,
        title: meta.title,
        position: meta.position,
        a,
        b,
        direction: changeDirection(a, b),
      };
    })
    .sort((left, right) => left.position - right.position || left.title.localeCompare(right.title));
}

export function changeLabel(change: RequirementChange, versionAName: string, versionBName: string): string {
  if (change.direction === "a_higher") return `${versionAName} is higher`;
  if (change.direction === "b_higher") return `${versionBName} is higher`;
  if (change.direction === "same") return "Same pass rate";
  return "Waiting on a scored result";
}

export function tradeoffSummary(changes: RequirementChange[], versionAName: string, versionBName: string): string | null {
  const aHigher = changes.filter((change) => change.direction === "a_higher").map((change) => change.title);
  const bHigher = changes.filter((change) => change.direction === "b_higher").map((change) => change.title);
  if (aHigher.length === 0 || bHigher.length === 0) return null;
  return `${versionAName} is higher on ${joinTitles(aHigher)}. ${versionBName} is higher on ${joinTitles(bHigher)}.`;
}

export function inconsistentVerdicts(
  checks: GradedCheck[],
  versionNames: Map<string, string>,
): InconsistentVerdict[] {
  const groups = new Map<string, GradedCheck[]>();
  for (const check of checks) {
    const key = `${check.scenarioId}:${check.versionId}:${check.requirementId}`;
    const list = groups.get(key) ?? [];
    list.push(check);
    groups.set(key, list);
  }
  const found: InconsistentVerdict[] = [];
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const outcomes = new Set(group.map((check) => check.outcome));
    if (outcomes.size < 2) continue;
    const first = group[0];
    found.push({
      scenarioId: first.scenarioId,
      scenarioTitle: first.scenarioTitle,
      versionId: first.versionId,
      versionName: versionNames.get(first.versionId) ?? first.versionId,
      requirementId: first.requirementId,
      requirementTitle: first.requirementTitle,
      outcomes: group
        .map((check) => ({ repetition: check.repetition, outcome: check.outcome, gradeId: check.gradeId }))
        .sort((left, right) => left.repetition - right.repetition),
    });
  }
  return found.sort(
    (left, right) =>
      left.scenarioTitle.localeCompare(right.scenarioTitle) ||
      left.versionName.localeCompare(right.versionName) ||
      left.requirementTitle.localeCompare(right.requirementTitle),
  );
}

export function requirementRateLabel(requirement: RequirementResult | null): string {
  if (!requirement) return "Not scored";
  const unresolved = requirement.unreviewed + requirement.needsReview;
  if (requirement.scored === 0) {
    return unresolved > 0 ? `No eligible checks · ${unresolved} unresolved` : "No eligible checks";
  }
  const rate = `${formatScore(requirement.passed, requirement.scored)} eligible`;
  return unresolved > 0 ? `${rate} · ${unresolved} unresolved` : rate;
}

function changeDirection(a: RequirementResult | null, b: RequirementResult | null): RequirementChange["direction"] {
  const left = rate(a);
  const right = rate(b);
  if (left === null || right === null) return "waiting";
  if (left > right) return "a_higher";
  if (right > left) return "b_higher";
  return "same";
}

function rate(requirement: RequirementResult | null): number | null {
  if (!requirement || requirement.scored === 0) return null;
  return requirement.passed / requirement.scored;
}

function joinTitles(titles: string[]): string {
  if (titles.length === 1) return titles[0];
  if (titles.length === 2) return `${titles[0]} and ${titles[1]}`;
  return `${titles.slice(0, -1).join(", ")}, and ${titles[titles.length - 1]}`;
}

function isMeasured(response: ResponseRecord, mode: RunMode): boolean {
  return mode !== "demo" && response.source === "model";
}

function isExecutionError(response: ResponseRecord, mode: RunMode): boolean {
  if (mode === "demo" || response.source === "demo" || response.source === "sample") return false;
  return response.callStatus === "failed" || response.callStatus === "cancelled" || response.errorText.trim().length > 0;
}
