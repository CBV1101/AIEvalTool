import type { DatabaseSync } from "node:sqlite";

export type SqlParam = string | number | bigint | null;

export function all<T>(db: DatabaseSync, sql: string, params: SqlParam[] = []): T[] {
  return db.prepare(sql).all(...params) as T[];
}

export function get<T>(db: DatabaseSync, sql: string, params: SqlParam[] = []): T | undefined {
  return db.prepare(sql).get(...params) as T | undefined;
}

export function run(db: DatabaseSync, sql: string, params: SqlParam[] = []): void {
  db.prepare(sql).run(...params);
}

export function transaction<T>(db: DatabaseSync, fn: () => T): T {
  db.exec("BEGIN");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
