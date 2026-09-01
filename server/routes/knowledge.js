'use strict';

const express = require('express');
const admin = require('firebase-admin');
const { db } = require('../firebase-admin');
const { requireAuth, requireRole } = require('../auth');
const { writeAuditLog } = require('../audit');

const router = express.Router();

function sanitizeIncoming(body) {
  const clean = (s) => (typeof s === 'string' ? s.trim().slice(0, 8000) : s);
  return {
    title: clean(body.title) || '',
    question: clean(body.question) || '',
    answer: clean(body.answer) || '',
    domain: clean(body.domain) || 'عام',
    subdomain: clean(body.subdomain) || '',
    searchTerms: Array.isArray(body.searchTerms) ? body.searchTerms.map(clean).filter(Boolean).slice(0, 50) : [],
    similarQuestions: Array.isArray(body.similarQuestions) ? body.similarQuestions.map(clean).filter(Boolean).slice(0, 50) : [],
    source: clean(body.source) || 'manual',
    sourceType: clean(body.sourceType) || 'MANUAL',
    status: ['approved', 'draft', 'archived'].includes(body.status) ? body.status : 'approved',
  };
}

// List — regular users only ever see approved docs; moderators/owner see everything.
router.get('/', requireAuth, async (req, res) => {
  const isStaff = req.user.role === 'moderator' || req.user.role === 'owner';
  let query = db.collection('knowledge').orderBy('updatedAt', 'desc').limit(200);
  if (!isStaff) query = db.collection('knowledge').where('status', '==', 'approved').orderBy('updatedAt', 'desc').limit(200);

  const snap = await query.get();
  const items = [];
  snap.forEach((d) => items.push({ id: d.id, ...d.data() }));
  res.json({ items });
});

router.get('/:id', requireAuth, async (req, res) => {
  const doc = await db.collection('knowledge').doc(req.params.id).get();
  if (!doc.exists) return res.status(404).json({ error: 'غير موجود.' });
  const data = doc.data();
  const isStaff = req.user.role === 'moderator' || req.user.role === 'owner';
  if (!isStaff && data.status !== 'approved') return res.status(403).json({ error: 'غير متاح.' });
  res.json({ id: doc.id, ...data });
});

router.get('/:id/versions', requireAuth, requireRole('moderator'), async (req, res) => {
  const snap = await db
    .collection('knowledgeVersions')
    .where('knowledgeId', '==', req.params.id)
    .orderBy('version', 'desc')
    .get();
  const versions = [];
  snap.forEach((d) => versions.push({ id: d.id, ...d.data() }));
  res.json({ versions });
});

router.post('/', requireAuth, requireRole('moderator'), async (req, res) => {
  const data = sanitizeIncoming(req.body || {});
  if (!data.title || !data.question || !data.answer) {
    return res.status(400).json({ error: 'العنوان والسؤال والرد حقول مطلوبة.' });
  }
  const now = admin.firestore.FieldValue.serverTimestamp();
  const ref = db.collection('knowledge').doc();
  await ref.set({
    ...data,
    version: 1,
    createdBy: req.user.uid,
    updatedBy: req.user.uid,
    createdAt: now,
    updatedAt: now,
    usageCount: 0,
    feedbackCount: 0,
  });

  await db.collection('moderatorData').add({
    moderatorId: req.user.uid,
    action: 'ADD_KNOWLEDGE',
    knowledgeId: ref.id,
    description: `أضاف معلومة جديدة: ${data.title}`,
    createdAt: now,
  });
  await writeAuditLog({ actorId: req.user.uid, actorRole: req.user.role, action: 'ADD_KNOWLEDGE', targetId: ref.id, metadata: { title: data.title } });

  res.status(201).json({ id: ref.id });
});

router.put('/:id', requireAuth, requireRole('moderator'), async (req, res) => {
  const ref = db.collection('knowledge').doc(req.params.id);
  const existing = await ref.get();
  if (!existing.exists) return res.status(404).json({ error: 'غير موجود.' });

  const oldData = existing.data();
  const incoming = sanitizeIncoming({ ...oldData, ...req.body });
  const reason = (req.body?.reason || '').toString().slice(0, 500);
  const now = admin.firestore.FieldValue.serverTimestamp();
  const newVersion = (oldData.version || 1) + 1;

  const batch = db.batch();
  batch.update(ref, {
    ...incoming,
    version: newVersion,
    updatedBy: req.user.uid,
    updatedAt: now,
  });

  const versionRef = db.collection('knowledgeVersions').doc();
  batch.set(versionRef, {
    knowledgeId: req.params.id,
    version: newVersion,
    oldData,
    newData: incoming,
    changedBy: req.user.uid,
    reason: reason || 'تحديث بدون سبب محدد',
    createdAt: now,
  });

  const modRef = db.collection('moderatorData').doc();
  batch.set(modRef, {
    moderatorId: req.user.uid,
    action: 'UPDATE_KNOWLEDGE',
    knowledgeId: req.params.id,
    description: `عدّل معلومة: ${incoming.title} (نسخة ${newVersion})`,
    createdAt: now,
  });

  await batch.commit();
  await writeAuditLog({ actorId: req.user.uid, actorRole: req.user.role, action: 'UPDATE_KNOWLEDGE', targetId: req.params.id, metadata: { version: newVersion } });

  res.json({ ok: true, version: newVersion });
});

// Archive rather than hard-delete, so history/versioning stays intact (spec 12, 34).
router.delete('/:id', requireAuth, requireRole('owner'), async (req, res) => {
  const ref = db.collection('knowledge').doc(req.params.id);
  const existing = await ref.get();
  if (!existing.exists) return res.status(404).json({ error: 'غير موجود.' });
  await ref.update({ status: 'archived', updatedAt: admin.firestore.FieldValue.serverTimestamp(), updatedBy: req.user.uid });
  await writeAuditLog({ actorId: req.user.uid, actorRole: req.user.role, action: 'UPDATE_KNOWLEDGE', targetId: req.params.id, metadata: { archived: true } });
  res.json({ ok: true });
});

module.exports = router;
