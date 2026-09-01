'use strict';

const express = require('express');
const { db } = require('../firebase-admin');
const { requireAuth } = require('../auth');
const { normalize } = require('../retrieval');

const router = express.Router();

async function searchCollection(name, fields, qNorm, limit = 20) {
  const snap = await db.collection(name).limit(500).get();
  const hits = [];
  snap.forEach((d) => {
    const v = d.data();
    const haystack = fields.map((f) => v[f]).filter(Boolean).join(' ');
    if (normalize(haystack).includes(qNorm)) hits.push({ id: d.id, ...v });
  });
  return hits.slice(0, limit);
}

router.get('/', requireAuth, async (req, res) => {
  const q = (req.query.q || '').toString().trim();
  if (!q) return res.json({ results: {} });
  const qNorm = normalize(q);
  const isStaff = req.user.role === 'moderator' || req.user.role === 'owner';
  const isOwner = req.user.role === 'owner';

  const results = {};

  results.knowledge = (await searchCollection('knowledge', ['title', 'question', 'answer'], qNorm)).filter(
    (k) => isStaff || k.status === 'approved'
  );

  if (isStaff) {
    results.geminiData = await searchCollection('geminiData', ['query', 'answer'], qNorm);
    results.feedback = await searchCollection('feedback', ['suggestion', 'note'], qNorm);
    results.moderators = await searchCollection('moderatorProfiles', ['name', 'staffId'], qNorm);
  }

  if (isOwner) {
    results.users = await searchCollection('users', ['email'], qNorm);
    results.auditLogs = await searchCollection('auditLogs', ['action', 'actorId', 'targetId'], qNorm);
  }

  res.json({ results });
});

module.exports = router;
