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

export type RoutingTestCase = {
  id: string;
  from: string;
  body: string;
  intent: "support" | "billing" | "spam";
  kbArticle?: string;
  refundAmount?: number;
  registeredDaysAgo?: number;
};

export const ROUTING_TEST_CASES: RoutingTestCase[] = [
  {
    id: "route_tech_1",
    from: "user_login_error@gmail.com",
    body: "Здравствуйте! Не могу войти в личный кабинет, пишет ошибку Connection Timed Out. Помогите.",
    intent: "support",
    kbArticle: "Ошибка Connection Timed Out: сбросьте сетевые интерфейсы или отключите брандмауэр.",
  },
  {
    id: "route_tech_2",
    from: "vpn_issue@yandex.ru",
    body: "Добрый день. Настройка VPN не завершается, бесконечно висит статус подключения.",
    intent: "support",
    kbArticle: "Сбой VPN: переустановите клиент или сбросьте сетевые интерфейсы.",
  },
  {
    id: "route_tech_3",
    from: "printer_offline@corp-mail.ru",
    body: "Срочно! Принтер в бухгалтерии не печатает, драйвер выдаёт ошибку 0xE3.",
    intent: "support",
    kbArticle: "Ошибка принтера 0xE3: перезапустите службу печати или переустановите драйвер.",
  },
  {
    id: "route_tech_4",
    from: "email_crash@outlook.com",
    body: "Не отправляются письма с вложениями больше 5 МБ. Выскакивает ошибка 'Server timeout'.",
    intent: "support",
    kbArticle: "Ошибка Server timeout: уменьшите размер вложения или используйте корпоративное облако.",
  },
  {
    id: "route_billing_valid_1",
    from: "refund_request@mail.ru",
    body: "Привет. Я вчера оплатил подписку на 50$, но передумал пользоваться. Оформите возврат.",
    intent: "billing",
    refundAmount: 50,
    registeredDaysAgo: 1,
  },
  {
    id: "route_billing_valid_2",
    from: "new_user@fastmail.com",
    body: "Здравствуйте. Оплатил тариф Pro час назад, но он мне не подходит. Можно вернуть деньги?",
    intent: "billing",
    refundAmount: 99,
    registeredDaysAgo: 0,
  },
  {
    id: "route_billing_valid_3",
    from: "trial_expired@gmail.com",
    body: "Добрый день. Только что купил подписку, случайно выбрал не тот тариф. Как отменить и сделать возврат?",
    intent: "billing",
    refundAmount: 29,
    registeredDaysAgo: 2,
  },
  {
    id: "route_billing_invalid_1",
    from: "late_refund@gmail.com",
    body: "Я хочу вернуть деньги за прошлые 3 месяца. Подписка стоила 150$.",
    intent: "billing",
    refundAmount: 150,
    registeredDaysAgo: 90,
  },
  {
    id: "route_billing_invalid_2",
    from: "old_customer@yahoo.com",
    body: "Оплатил подписку 2 месяца назад, но не пользовался. Можно сделать возврат?",
    intent: "billing",
    refundAmount: 49,
    registeredDaysAgo: 60,
  },
  {
    id: "route_billing_invalid_3",
    from: "annual_user@corpmail.com",
    body: "У меня годовая подписка, осталось 8 месяцев. Хочу расторгнуть и вернуть остаток.",
    intent: "billing",
    refundAmount: 200,
    registeredDaysAgo: 120,
  },
  {
    id: "route_spam_ads_1",
    from: "best_vacuums@seo-spam.com",
    body: "УНИКАЛЬНОЕ ПРЕДЛОЖЕНИЕ! Купите наши пылесосы со скидкой 90%! Переходите по ссылке.",
    intent: "spam",
  },
  {
    id: "route_spam_ads_2",
    from: "casino_win@spam.org",
    body: "ВЫ ВЫИГРАЛИ ДЖЕКПОТ! $1,000,000 ждут вас. Переведите $50 налога для получения приза.",
    intent: "spam",
  },
  {
    id: "route_spam_ads_3",
    from: "crypto_alert@scam.io",
    body: "Срочная распродажа Bitcoin! Успей купить по старому курсу, ссылка ниже.",
    intent: "spam",
  },
  {
    id: "route_spam_ads_4",
    from: "phishing@bank-verify.com",
    body: "Ваш банковский счет заблокирован. Перейдите по ссылке для подтверждения данных.",
    intent: "spam",
  },
];
