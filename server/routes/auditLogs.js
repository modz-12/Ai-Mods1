'use strict';

const express = require('express');
const { db } = require('../firebase-admin');
const { requireAuth, requireRole } = require('../auth');

const router = express.Router();

router.get('/', requireAuth, requireRole('owner'), async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
  const snap = await db.collection('auditLogs').orderBy('createdAt', 'desc').limit(limit).get();
  const items = [];
  snap.forEach((d) => items.push({ id: d.id, ...d.data() }));
  res.json({ items });
});

module.exports = router;
