# MODZ Firebase Gallery

نسخة جاهزة للنشر على Vercel ومتصلة بمشروع Firebase `modz-11`.

## الخدمات المستخدمة
- Firebase Authentication لتسجيل دخول الإدارة.
- Cloud Firestore لحفظ بيانات الوسائط.
- Firebase Storage لحفظ الصور والفيديوهات.
- Firebase Analytics.
- Vercel لاستضافة الواجهة.

## قبل النشر
1. في Firebase Console فعّل Authentication > Email/Password.
2. أنشئ مستخدم الإدارة.
3. يجب إعطاء المستخدم custom claim باسم `admin=true` حتى تسمح القواعد بالرفع والحذف.
4. فعّل Firestore.
5. فعّل Storage. ملاحظة: Cloud Storage for Firebase يتطلب حالياً خطة Blaze.
6. انشر القواعد الموجودة داخل `firebase/`.

### إعطاء admin claim
Custom Claims لا تُعطى من كود المتصفح. استخدم Firebase Admin SDK من بيئة موثوقة، ثم:
`admin.auth().setCustomUserClaims(USER_UID, {admin:true})`

بعد تسجيل الدخول من جديد سيظهر زر إضافة الملفات.

## Vercel
ارفع مجلد المشروع إلى GitHub ثم Import Project في Vercel. لا تحتاج إلى Node server أو Express؛ المشروع Static بالكامل.

## مهم
ملف Firebase config الخاص بتطبيق الويب ليس سراً بحد ذاته. الحماية الحقيقية تكون بواسطة Authentication وFirestore/Storage Security Rules.
