# Modz Library Hub v1

نواة Design System & Component Library Hub تعتمد على HTML/CSS/JavaScript.

## التشغيل

يتطلب Node.js حديثًا:

```bash
npm run manifest
npm run dev
```

ثم افتح عنوان الخادم المحلي.

## إضافة ملفات جديدة

- CSS → `css/`
- JavaScript → `js/`
- HTML Components → `components/`

بعد الإضافة:

```bash
npm run manifest
```

لا تحتاج إلى تعديل `index.html`.

## لماذا Manifest؟

الـ browser لا يملك API قياسيًا لاستعراض محتويات مجلد Static على جميع الاستضافات. لذلك يقوم `generate-manifest.js` بفحص المجلدات وقت البناء وإنشاء `library.manifest.json`.

## التوسع

الواجهة لا ترسم كل العناصر في DOM مرة واحدة. تستخدم:

- Manifest Registry
- Search
- Filtering
- Pagination
- Lazy content fetch
- Cache داخل الذاكرة
- DocumentFragment

عند الوصول إلى عشرات الآلاف من العناصر، يمكن لاحقًا استبدال الـ Manifest بـ API/Database مع إبقاء واجهة المستخدم كما هي.
