'use strict';

const express = require('express');
const admin = require('firebase-admin');
const { db, auth } = require('../firebase-admin');
const { requireAuth, requireRole } = require('../auth');
const { writeAuditLog } = require('../audit');

const router = express.Router();

// List moderator profiles (owner sees all; moderators see the public team directory).
router.get('/', requireAuth, requireRole('moderator'), async (req, res) => {
  const snap = await db.collection('moderatorProfiles').get();
  const items = [];
  snap.forEach((d) => items.push({ id: d.id, ...d.data() }));
  res.json({ items });
});

// Search by name / staffId (spec 15).
router.get('/search', requireAuth, requireRole('moderator'), async (req, res) => {
  const q = (req.query.q || '').toString().trim().toLowerCase();
  if (!q) return res.json({ items: [] });
  const snap = await db.collection('moderatorProfiles').get();
  const items = [];
  snap.forEach((d) => {
    const v = d.data();
    if ((v.name || '').toLowerCase().includes(q) || (v.staffId || '').toLowerCase().includes(q)) {
      items.push({ id: d.id, ...v });
    }
  });
  res.json({ items });
});

// Promote a user to moderator. Owner only.
router.post('/promote', requireAuth, requireRole('owner'), async (req, res) => {
  const { uid, name, staffId, bio, avatar } = req.body || {};
  if (!uid) return res.status(400).json({ error: 'uid مطلوب.' });

  const userSnap = await db.collection('users').doc(uid).get();
  if (!userSnap.exists) return res.status(404).json({ error: 'المستخدم غير موجود.' });
  if (userSnap.data().role === 'owner') return res.status(400).json({ error: 'لا يمكن تعديل صلاحية المالك.' });

  const now = admin.firestore.FieldValue.serverTimestamp();
  await auth.setCustomUserClaims(uid, { role: 'moderator' });

  const batch = db.batch();
  batch.update(db.collection('users').doc(uid), { role: 'moderator', updatedAt: now });
  batch.set(db.collection('moderatorProfiles').doc(uid), {
    name: name || userSnap.data().email || 'مشرف',
    staffId: staffId || uid.slice(0, 8).toUpperCase(),
    avatar: avatar || null,
    bio: bio || '',
    role: 'moderator',
    joinedAt: now,
    status: 'active',
    stats: { added: 0, reviewed: 0 },
  });
  await batch.commit();

  await writeAuditLog({ actorId: req.user.uid, actorRole: 'owner', action: 'ADD_MODERATOR', targetId: uid });
  res.json({ ok: true });
});

// Disable a moderator (revert to plain user, keep history). Owner only.
router.post('/:uid/disable', requireAuth, requireRole('owner'), async (req, res) => {
  const uid = req.params.uid;
  const userSnap = await db.collection('users').doc(uid).get();
  if (!userSnap.exists) return res.status(404).json({ error: 'غير موجود.' });
  if (userSnap.data().role === 'owner') return res.status(400).json({ error: 'لا يمكن تعطيل المالك.' });

  const now = admin.firestore.FieldValue.serverTimestamp();
  await auth.setCustomUserClaims(uid, { role: 'user' });

  const batch = db.batch();
  batch.update(db.collection('users').doc(uid), { role: 'user', updatedAt: now });
  batch.update(db.collection('moderatorProfiles').doc(uid), { status: 'disabled' });
  await batch.commit();

  await writeAuditLog({ actorId: req.user.uid, actorRole: 'owner', action: 'DISABLE_MODERATOR', targetId: uid });
  res.json({ ok: true });
});

module.exports = router;
