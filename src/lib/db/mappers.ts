import type {
  CallStatus,
  CheckConfig,
  CheckType,
  Decision,
  EvaluationRun,
  GradeRecord,
  Outcome,
  Priority,
  Project,
  PromptVersion,
  RunMode,
  ReferenceKind,
  ReferenceMaterial,
  Requirement,
  ResponseRecord,
  ResponseSource,
  ReviewRecord,
  RunSource,
  RunStatus,
  Scenario,
  ScenarioCategory,
  ScenarioSet,
} from "@/lib/types";

type ProjectRow = {
  id: string;
  name: string;
  feature_summary: string;
  decision_note: string;
  min_pass_rate: number;
  grader_provider?: string;
  grader_model?: string;
  is_demo: number;
  created_at: string;
  updated_at: string;
};

type RequirementRow = {
  id: string;
  project_id: string;
  title: string;
  details: string;
  pass_guidance: string;
  fail_guidance: string;
  critical: number;
  priority: string;
  pass_percent: number;
  check_type: string;
  check_config: string;
  position: number;
  created_at: string;
  updated_at: string;
};

type ScenarioRow = {
  id: string;
  project_id: string;
  title: string;
  customer_input: string;
  situation: string;
  good_looks_like: string;
  reference_answer: string;
  category: string;
  dataset: string;
  applies_to_all: number;
  position: number;
  created_at: string;
  updated_at: string;
};

type MaterialRow = {
  id: string;
  project_id: string;
  title: string;
  body: string;
  kind: string;
  position: number;
  created_at: string;
  updated_at: string;
};

type VersionRow = {
  id: string;
  project_id: string;
  name: string;
  change_notes: string;
  instructions: string;
  message_template: string;
  provider: string;
  model: string;
  position: number;
  created_at: string;
  updated_at: string;
};

type RunRow = {
  id: string;
  project_id: string;
  name: string;
  version_a_id: string;
  version_b_id: string;
  version_a_name: string;
  version_b_name: string;
  status: string;
  response_source: string;
  is_sample: number;
  min_pass_rate: number;
  setup_fingerprint: string;
  dataset: string;
  repetitions: number;
  mode: string;
  cancel_requested: number;
  snapshot_json: string;
  grader_provider?: string;
  grader_model?: string;
  created_at: string;
  graded_at: string | null;
};

type ResponseRow = {
  id: string;
  run_id: string;
  scenario_id: string;
  version_id: string;
  scenario_title: string;
  scenario_position: number;
  customer_input: string;
  situation: string;
  good_looks_like: string;
  output_text: string;
  source: string;
  prompt_snapshot: string;
  repetition: number;
  call_status: string;
  latency_ms: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  error_text: string;
  provider: string;
  model: string;
  created_at: string;
  updated_at: string;
};

type GradeRow = {
  id: string;
  response_id: string;
  requirement_id: string;
  requirement_title: string;
  requirement_position: number;
  priority: string;
  pass_percent: number;
  critical: number;
  check_type: string;
  automatic_outcome: string;
  explanation: string;
  ai_verdict?: string;
  ai_explanation?: string;
  ai_evidence?: string;
  deterministic_outcome?: string;
  deterministic_explanation?: string;
};

type ReviewRow = {
  id: string;
  grade_id: string;
  decision: string;
  note: string;
  created_at: string;
  updated_at: string;
};

export function parseConfig(value: string): CheckConfig {
  const parsed = JSON.parse(value) as Partial<CheckConfig>;
  return {
    phrases: Array.isArray(parsed.phrases) ? parsed.phrases.filter((item) => typeof item === "string") : [],
    minWords: typeof parsed.minWords === "number" ? parsed.minWords : null,
    maxWords: typeof parsed.maxWords === "number" ? parsed.maxWords : null,
  };
}

export function mapProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    featureSummary: row.feature_summary,
    decisionNote: row.decision_note,
    minPassRate: row.min_pass_rate,
    graderProvider: row.grader_provider === "anthropic" ? "anthropic" : "openai",
    graderModel: row.grader_model ?? "",
    isDemo: row.is_demo === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapRequirement(row: RequirementRow): Requirement {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    details: row.details,
    passGuidance: row.pass_guidance ?? "",
    failGuidance: row.fail_guidance ?? "",
    critical: row.critical === 1,
    priority: row.priority as Priority,
    passPercent: row.pass_percent,
    checkType: row.check_type as CheckType,
    checkConfig: parseConfig(row.check_config),
    position: row.position,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapScenario(row: ScenarioRow): Scenario {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    customerInput: row.customer_input,
    situation: row.situation,
    goodLooksLike: row.good_looks_like,
    referenceAnswer: row.reference_answer ?? "",
    category: (row.category === "edge" || row.category === "adversarial" ? row.category : "normal") as ScenarioCategory,
    dataset: (row.dataset === "holdout" ? "holdout" : "development") as ScenarioSet,
    appliesToAll: row.applies_to_all !== 0,
    requirementIds: [],
    position: row.position,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapMaterial(row: MaterialRow): ReferenceMaterial {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    body: row.body,
    kind: (row.kind === "documentation" ? "documentation" : "policy") as ReferenceKind,
    position: row.position,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapVersion(row: VersionRow): PromptVersion {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    changeNotes: row.change_notes,
    instructions: row.instructions,
    messageTemplate: row.message_template,
    provider: row.provider === "anthropic" ? "anthropic" : "openai", // older rows without a provider stay OpenAI
    model: row.model ?? "",
    position: row.position,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapRun(row: RunRow): EvaluationRun {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    versionAId: row.version_a_id,
    versionBId: row.version_b_id,
    versionAName: row.version_a_name,
    versionBName: row.version_b_name,
    status: row.status as RunStatus,
    responseSource: row.response_source as RunSource,
    isSample: row.is_sample === 1,
    minPassRate: row.min_pass_rate,
    setupFingerprint: row.setup_fingerprint,
    dataset: row.dataset === "holdout" ? "holdout" : "development",
    repetitions: row.repetitions ?? 1,
    mode: (row.mode === "live" || row.mode === "demo" ? row.mode : "unset") as RunMode,
    cancelRequested: row.cancel_requested === 1,
    snapshotJson: row.snapshot_json ?? "",
    graderProvider: row.grader_provider === "anthropic" ? "anthropic" : "openai",
    graderModel: row.grader_model ?? "",
    createdAt: row.created_at,
    gradedAt: row.graded_at,
  };
}

export function mapResponse(row: ResponseRow): ResponseRecord {
  return {
    id: row.id,
    runId: row.run_id,
    scenarioId: row.scenario_id,
    versionId: row.version_id,
    scenarioTitle: row.scenario_title,
    scenarioPosition: row.scenario_position,
    customerInput: row.customer_input,
    situation: row.situation,
    goodLooksLike: row.good_looks_like,
    outputText: row.output_text,
    source: row.source as ResponseSource,
    promptSnapshot: row.prompt_snapshot,
    repetition: row.repetition ?? 1,
    callStatus: callStatus(row.call_status),
    latencyMs: row.latency_ms ?? null,
    inputTokens: row.input_tokens ?? null,
    outputTokens: row.output_tokens ?? null,
    errorText: row.error_text ?? "",
    provider: row.provider ?? "",
    model: row.model ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function callStatus(value: string | undefined): CallStatus {
  if (
    value === "pending" ||
    value === "running" ||
    value === "succeeded" ||
    value === "failed" ||
    value === "cancelled" ||
    value === "recorded"
  ) {
    return value;
  }
  return "recorded";
}

export function mapGrade(row: GradeRow): GradeRecord {
  return {
    id: row.id,
    responseId: row.response_id,
    requirementId: row.requirement_id,
    requirementTitle: row.requirement_title,
    requirementPosition: row.requirement_position,
    priority: row.priority as Priority,
    passPercent: row.pass_percent,
    critical: row.critical === 1,
    checkType: row.check_type as CheckType,
    automaticOutcome: row.automatic_outcome as Outcome,
    explanation: row.explanation,
    aiVerdict: verdictOrEmpty(row.ai_verdict),
    aiExplanation: row.ai_explanation ?? "",
    aiEvidence: row.ai_evidence ?? "",
    deterministicOutcome: verdictOrEmpty(row.deterministic_outcome),
    deterministicExplanation: row.deterministic_explanation ?? "",
  };
}

function verdictOrEmpty(value: string | undefined): Outcome | "" {
  if (value === "pass" || value === "fail" || value === "unreviewed" || value === "needs_review") {
    return value;
  }
  return "";
}

export function mapReview(row: ReviewRow): ReviewRecord {
  return {
    id: row.id,
    gradeId: row.grade_id,
    decision: row.decision as Decision,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
