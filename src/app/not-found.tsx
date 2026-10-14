import Link from "next/link";
import { Brand } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="page stack">
      <Brand />
      <main id="main" className="stack">
        <h1>That page is not here</h1>
        <p>The project or evaluation may have been deleted.</p>
        <Link className="btn btn-primary" href="/">
          Back to projects
        </Link>
      </main>
    </div>
  );
}
