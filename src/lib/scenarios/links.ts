import type { Requirement, Scenario } from "@/lib/types";

export function applicableRequirements(
  scenario: Pick<Scenario, "appliesToAll" | "requirementIds">,
  requirements: Requirement[],
): Requirement[] {
  if (scenario.appliesToAll) return requirements;
  const selected = new Set(scenario.requirementIds);
  return requirements.filter((requirement) => selected.has(requirement.id));
}

export function linkedRequirementLabel(
  scenario: Pick<Scenario, "appliesToAll" | "requirementIds">,
  requirements: Requirement[],
): string {
  if (scenario.appliesToAll || requirements.length === 0) return "All requirements";
  const names = applicableRequirements(scenario, requirements).map((requirement) => requirement.title);
  if (names.length === 0) return "No requirements selected";
  return names.join(", ");
}
