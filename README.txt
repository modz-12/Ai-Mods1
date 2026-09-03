ANIME-PRO — دليل المشروع
=========================

الهيكل:
--------
index.html
img.html
video.html
relz.html
film.html

Gojo/
  img/
    Jujutsu-Kaisen/
      data.js
      001.jpg ... 100.jpg
    Naruto/
      data.js
      001.jpg ... 100.jpg
    index.js

  video/
    Jujutsu-Kaisen/data.js + ملفات الفيديو
    Naruto/data.js + ملفات الفيديو
    index.js

  relz/
    Jujutsu-Kaisen/data.js + ملفات الريلز
    Naruto/data.js + ملفات الريلز
    index.js

  film/
    Jujutsu-Kaisen/data.js + الفيلم والبوستر
    Naruto/data.js + الفيلم والبوستر
    index.js

Yuta/
  pages.js
  firebase.js
  firestore.rules

طريقة إضافة مانجا/قصة جديدة:
----------------------------
1) أنشئ:
   Gojo/img/اسم-العمل/

2) ضع داخل المجلد:
   data.js
   001.jpg
   002.jpg
   ...
   100.jpg

3) داخل data.js استخدم:
   const manga = {
      id: "work-id",
      title: "اسم العمل",
      description: "وصف العمل",
      pages: [
        {
          number: 1,
          image: "./001.jpg",
          title: "عنوان الصفحة",
          events: "أحداث الصفحة",
          description: "شرح الصفحة"
        }
      ]
   };
   export { manga };

4) افتح Gojo/img/index.js وأضف:
   import { manga as newWork } from "./اسم-العمل/data.js";
   ثم أضف newWork إلى imageWorks.

إضافة فيديو:
------------
Gojo/video/اسم-العمل/
  data.js
  001.mp4
ثم أضف الاستيراد إلى Gojo/video/index.js.

إضافة Reel:
-----------
Gojo/relz/اسم-العمل/
  data.js
  001.mp4
ثم أضف الاستيراد إلى Gojo/relz/index.js.

إضافة فيلم:
-----------
Gojo/film/اسم-العمل/
  data.js
  film.mp4
  poster.jpg
ثم أضف الاستيراد إلى Gojo/film/index.js.

قاعدة البيانات:
---------------
Yuta/firebase.js يتصل بـ Firebase Firestore وAnonymous Authentication.
يتم حفظ:
- المشاهدات داخل stats
- الإعجابات داخل stats + reactions
- التعليقات داخل comments
- الأكثر مشاهدة يعتمد على views

مهم:
-----
ملفات HTML تستخدم ES Modules، لذلك لا تفتحها عادةً بالنقر المباشر file://.
استخدم Live Server أو استضافة مثل Firebase Hosting / Vercel / أي static server.

Firebase:
---------
ضع firestore.rules في إعدادات مشروع Firebase أو انشرها باستخدام Firebase CLI:
firebase deploy --only firestore:rules

وفعّل:
Authentication > Sign-in method > Anonymous

الصور والفيديوهات:
------------------
المشروع يحتوي على أسماء ملفات جاهزة، لكن الصور والفيديوهات نفسها ليست مرفقة.
استبدلها بملفاتك الفعلية داخل مجلد العمل.

الأمان:
-------
apiKey في واجهة Firebase ليست كلمة سر لقاعدة البيانات.
الحماية الحقيقية تكون من خلال Authentication وFirestore Rules.
لا تضع مفاتيح سرية أو Service Account داخل ملفات HTML/JS.
