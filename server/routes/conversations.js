'use strict';

const express = require('express');
const { db } = require('../firebase-admin');
const { requireAuth } = require('../auth');
const { assertOwnsConversation } = require('../memory');

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  const snap = await db
    .collection('conversations')
    .where('ownerId', '==', req.user.uid)
    .orderBy('lastMessageAt', 'desc')
    .limit(50)
    .get();
  const conversations = [];
  snap.forEach((d) => conversations.push({ id: d.id, ...d.data() }));
  res.json({ conversations });
});

router.get('/:id/messages', requireAuth, async (req, res) => {
  const owned = await assertOwnsConversation(req.params.id, req.user.uid);
  if (!owned) return res.status(403).json({ error: 'لا تملك صلاحية الوصول لهذه المحادثة.' });

  const snap = await db
    .collection('conversationMessages')
    .where('conversationId', '==', req.params.id)
    .orderBy('createdAt', 'asc')
    .get();
  const messages = [];
  snap.forEach((d) => messages.push({ id: d.id, ...d.data() }));
  res.json({ messages });
});

router.delete('/:id', requireAuth, async (req, res) => {
  const owned = await assertOwnsConversation(req.params.id, req.user.uid);
  if (!owned) return res.status(403).json({ error: 'لا تملك صلاحية الوصول لهذه المحادثة.' });

  const msgs = await db.collection('conversationMessages').where('conversationId', '==', req.params.id).get();
  const batch = db.batch();
  msgs.forEach((d) => batch.delete(d.ref));
  batch.delete(db.collection('conversations').doc(req.params.id));
  await batch.commit();
  res.json({ ok: true });
});

module.exports = router;
