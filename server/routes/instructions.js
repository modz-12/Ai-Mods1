'use strict';

const express = require('express');
const admin = require('firebase-admin');
const { db } = require('../firebase-admin');
const { requireAuth, requireRole } = require('../auth');
const { writeAuditLog } = require('../audit');

const router = express.Router();

router.get('/', requireAuth, requireRole('owner'), async (req, res) => {
  const snap = await db.collection('instructions').orderBy('createdAt', 'desc').get();
  const items = [];
  snap.forEach((d) => items.push({ id: d.id, ...d.data() }));
  res.json({ items });
});

router.post('/', requireAuth, requireRole('owner'), async (req, res) => {
  const text = (req.body?.text || '').toString().trim().slice(0, 1000);
  if (!text) return res.status(400).json({ error: 'نص التعليمة مطلوب.' });
  const now = admin.firestore.FieldValue.serverTimestamp();
  const ref = db.collection('instructions').doc();
  await ref.set({ text, active: true, createdBy: req.user.uid, createdAt: now });
  await writeAuditLog({ actorId: req.user.uid, actorRole: 'owner', action: 'UPDATE_INSTRUCTION', targetId: ref.id, metadata: { text } });
  res.status(201).json({ id: ref.id });
});

router.post('/:id/toggle', requireAuth, requireRole('owner'), async (req, res) => {
  const ref = db.collection('instructions').doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ error: 'غير موجود.' });
  const next = !snap.data().active;
  await ref.update({ active: next });
  await writeAuditLog({ actorId: req.user.uid, actorRole: 'owner', action: 'UPDATE_INSTRUCTION', targetId: req.params.id, metadata: { active: next } });
  res.json({ ok: true, active: next });
});

module.exports = router;
