import Link from "next/link";
import { createProject } from "@/lib/actions/projects";
import { ProjectForm } from "@/components/entity-forms";
import { homeOnboarding, Onboarding } from "@/components/onboarding";
import { Brand } from "@/components/ui";

export const metadata = { title: "New project" };

export default function NewProjectPage() {
  return (
    <div className="page stack-lg">
      <Brand />
      <main id="main" className="stack">
        <p>
          <Link href="/">All projects</Link>
        </p>
        <h1>New evaluation project</h1>
        <p className="lede">
          Name the text feature and set the release bar. Requirements, scenarios, and two prompt
          versions come next.
        </p>
        <Onboarding
          heading="What you will do next"
          steps={homeOnboarding(null, "").map((step) => ({ title: step.title, body: step.body }))}
        />
        <div className="panel">
          <ProjectForm action={createProject} submitLabel="Create project" />
        </div>
      </main>
    </div>
  );
}
