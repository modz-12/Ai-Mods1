'use strict';

const { GoogleGenAI } = require('@google/genai');
const { db } = require('./firebase-admin');

if (!process.env.GEMINI_API_KEY) {
  console.warn(
    '[gemini] GEMINI_API_KEY is not set. Chat will still start, but every ' +
    'request that needs Gemini will fail with a clear error until you set it in .env'
  );
}

const ai = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const SEARCH_ENABLED = String(process.env.GEMINI_ENABLE_SEARCH_TOOL).toLowerCase() === 'true';

function assertReady() {
  if (!ai) {
    const err = new Error('Gemini is not configured. Set GEMINI_API_KEY in your .env file.');
    err.code = 'GEMINI_NOT_CONFIGURED';
    throw err;
  }
}

/** Pulls owner-authored instructions (spec section 17) into the system prompt. */
async function loadSystemInstructions() {
  const snap = await db.collection('instructions').where('active', '==', true).get();
  const lines = [];
  snap.forEach((d) => {
    const v = d.data();
    if (v.text) lines.push(`- ${v.text}`);
  });
  return lines;
}

function buildSystemInstruction(instructionLines) {
  return [
    'أنت محرك اللغة داخل منصة "AI MODZ". أنت لست قاعدة المعرفة؛ قاعدة المعرفة الحقيقية تُغذّى من صاحب المنصة والمشرفين وتُرسل إليك ضمن "Knowledge Context" أدناه.',
    'القواعد الإلزامية:',
    '1) إذا وُجد "Knowledge Context" وكان مرتبطًا بالسؤال، ابنِ إجابتك عليه ولا تخترع تفاصيل تُنسب إليه لا وجود لها فيه.',
    '2) إذا لم تجد معلومة محلية كافية، أجب من معرفتك العامة وصرّح ضمنيًا بأن هذا ليس من قاعدة المعرفة الرسمية (لا تفبرك مصدرًا محليًا).',
    '3) حافظ على سياق المحادثة السابقة لفهم الضمائر والإشارات (مثل "هي"، "ذلك"، "منها").',
    '4) أجب بنفس لغة المستخدم غالبًا (العربية)، بإيجاز ووضوح، ودون حشو.',
    '5) إن لم تكن متأكدًا، قل ذلك صراحة بدل الاختلاق.',
    ...instructionLines,
  ].join('\n');
}

/**
 * Composes the final answer for the chat endpoint.
 * @returns { text, usedKnowledgeIds, sourceType }
 */
async function generateAnswer({ query, knowledgeMatches, history, allowSearch }) {
  assertReady();
  const instructionLines = await loadSystemInstructions();
  const systemInstruction = buildSystemInstruction(instructionLines);

  const knowledgeBlock = knowledgeMatches.length
    ? knowledgeMatches
        .map(
          (m, i) =>
            `[K${i + 1}] (id:${m.doc.id}) سؤال مرجعي: ${m.doc.question}\nإجابة معتمدة: ${m.doc.answer}`
        )
        .join('\n\n')
    : '(لا توجد معلومة محلية مرتبطة بدرجة كافية)';

  const historyText = (history || [])
    .map((h) => `${h.role === 'user' ? 'المستخدم' : 'المساعد'}: ${h.text}`)
    .join('\n');

  const contents = [
    {
      role: 'user',
      parts: [
        {
          text:
            `سياق المحادثة السابق (للفهم فقط، لا تكرره):\n${historyText || '(لا يوجد)'}\n\n` +
            `Knowledge Context:\n${knowledgeBlock}\n\n` +
            `سؤال المستخدم الحالي: ${query}`,
        },
      ],
    },
  ];

  const tools = [];
  if (allowSearch && SEARCH_ENABLED) {
    tools.push({ googleSearch: {} });
  }

  let response;
  try {
    response = await ai.models.generateContent({
      model: MODEL,
      contents,
      config: {
        systemInstruction,
        temperature: 0.4,
        tools: tools.length ? tools : undefined,
      },
    });
  } catch (err) {
    console.error('[gemini] generateContent failed:', err.message);
    const wrapped = new Error('Gemini request failed: ' + err.message);
    wrapped.code = 'GEMINI_REQUEST_FAILED';
    throw wrapped;
  }

  const text = response.text || '';
  const usedSearch = !!(response.candidates?.[0]?.groundingMetadata);
  const usedKnowledgeIds = knowledgeMatches.map((m) => m.doc.id);

  let sourceType = 'GEMINI';
  if (usedKnowledgeIds.length && usedSearch) sourceType = 'KNOWLEDGE_PLUS_GEMINI';
  else if (usedKnowledgeIds.length) sourceType = 'LOCAL_KNOWLEDGE';
  else if (usedSearch) sourceType = 'EXTERNAL_SEARCH';

  const groundingUrls = usedSearch
    ? (response.candidates[0].groundingMetadata.groundingChunks || [])
        .map((c) => c.web?.uri)
        .filter(Boolean)
    : [];

  return { text, usedKnowledgeIds, sourceType, groundingUrls };
}

/**
 * Asks Gemini to detect a coarse domain/subdomain for a query — used to
 * softly bias retrieval and to pre-fill the Gemini Data review form.
 */
async function detectDomain(query) {
  assertReady();
  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [{ role: 'user', parts: [{ text: query }] }],
      config: {
        systemInstruction:
          'صنّف السؤال التالي إلى domain واحد قصير (كلمة أو كلمتين، مثل: AI, برمجة, رياضة, عام) و subdomain اختياري. أعد JSON فقط بالشكل: {"domain":"...","subdomain":"..."} بدون أي نص إضافي.',
        temperature: 0,
      },
    });
    const cleaned = (response.text || '{}').replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    return { domain: parsed.domain || 'عام', subdomain: parsed.subdomain || '' };
  } catch (err) {
    console.warn('[gemini] detectDomain fallback (non-fatal):', err.message);
    return { domain: 'عام', subdomain: '' };
  }
}

/**
 * Given a query + Gemini's raw answer, suggest structured Knowledge
 * fields for the moderator to review before anything is saved (spec 29).
 * The moderator sees and can edit every field — nothing here is auto-committed.
 */
async function suggestKnowledgeFields({ query, answer }) {
  assertReady();
  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [
        {
          role: 'user',
          parts: [
            {
              text:
                `السؤال: ${query}\nالإجابة: ${answer}\n\n` +
                'اقترح بيانات Knowledge بصيغة JSON فقط بالمفاتيح التالية بدون أي نص إضافي: ' +
                '{"title":"...","domain":"...","subdomain":"...","searchTerms":["...","..."],"similarQuestions":["...","..."]}',
            },
          ],
        },
      ],
      config: { temperature: 0.3 },
    });
    const cleaned = (response.text || '{}').replace(/```json|```/g, '').trim();
    return JSON.parse(cleaned);
  } catch (err) {
    console.warn('[gemini] suggestKnowledgeFields fallback (non-fatal):', err.message);
    return { title: query.slice(0, 60), domain: 'عام', subdomain: '', searchTerms: [], similarQuestions: [] };
  }
}

module.exports = { generateAnswer, detectDomain, suggestKnowledgeFields, isConfigured: () => !!ai };
