import type { CheckConfig, CheckType, Outcome } from "@/lib/types";
import { countWords, normalizeForMatch, previewList } from "@/lib/eval/text";

export type GradeResult = {
  outcome: Outcome;
  explanation: string;
};

function phraseHits(text: string, phrases: string[]): string[] {
  const haystack = normalizeForMatch(text);
  return phrases.filter((phrase) =>
    haystack.includes(normalizeForMatch(phrase)),
  );
}

function wordLimit(config: CheckConfig): string {
  const { minWords, maxWords } = config;
  if (minWords !== null && maxWords !== null) {
    return `between ${minWords} and ${maxWords} words`;
  }
  if (maxWords !== null) return `at most ${maxWords} words`;
  if (minWords !== null) return `at least ${minWords} words`;
  return "a word count you set";
}

export function gradeText(
  text: string,
  checkType: CheckType,
  config: CheckConfig,
): GradeResult {
  if (checkType === "human_only") {
    return {
      outcome: "unreviewed",
      explanation: "No deterministic check is configured for this requirement.",
    };
  }

  if (checkType === "valid_json") {
    const trimmed = text.trim();
    if (!trimmed) {
      return { outcome: "fail", explanation: "The response is empty, so it is not valid JSON." };
    }
    try {
      JSON.parse(trimmed);
      return { outcome: "pass", explanation: "The response is valid JSON." };
    } catch {
      return { outcome: "fail", explanation: "The response is not valid JSON." };
    }
  }

  if (checkType === "word_count") {
    const words = countWords(text);
    const tooShort = config.minWords !== null && words < config.minWords;
    const tooLong = config.maxWords !== null && words > config.maxWords;
    const expected = wordLimit(config);
    if (tooShort || tooLong) {
      return {
        outcome: "fail",
        explanation: `${words} words. The reply must be ${expected}.`,
      };
    }
    return {
      outcome: "pass",
      explanation: `${words} words, within the limit (${expected}).`,
    };
  }

  const phrases = config.phrases;
  if (phrases.length === 0) {
    return {
      outcome: "fail",
      explanation: "This automatic check has no phrases yet.",
    };
  }

  const hits = phraseHits(text, phrases);

  if (checkType === "must_not_include" || checkType === "forbidden_text") {
    if (hits.length === 0) {
      return {
        outcome: "pass",
        explanation: "None of the blocked phrases appeared.",
      };
    }
    return {
      outcome: "fail",
      explanation: `Found “${hits[0]}”, which this requirement does not allow.`,
    };
  }

  if (checkType === "must_include_all" || checkType === "required_text") {
    const missing = phrases.filter((phrase) => !hits.includes(phrase));
    if (missing.length === 0) {
      return {
        outcome: "pass",
        explanation: "Found every required phrase.",
      };
    }
    return {
      outcome: "fail",
      explanation: `Missing: ${previewList(missing, 160)}.`,
    };
  }

  if (hits.length > 0) {
    return {
      outcome: "pass",
      explanation: `Found “${hits[0]}”.`,
    };
  }
  return {
    outcome: "fail",
    explanation: `None of these phrases appeared: ${previewList(phrases, 160)}.`,
  };
}

export function describeCheck(checkType: CheckType, config: CheckConfig): string {
  switch (checkType) {
    case "must_include_any":
      return `Must mention one of: ${previewList(config.phrases)}`;
    case "must_include_all":
      return `Must mention all of: ${previewList(config.phrases)}`;
    case "must_not_include":
      return `Must not mention: ${previewList(config.phrases)}`;
    case "word_count":
      return `Word count: ${wordLimit(config)}`;
    case "human_only":
      return "No deterministic check. The AI grader still judges this requirement.";
    case "required_text":
      return `Required text: ${previewList(config.phrases)}`;
    case "forbidden_text":
      return `Forbidden text: ${previewList(config.phrases)}`;
    case "valid_json":
      return "The response must be valid JSON.";
  }
}
