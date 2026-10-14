import { priorityLabel } from "@/lib/labels";
import type { Decision, Outcome, Priority, ScenarioCategory } from "@/lib/types";

export type GradedCheck = {
  gradeId: string;
  responseId: string;
  requirementId: string;
  requirementTitle: string;
  requirementPosition: number;
  priority: Priority;
  passPercent: number;
  critical: boolean;
  scenarioId: string;
  scenarioTitle: string;
  scenarioPosition: number;
  category: ScenarioCategory;
  repetition: number;
  versionId: string;
  outcome: Outcome;
  automaticOutcome: Outcome;
  explanation: string;
  aiVerdict: Outcome | "";
  aiExplanation: string;
  aiEvidence: string;
  deterministicOutcome: Outcome | "";
  deterministicExplanation: string;
  outputText: string;
  customerInput: string;
  situation: string;
  goodLooksLike: string;
  promptSnapshot: string;
  review: { id: string; decision: Decision; note: string; createdAt: string; updatedAt: string } | null;
};

export type RequirementState = "met" | "below_bar" | "needs_review";

export type RequirementResult = {
  requirementId: string;
  title: string;
  priority: Priority;
  passPercent: number;
  critical: boolean;
  position: number;
  passed: number;
  scored: number;
  total: number;
  unreviewed: number;
  needsReview: number;
  state: RequirementState;
  blocksRelease: boolean;
};

export type VersionVerdict = {
  versionId: string;
  versionName: string;
  passRate: number | null;
  passed: number;
  scored: number;
  ready: boolean;
  incomplete: boolean;
  reasons: string[];
  watch: string[];
  requirements: RequirementResult[];
  humanReviewed: number;
  checkCount: number;
};

export function effectiveOutcome(
  automatic: Outcome,
  decision: Decision | null,
): Outcome {
  if (decision) return decision;
  return automatic;
}

export function passesNeeded(percent: number, scenarios: number): number {
  if (scenarios <= 0) return 0;
  for (let count = 0; count <= scenarios; count += 1) {
    if (count / scenarios >= percent / 100) return count;
  }
  return scenarios;
}

export function barHint(percent: number, scenarios: number): string {
  if (scenarios <= 0) {
    return "Add scenarios to see how many replies must pass.";
  }
  const needed = passesNeeded(percent, scenarios);
  const noun = scenarios === 1 ? "scenario" : "scenarios";
  return `With ${scenarios} ${noun}, ${percent}% means at least ${needed} must pass.`;
}

export function formatPercent(rate: number): string {
  const pct = rate * 100;
  const shown = Number.isInteger(Math.round(pct * 10) / 10)
    ? `${Math.round(pct * 10) / 10}`
    : pct.toFixed(1);
  const cleaned = shown.endsWith(".0") ? shown.slice(0, -2) : shown;
  return `${cleaned}%`;
}

export function formatScore(passed: number, scored: number): string {
  if (scored === 0) return "No scored checks";
  return `${passed} of ${scored} (${formatPercent(passed / scored)})`;
}

function requirementResult(checks: GradedCheck[]): RequirementResult {
  const first = checks[0];
  const total = checks.length;
  const unreviewed = checks.filter((check) => check.outcome === "unreviewed").length;
  const needsReview = checks.filter((check) => check.outcome === "needs_review").length;
  const passed = checks.filter((check) => check.outcome === "pass").length;
  const scored = total - unreviewed - needsReview;
  const failed = checks.filter((check) => check.outcome === "fail").length;
  const rate = scored === 0 ? null : passed / scored;
  const barMet = rate !== null && rate >= first.passPercent / 100;
  const governsRelease = first.critical || first.priority !== "helpful";
  let state: RequirementState = "met";
  let blocksRelease = false;

  if (needsReview > 0) {
    state = "needs_review";
    blocksRelease = true;
  } else if (governsRelease && unreviewed > 0) {
    state = "needs_review";
    blocksRelease = true;
  } else if (scored === 0) {
    state = "needs_review";
  } else if (first.critical && failed > 0) {
    state = "below_bar";
    blocksRelease = true;
  } else if (!barMet) {
    state = "below_bar";
    blocksRelease = first.priority !== "helpful";
  }

  return {
    requirementId: first.requirementId,
    title: first.requirementTitle,
    priority: first.priority,
    passPercent: first.passPercent,
    critical: first.critical,
    position: first.requirementPosition,
    passed,
    scored,
    total,
    unreviewed,
    needsReview,
    state,
    blocksRelease,
  };
}

export function verdictForChecks(
  versionId: string,
  versionName: string,
  checks: GradedCheck[],
  minPassRate: number,
): VersionVerdict {
  const grouped = new Map<string, GradedCheck[]>();
  for (const check of checks) {
    const list = grouped.get(check.requirementId) ?? [];
    list.push(check);
    grouped.set(check.requirementId, list);
  }

  const requirements = [...grouped.values()]
    .map((group) => requirementResult(group))
    .sort((a, b) => a.position - b.position || a.title.localeCompare(b.title));

  const scoredChecks = checks.filter(
    (check) => check.outcome !== "unreviewed" && check.outcome !== "needs_review",
  );
  const passed = scoredChecks.filter((check) => check.outcome === "pass").length;
  const scored = scoredChecks.length;
  const passRate = scored === 0 ? null : passed / scored;
  const incomplete =
    scored === 0 ||
    checks.some((check) => check.outcome === "needs_review") ||
    requirements.some(
      (requirement) =>
        (requirement.critical || requirement.priority !== "helpful") &&
        requirement.state === "needs_review",
    );
  const belowOverall = passRate === null || passRate < minPassRate / 100;
  const blocked = requirements.some((requirement) => requirement.blocksRelease);
  const ready = !incomplete && !belowOverall && !blocked;

  const reasons: string[] = [];
  const watch: string[] = [];

  if (scored === 0) {
    reasons.push("Grade this version before checking the release bar.");
  }

  for (const requirement of requirements) {
    if (requirement.needsReview > 0) {
      reasons.push(
        `“${requirement.title}” has an AI judgment that needs review, so this is not a release pass.`,
      );
    } else if (
      (requirement.critical || requirement.priority !== "helpful") &&
      requirement.state === "needs_review"
    ) {
      const label = requirement.critical ? "Critical requirement" : priorityLabel(requirement.priority);
      reasons.push(`“${requirement.title}” (${label}) still needs a human decision.`);
    }
  }

  if (passRate !== null && belowOverall) {
    reasons.push(
      `Overall pass rate is ${formatPercent(passRate)}, below the ${minPassRate}% release bar.`,
    );
  }

  for (const requirement of requirements) {
    if (requirement.state === "below_bar" && requirement.blocksRelease) {
      const failed = requirement.scored - requirement.passed;
      if (requirement.critical && failed > 0) {
        const noun = failed === 1 ? "scenario" : "scenarios";
        reasons.push(
          `Critical requirement “${requirement.title}” failed ${failed} ${noun}. Any failure blocks release.`,
        );
      } else {
        reasons.push(
          `${priorityLabel(requirement.priority)} “${requirement.title}” passed ${requirement.passed} of ${requirement.scored} scenarios. The bar is ${requirement.passPercent}%.`,
        );
      }
    }
    if (requirement.priority === "helpful" && requirement.state === "below_bar") {
      watch.push(
        `“${requirement.title}” passed ${requirement.passed} of ${requirement.scored} scenarios, below its ${requirement.passPercent}% bar. Helpful requirements do not block release on their own.`,
      );
    }
    if (requirement.priority === "helpful" && requirement.state === "needs_review") {
      watch.push(
        `“${requirement.title}” has not been reviewed yet. Helpful requirements do not block release while they wait.`,
      );
    }
  }

  return {
    versionId,
    versionName,
    passRate,
    passed,
    scored,
    ready,
    incomplete,
    reasons,
    watch,
    requirements,
    humanReviewed: checks.filter((check) => check.review).length,
    checkCount: checks.length,
  };
}

export function verdictHeadline(verdict: VersionVerdict, _sample: boolean, demo = false): string {
  if (demo) {
    if (verdict.incomplete) return "Demo mode is not a measurement";
    return verdict.ready
      ? "Demo mode only. Not a measurement"
      : "Demo mode only. Not a measurement";
  }
  if (verdict.incomplete) return "Incomplete: review or execution required";
  if (verdict.ready) return "Meets configured criteria";
  return "Does not meet configured criteria";
}

export function verdictShort(verdict: VersionVerdict, demo = false): string {
  if (demo) return "is demo mode and is not a measurement";
  if (verdict.incomplete) return "is incomplete: review or execution required";
  return verdict.ready ? "meets configured criteria" : "does not meet configured criteria";
}
