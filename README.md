# AI MODZ — Personal AI Knowledge Platform V4

منصة معرفة يتحكم بها صاحبها بالكامل: **Firebase** هو مصدر الحقيقة الوحيد للمعرفة،
و**Gemini** هو محرك اللغة فقط (فهم السياق، الصياغة، اكتشاف المجال) — لا يخزَّن أي شيء
دائم داخله ولا تُعتمد إجاباته تلقائيًا كمعرفة رسمية.

كل مفتاح سري (Gemini API Key, Firebase Service Account) موجود على الـ Backend فقط.
لا يوجد أي مفتاح سري في أي ملف داخل `public/`.

---

## 1) شجرة المشروع

```
ai-modz/
├── package.json
├── .env.example
├── .gitignore
├── firebase.json
├── README.md
│
├── server/
│   ├── server.js              # نقطة الدخول: Express + الأمان + تركيب الـ routes
│   ├── firebase-admin.js      # تهيئة Admin SDK (سري، خادم فقط)
│   ├── auth.js                # التحقق من التوكن + فرض الأدوار (user/moderator/owner)
│   ├── gemini.js              # كل تعاملات Gemini (سري، خادم فقط)
│   ├── retrieval.js           # محرك البحث الدلالي داخل Knowledge
│   ├── memory.js              # ذاكرة المحادثة لكل مستخدم/محادثة
│   ├── audit.js               # كتابة سجلات Audit Logs
│   └── routes/
│       ├── chat.js            # المسار الرئيسي: Knowledge -> Gemini -> Memory -> geminiData
│       ├── conversations.js
│       ├── knowledge.js       # CRUD + Versioning
│       ├── feedback.js
│       ├── geminiData.js      # مراجعة/اعتماد بيانات Gemini كمعرفة
│       ├── moderators.js      # ترقية/تعطيل مشرفين (Owner فقط)
│       ├── users.js
│       ├── instructions.js
│       ├── team.js            # محادثات الإدارة الخاصة
│       ├── dashboard.js       # إحصائيات لوحة المالك
│       ├── auditLogs.js
│       └── search.js
│
├── public/
│   ├── index.html
│   ├── app.js                 # كل منطق الواجهة (Vanilla JS + Firebase Auth/Firestore Client)
│   └── style.css
│
├── firebase/
│   ├── firestore.rules
│   ├── firestore.indexes.json
│   └── storage.rules
│
├── scripts/
│   └── set-role.js            # ترقية أول Owner (يعمل مرة واحدة خارج الـ API)
│
└── docs/
    └── SETUP.md
```

---

## 2) التثبيت

```bash
npm install
```

## 3) الإعداد

```bash
cp .env.example .env
```

ثم عدّل `.env`:

| المتغير | الوصف |
|---|---|
| `GEMINI_API_KEY` | من Google AI Studio — انظر القسم 6 أدناه |
| `GEMINI_MODEL` | مثل `gemini-2.5-flash` |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | مسار ملف مفتاح الخدمة (انظر القسم 5) |
| `OWNER_BOOTSTRAP_EMAIL` | بريدك — يُستخدم مرة واحدة فقط لترقيتك إلى Owner |

راجع `docs/SETUP.md` لخطوات مفصّلة بالصور النصية لكل قسم.

## 4) التشغيل

```bash
npm start
```

الموقع يعمل على `http://localhost:3000`. صفحة واحدة (`public/index.html`) تُخدَّم من نفس
السيرفر الذي يقدّم الـ API، فلا حاجة لإعداد CORS في بيئة الإنتاج البسيطة.

## 5) ربط Firebase (باختصار — التفاصيل في docs/SETUP.md)

1. المشروع `ai-modz` موجود بالفعل بإعداداته داخل `public/app.js` (Firebase Web Config
   — هذا **ليس** سرًا، فهو نفس الإعداد الذي يراه أي زائر لأي موقع Firebase).
2. من Firebase Console: فعّل **Authentication → Email/Password**.
3. أنشئ قاعدة بيانات **Firestore** (Production mode).
4. من **Project Settings → Service Accounts → Generate new private key**، نزّل الملف
   وضعه في جذر المشروع باسم `firebase-service-account.json` (هذا الملف **لا يُرفع أبدًا**
   لأي مكان عام — موجود في `.gitignore`).
5. انشر القواعد والفهارس:
   ```bash
   npm install -g firebase-tools   # مرة واحدة فقط
   firebase login
   firebase use ai-modz
   firebase deploy --only firestore:rules,firestore:indexes,storage
   ```
6. سجّل حساب عادي من الموقع نفسه (Register)، ثم عيّن بريدك في
   `OWNER_BOOTSTRAP_EMAIL` وشغّل:
   ```bash
   npm run set-owner
   ```
   سجّل خروج ثم دخول من جديد في الموقع لتصبح Owner فعليًا.

## 6) الحصول على Gemini API Key

1. افتح <https://aistudio.google.com/apikey>.
2. اضغط **Create API key**، اختر مشروع Google Cloud (أو أنشئ واحدًا).
3. انسخ المفتاح وضعه في `GEMINI_API_KEY` داخل `.env`.

> ملاحظة: `GOOGLE_API_KEY` و`GOOGLE_CX` **غير مطلوبين إطلاقًا**. الموقع يعمل بالكامل
> بدونهما. إن كان حساب/نموذج Gemini لديك يدعم أداة Google Search المدمجة وأردت
> تفعيلها، عيّن `GEMINI_ENABLE_SEARCH_TOOL=true` في `.env` — وإلا اتركه `false` ولن
> يتأثر عمل المنصة.

---

## 7) كيف تتكامل الأجزاء فعليًا (وليس بشكل منفصل)

كل رسالة في `/api/chat` تمر فعليًا بالتسلسل التالي (`server/routes/chat.js`):

1. **Memory** (`memory.js`): تحميل آخر رسائل نفس المحادثة (خاصة بهذا المستخدم فقط).
2. **Retrieval** (`retrieval.js`): تطبيع + Tokenize + تسجيل تشابه ضد كل وثائق
   `knowledge` المعتمدة (سؤال أساسي، كلمات بحث، أسئلة مشابهة).
3. **Gemini** (`gemini.js`): يستقبل أفضل نتائج Knowledge + سياق المحادثة، ويصوغ الرد
   — ويُمنع صراحة (عبر System Instruction) من اختلاق تفاصيل ونسبتها للمعرفة المحلية.
4. **Firestore**: يُحفظ كل من رسالة المستخدم والرد في `conversationMessages`، ويُحدَّث
   `usageCount` لأي معلومة استُخدمت فعليًا.
5. إن لم توجد معرفة محلية كافية → يُنشأ سجل في `geminiData` تلقائيًا (وليس معرفة
   رسمية) بانتظار مراجعة **Moderator**.
6. المستخدم يقيّم الرد (👍/👎/✨) → `feedback` → مراجعة **Moderator** → عند القبول
   يُنشأ إصدار جديد في `knowledgeVersions` ويُحدَّث `knowledge` مباشرة.
7. اعتماد بيانات Gemini من طرف **Moderator** ينشئ وثيقة `knowledge` جديدة فعليًا
   (وليس مجرد تغيير حالة)، ويُسجَّل الكل في `auditLogs` و`moderatorData`.
8. **Owner** يرى كل هذه التدفقات مجمّعة في `/api/dashboard/stats` و`/api/audit-logs`.

هذا التسلسل مطبَّق بالكامل في الكود (وليس وصفًا نظريًا) — جرّب: أضف معلومة كمشرف،
اسأل عنها بصياغة مختلفة تمامًا في المحادثة، لاحظ زيادة `usageCount`، ثم راجع
`مساهماتي` و`سجل العمليات` لترى نفس العملية مسجّلة في كل مكان.

---

## 8) الأدوار والصلاحيات

الأدوار الثلاثة (`user`, `moderator`, `owner`) محفوظة في Firestore
(`users/{uid}.role`) و**لا يمكن لأي كود في المتصفح تغييرها** — `firestore.rules`
تمنع صراحة تعديل حقل `role` من طرف العميل، والترقية/التعطيل الفعلي يتم فقط عبر
`server/routes/moderators.js` باستخدام Admin SDK (`auth.setCustomUserClaims` +
تحديث Firestore بمعاملة واحدة).

---

## 9) الأمان المطبَّق فعليًا

- Helmet (رؤوس أمان + CSP صارم)
- Rate limiting عام (60 طلب/دقيقة) وخاص بالمحادثة (20 رسالة/دقيقة)
- حد حجم الطلب (200kb)
- التحقق من كل حقل مُدخَل وتقصيره (`sanitizeIncoming` في `knowledge.js`)
- Markdown آمن في الواجهة: كل النص يُهرَّب (`escapeHtml`) قبل إعادة إدخال تنسيق محدود
  يدويًا — لا `innerHTML` لأي نص خام من مستخدم أو من Gemini
- لا مفاتيح سرية في أي ملف داخل `public/`
- لا تسجيل لمفاتيح API في الـ logs
