import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { SCHEMA_VERSION, migrate } from "@/lib/db/schema";
import { ensureDemo } from "@/lib/db/seed";

const globalDatabase = globalThis as unknown as {
  evaluatorDb?: DatabaseSync;
  evaluatorSchema?: number;
};

export function resolveDbPath(): string {
  return process.env.EVAL_DB_PATH ?? path.join(process.cwd(), "data", "evaluator.sqlite");
}

export function openDatabase(filename: string): DatabaseSync {
  if (filename !== ":memory:") {
    mkdirSync(path.dirname(filename), { recursive: true });
  }
  const db = new DatabaseSync(filename, { enableForeignKeyConstraints: true });
  db.exec("PRAGMA foreign_keys = ON");
  if (filename !== ":memory:") {
    db.exec("PRAGMA journal_mode = WAL");
  }
  migrate(db);
  return db;
}

export function ensureReady(): DatabaseSync {
  if (!globalDatabase.evaluatorDb) {
    globalDatabase.evaluatorDb = openDatabase(resolveDbPath());
  }
  if (globalDatabase.evaluatorSchema !== SCHEMA_VERSION) {
    migrate(globalDatabase.evaluatorDb);
    ensureDemo(globalDatabase.evaluatorDb);
    globalDatabase.evaluatorSchema = SCHEMA_VERSION;
  }
  return globalDatabase.evaluatorDb;
}
