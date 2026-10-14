"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { reviewScenarioCsv, type ImportState } from "@/lib/actions/setup";

const initial: ImportState = { rows: [], csv: "", reviewed: false };

export function ScenarioImport({ projectId }: { projectId: string }) {
  const [state, action] = useActionState(reviewScenarioCsv.bind(null, projectId), initial);
  const validCount = state.rows.filter((row) => row.errors.length === 0).length;
  const invalidCount = state.rows.length - validCount;

  return (
    <form action={action} className="stack">
      <p className="lede">
        Add scenarios one by one, or import a CSV. Download the template, fill it in, then preview the rows before anything is saved.
      </p>
      <p>
        <a className="btn" href={`/projects/${projectId}/scenarios/template`}>
          Download CSV template
        </a>
      </p>
      {state.error ? (
        <p role="alert" className="form-error">
          {state.error}
        </p>
      ) : null}
      {state.imported ? (
        <p role="status" className="banner">
          Imported {state.imported} {state.imported === 1 ? "scenario" : "scenarios"}.
          {invalidCount > 0
            ? ` ${invalidCount} ${invalidCount === 1 ? "row still needs" : "rows still need"} a fix and ${invalidCount === 1 ? "was" : "were"} not added.`
            : ""}
        </p>
      ) : null}
      <label className="field">
        <span className="field-label">CSV file</span>
        <input className="input" name="file" type="file" accept=".csv,text/csv" />
      </label>
      <label className="field">
        <span className="field-label">Or paste CSV</span>
        <span className="field-hint">Pasted text is used when this box is not empty. Invalid rows stay listed below.</span>
        <textarea className="textarea" name="csv" rows={6} defaultValue={state.csv} key={state.csv} />
      </label>
      <div className="inline-actions">
        <SubmitButton name="intent" value="preview" pendingLabel="Checking…">
          Preview import
        </SubmitButton>
        {validCount > 0 ? (
          <SubmitButton name="intent" value="import" pendingLabel="Importing…">
            Import {validCount} valid {validCount === 1 ? "scenario" : "scenarios"}
          </SubmitButton>
        ) : null}
      </div>
      {state.reviewed && state.rows.length > 0 ? (
        <div className="table-scroll">
          <table>
            <caption>
              {state.rows.length} {state.rows.length === 1 ? "row" : "rows"} in this file.
              {invalidCount > 0
                ? ` ${invalidCount} ${invalidCount === 1 ? "needs" : "need"} a fix and will not be imported.`
                : " Every row is valid."}
            </caption>
            <thead>
              <tr>
                <th scope="col">Row</th>
                <th scope="col">Name</th>
                <th scope="col">User input</th>
                <th scope="col">Result</th>
              </tr>
            </thead>
            <tbody>
              {state.rows.map((row) => (
                <tr key={`${row.line}-${row.name}`} className={row.errors.length > 0 ? "row-invalid" : undefined}>
                  <td>{row.line}</td>
                  <th scope="row">{row.name}</th>
                  <td>{row.userInput || "—"}</td>
                  <td>
                    {row.errors.length === 0 ? (
                      "Ready to import"
                    ) : (
                      <ul className="error-list">
                        {row.errors.map((error) => (
                          <li key={error}>{error}</li>
                        ))}
                      </ul>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </form>
  );
}
