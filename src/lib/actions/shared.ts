import { revalidatePath } from "next/cache";

export function refreshProject(projectId?: string): void {
  revalidatePath("/");
  if (projectId) revalidatePath(`/projects/${projectId}`, "layout");
}

export function safeReturn(projectId: string, value: string): string {
  const prefix = `/projects/${projectId}/`;
  if (value.startsWith(prefix) && !value.includes("://") && !value.startsWith("//")) {
    return value;
  }
  return `/projects/${projectId}/failures`;
}

export function nowIso(): string {
  return new Date().toISOString();
}
