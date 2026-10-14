import {
  costLabelForVersion,
  humanReviewLabel,
  inconsistentVerdicts,
  latencyLabel,
  passRateLabel,
  presentedVerdict,
  requirementChanges,
  requirementRateLabel,
  TEST_SET_NOTE,
  tokenLabel,
  versionMetrics,
  type VersionMetrics,
} from "@/lib/eval/comparison";
import { verdictHeadline, type GradedCheck, type VersionVerdict } from "@/lib/eval/release";
import { checksFromBundle, type RunBundle } from "@/lib/eval/report";
import type { TokenPrice } from "@/lib/providers/pricing";
import type { EvaluationRun, PromptVersion, Scenario } from "@/lib/types";

export function detailedResultsCsv(bundle: RunBundle, scenarios: Pick<Scenario, "id" | "category">[] = []): string {
  const checks = checksFromBundle(bundle, scenarios);
  const responses = new Map(bundle.responses.map((response) => [response.id, response]));
  const header = [
    "run",
    "version",
    "scenario",
    "category",
    "repetition",
    "requirement",
    "priority",
    "critical",
    "outcome",
    "eligible",
    "ai_verdict",
    "ai_explanation",
    "ai_evidence",
    "deterministic_outcome",
    "deterministic_explanation",
    "human_decision",
    "human_note",
    "human_updated_at",
    "customer_input",
    "expected_behavior",
    "response",
    "call_status",
    "error",
    "latency_ms",
    "input_tokens",
    "output_tokens",
    "provider",
    "model",
  ];
  const rows = checks
    .slice()
    .sort(
      (left, right) =>
        left.scenarioPosition - right.scenarioPosition ||
        left.repetition - right.repetition ||
        left.requirementPosition - right.requirementPosition ||
        versionRank(bundle.run, left.versionId) - versionRank(bundle.run, right.versionId),
    )
    .map((check) => {
      const response = responses.get(check.responseId);
      const versionName = check.versionId === bundle.run.versionAId ? bundle.run.versionAName : bundle.run.versionBName;
      return [
        bundle.run.name,
        versionName,
        check.scenarioTitle,
        check.category,
        check.repetition,
        check.requirementTitle,
        check.priority,
        check.critical ? "yes" : "no",
        check.outcome,
        check.outcome === "pass" || check.outcome === "fail" ? "yes" : "no",
        check.aiVerdict,
        check.aiExplanation,
        check.aiEvidence,
        check.deterministicOutcome,
        check.deterministicExplanation,
        check.review?.decision ?? "",
        check.review?.note ?? "",
        check.review?.updatedAt ?? "",
        check.customerInput,
        check.goodLooksLike,
        check.outputText,
        response?.callStatus ?? "",
        response?.errorText ?? "",
        response?.latencyMs ?? "",
        response?.inputTokens ?? "",
        response?.outputTokens ?? "",
        response?.provider ?? "",
        response?.model ?? "",
      ].map(csvCell);
    });
  return [header.join(","), ...rows.map((row) => row.join(","))].join("\n");
}

export function decisionReport(
  bundle: RunBundle,
  verdicts: { versionA: VersionVerdict; versionB: VersionVerdict },
  scenarios: Pick<Scenario, "id" | "category">[] = [],
  versions: Pick<PromptVersion, "id" | "name" | "provider" | "model">[] = [],
  prices?: Record<string, TokenPrice>,
): string {
  const checks = checksFromBundle(bundle, scenarios);
  const metricsA = metricsFor(bundle, verdicts.versionA, checks, prices);
  const metricsB = metricsFor(bundle, verdicts.versionB, checks, prices);
  const shownA = presentedVerdict(verdicts.versionA, metricsA.executionErrors);
  const shownB = presentedVerdict(verdicts.versionB, metricsB.executionErrors);
  const changes = requirementChanges(shownA, shownB);
  const names = new Map([
    [bundle.run.versionAId, bundle.run.versionAName],
    [bundle.run.versionBId, bundle.run.versionBName],
  ]);
  const inconsistencies = bundle.run.repetitions > 1 ? inconsistentVerdicts(checks, names) : [];
  const lines = [
    `# Decision report: ${bundle.run.name}`,
    "",
    TEST_SET_NOTE,
    "",
    "## Run settings",
    "",
    `- Versions: ${bundle.run.versionAName} and ${bundle.run.versionBName}`,
    `- ${versionSetting(bundle.run.versionAName, versions.find((version) => version.id === bundle.run.versionAId))}`,
    `- ${versionSetting(bundle.run.versionBName, versions.find((version) => version.id === bundle.run.versionBId))}`,
    `- Scenario set: ${bundle.run.dataset === "holdout" ? "holdout" : "development"}`,
    `- Repetitions: ${bundle.run.repetitions || 1}`,
    `- Release bar: ${bundle.run.minPassRate}% of eligible checks`,
    `- Grader: ${bundle.run.graderModel ? `${bundle.run.graderProvider} · ${bundle.run.graderModel}` : "not configured"}`,
    `- Mode: ${bundle.run.mode === "live" || bundle.run.mode === "demo" ? bundle.run.mode : "unset"}`,
    `- Graded: ${bundle.run.gradedAt ?? "not graded"}`,
    "",
    "## Release status",
    "",
    statusBlock(shownA, bundle.run.isSample, bundle.run.mode === "demo"),
    "",
    statusBlock(shownB, bundle.run.isSample, bundle.run.mode === "demo"),
    "",
    "## Results",
    "",
    `| Requirement | ${bundle.run.versionAName} | ${bundle.run.versionBName} | Change |`,
    "| --- | --- | --- | --- |",
    ...changes.map(
      (change) =>
        `| ${markdownCell(change.title)} | ${markdownCell(requirementRateLabel(change.a))} | ${markdownCell(requirementRateLabel(change.b))} | ${markdownCell(change.direction === "a_higher" ? `${bundle.run.versionAName} is higher` : change.direction === "b_higher" ? `${bundle.run.versionBName} is higher` : change.direction === "same" ? "Same pass rate" : "Waiting on a scored result")} |`,
    ),
    "",
    `Overall ${bundle.run.versionAName}: ${passRateLabel(metricsA)}.`,
    `Overall ${bundle.run.versionBName}: ${passRateLabel(metricsB)}.`,
    "",
    "## Review coverage",
    "",
    `- ${bundle.run.versionAName}: ${humanReviewLabel(metricsA)}`,
    `- ${bundle.run.versionBName}: ${humanReviewLabel(metricsB)}`,
    "",
    "## Measurements",
    "",
    measurementBlock(metricsA),
    "",
    measurementBlock(metricsB),
  ];
  if (inconsistencies.length > 0) {
    lines.push("", "## Inconsistent repetitions", "");
    for (const item of inconsistencies) {
      const detail = item.outcomes.map((outcome) => `repetition ${outcome.repetition} ${outcome.outcome}`).join(", ");
      lines.push(`- ${item.scenarioTitle} · ${item.versionName} · ${item.requirementTitle}: ${detail}`);
    }
  }
  lines.push("");
  return lines.join("\n");
}

export function exportFileName(runName: string, kind: "results" | "decision"): string {
  const slug = runName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const base = slug || "evaluation";
  return kind === "results" ? `${base}-results.csv` : `${base}-decision.md`;
}

function metricsFor(
  bundle: RunBundle,
  verdict: VersionVerdict,
  checks: GradedCheck[],
  prices?: Record<string, TokenPrice>,
): VersionMetrics {
  return versionMetrics(
    verdict.versionId,
    verdict.versionName,
    checks,
    bundle.responses,
    bundle.run.mode,
    prices,
  );
}

function statusBlock(verdict: VersionVerdict, sample: boolean, demo: boolean): string {
  const lines = [`### ${verdict.versionName}`, "", verdictHeadline(verdict, sample, demo)];
  if (verdict.reasons.length === 0) {
    lines.push("", "Every blocker, important, and critical requirement meets its bar, and the overall pass rate meets the configured bar.");
  } else {
    lines.push("", "Requirements and checks driving this status:");
    for (const reason of verdict.reasons) lines.push(`- ${reason}`);
  }
  return lines.join("\n");
}

function measurementBlock(metrics: VersionMetrics): string {
  return [
    `### ${metrics.versionName}`,
    "",
    `- Critical failures: ${metrics.criticalFailures}`,
    `- Unresolved reviews: ${metrics.unresolvedReviews}`,
    `- Execution errors: ${metrics.executionErrors}`,
    `- Latency: ${latencyLabel(metrics)}`,
    `- Tokens: ${tokenLabel(metrics)}`,
    `- Cost: ${costLabelForVersion(metrics)}`,
  ].join("\n");
}

function versionSetting(
  name: string,
  version: Pick<PromptVersion, "provider" | "model"> | undefined,
): string {
  if (!version) return `${name}: provider and model were not stored on this run`;
  const provider = version.provider === "anthropic" ? "Anthropic" : version.provider === "openai" ? "OpenAI" : "Provider not set";
  const model = version.model?.trim() ? version.model : "model identifier not set";
  return `${name}: ${provider} · ${model}`;
}

function versionRank(run: EvaluationRun, versionId: string): number {
  return versionId === run.versionAId ? 0 : 1;
}

function csvCell(value: string | number | boolean): string {
  const text = String(value);
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  if (/[",\n\r]/.test(safe)) return `"${safe.replaceAll('"', '""')}"`;
  return safe;
}

function markdownCell(value: string): string {
  return value.replaceAll("|", "\\|").replaceAll("\n", " ");
}
