'use strict';

const express = require('express');
const admin = require('firebase-admin');
const { db } = require('../firebase-admin');
const { requireAuth } = require('../auth');
const { retrieveKnowledge } = require('../retrieval');
const { generateAnswer, detectDomain } = require('../gemini');
const {
  assertOwnsConversation,
  createConversation,
  getRecentMessages,
  appendMessage,
  touchUserMemory,
} = require('../memory');
const { writeAuditLog } = require('../audit');

const router = express.Router();

const KNOWLEDGE_CONFIDENCE_THRESHOLD = 1.2; // below this, treat local knowledge as "not enough"

router.post('/', requireAuth, async (req, res) => {
  try {
    const { message, conversationId: incomingConversationId } = req.body || {};
    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'الرسالة مطلوبة.' });
    }
    if (message.length > 4000) {
      return res.status(400).json({ error: 'الرسالة طويلة جدًا (الحد الأقصى 4000 حرف).' });
    }

    const uid = req.user.uid;

    // 1. Resolve / create the conversation (per-user memory scope).
    let conversationId = incomingConversationId;
    if (conversationId) {
      const owned = await assertOwnsConversation(conversationId, uid);
      if (!owned) return res.status(403).json({ error: 'لا تملك صلاحية الوصول لهذه المحادثة.' });
    } else {
      conversationId = await createConversation(uid, message);
    }

    // 2. Load recent turns for coreference / context continuity.
    const history = await getRecentMessages(conversationId);

    // 3. Retrieval pipeline against Knowledge.
    const matches = await retrieveKnowledge(message, { limit: 5 });
    const strongMatches = matches.filter((m) => m.score >= KNOWLEDGE_CONFIDENCE_THRESHOLD);

    // 4. Compose the answer with Gemini as the language engine.
    const { text, usedKnowledgeIds, sourceType, groundingUrls } = await generateAnswer({
      query: message,
      knowledgeMatches: strongMatches,
      history,
      allowSearch: strongMatches.length === 0,
    });

    // 5. Persist both turns.
    await appendMessage(conversationId, 'user', message);
    const assistantMsgId = await appendMessage(conversationId, 'assistant', text, {
      sourceType,
      usedKnowledgeIds,
      groundingUrls,
    });

    // 6. Bump usageCount on any knowledge doc actually used.
    await Promise.all(
      usedKnowledgeIds.map((id) =>
        db.collection('knowledge').doc(id).update({ usageCount: admin.firestore.FieldValue.increment(1) }).catch(() => {})
      )
    );

    // 7. If nothing local matched, log it to geminiData for moderator review (spec 28).
    if (strongMatches.length === 0 && sourceType !== 'LOCAL_KNOWLEDGE') {
      const { domain, subdomain } = await detectDomain(message).catch(() => ({ domain: 'عام', subdomain: '' }));
      await db.collection('geminiData').add({
        query: message,
        answer: text,
        source: sourceType === 'EXTERNAL_SEARCH' ? 'google_search' : 'gemini',
        sourceUrls: groundingUrls || [],
        userId: uid,
        detectedDomain: domain,
        detectedSubdomain: subdomain,
        status: 'pending',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        reviewedBy: null,
        reviewedAt: null,
        approvedAt: null,
      });
      await touchUserMemory(uid, { lastTopic: message, lastDomain: domain });
    } else if (strongMatches[0]) {
      await touchUserMemory(uid, {
        lastTopic: strongMatches[0].doc.title,
        lastDomain: strongMatches[0].doc.domain,
      });
    }

    await writeAuditLog({
      actorId: uid,
      actorRole: req.user.role,
      action: 'GEMINI_QUERY',
      targetId: conversationId,
      metadata: { sourceType, matchCount: strongMatches.length },
    });

    return res.json({
      conversationId,
      messageId: assistantMsgId,
      answer: text,
      sourceType,
      usedKnowledge: strongMatches.map((m) => ({ id: m.doc.id, title: m.doc.title, score: Number(m.score.toFixed(2)) })),
    });
  } catch (err) {
    console.error('[chat] error:', err);
    if (err.code === 'GEMINI_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'Gemini غير مُهيأ على الخادم بعد. أضف GEMINI_API_KEY في .env' });
    }
    return res.status(500).json({ error: 'حدث خطأ أثناء معالجة رسالتك. حاول مرة أخرى.' });
  }
});

module.exports = router;
