import { DEFAULT_MESSAGE_TEMPLATE } from "@/lib/eval/prompts";
import { extraDemoScenarios } from "@/lib/demo/extra-scenarios";
import type { CheckConfig, CheckType, Decision, Priority, ReferenceKind } from "@/lib/types";

export const DEMO_PROJECT_ID = "demo-support-assistant";
export const DEMO_RUN_ID = "demo-run-billing";
export const DEMO_CREATED_AT = "2026-03-01T10:00:00.000Z";
export const DEMO_RUN_CREATED_AT = "2026-03-04T14:00:00.000Z";
export const DEMO_GRADED_AT = "2026-03-04T14:30:00.000Z";
export const DEMO_MIN_PASS_RATE = 85;

export const DEMO_VERSION_IDS = {
  direct: "demo-ver-direct",
  careful: "demo-ver-careful",
} as const;

export const DEMO_SCENARIO_IDS = {
  double: "demo-sc-double",
  cancel: "demo-sc-cancel",
  invoice: "demo-sc-invoice",
  student: "demo-sc-student",
  plan: "demo-sc-plan",
} as const;

export const DEMO_REQUIREMENT_IDS = {
  policy: "demo-req-policy",
  handoff: "demo-req-handoff",
  ack: "demo-req-ack",
  next: "demo-req-next",
  length: "demo-req-length",
  tone: "demo-req-tone",
} as const;

type DemoRequirement = {
  id: string;
  title: string;
  details: string;
  passGuidance: string;
  failGuidance: string;
  critical: boolean;
  priority: Priority;
  passPercent: number;
  checkType: CheckType;
  checkConfig: CheckConfig;
  position: number;
};

type DemoScenario = {
  id: string;
  title: string;
  customerInput: string;
  situation: string;
  goodLooksLike: string;
  referenceAnswer: string;
  category: "normal" | "edge" | "adversarial";
  dataset: "development" | "holdout";
  position: number;
};

type DemoVersion = {
  id: string;
  name: string;
  changeNotes: string;
  instructions: string;
  messageTemplate: string;
  position: number;
};

export type DemoReply = {
  scenarioId: string;
  versionId: string;
  text: string;
};

export type DemoReviewSeed = {
  scenarioId: string;
  versionId: string;
  requirementId: string;
  decision: Decision;
  note: string;
};

const phrases = (
  list: string[],
  extra: Partial<CheckConfig> = {},
): CheckConfig => ({
  phrases: list,
  minWords: extra.minWords ?? null,
  maxWords: extra.maxWords ?? null,
});

export const demoRequirements: DemoRequirement[] = [
  {
    id: DEMO_REQUIREMENT_IDS.policy,
    title: "Does not invent a refund",
    details:
      "Responses must follow the supplied refund policy. The assistant must not promise money back.",
    passGuidance: "Correctly explains applicable eligibility without inventing exceptions.",
    failGuidance: "Offers a refund that the policy does not allow.",
    critical: true,
    priority: "blocker",
    passPercent: 100,
    checkType: "must_not_include",
    checkConfig: phrases([
      "full refund",
      "we'll refund",
      "we will refund",
      "refund has been issued",
      "guaranteed refund",
    ]),
    position: 1,
  },
  {
    id: DEMO_REQUIREMENT_IDS.handoff,
    title: "Hands billing changes to a person",
    details:
      "If the customer wants a charge, plan, or invoice changed, the reply says the assistant cannot do that from chat.",
    passGuidance: "Says the assistant cannot change billing from chat and names the billing team or a clear limit.",
    failGuidance: "Implies the assistant changed a charge, plan, or invoice, or skips the handoff.",
    critical: true,
    priority: "blocker",
    passPercent: 100,
    checkType: "must_include_any",
    checkConfig: phrases([
      "billing team",
      "i can't",
      "i cannot",
      "i'm not able",
      "i am not able",
    ]),
    position: 2,
  },
  {
    id: DEMO_REQUIREMENT_IDS.ack,
    title: "Acknowledges the customer's situation",
    details: "The reply notices the problem before it gives instructions.",
    passGuidance: "Names the customer's situation before giving instructions.",
    failGuidance: "Jumps to instructions without showing it understood the problem.",
    critical: false,
    priority: "important",
    passPercent: 80,
    checkType: "must_include_any",
    checkConfig: phrases(["sorry", "understand", "frustrating", "i hear"]),
    position: 3,
  },
  {
    id: DEMO_REQUIREMENT_IDS.next,
    title: "Gives a concrete next step",
    details: "The customer should know the next thing they can do.",
    passGuidance: "Gives one concrete next step the customer can take.",
    failGuidance: "Ends without a next step, or tells the customer to wait with no path.",
    critical: false,
    priority: "important",
    passPercent: 80,
    checkType: "must_include_any",
    checkConfig: phrases([
      "you can",
      "next step",
      "billing page",
      "account settings",
      "reply to this",
    ]),
    position: 4,
  },
  {
    id: DEMO_REQUIREMENT_IDS.length,
    title: "Stays under 120 words",
    details:
      "Shorter replies are easier to scan in a support queue. This is helpful, so it does not block release on its own.",
    passGuidance: "The reply is 120 words or fewer.",
    failGuidance: "The reply is longer than 120 words.",
    critical: false,
    priority: "helpful",
    passPercent: 80,
    checkType: "word_count",
    checkConfig: phrases([], { maxWords: 120 }),
    position: 5,
  },
  {
    id: DEMO_REQUIREMENT_IDS.tone,
    title: "Tone feels respectful",
    details:
      "A person checks that the reply sounds calm and direct, not cold or buried in apologies.",
    passGuidance: "Sounds calm and direct, and a reviewer agrees the tone is respectful.",
    failGuidance: "Sounds cold, sarcastic, or so apologetic that the next step is hard to find.",
    critical: false,
    priority: "helpful",
    passPercent: 80,
    checkType: "human_only",
    checkConfig: phrases([]),
    position: 6,
  },
];

const coreDemoScenarios: Omit<DemoScenario, "referenceAnswer" | "category" | "dataset">[] = [
  {
    id: DEMO_SCENARIO_IDS.double,
    title: "Duplicate charge",
    customerInput:
      "I was charged twice this month for Pro. I want my money back today.",
    situation:
      "The account is on Pro. Two identical charges posted today. The assistant cannot issue refunds.",
    goodLooksLike:
      "Acknowledge the duplicate charge, refuse to invent a refund, and point the customer to the billing team.",
    position: 1,
  },
  {
    id: DEMO_SCENARIO_IDS.cancel,
    title: "Cancel without losing projects",
    customerInput: "How do I cancel without losing my projects?",
    situation:
      "Canceling keeps projects available to download for 30 days. Export lives in account settings.",
    goodLooksLike:
      "Reassure them about their projects and give the cancel path, without pretending chat can change the plan.",
    position: 2,
  },
  {
    id: DEMO_SCENARIO_IDS.invoice,
    title: "Missing invoice",
    customerInput:
      "This is the third time support has ignored me. Where is my invoice?",
    situation:
      "Invoices live on the billing page. The assistant cannot attach files.",
    goodLooksLike:
      "Recognize the frustration, apologize once, and send them to the invoice list.",
    position: 3,
  },
  {
    id: DEMO_SCENARIO_IDS.student,
    title: "Student discount on a closed invoice",
    customerInput:
      "Can I get a student discount applied to last month's invoice?",
    situation:
      "Student pricing applies to future renewals only, not to invoices that already closed.",
    goodLooksLike:
      "Explain that last month cannot be changed, and say where to add a school email for next time.",
    position: 4,
  },
  {
    id: DEMO_SCENARIO_IDS.plan,
    title: "Billed for the wrong plan",
    customerInput: "I signed up for Basic but I'm being billed for Pro.",
    situation:
      "The subscription is currently Pro. Customers can switch plans in account settings. The billing team compares prices.",
    goodLooksLike:
      "Recognize the mix-up, point them to account settings, and hand price differences to the billing team.",
    position: 5,
  },
];

const coreScenarioMeta: Record<string, Pick<DemoScenario, "referenceAnswer" | "category" | "dataset">> = {
  [DEMO_SCENARIO_IDS.double]: {
    category: "normal",
    dataset: "development",
    referenceAnswer:
      "I see two identical Pro charges today. I can't issue a refund from this chat. The billing team can review the duplicate.",
  },
  [DEMO_SCENARIO_IDS.cancel]: {
    category: "normal",
    dataset: "development",
    referenceAnswer:
      "Canceling keeps your projects available to download for 30 days. You can start that from account settings. I can't change the plan from this chat.",
  },
  [DEMO_SCENARIO_IDS.invoice]: {
    category: "edge",
    dataset: "development",
    referenceAnswer:
      "I'm sorry this is the third time. Invoices are listed on the billing page. I can't attach the file from chat.",
  },
  [DEMO_SCENARIO_IDS.student]: {
    category: "edge",
    dataset: "development",
    referenceAnswer:
      "Student pricing applies to the next renewal, not to last month's closed invoice. You can add a school email in account settings.",
  },
  [DEMO_SCENARIO_IDS.plan]: {
    category: "normal",
    dataset: "development",
    referenceAnswer:
      "The account is on Pro right now. You can switch plans in account settings. I can't change the price from this chat, and the billing team can compare the charges.",
  },
};

export const demoScenarios: DemoScenario[] = [
  ...coreDemoScenarios.map((scenario) => ({
    ...scenario,
    ...coreScenarioMeta[scenario.id],
  })),
  ...extraDemoScenarios,
];

export const demoReferenceMaterials: {
  id: string;
  title: string;
  kind: ReferenceKind;
  body: string;
  position: number;
}[] = [
  {
    id: "demo-ref-refund-policy",
    title: "Refund policy",
    kind: "policy",
    position: 1,
    body: `Northstar refund policy

Chat cannot issue refunds, credits, or plan changes.
Duplicate charges and billing mistakes are reviewed by the billing team.
Student pricing applies to future renewals only, not to invoices that already closed.
Annual plans can be refunded only in the first 14 days.
Unused seats on an annual plan are credited on the next invoice, not refunded as cash.
Tenure, nonprofit status, or a threat of a chargeback does not create an exception in chat.
Tax exemption applies after a certificate is uploaded, and only to future invoices.`,
  },
  {
    id: "demo-ref-billing-guide",
    title: "Billing help article",
    kind: "documentation",
    position: 2,
    body: `Invoices, plan changes, and cancellation live on the billing page. Projects stay available to download for 30 days after cancel. This assistant cannot attach files, open another person's account, reset passwords for other products, or debug a customer's code.`,
  },
];

export const demoVersions: DemoVersion[] = [
  {
    id: DEMO_VERSION_IDS.direct,
    name: "Direct v1",
    changeNotes:
      "Short and strict. It refuses refunds the policy does not allow, and it often skips acknowledgement and a next step.",
    instructions: `You are a support assistant for Northstar, a subscription product for managing projects.

Reply in under 80 words.
Do not promise a refund, credit, or exception.
If the customer asks to change a charge, plan, or invoice, say you can't do that from this chat.
Be direct. Do not add a greeting or an apology.`,
    messageTemplate: DEFAULT_MESSAGE_TEMPLATE,
    position: 1,
  },
  {
    id: DEMO_VERSION_IDS.careful,
    name: "Careful v2",
    changeNotes:
      "Warmer and more helpful. It acknowledges the customer and offers a next step, and it sometimes promises a refund the policy does not allow.",
    instructions: `You are a support assistant for Northstar, a subscription product for managing projects.

Write a calm reply that does four things:
1. Acknowledge the customer's situation in plain language.
2. Say what you can and cannot do. You can't change charges, plans, or invoices from this chat.
3. Give one concrete next step the customer can take.
4. When a billing change needs a person, point them to the billing team.

Never promise a refund, credit, or exception. Do not say "we'll refund" or "full refund".
Completeness matters more than brevity.`,
    messageTemplate: DEFAULT_MESSAGE_TEMPLATE,
    position: 2,
  },
];

const direct = DEMO_VERSION_IDS.direct;
const careful = DEMO_VERSION_IDS.careful;

export const demoReplies: DemoReply[] = [
  {
    scenarioId: DEMO_SCENARIO_IDS.double,
    versionId: direct,
    text: "You have two Pro charges this month. I can't change billing from this chat. The billing team can review the duplicate.",
  },
  {
    scenarioId: DEMO_SCENARIO_IDS.cancel,
    versionId: direct,
    text: "Open account settings and choose Cancel plan. You can export projects first. Projects stay available for 30 days. I can't change the plan from this chat.",
  },
  {
    scenarioId: DEMO_SCENARIO_IDS.invoice,
    versionId: direct,
    text: "Sorry your invoice is delayed. I can't send invoices from this chat. You can open the billing page and choose Invoices. The billing team also sends copies from there.",
  },
  {
    scenarioId: DEMO_SCENARIO_IDS.student,
    versionId: direct,
    text: "Last month is closed. I can't change that invoice from this chat.",
  },
  {
    scenarioId: DEMO_SCENARIO_IDS.plan,
    versionId: direct,
    text: "The account is on Pro. I can't change plans from this chat. You can switch to Basic in account settings.",
  },
  {
    scenarioId: DEMO_SCENARIO_IDS.double,
    versionId: careful,
    text: "I understand how frustrating a duplicate charge is. I can't change billing from this chat. You can open the billing page, select the extra Pro charge, and ask the billing team to review it. A full refund of the duplicate will be issued.",
  },
  {
    scenarioId: DEMO_SCENARIO_IDS.cancel,
    versionId: careful,
    text: "I understand you want to cancel without losing work. You can open account settings, export your projects, and then choose Cancel plan. Projects stay available to download for 30 days. I can't change the subscription from this chat. The billing team can confirm your last invoice date.",
  },
  {
    scenarioId: DEMO_SCENARIO_IDS.invoice,
    versionId: careful,
    text: "I understand how frustrating it is to chase an invoice after three unanswered notes. Sorry you had to ask again, and sorry the earlier messages did not come with the file. I can't attach invoices from this chat, and I'm not able to see the mailbox that handled those earlier requests. You can open the billing page, choose Invoices, and download this month's file there. The billing team can send a copy if a month is missing from that list. The next step is the billing page, not another wait in this thread. I understand you want the document itself. You can reach it without starting the conversation over. I can't promise the exact hour the billing team will write back, but the invoice list is the fastest path when the file is already there. Sorry the apology is taking up this much room while you are trying to do something simple. You can reply to this note with the month you need if the billing page shows a gap, and the billing team will look for that file. I understand the delay has worn out your patience, and you deserve a straight path to the invoice.",
  },
  {
    scenarioId: DEMO_SCENARIO_IDS.student,
    versionId: careful,
    text: "I understand you hoped a student discount would cover last month. I'm not able to change an invoice that already closed. Sorry this is not retroactive. We'll refund the difference from last month. You can add a school email in account settings, and the billing team confirms it before the next charge.",
  },
  {
    scenarioId: DEMO_SCENARIO_IDS.plan,
    versionId: careful,
    text: "I hear you. Being billed for Pro after you chose Basic is confusing, and I understand why you want it corrected today. Sorry this charge does not match the plan you picked. I can't change plans or prices from this chat, and I'm not able to move the account back to Basic on your behalf. You can open account settings and switch the plan to Basic there. The billing team compares the Pro charge with the Basic price and writes back on this thread if something still looks wrong. The next step is account settings, then a note from the billing team. I understand a settings page is not the same as an immediate correction, and sorry the bill landed before anyone explained the difference. You can reply to this message with the date you selected Basic if the billing page and account settings disagree. I can't see that click from here. The billing team can. Sorry to add steps when you already did the signup once, and I understand you want the price you were shown. You can stay in this thread while the billing team checks it, and you do not need to sign up again.",
  },
];

const tone = DEMO_REQUIREMENT_IDS.tone;

export const demoReviews: DemoReviewSeed[] = [
  {
    scenarioId: DEMO_SCENARIO_IDS.double,
    versionId: direct,
    requirementId: tone,
    decision: "fail",
    note: "Too abrupt for someone who was charged twice.",
  },
  {
    scenarioId: DEMO_SCENARIO_IDS.cancel,
    versionId: direct,
    requirementId: tone,
    decision: "fail",
    note: "The steps are right, but it never acknowledges the worry about losing projects.",
  },
  {
    scenarioId: DEMO_SCENARIO_IDS.invoice,
    versionId: direct,
    requirementId: tone,
    decision: "pass",
    note: "A brief apology is enough, and the next step is easy to find.",
  },
  {
    scenarioId: DEMO_SCENARIO_IDS.student,
    versionId: direct,
    requirementId: tone,
    decision: "fail",
    note: "It refuses the refund, but it never acknowledges the disappointment about last month.",
  },
  {
    scenarioId: DEMO_SCENARIO_IDS.plan,
    versionId: direct,
    requirementId: tone,
    decision: "fail",
    note: "It corrects the plan without recognizing the customer's confusion.",
  },
  {
    scenarioId: DEMO_SCENARIO_IDS.double,
    versionId: careful,
    requirementId: tone,
    decision: "pass",
    note: "Names the frustration and gives a clear handoff.",
  },
  {
    scenarioId: DEMO_SCENARIO_IDS.cancel,
    versionId: careful,
    requirementId: tone,
    decision: "pass",
    note: "Reassuring, and it does not promise anything the assistant cannot do.",
  },
  {
    scenarioId: DEMO_SCENARIO_IDS.invoice,
    versionId: careful,
    requirementId: tone,
    decision: "fail",
    note: "The apology repeats so many times that the next step is hard to find.",
  },
  {
    scenarioId: DEMO_SCENARIO_IDS.student,
    versionId: careful,
    requirementId: tone,
    decision: "pass",
    note: "The tone is kind, and it still promises a refund the policy does not allow.",
  },
  {
    scenarioId: DEMO_SCENARIO_IDS.plan,
    versionId: careful,
    requirementId: tone,
    decision: "pass",
    note: "Clear about the mix-up, even though the reply is longer than the word limit.",
  },
];

export const demoProject = {
  id: DEMO_PROJECT_ID,
  name: "Customer-support assistant",
  featureSummary:
    "Drafts replies to billing and account questions for Northstar, a subscription product for managing projects.",
    decisionNote:
    "Decide whether a warmer, more helpful prompt is ready for billing conversations, even when it promises refunds the policy does not allow.",
  minPassRate: DEMO_MIN_PASS_RATE,
};

export const demoRunName = "Sample comparison · billing replies";
