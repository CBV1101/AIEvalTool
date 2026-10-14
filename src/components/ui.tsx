import Link from "next/link";
import type { Priority } from "@/lib/types";
import { priorityLabel } from "@/lib/labels";

export function Brand() {
  return (
    <Link href="/" className="brand">
      <svg className="mark-svg" viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill="currentColor" />
        <path
          d="M8 16.5 12.2 20.8 24 9.8"
          fill="none"
          stroke="#fffaf3"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span>
        <span className="brand-name">AI Feature Evaluator</span>
        <span className="brand-tag">For product managers</span>
      </span>
    </Link>
  );
}

export function Notice({
  notice,
  error,
}: {
  notice?: string | null;
  error?: string | null;
}) {
  if (!notice && !error) return null;
  return (
    <div className="stack">
      {error ? (
        <p role="alert" className="banner-bad">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="banner banner-ok">
          {notice}
        </p>
      ) : null}
    </div>
  );
}

export function Pill({
  tone,
  children,
}: {
  tone?: "blocker" | "important" | "helpful" | "pass" | "fail" | "wait" | "sample";
  children: React.ReactNode;
}) {
  return <span className={tone ? `pill pill-${tone}` : "pill"}>{children}</span>;
}

export function PriorityPill({ priority }: { priority: Priority }) {
  return <Pill tone={priority}>{priorityLabel(priority)}</Pill>;
}

export function EmptyState({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="panel stack">
      <h3>{title}</h3>
      <div className="lede">{children}</div>
    </div>
  );
}

export function AppLoading({ label }: { label: string }) {
  return (
    <div className="page">
      <Brand />
      <p className="loading" role="status">
        Loading {label}…
      </p>
    </div>
  );
}
