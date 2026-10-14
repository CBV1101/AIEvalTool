import { firstParam } from "@/lib/eval/text";

const NOTICES: Record<string, string> = {
  saved: "Saved.",
  graded: "Graded. Compare the versions, then review anything that failed.",
  deleted: "Deleted.",
  copied:
    "Copied into a new project. Sample results were not copied, so anything you grade here is yours.",
  reset: "Sample review decisions are restored.",
  generated: "Replies are in the boxes below. Read them, then grade.",
  "replies-saved": "Replies saved. Grade them when you are ready.",
};

const ERRORS: Record<string, string> = {
  "demo-locked":
    "The demo project is locked so the sample story stays intact. Copy it to change the setup.",
  "in-use":
    "This is already part of an evaluation. Keep it so those results stay readable, or delete the evaluation first.",
  "sample-locked":
    "The sample evaluation stays in the demo so you can come back to it.",
  "missing-replies": "Add a reply for every scenario and version before grading.",
  "not-found": "That item could not be found.",
  confirm: "Check the confirmation box to delete the project.",
};

export function noticeText(
  value: string | string[] | undefined,
): string | null {
  const key = firstParam(value);
  if (!key) return null;
  return NOTICES[key] ?? null;
}

export function errorText(value: string | string[] | undefined): string | null {
  const key = firstParam(value);
  if (!key) return null;
  return ERRORS[key] ?? null;
}
