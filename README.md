# MODZ CSS

مكتبة **CSS خالصة** (CSS ONLY) — بدون JavaScript، بدون Framework، بدون
Dependencies خارجية، بدون Fonts أو Images خارجية. أكثر من **2300 class**
حقيقي وفعّال، كل واحد منها يقوم بعمل CSS مفيد وليس اسمًا فقط.

- **CDN (رابط ثابت بعد النشر):** `https://modz-styles.vercel.app/modz.css`
- **نسخة مصغّرة:** `https://modz-styles.vercel.app/modz.min.css`
- **بادئة موحّدة لكل الأصناف:** `mz-` (لا تتعارض أبدًا مع CSS مشروعك)
- **الإصدار:** `1.0.0`

---

## 1. الاستخدام

أضف سطر CSS واحد فقط في `<head>` أي صفحة:

```html
<link rel="stylesheet" href="https://modz-styles.vercel.app/modz.min.css">
```

ثم استخدم الأصناف مباشرة، بدون أي HTML خاص وبدون أي JavaScript:

```html
<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="https://modz-styles.vercel.app/modz.min.css">
</head>
<body>

  <p class="mz-circle mz-bg-purple-500 mz-glow-purple mz-text-white">
    MODZ
  </p>

  <div class="mz-glass mz-radius-xl mz-shadow-lg" style="padding:1.5rem;">
    Content
  </div>

  <h1 class="mz-text-gradient mz-text-5xl mz-font-black">
    MODZ CSS
  </h1>

</body>
</html>
```

المكتبة نفسها (`modz.css` / `modz.min.css`) **CSS فقط** — لا تحتاج أي
`<script>`، ولا `npm install`، ولا أي JavaScript runtime لتعمل.

---

## 2. هيكل المشروع

```
modz-css/
├── index.html            (يُستخدم فقط لبناء الصفحة، غير مطلوب في الإنتاج)
├── build.py              (يولّد كل ملفات src/*.css ثم dist/modz.css)
├── build_docs_data.py    (يولّد public/docs-data.json لصفحة التوثيق)
├── package.json
├── vercel.json
├── src/                  (29+ ملف CSS مقسّم حسب القسم)
│   ├── reset.css
│   ├── variables.css
│   ├── colors.css
│   ├── shapes.css
│   ├── 3d.css
│   ├── glow.css
│   ├── borders.css
│   ├── radius.css
│   ├── shadows.css
│   ├── glass.css
│   ├── gradients.css
│   ├── typography.css
│   ├── spacing.css
│   ├── sizing.css
│   ├── flex.css
│   ├── grid.css
│   ├── position.css
│   ├── display.css
│   ├── overflow.css
│   ├── transforms.css
│   ├── transitions.css
│   ├── animations.css
│   ├── hover.css
│   ├── filters.css
│   ├── backgrounds.css
│   ├── images.css
│   ├── effects.css
│   ├── aspect.css
│   ├── opacity.css
│   ├── responsive.css
│   ├── accessibility.css
│   ├── theme.css
│   └── modz.css          (تجميع كل ما سبق، غير مصغّر)
├── dist/
│   ├── modz.css           (الملف الكامل، للتطوير والقراءة)
│   └── modz.min.css       (النسخة المصغّرة — هذه التي تُستخدم في CDN)
└── public/                (هذا هو مجلد النشر على Vercel)
    ├── index.html          (صفحة التوثيق / Playground)
    ├── docs.css            (تنسيق صفحة التوثيق فقط — ليست جزءًا من المكتبة)
    ├── docs.js             (تفاعل صفحة التوثيق فقط — ليست جزءًا من المكتبة)
    ├── docs-data.json      (بيانات كل الأصناف، لصفحة التوثيق)
    ├── modz.css
    └── modz.min.css
```

**مهم جدًا:** `docs.js` يخدم فقط صفحة التوثيق (البحث، المعاينة الحيّة، زر
Copy). المكتبة نفسها (`modz.css` / `modz.min.css`) لا تحمّله ولا تعتمد
عليه بأي شكل — يمكنك حذف كل ملفات `public/*.js` وتبقى المكتبة تعمل
بشكل كامل.

---

## 3. إعادة البناء (Build)

كل الأصناف تُولَّد برمجيًا (لضمان عدم وجود تكرار وعدم وجود Fake
Features)، ثم يتم تجميعها وتصغيرها:

```bash
npm run build
# يشغّل:
#   python3 build.py           -> يعيد توليد src/*.css و dist/modz.css و dist/modz.min.css
#   python3 build_docs_data.py -> يعيد توليد public/docs-data.json
#   وينسخ dist/*.css إلى public/
```

للتحقق من عدد الأصناف الفريدة:

```bash
npm run count
```

لا حاجة لأي حزمة npm خارجية — `build.py` مكتوب بـ Python القياسية فقط،
والمخرج النهائي (`public/`) ملفات ثابتة بالكامل.

---

## 4. النشر على Vercel

المشروع Static بالكامل: لا Server، لا Database، لا Backend.

1. اربط المستودع بـ Vercel.
2. `vercel.json` يضبط `outputDirectory` على `public/` تلقائيًا.
3. بعد الـ Deploy:
   - `https://modz-styles.vercel.app/modz.css` → الملف الكامل (`text/css`)
   - `https://modz-styles.vercel.app/modz.min.css` → النسخة المصغّرة
   - `https://modz-styles.vercel.app/` → صفحة التوثيق والـ Playground

---

## 5. أمثلة إضافية

```html
<div class="mz-cube mz-cube-lg mz-cube-glow"></div>

<div class="mz-grid mz-grid-3 mz-gap-4">
  <div class="mz-glass mz-radius-lg mz-p-4">1</div>
  <div class="mz-glass mz-radius-lg mz-p-4">2</div>
  <div class="mz-glass mz-radius-lg mz-p-4">3</div>
</div>

<button class="mz-3d-button mz-glow-purple mz-hover-lift">
  Click me
</button>

<p class="mz-animate-fade-up mz-animate-infinite mz-text-neon">
  Loading MODZ...
</p>
```

---

## 6. الإصدار وCSS Variables

```css
:root {
  --mz-version: "1.0.0";
}
```

جميع الألوان، المسافات، الظلال، والانتقالات معرّفة كـ CSS Custom
Properties في `src/variables.css` ويمكن تخصيصها بسهولة من مشروعك عبر
Override على `:root`.

---

## 7. الالتزامات الأساسية للمكتبة

- ✅ CSS فقط — بدون JavaScript.
- ✅ بدون React / Vue / Tailwind / Bootstrap.
- ✅ بدون Components تحتاج HTML خاص — كل شيء Utility classes.
- ✅ بدون Fonts أو Images خارجية.
- ✅ بادئة `mz-` لكل شيء، بدون استثناء.
- ✅ `prefers-reduced-motion` مطبّق على كل الحركات.
- ✅ أكثر من 2300 class حقيقي، بدون تكرار، بدون placeholders.
