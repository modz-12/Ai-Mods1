'use strict';

const express = require('express');
const { db } = require('../firebase-admin');
const { requireAuth, requireRole } = require('../auth');

const router = express.Router();

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

router.get('/stats', requireAuth, requireRole('owner'), async (req, res) => {
  const todayStart = startOfToday();

  const [usersSnap, modsSnap, knowledgeSnap, geminiSnap, feedbackSnap, auditSnap] = await Promise.all([
    db.collection('users').get(),
    db.collection('moderatorProfiles').get(),
    db.collection('knowledge').get(),
    db.collection('geminiData').get(),
    db.collection('feedback').get(),
    db.collection('auditLogs').orderBy('createdAt', 'desc').limit(1000).get(),
  ]);

  let addedToday = 0;
  let updatedToday = 0;
  const topUsed = [];
  const modAddCounts = {};

  knowledgeSnap.forEach((d) => {
    const v = d.data();
    const created = v.createdAt?.toDate?.();
    const updated = v.updatedAt?.toDate?.();
    if (created && created >= todayStart) addedToday++;
    if (updated && updated >= todayStart && (!created || updated.getTime() !== created.getTime())) updatedToday++;
    topUsed.push({ id: d.id, title: v.title, usageCount: v.usageCount || 0 });
    if (v.createdBy) modAddCounts[v.createdBy] = (modAddCounts[v.createdBy] || 0) + 1;
  });
  topUsed.sort((a, b) => b.usageCount - a.usageCount);

  const unanswered = {};
  geminiSnap.forEach((d) => {
    const v = d.data();
    if (v.status === 'pending') {
      unanswered[v.query] = (unanswered[v.query] || 0) + 1;
    }
  });
  const topUnanswered = Object.entries(unanswered)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([query, count]) => ({ query, count }));

  const searchTermCounts = {};
  knowledgeSnap.forEach((d) => {
    (d.data().searchTerms || []).forEach((t) => {
      searchTermCounts[t] = (searchTermCounts[t] || 0) + (d.data().usageCount || 0) + 1;
    });
  });
  const topSearchTerms = Object.entries(searchTermCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([term, count]) => ({ term, count }));

  const reviewCounts = {};
  let accepted = 0;
  let rejected = 0;
  feedbackSnap.forEach((d) => {
    const v = d.data();
    if (v.status === 'accepted') accepted++;
    if (v.status === 'rejected') rejected++;
    if (v.resolvedBy) reviewCounts[v.resolvedBy] = (reviewCounts[v.resolvedBy] || 0) + 1;
  });

  const topAdder = Object.entries(modAddCounts).sort((a, b) => b[1] - a[1])[0];
  const topReviewer = Object.entries(reviewCounts).sort((a, b) => b[1] - a[1])[0];

  res.json({
    totals: {
      users: usersSnap.size,
      moderators: modsSnap.size,
      knowledge: knowledgeSnap.size,
      geminiData: geminiSnap.size,
      feedback: feedbackSnap.size,
    },
    today: { added: addedToday, updated: updatedToday },
    topUsedKnowledge: topUsed.slice(0, 10),
    topUnansweredQuestions: topUnanswered,
    topSearchTerms,
    topAdderModeratorId: topAdder ? topAdder[0] : null,
    topReviewerModeratorId: topReviewer ? topReviewer[0] : null,
    suggestionsAccepted: accepted,
    suggestionsRejected: rejected,
    recentAuditCount: auditSnap.size,
  });
});

module.exports = router;
