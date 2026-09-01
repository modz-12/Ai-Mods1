'use strict';

const express = require('express');
const admin = require('firebase-admin');
const { db } = require('../firebase-admin');
const { requireAuth, requireRole } = require('../auth');
const { writeAuditLog } = require('../audit');

const router = express.Router();

const VALID_TYPES = new Set(['helpful', 'not_helpful', 'suggest', 'new_question', 'similar_words']);

// User submits feedback on a message / knowledge doc.
router.post('/', requireAuth, async (req, res) => {
  const { knowledgeId = null, messageId = null, type, oldAnswer = '', suggestion = '', note = '' } = req.body || {};
  if (!VALID_TYPES.has(type)) {
    return res.status(400).json({ error: 'نوع الملاحظة غير صالح.' });
  }
  const now = admin.firestore.FieldValue.serverTimestamp();
  const ref = db.collection('feedback').doc();
  await ref.set({
    knowledgeId,
    messageId,
    userId: req.user.uid,
    type,
    oldAnswer: (oldAnswer || '').toString().slice(0, 4000),
    suggestion: (suggestion || '').toString().slice(0, 4000),
    note: (note || '').toString().slice(0, 1000),
    status: 'pending',
    createdAt: now,
  });

  if (knowledgeId) {
    await db.collection('knowledge').doc(knowledgeId).update({
      feedbackCount: admin.firestore.FieldValue.increment(1),
    }).catch(() => {});
  }

  res.status(201).json({ id: ref.id });
});

// User can see their own feedback.
router.get('/mine', requireAuth, async (req, res) => {
  const snap = await db.collection('feedback').where('userId', '==', req.user.uid).orderBy('createdAt', 'desc').get();
  const items = [];
  snap.forEach((d) => items.push({ id: d.id, ...d.data() }));
  res.json({ items });
});

// Moderator/owner review queue.
router.get('/', requireAuth, requireRole('moderator'), async (req, res) => {
  const status = req.query.status || 'pending';
  const snap = await db.collection('feedback').where('status', '==', status).orderBy('createdAt', 'desc').limit(200).get();
  const items = [];
  snap.forEach((d) => items.push({ id: d.id, ...d.data() }));
  res.json({ items });
});

router.post('/:id/resolve', requireAuth, requireRole('moderator'), async (req, res) => {
  const { decision } = req.body || {}; // 'accepted' | 'rejected'
  if (!['accepted', 'rejected'].includes(decision)) {
    return res.status(400).json({ error: 'قرار غير صالح.' });
  }
  const ref = db.collection('feedback').doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ error: 'غير موجود.' });
  const data = snap.data();
  const now = admin.firestore.FieldValue.serverTimestamp();

  await ref.update({ status: decision, resolvedBy: req.user.uid, resolvedAt: now });

  if (decision === 'accepted' && data.knowledgeId && data.suggestion) {
    const kRef = db.collection('knowledge').doc(data.knowledgeId);
    const kSnap = await kRef.get();
    if (kSnap.exists) {
      const oldData = kSnap.data();
      const newVersion = (oldData.version || 1) + 1;
      const batch = db.batch();
      batch.update(kRef, {
        answer: data.suggestion,
        version: newVersion,
        updatedBy: req.user.uid,
        updatedAt: now,
      });
      batch.set(db.collection('knowledgeVersions').doc(), {
        knowledgeId: data.knowledgeId,
        version: newVersion,
        oldData,
        newData: { ...oldData, answer: data.suggestion },
        changedBy: req.user.uid,
        reason: `مقبول من اقتراح مستخدم (feedback ${req.params.id})`,
        createdAt: now,
      });
      await batch.commit();
    }
  }

  await writeAuditLog({ actorId: req.user.uid, actorRole: req.user.role, action: 'REVIEW_FEEDBACK', targetId: req.params.id, metadata: { decision } });
  res.json({ ok: true });
});

module.exports = router;
