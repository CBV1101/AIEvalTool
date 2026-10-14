export const DEFAULT_MESSAGE_TEMPLATE = `Customer message:
{input}

Situation:
{situation}`;

export function fillTemplate(
  template: string,
  customerInput: string,
  situation: string,
): string {
  const situationText = situation.trim() || "None provided";
  return template
    .replaceAll("{input}", customerInput)
    .replaceAll("{situation}", situationText);
}

export function referenceSection(
  materials: { title: string; kind: string; body: string }[],
): string {
  if (materials.length === 0) return "Reference material:\nNone provided.";
  const blocks = materials.map(
    (material) => `${material.title} (${material.kind})\n${material.body.trim()}`,
  );
  return `Reference material:\n${blocks.join("\n\n")}`;
}

export function buildEvaluationPrompt(input: {
  instructions: string;
  template: string;
  customerInput: string;
  situation: string;
  materials: { title: string; kind: string; body: string }[];
}): { system: string; user: string; snapshot: string } {
  const parts = [fillTemplate(input.template, input.customerInput, input.situation).trim()];
  if (!input.template.includes("{input}")) {
    parts.push("", "User input:", input.customerInput);
  }
  if (!input.template.includes("{situation}")) {
    parts.push("", "Conversation context:", input.situation.trim() || "None provided.");
  }
  parts.push("", referenceSection(input.materials));
  const user = parts.join("\n");
  const system = input.instructions.trim();
  return {
    system,
    user,
    snapshot: `System instructions:\n${system}\n\n---\n\n${user}`,
  };
}

export function composePrompt(
  instructions: string,
  template: string,
  customerInput: string,
  situation: string,
): string {
  return `${instructions.trim()}\n\n---\n\n${fillTemplate(template, customerInput, situation).trim()}`;
}

export function templateWarning(template: string): string | null {
  if (!template.includes("{input}")) {
    return "This template does not include {input}, so the customer message will not be inserted.";
  }
  return null;
}
