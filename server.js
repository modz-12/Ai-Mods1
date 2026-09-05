require('dotenv').config();

const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

const express = require('express');
const multer = require('multer');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const store = require('./store');
const { resolveLink } = require('./linkUtils');

const app = express();

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const MAX_FILE_SIZE_MB = Number(process.env.MAX_FILE_SIZE_MB || 200);
const SITE_NAME = process.env.SITE_NAME || 'المعرض';

const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// --- أمان أساسي ---
app.use(
  helmet({
    contentSecurityPolicy: false, // معطّل عشان مايمنعش تضمين يوتيوب/فيميو وملفات الميديا؛ فعّلها وعدّلها لو محتاج تشديد أكتر
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);
app.use(express.json({ limit: '1mb' }));

// حد أقصى للطلبات اللي بتضيف أو تحذف، عشان نمنع سبام
const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'محاولات كتير في وقت قصير، حاول تاني بعد شوية.' },
});

// --- التحقق من كلمة سر الأدمن ---
function requireAdmin(req, res, next) {
  if (!ADMIN_PASSWORD) return next(); // مفيش كلمة سر متظبطة = الموقع مفتوح
  const provided = req.header('x-admin-password') || '';
  if (provided === ADMIN_PASSWORD) return next();
  return res.status(401).json({ error: 'كلمة السر غلط أو ناقصة' });
}

app.get('/api/config', (req, res) => {
  res.json({ siteName: SITE_NAME, requiresPassword: Boolean(ADMIN_PASSWORD) });
});

app.post('/api/admin/check', (req, res) => {
  const { password } = req.body || {};
  if (!ADMIN_PASSWORD) return res.json({ ok: true });
  res.json({ ok: password === ADMIN_PASSWORD });
});

// --- رفع الملفات ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeExt = /^[a-zA-Z0-9.]+$/.test(ext) ? ext : '';
    cb(null, `${crypto.randomUUID()}${safeExt}`);
  },
});

const ALLOWED_MIME = /^(image\/(jpeg|png|gif|webp|avif|svg\+xml)|video\/(mp4|webm|ogg|quicktime))$/;

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE_MB * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME.test(file.mimetype)) return cb(null, true);
    cb(new Error('نوع الملف مش مدعوم'));
  },
});

app.use('/uploads', express.static(UPLOADS_DIR, { maxAge: '30d' }));
app.use(express.static(path.join(__dirname, 'public')));

// --- عرض الميديا (مع فلترة وبحث وترقيم صفحات) ---
app.get('/api/media', async (req, res) => {
  const { type = 'all', search = '', page = '1', limit = '24' } = req.query;
  const result = await store.list({
    type: String(type),
    search: String(search),
    page: Math.max(1, parseInt(page, 10) || 1),
    limit: Math.min(60, Math.max(1, parseInt(limit, 10) || 24)),
  });
  res.json(result);
});

// --- رفع ملفات جديدة (صور/فيديوهات) ---
app.post('/api/media/upload', writeLimiter, requireAdmin, (req, res) => {
  upload.array('files', 20)(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'فشل الرفع' });
    }
    const files = req.files || [];
    if (files.length === 0) {
      return res.status(400).json({ error: 'مفيش ملفات اتبعتت' });
    }

    const titleBase = (req.body.title || '').trim();
    const created = [];

    for (const file of files) {
      const isVideo = file.mimetype.startsWith('video/');
      const item = {
        id: crypto.randomUUID(),
        title: titleBase || file.originalname.replace(/\.[^.]+$/, ''),
        type: isVideo ? 'video' : 'image',
        source: 'upload',
        src: `/uploads/${file.filename}`,
        embedUrl: null,
        thumbnail: isVideo ? null : `/uploads/${file.filename}`,
        createdAt: Date.now(),
      };
      await store.add(item);
      created.push(item);
    }

    res.status(201).json({ items: created });
  });
});

// --- إضافة عن طريق رابط ---
app.post('/api/media/link', writeLimiter, requireAdmin, async (req, res) => {
  const { url, title, type } = req.body || {};
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'لازم تكتب رابط صحيح' });
  }

  let parsed;
  try {
    new URL(url);
  } catch {
    return res.status(400).json({ error: 'الرابط ده مش صحيح' });
  }

  parsed = resolveLink(url, type || 'auto');
  if (!parsed) {
    return res.status(422).json({
      error: 'مقدرتش أحدد نوع الرابط ده تلقائي، اختار "صورة" أو "فيديو" يدوي وجرب تاني',
    });
  }

  const item = {
    id: crypto.randomUUID(),
    title: (title || '').trim() || 'بدون عنوان',
    type: parsed.type,
    source: parsed.source,
    src: parsed.src,
    embedUrl: parsed.embedUrl,
    thumbnail: parsed.thumbnail,
    createdAt: Date.now(),
  };

  await store.add(item);
  res.status(201).json({ items: [item] });
});

// --- حذف عنصر ---
app.delete('/api/media/:id', writeLimiter, requireAdmin, async (req, res) => {
  const removed = await store.remove(req.params.id);
  if (!removed) return res.status(404).json({ error: 'العنصر ده مش موجود' });

  if (removed.source === 'upload' && removed.src) {
    const filePath = path.join(__dirname, removed.src.replace(/^\//, ''));
    fs.unlink(filePath, () => {}); // نتجاهل الخطأ لو الملف مش موجود أصلاً
  }

  res.json({ ok: true });
});

// أي مسار تاني يرجّع صفحة الموقع (SPA بسيطة)
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) {
    return res.status(404).json({ error: 'غير موجود' });
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`✅ ${SITE_NAME} شغال على http://localhost:${PORT}`);
});
