import type {
  CheckType,
  Priority,
  ProviderId,
  ReferenceKind,
  ResponseSource,
  RunSource,
  ScenarioCategory,
  ScenarioSet,
} from "@/lib/types";

export const CATEGORY_OPTIONS: { value: ScenarioCategory; label: string }[] = [
  { value: "normal", label: "Normal" },
  { value: "edge", label: "Edge case" },
  { value: "adversarial", label: "Adversarial" },
];

export const DATASET_OPTIONS: { value: ScenarioSet; label: string }[] = [
  { value: "development", label: "Development set" },
  { value: "holdout", label: "Holdout set" },
];

export const PROVIDER_OPTIONS: { value: ProviderId; label: string }[] = [
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
];

export const REFERENCE_KIND_OPTIONS: { value: ReferenceKind; label: string }[] = [
  { value: "policy", label: "Company policy" },
  { value: "documentation", label: "Product documentation" },
];

export const CHECK_TYPE_OPTIONS: { value: CheckType; label: string }[] = [
  {
    value: "must_include_any",
    label: "Reply must include at least one phrase",
  },
  { value: "must_include_all", label: "Reply must include every phrase" },
  { value: "must_not_include", label: "Reply must not include these phrases" },
  { value: "word_count", label: "Word count" },
  { value: "human_only", label: "No deterministic check" },
  { value: "required_text", label: "Required text" },
  { value: "forbidden_text", label: "Forbidden text" },
  { value: "valid_json", label: "Valid JSON output" },
];

export const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: "blocker", label: "Blocker" },
  { value: "important", label: "Important" },
  { value: "helpful", label: "Helpful" },
];

export function priorityLabel(priority: Priority): string {
  switch (priority) {
    case "blocker":
      return "Blocker";
    case "important":
      return "Important";
    case "helpful":
      return "Helpful";
  }
}

export function priorityHint(priority: Priority): string {
  switch (priority) {
    case "blocker":
      return "Must meet its bar, or the version is not ready.";
    case "important":
      return "Must meet its bar, or the version is not ready.";
    case "helpful":
      return "Does not veto release on its own. Failed checks still count toward the overall pass rate.";
  }
}

export function checkTypeHint(checkType: CheckType): string {
  switch (checkType) {
    case "must_include_any":
      return "The reply passes if any one line appears. Matching ignores capitalization.";
    case "must_include_all":
      return "The reply passes only if every line appears. Matching ignores capitalization.";
    case "must_not_include":
      return "The reply fails if any line appears. Matching ignores capitalization.";
    case "word_count":
      return "Words are separated by spaces. Leave a box blank if you only care about one side.";
    case "human_only":
      return "No extra text or JSON check. An AI grader still judges this requirement when you grade a run.";
    case "required_text":
      return "The reply fails if any line is missing. Matching ignores capitalization.";
    case "forbidden_text":
      return "The reply fails if any line appears. Matching ignores capitalization.";
    case "valid_json":
      return "The reply fails unless the whole response is valid JSON.";
  }
}

export function categoryLabel(category: ScenarioCategory): string {
  return CATEGORY_OPTIONS.find((option) => option.value === category)?.label ?? "Normal";
}

export function datasetLabel(dataset: ScenarioSet): string {
  return dataset === "holdout" ? "Holdout" : "Development";
}

export function referenceKindLabel(kind: ReferenceKind): string {
  return kind === "documentation" ? "Product documentation" : "Company policy";
}

export function sourceLabel(source: ResponseSource | RunSource): string {
  switch (source) {
    case "sample":
      return "Sample data";
    case "pasted":
      return "Pasted replies";
    case "model":
      return "Model replies";
    case "demo":
      return "Demo mode";
    case "mixed":
      return "Mixed sources";
    case "empty":
      return "No reply yet";
    case "unset":
      return "Not graded";
  }
}

export function providerLabel(provider: string): string {
  return provider === "anthropic" ? "Anthropic" : provider === "openai" ? "OpenAI" : "Provider not set";
}
