import { io } from "next/cache";
import { ensureReady } from "@/lib/db/connection";
import type { DatabaseSync } from "node:sqlite";

export async function getDatabase(): Promise<DatabaseSync> {
  await io();
  return ensureReady();
}
