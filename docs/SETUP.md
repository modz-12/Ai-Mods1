# دليل الإعداد التفصيلي — AI MODZ

## أ) Firebase

### 1. تفعيل Authentication
Firebase Console → مشروع `ai-modz` → **Build → Authentication → Get started**
→ فعّل مزود **Email/Password**.

### 2. إنشاء Firestore
**Build → Firestore Database → Create database** → اختر **Production mode**
واختر أقرب موقع خادم لك.

### 3. مفتاح Service Account (سري — للخادم فقط)
**⚙️ Project settings → Service accounts → Generate new private key**.
سيُنزَّل ملف JSON. انقله إلى جذر المشروع باسم:

```
ai-modz/firebase-service-account.json
```

هذا الملف موجود مسبقًا في `.gitignore` — لا تشاركه ولا ترفعه لأي Git عام أبدًا.

بديل (للاستضافة السحابية التي لا تقبل رفع ملفات، مثل Render/Railway): افتح الملف،
انسخ محتواه كاملًا (JSON) وضعه كسطر واحد في متغير البيئة `FIREBASE_SERVICE_ACCOUNT_JSON`
بدلًا من `FIREBASE_SERVICE_ACCOUNT_PATH`.

### 4. نشر القواعد والفهارس
```bash
npm install -g firebase-tools
firebase login
firebase use --add          # اختر مشروع ai-modz وامنحه أي اسم مستعار (alias)
firebase deploy --only firestore:rules,firestore:indexes,storage
```

### 5. أول Owner
1. شغّل السيرفر (`npm start`) وسجّل حسابًا عاديًا من الموقع نفسه.
2. في `.env` ضع `OWNER_BOOTSTRAP_EMAIL=البريد_الذي_سجّلت_به`.
3. نفّذ:
   ```bash
   npm run set-owner
   ```
4. سجّل خروج ثم دخول من جديد في الموقع — ستظهر لك الآن قوائم **المالك** في الشريط
   الجانبي.

> لماذا سكربت خارجي وليس زر في الواجهة؟ لأن ترقية أول Owner هي العملية الوحيدة التي
> يجب ألا تكون قابلة للوصول إطلاقًا من المتصفح أو من أي مستخدم آخر — تمامًا كما طلبت
> في المواصفات (القسم 13).

## ب) Gemini API Key

1. افتح <https://aistudio.google.com/apikey> وسجّل دخولك بحساب Google.
2. **Create API key** → اختر مشروع Google Cloud موجود أو أنشئ واحدًا جديدًا.
3. انسخ المفتاح إلى `.env`:
   ```
   GEMINI_API_KEY=AIza...
   GEMINI_MODEL=gemini-2.5-flash
   ```
4. (اختياري) إن كان حسابك يدعم أداة **Google Search grounding** المدمجة في Gemini
   وتريد تفعيلها كخطة احتياطية عندما لا توجد معرفة محلية:
   ```
   GEMINI_ENABLE_SEARCH_TOOL=true
   ```
   بدون أي حاجة لـ `GOOGLE_API_KEY` أو `GOOGLE_CX` منفصلين — الموقع يعمل بشكل كامل
   حتى لو تركت هذا `false`.

## ج) التحقق من أن كل شيء متصل فعليًا

بعد تسجيل الدخول كـ Owner:

1. اذهب لـ **قاعدة المعرفة → إضافة معلومة**، أضف معلومة تجريبية بسؤال وكلمات بحث.
2. اذهب لـ **المحادثة**، اسأل بصياغة مختلفة تمامًا عن نفس المعنى — يجب أن يستخدم
   الرد المعلومة (شارة "من قاعدة المعرفة" ستظهر تحت الرد).
3. اسأل سؤالًا لا علاقة له بأي معلومة موجودة — سيُجيب Gemini، وسيظهر السؤال تلقائيًا
   في **بيانات Gemini** بانتظار المراجعة.
4. من نفس الصفحة اضغط **مراجعة واعتماد** — ستصبح معلومة رسمية فورًا وتظهر في
   **قاعدة المعرفة**.
5. من صفحة **مساهماتي** سترى كل عملية أضفتها لحظيًا (Firestore Realtime).
6. من **سجل العمليات** (Owner) سترى نفس الأحداث مسجّلة بالكامل (`ADD_KNOWLEDGE`,
   `APPROVE_KNOWLEDGE`, `GEMINI_QUERY`...).

إذا ظهرت هذه السلسلة متصلة أمامك، فهذا يعني أن Gemini → Firebase → Knowledge →
Memory → Feedback → Moderator → Owner تعمل فعليًا كنظام واحد مترابط، وليس أجزاء
منفصلة.
