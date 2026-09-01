'use strict';

const { db } = require('./firebase-admin');

/**
 * Retrieval pipeline (spec section 26):
 *   Normalization -> Tokenization -> Keyword scoring -> Phrase matching
 *   -> Similar questions -> Domain/subdomain filtering -> Context matching
 *
 * This is a deterministic, explainable scorer that runs entirely in
 * Node (no external NLP service needed) and hands its best candidates
 * to Gemini, which does the actual language understanding / phrasing.
 * The scorer's job is just to narrow "all of Knowledge" down to the
 * handful of documents that are plausibly relevant, using Arabic-aware
 * normalization so diacritics/letter variants don't break matching.
 */

// Arabic-aware normalization: strip diacritics, unify letter variants,
// unify Arabic/Latin digits, collapse whitespace, lowercase Latin text.
function normalize(text) {
  if (!text) return '';
  return text
    .toString()
    .replace(/[\u064B-\u0652\u0670\u0640]/g, '') // tashkeel + tatweel
    .replace(/[إأآا]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[٠-٩]/g, (d) => '0123456789'['٠١٢٣٤٥٦٧٨٩'.indexOf(d)])
    .replace(/[؟?!.,؛;:"'`«»()\[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

const STOPWORDS = new Set([
  'في', 'من', 'الى', 'إلى', 'على', 'عن', 'مع', 'هل', 'ما', 'ماذا', 'كيف',
  'هذا', 'هذه', 'ذلك', 'انا', 'انت', 'هو', 'هي', 'هم', 'و', 'او', 'ثم',
  'the', 'a', 'an', 'is', 'are', 'to', 'of', 'and', 'in', 'on', 'for',
]);

function tokenize(text) {
  return normalize(text)
    .split(' ')
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

function jaccard(aTokens, bTokens) {
  const a = new Set(aTokens);
  const b = new Set(bTokens);
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const t of a) if (b.has(t)) intersection++;
  return intersection / (a.size + b.size - intersection);
}

/**
 * Scores one knowledge document against a query.
 * Returns a number 0..~5 (uncapped, but practically bounded).
 */
function scoreDocument(doc, queryNorm, queryTokens) {
  let score = 0;
  const reasons = [];

  const questionNorm = normalize(doc.question);
  const answerTokens = tokenize(doc.answer || '');

  // 1. Exact / substring phrase match against the canonical question.
  if (questionNorm && (questionNorm === queryNorm)) {
    score += 5;
    reasons.push('exact_question_match');
  } else if (questionNorm && (questionNorm.includes(queryNorm) || queryNorm.includes(questionNorm))) {
    score += 2.5;
    reasons.push('phrase_overlap_question');
  }

  // 2. Token overlap (Jaccard) against the canonical question.
  const qScore = jaccard(queryTokens, tokenize(doc.question));
  score += qScore * 3;
  if (qScore > 0.2) reasons.push('token_overlap_question');

  // 3. searchTerms[] — each matching term contributes.
  for (const term of doc.searchTerms || []) {
    const termNorm = normalize(term);
    if (!termNorm) continue;
    if (queryNorm.includes(termNorm) || termNorm.includes(queryNorm)) {
      score += 2;
      reasons.push(`searchTerm:${term}`);
    } else {
      const overlap = jaccard(queryTokens, tokenize(term));
      if (overlap > 0.4) {
        score += overlap * 1.5;
        reasons.push(`searchTerm_fuzzy:${term}`);
      }
    }
  }

  // 4. similarQuestions[] — phrased differently but same intent.
  for (const sq of doc.similarQuestions || []) {
    const sqNorm = normalize(sq);
    if (!sqNorm) continue;
    if (queryNorm.includes(sqNorm) || sqNorm.includes(queryNorm)) {
      score += 2.2;
      reasons.push(`similarQuestion:${sq}`);
    } else {
      const overlap = jaccard(queryTokens, tokenize(sq));
      if (overlap > 0.3) {
        score += overlap * 2;
        reasons.push(`similarQuestion_fuzzy:${sq}`);
      }
    }
  }

  // 5. Light overlap with the answer body itself (weak signal).
  const aScore = jaccard(queryTokens, answerTokens);
  score += aScore * 0.5;

  return { score, reasons };
}

/**
 * Loads all approved knowledge (single flat collection per spec) and
 * scores it against the query. Optionally narrows by a detected domain
 * first (soft filter — a strong match outside the domain still counts).
 *
 * @param {string} query
 * @param {object} opts { domain, subdomain, limit }
 */
async function retrieveKnowledge(query, opts = {}) {
  const { domain, limit = 5 } = opts;
  const queryNorm = normalize(query);
  const queryTokens = tokenize(query);

  const snap = await db.collection('knowledge').where('status', '==', 'approved').get();

  const scored = [];
  snap.forEach((docSnap) => {
    const doc = { id: docSnap.id, ...docSnap.data() };
    const { score, reasons } = scoreDocument(doc, queryNorm, queryTokens);

    let finalScore = score;
    // Soft domain boost, not a hard filter — spec forbids folder-like
    // rigidity, domain is a signal, not a gate.
    if (domain && doc.domain && normalize(domain) === normalize(doc.domain)) {
      finalScore += 0.75;
    }

    if (finalScore > 0.35) {
      scored.push({ doc, score: finalScore, reasons });
    }
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

module.exports = { retrieveKnowledge, normalize, tokenize };
