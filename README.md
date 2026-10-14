# AI Feature Evaluator

A local web app for a product manager who needs to evaluate a text-based AI feature before deciding whether a prompt change is ready.

You define what a good reply looks like, add realistic scenarios, compare two prompt versions, review the failures, and check each version against a release bar. The comparison keeps requirement-level trade-offs visible, so a more helpful prompt cannot hide a policy miss behind one overall score.

This is a single-user tool. It has no accounts, billing, or team management. Evaluations stay in a SQLite database on your computer.

## Setup and API configuration

Use Node.js 22.13 or newer (Node.js 24 is a good fit). The app uses Node’s built-in `node:sqlite` library.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

```bash
npm run build
npm start
```

Copy `.env.example` to `.env.local` when you want live provider calls.

```bash
OPENAI_API_KEY=your-openai-key
ANTHROPIC_API_KEY=your-anthropic-key
```

Set only the providers you use. On Test setup, each prompt version has a provider and a model identifier you type in. The app does not choose a model name for you. The same keys are used for prompt runs and for the separate grader model. Optional base URLs, concurrency, Anthropic output length, and pricing are documented in `.env.example`.

Restart the app after changing the file. Keys stay in the server environment. They are not written into SQLite and they are not included in browser code.

To show an estimated cost, set `EVAL_MODEL_PRICING` to a JSON map of the exact model identifier you entered. If that identifier is not in the map, the run shows “Cost unavailable.”

SQLite file: `data/evaluator.sqlite`. That folder is gitignored. Delete the file and restart the app to reset everything, including the demo. Point at another file with `EVAL_DB_PATH`.

## How grading and release decisions work

A review has five steps.

1. Define what good looks like. A requirement is a promise the feature must keep, with pass and fail guidance, a minimum pass rate, and a critical flag when any single failure should block release.
2. Add realistic scenarios. Each scenario is one user input, with conversation context, expected behavior, a category, and a development or holdout set. Add them by hand or import a CSV. The preview lists invalid rows and does not import them.
3. Compare versions. A prompt version is a name, system instructions, a provider, and a model identifier. A run sends the same user input, conversation context, and reference material to both versions.
4. Review failures. Filter by version, requirement, category, and verdict. A human decision replaces the score for that requirement and keeps the original judgment.
5. Check release criteria. Each version gets one status for this test set.

A run stores a snapshot of the scenarios, requirements, reference material, prompts, and model settings. Later edits do not change that run’s results. A human review updates the scores on the next load and leaves the snapshot unchanged.

Grading is a separate call. You choose a grader provider and type a grader model identifier. The grader receives the scenario, the expected behavior, the reference material, the requirement guidance, and the reply. It returns pass, fail, or needs review, a short explanation, and a quote from the reply when it has one. Those results are labeled AI judgments. The app does not treat a model’s self-reported confidence as calibrated certainty. The scenario, the reference material, and the reply are untrusted text, and the grader is told not to follow instructions inside them.

A missing reply, a provider error, a cancelled call, or a grading result the app cannot validate is needs review. It never counts as a pass. A requirement can also use an optional deterministic check: required text, forbidden text, or valid JSON. A failed deterministic check fails that requirement even when the AI verdict is pass. The AI verdict is still stored.

The release score uses a human verdict when someone has saved one, and the automatic result otherwise. The automatic result is a deterministic failure when that check failed, otherwise the AI verdict. Needs-review results are excluded from the pass-rate denominator and block a definitive release pass. Unreviewed human-only checks are also excluded from the pass rate. A helpful requirement that is still unreviewed does not block release by itself.

A version meets the configured criteria when:

- its overall pass rate is at least the project bar, and
- every blocker, important, and critical requirement meets its own bar, and
- no scored check is still needs review, and
- the run has no execution errors.

A critical requirement blocks release when any linked scenario fails, even if its pass rate would otherwise be met. Helpful requirements are reported and count toward the pass rate, but they do not veto release on their own.

The status is one of:

- Meets configured criteria
- Does not meet configured criteria
- Incomplete: review or execution required

The comparison names the requirements that drive the status. It also shows pass rate for each requirement, passed checks divided by eligible checks, critical failures, unresolved reviews, execution errors, latency, token use, estimated cost when pricing is configured, and the share of checks a person has reviewed. When a run uses more than one repetition, it lists scenarios whose verdicts disagree.

This reflects the configured test set. It is not a guarantee of production performance.

## Demo versus real evaluation

The home page includes a demo project, **Customer-support assistant**. Its shipped comparison is **sample data**. Those replies were written for the walkthrough. They are not from a live model, and they are not a measurement or a release decision for a real feature.

The sample story is a trade-off. The warmer prompt acknowledges the customer and offers a next step more often. It also promises a refund the policy does not allow on more scenarios than the shorter prompt. The shorter prompt is stricter about refunds and less helpful. Both versions fail the configured release bar, for different requirements. Length is reported as a helpful watch item. Use the requirement rows, not one overall score.

Sample results stay on that demo run. The demo setup is locked so the sample story stays intact. Copy the demo if you want an editable project without the sample run. An evaluation you start yourself is stored separately.

When a provider key is missing, Version comparison offers **demo mode**. Demo mode writes placeholder replies, does not call a provider or the grader, and labels the run so it is not a measurement. Latency, tokens, and cost stay unmeasured.

A real evaluation uses the keys in `.env.local`, the model identifier you entered, and the grader model you configured. Replies, latency, and provider-reported tokens are saved. Cost is estimated only when `EVAL_MODEL_PRICING` includes that model identifier.

## Limitations and future improvements

- One person, one local database. There are no accounts, shared projects, or hosted deployments in this version.
- Release status describes the scenarios and requirements you configured. It does not estimate production traffic or customer outcomes.
- AI verdicts are judgments from the grader model you chose. They are not a calibrated confidence score.
- Estimated cost requires a price you enter for the exact model identifier. Otherwise the app says “Cost unavailable.”
- A long-running evaluation lives in the server process that started it. Restarting the app stops that run.
- The sample comparison and demo mode are labeled fixtures. They are not evidence of adoption or of a business result.

Possible later work: accounts and shared review, a hosted database, more than two versions in one comparison, and a way to schedule a holdout run after prompt edits.

## Checks

```bash
npm test
npm run typecheck
npm run build
```
