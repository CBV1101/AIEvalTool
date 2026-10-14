import assert from "node:assert/strict";
import test from "node:test";
import { countWords } from "@/lib/eval/text";
import { gradeText } from "@/lib/eval/grading";
import { barHint, passesNeeded } from "@/lib/eval/release";

test("phrase checks ignore capitalization and curly apostrophes", () => {
  const result = gradeText("We’ll refund the duplicate.", "must_not_include", {
    phrases: ["we'll refund"],
    minWords: null,
    maxWords: null,
  });
  assert.equal(result.outcome, "fail");
});

test("word count uses the maximum as an inclusive limit", () => {
  const words = "one two three";
  assert.equal(countWords(words), 3);
  assert.equal(
    gradeText(words, "word_count", { phrases: [], minWords: null, maxWords: 3 }).outcome,
    "pass",
  );
  assert.equal(
    gradeText(words, "word_count", { phrases: [], minWords: null, maxWords: 2 }).outcome,
    "fail",
  );
});

test("required text, forbidden text, and valid JSON are deterministic", () => {
  const config = { phrases: ["billing team"], minWords: null, maxWords: null };
  assert.equal(gradeText("Contact the billing team.", "required_text", config).outcome, "pass");
  assert.equal(gradeText("Contact support.", "required_text", config).outcome, "fail");
  assert.equal(gradeText("You get a full refund.", "forbidden_text", {
    phrases: ["full refund"],
    minWords: null,
    maxWords: null,
  }).outcome, "fail");
  assert.equal(gradeText('{"ok":true}', "valid_json", { phrases: [], minWords: null, maxWords: null }).outcome, "pass");
  assert.equal(gradeText("not json", "valid_json", { phrases: [], minWords: null, maxWords: null }).outcome, "fail");
});

test("human-only checks stay unreviewed", () => {
  const result = gradeText("Anything", "human_only", {
    phrases: [],
    minWords: null,
    maxWords: null,
  });
  assert.equal(result.outcome, "unreviewed");
});

test("pass bars describe how many scenarios must pass", () => {
  assert.equal(passesNeeded(80, 5), 4);
  assert.equal(passesNeeded(100, 5), 5);
  assert.equal(passesNeeded(90, 5), 5);
  assert.match(barHint(80, 5), /at least 4/);
});
