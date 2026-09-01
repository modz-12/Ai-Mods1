'use strict';

const { db } = require('./firebase-admin');
const admin = require('firebase-admin');

const VALID_ACTIONS = new Set([
  'LOGIN',
  'ADD_KNOWLEDGE',
  'UPDATE_KNOWLEDGE',
  'APPROVE_KNOWLEDGE',
  'REJECT_KNOWLEDGE',
  'REVIEW_FEEDBACK',
  'ADD_MODERATOR',
  'DISABLE_MODERATOR',
  'UPDATE_INSTRUCTION',
  'GEMINI_QUERY',
  'IMPORT_GEMINI_DATA',
]);

async function writeAuditLog({ actorId, actorRole, action, targetId = null, metadata = {} }) {
  if (!VALID_ACTIONS.has(action)) {
    console.warn(`[audit] unknown action "${action}" logged anyway`);
  }
  await db.collection('auditLogs').add({
    actorId,
    actorRole,
    action,
    targetId,
    metadata,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

module.exports = { writeAuditLog, VALID_ACTIONS };
