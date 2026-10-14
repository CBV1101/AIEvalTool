import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { DEFAULT_MESSAGE_TEMPLATE } from "@/lib/eval/prompts";
import { PROVIDER_OPTIONS } from "@/lib/labels";
import {
  CATEGORY_OPTIONS,
  DATASET_OPTIONS,
  REFERENCE_KIND_OPTIONS,
} from "@/lib/labels";
import type { ActionState, Project, PromptVersion, ReferenceMaterial, Requirement, Scenario } from "@/lib/types";

export function ProjectForm({
  action,
  project,
  submitLabel,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  project?: Project;
  submitLabel: string;
}) {
  return (
    <ActionForm action={action}>
      <label className="field">
        <span className="field-label">Project name</span>
        <input className="input" name="name" defaultValue={project?.name ?? ""} required maxLength={80} />
      </label>
      <label className="field">
        <span className="field-label">What the feature does</span>
        <span className="field-hint">Describe the text the model writes, in product language.</span>
        <textarea
          className="textarea"
          name="featureSummary"
          defaultValue={project?.featureSummary ?? ""}
          required
          maxLength={280}
          rows={3}
        />
      </label>
      <label className="field">
        <span className="field-label">Decision this evaluation supports</span>
        <textarea
          className="textarea"
          name="decisionNote"
          defaultValue={project?.decisionNote ?? ""}
          maxLength={400}
          rows={3}
        />
      </label>
      <label className="field">
        <span className="field-label">Release bar</span>
        <span className="field-hint">
          A version is ready when at least this share of scored checks pass, and every blocker and
          important requirement meets its own bar.
        </span>
        <input
          className="input"
          name="minPassRate"
          type="number"
          min={1}
          max={100}
          defaultValue={project?.minPassRate ?? 85}
          required
        />
      </label>
      <div className="grid-2">
        <label className="field">
          <span className="field-label">Grader provider</span>
          <span className="field-hint">A separate model judges each saved reply against each requirement.</span>
          <select className="select" name="graderProvider" defaultValue={project?.graderProvider ?? "openai"}>
            {PROVIDER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field-label">Grader model identifier</span>
          <span className="field-hint">Type the identifier your provider expects. Leave this blank until you want AI judgments.</span>
          <input
            className="input"
            name="graderModel"
            defaultValue={project?.graderModel ?? ""}
            maxLength={120}
            placeholder="Model identifier"
          />
        </label>
      </div>
      <SubmitButton>{submitLabel}</SubmitButton>
    </ActionForm>
  );
}

export function ScenarioForm({
  action,
  scenario,
  requirements,
  submitLabel,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  scenario?: Scenario;
  requirements: Requirement[];
  submitLabel: string;
}) {
  const selected = new Set(
    !scenario || scenario.appliesToAll ? requirements.map((requirement) => requirement.id) : scenario.requirementIds,
  );
  return (
    <ActionForm action={action}>
      <label className="field">
        <span className="field-label">Scenario name</span>
        <input className="input" name="title" defaultValue={scenario?.title ?? ""} required maxLength={80} />
      </label>
      <label className="field">
        <span className="field-label">User input</span>
        <span className="field-hint">The message the customer sends.</span>
        <textarea
          className="textarea"
          name="customerInput"
          defaultValue={scenario?.customerInput ?? ""}
          required
          rows={4}
          maxLength={2000}
        />
      </label>
      <label className="field">
        <span className="field-label">Conversation context</span>
        <span className="field-hint">Optional facts the model can use, such as plan or account state. Not the customer’s words.</span>
        <textarea className="textarea" name="situation" defaultValue={scenario?.situation ?? ""} rows={3} maxLength={2000} />
      </label>
      <label className="field">
        <span className="field-label">Expected behavior</span>
        <span className="field-hint">What a reviewer should see. Automatic checks do not read this note.</span>
        <textarea
          className="textarea"
          name="goodLooksLike"
          defaultValue={scenario?.goodLooksLike ?? ""}
          required
          rows={3}
          maxLength={2000}
        />
      </label>
      <label className="field">
        <span className="field-label">Reference answer</span>
        <span className="field-hint">Optional example of a strong reply. Grading does not require an exact match.</span>
        <textarea
          className="textarea"
          name="referenceAnswer"
          defaultValue={scenario?.referenceAnswer ?? ""}
          rows={4}
          maxLength={4000}
        />
      </label>
      <div className="grid-2">
        <label className="field">
          <span className="field-label">Category</span>
          <select className="select" name="category" defaultValue={scenario?.category ?? "normal"}>
            {CATEGORY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field-label">Set</span>
          <span className="field-hint">Development is for tuning. Holdout stays unseen until you check for overfitting.</span>
          <select className="select" name="dataset" defaultValue={scenario?.dataset ?? "development"}>
            {DATASET_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <fieldset className="stack">
        <legend className="field-label">Requirements this scenario tests</legend>
        <p className="field-hint">
          All requirements are selected by default, including ones you add later. Uncheck a requirement to keep it off this scenario.
        </p>
        {requirements.length === 0 ? (
          <p>Add a requirement first. This scenario will apply to requirements you add later.</p>
        ) : (
          requirements.map((requirement) => (
            <label className="choice" key={requirement.id}>
              <input
                type="checkbox"
                name="requirementIds"
                value={requirement.id}
                defaultChecked={selected.has(requirement.id)}
              />
              <span>{requirement.title}</span>
            </label>
          ))
        )}
      </fieldset>
      <SubmitButton>{submitLabel}</SubmitButton>
    </ActionForm>
  );
}

export function ReferenceForm({
  action,
  material,
  submitLabel,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  material?: ReferenceMaterial;
  submitLabel: string;
}) {
  return (
    <ActionForm action={action}>
      <label className="field">
        <span className="field-label">Name</span>
        <input className="input" name="title" defaultValue={material?.title ?? ""} required maxLength={120} />
      </label>
      <label className="field">
        <span className="field-label">Kind</span>
        <select className="select" name="kind" defaultValue={material?.kind ?? "policy"}>
          {REFERENCE_KIND_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span className="field-label">Text</span>
        <span className="field-hint">The policy or documentation reviewers and prompts can rely on.</span>
        <textarea className="textarea" name="body" defaultValue={material?.body ?? ""} required rows={8} maxLength={8000} />
      </label>
      <SubmitButton>{submitLabel}</SubmitButton>
    </ActionForm>
  );
}

export function VersionForm({
  action,
  version,
  submitLabel,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  version?: PromptVersion;
  submitLabel: string;
}) {
  return (
    <ActionForm action={action}>
      <label className="field">
        <span className="field-label">Version name</span>
        <input className="input" name="name" defaultValue={version?.name ?? ""} required maxLength={80} />
      </label>
      <label className="field">
        <span className="field-label">What changed</span>
        <textarea className="textarea" name="changeNotes" defaultValue={version?.changeNotes ?? ""} rows={3} />
      </label>
      <label className="field">
        <span className="field-label">System instructions</span>
        <span className="field-hint">The directions you would give the model. This is the system side of the prompt.</span>
        <textarea
          className="textarea"
          name="instructions"
          defaultValue={version?.instructions ?? ""}
          required
          rows={8}
        />
      </label>
      <div className="grid-2">
        <label className="field">
          <span className="field-label">Provider</span>
          <select className="select" name="provider" defaultValue={version?.provider ?? "openai"}>
            {PROVIDER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field-label">Model identifier</span>
          <span className="field-hint">Type the identifier your provider expects. This app does not pick one for you.</span>
          <input
            className="input"
            name="model"
            defaultValue={version?.model ?? ""}
            required
            maxLength={120}
            placeholder="Model identifier"
            autoComplete="off"
          />
        </label>
      </div>
      <label className="field">
        <span className="field-label">Message template</span>
        <span className="field-hint">
          {"{input}"} becomes the customer message. {"{situation}"} becomes the situation notes.
        </span>
        <textarea
          className="textarea"
          name="messageTemplate"
          defaultValue={version?.messageTemplate ?? DEFAULT_MESSAGE_TEMPLATE}
          required
          rows={6}
        />
      </label>
      <SubmitButton>{submitLabel}</SubmitButton>
    </ActionForm>
  );
}
