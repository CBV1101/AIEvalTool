import assert from "node:assert/strict";
import test from "node:test";
import { completeAnthropic } from "@/lib/providers/anthropic";
import { completeOpenAI } from "@/lib/providers/openai";
import { costLabel, estimateCostUsd, readModelPricing } from "@/lib/providers/pricing";

const signal = new AbortController().signal;

test("provider errors do not include the API key", async () => {
  const secret = "sk-test-secret-value";
  const result = await completeOpenAI({
    apiKey: secret,
    baseUrl: "https://example.test/v1",
    model: "entered-model",
    system: "Be brief.",
    user: "Hello",
    signal,
    fetchImpl: async () =>
      new Response(JSON.stringify({ error: { message: `bad key ${secret}` } }), { status: 401 }),
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.retryable, false);
  assert.equal(result.message.includes(secret), false);
  assert.match(result.message, /\[redacted\]/);
});

test("a retryable provider status is marked retryable and usage is not invented", async () => {
  const result = await completeAnthropic({
    apiKey: "anthropic-secret",
    baseUrl: "https://example.test",
    model: "entered-model",
    system: "Be brief.",
    user: "Hello",
    signal,
    fetchImpl: async () => new Response("overloaded", { status: 529 }),
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.retryable, true);
  assert.equal(result.message.includes("anthropic-secret"), false);
});

test("a successful call keeps provider-reported token counts", async () => {
  const result = await completeOpenAI({
    apiKey: "secret",
    baseUrl: "https://example.test/v1",
    model: "entered-model",
    system: "Be brief.",
    user: "Hello",
    signal,
    fetchImpl: async (_input, init) => {
      const body = JSON.parse(String(init?.body)) as { model?: string };
      assert.equal(body.model, "entered-model");
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: "A saved reply." } }],
          usage: { prompt_tokens: 11, completion_tokens: 4 },
        }),
        { status: 200 },
      );
    },
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.text, "A saved reply.");
  assert.equal(result.inputTokens, 11);
  assert.equal(result.outputTokens, 4);
  assert.equal(typeof result.latencyMs, "number");
});

test("an empty model reply is an error", async () => {
  const result = await completeAnthropic({
    apiKey: "secret",
    baseUrl: "https://example.test",
    model: "entered-model",
    system: "Be brief.",
    user: "Hello",
    signal,
    fetchImpl: async () =>
      new Response(JSON.stringify({ content: [{ type: "text", text: "   " }], usage: {} }), {
        status: 200,
      }),
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.message, /empty reply/);
});

test("cost stays unavailable until pricing is configured for that model identifier", () => {
  assert.equal(estimateCostUsd("entered-model", 1000, 1000, {}), null);
  assert.equal(costLabel("entered-model", 1000, 1000, {}), "Cost unavailable.");
  assert.equal(costLabel("entered-model", null, 10, { "entered-model": { inputPerMillion: 2, outputPerMillion: 8 } }), "Cost unavailable.");
  const prices = readModelPricing('{"entered-model":{"inputPerMillion":2,"outputPerMillion":8}}');
  assert.equal(estimateCostUsd("entered-model", 1_000_000, 500_000, prices), 6);
  assert.equal(costLabel("entered-model", 1_000_000, 500_000, prices), "Estimated cost $6.0000");
  assert.equal(readModelPricing("not json")["entered-model"], undefined);
});
