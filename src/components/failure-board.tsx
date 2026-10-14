import Link from "next/link";
import { recordReview, removeReview, resetSampleReviews } from "@/lib/actions/reviews";
import { ReviewForm } from "@/components/review-form";
import { Pill, PriorityPill } from "@/components/ui";
import { formatScore } from "@/lib/eval/release";
import { formatWhen } from "@/lib/eval/text";
import type { GradedCheck, VersionVerdict } from "@/lib/eval/release";
import { categoryLabel, referenceKindLabel } from "@/lib/labels";
import type { EvaluationRun, ReferenceMaterial } from "@/lib/types";

const VERDICT_OPTIONS = [
  { value: "open", label: "Open issues" },
  { value: "fail", label: "Fail" },
  { value: "needs_review", label: "Needs review" },
  { value: "unreviewed", label: "Needs a person" },
  { value: "pass", label: "Pass" },
  { value: "override", label: "Human overrides" },
  { value: "decisions", label: "All human decisions" },
  { value: "all", label: "All verdicts" },
] as const;

export function FailureBoard({
  projectId,
  runs,
  run,
  checks,
  verdicts,
  materials,
  filters,
}: {
  projectId: string;
  runs: EvaluationRun[];
  run: EvaluationRun;
  checks: GradedCheck[];
  verdicts: { versionA: VersionVerdict; versionB: VersionVerdict };
  materials: ReferenceMaterial[];
  filters: { version: string; requirement: string; category: string; verdict: string };
}) {
  const requirements = uniqueRequirements(checks);
  const categories = uniqueCategories(checks);
  const visible = pairChecks(checks, run, filters);
  const openCount = checks.filter((check) => isOpen(check)).length;
  const returnTo = currentQuery(projectId, run.id, filters);

  return (
    <div className="stack-lg">
      <header className="stack">
        <p className="eyebrow">Failure review</p>
        <h2>Decide which misses matter</h2>
        <p className="lede">
          Each requirement has an AI judgment. A failed deterministic check also fails that
          requirement. Your decision replaces the score for release and keeps the original AI
          judgment. The run snapshot stays as it was when the evaluation started.
        </p>
      </header>

      {run.isSample ? (
        <div className="banner banner-sample stack">
          <p>
            <strong>Sample data.</strong> These failures come from the walkthrough. Decisions you
            save stay on this computer and do not turn the sample replies into a live evaluation.
          </p>
          <form action={resetSampleReviews.bind(null, projectId, run.id)}>
            <button className="btn" type="submit">
              Restore sample decisions
            </button>
          </form>
        </div>
      ) : null}

      <form className="filters" method="get" action={`/projects/${projectId}/failures`}>
        <label className="field">
          <span className="field-label">Evaluation</span>
          <select className="select" name="run" defaultValue={run.id}>
            {runs.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
                {item.isSample ? " (sample data)" : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field-label">Version</span>
          <select className="select" name="version" defaultValue={filters.version}>
            <option value="all">Both versions</option>
            <option value={run.versionAId}>{run.versionAName}</option>
            <option value={run.versionBId}>{run.versionBName}</option>
          </select>
        </label>
        <label className="field">
          <span className="field-label">Requirement</span>
          <select className="select" name="requirement" defaultValue={filters.requirement}>
            <option value="all">All requirements</option>
            {requirements.map((requirement) => (
              <option key={requirement.id} value={requirement.id}>
                {requirement.title}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field-label">Category</span>
          <select className="select" name="category" defaultValue={filters.category}>
            <option value="all">All categories</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {categoryLabel(category)}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field-label">Verdict</span>
          <select className="select" name="verdict" defaultValue={filters.verdict}>
            {VERDICT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <button className="btn btn-primary" type="submit">
          Apply filters
        </button>
      </form>

      <p>
        {openCount} open {openCount === 1 ? "issue" : "issues"} in this evaluation. Showing {visible.length}.
      </p>

      <FailureSummary projectId={projectId} run={run} checks={checks} verdicts={verdicts} />

      {visible.length === 0 ? (
        <p className="panel">
          Nothing in this view. Open issues are checks that failed or still need a person. If the
          release panel still says a version does not meet the criteria, a requirement may be below
          its bar across scenarios.
        </p>
      ) : (
        visible.map((group) => (
          <section className="stack" key={group.requirementId} aria-labelledby={`req-${group.requirementId}`}>
            <h3 id={`req-${group.requirementId}`}>
              <PriorityPill priority={group.priority} /> {group.title}
            </h3>
            <p className="meta">{barNote(group, verdicts)}</p>
            {group.pairs.map((pair) => (
              <article className="panel stack" key={pair.key}>
                <h4>
                  {pair.scenarioTitle}
                  {pair.repetition > 1 ? ` · Repetition ${pair.repetition}` : ""}
                </h4>
                <p className="meta">{categoryLabel(pair.category)}</p>
                <p>
                  <span className="eyebrow">Scenario</span>
                  {pair.customerInput}
                </p>
                <p>
                  <span className="eyebrow">Expected behavior</span>
                  {pair.goodLooksLike || "None recorded."}
                </p>
                <ReferenceBlock materials={materials} />
                <div className="grid-2">
                  <VersionReview
                    projectId={projectId}
                    check={pair.a}
                    versionName={run.versionAName}
                    returnTo={returnTo}
                  />
                  <VersionReview
                    projectId={projectId}
                    check={pair.b}
                    versionName={run.versionBName}
                    returnTo={returnTo}
                  />
                </div>
                <p>
                  <Link href={`/projects/${projectId}/compare/${run.id}#scenario-${pair.scenarioId}`}>
                    See this scenario in the comparison
                  </Link>
                </p>
              </article>
            ))}
          </section>
        ))
      )}
    </div>
  );
}

function VersionReview({
  projectId,
  check,
  versionName,
  returnTo,
}: {
  projectId: string;
  check: GradedCheck | null;
  versionName: string;
  returnTo: string;
}) {
  if (!check) {
    return (
      <div className="stack">
        <h5>{versionName}</h5>
        <p>This requirement is not scored for this reply.</p>
      </div>
    );
  }
  return (
    <div className="stack" id={`grade-${check.gradeId}`}>
      <h5>{versionName}</h5>
      <OutcomeText check={check} />
      {check.aiEvidence ? (
        <blockquote className="quote">
          <span className="eyebrow">Quoted from the response</span>
          {check.aiEvidence}
        </blockquote>
      ) : null}
      {check.outputText ? <blockquote className="quote">{check.outputText}</blockquote> : <p>No reply was saved.</p>}
      <ReviewForm
        action={recordReview.bind(null, projectId)}
        gradeId={check.gradeId}
        returnTo={returnTo}
        decision={check.review?.decision ?? null}
        note={check.review?.note ?? ""}
        humanOnly={check.automaticOutcome === "unreviewed" && !check.aiVerdict}
      />
      {check.review ? (
        <form action={removeReview.bind(null, projectId)}>
          <input type="hidden" name="gradeId" value={check.gradeId} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <button className="btn" type="submit">
            Remove decision
          </button>
        </form>
      ) : null}
    </div>
  );
}

function ReferenceBlock({ materials }: { materials: ReferenceMaterial[] }) {
  if (materials.length === 0) {
    return (
      <p>
        <span className="eyebrow">Reference material</span>
        None was saved with this run.
      </p>
    );
  }
  return (
    <div className="stack">
      <p className="eyebrow">Reference material</p>
      {materials.map((material) => (
        <details key={material.id}>
          <summary>
            {material.title} · {referenceKindLabel(material.kind)}
          </summary>
          <pre className="reply">{material.body}</pre>
        </details>
      ))}
    </div>
  );
}

function FailureSummary({
  projectId,
  run,
  checks,
  verdicts,
}: {
  projectId: string;
  run: EvaluationRun;
  checks: GradedCheck[];
  verdicts: { versionA: VersionVerdict; versionB: VersionVerdict };
}) {
  const requirements = uniqueRequirements(checks);
  return (
    <div className="table-scroll">
      <table>
        <caption className="sr-only">Failure counts by requirement</caption>
        <thead>
          <tr>
            <th scope="col">Requirement</th>
            <th scope="col">{run.versionAName}</th>
            <th scope="col">{run.versionBName}</th>
          </tr>
        </thead>
        <tbody>
          {requirements.map((requirement) => (
            <tr key={requirement.id}>
              <th scope="row">
                <Link href={reviewHref(projectId, run.id, { requirement: requirement.id })}>{requirement.title}</Link>
              </th>
              <td>{failCount(projectId, run, checks, requirement.id, run.versionAId, verdicts.versionA)}</td>
              <td>{failCount(projectId, run, checks, requirement.id, run.versionBId, verdicts.versionB)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function failCount(
  projectId: string,
  run: EvaluationRun,
  checks: GradedCheck[],
  requirementId: string,
  versionId: string,
  verdict: VersionVerdict,
) {
  const rows = checks.filter((check) => check.requirementId === requirementId && check.versionId === versionId);
  const failed = rows.filter((check) => check.outcome === "fail").length;
  const result = verdict.requirements.find((item) => item.requirementId === requirementId);
  if (!result) return "—";
  const label = failed === 0 && result.state === "met" ? "No open failures" : `${failed} failed · ${formatScore(result.passed, result.scored)}`;
  if (failed === 0 && result.state === "met") return label;
  return <Link href={reviewHref(projectId, run.id, { requirement: requirementId, version: versionId })}>{label}</Link>;
}

function uniqueRequirements(checks: GradedCheck[]) {
  const map = new Map<string, { id: string; title: string; position: number }>();
  for (const check of checks) {
    map.set(check.requirementId, {
      id: check.requirementId,
      title: check.requirementTitle,
      position: check.requirementPosition,
    });
  }
  return [...map.values()].sort((a, b) => a.position - b.position);
}

function uniqueCategories(checks: GradedCheck[]) {
  return [...new Set(checks.map((check) => check.category))].sort();
}

type Pair = {
  key: string;
  scenarioId: string;
  scenarioTitle: string;
  scenarioPosition: number;
  category: GradedCheck["category"];
  repetition: number;
  customerInput: string;
  goodLooksLike: string;
  a: GradedCheck | null;
  b: GradedCheck | null;
};

function pairChecks(
  checks: GradedCheck[],
  run: EvaluationRun,
  filters: { version: string; requirement: string; category: string; verdict: string },
) {
  const groups = new Map<string, { requirementId: string; title: string; priority: GradedCheck["priority"]; passPercent: number; position: number; pairs: Map<string, Pair> }>();
  for (const check of checks) {
    if (!matches(check, filters)) continue;
    const group = groups.get(check.requirementId) ?? {
      requirementId: check.requirementId,
      title: check.requirementTitle,
      priority: check.priority,
      passPercent: check.passPercent,
      position: check.requirementPosition,
      pairs: new Map<string, Pair>(),
    };
    const pairKey = `${check.scenarioId}:${check.repetition}`;
    const pair = group.pairs.get(pairKey) ?? {
      key: `${check.requirementId}:${pairKey}`,
      scenarioId: check.scenarioId,
      scenarioTitle: check.scenarioTitle,
      scenarioPosition: check.scenarioPosition,
      category: check.category,
      repetition: check.repetition,
      customerInput: check.customerInput,
      goodLooksLike: check.goodLooksLike,
      a: null,
      b: null,
    };
    if (check.versionId === run.versionAId) pair.a = sibling(checks, check, run.versionAId) ?? check;
    if (check.versionId === run.versionBId) pair.b = sibling(checks, check, run.versionBId) ?? check;
    const otherId = check.versionId === run.versionAId ? run.versionBId : run.versionAId;
    const other = sibling(checks, check, otherId);
    if (other && other.versionId === run.versionAId) pair.a = other;
    if (other && other.versionId === run.versionBId) pair.b = other;
    group.pairs.set(pairKey, pair);
    groups.set(check.requirementId, group);
  }
  return [...groups.values()]
    .sort((left, right) => left.position - right.position)
    .map((group) => ({
      ...group,
      pairs: [...group.pairs.values()].sort(
        (left, right) => left.scenarioPosition - right.scenarioPosition || left.repetition - right.repetition,
      ),
    }));
}

function sibling(checks: GradedCheck[], check: GradedCheck, versionId: string): GradedCheck | null {
  return (
    checks.find(
      (item) =>
        item.requirementId === check.requirementId &&
        item.scenarioId === check.scenarioId &&
        item.repetition === check.repetition &&
        item.versionId === versionId,
    ) ?? null
  );
}

function matches(check: GradedCheck, filters: { version: string; requirement: string; category: string; verdict: string }) {
  if (filters.version !== "all" && check.versionId !== filters.version) return false;
  if (filters.requirement !== "all" && check.requirementId !== filters.requirement) return false;
  if (filters.category !== "all" && check.category !== filters.category) return false;
  return matchesVerdict(check, filters.verdict);
}

function matchesVerdict(check: GradedCheck, verdict: string) {
  if (verdict === "all") return true;
  if (verdict === "override") return check.outcome === "pass" && check.automaticOutcome === "fail" && Boolean(check.review);
  if (verdict === "decisions") return Boolean(check.review);
  if (verdict === "open") return isOpen(check);
  return check.outcome === verdict;
}

function isOpen(check: GradedCheck) {
  return check.outcome === "fail" || check.outcome === "unreviewed" || check.outcome === "needs_review";
}

function barNote(
  group: { requirementId: string; passPercent: number; priority: GradedCheck["priority"] },
  verdicts: { versionA: VersionVerdict; versionB: VersionVerdict },
) {
  const states = [verdicts.versionA, verdicts.versionB]
    .map((verdict) => verdict.requirements.find((item) => item.requirementId === group.requirementId))
    .filter((item) => item);
  const below = states.filter((item) => item && item.state === "below_bar");
  if (below.length === 0) {
    return `Bar is ${group.passPercent}% of scenarios. You can still review an individual reply when the requirement meets that bar.`;
  }
  if (group.priority === "helpful") {
    return `This requirement is below its ${group.passPercent}% bar for at least one version. Helpful requirements do not block release on their own.`;
  }
  return `This requirement is below its ${group.passPercent}% bar, so it counts against release.`;
}

function OutcomeText({ check }: { check: GradedCheck }) {
  return (
    <div className="stack">
      {check.aiVerdict ? (
        <p>
          <Pill tone={check.aiVerdict === "pass" ? "pass" : check.aiVerdict === "fail" ? "fail" : "wait"}>
            AI judgment: {check.aiVerdict === "needs_review" ? "needs review" : check.aiVerdict}
          </Pill>{" "}
          {check.aiExplanation}
        </p>
      ) : (
        <p>
          <Pill
            tone={
              check.automaticOutcome === "pass" ? "pass" : check.automaticOutcome === "fail" ? "fail" : "wait"
            }
          >
            {check.automaticOutcome === "needs_review"
              ? "Needs review"
              : check.automaticOutcome === "unreviewed"
                ? "Needs a person"
                : `Automatic ${check.automaticOutcome}`}
          </Pill>{" "}
          {check.explanation}
        </p>
      )}
      {check.deterministicOutcome ? (
        <p className="meta">
          Deterministic check: {check.deterministicOutcome}. {check.deterministicExplanation}
        </p>
      ) : null}
      {check.review ? (
        <p className="meta">
          Human review: {check.review.decision}. {check.review.note || "No note."} Saved{" "}
          {formatWhen(check.review.updatedAt)}. The AI judgment above is unchanged.
        </p>
      ) : null}
    </div>
  );
}

function reviewHref(projectId: string, runId: string, filters: { requirement?: string; version?: string }) {
  const params = new URLSearchParams({ run: runId, verdict: "open" });
  if (filters.requirement) params.set("requirement", filters.requirement);
  if (filters.version) params.set("version", filters.version);
  return `/projects/${projectId}/failures?${params.toString()}`;
}

function currentQuery(
  projectId: string,
  runId: string,
  filters: { version: string; requirement: string; category: string; verdict: string },
) {
  const params = new URLSearchParams({
    run: runId,
    version: filters.version,
    requirement: filters.requirement,
    category: filters.category,
    verdict: filters.verdict,
  });
  return `/projects/${projectId}/failures?${params.toString()}`;
}
