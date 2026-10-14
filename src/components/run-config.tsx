"use client";

import { useState } from "react";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { providerLabel } from "@/lib/labels";
import type { ActionState, ProviderId, ScenarioSet } from "@/lib/types";

type VersionChoice = {
  id: string;
  name: string;
  provider: ProviderId;
  model: string;
};

export function RunConfigForm({
  action,
  versions,
  keys,
  counts,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  versions: VersionChoice[];
  keys: Record<ProviderId, boolean>;
  counts: Record<ScenarioSet, number>;
}) {
  const [versionA, setVersionA] = useState(versions[0]?.id ?? "");
  const [versionB, setVersionB] = useState(versions[1]?.id ?? versions[0]?.id ?? "");
  const [dataset, setDataset] = useState<ScenarioSet>("development");
  const selected = [versionA, versionB]
    .map((id) => versions.find((version) => version.id === id))
    .filter((version): version is VersionChoice => Boolean(version));
  const missingKey = selected.some((version) => !keys[version.provider]);
  const missingModel = selected.some((version) => version.model.trim().length === 0);
  const liveReady = !missingKey && !missingModel && counts[dataset] > 0;

  return (
    <ActionForm action={action}>
      <label className="field">
        <span className="field-label">Name</span>
        <span className="field-hint">Optional. A name is created from the two versions if you leave this blank.</span>
        <input className="input" name="name" maxLength={80} />
      </label>
      <div className="grid-2">
        <VersionSelect label="Version A" hint="Shown in the left column." name="versionAId" versions={versions} value={versionA} onChange={setVersionA} />
        <VersionSelect label="Version B" hint="Shown in the right column." name="versionBId" versions={versions} value={versionB} onChange={setVersionB} />
      </div>
      <div className="grid-2">
        <label className="field">
          <span className="field-label">Scenario set</span>
          <span className="field-hint">Development is for tuning. Holdout stays unseen until you want an honest check.</span>
          <select
            className="select"
            name="dataset"
            value={dataset}
            onChange={(event) => setDataset(event.target.value as ScenarioSet)}
          >
            <option value="development">Development set ({counts.development})</option>
            <option value="holdout">Holdout set ({counts.holdout})</option>
          </select>
        </label>
        <label className="field">
          <span className="field-label">Repetitions</span>
          <span className="field-hint">Each selected scenario is sent this many times to both versions.</span>
          <select className="select" name="repetitions" defaultValue="1">
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
          </select>
        </label>
      </div>
      <p className="meta">
        OpenAI key: {keys.openai ? "configured" : "not set"}. Anthropic key:{" "}
        {keys.anthropic ? "configured" : "not set"}. Keys stay on the server.
      </p>
      {counts[dataset] === 0 ? (
        <p className="banner-warn">This set has no scenarios yet.</p>
      ) : (
        <p className="meta">
          {counts[dataset]} {dataset === "holdout" ? "holdout" : "development"}{" "}
          {counts[dataset] === 1 ? "scenario" : "scenarios"} will be sent to both versions, with the
          same user input, conversation context, and reference material.
        </p>
      )}
      {missingModel ? (
        <p className="banner-warn">Enter a model identifier on each version before a live run.</p>
      ) : null}
      {missingKey ? (
        <p className="banner-warn">
          A selected provider has no API key, so a live run is unavailable. Demo mode writes
          placeholder replies and never records them as measurements.
        </p>
      ) : null}
      <div className="btn-row">
        {liveReady ? (
          <SubmitButton name="mode" value="live" pendingLabel="Starting…">
            Run evaluation
          </SubmitButton>
        ) : null}
        <SubmitButton name="mode" value="demo" className="btn" pendingLabel="Starting demo…">
          Run demo mode
        </SubmitButton>
        <SubmitButton name="mode" value="paste" className="btn" pendingLabel="Preparing…">
          Prepare a worksheet to paste replies
        </SubmitButton>
      </div>
    </ActionForm>
  );
}

function VersionSelect({
  label,
  hint,
  name,
  versions,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  name: string;
  versions: VersionChoice[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <span className="field-hint">{hint}</span>
      <select className="select" name={name} value={value} onChange={(event) => onChange(event.target.value)}>
        {versions.map((version) => (
          <option key={version.id} value={version.id}>
            {version.name} · {providerLabel(version.provider)} · {version.model || "model identifier not set"}
          </option>
        ))}
      </select>
    </label>
  );
}
