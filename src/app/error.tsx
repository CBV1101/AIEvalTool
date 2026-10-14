"use client";

import Link from "next/link";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="page stack">
      <main id="main" className="stack">
        <h1>This page could not be loaded</h1>
        <p role="alert">Your evaluations are still in the local database.</p>
        <div className="btn-row">
          <button className="btn btn-primary" type="button" onClick={() => reset()}>
            Try again
          </button>
          <Link className="btn" href="/">
            Back to projects
          </Link>
        </div>
      </main>
    </div>
  );
}
