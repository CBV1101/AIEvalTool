import type { ScenarioCategory, ScenarioSet } from "@/lib/types";
import type { ScenarioInput } from "@/lib/validators";

export const SCENARIO_CSV_HEADERS = [
  "name",
  "user_input",
  "conversation_context",
  "expected_behavior",
  "reference_answer",
  "category",
  "set",
  "requirements",
] as const;

export const SCENARIO_CSV_TEMPLATE = [
  SCENARIO_CSV_HEADERS.join(","),
  [
    "Duplicate charge",
    "I was charged twice this month. Can I get that refunded?",
    "The account is on Pro. Two identical charges posted today. Chat cannot issue refunds.",
    "Acknowledge the duplicate charge, explain that chat cannot refund it, and point them to the billing team.",
    "I see two identical Pro charges today. I can't issue a refund from this chat. You can ask the billing team to review them.",
    "normal",
    "development",
    "all",
  ]
    .map(csvCell)
    .join(","),
  [
    "Missing account",
    "Please refund my last payment.",
    "",
    "Ask which account and which charge before discussing eligibility. Do not promise a refund.",
    "",
    "edge",
    "holdout",
    "all",
  ]
    .map(csvCell)
    .join(","),
].join("\n");

export type CsvIssue = {
  line: number;
  name: string;
  userInput: string;
  errors: string[];
};

export type ParsedScenarioRow = {
  line: number;
  name: string;
  userInput: string;
  errors: string[];
  source: string;
  value?: ScenarioInput;
};

export type ScenarioCsvParse = {
  fileError?: string;
  header?: string;
  rows: ParsedScenarioRow[];
};

const HEADER_ALIASES: Record<string, (typeof SCENARIO_CSV_HEADERS)[number]> = {
  name: "name",
  scenario: "name",
  title: "name",
  user_input: "user_input",
  userinput: "user_input",
  input: "user_input",
  "user input": "user_input",
  conversation_context: "conversation_context",
  context: "conversation_context",
  "conversation context": "conversation_context",
  expected_behavior: "expected_behavior",
  expected: "expected_behavior",
  "expected behavior": "expected_behavior",
  reference_answer: "reference_answer",
  reference: "reference_answer",
  "reference answer": "reference_answer",
  category: "category",
  set: "set",
  dataset: "set",
  requirements: "requirements",
  requirement: "requirements",
};

export function csvCell(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replaceAll('"', '""')}"`;
  return value;
}

export function parseCsv(text: string): string[][] {
  const source = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
      continue;
    }
    if (char === ",") {
      row.push(cell);
      cell = "";
      continue;
    }
    if (char === "\n" || char === "\r") {
      if (char === "\r" && source[index + 1] === "\n") index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    cell += char;
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function headerKey(value: string): string {
  return value.trim().toLowerCase().replaceAll("-", " ").replaceAll(/\s+/g, " ");
}

export function parseScenarioCsv(
  text: string,
  requirements: { id: string; title: string }[],
): ScenarioCsvParse {
  const trimmed = text.trim();
  if (!trimmed) return { fileError: "Add a CSV file or paste CSV text.", rows: [] };
  if (trimmed.length > 500_000) {
    return { fileError: "This CSV is larger than 500 KB. Split it into smaller files.", rows: [] };
  }

  const table = parseCsv(trimmed);
  const header = table[0];
  if (!header || header.every((cell) => cell.trim() === "")) {
    return { fileError: "The CSV needs a header row.", rows: [] };
  }

  const columns = new Map<(typeof SCENARIO_CSV_HEADERS)[number], number>();
  const unknown: string[] = [];
  header.forEach((cell, index) => {
    const alias = HEADER_ALIASES[headerKey(cell).replaceAll(" ", "_")] ?? HEADER_ALIASES[headerKey(cell)];
    if (!alias) {
      if (cell.trim()) unknown.push(cell.trim());
      return;
    }
    if (!columns.has(alias)) columns.set(alias, index);
  });

  if (unknown.length > 0) {
    return {
      fileError: `Unknown ${unknown.length === 1 ? "column" : "columns"} ${unknown.map((name) => `“${name}”`).join(", ")}. Use the template headers.`,
      rows: [],
    };
  }
  for (const required of ["user_input", "expected_behavior"] as const) {
    if (!columns.has(required)) {
      return {
        fileError: `The CSV is missing the “${required}” column. Download the template and keep its header row.`,
        rows: [],
      };
    }
  }

  const dataRows = table.slice(1).filter((row) => row.some((cell) => cell.trim() !== ""));
  if (dataRows.length === 0) return { fileError: "The CSV has a header but no scenarios.", rows: [] };
  if (dataRows.length > 500) {
    return { fileError: "Import 500 scenarios or fewer at a time.", rows: [] };
  }

  const requirementByName = new Map(requirements.map((requirement) => [requirement.title.toLowerCase(), requirement.id]));
  const headerLine = header.map((cell) => csvCell(cell ?? "")).join(",");
  const rows: ParsedScenarioRow[] = [];
  let line = 2;
  for (const raw of table.slice(1)) {
    const currentLine = line;
    line += 1;
    if (raw.every((cell) => cell.trim() === "")) continue;
    const read = (name: (typeof SCENARIO_CSV_HEADERS)[number]) => {
      const index = columns.get(name);
      return index === undefined ? "" : (raw[index] ?? "").trim();
    };
    const errors: string[] = [];
    const userInput = read("user_input");
    const expected = read("expected_behavior");
    const name = read("name") || userInput.slice(0, 80);
    if (!userInput) errors.push("User input is required.");
    if (userInput.length > 2000) errors.push("User input must be 2000 characters or fewer.");
    if (!expected) errors.push("Expected behavior is required.");
    if (expected.length > 2000) errors.push("Expected behavior must be 2000 characters or fewer.");
    if (name.length > 80) errors.push("Name must be 80 characters or fewer.");
    const context = read("conversation_context");
    if (context.length > 2000) errors.push("Conversation context must be 2000 characters or fewer.");
    const reference = read("reference_answer");
    if (reference.length > 4000) errors.push("Reference answer must be 4000 characters or fewer.");

    const category = parseCategory(read("category"), errors);
    const dataset = parseDataset(read("set"), errors);
    const linked = parseRequirementCell(read("requirements"), requirementByName, requirements, errors);

    const row: ParsedScenarioRow = {
      line: currentLine,
      name: name || `Row ${currentLine}`,
      userInput,
      errors,
      source: raw.map((cell) => csvCell(cell ?? "")).join(","),
    };
    if (errors.length === 0 && category && dataset && linked) {
      row.value = {
        title: name,
        customerInput: userInput,
        situation: context,
        goodLooksLike: expected,
        referenceAnswer: reference,
        category,
        dataset,
        appliesToAll: linked.appliesToAll,
        requirementIds: linked.requirementIds,
      };
    }
    rows.push(row);
  }

  return { header: headerLine, rows };
}

function parseCategory(value: string, errors: string[]): ScenarioCategory | null {
  if (!value) return "normal";
  const key = value.toLowerCase();
  if (key === "normal") return "normal";
  if (key === "edge" || key === "edge case" || key === "edge-case") return "edge";
  if (key === "adversarial" || key === "adversarial case") return "adversarial";
  errors.push(`Category “${value}” must be normal, edge, or adversarial.`);
  return null;
}

function parseDataset(value: string, errors: string[]): ScenarioSet | null {
  if (!value) return "development";
  const key = value.toLowerCase();
  if (key === "development" || key === "dev") return "development";
  if (key === "holdout" || key === "hold-out" || key === "hold out") return "holdout";
  errors.push(`Set “${value}” must be development or holdout.`);
  return null;
}

function parseRequirementCell(
  value: string,
  requirementByName: Map<string, string>,
  requirements: { id: string; title: string }[],
  errors: string[],
): { appliesToAll: boolean; requirementIds: string[] } | null {
  if (!value || value.toLowerCase() === "all" || value === "*") {
    return { appliesToAll: true, requirementIds: [] };
  }
  const names = value
    .split(/[;|]/)
    .map((name) => name.trim())
    .filter(Boolean);
  if (names.length === 0) return { appliesToAll: true, requirementIds: [] };
  const ids: string[] = [];
  const missing: string[] = [];
  for (const name of names) {
    const id = requirementByName.get(name.toLowerCase());
    if (!id) missing.push(name);
    else if (!ids.includes(id)) ids.push(id);
  }
  if (missing.length > 0) {
    errors.push(
      `Unknown requirement ${missing.length === 1 ? "name" : "names"}: ${missing.map((name) => `“${name}”`).join(", ")}.`,
    );
    return null;
  }
  if (requirements.length > 0 && ids.length === requirements.length) {
    return { appliesToAll: true, requirementIds: [] };
  }
  return { appliesToAll: false, requirementIds: ids };
}
