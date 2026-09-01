'use strict';

require('dotenv').config();

const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

const app = express();

// ---- Security headers ----
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", 'https://www.gstatic.com'],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: [
          "'self'",
          'https://*.googleapis.com',
          'https://*.firebaseio.com',
          'https://firestore.googleapis.com',
          'wss://*.firebaseio.com',
        ],
        fontSrc: ["'self'", 'data:'],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

// ---- CORS (only relevant if the frontend is hosted separately) ----
const allowedOrigins = (process.env.CORS_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean);
app.use(
  cors({
    origin: allowedOrigins.length ? allowedOrigins : true,
    credentials: true,
  })
);

app.use(compression());

// ---- Request size limits ----
app.use(express.json({ limit: '200kb' }));

// ---- Rate limiting ----
const generalLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 60000,
  max: Number(process.env.RATE_LIMIT_MAX) || 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'طلبات كثيرة جدًا في وقت قصير. حاول لاحقًا.' },
});
const chatLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 60000,
  max: Number(process.env.CHAT_RATE_LIMIT_MAX) || 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'وصلت للحد الأقصى من الرسائل هذه الدقيقة. حاول بعد قليل.' },
});
app.use('/api/', generalLimiter);
app.use('/api/chat', chatLimiter);

// ---- API routes ----
app.use('/api/chat', require('./routes/chat'));
app.use('/api/conversations', require('./routes/conversations'));
app.use('/api/knowledge', require('./routes/knowledge'));
app.use('/api/feedback', require('./routes/feedback'));
app.use('/api/gemini-data', require('./routes/geminiData'));
app.use('/api/moderators', require('./routes/moderators'));
app.use('/api/users', require('./routes/users'));
app.use('/api/instructions', require('./routes/instructions'));
app.use('/api/team', require('./routes/team'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/audit-logs', require('./routes/auditLogs'));
app.use('/api/search', require('./routes/search'));

app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

// ---- Static frontend ----
app.use(express.static(path.join(__dirname, '..', 'public')));
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// ---- Central error handler (never leak stack traces / secrets) ----
app.use((err, req, res, next) => {
  console.error('[unhandled]', err);
  res.status(500).json({ error: 'حدث خطأ غير متوقع في الخادم.' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`AI MODZ server running on http://localhost:${PORT}`);
});
