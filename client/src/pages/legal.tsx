import { useTranslation } from "react-i18next";
import { useRoute, Link } from "wouter";
import { ArrowLeft, ArrowRight } from "lucide-react";

const legalContent = {
  terms: {
    en: {
      title: "Terms of Service",
      lastUpdated: "Last updated: January 2026",
      content: `These Terms of Service ("Terms") govern your access to and use of tkoeen.net (the "Service"), operated by Cehail International ("Cehail", "we", "us", "our"). By creating an account or using the Service, you agree to these Terms.

If you do not agree, do not use the Service.

1. Who we are

The Service is operated by Cehail International, registered in the Kingdom of Saudi Arabia.
Legal name: Cehail International
Commercial Registration (CR): [CR NUMBER]
VAT: [VAT NUMBER, if applicable]
Address: [COMPANY ADDRESS]
Support: support@tkoeen.net
Legal/Administration: admin@tkoeen.net

2. Eligibility and accounts

You must be at least 18 years old to use the Service (or the age of legal majority where you live, whichever is higher).

You are responsible for all activity under your account and for keeping your login credentials secure.

You must provide accurate information and keep it updated.

We may suspend or terminate accounts for violations of these Terms or our policies.

3. The Service and AI-generated content

The Service allows users to generate images and/or videos ("Outputs") based on user prompts and materials ("Inputs"), including text prompts, reference images, uploads, and other content.

AI outputs may be inaccurate, unexpected, or offensive. You are responsible for your use of Outputs and for ensuring compliance with applicable laws and third-party rights.

4. Plans, credits, and changes

4.1 Subscription credits (monthly reset)

Paid plans include a monthly credit allocation ("Subscription Credits") that resets every 30 days. Unless we explicitly state otherwise:

Unused Subscription Credits do not roll over.

Subscription benefits apply only while your subscription is active and in good standing.

4.2 Credit packs (paid users)

Paid users may purchase additional credit packs ("Pack Credits") subject to the Billing Policy:

Pack Credits are non-transferable, not redeemable for cash, and generally non-refundable except where required by law.

Pack Credits expire as stated at purchase (currently: 90 days).

4.3 Changes

We may change pricing, plan features, credit costs, and expiration rules. We will provide notice where reasonably possible (e.g., on tkoeen.net, in-product, or by email).

5. Visibility and publishing (Public Gallery)

5.1 Free plan: public by default

On the Free plan, your generated Outputs may be published to a public gallery by default ("Public Gallery"). Public content may be viewable by other users and shareable.

Do not generate or include personal data, confidential information, or content you do not have rights to publish—especially on the Free plan.

5.2 Paid plans: private by default

On paid plans, Outputs are private by default. You may choose to publish Outputs to the Public Gallery using available controls.

5.3 Removal and caching

If you publish content publicly and later delete it or make it private, we will remove it from our Public Gallery where reasonably possible. However:

copies may remain in backups/logs/caches for a limited time, and

third parties may have already viewed, saved, shared, or re-posted the content.

6. Your content, ownership, and licenses

6.1 Your Inputs

You retain any rights you have in your Inputs. You represent that you have the necessary rights to submit Inputs and that doing so does not violate any law or third-party rights.

6.2 Outputs

To the extent permitted by applicable law, you may use Outputs you generate. We do not guarantee Outputs are unique or non-infringing, and similar outputs may be generated for other users.

6.3 License you grant to us

You grant us a worldwide, non-exclusive, royalty-free license to host, store, reproduce, process, and display your Inputs and Outputs only as needed to operate, secure, and provide the Service (including safety checks, moderation, abuse prevention, and support).

If you publish content to the Public Gallery, you additionally grant us a license to display, distribute, and promote that public content within the Service and in marketing for the Service, until you remove it from public visibility.

7. No training on user content

We do not use your Inputs or Outputs to train AI models. We may process content to provide the Service (generation, security, moderation, support), but not for training.

8. Prohibited use and Content Policy

You may not use the Service to create, upload, publish, or share content that violates our Content Policy / Acceptable Use Policy (including illegal content, IP infringement, harassment, sexual content involving minors, privacy violations, or non-consensual likeness use).

We may block requests, remove content, restrict features, suspend, or terminate accounts for violations.

9. Third-party services

The Service may rely on third-party providers (hosting, analytics, payments, and AI inference). Their services may change or become unavailable. We are not responsible for third-party downtime or changes outside our control.

10. Termination

You may stop using the Service at any time. We may suspend or terminate your account if:

you violate these Terms or policies,

we are required by law, or

your use creates risk or harm.

Upon termination, access ends. Credits may be forfeited as described in the Billing Policy, except where prohibited by law.

11. Disclaimers

The Service is provided "as is" and "as available." We do not warrant uninterrupted or error-free operation, or that outputs will meet your requirements or be non-infringing.

12. Limitation of liability

To the maximum extent permitted by law:

we are not liable for indirect, incidental, special, consequential, or punitive damages, or loss of profits, revenue, data, goodwill, or business opportunities.

our total liability for any claim related to the Service will not exceed the amount you paid to us in the 3 months prior to the event giving rise to the claim.

13. Indemnity

You agree to defend, indemnify, and hold harmless Cehail from claims arising out of your Inputs, Outputs, your use of the Service, or your violation of these Terms/policies.

14. Governing law and jurisdiction

These Terms are governed by the laws of the Kingdom of Saudi Arabia. Disputes will be subject to the competent courts of Riyadh, Saudi Arabia, unless mandatory law requires otherwise.

15. Changes to these Terms

We may update these Terms. We will post the updated version with a new "Last updated" date. Continued use means acceptance.

16. Contact

Support: support@tkoeen.net
Legal/Administration: admin@tkoeen.net`
    },
    ar: {
      title: "شروط الخدمة",
      lastUpdated: "آخر تحديث: يناير 2026",
      content: `تحكم شروط الخدمة هذه ("الشروط") استخدامك ووصولك إلى tkoeen.net ("الخدمة")، والتي تديرها شركة Cehail International ("سهيل" أو "نحن"). بإنشاء حساب أو استخدام الخدمة، فإنك توافق على هذه الشروط.

إذا لم توافق على الشروط، لا تستخدم الخدمة.

1. من نحن

تدار الخدمة بواسطة شركة سهيل الدولية المسجلة في المملكة العربية السعودية.
الاسم القانوني: شركة سهيل الدولية
السجل التجاري: [CR NUMBER]
الرقم الضريبي (إن وجد): [VAT NUMBER]
العنوان: [COMPANY ADDRESS]
الدعم: support@tkoeen.net
الإدارة/الشؤون القانونية: admin@tkoeen.net

2. الأهلية والحسابات

يجب أن يكون عمرك 18 عامًا على الأقل (أو سن الرشد القانوني في بلدك، أيهما أعلى).

أنت مسؤول عن جميع الأنشطة التي تتم عبر حسابك وعن حماية بيانات الدخول.

يجب تقديم معلومات صحيحة وتحديثها عند الحاجة.

يجوز لنا تعليق الحساب أو إيقافه عند مخالفة هذه الشروط أو سياساتنا.

3. الخدمة والمحتوى المُولّد بالذكاء الاصطناعي

تتيح الخدمة إنشاء صور و/أو فيديوهات ("المخرجات") اعتمادًا على مدخلات المستخدم ("المدخلات") مثل النصوص، الصور المرجعية، الملفات المرفوعة، وغيرها.

قد تكون المخرجات غير دقيقة أو غير متوقعة أو غير مناسبة. أنت مسؤول عن استخدامك للمخرجات وعن الالتزام بالأنظمة والحقوق الخاصة بالغير.

4. الخطط والرصيد (Credits) والتغييرات

4.1 رصيد الاشتراك (إعادة ضبط شهرية)

تتضمن الخطط المدفوعة رصيدًا شهريًا ("رصيد الاشتراك") يُعاد ضبطه كل 30 يومًا. ما لم نذكر خلاف ذلك صراحة:

الرصيد غير المستخدم لا ينتقل للشهر التالي.

مزايا الاشتراك متاحة فقط طالما الاشتراك فعّال وبحالة سليمة.

4.2 باقات الرصيد الإضافية

يمكن للمستخدمين المدفوعين شراء باقات رصيد إضافية ("رصيد الباقات") وفق سياسة الفوترة:

رصيد الباقات غير قابل للتحويل، وغير قابل للاستبدال نقدًا، وعادةً غير قابل للاسترداد إلا إذا تطلب النظام ذلك.

رصيد الباقات ينتهي حسب ما يظهر عند الشراء (حاليًا: 90 يومًا).

4.3 التغييرات

قد نغيّر الأسعار أو مزايا الخطط أو تكلفة الاستهلاك أو مدة الانتهاء، وسنقدم إشعارًا عند الإمكان (داخل tkoeen.net أو داخل المنتج أو عبر البريد).

5. الخصوصية والنشر (المعرض العام)

5.1 الخطة المجانية: عام افتراضيًا

في الخطة المجانية قد يتم نشر المخرجات في معرض عام افتراضيًا ("المعرض العام") بحيث تكون قابلة للمشاهدة والمشاركة من الآخرين.

تجنب توليد أو تضمين بيانات شخصية أو معلومات سرية أو أي محتوى لا تملك حق نشره—خصوصًا في الخطة المجانية.

5.2 الخطط المدفوعة: خاص افتراضيًا

في الخطط المدفوعة تكون المخرجات خاصة افتراضيًا، ويمكنك اختيار نشرها في المعرض العام عبر أدوات التحكم المتاحة.

5.3 الحذف والتخزين المؤقت

إذا نشرت محتوى علنًا ثم حذفته أو جعلته خاصًا، سنزيله من المعرض العام قدر الإمكان، لكن:

قد تبقى نسخ لفترة محدودة في النسخ الاحتياطية/السجلات/التخزين المؤقت،

وقد يكون طرف ثالث قد حفظ أو شارك المحتوى بالفعل.

6. الملكية والتراخيص

6.1 المدخلات

تحتفظ بحقوقك في المدخلات. وتقر بأن لديك الحق النظامي لاستخدامها ورفعها وأن ذلك لا ينتهك حقوق الغير.

6.2 المخرجات

بقدر ما يسمح به النظام، يمكنك استخدام المخرجات التي تنشئها. لا نضمن تفرد المخرجات أو خلوها من تعارضات حقوقية، وقد تتشابه مخرجات مستخدمين مختلفين.

6.3 الترخيص الممنوح لنا

تمنحنا ترخيصًا عالميًا غير حصري وخاليًا من الرسوم لاستضافة المدخلات والمخرجات وتخزينها ومعالجتها وعرضها بالقدر اللازم لتشغيل الخدمة وتأمينها وتقديمها (بما في ذلك التحقق الأمني، الإشراف، منع الإساءة، والدعم).

وعند نشر المحتوى في المعرض العام تمنحنا كذلك ترخيصًا لعرضه وتوزيعه والترويج له داخل الخدمة وتسويق الخدمة إلى حين إزالة المحتوى من العرض العام.

7. عدم التدريب على محتوى المستخدم

نحن لا نستخدم مدخلاتك أو مخرجاتك لتدريب نماذج الذكاء الاصطناعي. قد نعالج المحتوى لتقديم الخدمة (التوليد، الأمان، الإشراف، الدعم) دون استخدامه للتدريب.

8. الاستخدام المحظور وسياسة المحتوى

يُحظر استخدام الخدمة لإنشاء/رفع/نشر محتوى يخالف سياسة المحتوى/الاستخدام المقبول (مثل المحتوى غير النظامي، انتهاك الملكية الفكرية، التحرش، أي محتوى جنسي يتعلق بقاصر، انتهاك الخصوصية أو استخدام صورة شخص دون موافقة).

قد نمنع الطلبات أو نزيل المحتوى أو نقيّد الميزات أو نعلّق/نوقف الحساب عند المخالفة.

9. خدمات الأطراف الثالثة

قد تعتمد الخدمة على مزودين خارجيين (استضافة، تحليلات، مدفوعات، تشغيل نماذج). قد تتغير خدماتهم أو تتعطل. لسنا مسؤولين عن أعطال أو تغييرات خارجة عن سيطرتنا.

10. إنهاء الخدمة

يمكنك التوقف عن الاستخدام في أي وقت. ويمكننا تعليق أو إنهاء حسابك عند المخالفة أو الالتزام النظامي أو وجود مخاطر.

عند الإنهاء ينتهي وصولك للخدمة. وقد يتم فقدان الرصيد وفق سياسة الفوترة ما لم يمنع النظام ذلك.

11. إخلاء المسؤولية

تقدم الخدمة "كما هي" و"حسب التوفر". لا نضمن عدم الانقطاع أو خلو الأخطاء أو أن المخرجات ستلبي احتياجاتك أو تخلو من تعارضات حقوقية.

12. حدود المسؤولية

بالحد الأقصى الذي يسمح به النظام:

لا نتحمل مسؤولية الأضرار غير المباشرة أو التبعية أو الخاصة أو العقابية أو فقد الأرباح/البيانات/السمعة.

إجمالي مسؤوليتنا عن أي مطالبة لا يتجاوز ما دفعته لنا خلال 3 أشهر قبل الواقعة.

13. التعويض

توافق على تعويض Cehail International وحمايتها من أي مطالبات ناتجة عن مدخلاتك أو مخرجاتك أو استخدامك للخدمة أو مخالفتك للشروط/السياسات.

14. القانون والاختصاص

تخضع هذه الشروط لأنظمة المملكة العربية السعودية، وتكون جهة الاختصاص محاكم الرياض بالمملكة العربية السعودية، ما لم يفرض النظام خلاف ذلك.

15. تحديث الشروط

قد نحدّث الشروط. سننشر النسخة المحدثة بتاريخ جديد. استمرار الاستخدام يعني قبول التحديث.

16. التواصل

الدعم: support@tkoeen.net
الإدارة/الشؤون القانونية: admin@tkoeen.net`
    }
  },
  privacy: {
    en: {
      title: "Privacy Policy",
      lastUpdated: "Last updated: January 2026",
      content: `This Privacy Policy explains how Cehail International ("we") collects, uses, and shares information when you use tkoeen.net.

1. Information we collect

We may collect:

Account data: name, email, login identifiers.

Usage/device data: IP address, device/browser info, logs, timestamps, performance and error data.

Inputs and Outputs: prompts, uploads, reference media, and generated images/videos, plus visibility status.

Billing data: subscription status, invoices/transaction IDs (payments are handled by payment providers; we do not store full card details).

Cookies: for sessions, preferences, analytics, and security (see Cookie Policy).

2. How we use information

We use information to:

operate the Service (generation, accounts, credits),

secure the Service, prevent fraud/abuse, and enforce policies,

provide support and troubleshoot,

process billing and purchases,

improve performance and user experience.

3. Public Gallery notice

Free plan outputs may be public by default. Paid plan outputs are private by default unless you choose to publish. Avoid generating or publishing personal data or confidential information.

4. No training on user content

We do not use your Inputs or Outputs to train AI models.

5. Sharing

We may share data with:

service providers (hosting, storage, analytics, email, payment processors, AI inference providers),

authorities where required by law,

advisors/partners as needed to protect rights and safety,

in a business transfer (merger/acquisition) with appropriate safeguards.

We do not sell your personal data.

6. International processing

Your data may be processed outside Saudi Arabia depending on provider locations. We take reasonable steps to apply safeguards.

7. Retention

We retain information as needed to provide the Service, comply with law, resolve disputes, and enforce agreements. Backups may persist for a limited time.

8. Your choices

You may request access, correction, or deletion where applicable.
Contact: admin@tkoeen.net (privacy requests) or support@tkoeen.net (support).

9. Security

We use reasonable safeguards, but no system is completely secure.

10. Children

The Service is not intended for users under 18. If you believe a child provided data, contact us to remove it.

Contact: support@tkoeen.net | admin@tkoeen.net`
    },
    ar: {
      title: "سياسة الخصوصية",
      lastUpdated: "آخر تحديث: يناير 2026",
      content: `توضح هذه السياسة كيفية جمع Cehail International ("نحن") للبيانات واستخدامها ومشاركتها عند استخدامك tkoeen.net.

1. البيانات التي نجمعها

قد نجمع:

بيانات الحساب: الاسم، البريد الإلكتروني، معرّفات الدخول.

بيانات الاستخدام/الجهاز: عنوان IP، معلومات المتصفح/الجهاز، سجلات الاستخدام، بيانات الأداء والأخطاء.

المدخلات والمخرجات: النصوص والملفات المرفوعة والوسائط المرجعية والمخرجات (صور/فيديو)، وحالة العرض (عام/خاص).

بيانات الفوترة: حالة الاشتراك ومعرّفات العمليات/الفواتير (تتم المدفوعات عبر مزودين خارجيين ولا نخزن بيانات البطاقة كاملة).

ملفات تعريف الارتباط: للجلسات والتفضيلات والتحليلات والأمان (انظر سياسة الكوكيز).

2. كيف نستخدم البيانات

نستخدم البيانات من أجل:

تشغيل الخدمة (التوليد، الحسابات، الرصيد)،

حماية الخدمة ومنع الاحتيال والإساءة وتطبيق السياسات،

الدعم الفني ومعالجة الأعطال،

معالجة الفوترة والمشتريات،

تحسين الأداء وتجربة المستخدم.

3. إشعار المعرض العام

مخرجات الخطة المجانية قد تكون عامة افتراضيًا. مخرجات الخطط المدفوعة خاصة افتراضيًا ما لم تختر نشرها.

تجنب إنشاء أو نشر بيانات شخصية أو معلومات سرية.

4. عدم التدريب على محتوى المستخدم

نحن لا نستخدم المدخلات أو المخرجات لتدريب نماذج الذكاء الاصطناعي.

5. مشاركة البيانات

قد نشارك البيانات مع:

مزودي الخدمة (استضافة، تخزين، تحليلات، بريد، مدفوعات، تشغيل نماذج)،

الجهات الرسمية عند الالتزام النظامي،

جهات استشارية عند الحاجة لحماية الحقوق والسلامة،

عند نقل ملكية أو اندماج مع تطبيق ضوابط مناسبة.

لا نبيع بياناتك الشخصية.

6. المعالجة خارج السعودية

قد تتم المعالجة خارج المملكة حسب مواقع مزودينا. نتخذ إجراءات معقولة لتطبيق ضوابط حماية مناسبة.

7. الاحتفاظ

نحتفظ بالبيانات بالقدر اللازم لتقديم الخدمة والالتزام النظامي وحل النزاعات وتطبيق الاتفاقيات. وقد تبقى نسخ احتياطية لفترة محدودة.

8. خياراتك

يمكنك طلب الوصول أو التصحيح أو الحذف وفق ما يتيحه النظام.

لطلبات الخصوصية: admin@tkoeen.net

للدعم: support@tkoeen.net

9. الأمان

نطبق إجراءات حماية معقولة، ولا يوجد نظام آمن بنسبة 100%.

10. الأطفال

الخدمة غير مخصصة لمن هم دون 18 عامًا. إذا تعتقد أن طفلًا قدم بيانات، تواصل معنا لحذفها.

التواصل: support@tkoeen.net | admin@tkoeen.net`
    }
  },
  cookies: {
    en: {
      title: "Cookie Policy",
      lastUpdated: "Last updated: January 2026",
      content: `tkoeen.net uses cookies and similar technologies to operate and improve the Service.

Strictly necessary: login sessions, security, fraud prevention.

Functional: preferences and settings.

Analytics: understand usage and improve performance.

You can manage cookies through your browser settings. Disabling some cookies may affect functionality (such as staying logged in).

Contact: admin@tkoeen.net`
    },
    ar: {
      title: "سياسة ملفات تعريف الارتباط",
      lastUpdated: "آخر تحديث: يناير 2026",
      content: `يستخدم tkoeen.net ملفات تعريف الارتباط وتقنيات مشابهة لتشغيل الخدمة وتحسينها.

ضرورية: جلسات تسجيل الدخول، الأمان، منع الاحتيال.

وظيفية: التفضيلات والإعدادات.

تحليلية: فهم الاستخدام وتحسين الأداء.

يمكنك التحكم بالكوكيز عبر إعدادات المتصفح. تعطيل بعض الكوكيز قد يؤثر على عمل بعض الميزات (مثل بقاء تسجيل الدخول).

التواصل: admin@tkoeen.net`
    }
  },
  "content-policy": {
    en: {
      title: "Content Policy / Acceptable Use",
      lastUpdated: "Last updated: January 2026",
      content: `You may not use tkoeen.net to create, upload, publish, or share content that is illegal, harmful, or violates others' rights. Prohibited content includes:

Sexual content involving minors (zero tolerance).

Sexual content (including "revenge" content).

Hate, harassment, threats, or incitement.

Graphic violence/gore intended to shock.

Privacy violations (IDs, addresses, phone numbers, private documents, doxxing).

Impersonation and deceptive deepfakes: realistic depictions of real people without consent, or content intended to deceive.

IP infringement: copyrighted materials, trademark/logos used unlawfully.

Spam/abuse: automation abuse, attempts to bypass limits or safety.

Public Gallery: Public content must be suitable for broad audiences and must not include sensitive personal data or confidential information.

Enforcement: We may block requests, remove content, restrict features, suspend, or terminate accounts.

Report: support@tkoeen.net | admin@tkoeen.net`
    },
    ar: {
      title: "سياسة المحتوى والاستخدام المقبول",
      lastUpdated: "آخر تحديث: يناير 2026",
      content: `يُحظر استخدام tkoeen.net لإنشاء أو رفع أو نشر أو مشاركة محتوى غير نظامي أو ضار أو ينتهك حقوق الآخرين. يشمل المحتوى المحظور:

أي محتوى جنسي يتعلق بقاصر (منع تام).

محتوى جنسي (بما في ذلك ما يسمى "الانتقام").

الكراهية أو التحرش أو التهديد أو التحريض.

عنف شديد/دموي بهدف الصدمة.

انتهاك الخصوصية (هويات، عناوين، أرقام، مستندات خاصة، نشر بيانات شخصية).

الانتحال والمواد المضللة: تصوير واقعي لأشخاص حقيقيين دون موافقة أو محتوى يهدف للخداع.

انتهاك الملكية الفكرية: مواد محمية أو شعارات/علامات دون حق.

الإزعاج والإساءة: إساءة الاستخدام الآلي ومحاولات تجاوز القيود أو الأمان.

المعرض العام: يجب أن يكون المحتوى العام مناسبًا للجميع وألا يتضمن بيانات شخصية حساسة أو معلومات سرية.

التنفيذ: قد نمنع الطلبات أو نزيل المحتوى أو نقيّد الميزات أو نعلّق/نوقف الحساب.

الإبلاغ: support@tkoeen.net | admin@tkoeen.net`
    }
  },
  billing: {
    en: {
      title: "Billing, Subscriptions, Credits & Refunds",
      lastUpdated: "Last updated: January 2026",
      content: `This policy explains payments, subscriptions, and credits on tkoeen.net.

1) Plans and monthly credit reset

Credits included in plans reset every 30 days.

Current monthly prices/credits (as displayed on the pricing page):

Free: 0.00 SAR / month — 200 credits / month

Basic: 99.99 SAR / month — 1,850 credits / month

Pro: 200.00 SAR / month — 3,700 credits / month

Annual billing may be available with a discount (e.g., "Save 20%") as shown at checkout.

Unused subscription credits do not roll over unless explicitly stated.

2) Credit packs (paid plan required)

Credit packs require an active paid plan:

Pro Pack: 5,000 credits — 225.00 SAR — expires in 90 days

Studio Pack: 13,000 credits — 500.00 SAR — expires in 90 days

Pack credits are non-transferable and not redeemable for cash.

3) What credits mean

Credits are a prepaid unit used to access generation features. Different tools/models may consume different credits. We show current credit costs inside the product and may update them.

4) Renewals and cancellation

Subscriptions renew automatically unless canceled before renewal.

If canceled, access continues until the end of the current billing period.

Downgrading to Free means Free plan visibility rules may apply (public by default).

5) Refunds

Because the Service provides immediate digital access and credits are consumable:

Subscription fees are generally non-refundable once a billing period begins, except where required by law.

Credit packs are generally non-refundable once purchased, except where required by law.

For billing issues, contact admin@tkoeen.net within 7 days of the charge.

6) Chargebacks

Chargebacks may result in temporary suspension while we investigate. Fraudulent chargebacks may lead to termination.

Contact: admin@tkoeen.net | support@tkoeen.net`
    },
    ar: {
      title: "سياسة الفوترة",
      lastUpdated: "آخر تحديث: يناير 2026",
      content: `توضح هذه السياسة المدفوعات والاشتراكات والرصيد (Credits) في tkoeen.net.

1) الخطط وإعادة ضبط الرصيد شهريًا

الرصيد ضمن الخطط يُعاد ضبطه كل 30 يومًا.

الأسعار/الرصيد الشهري الحالي (حسب صفحة التسعير):

مجاني: 0.00 ريال/شهر — 200 رصيد/شهر

Basic: 99.99 ريال/شهر — 1,850 رصيد/شهر

Pro: 200.00 ريال/شهر — 3,700 رصيد/شهر

قد يتوفر الدفع السنوي بخصم (مثل "وفر 20%") حسب ما يظهر عند الدفع.

الرصيد غير المستخدم لا ينتقل للشهر التالي ما لم يُذكر خلاف ذلك صراحة.

2) باقات الرصيد (تتطلب خطة مدفوعة)

شراء الباقات يتطلب اشتراكًا مدفوعًا فعالًا:

Pro Pack: 5,000 رصيد — 225.00 ريال — ينتهي خلال 90 يومًا

Studio Pack: 13,000 رصيد — 500.00 ريال — ينتهي خلال 90 يومًا

رصيد الباقات غير قابل للتحويل وغير قابل للاستبدال نقدًا.

3) معنى الرصيد

الرصيد هو وحدة مسبقة الدفع لاستخدام ميزات التوليد. قد تختلف تكلفة الاستهلاك حسب الأداة/النموذج. نعرض تكلفة الرصيد داخل المنتج وقد نقوم بتحديثها.

4) التجديد والإلغاء

يتم التجديد تلقائيًا ما لم يتم الإلغاء قبل موعد التجديد.

عند الإلغاء يستمر الوصول حتى نهاية الفترة الحالية.

عند الرجوع للخطة المجانية قد تنطبق قواعد العرض (عام افتراضيًا).

5) الاسترداد

نظرًا لأن الخدمة رقمية فورية والرصيد قابل للاستهلاك:

رسوم الاشتراك عادةً غير قابلة للاسترداد بعد بدء الفترة، إلا إذا تطلب النظام ذلك.

باقات الرصيد عادةً غير قابلة للاسترداد بعد الشراء، إلا إذا تطلب النظام ذلك.

لمشكلات الفوترة: admin@tkoeen.net خلال 7 أيام من العملية.

6) الاعتراضات البنكية (Chargeback)

قد يؤدي الاعتراض إلى تعليق مؤقت أثناء التحقيق. الاعتراضات الاحتيالية قد تؤدي لإيقاف الحساب.

التواصل: admin@tkoeen.net | support@tkoeen.net`
    }
  },
  copyright: {
    en: {
      title: "Copyright & IP Policy",
      lastUpdated: "Last updated: January 2026",
      content: `We respect intellectual property rights. If you believe content on tkoeen.net infringes your rights, email admin@tkoeen.net with:

Your name and contact details

Identification of the work/right being infringed

Identification of the allegedly infringing content (link/screenshot + details)

A good-faith statement that the use is unauthorized

A statement that the information is accurate

Your signature (typed is acceptable)

We may remove or restrict the content and may take action against repeat infringers.`
    },
    ar: {
      title: "سياسة الملكية الفكرية والإزالة",
      lastUpdated: "آخر تحديث: يناير 2026",
      content: `نحترم حقوق الملكية الفكرية. إذا تعتقد أن محتوى على tkoeen.net ينتهك حقوقك، راسل admin@tkoeen.net مع:

اسمك وبيانات التواصل

تحديد العمل/الحق محل الانتهاك

تحديد المحتوى المشتبه (رابط/لقطة شاشة + تفاصيل)

إقرار بحسن نية بأن الاستخدام غير مصرح به

إقرار بصحة المعلومات

توقيعك (كتابة الاسم كافية)

قد نقوم بإزالة المحتوى أو تقييده واتخاذ إجراءات ضد المخالفين المتكررين.`
    }
  },
  "gallery-terms": {
    en: {
      title: "Public Gallery Terms",
      lastUpdated: "Last updated: January 2026",
      content: `Visibility: Public content may be viewable by others and shareable.

Free plan default: Free plan generations may be public by default.

Do not publish: personal data, confidential information, or content you lack rights to publish.

Removal: We will remove public content from our gallery where reasonably possible, but we cannot control third-party copying/caching/re-posting.

Enforcement: We may remove public content for policy, legal, or safety reasons.

Contact: support@tkoeen.net | admin@tkoeen.net`
    },
    ar: {
      title: "شروط المعرض العام",
      lastUpdated: "آخر تحديث: يناير 2026",
      content: `الظهور: المحتوى العام يمكن أن يراه الآخرون ويمكن مشاركته.

الخطة المجانية: قد تكون المخرجات عامة افتراضيًا.

لا تنشر: بيانات شخصية أو معلومات سرية أو محتوى لا تملك حق نشره.

الحذف: سنزيل المحتوى من معرضنا قدر الإمكان، لكن لا يمكننا التحكم في نسخ أو تخزين أو إعادة نشر أطراف أخرى.

التنفيذ: قد نزيل المحتوى العام لأسباب تتعلق بالسياسات أو القانون أو السلامة.

التواصل: support@tkoeen.net | admin@tkoeen.net`
    }
  },
  notice: {
    en: {
      title: "Legal Notice",
      lastUpdated: "Last updated: January 2026",
      content: `Website: tkoeen.net

Operator: Cehail International (Saudi Arabia)

Commercial Registration (CR): [CR NUMBER]

VAT: [VAT NUMBER, if applicable]

Address: [COMPANY ADDRESS]

Support: support@tkoeen.net

Legal/Administration: admin@tkoeen.net`
    },
    ar: {
      title: "إشعار قانوني",
      lastUpdated: "آخر تحديث: يناير 2026",
      content: `الموقع: tkoeen.net

الجهة المشغلة: Cehail International المملكة العربية السعودية

السجل التجاري: [CR NUMBER]

الرقم الضريبي: [VAT NUMBER]

العنوان: [COMPANY ADDRESS]

الدعم: support@tkoeen.net

الإدارة/الشؤون القانونية: admin@tkoeen.net`
    }
  }
};

type LegalPageType = keyof typeof legalContent;

const legalPages: { key: LegalPageType; labelEn: string; labelAr: string }[] = [
  { key: "terms", labelEn: "Terms of Service", labelAr: "شروط الخدمة" },
  { key: "privacy", labelEn: "Privacy Policy", labelAr: "سياسة الخصوصية" },
  { key: "cookies", labelEn: "Cookie Policy", labelAr: "سياسة ملفات تعريف الارتباط" },
  { key: "content-policy", labelEn: "Content Policy", labelAr: "سياسة المحتوى" },
  { key: "billing", labelEn: "Billing Policy", labelAr: "سياسة الفوترة" },
  { key: "copyright", labelEn: "Copyright", labelAr: "الملكية الفكرية" },
  { key: "gallery-terms", labelEn: "Gallery Terms", labelAr: "شروط المعرض" },
  { key: "notice", labelEn: "Legal Notice", labelAr: "إشعار قانوني" },
];

export default function LegalPage() {
  const { i18n } = useTranslation();
  const [, params] = useRoute("/legal/:page");
  const isRTL = i18n.language === 'ar';
  const lang = isRTL ? 'ar' : 'en';
  
  const pageKey = (params?.page || 'terms') as LegalPageType;
  const pageContent = legalContent[pageKey];
  
  if (!pageContent) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl text-white mb-4">Page not found</h1>
          <Link href="/">
            <span className="text-purple-400 hover:text-purple-300 cursor-pointer">Go back home</span>
          </Link>
        </div>
      </div>
    );
  }

  const content = pageContent[lang];

  return (
    <div 
      className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <div className="max-w-4xl mx-auto px-4 py-12">
        <Link href="/">
          <span className="inline-flex items-center gap-2 text-white/60 hover:text-white mb-8 cursor-pointer transition-colors">
            {isRTL ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
            {isRTL ? 'العودة للرئيسية' : 'Back to Home'}
          </span>
        </Link>

        <div className="bg-gray-800/50 rounded-2xl p-8 backdrop-blur-sm border border-white/10">
          <h1 
            className="text-3xl font-bold text-white mb-2"
            style={{ fontFamily: isRTL ? 'Cairo, sans-serif' : 'inherit' }}
          >
            {content.title}
          </h1>
          <p className="text-white/50 text-sm mb-8">{content.lastUpdated}</p>

          <div 
            className="prose prose-invert max-w-none"
            style={{ fontFamily: isRTL ? 'Cairo, sans-serif' : 'inherit' }}
          >
            <div className="whitespace-pre-line text-white/80 leading-relaxed">
              {content.content}
            </div>
          </div>
        </div>

        <div className="mt-12">
          <h2 className="text-white/60 text-sm mb-4">
            {isRTL ? 'صفحات قانونية أخرى' : 'Other Legal Pages'}
          </h2>
          <div className="flex flex-wrap gap-3">
            {legalPages
              .filter(p => p.key !== pageKey)
              .map(page => (
                <Link key={page.key} href={`/legal/${page.key}`}>
                  <span className="px-4 py-2 bg-gray-800/50 rounded-lg text-white/60 hover:text-white hover:bg-gray-700/50 transition-colors cursor-pointer text-sm">
                    {isRTL ? page.labelAr : page.labelEn}
                  </span>
                </Link>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
