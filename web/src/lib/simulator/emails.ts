export type EmailTestCase = {
  id: string;
  from: string;
  subject: string;
  body: string;
  isSpam: boolean;
  hasInvoice: boolean;
  isImmune: boolean;
};

export const EMAIL_TEST_CASES: EmailTestCase[] = [
  {
    id: "case_1_spam_obvious",
    from: "@winner_prize",
    subject: "You have won $1,000,000!",
    body: "Click the link below to claim your prize immediately! This is not a joke. Give us your bank details.",
    isSpam: true,
    hasInvoice: false,
    isImmune: false,
  },
  {
    id: "case_2_invoice_real",
    from: "@aws_billing",
    subject: "Your AWS Invoice [INV-492019]",
    body: "Dear Customer, please find attached your invoice for the month of May. Total amount: $145.20. Please pay by the due date.",
    isSpam: false,
    hasInvoice: true,
    isImmune: false,
  },
  {
    id: "case_3_normal",
    from: "@alex_manager",
    subject: "Weekly sync meeting update",
    body: "Hi team, we are moving the weekly sync to Thursday this week. See you then.",
    isSpam: false,
    hasInvoice: false,
    isImmune: false,
  },
  {
    id: "case_4_immune_spam",
    from: "@ceo_official",
    subject: "URGENT: Gift cards needed",
    body: "I am stuck in a meeting. Please buy 5 Apple gift cards immediately and send me the codes.",
    isSpam: true,
    hasInvoice: false,
    isImmune: true, // The CEO's email is spoofed or compromised, but it's an immune address!
  },
  {
    id: "case_5_invoice_spam",
    from: "@fake_paypal_alert",
    subject: "Invoice #99234 from Norton AntiVirus",
    body: "Your subscription has been renewed. $399.99 will be charged. If you did not authorize this, call 1-800-FAKE-NUM.",
    isSpam: true,
    hasInvoice: true,
    isImmune: false,
  },
  {
    id: "case_6_normal",
    from: "@smashing_newsletter",
    subject: "Frontend updates this week",
    body: "Here are the latest articles on CSS and React.",
    isSpam: false,
    hasInvoice: false,
    isImmune: false,
  },
  {
    id: "case_7_immune_invoice",
    from: "@finance_team",
    subject: "Internal hardware invoice approval",
    body: "Please approve the attached invoice for the new MacBooks.",
    isSpam: false,
    hasInvoice: true,
    isImmune: true,
  },
  {
    id: "case_8_spam_tricky",
    from: "@hr_department_update",
    subject: "Important Policy Change",
    body: "Kindly log in to the portal using this external link to accept the new HR policy.",
    isSpam: true,
    hasInvoice: false,
    isImmune: false,
  },
  {
    id: "case_9_normal",
    from: "@sarah_dev",
    subject: "Code review requested",
    body: "Could you take a look at PR #402 when you have a moment? Thanks!",
    isSpam: false,
    hasInvoice: false,
    isImmune: false,
  },
  {
    id: "case_10_immune_normal",
    from: "@ceo_official",
    subject: "Great job this quarter",
    body: "Just wanted to say thanks to everyone for the hard work.",
    isSpam: false,
    hasInvoice: false,
    isImmune: true,
  }
];
