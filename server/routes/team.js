'use strict';

const express = require('express');
const admin = require('firebase-admin');
const { db } = require('../firebase-admin');
const { requireAuth, requireRole } = require('../auth');

const router = express.Router();

// List chats the current staff member participates in.
router.get('/chats', requireAuth, requireRole('moderator'), async (req, res) => {
  const snap = await db.collection('teamChats').where('participants', 'array-contains', req.user.uid).get();
  const items = [];
  snap.forEach((d) => items.push({ id: d.id, ...d.data() }));
  items.sort((a, b) => (b.lastMessageAt?.toMillis?.() || 0) - (a.lastMessageAt?.toMillis?.() || 0));
  res.json({ items });
});

// Get or create a 1:1 chat with another staff member.
router.post('/chats/with/:uid', requireAuth, requireRole('moderator'), async (req, res) => {
  const otherUid = req.params.uid;
  if (otherUid === req.user.uid) return res.status(400).json({ error: 'لا يمكن مراسلة نفسك.' });

  const otherSnap = await db.collection('users').doc(otherUid).get();
  if (!otherSnap.exists || !['moderator', 'owner'].includes(otherSnap.data().role)) {
    return res.status(404).json({ error: 'المستخدم غير موجود ضمن الفريق.' });
  }

  const pairKey = [req.user.uid, otherUid].sort().join('_');
  const existing = await db.collection('teamChats').where('pairKey', '==', pairKey).limit(1).get();
  if (!existing.empty) {
    const d = existing.docs[0];
    return res.json({ id: d.id, ...d.data() });
  }

  const now = admin.firestore.FieldValue.serverTimestamp();
  const ref = db.collection('teamChats').doc();
  const data = {
    participants: [req.user.uid, otherUid],
    pairKey,
    createdAt: now,
    lastMessageAt: now,
    lastMessageText: '',
  };
  await ref.set(data);
  res.status(201).json({ id: ref.id, ...data });
});

router.get('/chats/:id/messages', requireAuth, requireRole('moderator'), async (req, res) => {
  const chatSnap = await db.collection('teamChats').doc(req.params.id).get();
  if (!chatSnap.exists || !chatSnap.data().participants.includes(req.user.uid)) {
    return res.status(403).json({ error: 'لا تملك صلاحية الوصول.' });
  }
  const snap = await db
    .collection('teamChats')
    .doc(req.params.id)
    .collection('messages')
    .orderBy('createdAt', 'asc')
    .limit(300)
    .get();
  const items = [];
  snap.forEach((d) => items.push({ id: d.id, ...d.data() }));
  res.json({ items });
});

router.post('/chats/:id/messages', requireAuth, requireRole('moderator'), async (req, res) => {
  const text = (req.body?.text || '').toString().trim().slice(0, 4000);
  if (!text) return res.status(400).json({ error: 'نص الرسالة مطلوب.' });

  const chatRef = db.collection('teamChats').doc(req.params.id);
  const chatSnap = await chatRef.get();
  if (!chatSnap.exists || !chatSnap.data().participants.includes(req.user.uid)) {
    return res.status(403).json({ error: 'لا تملك صلاحية الوصول.' });
  }

  const now = admin.firestore.FieldValue.serverTimestamp();
  const msgRef = chatRef.collection('messages').doc();
  await msgRef.set({ senderId: req.user.uid, text, createdAt: now, readBy: [req.user.uid] });
  await chatRef.update({ lastMessageAt: now, lastMessageText: text });

  res.status(201).json({ id: msgRef.id });
});

module.exports = router;
