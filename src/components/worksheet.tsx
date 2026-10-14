import { submitReplies } from "@/lib/actions/runs";
import { ActionForm } from "@/components/action-form";
import { CopyButton } from "@/components/copy-button";
import { ReplyField } from "@/components/reply-field";
import { SubmitButton } from "@/components/submit-button";
import { measurementView } from "@/lib/eval/measurements";
import { providerLabel } from "@/lib/labels";
import type { EvaluationRun, ResponseRecord, Scenario } from "@/lib/types";

export function Worksheet({
  projectId,
  run,
  responses,
  scenarios,
  versions,
}: {
  projectId: string;
  run: EvaluationRun;
  responses: ResponseRecord[];
  scenarios: Scenario[];
  versions: { id: string; name: string }[];
}) {
  const grouped = scenarios
    .map((scenario) => ({
      scenario,
      replies: responses
        .filter((response) => response.scenarioId === scenario.id)
        .sort(
          (a, b) =>
            a.repetition - b.repetition ||
            (a.versionId === run.versionAId ? 0 : 1) - (b.versionId === run.versionAId ? 0 : 1),
        ),
    }))
    .filter((group) => group.replies.length > 0);

  return (
    <div className="stack-lg">
      <section className="panel stack">
        <h2>{run.mode === "demo" ? "Demo replies" : "Replies"}</h2>
        <p>
          {run.mode === "demo"
            ? "Demo mode filled these with placeholder text. It did not call a provider. You can replace a reply before grading, and the grade still will not be a model measurement."
            : "Saved replies stay with this run. You can paste a replacement, then grade. Grading uses the snapshot from when the run started."}
        </p>
      </section>

      <ActionForm action={submitReplies.bind(null, projectId, run.id)} className="stack-lg">
        {grouped.map((group) => (
          <article className="panel stack" key={group.scenario.id}>
            <h3>{group.scenario.title}</h3>
            <p>
              <span className="eyebrow">User input</span>
              {group.scenario.customerInput}
            </p>
            {group.scenario.situation ? (
              <p>
                <span className="eyebrow">Conversation context</span>
                {group.scenario.situation}
              </p>
            ) : null}
            {group.scenario.goodLooksLike ? (
              <p>
                <span className="eyebrow">Expected behavior</span>
                {group.scenario.goodLooksLike}
              </p>
            ) : null}
            <div className="grid-2">
              {group.replies.map((response) => {
                const version = versions.find((item) => item.id === response.versionId);
                const measurement = measurementView(response, run.mode);
                return (
                  <div className="stack" key={response.id}>
                    <h4>
                      {version?.name ?? "Version"}
                      {run.repetitions > 1 ? ` · Repetition ${response.repetition}` : ""}
                    </h4>
                    {response.provider ? (
                      <p className="meta">
                        {providerLabel(response.provider)}
                        {response.model ? ` · ${response.model}` : ""}
                      </p>
                    ) : null}
                    {response.errorText ? <p className="banner-bad">{response.errorText}</p> : null}
                    {measurement.note ? <p className="meta">{measurement.note}</p> : null}
                    {measurement.measured ? (
                      <p className="meta">
                        {[measurement.latency, measurement.tokens, measurement.cost].filter(Boolean).join(" · ")}
                      </p>
                    ) : measurement.note ? (
                      <p className="meta">{measurement.cost}</p>
                    ) : null}
                    {response.promptSnapshot ? (
                      <div className="prompt-block stack">
                        <div className="inline-actions">
                          <p className="eyebrow">Prompt sent</p>
                          <CopyButton text={response.promptSnapshot} />
                        </div>
                        <pre tabIndex={0}>{response.promptSnapshot}</pre>
                      </div>
                    ) : null}
                    <ReplyField
                      key={`${response.id}-${response.updatedAt}`}
                      id={`reply-${response.id}`}
                      name={`reply:${response.id}`}
                      label={`Reply for ${version?.name ?? "this version"}`}
                      defaultValue={response.outputText}
                    />
                  </div>
                );
              })}
            </div>
          </article>
        ))}
        <div className="btn-row">
          <SubmitButton name="intent" value="save" className="btn" pendingLabel="Saving replies…">
            Save replies
          </SubmitButton>
          <SubmitButton name="intent" value="grade" pendingLabel="Grading…">
            Grade replies
          </SubmitButton>
        </div>
      </ActionForm>
    </div>
  );
}
