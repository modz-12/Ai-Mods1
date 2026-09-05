# موقع الأنمي — مسلسلات، ريلز، وألبومات صور

موقع Next.js متكامل مبني على Firebase (Auth + Firestore + Storage)، جاهز للنشر على Vercel.

## المميزات

- **مسلسلات**: كل مسلسل بيبان بيه حلقات، كل حلقة فيديو مرفوع أو رابط يوتيوب/فيميو
- **ريلز**: فيديوهات قصيرة مستقلة، بتتفتح في نافذة سريعة
- **ألبومات صور**: مجموعات صور متعددة العناوين، بعارض صور كبير
- **حسابات مستخدمين** (تسجيل/دخول بالبريد) + **أدمن** بصلاحيات كاملة
- **تعليقات** على أي محتوى، **مفضلة** لكل مستخدم
- كل الحماية عن طريق Firestore & Storage Security Rules (مش الكود بتاع الموقع) — حتى لو حد لعب في الطلبات من المتصفح مش هيقدر يتخطاها

## الإعداد خطوة بخطوة

### ١. أنشئ مشروع Firebase

1. روح [console.firebase.google.com](https://console.firebase.google.com) واعمل مشروع جديد.
2. من **Authentication** → فعّل طريقة **Email/Password**.
3. من **Firestore Database** → أنشئ قاعدة بيانات (اختار وضع الإنتاج، مش مهم لأننا هننشر الـ rules بنفسنا).
4. من **Storage** → فعّله (هيطلب منك تختار Billing Plan؛ الخطة المجانية Spark كفاية للبداية).
5. من **Project Settings** → **Your apps** → أضف **Web App**، وانسخ بيانات الإعداد (apiKey, authDomain... إلخ).

### ٢. الإعداد المحلي

```bash
npm install
cp .env.local.example .env.local   # واملأ بيانات Firebase اللي نسختها
npm run dev
```

### ٣. نشر قواعد الحماية على Firebase

```bash
npm install -g firebase-tools
firebase login
firebase use --add   # اختار المشروع اللي عملته
firebase deploy --only firestore:rules,firestore:indexes,storage
```

⚠️ **مهم جدًا**: من غير ما تنشر `firestore.rules` و `storage.rules`، Firebase بيشتغل بقواعد افتراضية إما تمنع كل حاجة أو تسمح بكل حاجة — لازم تتأكد إن القواعد اتنشرت قبل ما تفتح الموقع للناس.

### ٤. اعمل أول حساب أدمن

مفيش طريقة من الموقع نفسه لحد يرفّع نفسه أدمن (ده مقصود، عشان الأمان). الخطوات:

1. اعمل حساب عادي من صفحة "حساب جديد" في الموقع.
2. روح Firebase Console → Firestore Database → collection `users` → دور على المستند بتاع الحساب ده (الـ ID هو نفسه الـ UID بتاعه من Authentication).
3. غيّر قيمة `role` من `"user"` لـ `"admin"` يدويًا.
4. ارجع للموقع واعمل تسجيل خروج ودخول تاني، هتلاقي "لوحة التحكم" ظهرت.

### ٥. النشر على Vercel

1. ارفع المشروع على GitHub.
2. من [vercel.com](https://vercel.com) → Import Project → اختار الـ repo.
3. في Environment Variables ضيف كل المتغيرات اللي في `.env.local.example` (بنفس الأسماء `NEXT_PUBLIC_...`).
4. Deploy.

Vercel بتستضيف الموقع بس (الكود والصفحات) — قاعدة البيانات والملفات فاضلة على Firebase زي ما هي، والقواعد اللي نشرتها في خطوة ٣ هي اللي بتحمي البيانات دايمًا، مهما كان الموقع شغال منين.

## هيكل البيانات في Firestore

```
users/{uid}                 → { email, displayName, role: 'user'|'admin', createdAt }
titles/{id}                 → { name, description, genres[], coverUrl, published, createdBy, createdAt }
titles/{id}/episodes/{id}   → { number, title, videoType, videoUrl, embedUrl, thumbnail, published, createdAt }
reels/{id}                  → { title, videoType, videoUrl, embedUrl, thumbnail, published, createdBy, createdAt }
albums/{id}                 → { title, description, coverUrl, photoCount, published, createdBy, createdAt }
albums/{id}/photos/{id}     → { url, caption, order, createdAt }
{any}/{id}/comments/{id}    → { userId, userName, text, createdAt }
favorites/{uid}/items/{id}  → { type, refId, title, cover, addedAt }
```

## ملفات الحماية

- `firestore.rules` — قواعد قاعدة البيانات (مين يقرا/يكتب إيه)
- `storage.rules` — قواعد الملفات المرفوعة (صور/فيديوهات)
- `firestore.indexes.json` — الفهارس المركّبة المطلوبة لاستعلامات "المنشور + الأحدث"

لو غيّرت أي حاجة في القواعد، لازم تعمل `firebase deploy --only firestore:rules,storage` تاني عشان التغيير يتفعّل.

## تحسينات ممكنة مستقبلاً

- بحث حقيقي (Algolia/Typesense) بدل الفلترة البسيطة في المتصفح
- توليد صور مصغّرة تلقائي للفيديوهات المرفوعة
- إشعارات للمستخدمين لما تتضاف حلقة جديدة لمسلسل في مفضلتهم
- صفحة "طلبات المستخدمين" يقترحوا فيها مسلسلات يتضافوا
