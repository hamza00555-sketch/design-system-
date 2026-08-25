/**
 * Legal pages.
 *
 * Long-form legal text lives here rather than in the message catalogue: it is
 * content, not interface strings, and mixing paragraphs of policy into the same
 * file as button labels makes both harder to maintain.
 *
 * These are honest, accurate descriptions of what the software actually does —
 * they are not legal advice, and the operating entity, address, and governing
 * law still need filling in and a lawyer's read before launch.
 */

export interface LegalSection {
  heading: string;
  body: string[];
}

export interface LegalDocument {
  title: string;
  updated: string;
  intro: string;
  sections: LegalSection[];
  /** Shown as a visible banner until a lawyer has signed these off. */
  draftNotice: string;
}

const COMPANY = "[Operating entity]";
const CONTACT = "support@tokenwell.design";
const UPDATED_EN = "Last updated: 25 August 2026";
const UPDATED_AR = "آخر تحديث: ٢٥ أغسطس ٢٠٢٦";

const privacyEn: LegalDocument = {
  title: "Privacy policy",
  updated: UPDATED_EN,
  draftNotice:
    "Draft. This describes what the software genuinely does, but the operating entity and governing law are still placeholders and a lawyer has not reviewed it.",
  intro: `Tokenwell is operated by ${COMPANY}. It builds a design system from code you point it at and serves that system to your AI coding agents. This explains what we collect to do that, and what we do with it.`,
  sections: [
    {
      heading: "What we collect",
      body: [
        "Account details. When you sign in with Google or GitHub, our sign-in provider passes us your name, email address, and avatar. We never see or store a password — there are none.",
        "Team details. Your team's name and its member list, so teammates can be shown the same design systems.",
        "Design-system data. The tokens, component specs, and rules your agent pushes to us, and the version history of those pushes.",
        "Verification records. For each check an agent runs we store whether it passed and how many off-brand values it found. We do not store the contents of the files it checked — verification happens in memory and the file content is discarded when the response is written.",
        "Error reports. When something breaks, a technical report of what failed.",
        "Payment details. Payments are processed by Stripe. Your card number goes to Stripe directly and never touches our servers; we store your subscription status and Stripe's reference ids.",
      ],
    },
    {
      heading: "What we do with it",
      body: [
        "We use it to run the service: authenticate you, store and serve your design systems, bill subscriptions, and answer support.",
        "We do not sell your data. We do not use your design-system data to train AI models.",
      ],
    },
    {
      heading: "Who processes data for us",
      body: [
        "Firebase (Google) — authentication, database, and the functions that serve the API.",
        "Stripe — payments and subscriptions.",
        "Our hosting provider — serves this website.",
        "Each receives only what its job requires.",
      ],
    },
    {
      heading: "Retention and deletion",
      body: [
        "We keep your data while your account is active.",
        `Ask us at ${CONTACT} to delete your account and we remove your account data and design-system data within 30 days, except records we must keep for tax or legal reasons.`,
        "You can export your design system as DESIGN.md and W3C design tokens at any time, on any plan — before, during, or instead of deletion.",
      ],
    },
    {
      heading: "Security",
      body: [
        "All traffic is encrypted in transit. Project API keys are stored only as a SHA-256 hash, so a copy of our database cannot be used to call the API.",
        "No system is perfectly secure. If we discover a breach affecting your data we will tell you.",
      ],
    },
  ],
};

const termsEn: LegalDocument = {
  title: "Terms of service",
  updated: UPDATED_EN,
  draftNotice:
    "Draft. This describes what the software genuinely does, but the operating entity and governing law are still placeholders and a lawyer has not reviewed it.",
  intro: `These terms are an agreement between you and ${COMPANY}. By creating an account you accept them. If you are using Tokenwell for a company, you accept them on the company's behalf.`,
  sections: [
    {
      heading: "The service",
      body: [
        "Tokenwell stores a versioned design system and serves it to your projects, teammates, and AI coding agents through the web app, the command-line tool, and the MCP endpoint.",
        "We may improve or change features over time. We will not remove your ability to export your design system.",
      ],
    },
    {
      heading: "Your account",
      body: [
        "You sign in with Google or GitHub. Activity under your sign-in is your responsibility, so keep control of that account.",
        "Project API keys are shown once, at connect time, and are written into a gitignored file in your repo. Treat them as credentials; anyone holding one can read your design system and push a new version.",
      ],
    },
    {
      heading: "Your content",
      body: [
        "The code you point Tokenwell at and the design systems extracted from it are yours. You grant us only the licence needed to store, process, and serve that material to you, your team, and the tools you connect.",
        "You promise you have the right to the code you point Tokenwell at.",
      ],
    },
    {
      heading: "Plans and billing",
      body: [
        "The free plan covers one design system, one project, and one person.",
        "Paid plans are billed monthly per team through Stripe. Founding-member pricing stays fixed for as long as the subscription remains active; otherwise we may change prices with at least 30 days' notice, effective from your next billing cycle.",
        "Cancel any time from billing settings. Your plan stays active until the end of the period already paid for. Amounts already paid are not refundable except where the law requires it.",
        "Downgrading never deletes your data. Your history and your system stay intact, and export works on every plan.",
      ],
    },
    {
      heading: "Acceptable use",
      body: [
        "Do not break the law with the service, point it at code you have no right to share, probe or disrupt our infrastructure, resell the service, or attempt to reach another customer's data.",
        "We may suspend accounts that do.",
      ],
    },
    {
      heading: "Disclaimers and liability",
      body: [
        "The service is provided as is. Extracted design systems and verification results are produced by automated analysis and can be wrong — review what you ship.",
        "To the extent the law allows, neither side is liable for indirect or consequential damages, and our total liability is capped at what you paid us in the 12 months before the claim. Nothing here limits liability that cannot legally be limited.",
      ],
    },
  ],
};

const privacyAr: LegalDocument = {
  title: "سياسة الخصوصية",
  updated: UPDATED_AR,
  draftNotice:
    "مسوّدة. ما يلي وصف صادق لما يفعله البرنامج فعلاً، لكن اسم الجهة المشغّلة والقانون الحاكم ما زالا مكانَين شاغرَين، ولم يراجعها محامٍ بعد.",
  intro: `تُشغَّل Tokenwell من قِبل ${COMPANY}. تبني نظام تصميم من الكود الذي توجّهها إليه، وتقدّمه لوكلاء البرمجة بالذكاء الاصطناعي لديك. وهنا نوضّح ما نجمعه لأجل ذلك، وما نفعله به.`,
  sections: [
    {
      heading: "ما نجمعه",
      body: [
        "بيانات الحساب. عند تسجيل الدخول بحساب Google أو GitHub يمرّر لنا مزوّد الدخول اسمك وبريدك وصورتك. لا نرى كلمة مرور ولا نخزّنها — إذ لا وجود لها أصلاً.",
        "بيانات الفريق. اسم فريقك وقائمة أعضائه، كي نعرض للزملاء أنظمة التصميم نفسها.",
        "بيانات نظام التصميم. التوكنز ومواصفات المكوّنات والقواعد التي يرفعها وكيلك، وسجل إصدارات تلك الدفعات.",
        "سجلات التحقق. لكل فحص يجريه وكيل نحفظ نتيجته وعدد القيم الخارجة عن الهوية. لا نحفظ محتوى الملفات المفحوصة — يجري التحقق في الذاكرة ويُتلَف المحتوى فور كتابة الرد.",
        "تقارير الأعطال. عند حدوث خلل، تقرير تقني بما فشل.",
        "بيانات الدفع. تعالج Stripe المدفوعات. رقم بطاقتك يذهب إلى Stripe مباشرة ولا يمرّ بخوادمنا؛ ونحفظ حالة اشتراكك ومعرّفات Stripe فقط.",
      ],
    },
    {
      heading: "فيمَ نستخدمه",
      body: [
        "لتشغيل الخدمة: التحقق من هويتك، وحفظ أنظمة تصميمك وتقديمها، وفوترة الاشتراكات، والرد على طلبات الدعم.",
        "لا نبيع بياناتك. ولا نستخدم بيانات نظام تصميمك لتدريب نماذج ذكاء اصطناعي.",
      ],
    },
    {
      heading: "من يعالج البيانات لصالحنا",
      body: [
        "‏Firebase من Google — المصادقة وقاعدة البيانات والدوال التي تقدّم الـ API.",
        "‏Stripe — المدفوعات والاشتراكات.",
        "مزوّد الاستضافة — يقدّم هذا الموقع.",
        "ولا يتلقى أيٌّ منهم إلا ما تتطلبه مهمته.",
      ],
    },
    {
      heading: "الحفظ والحذف",
      body: [
        "نحتفظ ببياناتك ما دام حسابك نشطًا.",
        `راسلنا على ${CONTACT} لحذف حسابك، فنحذف بيانات حسابك وبيانات نظام تصميمك خلال ٣٠ يومًا، عدا سجلات يلزمنا الاحتفاظ بها لأسباب ضريبية أو قانونية.`,
        "ويمكنك تصدير نظام تصميمك كملف DESIGN.md وتوكنز W3C في أي وقت وعلى أي خطة — قبل الحذف أو أثناءه أو بدلاً منه.",
      ],
    },
    {
      heading: "الأمان",
      body: [
        "كل حركة البيانات مشفّرة أثناء النقل. ومفاتيح المشاريع تُخزَّن كبصمة SHA-256 فقط، فنسخةٌ من قاعدة بياناتنا لا تصلح لاستدعاء الـ API.",
        "ولا يوجد نظام آمن تمامًا. وإن اكتشفنا خرقًا يمسّ بياناتك فسنخبرك.",
      ],
    },
  ],
};

const termsAr: LegalDocument = {
  title: "شروط الخدمة",
  updated: UPDATED_AR,
  draftNotice:
    "مسوّدة. ما يلي وصف صادق لما يفعله البرنامج فعلاً، لكن اسم الجهة المشغّلة والقانون الحاكم ما زالا مكانَين شاغرَين، ولم يراجعها محامٍ بعد.",
  intro: `هذه الشروط اتفاق بينك وبين ${COMPANY}. بإنشائك حسابًا فأنت تقبلها. وإن كنت تستخدم Tokenwell لصالح شركة، فأنت تقبلها نيابة عنها.`,
  sections: [
    {
      heading: "الخدمة",
      body: [
        "تحفظ Tokenwell نظام تصميم مُصدَّرًا وتقدّمه لمشاريعك وزملائك ووكلاء البرمجة لديك، عبر تطبيق الويب وأداة سطر الأوامر ونقطة MCP.",
        "قد نحسّن المزايا أو نغيّرها مع الوقت، ولن نسلبك القدرة على تصدير نظام تصميمك.",
      ],
    },
    {
      heading: "حسابك",
      body: [
        "تسجّل الدخول بحساب Google أو GitHub. وما يجري تحت تسجيل دخولك مسؤوليتك، فحافظ على حسابك.",
        "مفاتيح المشاريع تُعرض مرة واحدة عند التوصيل وتُكتب في ملف مستثنى من git داخل مستودعك. عاملها معاملة بيانات الاعتماد؛ فمن يملك مفتاحًا يستطيع قراءة نظام تصميمك ودفع إصدار جديد.",
      ],
    },
    {
      heading: "محتواك",
      body: [
        "الكود الذي توجّه Tokenwell إليه، وأنظمة التصميم المستخرجة منه، ملكك أنت. وتمنحنا فقط الترخيص اللازم لحفظ ذلك المحتوى ومعالجته وتقديمه لك ولفريقك وللأدوات التي توصّلها.",
        "وتقرّ بأن لك حق التصرف في الكود الذي توجّهنا إليه.",
      ],
    },
    {
      heading: "الخطط والفوترة",
      body: [
        "الخطة المجانية تغطي نظام تصميم واحدًا ومشروعًا واحدًا وشخصًا واحدًا.",
        "والخطط المدفوعة تُفوتر شهريًا لكل فريق عبر Stripe. وسعر المؤسسين يبقى ثابتًا ما دام الاشتراك نشطًا؛ وفيما عدا ذلك قد نغيّر الأسعار بإشعار مدته ٣٠ يومًا على الأقل، يسري من دورة الفوترة التالية.",
        "ألغِ متى شئت من إعدادات الفوترة. وتبقى خطتك نشطة حتى نهاية الفترة المدفوعة. والمبالغ المدفوعة غير مستردّة إلا حيث يوجب القانون ذلك.",
        "وتخفيض الخطة لا يحذف بياناتك أبدًا. سجلّك ونظامك يبقيان سليمين، والتصدير متاح على كل خطة.",
      ],
    },
    {
      heading: "الاستخدام المقبول",
      body: [
        "لا تخالف القانون بالخدمة، ولا توجّهها إلى كود لا تملك حق مشاركته، ولا تحاول اختبار بنيتنا أو تعطيلها، ولا تعيد بيع الخدمة، ولا تحاول الوصول إلى بيانات عميل آخر.",
        "وقد نوقف الحسابات التي تفعل ذلك.",
      ],
    },
    {
      heading: "إخلاء المسؤولية وحدودها",
      body: [
        "تُقدَّم الخدمة «كما هي». وأنظمة التصميم المستخرجة ونتائج التحقق ينتجها تحليل آلي وقد تخطئ — فراجع ما تشحنه.",
        "وبالقدر الذي يسمح به القانون، لا يتحمّل أي طرف أضرارًا غير مباشرة أو تبعية، وتبلغ مسؤوليتنا الإجمالية حدًّا أقصاه ما دفعته لنا خلال الاثني عشر شهرًا السابقة للمطالبة. ولا شيء هنا يحدّ من مسؤولية لا يجوز قانونًا الحدّ منها.",
      ],
    },
  ],
};

export const LEGAL = {
  en: { privacy: privacyEn, terms: termsEn },
  ar: { privacy: privacyAr, terms: termsAr },
} as const;

export type LegalLocale = keyof typeof LEGAL;
