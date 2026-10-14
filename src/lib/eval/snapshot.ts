import type {
  PromptVersion,
  ReferenceMaterial,
  Requirement,
  RunMode,
  Scenario,
  ScenarioSet,
} from "@/lib/types";

export type SnapshotVersion = Pick<
  PromptVersion,
  "id" | "name" | "changeNotes" | "instructions" | "messageTemplate" | "provider" | "model" | "position"
>;

export type RunSnapshot = {
  capturedAt: string;
  dataset: ScenarioSet;
  repetitions: number;
  mode: RunMode;
  minPassRate: number;
  requirements: Requirement[];
  scenarios: Scenario[];
  materials: ReferenceMaterial[];
  versions: SnapshotVersion[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function captureSnapshot(input: {
  capturedAt: string;
  dataset: ScenarioSet;
  repetitions: number;
  mode: RunMode;
  minPassRate: number;
  requirements: Requirement[];
  scenarios: Scenario[];
  materials: ReferenceMaterial[];
  versions: PromptVersion[];
}): RunSnapshot {
  return {
    capturedAt: input.capturedAt,
    dataset: input.dataset,
    repetitions: input.repetitions,
    mode: input.mode,
    minPassRate: input.minPassRate,
    requirements: input.requirements,
    scenarios: input.scenarios,
    materials: input.materials,
    versions: input.versions.map((version) => ({
      id: version.id,
      name: version.name,
      changeNotes: version.changeNotes,
      instructions: version.instructions,
      messageTemplate: version.messageTemplate,
      provider: version.provider,
      model: version.model,
      position: version.position,
    })),
  };
}

export function serializeSnapshot(snapshot: RunSnapshot): string {
  return JSON.stringify(snapshot);
}

export function parseRunSnapshot(raw: string | null | undefined): RunSnapshot | null {
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) return null;
    if (!Array.isArray(parsed.requirements) || !Array.isArray(parsed.scenarios)) return null;
    if (!Array.isArray(parsed.materials) || !Array.isArray(parsed.versions)) return null;
    if (parsed.dataset !== "development" && parsed.dataset !== "holdout") return null;
    if (parsed.mode !== "unset" && parsed.mode !== "live" && parsed.mode !== "demo") return null;
    if (typeof parsed.repetitions !== "number" || typeof parsed.minPassRate !== "number") return null;
    return parsed as RunSnapshot;
  } catch {
    return null;
  }
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function snapshotDrift(
  snapshot: RunSnapshot,
  live: {
    minPassRate: number;
    requirements: Requirement[];
    scenarios: Scenario[];
    materials: ReferenceMaterial[];
    versions: PromptVersion[];
  },
): boolean {
  if (live.minPassRate !== snapshot.minPassRate) return true;
  const liveRequirements = new Map(live.requirements.map((item) => [item.id, item]));
  const liveScenarios = new Map(live.scenarios.map((item) => [item.id, item]));
  const liveMaterials = new Map(live.materials.map((item) => [item.id, item]));
  const liveVersions = new Map(live.versions.map((item) => [item.id, item]));
  for (const requirement of snapshot.requirements) {
    const current = liveRequirements.get(requirement.id);
    if (!current || !sameJson(requirementToComparable(current), requirementToComparable(requirement))) {
      return true;
    }
  }
  for (const scenario of snapshot.scenarios) {
    const current = liveScenarios.get(scenario.id);
    if (!current || !sameJson(scenarioToComparable(current), scenarioToComparable(scenario))) return true;
  }
  for (const material of snapshot.materials) {
    const current = liveMaterials.get(material.id);
    if (!current || !sameJson(materialToComparable(current), materialToComparable(material))) return true;
  }
  for (const version of snapshot.versions) {
    const current = liveVersions.get(version.id);
    if (!current || !sameJson(versionToComparable(current), version)) return true;
  }
  return false;
}

function requirementToComparable(requirement: Requirement) {
  return {
    title: requirement.title,
    details: requirement.details,
    passGuidance: requirement.passGuidance,
    failGuidance: requirement.failGuidance,
    critical: requirement.critical,
    priority: requirement.priority,
    passPercent: requirement.passPercent,
    checkType: requirement.checkType,
    checkConfig: requirement.checkConfig,
    position: requirement.position,
  };
}

function scenarioToComparable(scenario: Scenario) {
  return {
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
  };
}

function materialToComparable(material: ReferenceMaterial) {
  return {
    title: material.title,
    body: material.body,
    kind: material.kind,
    position: material.position,
  };
}

function versionToComparable(version: PromptVersion): SnapshotVersion {
  return {
    id: version.id,
    name: version.name,
    changeNotes: version.changeNotes,
    instructions: version.instructions,
    messageTemplate: version.messageTemplate,
    provider: version.provider,
    model: version.model,
    position: version.position,
  };
}
