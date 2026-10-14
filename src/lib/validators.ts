import type {
  CheckConfig,
  CheckType,
  Priority,
  ProviderId,
  ReferenceKind,
  ReferenceMaterial,
  Requirement,
  Scenario,
  ScenarioCategory,
  ScenarioSet,
  PromptVersion,
} from "@/lib/types";
import { emptyCheckConfig } from "@/lib/types";

export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

export type ProjectInput = {
  name: string;
  featureSummary: string;
  decisionNote: string;
  minPassRate: number;
  graderProvider: ProviderId;
  graderModel: string;
};

export type RequirementInput = {
  title: string;
  details: string;
  passGuidance: string;
  failGuidance: string;
  critical: boolean;
  priority: Priority;
  passPercent: number;
  checkType: CheckType;
  checkConfig: CheckConfig;
};

export type ScenarioInput = {
  title: string;
  customerInput: string;
  situation: string;
  goodLooksLike: string;
  referenceAnswer: string;
  category: ScenarioCategory;
  dataset: ScenarioSet;
  appliesToAll: boolean;
  requirementIds: string[];
};

export type ReferenceInput = {
  title: string;
  body: string;
  kind: ReferenceKind;
};

export type VersionInput = {
  name: string;
  changeNotes: string;
  instructions: string;
  messageTemplate: string;
  provider: ProviderId;
  model: string;
};

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function limited(value: string, max: number, label: string): string | null {
  if (value.length > max) return `${label} must be ${max} characters or fewer.`;
  return null;
}

function percent(value: string, label: string): ParseResult<number> {
  if (!/^\d+$/.test(value)) return { ok: false, error: `${label} must be a whole number.` };
  const parsed = Number(value);
  if (parsed < 1 || parsed > 100) {
    return { ok: false, error: `${label} must be between 1 and 100.` };
  }
  return { ok: true, value: parsed };
}

const PRIORITIES = new Set<Priority>(["blocker", "important", "helpful"]);
const CHECK_TYPES = new Set<CheckType>([
  "must_include_any",
  "must_include_all",
  "must_not_include",
  "word_count",
  "human_only",
  "required_text",
  "forbidden_text",
  "valid_json",
]);

export function parseProjectForm(formData: FormData): ParseResult<ProjectInput> {
  const name = text(formData, "name");
  const featureSummary = text(formData, "featureSummary");
  const decisionNote = text(formData, "decisionNote");
  if (!name) return { ok: false, error: "Give the project a name." };
  if (!featureSummary) {
    return { ok: false, error: "Describe the text feature you are evaluating." };
  }
  const nameError = limited(name, 80, "The project name");
  if (nameError) return { ok: false, error: nameError };
  const summaryError = limited(featureSummary, 280, "The feature description");
  if (summaryError) return { ok: false, error: summaryError };
  const noteError = limited(decisionNote, 400, "The decision note");
  if (noteError) return { ok: false, error: noteError };
  const rate = percent(text(formData, "minPassRate"), "The release bar");
  if (!rate.ok) return rate;
  const graderProvider = text(formData, "graderProvider") || "openai";
  if (graderProvider !== "openai" && graderProvider !== "anthropic") {
    return { ok: false, error: "Choose OpenAI or Anthropic for the grader." };
  }
  const graderModel = text(formData, "graderModel");
  const modelError = limited(graderModel, 120, "The grader model identifier");
  if (modelError) return { ok: false, error: modelError };
  return {
    ok: true,
    value: {
      name,
      featureSummary,
      decisionNote,
      minPassRate: rate.value,
      graderProvider,
      graderModel,
    },
  };
}

function parsePhrases(raw: string): ParseResult<string[]> {
  const phrases = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (phrases.length === 0) {
    return { ok: false, error: "Add at least one phrase, one per line." };
  }
  if (phrases.length > 20) {
    return { ok: false, error: "Use 20 phrases or fewer." };
  }
  const tooLong = phrases.find((phrase) => phrase.length > 80);
  if (tooLong) {
    return { ok: false, error: "Each phrase must be 80 characters or fewer." };
  }
  return { ok: true, value: phrases };
}

function parseOptionalCount(raw: string, label: string): ParseResult<number | null> {
  if (!raw) return { ok: true, value: null };
  if (!/^\d+$/.test(raw)) return { ok: false, error: `${label} must be a whole number.` };
  const parsed = Number(raw);
  if (parsed > 2000) return { ok: false, error: `${label} must be 2000 or fewer.` };
  return { ok: true, value: parsed };
}

export function parseRequirementForm(
  formData: FormData,
): ParseResult<RequirementInput> {
  const title = text(formData, "title");
  const details = text(formData, "details");
  const priority = text(formData, "priority");
  const checkType = text(formData, "checkType");
  const passGuidance = text(formData, "passGuidance");
  const failGuidance = text(formData, "failGuidance");
  const critical = text(formData, "critical") === "yes";
  if (!title) return { ok: false, error: "Name the requirement." };
  if (!details) return { ok: false, error: "Describe the requirement in plain language." };
  if (!passGuidance) return { ok: false, error: "Describe what a passing response does." };
  if (!failGuidance) return { ok: false, error: "Describe what a failing response does." };
  const titleError = limited(title, 120, "The requirement name");
  if (titleError) return { ok: false, error: titleError };
  const detailsError = limited(details, 1000, "The description");
  if (detailsError) return { ok: false, error: detailsError };
  const passError = limited(passGuidance, 1000, "The pass guidance");
  if (passError) return { ok: false, error: passError };
  const failError = limited(failGuidance, 1000, "The fail guidance");
  if (failError) return { ok: false, error: failError };
  if (!PRIORITIES.has(priority as Priority)) {
    return { ok: false, error: "Choose a priority." };
  }
  if (!CHECK_TYPES.has(checkType as CheckType)) {
    return { ok: false, error: "Choose how this requirement is checked." };
  }
  const rate = percent(text(formData, "passPercent"), "The pass bar");
  if (!rate.ok) return rate;

  const config = emptyCheckConfig();
  const typedCheck = checkType as CheckType;
  if (
    typedCheck === "must_include_any" ||
    typedCheck === "must_include_all" ||
    typedCheck === "must_not_include" ||
    typedCheck === "required_text" ||
    typedCheck === "forbidden_text"
  ) {
    const phrases = parsePhrases(text(formData, "phrases"));
    if (!phrases.ok) return phrases;
    config.phrases = phrases.value;
  }
  if (typedCheck === "word_count") {
    const minWords = parseOptionalCount(text(formData, "minWords"), "The minimum");
    if (!minWords.ok) return minWords;
    const maxWords = parseOptionalCount(text(formData, "maxWords"), "The maximum");
    if (!maxWords.ok) return maxWords;
    if (minWords.value === null && maxWords.value === null) {
      return { ok: false, error: "Set a minimum, a maximum, or both." };
    }
    if (
      minWords.value !== null &&
      maxWords.value !== null &&
      maxWords.value < minWords.value
    ) {
      return { ok: false, error: "The maximum must be at least the minimum." };
    }
    config.minWords = minWords.value;
    config.maxWords = maxWords.value;
  }

  return {
    ok: true,
    value: {
      title,
      details,
      passGuidance,
      failGuidance,
      critical,
      priority: priority as Priority,
      passPercent: rate.value,
      checkType: typedCheck,
      checkConfig: config,
    },
  };
}

const CATEGORIES = new Set<ScenarioCategory>(["normal", "edge", "adversarial"]);
const DATASETS = new Set<ScenarioSet>(["development", "holdout"]);

export function parseScenarioForm(
  formData: FormData,
  requirements: { id: string }[],
): ParseResult<ScenarioInput> {
  const title = text(formData, "title");
  const customerInput = text(formData, "customerInput");
  const situation = text(formData, "situation");
  const goodLooksLike = text(formData, "goodLooksLike");
  const referenceAnswer = text(formData, "referenceAnswer");
  const category = text(formData, "category");
  const dataset = text(formData, "dataset");
  if (!title) return { ok: false, error: "Name the scenario." };
  if (!customerInput) return { ok: false, error: "Write the user input." };
  if (!goodLooksLike) return { ok: false, error: "Describe the expected behavior." };
  const titleError = limited(title, 80, "The scenario name");
  if (titleError) return { ok: false, error: titleError };
  const inputError = limited(customerInput, 2000, "The user input");
  if (inputError) return { ok: false, error: inputError };
  const situationError = limited(situation, 2000, "The conversation context");
  if (situationError) return { ok: false, error: situationError };
  const goodError = limited(goodLooksLike, 2000, "The expected behavior");
  if (goodError) return { ok: false, error: goodError };
  const referenceError = limited(referenceAnswer, 4000, "The reference answer");
  if (referenceError) return { ok: false, error: referenceError };
  if (!CATEGORIES.has(category as ScenarioCategory)) {
    return { ok: false, error: "Choose a category." };
  }
  if (!DATASETS.has(dataset as ScenarioSet)) {
    return { ok: false, error: "Choose development or holdout." };
  }

  const selected = formData
    .getAll("requirementIds")
    .filter((value): value is string => typeof value === "string");
  const known = new Set(requirements.map((requirement) => requirement.id));
  if (selected.some((id) => !known.has(id))) {
    return { ok: false, error: "One of the selected requirements is not in this project." };
  }
  if (requirements.length > 0 && selected.length === 0) {
    return { ok: false, error: "Choose at least one requirement, or leave them all selected." };
  }
  const appliesToAll = requirements.length === 0 || selected.length === requirements.length;

  return {
    ok: true,
    value: {
      title,
      customerInput,
      situation,
      goodLooksLike,
      referenceAnswer,
      category: category as ScenarioCategory,
      dataset: dataset as ScenarioSet,
      appliesToAll,
      requirementIds: appliesToAll ? [] : selected,
    },
  };
}

const REFERENCE_KINDS = new Set<ReferenceKind>(["policy", "documentation"]);

export function parseReferenceForm(formData: FormData): ParseResult<ReferenceInput> {
  const title = text(formData, "title");
  const body = text(formData, "body");
  const kind = text(formData, "kind");
  if (!title) return { ok: false, error: "Name the reference." };
  if (!body) return { ok: false, error: "Add the policy or documentation text." };
  const titleError = limited(title, 120, "The reference name");
  if (titleError) return { ok: false, error: titleError };
  const bodyError = limited(body, 8000, "The reference text");
  if (bodyError) return { ok: false, error: bodyError };
  if (!REFERENCE_KINDS.has(kind as ReferenceKind)) {
    return { ok: false, error: "Choose policy or product documentation." };
  }
  return { ok: true, value: { title, body, kind: kind as ReferenceKind } };
}

export function parseVersionForm(formData: FormData): ParseResult<VersionInput> {
  const name = text(formData, "name");
  const changeNotes = text(formData, "changeNotes");
  const instructions = text(formData, "instructions");
  const messageTemplate = text(formData, "messageTemplate");
  const provider = text(formData, "provider");
  const model = text(formData, "model");
  if (!name) return { ok: false, error: "Name this prompt version." };
  if (!instructions) return { ok: false, error: "Add the system instructions for this version." };
  if (!messageTemplate) {
    return { ok: false, error: "Add the message template. Use {input} for the customer message." };
  }
  if (provider !== "openai" && provider !== "anthropic") {
    return { ok: false, error: "Choose OpenAI or Anthropic." };
  }
  if (!model) return { ok: false, error: "Enter a model identifier." };
  const nameError = limited(name, 80, "The version name");
  if (nameError) return { ok: false, error: nameError };
  const notesError = limited(changeNotes, 500, "The change notes");
  if (notesError) return { ok: false, error: notesError };
  const instructionsError = limited(instructions, 8000, "The instructions");
  if (instructionsError) return { ok: false, error: instructionsError };
  const templateError = limited(messageTemplate, 4000, "The message template");
  if (templateError) return { ok: false, error: templateError };
  const modelError = limited(model, 120, "The model identifier");
  if (modelError) return { ok: false, error: modelError };
  return {
    ok: true,
    value: { name, changeNotes, instructions, messageTemplate, provider: provider as ProviderId, model },
  };
}

export function requirementToInput(requirement: Requirement): RequirementInput {
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
  };
}

export function scenarioToInput(scenario: Scenario): ScenarioInput {
  return {
    title: scenario.title,
    customerInput: scenario.customerInput,
    situation: scenario.situation,
    goodLooksLike: scenario.goodLooksLike,
    referenceAnswer: scenario.referenceAnswer,
    category: scenario.category,
    dataset: scenario.dataset,
    appliesToAll: scenario.appliesToAll,
    requirementIds: scenario.requirementIds,
  };
}

export function referenceToInput(material: ReferenceMaterial): ReferenceInput {
  return { title: material.title, body: material.body, kind: material.kind };
}

export function versionToInput(version: PromptVersion): VersionInput {
  return {
    name: version.name,
    changeNotes: version.changeNotes,
    instructions: version.instructions,
    messageTemplate: version.messageTemplate,
    provider: version.provider,
    model: version.model,
  };
}
