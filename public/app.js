// =========================================================
// AI MODZ — Frontend application (vanilla JS, no build step)
// Firebase client SDK is used ONLY for Authentication and for
// realtime reads of team chat / own contributions. Every write
// and every AI/Knowledge operation goes through the backend
// REST API, which holds the Gemini key and the Admin SDK.
// No secret key of any kind lives in this file.
// =========================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, signOut, updateProfile,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  getFirestore, collection, query, where, orderBy, onSnapshot, limit,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// Firebase web config is NOT a secret — it identifies the project to
// the browser the same way a public API endpoint does. Real access
// control lives in Firestore Rules and the backend, not here.
const firebaseConfig = {
  apiKey: "AIzaSyAbTpLrnja4GFsUVbXtGsHV65ilXvkcYoM",
  authDomain: "ai-modz.firebaseapp.com",
  projectId: "ai-modz",
  storageBucket: "ai-modz.firebasestorage.app",
  messagingSenderId: "46168305813",
  appId: "1:46168305813:web:6ed5de02cbd50643f46b9c",
  measurementId: "G-2G3FLMSJG5",
};

const fbApp = initializeApp(firebaseConfig);
const fbAuth = getAuth(fbApp);
const db = getFirestore(fbApp);

// ---------------------------------------------------------
// State
// ---------------------------------------------------------
const state = {
  user: null,       // Firebase Auth user object
  profile: null,    // { uid, email, role, status } from /api/users/me
  unsubscribers: [], // active onSnapshot listeners for the current view
};

// ---------------------------------------------------------
// DOM helpers
// ---------------------------------------------------------
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const mainView = () => $("#main-view");

function escapeHtml(s) {
  return (s ?? "").toString()
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// Minimal, dependency-free "safe markdown": escape everything first,
// then re-introduce a tiny whitelist of formatting. This guarantees no
// raw HTML from a model or a user can ever execute in the DOM.
function renderSafeMarkdown(raw) {
  let text = escapeHtml(raw);
  const blocks = [];
  text = text.replace(/```([\s\S]*?)```/g, (_, code) => {
    blocks.push(`<pre><button class="copy-btn btn btn-sm">نسخ</button><code>${code.trim()}</code></pre>`);
    return `\u0000${blocks.length - 1}\u0000`;
  });
  text = text
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/\n/g, "<br>");
  text = text.replace(/\u0000(\d+)\u0000/g, (_, i) => blocks[Number(i)]);
  return text;
}

function toast(message, type = "info") {
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = message;
  $("#toast-container").appendChild(el);
  setTimeout(() => el.remove(), 4200);
}

function openModal(html, { onMount } = {}) {
  const root = $("#modal-root");
  root.innerHTML = `<div class="modal-backdrop" id="modal-backdrop"><div class="modal">${html}</div></div>`;
  $("#modal-backdrop").addEventListener("click", (e) => {
    if (e.target.id === "modal-backdrop") closeModal();
  });
  if (onMount) onMount(root);
}
function closeModal() { $("#modal-root").innerHTML = ""; }

function clearViewSubscriptions() {
  state.unsubscribers.forEach((u) => u());
  state.unsubscribers = [];
}

// ---------------------------------------------------------
// API helper — attaches the Firebase ID token to every call
// ---------------------------------------------------------
async function api(path, { method = "GET", body } = {}) {
  if (!fbAuth.currentUser) throw new Error("غير مسجل الدخول.");
  const token = await fbAuth.currentUser.getIdToken();
  const res = await fetch(`/api${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = {};
  try { data = await res.json(); } catch (_) {}
  if (!res.ok) throw new Error(data.error || `طلب فشل (${res.status})`);
  return data;
}

// ---------------------------------------------------------
// Auth screen wiring
// ---------------------------------------------------------
function initAuthScreen() {
  $$(".auth-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      $$(".auth-tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      const isLogin = tab.dataset.tab === "login";
      $("#login-form").classList.toggle("hidden", !isLogin);
      $("#register-form").classList.toggle("hidden", isLogin);
    });
  });

  $("#login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    $("#login-error").textContent = "";
    try {
      await signInWithEmailAndPassword(fbAuth, $("#login-email").value.trim(), $("#login-password").value);
    } catch (err) {
      $("#login-error").textContent = friendlyAuthError(err);
    }
  });

  $("#register-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    $("#register-error").textContent = "";
    try {
      const cred = await createUserWithEmailAndPassword(fbAuth, $("#register-email").value.trim(), $("#register-password").value);
      const name = $("#register-name").value.trim();
      if (name) await updateProfile(cred.user, { displayName: name });
    } catch (err) {
      $("#register-error").textContent = friendlyAuthError(err);
    }
  });
}

function friendlyAuthError(err) {
  const code = err.code || "";
  const map = {
    "auth/invalid-email": "البريد الإلكتروني غير صالح.",
    "auth/user-not-found": "لا يوجد حساب بهذا البريد.",
    "auth/wrong-password": "كلمة المرور غير صحيحة.",
    "auth/invalid-credential": "بيانات الدخول غير صحيحة.",
    "auth/email-already-in-use": "هذا البريد مستخدم بالفعل.",
    "auth/weak-password": "كلمة المرور ضعيفة جدًا (6 أحرف على الأقل).",
  };
  return map[code] || "حدث خطأ. حاول مرة أخرى.";
}

$("#logout-btn").addEventListener("click", () => signOut(fbAuth));

// ---------------------------------------------------------
// Sidebar / role visibility
// ---------------------------------------------------------
function applyRoleVisibility(role) {
  $("#nav-moderator").classList.toggle("hidden", !(role === "moderator" || role === "owner"));
  $("#nav-owner").classList.toggle("hidden", role !== "owner");
  $("#user-email").textContent = state.user?.email || "—";
  $("#user-role").textContent = role;
  $("#user-avatar").textContent = (state.user?.email || "?").slice(0, 1).toUpperCase();
}

$("#mobile-menu-btn").addEventListener("click", () => $("#sidebar").classList.toggle("open"));
$("#mobile-search-btn").addEventListener("click", openSearchModal);

function openSearchModal() {
  openModal(`
    <h3>🔍 البحث</h3>
    <input id="global-search-input" placeholder="ابحث في المعرفة، الملاحظات، المستخدمين…" autofocus />
    <div id="global-search-results" style="margin-top:14px;"></div>
  `, {
    onMount: (root) => {
      const input = $("#global-search-input", root);
      const results = $("#global-search-results", root);
      let debounceTimer;
      input.addEventListener("input", () => {
        clearTimeout(debounceTimer);
        const q = input.value.trim();
        if (!q) { results.innerHTML = ""; return; }
        debounceTimer = setTimeout(async () => {
          try {
            const { results: grouped } = await api(`/search?q=${encodeURIComponent(q)}`);
            renderSearchResults(results, grouped);
          } catch (err) { results.innerHTML = `<p style="color:var(--red);">${escapeHtml(err.message)}</p>`; }
        }, 300);
      });
    },
  });
}

const SEARCH_GROUP_LABELS = {
  knowledge: "قاعدة المعرفة", geminiData: "بيانات Gemini", feedback: "الملاحظات",
  moderators: "المشرفون", users: "المستخدمون", auditLogs: "سجل العمليات",
};
function renderSearchResults(container, grouped) {
  const groups = Object.entries(grouped).filter(([, items]) => items.length);
  if (!groups.length) { container.innerHTML = emptyState("🔍", "لا توجد نتائج."); return; }
  container.innerHTML = groups.map(([key, items]) => `
    <p style="color:var(--text-faint);font-size:11px;text-transform:uppercase;margin:12px 0 6px;">${SEARCH_GROUP_LABELS[key] || key}</p>
    ${items.slice(0, 5).map((it) => `<div class="card" style="padding:10px 12px;">${escapeHtml(it.title || it.question || it.query || it.name || it.email || it.action || it.id)}</div>`).join("")}
  `).join("");
}
document.addEventListener("click", (e) => {
  if (window.innerWidth <= 960 && $("#sidebar").classList.contains("open")
      && !$("#sidebar").contains(e.target) && e.target.id !== "mobile-menu-btn") {
    $("#sidebar").classList.remove("open");
  }
});

// ---------------------------------------------------------
// Router
// ---------------------------------------------------------
const routes = {}; // path pattern (regex) -> render function

function defineRoute(pattern, render) { routes[pattern] = render; }

async function router() {
  clearViewSubscriptions();
  const hash = (location.hash || "#/chat").replace(/^#/, "");
  const [pathPart] = hash.split("?");
  const segments = pathPart.split("/").filter(Boolean);

  $$(".nav-link, .bottom-nav a").forEach((a) => {
    a.classList.toggle("active", a.dataset.route === segments.join("/") || (segments[0] === "chat" && a.dataset.route === "chat"));
  });
  $("#sidebar").classList.remove("open");

  mainView().innerHTML = `<div class="skeleton" style="width:40%"></div><div class="skeleton" style="width:70%"></div><div class="skeleton" style="width:55%"></div>`;

  try {
    if (segments[0] === "chat") return renderChat(segments[1] || null);
    if (segments[0] === "conversations") return renderConversations();
    if (segments[0] === "feedback") return renderMyFeedback();
    if (segments[0] === "profile") return renderProfile();

    if (segments[0] === "mod" && segments[1] === "dashboard") return renderModDashboard();
    if (segments[0] === "mod" && segments[1] === "knowledge" && segments[2] === "add") return renderKnowledgeForm(null);
    if (segments[0] === "mod" && segments[1] === "knowledge" && segments[2] === "edit") return renderKnowledgeForm(segments[3]);
    if (segments[0] === "mod" && segments[1] === "knowledge") return renderKnowledgeList();
    if (segments[0] === "mod" && segments[1] === "feedback") return renderModFeedback();
    if (segments[0] === "mod" && segments[1] === "gemini-data") return renderGeminiData();
    if (segments[0] === "mod" && segments[1] === "contributions") return renderContributions();
    if (segments[0] === "mod" && segments[1] === "team") return renderTeamDirectory();
    if (segments[0] === "mod" && segments[1] === "team-chat") return renderTeamChat(segments[2] || null);

    if (segments[0] === "owner" && segments[1] === "dashboard") return renderOwnerDashboard();
    if (segments[0] === "owner" && segments[1] === "users") return renderOwnerUsers();
    if (segments[0] === "owner" && segments[1] === "moderators") return renderOwnerModerators();
    if (segments[0] === "owner" && segments[1] === "audit-logs") return renderAuditLogs();
    if (segments[0] === "owner" && segments[1] === "instructions") return renderInstructions();

    location.hash = "#/chat";
  } catch (err) {
    console.error(err);
    mainView().innerHTML = `<div class="empty-state"><div class="icon">⚠️</div><p>${escapeHtml(err.message)}</p></div>`;
  }
}
window.addEventListener("hashchange", router);

// =========================================================
// VIEW: Chat
// =========================================================
async function renderChat(conversationId) {
  mainView().innerHTML = `
    <div class="chat-layout">
      <div class="page-header">
        <div>
          <h1>المحادثة</h1>
          <p>اسأل بأي صياغة — النظام يفهم المعنى وليس فقط الكلمات المطابقة.</p>
        </div>
        <button class="btn" id="new-chat-btn">+ محادثة جديدة</button>
      </div>
      <div class="chat-scroll" id="chat-scroll"></div>
      <div class="typing-indicator hidden" id="typing-indicator"><span class="spinner"></span> AI MODZ تكتب…</div>
      <form class="chat-input-bar" id="chat-form">
        <textarea id="chat-input" placeholder="اكتب رسالتك…" required></textarea>
        <button type="submit" class="btn btn-primary">إرسال</button>
      </form>
    </div>
  `;

  let currentConversationId = conversationId;
  const scroll = $("#chat-scroll");

  if (currentConversationId) {
    try {
      const { messages } = await api(`/conversations/${currentConversationId}/messages`);
      if (!messages.length) scroll.innerHTML = emptyState("💬", "ابدأ المحادثة بكتابة رسالة.");
      else messages.forEach((m) => appendMessageBubble(scroll, m));
      scroll.scrollTop = scroll.scrollHeight;
    } catch (err) {
      toast(err.message, "error");
      currentConversationId = null;
      history.replaceState(null, "", "#/chat");
    }
  } else {
    scroll.innerHTML = emptyState("💬", "ابدأ المحادثة بكتابة رسالة.");
  }

  $("#new-chat-btn").addEventListener("click", () => { location.hash = "#/chat"; });

  $("#chat-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = $("#chat-input");
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    if (scroll.querySelector(".empty-state")) scroll.innerHTML = "";

    appendMessageBubble(scroll, { role: "user", text });
    scroll.scrollTop = scroll.scrollHeight;
    $("#typing-indicator").classList.remove("hidden");

    try {
      const res = await api("/chat", { method: "POST", body: { message: text, conversationId: currentConversationId } });
      currentConversationId = res.conversationId;
      history.replaceState(null, "", `#/chat/${currentConversationId}`);
      appendMessageBubble(scroll, {
        id: res.messageId, role: "assistant", text: res.answer,
        sourceType: res.sourceType, usedKnowledgeIds: (res.usedKnowledge || []).map((k) => k.id),
      }, res.usedKnowledge?.[0]?.id);
      scroll.scrollTop = scroll.scrollHeight;
    } catch (err) {
      toast(err.message, "error");
    } finally {
      $("#typing-indicator").classList.add("hidden");
    }
  });
}

const SOURCE_LABELS = {
  LOCAL_KNOWLEDGE: "من قاعدة المعرفة",
  GEMINI: "من Gemini",
  KNOWLEDGE_PLUS_GEMINI: "معرفة + Gemini",
  EXTERNAL_SEARCH: "بحث خارجي",
};

function appendMessageBubble(container, msg, primaryKnowledgeId) {
  const wrap = document.createElement("div");
  wrap.className = `msg ${msg.role}`;
  const body = document.createElement("div");
  body.innerHTML = renderSafeMarkdown(msg.text);
  wrap.appendChild(body);

  if (msg.role === "assistant") {
    const meta = document.createElement("div");
    meta.className = "msg-meta";
    meta.innerHTML = `<span class="source-badge">${SOURCE_LABELS[msg.sourceType] || "AI"}</span>`;
    wrap.appendChild(meta);

    const actions = document.createElement("div");
    actions.className = "msg-actions";
    actions.innerHTML = `
      <button data-fb="helpful">👍 مفيد</button>
      <button data-fb="not_helpful">👎 غير مناسب</button>
      <button data-fb="suggest">✨ تحسين الرد</button>
    `;
    actions.addEventListener("click", async (e) => {
      const btn = e.target.closest("button[data-fb]");
      if (!btn) return;
      const type = btn.dataset.fb;
      if (type === "suggest") {
        openSuggestModal(msg.text, primaryKnowledgeId, msg.id);
        return;
      }
      try {
        await api("/feedback", { method: "POST", body: { type, messageId: msg.id, knowledgeId: primaryKnowledgeId || null } });
        actions.querySelectorAll("button").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        toast("شكرًا لملاحظتك!", "success");
      } catch (err) { toast(err.message, "error"); }
    });
    wrap.appendChild(actions);
  }

  container.appendChild(wrap);
  wrap.querySelectorAll(".copy-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      navigator.clipboard.writeText(btn.nextElementSibling.textContent);
      btn.textContent = "تم النسخ";
      setTimeout(() => (btn.textContent = "نسخ"), 1500);
    });
  });
}

function openSuggestModal(oldAnswer, knowledgeId, messageId) {
  openModal(`
    <h3>✨ اقتراح تحسين للرد</h3>
    <div class="form-field"><label>الرد الحالي</label><textarea readonly rows="3">${escapeHtml(oldAnswer)}</textarea></div>
    <div class="form-field"><label>ما المشكلة؟</label><textarea id="s-problem" rows="2"></textarea></div>
    <div class="form-field"><label>ما الرد المقترح؟</label><textarea id="s-suggestion" rows="4" required></textarea></div>
    <div class="modal-actions">
      <button class="btn btn-ghost" id="s-cancel">إلغاء</button>
      <button class="btn btn-primary" id="s-submit">إرسال الاقتراح</button>
    </div>
  `, {
    onMount: (root) => {
      $("#s-cancel", root).addEventListener("click", closeModal);
      $("#s-submit", root).addEventListener("click", async () => {
        const suggestion = $("#s-suggestion", root).value.trim();
        if (!suggestion) return toast("الرجاء كتابة الرد المقترح.", "error");
        try {
          await api("/feedback", {
            method: "POST",
            body: {
              type: "suggest", messageId, knowledgeId,
              oldAnswer, suggestion, note: $("#s-problem", root).value.trim(),
            },
          });
          toast("تم إرسال اقتراحك للمراجعة.", "success");
          closeModal();
        } catch (err) { toast(err.message, "error"); }
      });
    },
  });
}

function emptyState(icon, text) {
  return `<div class="empty-state"><div class="icon">${icon}</div><p>${escapeHtml(text)}</p></div>`;
}

// =========================================================
// VIEW: My conversations
// =========================================================
async function renderConversations() {
  const { conversations } = await api("/conversations");
  mainView().innerHTML = `
    <div class="page-header"><div><h1>محادثاتي</h1><p>كل محادثاتك الخاصة، مرتبة بالأحدث.</p></div></div>
    <div id="conv-list"></div>
  `;
  const list = $("#conv-list");
  if (!conversations.length) { list.innerHTML = emptyState("🗂️", "لا توجد محادثات حتى الآن."); return; }
  conversations.forEach((c) => {
    const card = document.createElement("div");
    card.className = "card";
    card.style.cursor = "pointer";
    card.style.display = "flex";
    card.style.justifyContent = "space-between";
    card.style.alignItems = "center";
    card.innerHTML = `<span>${escapeHtml(c.title)}</span><button class="btn btn-sm btn-danger" data-del="${c.id}">حذف</button>`;
    card.addEventListener("click", (e) => {
      if (e.target.closest("[data-del]")) return;
      location.hash = `#/chat/${c.id}`;
    });
    list.appendChild(card);
  });
  list.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-del]");
    if (!btn) return;
    e.stopPropagation();
    if (!confirm("حذف هذه المحادثة نهائيًا؟")) return;
    try { await api(`/conversations/${btn.dataset.del}`, { method: "DELETE" }); renderConversations(); }
    catch (err) { toast(err.message, "error"); }
  });
}

// =========================================================
// VIEW: My feedback
// =========================================================
async function renderMyFeedback() {
  const { items } = await api("/feedback/mine");
  mainView().innerHTML = `
    <div class="page-header"><div><h1>ملاحظاتي</h1><p>كل الملاحظات والاقتراحات التي أرسلتها.</p></div></div>
    <div id="fb-list"></div>
  `;
  const list = $("#fb-list");
  if (!items.length) { list.innerHTML = emptyState("📝", "لا توجد ملاحظات حتى الآن."); return; }
  const typeLabels = { helpful: "👍 مفيد", not_helpful: "👎 غير مناسب", suggest: "✨ اقتراح تحسين", new_question: "❓ سؤال جديد", similar_words: "🔤 كلمات مشابهة" };
  list.innerHTML = items.map((f) => `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <strong>${typeLabels[f.type] || f.type}</strong>
        <span class="pill ${f.status}">${statusLabel(f.status)}</span>
      </div>
      ${f.suggestion ? `<p style="margin-top:8px;color:var(--text-dim);font-size:13.5px;">${escapeHtml(f.suggestion)}</p>` : ""}
    </div>
  `).join("");
}
function statusLabel(s) { return { pending: "قيد المراجعة", accepted: "مقبول", rejected: "مرفوض", approved: "معتمد" }[s] || s; }

// =========================================================
// VIEW: Profile
// =========================================================
async function renderProfile() {
  const { profile } = await api("/users/me");
  mainView().innerHTML = `
    <div class="page-header"><div><h1>ملفي الشخصي</h1></div></div>
    <div class="card">
      <p><strong>البريد الإلكتروني:</strong> ${escapeHtml(state.user?.email || "")}</p>
      <p><strong>الصلاحية:</strong> ${escapeHtml(state.profile?.role || "user")}</p>
      <p><strong>الحالة:</strong> ${state.profile?.status === "active" ? "نشط" : state.profile?.status}</p>
    </div>
    <div class="card">
      <form id="profile-form">
        <div class="form-field"><label>الاسم الظاهر</label><input id="pf-name" value="${escapeHtml(profile?.displayName || "")}" required /></div>
        <div class="form-field" style="margin-top:12px;"><label>نبذة</label><textarea id="pf-bio" rows="3">${escapeHtml(profile?.bio || "")}</textarea></div>
        <button class="btn btn-primary" style="margin-top:12px;">حفظ</button>
      </form>
    </div>
  `;
  $("#profile-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await api("/users/me/profile", { method: "PUT", body: { displayName: $("#pf-name").value.trim(), bio: $("#pf-bio").value.trim() } });
      toast("تم حفظ ملفك الشخصي.", "success");
    } catch (err) { toast(err.message, "error"); }
  });
}

// =========================================================
// VIEW: Moderator Dashboard
// =========================================================
async function renderModDashboard() {
  const [{ items: pendingFeedback }, { items: pendingGemini }] = await Promise.all([
    api("/feedback?status=pending"), api("/gemini-data?status=pending"),
  ]);
  mainView().innerHTML = `
    <div class="page-header"><div><h1>لوحة المشرف</h1><p>نظرة سريعة على ما يحتاج مراجعتك.</p></div></div>
    <div class="stat-grid">
      <div class="stat-card"><div class="value">${pendingFeedback.length}</div><div class="label">ملاحظات بانتظار المراجعة</div></div>
      <div class="stat-card"><div class="value">${pendingGemini.length}</div><div class="label">بيانات Gemini بانتظار الاعتماد</div></div>
    </div>
    <div class="card">
      <p>الروابط السريعة:</p>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:10px;">
        <a class="btn" href="#/mod/knowledge/add">+ إضافة معلومة</a>
        <a class="btn" href="#/mod/feedback">مراجعة الملاحظات</a>
        <a class="btn" href="#/mod/gemini-data">مراجعة بيانات Gemini</a>
      </div>
    </div>
  `;
}

// =========================================================
// VIEW: Knowledge list (moderator/owner)
// =========================================================
async function renderKnowledgeList() {
  const { items } = await api("/knowledge");
  mainView().innerHTML = `
    <div class="page-header">
      <div><h1>قاعدة المعرفة</h1><p>${items.length} معلومة.</p></div>
      <a class="btn btn-primary" href="#/mod/knowledge/add">+ إضافة معلومة</a>
    </div>
    <input id="k-search" placeholder="ابحث بالعنوان أو السؤال…" style="margin-bottom:14px;" />
    <div id="k-list"></div>
  `;
  const listEl = $("#k-list");
  const renderList = (filter = "") => {
    const f = filter.trim().toLowerCase();
    const filtered = items.filter((k) => !f || k.title?.toLowerCase().includes(f) || k.question?.toLowerCase().includes(f));
    if (!filtered.length) { listEl.innerHTML = emptyState("📚", "لا توجد نتائج."); return; }
    listEl.innerHTML = filtered.map((k) => `
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">
          <div>
            <strong>${escapeHtml(k.title)}</strong>
            <p style="color:var(--text-dim);font-size:13px;margin:4px 0;">${escapeHtml(k.question)}</p>
            <span class="pill ${k.status}">${statusLabel(k.status)}</span>
            <span style="color:var(--text-faint);font-size:12px;margin-inline-start:8px;">v${k.version} · استُخدمت ${k.usageCount || 0} مرة</span>
          </div>
          <a class="btn btn-sm" href="#/mod/knowledge/edit/${k.id}">تعديل</a>
        </div>
      </div>
    `).join("");
  };
  renderList();
  $("#k-search").addEventListener("input", (e) => renderList(e.target.value));
}

// =========================================================
// VIEW: Add / Edit Knowledge
// =========================================================
function tagInputHtml(id, values = []) {
  return `
    <div class="form-field full">
      <label>${id === "searchTerms" ? "كلمات البحث" : "الأسئلة المشابهة"}</label>
      <input id="${id}-input" placeholder="اكتب واضغط Enter لإضافة" />
      <div class="tag-list" id="${id}-tags"></div>
    </div>
  `;
}
function wireTagInput(id, initial = []) {
  const values = [...initial];
  const tagsEl = $(`#${id}-tags`);
  const renderTags = () => {
    tagsEl.innerHTML = values.map((v, i) => `<span class="tag">${escapeHtml(v)}<button data-i="${i}" type="button">✕</button></span>`).join("");
  };
  renderTags();
  tagsEl.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-i]");
    if (!btn) return;
    values.splice(Number(btn.dataset.i), 1);
    renderTags();
  });
  $(`#${id}-input`).addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const v = e.target.value.trim();
      if (v) { values.push(v); e.target.value = ""; renderTags(); }
    }
  });
  const addValue = (v) => {
    const clean = (v || "").toString().trim();
    if (clean && !values.includes(clean)) { values.push(clean); renderTags(); }
  };
  const getValues = () => values;
  getValues.add = addValue;
  return getValues;
}

async function renderKnowledgeForm(id) {
  const existing = id ? await api(`/knowledge/${id}`) : null;
  mainView().innerHTML = `
    <div class="page-header"><div><h1>${id ? "تعديل معلومة" : "إضافة معلومة جديدة"}</h1></div></div>
    <form id="k-form" class="card">
      <div class="form-grid">
        <div class="form-field full"><label>عنوان المعلومة</label><input id="f-title" required value="${escapeHtml(existing?.title || "")}" /></div>
        <div class="form-field full"><label>السؤال الأساسي</label><input id="f-question" required value="${escapeHtml(existing?.question || "")}" /></div>
        <div class="form-field full"><label>الرد</label><textarea id="f-answer" rows="5" required>${escapeHtml(existing?.answer || "")}</textarea></div>
        <div class="form-field"><label>المجال</label><input id="f-domain" value="${escapeHtml(existing?.domain || "عام")}" /></div>
        <div class="form-field"><label>المجال الفرعي</label><input id="f-subdomain" value="${escapeHtml(existing?.subdomain || "")}" /></div>
        ${tagInputHtml("searchTerms", existing?.searchTerms)}
        ${tagInputHtml("similarQuestions", existing?.similarQuestions)}
        <div class="form-field"><label>المصدر</label><input id="f-source" value="${escapeHtml(existing?.source || "manual")}" /></div>
        <div class="form-field"><label>الحالة</label>
          <select id="f-status">
            <option value="approved" ${existing?.status === "approved" ? "selected" : ""}>معتمد</option>
            <option value="draft" ${existing?.status === "draft" ? "selected" : ""}>مسودة</option>
          </select>
        </div>
        ${id ? `<div class="form-field full"><label>سبب التعديل</label><input id="f-reason" placeholder="مثال: تصحيح معلومة، تحديث بيانات…" /></div>` : ""}
      </div>
      <div class="modal-actions" style="justify-content:flex-start;margin-top:18px;">
        <button type="button" class="btn" id="preview-btn">👁️ معاينة</button>
        <button type="submit" class="btn btn-primary">${id ? "حفظ التعديل (نسخة جديدة)" : "حفظ"}</button>
        ${id ? `<a class="btn btn-ghost" id="versions-btn">🕘 السجل</a>` : ""}
      </div>
    </form>
    <div id="preview-area"></div>
    <div id="versions-area"></div>
  `;

  const getSearchTerms = wireTagInput("searchTerms", existing?.searchTerms || []);
  const getSimilar = wireTagInput("similarQuestions", existing?.similarQuestions || []);

  $("#preview-btn").addEventListener("click", () => {
    $("#preview-area").innerHTML = `
      <div class="card">
        <p style="color:var(--text-dim);font-size:12px;">معاينة</p>
        <strong>${escapeHtml($("#f-title").value)}</strong>
        <p>${escapeHtml($("#f-question").value)}</p>
        <div>${renderSafeMarkdown($("#f-answer").value)}</div>
      </div>`;
  });

  if (id) {
    $("#versions-btn").addEventListener("click", async (e) => {
      e.preventDefault();
      const { versions } = await api(`/knowledge/${id}/versions`);
      $("#versions-area").innerHTML = versions.length ? versions.map((v) => `
        <div class="card">
          <strong>نسخة ${v.version}</strong> — ${escapeHtml(v.reason)}
          <div class="diff-old">${escapeHtml(v.oldData?.answer || "")}</div>
          <div class="diff-new">${escapeHtml(v.newData?.answer || "")}</div>
        </div>
      `).join("") : emptyState("🕘", "لا يوجد سجل تعديلات بعد.");
    });
  }

  $("#k-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      title: $("#f-title").value.trim(),
      question: $("#f-question").value.trim(),
      answer: $("#f-answer").value.trim(),
      domain: $("#f-domain").value.trim(),
      subdomain: $("#f-subdomain").value.trim(),
      searchTerms: getSearchTerms(),
      similarQuestions: getSimilar(),
      source: $("#f-source").value.trim(),
      status: $("#f-status").value,
    };
    try {
      if (id) {
        payload.reason = $("#f-reason")?.value.trim();
        await api(`/knowledge/${id}`, { method: "PUT", body: payload });
        toast("تم حفظ التعديل كنسخة جديدة.", "success");
      } else {
        await api("/knowledge", { method: "POST", body: payload });
        toast("تمت إضافة المعلومة.", "success");
      }
      location.hash = "#/mod/knowledge";
    } catch (err) { toast(err.message, "error"); }
  });
}

// =========================================================
// VIEW: Feedback review (moderator)
// =========================================================
async function renderModFeedback() {
  const { items } = await api("/feedback?status=pending");
  mainView().innerHTML = `
    <div class="page-header"><div><h1>مراجعة الملاحظات</h1><p>${items.length} بانتظار المراجعة.</p></div></div>
    <div id="fb-review-list"></div>
  `;
  const list = $("#fb-review-list");
  if (!items.length) { list.innerHTML = emptyState("📥", "لا توجد ملاحظات حتى الآن."); return; }
  list.innerHTML = items.map((f) => `
    <div class="card" data-id="${f.id}">
      <p style="color:var(--text-dim);font-size:12px;">${f.type}</p>
      ${f.oldAnswer ? `<div class="diff-old">${escapeHtml(f.oldAnswer)}</div>` : ""}
      ${f.suggestion ? `<div class="diff-new">${escapeHtml(f.suggestion)}</div>` : ""}
      ${f.note ? `<p style="font-size:13px;color:var(--text-dim);">ملاحظة: ${escapeHtml(f.note)}</p>` : ""}
      <div class="modal-actions" style="justify-content:flex-start;">
        <button class="btn btn-primary btn-sm" data-act="accepted">✔️ قبول</button>
        <button class="btn btn-danger btn-sm" data-act="rejected">✖️ رفض</button>
      </div>
    </div>
  `).join("");
  list.addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-act]");
    if (!btn) return;
    const card = btn.closest("[data-id]");
    try {
      await api(`/feedback/${card.dataset.id}/resolve`, { method: "POST", body: { decision: btn.dataset.act } });
      card.remove();
      toast("تم تحديث الملاحظة.", "success");
    } catch (err) { toast(err.message, "error"); }
  });
}

// =========================================================
// VIEW: Gemini Data review (moderator)
// =========================================================
async function renderGeminiData() {
  const { items } = await api("/gemini-data?status=pending");
  mainView().innerHTML = `
    <div class="page-header"><div><h1>بيانات Gemini</h1><p>إجابات لم تُعتمد بعد كمعرفة رسمية.</p></div></div>
    <div id="gd-list"></div>
  `;
  const list = $("#gd-list");
  if (!items.length) { list.innerHTML = emptyState("✨", "لا توجد بيانات بانتظار المراجعة."); return; }
  items.forEach((g) => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <p style="color:var(--text-faint);font-size:12px;">${g.source} · ${escapeHtml(g.detectedDomain || "")}</p>
      <strong>${escapeHtml(g.query)}</strong>
      <p style="color:var(--text-dim);">${escapeHtml(g.answer)}</p>
      <div class="modal-actions" style="justify-content:flex-start;">
        <button class="btn btn-sm" data-act="review">مراجعة واعتماد</button>
        <button class="btn btn-danger btn-sm" data-act="reject">رفض</button>
      </div>
    `;
    card.querySelector('[data-act="reject"]').addEventListener("click", async () => {
      try { await api(`/gemini-data/${g.id}/reject`, { method: "POST" }); card.remove(); toast("تم الرفض.", "success"); }
      catch (err) { toast(err.message, "error"); }
    });
    card.querySelector('[data-act="review"]').addEventListener("click", () => openGeminiReviewModal(g, card));
    list.appendChild(card);
  });
}

function openGeminiReviewModal(g, card) {
  openModal(`
    <h3>مراجعة واعتماد كمعرفة</h3>
    <div class="form-field"><label>العنوان</label><input id="gr-title" value="${escapeHtml(g.query.slice(0, 60))}" /></div>
    <div class="form-field"><label>الرد</label><textarea id="gr-answer" rows="4">${escapeHtml(g.answer)}</textarea></div>
    <div class="form-grid">
      <div class="form-field"><label>المجال</label><input id="gr-domain" value="${escapeHtml(g.detectedDomain || "عام")}" /></div>
      <div class="form-field"><label>المجال الفرعي</label><input id="gr-subdomain" value="${escapeHtml(g.detectedSubdomain || "")}" /></div>
    </div>
    ${tagInputHtml("searchTerms", [])}
    ${tagInputHtml("similarQuestions", [])}
    <div class="modal-actions">
      <button class="btn" id="gr-ai-suggest">✨ اقترح تلقائيًا</button>
      <button class="btn btn-ghost" id="gr-cancel">إلغاء</button>
      <button class="btn btn-primary" id="gr-approve">اعتماد</button>
    </div>
  `, {
    onMount: (root) => {
      const getSearchTerms = wireTagInput("searchTerms", []);
      const getSimilar = wireTagInput("similarQuestions", []);
      $("#gr-cancel", root).addEventListener("click", closeModal);
      $("#gr-ai-suggest", root).addEventListener("click", async () => {
        try {
          const { suggestion } = await api(`/gemini-data/${g.id}/suggest-fields`, { method: "POST" });
          $("#gr-title", root).value = suggestion.title || "";
          $("#gr-domain", root).value = suggestion.domain || "عام";
          $("#gr-subdomain", root).value = suggestion.subdomain || "";
          (suggestion.searchTerms || []).forEach((t) => getSearchTerms.add(t));
          (suggestion.similarQuestions || []).forEach((t) => getSimilar.add(t));
          toast("تم جلب اقتراح Gemini — راجعه قبل الحفظ.", "success");
        } catch (err) { toast(err.message, "error"); }
      });
      $("#gr-approve", root).addEventListener("click", async () => {
        try {
          const { knowledgeId } = await api(`/gemini-data/${g.id}/approve`, {
            method: "POST",
            body: {
              title: $("#gr-title", root).value.trim(),
              answer: $("#gr-answer", root).value.trim(),
              domain: $("#gr-domain", root).value.trim(),
              subdomain: $("#gr-subdomain", root).value.trim(),
              searchTerms: getSearchTerms(),
              similarQuestions: getSimilar(),
            },
          });
          toast("تم اعتماد المعلومة في قاعدة المعرفة.", "success");
          closeModal();
          card.remove();
        } catch (err) { toast(err.message, "error"); }
      });
    },
  });
}

// =========================================================
// VIEW: My contributions (realtime via Firestore rules)
// =========================================================
async function renderContributions() {
  mainView().innerHTML = `
    <div class="page-header"><div><h1>مساهماتي</h1><p>كل عملية إضافة أو تعديل قمت بها.</p></div></div>
    <div id="contrib-list">${emptyState("🏅", "جارِ التحميل…")}</div>
  `;
  const q = query(collection(db, "moderatorData"), where("moderatorId", "==", state.user.uid), orderBy("createdAt", "desc"), limit(100));
  const unsub = onSnapshot(q, (snap) => {
    const list = $("#contrib-list");
    if (snap.empty) { list.innerHTML = emptyState("🏅", "لا توجد مساهمات حتى الآن."); return; }
    list.innerHTML = snap.docs.map((d) => {
      const v = d.data();
      const date = v.createdAt?.toDate ? v.createdAt.toDate().toLocaleString("ar-EG") : "";
      return `<div class="card"><strong>${escapeHtml(v.action)}</strong><p style="color:var(--text-dim);font-size:13px;">${escapeHtml(v.description)}</p><span style="color:var(--text-faint);font-size:12px;">${date}</span></div>`;
    }).join("");
  }, (err) => toast(err.message, "error"));
  state.unsubscribers.push(unsub);
}

// =========================================================
// VIEW: Team directory (moderator/owner)
// =========================================================
async function renderTeamDirectory() {
  const { items } = await api("/moderators");
  mainView().innerHTML = `
    <div class="page-header"><div><h1>الفريق</h1></div></div>
    <input id="team-search" placeholder="ابحث بالاسم أو Staff ID…" style="margin-bottom:14px;" />
    <div id="team-list"></div>
  `;
  const render = (list) => {
    $("#team-list").innerHTML = list.length ? list.map((m) => `
      <div class="card" style="display:flex;justify-content:space-between;align-items:center;">
        <div>
          <strong>${escapeHtml(m.name)}</strong>
          <span style="color:var(--text-faint);font-size:12px;margin-inline-start:8px;">#${escapeHtml(m.staffId)} · ${escapeHtml(m.role)}</span>
        </div>
        ${m.id !== state.user.uid ? `<button class="btn btn-sm" data-msg="${m.id}">مراسلة</button>` : ""}
      </div>
    `).join("") : emptyState("👥", "لا يوجد أعضاء.");
  };
  render(items);
  $("#team-search").addEventListener("input", async (e) => {
    const q = e.target.value.trim();
    if (!q) return render(items);
    const { items: results } = await api(`/moderators/search?q=${encodeURIComponent(q)}`);
    render(results);
  });
  $("#team-list").addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-msg]");
    if (!btn) return;
    try {
      const chat = await api(`/team/chats/with/${btn.dataset.msg}`, { method: "POST" });
      location.hash = `#/mod/team-chat/${chat.id}`;
    } catch (err) { toast(err.message, "error"); }
  });
}

// =========================================================
// VIEW: Team chat (realtime)
// =========================================================
async function renderTeamChat(chatId) {
  const { items: chats } = await api("/team/chats");
  const { items: profiles } = await api("/moderators");
  const nameOf = (uid) => profiles.find((p) => p.id === uid)?.name || "عضو الفريق";

  mainView().innerHTML = `
    <div class="page-header"><div><h1>محادثة الفريق</h1><p>خاصة بالمشرفين والمالك فقط.</p></div></div>
    <div style="display:grid;grid-template-columns:220px 1fr;gap:16px;">
      <div id="chat-sidebar"></div>
      <div class="card" style="display:flex;flex-direction:column;height:60vh;">
        <div class="chat-scroll" id="team-scroll" style="flex:1;"></div>
        <form id="team-msg-form" class="chat-input-bar" style="display:${chatId ? "flex" : "none"};">
          <textarea id="team-msg-input" placeholder="اكتب رسالة…"></textarea>
          <button class="btn btn-primary">إرسال</button>
        </form>
      </div>
    </div>
  `;

  const sidebar = $("#chat-sidebar");
  sidebar.innerHTML = chats.length
    ? chats.map((c) => {
        const other = c.participants.find((p) => p !== state.user.uid);
        return `<a class="card" style="display:block;margin-bottom:8px;" href="#/mod/team-chat/${c.id}">${escapeHtml(nameOf(other))}<div style="color:var(--text-faint);font-size:12px;">${escapeHtml(c.lastMessageText || "")}</div></a>`;
      }).join("")
    : emptyState("💬", "لا توجد محادثات — ابدأ من صفحة الفريق.");

  if (!chatId) {
    $("#team-scroll").innerHTML = emptyState("💬", "اختر محادثة من القائمة.");
    return;
  }

  const scroll = $("#team-scroll");
  const q = query(collection(db, "teamChats", chatId, "messages"), orderBy("createdAt", "asc"), limit(300));
  const unsub = onSnapshot(q, (snap) => {
    if (snap.empty) { scroll.innerHTML = emptyState("💬", "ابدأ المحادثة."); return; }
    scroll.innerHTML = snap.docs.map((d) => {
      const v = d.data();
      const mine = v.senderId === state.user.uid;
      return `<div class="msg ${mine ? "user" : "assistant"}">${escapeHtml(v.text)}</div>`;
    }).join("");
    scroll.scrollTop = scroll.scrollHeight;
  }, (err) => toast(err.message, "error"));
  state.unsubscribers.push(unsub);

  $("#team-msg-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = $("#team-msg-input");
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    try { await api(`/team/chats/${chatId}/messages`, { method: "POST", body: { text } }); }
    catch (err) { toast(err.message, "error"); }
  });
}

// =========================================================
// VIEW: Owner dashboard
// =========================================================
async function renderOwnerDashboard() {
  const [stats, { items: mods }] = await Promise.all([api("/dashboard/stats"), api("/moderators")]);
  const nameOf = (uid) => mods.find((m) => m.id === uid)?.name || "—";
  mainView().innerHTML = `
    <div class="page-header"><div><h1>لوحة المالك</h1></div></div>
    <div class="stat-grid">
      <div class="stat-card"><div class="value">${stats.totals.users}</div><div class="label">إجمالي المستخدمين</div></div>
      <div class="stat-card"><div class="value">${stats.totals.moderators}</div><div class="label">إجمالي المشرفين</div></div>
      <div class="stat-card"><div class="value">${stats.totals.knowledge}</div><div class="label">إجمالي المعرفة</div></div>
      <div class="stat-card"><div class="value">${stats.totals.geminiData}</div><div class="label">بيانات Gemini</div></div>
      <div class="stat-card"><div class="value">${stats.totals.feedback}</div><div class="label">إجمالي الملاحظات</div></div>
      <div class="stat-card"><div class="value">${stats.today.added}</div><div class="label">أُضيفت اليوم</div></div>
      <div class="stat-card"><div class="value">${stats.today.updated}</div><div class="label">عُدّلت اليوم</div></div>
      <div class="stat-card"><div class="value">${stats.suggestionsAccepted}</div><div class="label">اقتراحات مقبولة</div></div>
      <div class="stat-card"><div class="value">${stats.suggestionsRejected}</div><div class="label">اقتراحات مرفوضة</div></div>
    </div>
    <div class="card">
      <strong>الأكثر استخدامًا</strong>
      ${stats.topUsedKnowledge.length ? stats.topUsedKnowledge.map((k) => `<p>${escapeHtml(k.title)} — ${k.usageCount}</p>`).join("") : emptyState("📊", "لا توجد بيانات حتى الآن.")}
    </div>
    <div class="card">
      <strong>أسئلة بلا إجابة محلية</strong>
      ${stats.topUnansweredQuestions.length ? stats.topUnansweredQuestions.map((q) => `<p>${escapeHtml(q.query)} — ${q.count}</p>`).join("") : emptyState("❓", "لا توجد بيانات حتى الآن.")}
    </div>
    <div class="card">
      <strong>أكثر الكلمات بحثًا</strong>
      ${stats.topSearchTerms.length ? stats.topSearchTerms.map((t) => `<span class="tag">${escapeHtml(t.term)} (${t.count})</span>`).join(" ") : emptyState("🔤", "لا توجد بيانات حتى الآن.")}
    </div>
    <div class="card">
      <p><strong>المشرف الأكثر إضافة:</strong> ${stats.topAdderModeratorId ? escapeHtml(nameOf(stats.topAdderModeratorId)) : "لا يوجد بيانات حتى الآن."}</p>
      <p><strong>المشرف الأكثر مراجعة:</strong> ${stats.topReviewerModeratorId ? escapeHtml(nameOf(stats.topReviewerModeratorId)) : "لا يوجد بيانات حتى الآن."}</p>
    </div>
  `;
}

// =========================================================
// VIEW: Owner — Users
// =========================================================
async function renderOwnerUsers() {
  const { items } = await api("/users");
  mainView().innerHTML = `
    <div class="page-header"><div><h1>المستخدمون</h1><p>${items.length} مستخدم.</p></div></div>
    <table><thead><tr><th>البريد</th><th>الصلاحية</th><th>الحالة</th><th></th></tr></thead><tbody id="users-body"></tbody></table>
  `;
  $("#users-body").innerHTML = items.map((u) => `
    <tr data-uid="${u.uid}">
      <td>${escapeHtml(u.email || "—")}</td>
      <td>${escapeHtml(u.role)}</td>
      <td><span class="pill ${u.status === "active" ? "approved" : "rejected"}">${u.status === "active" ? "نشط" : "معطل"}</span></td>
      <td>
        ${u.role === "owner" ? "" : u.role === "user"
          ? `<button class="btn btn-sm" data-promote="${u.uid}">ترقية لمشرف</button>
             <button class="btn btn-sm btn-danger" data-toggle="${u.status === "active" ? "disable" : "enable"}">${u.status === "active" ? "تعطيل" : "تفعيل"}</button>`
          : `<button class="btn btn-sm btn-danger" data-toggle="${u.status === "active" ? "disable" : "enable"}">${u.status === "active" ? "تعطيل" : "تفعيل"}</button>`}
      </td>
    </tr>
  `).join("");

  $("#users-body").addEventListener("click", async (e) => {
    const row = e.target.closest("tr");
    if (!row) return;
    const uid = row.dataset.uid;
    if (e.target.dataset.promote) return openPromoteModal(uid);
    if (e.target.dataset.toggle) {
      try { await api(`/users/${uid}/${e.target.dataset.toggle}`, { method: "POST" }); renderOwnerUsers(); }
      catch (err) { toast(err.message, "error"); }
    }
  });
}

function openPromoteModal(uid) {
  openModal(`
    <h3>ترقية إلى مشرف</h3>
    <div class="form-field"><label>الاسم الظاهر</label><input id="p-name" /></div>
    <div class="form-field"><label>Staff ID</label><input id="p-staffid" /></div>
    <div class="modal-actions">
      <button class="btn btn-ghost" id="p-cancel">إلغاء</button>
      <button class="btn btn-primary" id="p-submit">ترقية</button>
    </div>
  `, {
    onMount: (root) => {
      $("#p-cancel", root).addEventListener("click", closeModal);
      $("#p-submit", root).addEventListener("click", async () => {
        try {
          await api("/moderators/promote", { method: "POST", body: { uid, name: $("#p-name", root).value.trim(), staffId: $("#p-staffid", root).value.trim() } });
          toast("تمت الترقية.", "success");
          closeModal();
          renderOwnerUsers();
        } catch (err) { toast(err.message, "error"); }
      });
    },
  });
}

// =========================================================
// VIEW: Owner — Moderators
// =========================================================
async function renderOwnerModerators() {
  const { items } = await api("/moderators");
  mainView().innerHTML = `
    <div class="page-header"><div><h1>المشرفون</h1></div></div>
    <div id="mods-list"></div>
  `;
  $("#mods-list").innerHTML = items.map((m) => `
    <div class="card" style="display:flex;justify-content:space-between;align-items:center;">
      <div><strong>${escapeHtml(m.name)}</strong> <span style="color:var(--text-faint);font-size:12px;">#${escapeHtml(m.staffId)}</span>
        <div><span class="pill ${m.status === "active" ? "approved" : "rejected"}">${m.status === "active" ? "نشط" : "معطل"}</span></div>
      </div>
      ${m.role !== "owner" ? `<button class="btn btn-sm btn-danger" data-disable="${m.id}">تعطيل</button>` : ""}
    </div>
  `).join("") || emptyState("🛡️", "لا يوجد مشرفون بعد.");

  $("#mods-list").addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-disable]");
    if (!btn) return;
    if (!confirm("تعطيل هذا المشرف؟")) return;
    try { await api(`/moderators/${btn.dataset.disable}/disable`, { method: "POST" }); renderOwnerModerators(); }
    catch (err) { toast(err.message, "error"); }
  });
}

// =========================================================
// VIEW: Owner — Audit logs
// =========================================================
async function renderAuditLogs() {
  const { items } = await api("/audit-logs?limit=200");
  mainView().innerHTML = `
    <div class="page-header"><div><h1>سجل العمليات</h1><p>${items.length} عملية.</p></div></div>
    ${items.length ? `<table><thead><tr><th>العملية</th><th>الفاعل</th><th>الهدف</th><th>التاريخ</th></tr></thead><tbody>
      ${items.map((l) => `<tr><td>${escapeHtml(l.action)}</td><td>${escapeHtml(l.actorRole)}</td><td>${escapeHtml(l.targetId || "—")}</td><td>${l.createdAt?._seconds ? new Date(l.createdAt._seconds * 1000).toLocaleString("ar-EG") : ""}</td></tr>`).join("")}
    </tbody></table>` : emptyState("🧾", "لا توجد عمليات مسجلة بعد.")}
  `;
}

// =========================================================
// VIEW: Owner — Instructions
// =========================================================
async function renderInstructions() {
  const { items } = await api("/instructions");
  mainView().innerHTML = `
    <div class="page-header"><div><h1>تعليمات AI</h1><p>تُدمج هذه التعليمات في تعليمات النظام لكل رد.</p></div></div>
    <form id="instr-form" class="card" style="display:flex;gap:10px;margin-bottom:16px;">
      <input id="instr-text" placeholder="مثال: أجب بالعربية دائمًا." required />
      <button class="btn btn-primary">إضافة</button>
    </form>
    <div id="instr-list"></div>
  `;
  $("#instr-list").innerHTML = items.length ? items.map((i) => `
    <div class="card" style="display:flex;justify-content:space-between;align-items:center;">
      <span>${escapeHtml(i.text)}</span>
      <button class="btn btn-sm ${i.active ? "" : "btn-ghost"}" data-toggle="${i.id}">${i.active ? "مفعّلة" : "معطّلة"}</button>
    </div>
  `).join("") : emptyState("🧭", "لا توجد تعليمات بعد.");

  $("#instr-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    try { await api("/instructions", { method: "POST", body: { text: $("#instr-text").value.trim() } }); renderInstructions(); }
    catch (err) { toast(err.message, "error"); }
  });
  $("#instr-list").addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-toggle]");
    if (!btn) return;
    try { await api(`/instructions/${btn.dataset.toggle}/toggle`, { method: "POST" }); renderInstructions(); }
    catch (err) { toast(err.message, "error"); }
  });
}

// ---------------------------------------------------------
// Auth state -> boot
// ---------------------------------------------------------
onAuthStateChanged(fbAuth, async (user) => {
  state.user = user;
  if (!user) {
    $("#auth-screen").classList.remove("hidden");
    $("#app-shell").classList.add("hidden");
    return;
  }
  try {
    const { user: profile } = await api("/users/me");
    state.profile = profile;
    applyRoleVisibility(profile.role);
    $("#auth-screen").classList.add("hidden");
    $("#app-shell").classList.remove("hidden");
    router();
  } catch (err) {
    console.error("Failed to load profile", err);
    toast("تعذّر تحميل الحساب. حاول تسجيل الدخول من جديد.", "error");
    signOut(fbAuth);
  }
});

initAuthScreen();
