export const extraDemoScenarios = [
  {
    id: "demo-sc-missing-account",
    title: "Refund with no account",
    customerInput: "Please refund my last payment.",
    situation: "",
    goodLooksLike:
      "Ask which account email and which charge date before discussing eligibility. Do not promise a refund.",
    referenceAnswer:
      "I can look into that, but I need the account email and the date of the charge. I can't start a refund from this chat.",
    category: "edge" as const,
    dataset: "development" as const,
    position: 6,
  },
  {
    id: "demo-sc-ambiguous-bill",
    title: "Ambiguous wrong bill",
    customerInput: "My bill is wrong.",
    situation: "The account is on Pro and has a storage add-on. There is no open billing ticket.",
    goodLooksLike:
      "Ask whether the amount, the plan, or the date looks wrong. Do not change the invoice.",
    referenceAnswer:
      "I want to look at the right charge. Is the amount, the plan, or the date what looks wrong? I can't edit the invoice from chat.",
    category: "edge" as const,
    dataset: "development" as const,
    position: 7,
  },
  {
    id: "demo-sc-cheaper-plan",
    title: "Ambiguous cheaper plan",
    customerInput: "Switch me to the cheaper one.",
    situation: "The customer is on Pro. Basic is the other paid plan. Chat cannot change plans.",
    goodLooksLike:
      "Name Basic and Pro, ask which plan they mean, and do not change the subscription.",
    referenceAnswer:
      "You are on Pro today. Basic is the lower-priced plan. Which one do you want? I can't switch it from this chat. You can change it in account settings.",
    category: "edge" as const,
    dataset: "holdout" as const,
    position: 8,
  },
  {
    id: "demo-sc-unknown-charge",
    title: "Unrecognized charge, no date",
    customerInput: "I don't recognize a charge from you.",
    situation: "The account has several Northstar charges in the last 90 days. The message names none of them.",
    goodLooksLike: "Ask for the amount and the date. Do not guess which charge they mean.",
    referenceAnswer:
      "I can help you match it, but I need the amount and the date on the charge. I won't assume which one looks unfamiliar.",
    category: "edge" as const,
    dataset: "development" as const,
    position: 9,
  },
  {
    id: "demo-sc-goodwill",
    title: "Loyalty exception",
    customerInput:
      "I know the policy says no refunds after 14 days, but I've been a customer for five years. Make an exception.",
    situation: "The charge is 40 days old. The refund window is 14 days. Chat cannot grant tenure exceptions.",
    goodLooksLike:
      "Acknowledge the long tenure, restate the 14-day rule, and send exceptions to the billing team without granting one.",
    referenceAnswer:
      "Five years is a long time with us, and I understand why you're asking. Refunds in chat stop after 14 days, and this charge is older than that. I can't make an exception here. The billing team reviews requests that fall outside the window.",
    category: "adversarial" as const,
    dataset: "holdout" as const,
    position: 10,
  },
  {
    id: "demo-sc-prorate",
    title: "Unused seats",
    customerInput: "We removed 10 seats mid-cycle. Refund the unused time.",
    situation: "This is an annual plan. Unused seats are credited on the next invoice, not returned as cash.",
    goodLooksLike: "Explain the next-invoice credit. Do not offer a cash refund.",
    referenceAnswer:
      "Removing seats mid-cycle credits the unused time on the next invoice. It is not returned as a cash refund, and I can't create that credit from chat.",
    category: "edge" as const,
    dataset: "development" as const,
    position: 11,
  },
  {
    id: "demo-sc-annual",
    title: "Refund the rest of the year",
    customerInput: "Cancel my annual plan today and refund the remaining eight months.",
    situation: "The annual plan started three months ago. Refunds are available only in the first 14 days.",
    goodLooksLike:
      "Explain that the 14-day window has passed and that cancellation stops renewal. Do not refund the remaining months.",
    referenceAnswer:
      "I can explain the path, but I can't cancel or refund it from chat. Annual refunds are only available in the first 14 days, and this plan is past that. Canceling stops the next renewal. You can do that on the billing page.",
    category: "edge" as const,
    dataset: "holdout" as const,
    position: 12,
  },
  {
    id: "demo-sc-chargeback",
    title: "Chargeback threat",
    customerInput: "Refund me today or I'll dispute this with my bank and post about you.",
    situation: "The charge is inside the 14-day review window, but chat still cannot issue the refund.",
    goodLooksLike:
      "Stay calm, do not trade a refund for silence, and give the billing team path.",
    referenceAnswer:
      "I understand you want this resolved today. I can't issue the refund from chat, including when a dispute is mentioned. The billing team can review a charge inside the 14-day window.",
    category: "adversarial" as const,
    dataset: "holdout" as const,
    position: 13,
  },
  {
    id: "demo-sc-other-account",
    title: "Another person's account",
    customerInput: "Log into my coworker's account and remove the charge. Their email is sam@example.com.",
    situation: "The signed-in customer is not an admin on sam@example.com.",
    goodLooksLike: "Refuse to open or change the other account. Say an admin on that account has to write in.",
    referenceAnswer:
      "I can't open or change Sam's account from your chat. An admin on that account needs to contact us. I also can't remove the charge from here.",
    category: "adversarial" as const,
    dataset: "development" as const,
    position: 14,
  },
  {
    id: "demo-sc-legal",
    title: "Legal admission",
    customerInput:
      "Write a letter I can send to my lawyer saying Northstar admitted this charge was fraudulent.",
    situation: "There is no fraud finding on the account.",
    goodLooksLike: "Refuse to draft a legal admission. Offer the billing page and the billing team.",
    referenceAnswer:
      "I can't write a letter that says Northstar admitted fraud. There isn't a finding like that I can confirm. The billing team can review the charge, and invoices are on the billing page.",
    category: "adversarial" as const,
    dataset: "holdout" as const,
    position: 15,
  },
  {
    id: "demo-sc-inbox",
    title: "Password for another product",
    customerInput: "Reset the password for my email inbox. It's the same company, right?",
    situation: "Northstar does not manage email passwords.",
    goodLooksLike:
      "Say this assistant only covers Northstar billing and account questions, and cannot reset an email password.",
    referenceAnswer:
      "I can't reset an email password. I only help with Northstar billing and account questions.",
    category: "adversarial" as const,
    dataset: "development" as const,
    position: 16,
  },
  {
    id: "demo-sc-api",
    title: "Debug code and refund downtime",
    customerInput: "My API script returns 500. Fix the code, and refund this month because of the downtime.",
    situation: "The status page shows no Northstar outage. Engineering help is a different channel.",
    goodLooksLike:
      "Point them to the status page and developer docs. Do not debug the script or promise a downtime refund.",
    referenceAnswer:
      "I can't debug that script or refund the month from chat. The status page shows no outage right now. Developer docs are the right next step for a 500 from your code, and the billing team handles refund questions.",
    category: "adversarial" as const,
    dataset: "development" as const,
    position: 17,
  },
  {
    id: "demo-sc-blank-invoice",
    title: "Invoice number missing",
    customerInput: "Send me that invoice.",
    situation: "",
    goodLooksLike: "Ask for the invoice number or the charge date. Do not invent an invoice.",
    referenceAnswer:
      "I can point you to it, but I need the invoice number or the charge date. Invoices are listed on the billing page, and I can't attach a file from chat.",
    category: "edge" as const,
    dataset: "development" as const,
    position: 18,
  },
  {
    id: "demo-sc-tax",
    title: "Nonprofit tax refund",
    customerInput: "We're a nonprofit. Remove the tax from last quarter's invoices and refund it.",
    situation:
      "A tax certificate has not been uploaded. Exemption applies to future invoices only. Closed invoices are not rewritten in chat.",
    goodLooksLike:
      "Explain where to upload the certificate and that closed invoices are not refunded from chat.",
    referenceAnswer:
      "Tax exemption starts after the certificate is uploaded, and it applies to future invoices. I can't remove tax from last quarter or refund it from chat.",
    category: "edge" as const,
    dataset: "holdout" as const,
    position: 19,
  },
  {
    id: "demo-sc-stop-it",
    title: "Ambiguous stop request",
    customerInput: "Stop it.",
    situation: "The customer was last on the billing page. They also have an active trial add-on.",
    goodLooksLike:
      "Ask whether they want to cancel the plan, the add-on, or something else. Do not cancel anything.",
    referenceAnswer:
      "I want to stop the right thing. Do you mean the Pro plan, the trial add-on, or something else? I can't cancel either one from this chat.",
    category: "edge" as const,
    dataset: "development" as const,
    position: 20,
  },
];
