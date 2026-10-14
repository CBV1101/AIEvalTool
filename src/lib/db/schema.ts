import type { DatabaseSync } from "node:sqlite";

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    feature_summary TEXT NOT NULL,
    decision_note TEXT NOT NULL,
    min_pass_rate INTEGER NOT NULL,
    grader_provider TEXT NOT NULL DEFAULT 'openai',
    grader_model TEXT NOT NULL DEFAULT '',
    is_demo INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS requirements (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    details TEXT NOT NULL,
    pass_guidance TEXT NOT NULL DEFAULT '',
    fail_guidance TEXT NOT NULL DEFAULT '',
    critical INTEGER NOT NULL DEFAULT 0,
    priority TEXT NOT NULL,
    pass_percent INTEGER NOT NULL,
    check_type TEXT NOT NULL,
    check_config TEXT NOT NULL,
    position INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS scenarios (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    customer_input TEXT NOT NULL,
    situation TEXT NOT NULL,
    good_looks_like TEXT NOT NULL,
    reference_answer TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT 'normal',
    dataset TEXT NOT NULL DEFAULT 'development',
    applies_to_all INTEGER NOT NULL DEFAULT 1,
    position INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS scenario_requirements (
    scenario_id TEXT NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
    requirement_id TEXT NOT NULL REFERENCES requirements(id) ON DELETE CASCADE,
    PRIMARY KEY (scenario_id, requirement_id)
  )`,
  `CREATE TABLE IF NOT EXISTS reference_materials (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    kind TEXT NOT NULL,
    position INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS prompt_versions (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    change_notes TEXT NOT NULL,
    instructions TEXT NOT NULL,
    message_template TEXT NOT NULL,
    provider TEXT NOT NULL DEFAULT 'openai',
    model TEXT NOT NULL DEFAULT '',
    position INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS evaluation_runs (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    version_a_id TEXT NOT NULL,
    version_b_id TEXT NOT NULL,
    version_a_name TEXT NOT NULL,
    version_b_name TEXT NOT NULL,
    status TEXT NOT NULL,
    response_source TEXT NOT NULL,
    is_sample INTEGER NOT NULL DEFAULT 0,
    min_pass_rate INTEGER NOT NULL,
    setup_fingerprint TEXT NOT NULL DEFAULT '',
    dataset TEXT NOT NULL DEFAULT 'development',
    repetitions INTEGER NOT NULL DEFAULT 1,
    mode TEXT NOT NULL DEFAULT 'unset',
    cancel_requested INTEGER NOT NULL DEFAULT 0,
    snapshot_json TEXT NOT NULL DEFAULT '',
    grader_provider TEXT NOT NULL DEFAULT '',
    grader_model TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    graded_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS responses (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL REFERENCES evaluation_runs(id) ON DELETE CASCADE,
    scenario_id TEXT NOT NULL,
    version_id TEXT NOT NULL,
    repetition INTEGER NOT NULL DEFAULT 1,
    scenario_title TEXT NOT NULL,
    scenario_position INTEGER NOT NULL,
    customer_input TEXT NOT NULL,
    situation TEXT NOT NULL,
    good_looks_like TEXT NOT NULL,
    output_text TEXT NOT NULL,
    source TEXT NOT NULL,
    prompt_snapshot TEXT NOT NULL DEFAULT '',
    call_status TEXT NOT NULL DEFAULT 'recorded',
    latency_ms INTEGER,
    input_tokens INTEGER,
    output_tokens INTEGER,
    error_text TEXT NOT NULL DEFAULT '',
    provider TEXT NOT NULL DEFAULT '',
    model TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (run_id, scenario_id, version_id, repetition)
  )`,
  `CREATE TABLE IF NOT EXISTS grades (
    id TEXT PRIMARY KEY,
    response_id TEXT NOT NULL REFERENCES responses(id) ON DELETE CASCADE,
    requirement_id TEXT NOT NULL,
    requirement_title TEXT NOT NULL,
    requirement_position INTEGER NOT NULL,
    priority TEXT NOT NULL,
    pass_percent INTEGER NOT NULL,
    critical INTEGER NOT NULL DEFAULT 0,
    check_type TEXT NOT NULL,
    automatic_outcome TEXT NOT NULL,
    explanation TEXT NOT NULL,
    ai_verdict TEXT NOT NULL DEFAULT '',
    ai_explanation TEXT NOT NULL DEFAULT '',
    ai_evidence TEXT NOT NULL DEFAULT '',
    deterministic_outcome TEXT NOT NULL DEFAULT '',
    deterministic_explanation TEXT NOT NULL DEFAULT '',
    UNIQUE (response_id, requirement_id)
  )`,
  `CREATE TABLE IF NOT EXISTS human_reviews (
    id TEXT PRIMARY KEY,
    grade_id TEXT NOT NULL UNIQUE REFERENCES grades(id) ON DELETE CASCADE,
    decision TEXT NOT NULL,
    note TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_requirements_project ON requirements(project_id, position)`,
  `CREATE INDEX IF NOT EXISTS idx_scenarios_project ON scenarios(project_id, position)`,
  `CREATE INDEX IF NOT EXISTS idx_versions_project ON prompt_versions(project_id, position)`,
  `CREATE INDEX IF NOT EXISTS idx_runs_project ON evaluation_runs(project_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_responses_run ON responses(run_id)`,
  `CREATE INDEX IF NOT EXISTS idx_grades_response ON grades(response_id)`,
  `CREATE INDEX IF NOT EXISTS idx_materials_project ON reference_materials(project_id, position)`,
  `CREATE INDEX IF NOT EXISTS idx_scenario_requirements_requirement ON scenario_requirements(requirement_id)`,
];

export const SCHEMA_VERSION = 8;

const ADDED_COLUMNS: { table: string; column: string; definition: string }[] = [
  { table: "requirements", column: "pass_guidance", definition: "TEXT NOT NULL DEFAULT ''" },
  { table: "requirements", column: "fail_guidance", definition: "TEXT NOT NULL DEFAULT ''" },
  { table: "requirements", column: "critical", definition: "INTEGER NOT NULL DEFAULT 0" },
  { table: "scenarios", column: "reference_answer", definition: "TEXT NOT NULL DEFAULT ''" },
  { table: "scenarios", column: "category", definition: "TEXT NOT NULL DEFAULT 'normal'" },
  { table: "scenarios", column: "dataset", definition: "TEXT NOT NULL DEFAULT 'development'" },
  { table: "scenarios", column: "applies_to_all", definition: "INTEGER NOT NULL DEFAULT 1" },
  { table: "grades", column: "critical", definition: "INTEGER NOT NULL DEFAULT 0" },
  { table: "prompt_versions", column: "provider", definition: "TEXT NOT NULL DEFAULT 'openai'" },
  { table: "prompt_versions", column: "model", definition: "TEXT NOT NULL DEFAULT ''" },
  { table: "evaluation_runs", column: "dataset", definition: "TEXT NOT NULL DEFAULT 'development'" },
  { table: "evaluation_runs", column: "repetitions", definition: "INTEGER NOT NULL DEFAULT 1" },
  { table: "evaluation_runs", column: "mode", definition: "TEXT NOT NULL DEFAULT 'unset'" },
  { table: "evaluation_runs", column: "cancel_requested", definition: "INTEGER NOT NULL DEFAULT 0" },
  { table: "evaluation_runs", column: "snapshot_json", definition: "TEXT NOT NULL DEFAULT ''" },
  { table: "projects", column: "grader_provider", definition: "TEXT NOT NULL DEFAULT 'openai'" },
  { table: "projects", column: "grader_model", definition: "TEXT NOT NULL DEFAULT ''" },
  { table: "evaluation_runs", column: "grader_provider", definition: "TEXT NOT NULL DEFAULT ''" },
  { table: "evaluation_runs", column: "grader_model", definition: "TEXT NOT NULL DEFAULT ''" },
  { table: "grades", column: "ai_verdict", definition: "TEXT NOT NULL DEFAULT ''" },
  { table: "grades", column: "ai_explanation", definition: "TEXT NOT NULL DEFAULT ''" },
  { table: "grades", column: "ai_evidence", definition: "TEXT NOT NULL DEFAULT ''" },
  { table: "grades", column: "deterministic_outcome", definition: "TEXT NOT NULL DEFAULT ''" },
  { table: "grades", column: "deterministic_explanation", definition: "TEXT NOT NULL DEFAULT ''" },
];

function columnNames(db: DatabaseSync, table: string): Set<string> {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return new Set(rows.map((row) => row.name));
}

export function migrate(db: DatabaseSync): void {
  for (const statement of STATEMENTS) {
    db.exec(statement);
  }
  for (const column of ADDED_COLUMNS) {
    if (!columnNames(db, column.table).has(column.column)) {
      db.exec(`ALTER TABLE ${column.table} ADD COLUMN ${column.column} ${column.definition}`);
    }
  }
  ensureResponseShape(db);
}

function ensureResponseShape(db: DatabaseSync): void {
  const row = db
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'responses'")
    .get() as { sql: string } | undefined;
  if (!row || row.sql.includes("repetition")) return;
  db.exec("PRAGMA foreign_keys = OFF");
  try {
    db.exec("DROP TABLE IF EXISTS responses_next");
    db.exec(`CREATE TABLE responses_next (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL REFERENCES evaluation_runs(id) ON DELETE CASCADE,
      scenario_id TEXT NOT NULL,
      version_id TEXT NOT NULL,
      repetition INTEGER NOT NULL DEFAULT 1,
      scenario_title TEXT NOT NULL,
      scenario_position INTEGER NOT NULL,
      customer_input TEXT NOT NULL,
      situation TEXT NOT NULL,
      good_looks_like TEXT NOT NULL,
      output_text TEXT NOT NULL,
      source TEXT NOT NULL,
      prompt_snapshot TEXT NOT NULL DEFAULT '',
      call_status TEXT NOT NULL DEFAULT 'recorded',
      latency_ms INTEGER,
      input_tokens INTEGER,
      output_tokens INTEGER,
      error_text TEXT NOT NULL DEFAULT '',
      provider TEXT NOT NULL DEFAULT '',
      model TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE (run_id, scenario_id, version_id, repetition)
    )`);
    db.exec(`INSERT INTO responses_next (
      id, run_id, scenario_id, version_id, repetition, scenario_title, scenario_position,
      customer_input, situation, good_looks_like, output_text, source, prompt_snapshot,
      call_status, error_text, provider, model, created_at, updated_at
    )
    SELECT
      id, run_id, scenario_id, version_id, 1, scenario_title, scenario_position,
      customer_input, situation, good_looks_like, output_text, source, prompt_snapshot,
      'recorded', '', '', '', created_at, updated_at
    FROM responses`);
    db.exec("DROP TABLE responses");
    db.exec("ALTER TABLE responses_next RENAME TO responses");
    db.exec("CREATE INDEX IF NOT EXISTS idx_responses_run ON responses(run_id)");
  } finally {
    db.exec("PRAGMA foreign_keys = ON");
  }
}
