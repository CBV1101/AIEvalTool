"use client";

import { useState } from "react";
import { useActionState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { barHint } from "@/lib/eval/release";
import { CHECK_TYPE_OPTIONS, PRIORITY_OPTIONS, checkTypeHint, priorityHint } from "@/lib/labels";
import type { ActionState, CheckType, Priority, Requirement } from "@/lib/types";

export function RequirementForm({
  action,
  initial,
  submitLabel,
  scenarioCount,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  initial?: Requirement;
  submitLabel: string;
  scenarioCount: number;
}) {
  const [state, formAction] = useActionState(action, {});
  const [priority, setPriority] = useState<Priority>(initial?.priority ?? "important");
  const [checkType, setCheckType] = useState<CheckType>(initial?.checkType ?? "human_only");
  const [passPercent, setPassPercent] = useState(String(initial?.passPercent ?? 100));
  const percent = Number(passPercent);
  const phraseValue = initial?.checkConfig.phrases.join("\n") ?? "";
  const showPhrases =
    checkType === "must_include_any" ||
    checkType === "must_include_all" ||
    checkType === "must_not_include" ||
    checkType === "required_text" ||
    checkType === "forbidden_text";

  return (
    <form action={formAction} className="stack">
      {state.error ? (
        <p role="alert" className="form-error">
          {state.error}
        </p>
      ) : null}
      <label className="field">
        <span className="field-label">Name</span>
        <span className="field-hint">The promise this feature has to keep.</span>
        <input className="input" name="title" defaultValue={initial?.title ?? ""} required maxLength={120} />
      </label>
      <label className="field">
        <span className="field-label">Description</span>
        <span className="field-hint">Plain language a teammate can read without opening the prompt.</span>
        <textarea className="textarea" name="details" defaultValue={initial?.details ?? ""} rows={3} maxLength={1000} required />
      </label>
      <label className="field">
        <span className="field-label">Pass</span>
        <span className="field-hint">What a good response does. Reviewers use this when they grade.</span>
        <textarea
          className="textarea"
          name="passGuidance"
          defaultValue={initial?.passGuidance ?? ""}
          rows={3}
          maxLength={1000}
          required
        />
      </label>
      <label className="field">
        <span className="field-label">Fail</span>
        <span className="field-hint">What a response does when it misses. Be specific enough to decide a borderline reply.</span>
        <textarea
          className="textarea"
          name="failGuidance"
          defaultValue={initial?.failGuidance ?? ""}
          rows={3}
          maxLength={1000}
          required
        />
      </label>
      <label className="choice">
        <input type="checkbox" name="critical" value="yes" defaultChecked={initial?.critical ?? false} />
        <span>
          <span className="field-label">Critical requirement</span>
          <span className="field-hint">Any failure blocks release, even when the minimum pass rate is met.</span>
        </span>
      </label>
      <div className="grid-2">
        <label className="field">
          <span className="field-label">Priority</span>
          <select
            className="select"
            name="priority"
            value={priority}
            onChange={(event) => setPriority(event.target.value as Priority)}
          >
            {PRIORITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <span className="field-hint">{priorityHint(priority)}</span>
        </label>
        <label className="field">
          <span className="field-label">Minimum pass rate</span>
          <span className="field-hint">Share of linked scenarios that must pass before this requirement meets its bar.</span>
          <input
            className="input"
            name="passPercent"
            type="number"
            min={1}
            max={100}
            value={passPercent}
            onChange={(event) => setPassPercent(event.target.value)}
            required
          />
          {Number.isInteger(percent) ? (
            <span className="field-hint">{barHint(percent, scenarioCount)}</span>
          ) : null}
        </label>
      </div>
      <label className="field">
        <span className="field-label">Optional deterministic check</span>
        <select
          className="select"
          name="checkType"
          value={checkType}
          onChange={(event) => setCheckType(event.target.value as CheckType)}
        >
          {CHECK_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <span className="field-hint">{checkTypeHint(checkType)}</span>
      </label>
      {showPhrases ? (
        <label className="field">
          <span className="field-label">Phrases</span>
          <textarea className="textarea" name="phrases" defaultValue={phraseValue} rows={4} required />
        </label>
      ) : null}
      {checkType === "word_count" ? (
        <div className="grid-2">
          <label className="field">
            <span className="field-label">Minimum words</span>
            <input
              className="input"
              name="minWords"
              type="number"
              min={0}
              max={2000}
              defaultValue={initial?.checkConfig.minWords ?? ""}
            />
          </label>
          <label className="field">
            <span className="field-label">Maximum words</span>
            <input
              className="input"
              name="maxWords"
              type="number"
              min={0}
              max={2000}
              defaultValue={initial?.checkConfig.maxWords ?? ""}
            />
          </label>
        </div>
      ) : null}
      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}
