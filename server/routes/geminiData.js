'use strict';

const express = require('express');
const admin = require('firebase-admin');
const { db } = require('../firebase-admin');
const { requireAuth, requireRole } = require('../auth');
const { suggestKnowledgeFields } = require('../gemini');
const { writeAuditLog } = require('../audit');

const router = express.Router();

router.get('/', requireAuth, requireRole('moderator'), async (req, res) => {
  const status = req.query.status || 'pending';
  const snap = await db.collection('geminiData').where('status', '==', status).orderBy('createdAt', 'desc').limit(200).get();
  const items = [];
  snap.forEach((d) => items.push({ id: d.id, ...d.data() }));
  res.json({ items });
});

// Ask Gemini to pre-fill structured Knowledge fields for a review row (spec 29).
router.post('/:id/suggest-fields', requireAuth, requireRole('moderator'), async (req, res) => {
  const snap = await db.collection('geminiData').doc(req.params.id).get();
  if (!snap.exists) return res.status(404).json({ error: 'غير موجود.' });
  const data = snap.data();
  const suggestion = await suggestKnowledgeFields({ query: data.query, answer: data.answer });
  res.json({ suggestion });
});

router.post('/:id/approve', requireAuth, requireRole('moderator'), async (req, res) => {
  const ref = db.collection('geminiData').doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ error: 'غير موجود.' });
  const data = snap.data();
  const now = admin.firestore.FieldValue.serverTimestamp();

  const fields = req.body || {}; // moderator-edited fields, all visible before save (spec 29)
  const knowledgeRef = db.collection('knowledge').doc();
  const batch = db.batch();

  batch.set(knowledgeRef, {
    title: (fields.title || data.query).toString().slice(0, 200),
    question: data.query,
    answer: (fields.answer || data.answer).toString(),
    domain: fields.domain || data.detectedDomain || 'عام',
    subdomain: fields.subdomain || data.detectedSubdomain || '',
    searchTerms: Array.isArray(fields.searchTerms) ? fields.searchTerms : [],
    similarQuestions: Array.isArray(fields.similarQuestions) ? fields.similarQuestions : [],
    source: 'gemini_reviewed',
    sourceType: data.source === 'google_search' ? 'EXTERNAL_SEARCH' : 'GEMINI',
    status: 'approved',
    version: 1,
    createdBy: req.user.uid,
    updatedBy: req.user.uid,
    createdAt: now,
    updatedAt: now,
    usageCount: 0,
    feedbackCount: 0,
  });

  batch.update(ref, {
    status: 'approved',
    reviewedBy: req.user.uid,
    reviewedAt: now,
    approvedAt: now,
    resultingKnowledgeId: knowledgeRef.id,
  });

  batch.set(db.collection('moderatorData').doc(), {
    moderatorId: req.user.uid,
    action: 'APPROVE_KNOWLEDGE',
    knowledgeId: knowledgeRef.id,
    description: `اعتمد بيانات Gemini كمعرفة رسمية: ${data.query}`,
    createdAt: now,
  });

  await batch.commit();
  await writeAuditLog({ actorId: req.user.uid, actorRole: req.user.role, action: 'APPROVE_KNOWLEDGE', targetId: knowledgeRef.id, metadata: { fromGeminiData: req.params.id } });

  res.json({ ok: true, knowledgeId: knowledgeRef.id });
});

router.post('/:id/reject', requireAuth, requireRole('moderator'), async (req, res) => {
  const ref = db.collection('geminiData').doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ error: 'غير موجود.' });
  const now = admin.firestore.FieldValue.serverTimestamp();
  await ref.update({ status: 'rejected', reviewedBy: req.user.uid, reviewedAt: now });
  await writeAuditLog({ actorId: req.user.uid, actorRole: req.user.role, action: 'REJECT_KNOWLEDGE', targetId: req.params.id });
  res.json({ ok: true });
});

module.exports = router;
