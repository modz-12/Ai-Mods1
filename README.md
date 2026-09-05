# Farm World — Complete Web Game

## تشغيل سريع على Vercel
ارفع محتويات هذا المجلد إلى مشروع Vercel كما هي.
الصفحة الرئيسية هي `index.html`.

## Firebase
المشروع يستخدم:
- Firebase Authentication: Email/Password
- Cloud Firestore
- Firebase Analytics إذا كان مدعومًا

لا يحتاج هذا الإصدار إلى Firebase Storage.

## Firestore
مسار الحفظ:
`players/{uid}/game/state`

انسخ محتوى `firestore.rules` إلى:
Firebase Console → Firestore Database → Rules
ثم اضغط Publish.

## Authentication
من Firebase Console:
Authentication → Sign-in method → Email/Password → Enable

## ملاحظات مهمة
- شاشة التحميل لا تعتمد على Firebase؛ لذلك لا تتجمد عند 0% بسبب Firestore.
- حفظ اللعبة يتم عند الطلب، تلقائيًا بعد التعديلات، كل 60 ثانية، وعند إخفاء الصفحة.
- لا تعتمد القواعد على إخفاء عناصر الواجهة؛ Firestore Rules هي طبقة الحماية الفعلية.
- نظام المحاصيل والحيوانات مبني على تعريفات قابلة للتوسعة.

## بنية المشروع
index.html
css/core.css
css/game.css
js/firebase.js
js/app.js
firestore.rules
firebase.json
README.md
