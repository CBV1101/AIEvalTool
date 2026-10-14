import type { ReactNode } from "react";
import Link from "next/link";
import { CopyButton } from "@/components/copy-button";
import { Pill, PriorityPill } from "@/components/ui";
import { countWords, formatWhen } from "@/lib/eval/text";
import {
  changeLabel,
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
  tradeoffSummary,
  versionMetrics,
} from "@/lib/eval/comparison";
import {
  formatScore,
  verdictHeadline,
  type GradedCheck,
  type RequirementResult,
  type VersionVerdict,
} from "@/lib/eval/release";
import { measurementView } from "@/lib/eval/measurements";
import { checksFromBundle, scenarioSummaries, type RunBundle, type ScenarioCell } from "@/lib/eval/report";
import { categoryLabel, providerLabel, sourceLabel } from "@/lib/labels";
import type { EvaluationRun, Scenario } from "@/lib/types";

export function RunResults({
  projectId,
  bundle,
  verdicts,
  setupChanged,
  scenarios: scenarioCatalog = [],
}: {
  projectId: string;
  bundle: RunBundle;
  verdicts: { versionA: VersionVerdict; versionB: VersionVerdict };
  setupChanged: boolean;
  scenarios?: Pick<Scenario, "id" | "category">[];
}) {
  const checks = checksFromBundle(bundle, scenarioCatalog);
  const scenarios = scenarioSummaries(bundle, checks);
  const sample = bundle.run.isSample;
  const demo = bundle.run.mode === "demo";
  const metricsA = versionMetrics(
    bundle.run.versionAId,
    bundle.run.versionAName,
    checks,
    bundle.responses,
    bundle.run.mode,
  );
  const metricsB = versionMetrics(
    bundle.run.versionBId,
    bundle.run.versionBName,
    checks,
    bundle.responses,
    bundle.run.mode,
  );
  const shownA = presentedVerdict(verdicts.versionA, metricsA.executionErrors);
  const shownB = presentedVerdict(verdicts.versionB, metricsB.executionErrors);
  const changes = requirementChanges(shownA, shownB);
  const tradeoff = tradeoffSummary(changes, bundle.run.versionAName, bundle.run.versionBName);
  const inconsistencies =
    bundle.run.repetitions > 1
      ? inconsistentVerdicts(
          checks,
          new Map([
            [bundle.run.versionAId, bundle.run.versionAName],
            [bundle.run.versionBId, bundle.run.versionBName],
          ]),
        )
      : [];

  return (
    <div className="stack-lg">
      {sample ? (
        <SampleWalkthrough
          versionA={shownA}
          versionB={shownB}
          versionAName={bundle.run.versionAName}
          versionBName={bundle.run.versionBName}
        />
      ) : demo ? (
        <p className="banner banner-sample">
          <strong>Demo mode.</strong> These replies were not produced by a model. Latency, token
          use, cost, and this verdict are not measurements.
        </p>
      ) : (
        <p className="banner banner-ok">
          This is your evaluation. It is stored separately from any sample results.
        </p>
      )}
      {setupChanged && !sample ? (
        <p className="banner banner-warn">
          Test setup changed after this run. The replies and checks below stay on the snapshot from
          when the run started.
        </p>
      ) : null}

      {bundle.run.graderModel ? (
        <p className="meta">
          AI grader: {providerLabel(bundle.run.graderProvider)} · {bundle.run.graderModel}. These are
          model judgments, not a calibrated probability.
        </p>
      ) : null}

      <p className="banner banner-warn">{TEST_SET_NOTE}</p>

      <div className="grid-2">
        <VerdictCard
          projectId={projectId}
          runId={bundle.run.id}
          verdict={shownA}
          sample={sample}
          demo={demo}
        />
        <VerdictCard
          projectId={projectId}
          runId={bundle.run.id}
          verdict={shownB}
          sample={sample}
          demo={demo}
        />
      </div>

      <section className="stack" aria-labelledby="metrics-heading">
        <h2 id="metrics-heading">Side by side</h2>
        <p className="lede">
          Each number is for that version on this run. A gain on one requirement can sit next to a
          loss on another.
        </p>
        <div className="btn-row">
          <a className="btn" href={`/projects/${projectId}/compare/${bundle.run.id}/export/results`}>
            Download detailed results (CSV)
          </a>
          <a className="btn" href={`/projects/${projectId}/compare/${bundle.run.id}/export/report`}>
            Download decision report (Markdown)
          </a>
        </div>
        <p className="scroll-hint">On a small screen, scroll sideways to see both versions.</p>
        <div className="table-scroll">
          <table>
            <caption className="sr-only">Measurements for both versions</caption>
            <thead>
              <tr>
                <th scope="col">Measure</th>
                <th scope="col">{bundle.run.versionAName}</th>
                <th scope="col">{bundle.run.versionBName}</th>
              </tr>
            </thead>
            <tbody>
              <MetricRow label="Passed checks / eligible checks" a={demo ? "Not a measurement" : passRateLabel(metricsA)} b={demo ? "Not a measurement" : passRateLabel(metricsB)} />
              <MetricRow
                label="Critical failures"
                a={demo ? "Not a measurement" : countLink(projectId, bundle.run.id, bundle.run.versionAId, metricsA.criticalFailures, "critical")}
                b={demo ? "Not a measurement" : countLink(projectId, bundle.run.id, bundle.run.versionBId, metricsB.criticalFailures, "critical")}
              />
              <MetricRow
                label="Unresolved reviews"
                a={demo ? "Not a measurement" : countLink(projectId, bundle.run.id, bundle.run.versionAId, metricsA.unresolvedReviews, "open")}
                b={demo ? "Not a measurement" : countLink(projectId, bundle.run.id, bundle.run.versionBId, metricsB.unresolvedReviews, "open")}
              />
              <MetricRow label="Execution errors" a={demo ? "Not a measurement" : String(metricsA.executionErrors)} b={demo ? "Not a measurement" : String(metricsB.executionErrors)} />
              <MetricRow label="Response latency" a={latencyLabel(metricsA)} b={latencyLabel(metricsB)} />
              <MetricRow label="Token usage" a={tokenLabel(metricsA)} b={tokenLabel(metricsB)} />
              <MetricRow label="Estimated cost" a={costLabelForVersion(metricsA)} b={costLabelForVersion(metricsB)} />
              <MetricRow label="Human review" a={humanReviewLabel(metricsA)} b={humanReviewLabel(metricsB)} />
            </tbody>
          </table>
        </div>
      </section>

      <section className="stack" aria-labelledby="criteria-heading">
        <h2 id="criteria-heading">Release criteria</h2>
        <p className="lede">
          The release bar for this run is {bundle.run.minPassRate}% of scored checks. A scored
          check is an automatic result, or a human decision. Helpful requirements do not veto
          release on their own.
        </p>
        <p className="scroll-hint">On a small screen, scroll sideways to see both versions.</p>
        <div className="table-scroll">
          <table>
            <caption className="sr-only">Release criteria for both versions</caption>
            <thead>
              <tr>
                <th scope="col">Check</th>
                <th scope="col">{bundle.run.versionAName}</th>
                <th scope="col">{bundle.run.versionBName}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Overall pass rate · {bundle.run.minPassRate}% bar</th>
                <td>{demo ? "Not a measurement" : overallCell(shownA, bundle.run.minPassRate)}</td>
                <td>{demo ? "Not a measurement" : overallCell(shownB, bundle.run.minPassRate)}</td>
              </tr>
              {shownA.requirements.map((requirement) => {
                const other = shownB.requirements.find(
                  (item) => item.requirementId === requirement.requirementId,
                );
                return (
                  <tr key={requirement.requirementId}>
                    <th scope="row">
                      <span className="inline-actions">
                        <PriorityPill priority={requirement.priority} />
                        {requirement.state === "met" && (!other || other.state === "met") ? (
                          requirement.title
                        ) : (
                          <Link href={failureHref(projectId, bundle.run.id, { requirement: requirement.requirementId })}>
                            {requirement.title}
                          </Link>
                        )}
                      </span>
                      <p className="meta">{requirement.passPercent}% of scenarios</p>
                    </th>
                    <td>{demo ? "Not a measurement" : requirementLink(projectId, bundle.run.id, bundle.run.versionAId, requirement)}</td>
                    <td>{demo ? "Not a measurement" : other ? requirementLink(projectId, bundle.run.id, bundle.run.versionBId, other) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="stack" aria-labelledby="changes-heading">
        <h2 id="changes-heading">Requirement changes</h2>
        <p className="lede">
          Pass rates stay on the requirement they belong to. {tradeoff ?? "Read each row on its own rather than combining them into one score."}
        </p>
        <div className="table-scroll">
          <table>
            <caption className="sr-only">How each requirement changed between versions</caption>
            <thead>
              <tr>
                <th scope="col">Requirement</th>
                <th scope="col">{bundle.run.versionAName}</th>
                <th scope="col">{bundle.run.versionBName}</th>
                <th scope="col">Change</th>
              </tr>
            </thead>
            <tbody>
              {changes.map((change) => (
                <tr key={change.requirementId}>
                  <th scope="row">
                    <Link href={failureHref(projectId, bundle.run.id, { requirement: change.requirementId, verdict: "all" })}>
                      {change.title}
                    </Link>
                  </th>
                  <td>{demo ? "Not a measurement" : requirementRateLabel(change.a)}</td>
                  <td>{demo ? "Not a measurement" : requirementRateLabel(change.b)}</td>
                  <td>{demo ? "Not a measurement" : changeLabel(change, bundle.run.versionAName, bundle.run.versionBName)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {bundle.run.repetitions > 1 ? (
        <section className="stack" aria-labelledby="repetition-heading">
          <h2 id="repetition-heading">Inconsistent repetitions</h2>
          <p className="lede">
            This run sent each scenario {bundle.run.repetitions} times. A scenario is listed when the
            same requirement received different verdicts.
          </p>
          {inconsistencies.length === 0 ? (
            <p className="panel">Every repeated scenario kept the same verdict on each requirement.</p>
          ) : (
            <ul className="plain-list">
              {inconsistencies.map((item) => (
                <li key={`${item.scenarioId}-${item.versionId}-${item.requirementId}`}>
                  <Link href={failureHref(projectId, bundle.run.id, { requirement: item.requirementId, version: item.versionId, verdict: "all" })}>
                    {item.scenarioTitle}
                  </Link>
                  {" · "}
                  {item.versionName}
                  {" · "}
                  {item.requirementTitle}
                  {". "}
                  {item.outcomes.map((outcome) => `Repetition ${outcome.repetition} ${outcomeLabel(outcome.outcome)}`).join(". ")}
                  .
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      <section className="stack" aria-labelledby="matrix-heading">
        <h2 id="matrix-heading">Results by scenario</h2>
        <p className="lede">
          A failure is one requirement a reply missed. Open failure review to confirm or overrule a
          check.
        </p>
        <p className="scroll-hint">On a small screen, scroll sideways to see both versions.</p>
        <div className="table-scroll">
          <table>
            <caption className="sr-only">Pass and fail counts by scenario</caption>
            <thead>
              <tr>
                <th scope="col">Scenario</th>
                <th scope="col">{bundle.run.versionAName}</th>
                <th scope="col">{bundle.run.versionBName}</th>
              </tr>
            </thead>
            <tbody>
              {scenarios.flatMap((scenario) =>
                repetitionGroups(scenario.cells).map((group) => (
                  <tr key={`${scenario.scenarioId}-${group.repetition}`}>
                    <th scope="row">
                      <a href={`#scenario-${scenario.scenarioId}`}>{scenario.title}</a>
                      <p className="meta">{categoryLabel(scenarioCatalog.find((item) => item.id === scenario.scenarioId)?.category ?? "normal")}</p>
                      {scenario.cells.some((cell) => cell.repetition > 1) ? (
                        <p className="meta">Repetition {group.repetition}</p>
                      ) : null}
                    </th>
                    {group.cells.map((cell) => (
                      <td key={cell.responseId}>
                        {demo
                          ? "Not a measurement"
                          : cell.failed === 0 && cell.unreviewed === 0
                            ? `${cell.passed} passed`
                            : `${cell.passed} passed, ${cell.failed} failed${cell.unreviewed ? `, ${cell.unreviewed} waiting` : ""}`}
                        {!demo && cell.failedTitles.length > 0 ? (
                          <p className="meta">Missed: {cell.failedTitles.join(", ")}</p>
                        ) : null}
                      </td>
                    ))}
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
        <p>
          <Link href={`/projects/${projectId}/failures?run=${bundle.run.id}`}>Review failures</Link>
        </p>
      </section>

      <section className="stack" aria-labelledby="replies-heading">
        <h2 id="replies-heading">Replies</h2>
        {scenarios.map((scenario) => (
          <article className="panel stack" id={`scenario-${scenario.scenarioId}`} key={scenario.scenarioId}>
            <h3>{scenario.title}</h3>
            <p>
              <span className="eyebrow">Customer says</span>
              {scenario.customerInput}
            </p>
            {scenario.goodLooksLike ? (
              <p>
                <span className="eyebrow">What good looks like</span>
                {scenario.goodLooksLike}
              </p>
            ) : null}
            {repetitionGroups(scenario.cells).map((group) => (
              <div className="stack" key={group.repetition}>
                {scenario.cells.some((cell) => cell.repetition > 1) ? (
                  <p className="eyebrow">Repetition {group.repetition}</p>
                ) : null}
                <div className="grid-2">
                  {group.cells.map((cell) => (
                    <ReplyCell key={cell.responseId} cell={cell} mode={bundle.run.mode} />
                  ))}
                </div>
              </div>
            ))}
          </article>
        ))}
      </section>
    </div>
  );
}

function SampleWalkthrough({
  versionA,
  versionB,
  versionAName,
  versionBName,
}: {
  versionA: VersionVerdict;
  versionB: VersionVerdict;
  versionAName: string;
  versionBName: string;
}) {
  const policy = "Does not invent a refund";
  const acknowledgement = "Acknowledges the customer's situation";
  const policyA = versionA.requirements.find((requirement) => requirement.title === policy);
  const policyB = versionB.requirements.find((requirement) => requirement.title === policy);
  const helpA = versionA.requirements.find((requirement) => requirement.title === acknowledgement);
  const helpB = versionB.requirements.find((requirement) => requirement.title === acknowledgement);
  const policyFailures = (requirement: { passed: number; scored: number } | undefined) =>
    requirement ? requirement.scored - requirement.passed : 0;
  const helpfulTradeoff =
    Boolean(helpA && helpB && policyA && policyB) &&
    (helpB?.passed ?? 0) > (helpA?.passed ?? 0) &&
    policyFailures(policyB) > policyFailures(policyA);
  return (
    <section className="banner banner-sample stack" aria-labelledby="walkthrough-heading">
      <p>
        <strong>Sample data.</strong> These replies were written for the walkthrough. They are not
        from a live model, and this is not a release decision for a real feature.
      </p>
      <h2 id="walkthrough-heading">What this sample is showing</h2>
      {helpfulTradeoff && helpA && helpB && policyA && policyB ? (
        <p>
          {versionBName} is more helpful: it acknowledges the customer on {helpB.passed} of {helpB.scored}{" "}
          checks, compared with {helpA.passed} of {helpA.scored} for {versionAName}. It also violates the
          refund policy more often: {policyFailures(policyB)} policy{" "}
          {policyFailures(policyB) === 1 ? "failure" : "failures"}, compared with {policyFailures(policyA)}{" "}
          for {versionAName}. {versionAName} is stricter about refunds and less helpful. Read each
          requirement row. Neither overall score is the whole decision.
        </p>
      ) : (
        <p>
          Compare acknowledgement and refund-policy rows for {versionAName} and {versionBName}. Read each
          requirement row. Neither overall score is the whole decision.
        </p>
      )}
    </section>
  );
}

function repetitionGroups(cells: ScenarioCell[]): { repetition: number; cells: ScenarioCell[] }[] {
  const groups = new Map<number, ScenarioCell[]>();
  for (const cell of cells) {
    const list = groups.get(cell.repetition) ?? [];
    list.push(cell);
    groups.set(cell.repetition, list);
  }
  return [...groups.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([repetition, group]) => ({ repetition, cells: group }));
}

function ReplyCell({ cell, mode }: { cell: ScenarioCell; mode: RunBundle["run"]["mode"] }) {
  const measurement = measurementView(cell, mode);
  const tone = cell.source === "sample" || cell.source === "demo" ? "sample" : undefined;
  return (
    <div className="stack">
      <h4>
        {cell.versionName}{" "}
        <Pill tone={tone}>{sourceLabel(cell.source)}</Pill>
      </h4>
      {cell.provider ? (
        <p className="meta">
          {providerLabel(cell.provider)}
          {cell.model ? ` · ${cell.model}` : ""}
        </p>
      ) : null}
      {cell.errorText ? <p className="banner-bad">{cell.errorText}</p> : null}
      {cell.outputText ? <blockquote className="quote">{cell.outputText}</blockquote> : <p>No reply was saved.</p>}
      <p className="meta">{cell.outputText ? `${countWords(cell.outputText)} words` : "No reply"}</p>
      {measurement.note ? <p className="meta">{measurement.note}</p> : null}
      {measurement.measured ? (
        <p className="meta">
          {[measurement.latency, measurement.tokens, measurement.cost].filter(Boolean).join(" · ")}
        </p>
      ) : measurement.note ? (
        <p className="meta">{measurement.cost}</p>
      ) : null}
      <ul className="plain-list">
        {cell.checks.map((check) => (
          <li key={check.gradeId}>
            <CheckReport check={check} />
          </li>
        ))}
      </ul>
      {cell.promptSnapshot ? (
        <details>
          <summary>Prompt used for this reply</summary>
          <div className="prompt-block stack">
            <CopyButton text={cell.promptSnapshot} />
            <pre>{cell.promptSnapshot}</pre>
          </div>
        </details>
      ) : null}
    </div>
  );
}

function MetricRow({ label, a, b }: { label: string; a: ReactNode; b: ReactNode }) {
  return (
    <tr>
      <th scope="row">{label}</th>
      <td>{a}</td>
      <td>{b}</td>
    </tr>
  );
}

function countLink(projectId: string, runId: string, versionId: string, count: number, kind: "critical" | "open") {
  if (count === 0) return "0";
  return (
    <Link href={failureHref(projectId, runId, { version: versionId, verdict: kind === "critical" ? "fail" : "open" })}>
      {count}
    </Link>
  );
}

function requirementLink(projectId: string, runId: string, versionId: string, requirement: RequirementResult) {
  const label = requirementCell(requirement);
  if (requirement.state === "met") return label;
  return <Link href={failureHref(projectId, runId, { requirement: requirement.requirementId, version: versionId })}>{label}</Link>;
}

function failureHref(
  projectId: string,
  runId: string,
  filters: { requirement?: string; version?: string; verdict?: string },
) {
  const params = new URLSearchParams({
    run: runId,
    verdict: filters.verdict ?? "open",
  });
  if (filters.requirement) params.set("requirement", filters.requirement);
  if (filters.version) params.set("version", filters.version);
  return `/projects/${projectId}/failures?${params.toString()}`;
}

function outcomeLabel(outcome: string): string {
  if (outcome === "pass") return "passed";
  if (outcome === "fail") return "failed";
  if (outcome === "needs_review") return "needs review";
  return "needs a person";
}

function VerdictCard({
  projectId,
  runId,
  verdict,
  sample,
  demo,
}: {
  projectId: string;
  runId: string;
  verdict: VersionVerdict;
  sample: boolean;
  demo: boolean;
}) {
  const tone = demo || verdict.incomplete ? "verdict-wait" : verdict.ready ? "verdict-ready" : "verdict-blocked";
  return (
    <article className={`panel verdict ${tone}`}>
      <p className="eyebrow">{demo ? "Demo mode" : sample ? "Sample result" : "Release result"}</p>
      <h2>{verdict.versionName}</h2>
      <p className="display" style={{ fontSize: "1.7rem" }}>
        {verdictHeadline(verdict, sample, demo)}
      </p>
      <p>
        {demo
          ? "Placeholder replies only. This pass rate is not a measurement."
          : verdict.scored === 0
            ? "No scored checks yet."
            : `Pass rate ${formatScore(verdict.passed, verdict.scored)}.`}
      </p>
      <p className="meta">
        Human review covers {verdict.humanReviewed} of {verdict.checkCount} checks. The release score
        uses a human verdict when one is saved, and the AI judgment otherwise.
      </p>
      {verdict.reasons.length > 0 ? (
        <div className="stack">
          <p className="eyebrow">What drives this status</p>
          <ul className="plain-list">
            {verdict.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
          <p>
            <Link href={failureHref(projectId, runId, { version: verdict.versionId })}>Review these failures</Link>
          </p>
        </div>
      ) : (
        <p>Every blocker, important, and critical requirement meets its bar, and the overall pass rate meets the configured bar.</p>
      )}
      {verdict.watch.length > 0 ? (
        <div className="stack">
          <p className="eyebrow">Worth a look</p>
          <ul className="plain-list">
            {verdict.watch.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </article>
  );
}

function overallCell(verdict: VersionVerdict, minPassRate: number): string {
  if (verdict.passRate === null) return "Not scored";
  const met = verdict.passRate >= minPassRate / 100;
  return `${formatScore(verdict.passed, verdict.scored)} · ${met ? "Met" : "Below the bar"}`;
}

function requirementCell(requirement: RequirementResult): string {
  const score = requirementRateLabel(requirement);
  if (requirement.state === "needs_review") {
    return requirement.blocksRelease ? `Needs review · blocks release · ${score}` : `Not reviewed · does not block · ${score}`;
  }
  if (requirement.state === "met") return `Met · ${score}`;
  if (requirement.blocksRelease) return `Blocks release · ${score}`;
  return `Below its bar · ${score} · does not block`;
}

function CheckReport({ check }: { check: GradedCheck }) {
  return (
    <div className="stack">
      {check.aiVerdict ? (
        <p>
          <Pill tone={outcomeTone(check.aiVerdict)}>AI judgment: {verdictLabel(check.aiVerdict)}</Pill>{" "}
          {check.requirementTitle}. {check.aiExplanation}
        </p>
      ) : (
        <p>
          <OutcomePill outcome={check.outcome} /> {check.requirementTitle}. {check.explanation}
        </p>
      )}
      {check.aiEvidence ? (
        <blockquote className="quote">
          <span className="eyebrow">Quoted from the response</span>
          {check.aiEvidence}
        </blockquote>
      ) : null}
      {check.deterministicOutcome ? (
        <p className="meta">
          Deterministic check: {verdictLabel(check.deterministicOutcome)}. {check.deterministicExplanation}
        </p>
      ) : null}
      {check.review ? (
        <p className="meta">
          Human review: {verdictLabel(check.review.decision)}. {check.review.note || "No note."} Saved{" "}
          {formatWhen(check.review.updatedAt)}.
        </p>
      ) : null}
    </div>
  );
}

function verdictLabel(outcome: string): string {
  if (outcome === "pass") return "pass";
  if (outcome === "fail") return "fail";
  if (outcome === "needs_review") return "needs review";
  return "not scored";
}

function outcomeTone(outcome: string): "pass" | "fail" | "wait" {
  if (outcome === "pass") return "pass";
  if (outcome === "fail") return "fail";
  return "wait";
}

function OutcomePill({ outcome }: { outcome: "pass" | "fail" | "unreviewed" | "needs_review" }) {
  if (outcome === "pass") return <Pill tone="pass">Pass</Pill>;
  if (outcome === "fail") return <Pill tone="fail">Fail</Pill>;
  if (outcome === "needs_review") return <Pill tone="wait">Needs review</Pill>;
  return <Pill tone="wait">Needs a person</Pill>;
}

function runStatusLabel(status: EvaluationRun["status"]): string {
  switch (status) {
    case "graded":
      return "Graded";
    case "running":
      return "Running";
    case "ready":
      return "Replies saved";
    case "cancelled":
      return "Cancelled";
    case "draft":
      return "Not graded yet";
  }
}

export function RunMeta({ run }: { run: EvaluationRun }) {
  return (
    <p className="meta inline-actions">
      {run.isSample ? <Pill tone="sample">Sample data</Pill> : null}
      {run.mode === "demo" ? <Pill tone="sample">Demo mode</Pill> : null}
      <span>{sourceLabel(run.responseSource)}</span>
      <span>{runStatusLabel(run.status)}</span>
    </p>
  );
}
