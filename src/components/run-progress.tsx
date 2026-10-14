"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Progress = {
  status: string;
  total: number;
  finished: number;
  pending: number;
  running: number;
  succeeded: number;
  failed: number;
  cancelled: number;
};

export function RunProgress({
  projectId,
  runId,
}: {
  projectId: string;
  runId: string;
}) {
  const router = useRouter();
  const refreshed = useRef(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let stopped = false;
    async function poll() {
      try {
        const response = await fetch(`/api/runs/${runId}?projectId=${encodeURIComponent(projectId)}`, {
          cache: "no-store",
        });
        if (!response.ok) {
          if (!stopped) setError("Progress could not be loaded.");
          return;
        }
        const body = (await response.json()) as Progress;
        if (stopped) return;
        setProgress(body);
        if (body.status !== "running" && !refreshed.current) {
          refreshed.current = true;
          router.refresh();
        }
      } catch {
        if (!stopped) setError("Progress could not be loaded.");
      }
    }
    void poll();
    const timer = setInterval(() => void poll(), 1000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [projectId, runId, router]);

  const total = progress?.total ?? 0;
  const finished = progress?.finished ?? 0;
  const percent = total === 0 ? 0 : Math.round((finished / total) * 100);

  async function cancel() {
    setCancelling(true);
    setError("");
    try {
      const response = await fetch(`/api/runs/${runId}?projectId=${encodeURIComponent(projectId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent: "cancel" }),
      });
      if (!response.ok) setError("The run could not be cancelled.");
    } catch {
      setError("The run could not be cancelled.");
    } finally {
      setCancelling(false);
    }
  }

  return (
    <section className="panel stack" aria-live="polite">
      <h2>Running evaluation</h2>
      <p>
        {finished} of {total} calls finished.
        {progress ? ` ${progress.succeeded} saved, ${progress.failed} failed, ${progress.running} in flight.` : ""}
      </p>
      <div className="progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={finished}>
        <div className="progress-fill" style={{ width: `${percent}%` }} />
      </div>
      {error ? <p className="banner-bad">{error}</p> : null}
      <div>
        <button className="btn btn-danger" type="button" onClick={() => void cancel()} disabled={cancelling}>
          {cancelling ? "Cancelling…" : "Cancel run"}
        </button>
      </div>
    </section>
  );
}
