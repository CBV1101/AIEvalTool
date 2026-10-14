"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/submit-button";
import type { ActionState, Decision } from "@/lib/types";

export function ReviewForm({
  action,
  gradeId,
  returnTo,
  decision,
  note,
  humanOnly,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  gradeId: string;
  returnTo: string;
  decision?: Decision | null;
  note?: string;
  humanOnly: boolean;
}) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form action={formAction} className="stack">
      <input type="hidden" name="gradeId" value={gradeId} />
      <input type="hidden" name="returnTo" value={returnTo} />
      {state.error ? (
        <p role="alert" className="form-error">
          {state.error}
        </p>
      ) : null}
      <fieldset className="stack">
        <legend className="field-label">Your decision</legend>
        <label>
          <input type="radio" name="decision" value="fail" defaultChecked={decision ? decision === "fail" : !humanOnly} required />{" "}
          {humanOnly ? "This fails" : "Confirm this is a failure"}
        </label>
        <label>
          <input type="radio" name="decision" value="pass" defaultChecked={decision === "pass"} />{" "}
          {humanOnly ? "This passes" : "Treat this as passed"}
        </label>
      </fieldset>
      <label className="field">
        <span className="field-label">Note</span>
        <span className="field-hint">
          Optional. Your decision replaces the release score for this requirement. The original AI judgment stays.
        </span>
        <textarea className="textarea" name="note" defaultValue={note ?? ""} rows={3} maxLength={500} />
      </label>
      <SubmitButton pendingLabel="Saving decision…">{decision ? "Update decision" : "Save decision"}</SubmitButton>
    </form>
  );
}
