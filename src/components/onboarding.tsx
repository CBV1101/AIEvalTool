import Link from "next/link";

export type OnboardingStep = {
  title: string;
  body: string;
  href?: string;
  linkLabel?: string;
};

export function Onboarding({
  steps,
  heading = "How to evaluate a feature",
}: {
  steps: OnboardingStep[];
  heading?: string;
}) {
  return (
    <section className="panel stack" aria-labelledby="onboarding-heading">
      <h2 id="onboarding-heading">{heading}</h2>
      <p className="lede">
        Five steps. Each one stays visible in the results, so a warmer reply cannot hide a policy miss.
      </p>
      <ol className="steps onboarding">
        {steps.map((step, index) => (
          <li key={step.title}>
            <p>
              <strong>
                {index + 1}. {step.title}
              </strong>
            </p>
            <p>{step.body}</p>
            {step.href && step.linkLabel ? <Link href={step.href}>{step.linkLabel}</Link> : null}
          </li>
        ))}
      </ol>
    </section>
  );
}

export function homeOnboarding(demoProjectId: string | null, demoRunId: string): OnboardingStep[] {
  return [
    {
      title: "Define what good looks like.",
      body: "Write each requirement in product language, with what a pass and a fail look like, and the release bar for this feature.",
      href: "/projects/new",
      linkLabel: "Start a project",
    },
    {
      title: "Add realistic scenarios.",
      body: "Use the messages customers actually send, plus the behavior you expect. Import a CSV when you already have a list.",
      href: "/projects/new",
      linkLabel: "Add scenarios after you create a project",
    },
    {
      title: "Compare versions.",
      body: "Send the same scenarios to two prompt versions. The comparison keeps pass rates, failures, and cost on separate rows.",
      href: demoProjectId ? `/projects/${demoProjectId}/compare/${demoRunId}` : "/projects/new",
      linkLabel: demoProjectId ? "Open the sample comparison" : "Create a project to compare versions",
    },
    {
      title: "Review failures.",
      body: "Read the scenario, the expected behavior, and both replies. A human decision replaces the score for that requirement and keeps the original judgment.",
      href: demoProjectId ? `/projects/${demoProjectId}/failures?run=${demoRunId}` : "/projects/new",
      linkLabel: demoProjectId ? "Review the sample failures" : "Create a project to review failures",
    },
    {
      title: "Check release criteria.",
      body: "Each version gets one status: meets the configured criteria, does not meet them, or is incomplete because review or execution is still required. That status is for this test set, not a guarantee of production performance.",
      href: demoProjectId ? `/projects/${demoProjectId}/compare/${demoRunId}` : "/projects/new",
      linkLabel: demoProjectId ? "See the sample release status" : "Create a project to set a release bar",
    },
  ];
}

export function projectOnboarding(projectId: string): OnboardingStep[] {
  return [
    {
      title: "Define what good looks like.",
      body: "Add requirements below, with pass and fail guidance. Mark a requirement critical when any single failure should block release.",
      href: `/projects/${projectId}/setup#requirements`,
      linkLabel: "Go to requirements",
    },
    {
      title: "Add realistic scenarios.",
      body: "Add the customer messages this feature should handle, or import a CSV. Holdout scenarios stay out of tuning until you want an honest check.",
      href: `/projects/${projectId}/setup#scenarios`,
      linkLabel: "Go to scenarios",
    },
    {
      title: "Compare versions.",
      body: "Configure two prompts, then run them on the same scenarios. Paste replies when you do not have a provider key.",
      href: `/projects/${projectId}/compare`,
      linkLabel: "Open version comparison",
    },
    {
      title: "Review failures.",
      body: "Filter by version, requirement, category, and verdict. Override a single requirement when the automatic result is wrong.",
      href: `/projects/${projectId}/failures`,
      linkLabel: "Open failure review",
    },
    {
      title: "Check release criteria.",
      body: "Read the status for each version and the requirements that drive it. Helpful requirements stay visible even when they do not block release.",
      href: `/projects/${projectId}/compare`,
      linkLabel: "Check the latest comparison",
    },
  ];
}
