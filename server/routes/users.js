'use strict';

const express = require('express');
const admin = require('firebase-admin');
const { db } = require('../firebase-admin');
const { requireAuth, requireRole } = require('../auth');

const router = express.Router();

router.get('/me', requireAuth, async (req, res) => {
  const profileSnap = await db.collection('profiles').doc(req.user.uid).get();
  res.json({ user: req.user, profile: profileSnap.exists ? profileSnap.data() : null });
});

router.put('/me/profile', requireAuth, async (req, res) => {
  const displayName = (req.body?.displayName || '').toString().trim().slice(0, 80);
  const bio = (req.body?.bio || '').toString().trim().slice(0, 300);
  if (!displayName) return res.status(400).json({ error: 'الاسم مطلوب.' });

  const now = admin.firestore.FieldValue.serverTimestamp();
  await db.collection('profiles').doc(req.user.uid).set({ displayName, bio, updatedAt: now }, { merge: true });
  await require('../firebase-admin').auth.updateUser(req.user.uid, { displayName }).catch((err) => {
    console.warn('[users] failed to sync Auth displayName (non-fatal):', err.message);
  });

  res.json({ ok: true });
});

router.get('/', requireAuth, requireRole('owner'), async (req, res) => {
  const snap = await db.collection('users').orderBy('createdAt', 'desc').limit(500).get();
  const items = [];
  snap.forEach((d) => items.push({ id: d.id, ...d.data() }));
  res.json({ items });
});

router.post('/:uid/disable', requireAuth, requireRole('owner'), async (req, res) => {
  const ref = db.collection('users').doc(req.params.uid);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ error: 'غير موجود.' });
  if (snap.data().role === 'owner') return res.status(400).json({ error: 'لا يمكن تعطيل المالك.' });
  await ref.update({ status: 'disabled', updatedAt: admin.firestore.FieldValue.serverTimestamp() });
  res.json({ ok: true });
});

router.post('/:uid/enable', requireAuth, requireRole('owner'), async (req, res) => {
  const ref = db.collection('users').doc(req.params.uid);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ error: 'غير موجود.' });
  await ref.update({ status: 'active', updatedAt: admin.firestore.FieldValue.serverTimestamp() });
  res.json({ ok: true });
});

module.exports = router;
