import assert from "node:assert/strict";
import test from "node:test";
import { parseScenarioCsv, SCENARIO_CSV_TEMPLATE } from "@/lib/scenarios/csv";

const requirements = [
  { id: "policy", title: "Follows refund policy" },
  { id: "scope", title: "Stays in scope" },
];

test("template rows are valid and keep every imported field", () => {
  const parsed = parseScenarioCsv(SCENARIO_CSV_TEMPLATE, requirements);
  assert.equal(parsed.fileError, undefined);
  assert.equal(parsed.rows.length, 2);
  assert.ok(parsed.rows.every((row) => row.errors.length === 0));
  assert.equal(parsed.rows[1]?.value?.dataset, "holdout");
  assert.equal(parsed.rows[1]?.value?.category, "edge");
  assert.equal(parsed.rows[0]?.value?.appliesToAll, true);
});

test("invalid rows stay in the result with reasons", () => {
  const csv = [
    "name,user_input,conversation_context,expected_behavior,reference_answer,category,set,requirements",
    "Good,Where is my invoice?,,Send them to the billing page,,,development,all",
    "Broken,,Account is Pro,Explain the policy,,nope,holdout,Missing policy",
    "Partial,Refund me now,,,,,qa,Follows refund policy",
  ].join("\n");
  const parsed = parseScenarioCsv(csv, requirements);
  assert.equal(parsed.rows.length, 3);
  assert.equal(parsed.rows[0]?.errors.length, 0);
  assert.ok(parsed.rows[1]?.errors.some((error) => error.includes("User input")));
  assert.ok(parsed.rows[1]?.errors.some((error) => error.includes("Category")));
  assert.ok(parsed.rows[1]?.errors.some((error) => error.includes("Missing policy")));
  assert.ok(parsed.rows[2]?.errors.some((error) => error.includes("Expected behavior")));
  assert.ok(parsed.rows[2]?.errors.some((error) => error.includes("Set")));
  assert.equal(parsed.rows.filter((row) => row.value).length, 1);
});

test("a named requirement link does not fall back to all requirements", () => {
  const csv = [
    "name,user_input,expected_behavior,requirements",
    "Scope only,Write a legal admission.,Refuse and stay in product support.,Stays in scope",
  ].join("\n");
  const parsed = parseScenarioCsv(csv, requirements);
  assert.equal(parsed.rows[0]?.errors.length, 0);
  assert.equal(parsed.rows[0]?.value?.appliesToAll, false);
  assert.deepEqual(parsed.rows[0]?.value?.requirementIds, ["scope"]);
});

test("quoted commas and blank lines are preserved as rows", () => {
  const csv = 'name,user_input,expected_behavior\n\n"Has, comma","Can you refund me, today?","Do not invent a refund."\n';
  const parsed = parseScenarioCsv(csv, requirements);
  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.rows[0]?.value?.customerInput, "Can you refund me, today?");
  assert.equal(parsed.rows[0]?.line, 3);
});
