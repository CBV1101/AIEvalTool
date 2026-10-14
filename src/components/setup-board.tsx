import {
  createReference,
  createRequirement,
  createScenario,
  createVersion,
  removeReference,
  removeRequirement,
  removeScenario,
  removeVersion,
  reorderRequirement,
  reorderScenario,
  reorderVersion,
  saveReference,
  saveRequirement,
  saveScenario,
  saveVersion,
} from "@/lib/actions/setup";
import { duplicateProject, removeProject, saveProject } from "@/lib/actions/projects";
import { ProjectForm, ReferenceForm, ScenarioForm, VersionForm } from "@/components/entity-forms";
import { Onboarding, projectOnboarding } from "@/components/onboarding";
import { RequirementForm } from "@/components/requirement-form";
import { ScenarioImport } from "@/components/scenario-import";
import { PriorityPill } from "@/components/ui";
import { describeCheck } from "@/lib/eval/grading";
import { templateWarning } from "@/lib/eval/prompts";
import { categoryLabel, datasetLabel, priorityHint, providerLabel, referenceKindLabel } from "@/lib/labels";
import { linkedRequirementLabel } from "@/lib/scenarios/links";
import type { Project, PromptVersion, ReferenceMaterial, Requirement, Scenario } from "@/lib/types";

export function SetupBoard({
  project,
  requirements,
  scenarios,
  versions,
  materials,
}: {
  project: Project;
  requirements: Requirement[];
  scenarios: Scenario[];
  versions: PromptVersion[];
  materials: ReferenceMaterial[];
}) {
  return (
    <div className="stack-lg">
      <header className="stack">
        <p className="eyebrow">Test setup</p>
        <h2>Define the bar, the situations, and two prompts</h2>
        <p className="lede">
          A requirement is a promise the feature must keep, with pass and fail guidance. A scenario
          is one situation it should handle. Reference material is the policy or documentation both
          versions can rely on. Comparison uses two prompt versions at a time.
        </p>
      </header>
      {project.isDemo ? null : <Onboarding steps={projectOnboarding(project.id)} heading="Where to start" />}

      {project.isDemo ? (
        <DemoSetup
          project={project}
          requirements={requirements}
          scenarios={scenarios}
          versions={versions}
          materials={materials}
        />
      ) : (
        <EditableSetup
          project={project}
          requirements={requirements}
          scenarios={scenarios}
          versions={versions}
          materials={materials}
        />
      )}
    </div>
  );
}

function DemoSetup({
  project,
  requirements,
  scenarios,
  versions,
  materials,
}: {
  project: Project;
  requirements: Requirement[];
  scenarios: Scenario[];
  versions: PromptVersion[];
  materials: ReferenceMaterial[];
}) {
  return (
    <>
      <section className="panel stack" aria-labelledby="release-heading">
        <h2 id="release-heading">Release bar</h2>
        <p>
          A version is ready at <strong>{project.minPassRate}%</strong> of scored checks, and only
          if every blocker, important, and critical requirement meets its own bar. A critical
          requirement fails the release when any linked scenario fails.
        </p>
        <p>{project.decisionNote}</p>
        <form action={duplicateProject.bind(null, project.id)}>
          <button className="btn btn-primary" type="submit">
            Copy into an editable project
          </button>
        </form>
        <p className="field-hint">
          The copy includes requirements, scenarios, reference material, and prompts. Sample results stay in the demo.
        </p>
      </section>
      <ReferenceList materials={materials} />
      <RequirementTable requirements={requirements} />
      <ScenarioList scenarios={scenarios} requirements={requirements} />
      <VersionList versions={versions} />
    </>
  );
}

function EditableSetup({
  project,
  requirements,
  scenarios,
  versions,
  materials,
}: {
  project: Project;
  requirements: Requirement[];
  scenarios: Scenario[];
  versions: PromptVersion[];
  materials: ReferenceMaterial[];
}) {
  return (
    <>
      <section className="panel stack" id="project" aria-labelledby="project-settings">
        <h2 id="project-settings">Project and release bar</h2>
        <ProjectForm action={saveProject.bind(null, project.id)} project={project} submitLabel="Save project" />
      </section>

      <section className="stack" id="reference" aria-labelledby="reference-heading">
        <div className="stack">
          <h2 id="reference-heading">Reference material</h2>
          <p className="lede">
            Store the product documentation or company policy this feature has to follow. It stays with the project.
          </p>
        </div>
        {materials.length === 0 ? (
          <p className="panel">No reference material yet. Add a policy or help article the replies should follow.</p>
        ) : (
          <ReferenceList materials={materials} projectId={project.id} editable />
        )}
        <div className="panel stack">
          <h3>Add reference material</h3>
          <ReferenceForm action={createReference.bind(null, project.id)} submitLabel="Add reference" />
        </div>
      </section>

      <section className="stack" id="requirements" aria-labelledby="requirements-heading">
        <div className="stack">
          <h2 id="requirements-heading">Requirements</h2>
          <p className="lede">
            Each requirement needs a description, explicit pass and fail guidance, and a minimum pass
            rate. Mark it critical when any single failure should block release. Automatic checks are
            optional and literal. A pass rate is the share of linked scenario checks that passed.
          </p>
        </div>
        {requirements.length === 0 ? (
          <p className="panel">No requirements yet. Add the promises a release would be judged on.</p>
        ) : (
          <RequirementTable requirements={requirements} projectId={project.id} editable scenarioCount={scenarios.length} />
        )}
        <div className="panel stack">
          <h3>Add a requirement</h3>
          <RequirementForm
            action={createRequirement.bind(null, project.id)}
            submitLabel="Add requirement"
            scenarioCount={scenarios.length}
          />
        </div>
      </section>

      <section className="stack" id="scenarios" aria-labelledby="scenarios-heading">
        <div className="stack">
          <h2 id="scenarios-heading">Scenarios</h2>
          <p className="lede">
            Each scenario is one user input, with the behavior you expect. Development scenarios are
            for tuning. Holdout scenarios stay out of that tuning until you want an honest check.
          </p>
        </div>
        {scenarios.length === 0 ? (
          <p className="panel">No scenarios yet. Add the situations you would want to see before shipping.</p>
        ) : (
          <ScenarioList scenarios={scenarios} requirements={requirements} projectId={project.id} editable />
        )}
        <div className="panel stack">
          <h3>Add a scenario</h3>
          <ScenarioForm
            action={createScenario.bind(null, project.id)}
            requirements={requirements}
            submitLabel="Add scenario"
          />
        </div>
        <div className="panel stack" id="import">
          <h3>Import scenarios</h3>
          <ScenarioImport projectId={project.id} />
        </div>
      </section>

      <section className="stack" id="versions" aria-labelledby="versions-heading">
        <div className="stack">
          <h2 id="versions-heading">Prompt versions</h2>
          <p className="lede">
            Add two versions. Version A is the left column in a comparison, and version B is the right.
          </p>
          {versions.length === 1 ? (
            <p className="banner banner-warn">Add a second version before you run an evaluation.</p>
          ) : null}
        </div>
        {versions.length > 0 ? <VersionList versions={versions} projectId={project.id} editable /> : null}
        <div className="panel stack">
          <h3>Add a prompt version</h3>
          <VersionForm action={createVersion.bind(null, project.id)} submitLabel="Add version" />
        </div>
      </section>

      <section className="panel stack" aria-labelledby="delete-project">
        <h2 id="delete-project">Delete project</h2>
        <p>This removes the project, its setup, and every evaluation stored with it.</p>
        <form action={removeProject.bind(null, project.id)} className="stack">
          <label>
            <input type="checkbox" name="confirm" value="yes" required /> Delete this project and its evaluations
          </label>
          <button className="btn btn-danger" type="submit">
            Delete project
          </button>
        </form>
      </section>
    </>
  );
}

function RequirementTable({
  requirements,
  projectId,
  editable = false,
  scenarioCount = 0,
}: {
  requirements: Requirement[];
  projectId?: string;
  editable?: boolean;
  scenarioCount?: number;
}) {
  return (
    <div className="table-scroll">
      <table>
        <caption className="sr-only">Requirements and release bars</caption>
        <thead>
          <tr>
            <th scope="col">Requirement</th>
            <th scope="col">Pass / fail</th>
            <th scope="col">Minimum pass rate</th>
            <th scope="col">Release</th>
            {editable ? <th scope="col">Order</th> : null}
          </tr>
        </thead>
        <tbody>
          {requirements.map((requirement, index) => (
            <tr key={requirement.id}>
              <th scope="row">
                <div className="stack">
                  <span>{requirement.title}</span>
                  {requirement.details ? <span className="meta">{requirement.details}</span> : null}
                  {requirement.checkType !== "human_only" ? (
                    <span className="meta">Automatic check: {describeCheck(requirement.checkType, requirement.checkConfig)}</span>
                  ) : null}
                  {editable && projectId ? (
                    <details className="editor">
                      <summary>Edit</summary>
                      <div className="stack">
                        <RequirementForm
                          action={saveRequirement.bind(null, projectId, requirement.id)}
                          initial={requirement}
                          submitLabel="Save requirement"
                          scenarioCount={scenarioCount}
                        />
                        <details>
                          <summary>Delete</summary>
                          <form action={removeRequirement.bind(null, projectId, requirement.id)}>
                            <button className="btn btn-danger" type="submit">
                              Delete requirement
                            </button>
                          </form>
                        </details>
                      </div>
                    </details>
                  ) : null}
                </div>
              </th>
              <td>
                <p>
                  <span className="eyebrow">Pass</span>
                  {requirement.passGuidance || "Add pass guidance."}
                </p>
                <p>
                  <span className="eyebrow">Fail</span>
                  {requirement.failGuidance || "Add fail guidance."}
                </p>
              </td>
              <td>{requirement.passPercent}% of linked scenarios</td>
              <td>
                {requirement.critical ? <span className="pill pill-critical">Critical</span> : null}
                <PriorityPill priority={requirement.priority} />
                <p className="meta">
                  {requirement.critical
                    ? "Any failure blocks release."
                    : priorityHint(requirement.priority)}
                </p>
              </td>
              {editable && projectId ? (
                <td>
                  <div className="inline-actions">
                    {index > 0 ? (
                      <form action={reorderRequirement.bind(null, projectId, requirement.id, "up")}>
                        <button className="btn" type="submit">
                          Move up
                        </button>
                      </form>
                    ) : null}
                    {index < requirements.length - 1 ? (
                      <form action={reorderRequirement.bind(null, projectId, requirement.id, "down")}>
                        <button className="btn" type="submit">
                          Move down
                        </button>
                      </form>
                    ) : null}
                  </div>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReferenceList({
  materials,
  projectId,
  editable = false,
}: {
  materials: ReferenceMaterial[];
  projectId?: string;
  editable?: boolean;
}) {
  if (materials.length === 0) return null;
  return (
    <div className="stack">
      {materials.map((material) => (
        <article className="panel stack" key={material.id}>
          <p className="eyebrow">{referenceKindLabel(material.kind)}</p>
          <h3>{material.title}</h3>
          <pre className="reply">{material.body}</pre>
          {editable && projectId ? (
            <details className="editor">
              <summary>Edit reference</summary>
              <ReferenceForm
                action={saveReference.bind(null, projectId, material.id)}
                material={material}
                submitLabel="Save reference"
              />
              <details>
                <summary>Delete</summary>
                <form action={removeReference.bind(null, projectId, material.id)}>
                  <button className="btn btn-danger" type="submit">
                    Delete reference
                  </button>
                </form>
              </details>
            </details>
          ) : null}
        </article>
      ))}
    </div>
  );
}

function ScenarioList({
  scenarios,
  requirements,
  projectId,
  editable = false,
}: {
  scenarios: Scenario[];
  requirements: Requirement[];
  projectId?: string;
  editable?: boolean;
}) {
  return (
    <div className="stack">
      <p className="meta">
        {scenarios.length} {scenarios.length === 1 ? "scenario" : "scenarios"}.{" "}
        {scenarios.filter((scenario) => scenario.dataset === "holdout").length} in the holdout set.
      </p>
      {scenarios.map((scenario, index) => (
        <article className="panel stack" key={scenario.id}>
          <h3>{scenario.title}</h3>
          <p className="inline-actions">
            <span className="pill">{categoryLabel(scenario.category)}</span>
            <span className="pill">{datasetLabel(scenario.dataset)}</span>
          </p>
          <p>
            <span className="eyebrow">User input</span>
            {scenario.customerInput}
          </p>
          {scenario.situation ? (
            <p>
              <span className="eyebrow">Conversation context</span>
              {scenario.situation}
            </p>
          ) : null}
          {scenario.goodLooksLike ? (
            <p>
              <span className="eyebrow">Expected behavior</span>
              {scenario.goodLooksLike}
            </p>
          ) : null}
          {scenario.referenceAnswer ? (
            <p>
              <span className="eyebrow">Reference answer</span>
              {scenario.referenceAnswer}
            </p>
          ) : null}
          <p className="meta">Tests {linkedRequirementLabel(scenario, requirements)}.</p>
          {editable && projectId ? (
            <div className="stack">
              <div className="inline-actions">
                {index > 0 ? (
                  <form action={reorderScenario.bind(null, projectId, scenario.id, "up")}>
                    <button className="btn" type="submit">
                      Move up
                    </button>
                  </form>
                ) : null}
                {index < scenarios.length - 1 ? (
                  <form action={reorderScenario.bind(null, projectId, scenario.id, "down")}>
                    <button className="btn" type="submit">
                      Move down
                    </button>
                  </form>
                ) : null}
              </div>
              <details className="editor">
                <summary>Edit scenario</summary>
                <ScenarioForm
                  action={saveScenario.bind(null, projectId, scenario.id)}
                  scenario={scenario}
                  requirements={requirements}
                  submitLabel="Save scenario"
                />
                <details>
                  <summary>Delete</summary>
                  <form action={removeScenario.bind(null, projectId, scenario.id)}>
                    <button className="btn btn-danger" type="submit">
                      Delete scenario
                    </button>
                  </form>
                </details>
              </details>
            </div>
          ) : null}
        </article>
      ))}
    </div>
  );
}

function VersionList({
  versions,
  projectId,
  editable = false,
}: {
  versions: PromptVersion[];
  projectId?: string;
  editable?: boolean;
}) {
  return (
    <div className="grid-2">
      {versions.map((version, index) => {
        const warning = templateWarning(version.messageTemplate);
        return (
          <article className="panel stack" key={version.id}>
            <h3>{version.name}</h3>
            {version.changeNotes ? <p>{version.changeNotes}</p> : null}
            <p className="meta">
              {providerLabel(version.provider)} · {version.model || "Model identifier not set"}
            </p>
            <p className="eyebrow">System instructions</p>
            <pre className="reply">{version.instructions}</pre>
            <p className="eyebrow">Message template</p>
            <pre className="reply">{version.messageTemplate}</pre>
            {warning ? <p className="banner banner-warn">{warning}</p> : null}
            {editable && projectId ? (
              <div className="stack">
                <div className="inline-actions">
                  {index > 0 ? (
                    <form action={reorderVersion.bind(null, projectId, version.id, "up")}>
                      <button className="btn" type="submit">
                        Move up
                      </button>
                    </form>
                  ) : null}
                  {index < versions.length - 1 ? (
                    <form action={reorderVersion.bind(null, projectId, version.id, "down")}>
                      <button className="btn" type="submit">
                        Move down
                      </button>
                    </form>
                  ) : null}
                </div>
                <details className="editor">
                  <summary>Edit version</summary>
                  <VersionForm
                    action={saveVersion.bind(null, projectId, version.id)}
                    version={version}
                    submitLabel="Save version"
                  />
                  <details>
                    <summary>Delete</summary>
                    <form action={removeVersion.bind(null, projectId, version.id)}>
                      <button className="btn btn-danger" type="submit">
                        Delete version
                      </button>
                    </form>
                  </details>
                </details>
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}

