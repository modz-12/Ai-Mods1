'use strict';

const { db } = require('./firebase-admin');
const admin = require('firebase-admin');

const RECENT_MESSAGE_LIMIT = 12; // ~6 user/assistant exchanges of rolling context

/**
 * Conversation memory model:
 *   conversations/{conversationId}            -> ownerId, title, createdAt, updatedAt, lastMessageAt
 *   conversationMessages/{messageId}           -> conversationId, role, text, sourceType, createdAt
 *   users/{uid}/memory/summary                 -> long-lived rolling summary + facts (owner-scoped, never mixed)
 *
 * Coreference ("she", "it", "the second one") is resolved by simply
 * feeding Gemini the last N raw turns as conversation history — Gemini
 * (the language engine, per the brief) does the actual pronoun
 * resolution; this module's job is only to fetch/store the right slice
 * of history for the right user, and never leak across users.
 */

async function assertOwnsConversation(conversationId, uid) {
  const snap = await db.collection('conversations').doc(conversationId).get();
  if (!snap.exists) return null;
  const data = snap.data();
  if (data.ownerId !== uid) return null;
  return data;
}

async function createConversation(uid, firstMessageText) {
  const ref = db.collection('conversations').doc();
  const title = (firstMessageText || 'محادثة جديدة').slice(0, 60);
  const now = admin.firestore.FieldValue.serverTimestamp();
  await ref.set({
    ownerId: uid,
    title,
    createdAt: now,
    updatedAt: now,
    lastMessageAt: now,
    messageCount: 0,
  });
  return ref.id;
}

async function getRecentMessages(conversationId, limit = RECENT_MESSAGE_LIMIT) {
  const snap = await db
    .collection('conversationMessages')
    .where('conversationId', '==', conversationId)
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get();

  const messages = [];
  snap.forEach((d) => messages.push({ id: d.id, ...d.data() }));
  return messages.reverse(); // chronological order for the model
}

async function appendMessage(conversationId, role, text, extra = {}) {
  const ref = db.collection('conversationMessages').doc();
  const now = admin.firestore.FieldValue.serverTimestamp();
  await ref.set({
    conversationId,
    role, // 'user' | 'assistant'
    text,
    createdAt: now,
    ...extra,
  });
  await db.collection('conversations').doc(conversationId).update({
    updatedAt: now,
    lastMessageAt: now,
    messageCount: admin.firestore.FieldValue.increment(1),
  });
  return ref.id;
}

/**
 * Very lightweight long-term memory: tracks the last known active
 * "topic" per user so a brand-new conversation can still feel
 * continuous if the user references "what we talked about". This is
 * intentionally small (not a full profile) and lives under the user's
 * own subcollection so Firestore rules can restrict it to owner-only
 * reads.
 */
async function touchUserMemory(uid, { lastTopic, lastDomain } = {}) {
  const ref = db.collection('users').doc(uid).collection('memory').doc('summary');
  await ref.set(
    {
      lastTopic: lastTopic || null,
      lastDomain: lastDomain || null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

async function getUserMemory(uid) {
  const snap = await db.collection('users').doc(uid).collection('memory').doc('summary').get();
  return snap.exists ? snap.data() : null;
}

module.exports = {
  RECENT_MESSAGE_LIMIT,
  assertOwnsConversation,
  createConversation,
  getRecentMessages,
  appendMessage,
  touchUserMemory,
  getUserMemory,
};
