# Farm World
لعبة مزرعة Web قابلة للتوسع.

## التشغيل
1. افتح Firebase Console.
2. فعّل Authentication > Sign-in method > Email/Password.
3. أنشئ Firestore Database.
4. ضع محتوى `firestore.rules` في تبويب Rules وانشره.
5. ارفع الملفات على استضافة تدعم ES Modules (Vercel / Firebase Hosting / GitHub Pages).
6. افتح `index.html`.

## الحفظ
كل لاعب لديه:
`players/{uid}/game/state`

القواعد تمنع اللاعب من قراءة أو تعديل تقدم لاعب آخر.

## الصورة
خلفية شاشة التحميل والمصادقة تستخدم:
https://files.catbox.moe/vex2qr.jpg

## التوسع
نظام المحاصيل والحيوانات مبني على تعريفات مستقلة، لذلك يمكن إضافة Cow/Buffalo/Chicken وغيرها لاحقًا بدون إعادة تصميم المحرك.
