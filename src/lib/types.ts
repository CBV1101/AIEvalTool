export type Priority = "blocker" | "important" | "helpful";

export type ScenarioCategory = "normal" | "edge" | "adversarial";

export type ScenarioSet = "development" | "holdout";

export type ReferenceKind = "policy" | "documentation";

export type CheckType =
  | "must_include_any"
  | "must_include_all"
  | "must_not_include"
  | "word_count"
  | "human_only"
  | "required_text"
  | "forbidden_text"
  | "valid_json";

export type Outcome = "pass" | "fail" | "unreviewed" | "needs_review";

export type Decision = "pass" | "fail";

export type ProviderId = "openai" | "anthropic";

export type RunStatus = "draft" | "running" | "ready" | "cancelled" | "graded";

export type RunMode = "unset" | "live" | "demo";

export type CallStatus = "pending" | "running" | "succeeded" | "failed" | "cancelled" | "recorded";

export type ResponseSource = "sample" | "pasted" | "model" | "empty" | "demo";

export type RunSource = "sample" | "pasted" | "model" | "mixed" | "unset" | "demo";

export type CheckConfig = {
  phrases: string[];
  minWords: number | null;
  maxWords: number | null;
};

export type ActionState = {
  error?: string;
};

export type Project = {
  id: string;
  name: string;
  featureSummary: string;
  decisionNote: string;
  minPassRate: number;
  graderProvider: ProviderId;
  graderModel: string;
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Requirement = {
  id: string;
  projectId: string;
  title: string;
  details: string;
  passGuidance: string;
  failGuidance: string;
  critical: boolean;
  priority: Priority;
  passPercent: number;
  checkType: CheckType;
  checkConfig: CheckConfig;
  position: number;
  createdAt: string;
  updatedAt: string;
};

export type Scenario = {
  id: string;
  projectId: string;
  title: string;
  customerInput: string;
  situation: string;
  goodLooksLike: string;
  referenceAnswer: string;
  category: ScenarioCategory;
  dataset: ScenarioSet;
  appliesToAll: boolean;
  requirementIds: string[];
  position: number;
  createdAt: string;
  updatedAt: string;
};

export type ReferenceMaterial = {
  id: string;
  projectId: string;
  title: string;
  body: string;
  kind: ReferenceKind;
  position: number;
  createdAt: string;
  updatedAt: string;
};

export type PromptVersion = {
  id: string;
  projectId: string;
  name: string;
  changeNotes: string;
  instructions: string;
  messageTemplate: string;
  provider: ProviderId;
  model: string;
  position: number;
  createdAt: string;
  updatedAt: string;
};

export type EvaluationRun = {
  id: string;
  projectId: string;
  name: string;
  versionAId: string;
  versionBId: string;
  versionAName: string;
  versionBName: string;
  status: RunStatus;
  responseSource: RunSource;
  isSample: boolean;
  minPassRate: number;
  setupFingerprint: string;
  dataset: ScenarioSet;
  repetitions: number;
  mode: RunMode;
  cancelRequested: boolean;
  snapshotJson: string;
  graderProvider: ProviderId;
  graderModel: string;
  createdAt: string;
  gradedAt: string | null;
};

export type ResponseRecord = {
  id: string;
  runId: string;
  scenarioId: string;
  versionId: string;
  scenarioTitle: string;
  scenarioPosition: number;
  customerInput: string;
  situation: string;
  goodLooksLike: string;
  outputText: string;
  source: ResponseSource;
  promptSnapshot: string;
  repetition: number;
  callStatus: CallStatus;
  latencyMs: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  errorText: string;
  provider: string;
  model: string;
  createdAt: string;
  updatedAt: string;
};

export type GradeRecord = {
  id: string;
  responseId: string;
  requirementId: string;
  requirementTitle: string;
  requirementPosition: number;
  priority: Priority;
  passPercent: number;
  critical: boolean;
  checkType: CheckType;
  automaticOutcome: Outcome;
  explanation: string;
  aiVerdict: Outcome | "";
  aiExplanation: string;
  aiEvidence: string;
  deterministicOutcome: Outcome | "";
  deterministicExplanation: string;
};

export type ReviewRecord = {
  id: string;
  gradeId: string;
  decision: Decision;
  note: string;
  createdAt: string;
  updatedAt: string;
};

export function emptyCheckConfig(): CheckConfig {
  return { phrases: [], minWords: null, maxWords: null };
}
