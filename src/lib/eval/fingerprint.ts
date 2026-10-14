import type { Project, PromptVersion, ReferenceMaterial, Requirement, Scenario } from "@/lib/types";

export type FingerprintInput = {
  minPassRate: number;
  requirements: Pick<
    Requirement,
    | "id"
    | "title"
    | "details"
    | "passGuidance"
    | "failGuidance"
    | "critical"
    | "priority"
    | "passPercent"
    | "checkType"
    | "checkConfig"
    | "position"
  >[];
  scenarios: Pick<
    Scenario,
    | "id"
    | "title"
    | "customerInput"
    | "situation"
    | "goodLooksLike"
    | "referenceAnswer"
    | "category"
    | "dataset"
    | "appliesToAll"
    | "requirementIds"
    | "position"
  >[];
  versions: Pick<
    PromptVersion,
    | "id"
    | "name"
    | "changeNotes"
    | "instructions"
    | "messageTemplate"
    | "provider"
    | "model"
    | "position"
  >[];
  materials?: Pick<ReferenceMaterial, "id" | "title" | "kind" | "body" | "position">[];
};

export function fingerprintSetup(input: FingerprintInput): string {
  return JSON.stringify({
    minPassRate: input.minPassRate,
    requirements: [...input.requirements]
      .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))
      .map((requirement) => ({
        id: requirement.id,
        title: requirement.title,
        details: requirement.details,
        passGuidance: requirement.passGuidance,
        failGuidance: requirement.failGuidance,
        critical: requirement.critical,
        priority: requirement.priority,
        passPercent: requirement.passPercent,
        checkType: requirement.checkType,
        phrases: requirement.checkConfig.phrases,
        minWords: requirement.checkConfig.minWords,
        maxWords: requirement.checkConfig.maxWords,
        position: requirement.position,
      })),
    scenarios: [...input.scenarios]
      .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))
      .map((scenario) => ({
        id: scenario.id,
        title: scenario.title,
        customerInput: scenario.customerInput,
        situation: scenario.situation,
        goodLooksLike: scenario.goodLooksLike,
        referenceAnswer: scenario.referenceAnswer,
        category: scenario.category,
        dataset: scenario.dataset,
        appliesToAll: scenario.appliesToAll,
        requirementIds: [...scenario.requirementIds].sort(),
        position: scenario.position,
      })),
    versions: [...input.versions]
      .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))
      .map((version) => ({
        id: version.id,
        name: version.name,
        changeNotes: version.changeNotes,
        instructions: version.instructions,
        messageTemplate: version.messageTemplate,
        provider: version.provider,
        model: version.model,
        position: version.position,
      })),
    materials: [...(input.materials ?? [])]
      .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))
      .map((material) => ({
        id: material.id,
        title: material.title,
        kind: material.kind,
        body: material.body,
        position: material.position,
      })),
  });
}

export function fingerprintProject(
  project: Project,
  requirements: Requirement[],
  scenarios: Scenario[],
  versions: PromptVersion[],
  materials: ReferenceMaterial[] = [],
): string {
  return fingerprintSetup({
    minPassRate: project.minPassRate,
    requirements,
    scenarios,
    versions,
    materials,
  });
}
