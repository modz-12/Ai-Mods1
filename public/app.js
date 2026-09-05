const state = {
  type: 'all',
  search: '',
  page: 1,
  limit: 24,
  items: [],
  hasMore: false,
  requiresPassword: true,
  authVerified: false,
  lightboxIndex: -1,
  pendingAction: null,
  mode: 'upload',
};

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const gallery = $('#gallery');
const toast = $('#toast');

function showToast(message, ms = 3000) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast.t);
  showToast.t = setTimeout(() => toast.classList.remove('show'), ms);
}

async function readResponse(res) {
  const text = await res.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { error: text || `HTTP ${res.status}` }; }
  return { res, data };
}

function authPassword() {
  return localStorage.getItem('gallery_admin_password') || '';
}

function authHeaders() {
  const pw = authPassword();
  return pw ? { 'x-admin-password': pw } : {};
}

function clearAuth() {
  localStorage.removeItem('gallery_admin_password');
  state.authVerified = false;
}

function showPasswordModal(message = '') {
  $('#passwordError').textContent = message;
  $('#passwordError').classList.toggle('hidden', !message);
  $('#passwordInput').value = '';
  $('#passwordModal').classList.remove('hidden');
  setTimeout(() => $('#passwordInput').focus(), 50);
}

async function verifyPassword(password) {
  if (!password) {
    showPasswordModal('اكتب كلمة السر الأول.');
    return false;
  }
  const button = $('#passwordSubmit');
  button.disabled = true;
  try {
    const {res, data} = await readResponse(await fetch('/api/admin/check', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      cache: 'no-store',
      body: JSON.stringify({password}),
    }));
    if (!res.ok || data.ok !== true) {
      clearAuth();
      const msg = data.error || (res.status === 401 ? 'كلمة السر غير صحيحة.' : 'فشل التحقق من كلمة السر.');
      showPasswordModal(msg);
      return false;
    }
    localStorage.setItem('gallery_admin_password', password);
    state.authVerified = true;
    $('#passwordModal').classList.add('hidden');
    return true;
  } catch (err) {
    showPasswordModal(`تعذر الاتصال بالسيرفر: ${err.message}`);
    return false;
  } finally {
    button.disabled = false;
  }
}

async function ensureAuthorized(action) {
  if (!state.requiresPassword) return action();
  const stored = authPassword();
  if (stored && !state.authVerified) {
    if (await verifyPassword(stored)) return action();
    return;
  }
  if (state.authVerified) return action();
  state.pendingAction = action;
  showPasswordModal();
}

async function loadConfig() {
  try {
    const {res, data} = await readResponse(await fetch('/api/config', {cache: 'no-store'}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    $('#siteName').textContent = data.siteName || 'المعرض';
    document.title = data.siteName || 'المعرض';
    state.requiresPassword = data.requiresPassword === true;
    if (!state.requiresPassword) state.authVerified = true;
  } catch (err) {
    // Fail closed: if config cannot be read, keep admin actions protected.
    state.requiresPassword = true;
    $('#statusText').textContent = `خطأ إعدادات: ${err.message}`;
    console.error('[config]', err);
  }
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
  }[c]));
}

function render() {
  gallery.innerHTML = '';
  $('#resultCount').textContent = `${state.items.length} عنصر`;
  $('#loadMoreBtn').classList.toggle('hidden', !state.hasMore);

  if (!state.items.length) {
    $('#emptyState').classList.remove('hidden');
    return;
  }
  $('#emptyState').classList.add('hidden');

  state.items.forEach((item, index) => {
    const card = document.createElement('article');
    card.className = 'card';
    card.dataset.index = index;
    const title = escapeHtml(item.title || 'بدون عنوان');
    const meta = item.type === 'video' ? 'فيديو' : 'صورة';
    if (item.type === 'image') {
      card.innerHTML = `
        <img loading="lazy" src="${escapeHtml(item.thumbnail || item.src)}" alt="${title}">
        <div class="card-info"><div class="card-title">${title}</div><div class="card-meta">${meta}</div></div>`;
    } else {
      const thumb = item.thumbnail
        ? `<img loading="lazy" src="${escapeHtml(item.thumbnail)}" alt="${title}">`
        : `<div style="aspect-ratio:16/10;display:grid;place-items:center;background:#080b11;font-size:48px">▶</div>`;
      card.innerHTML = `${thumb}<span class="play">▶</span><div class="card-info"><div class="card-title">${title}</div><div class="card-meta">${meta} · ${escapeHtml(item.source || 'رابط')}</div></div>`;
    }
    card.addEventListener('click', () => openLightbox(index));
    gallery.appendChild(card);
  });
}

async function fetchMedia({reset = false} = {}) {
  if (reset) {
    state.page = 1;
    state.items = [];
  }
  $('#statusText').textContent = 'جاري التحميل...';
  try {
    const params = new URLSearchParams({
      type: state.type,
      search: state.search,
      page: state.page,
      limit: state.limit,
    });
    const {res, data} = await readResponse(await fetch(`/api/media?${params}`));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    state.items = reset ? (data.items || []) : state.items.concat(data.items || []);
    state.hasMore = Boolean(data.hasMore);
    $('#statusText').textContent = state.hasMore ? 'فيه عناصر إضافية' : 'تم تحميل كل النتائج';
    render();
  } catch (err) {
    $('#statusText').textContent = `خطأ: ${err.message}`;
    showToast(`فشل تحميل الميديا: ${err.message}`, 5000);
  }
}

function openAddModal() {
  ensureAuthorized(() => $('#addModal').classList.remove('hidden'));
}

function setMode(mode) {
  state.mode = mode;
  $$('.add-tab').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
  $('#uploadPane').classList.toggle('hidden', mode !== 'upload');
  $('#linkPane').classList.toggle('hidden', mode !== 'link');
}

function renderFileList(files) {
  $('#fileList').innerHTML = [...files].map(f =>
    `<span class="file-chip">${escapeHtml(f.name)} · ${(f.size / 1024 / 1024).toFixed(1)}MB</span>`
  ).join('');
}

function uploadFiles() {
  const files = $('#fileInput').files;
  if (!files.length) return showToast('اختار ملف أو أكتر الأول.');
  const form = new FormData();
  [...files].forEach(f => form.append('files', f));
  form.append('title', $('#uploadTitle').value.trim());

  const xhr = new XMLHttpRequest();
  xhr.open('POST', '/api/media/upload');
  Object.entries(authHeaders()).forEach(([k,v]) => xhr.setRequestHeader(k,v));
  $('#uploadBtn').disabled = true;
  $('#uploadProgress').classList.remove('hidden');

  xhr.upload.onprogress = (e) => {
    if (e.lengthComputable) $('#uploadProgress i').style.width = `${Math.round(e.loaded / e.total * 100)}%`;
  };
  xhr.onload = () => {
    $('#uploadBtn').disabled = false;
    $('#uploadProgress').classList.add('hidden');
    let data = {};
    try { data = JSON.parse(xhr.responseText || '{}'); } catch { data = {error: xhr.responseText}; }
    if (xhr.status === 401 || xhr.status === 403) {
      clearAuth();
      $('#addModal').classList.add('hidden');
      showPasswordModal(data.error || 'انتهت صلاحية كلمة السر.');
      return;
    }
    if (xhr.status < 200 || xhr.status >= 300) {
      showToast(data.error || `فشل الرفع (HTTP ${xhr.status})`, 5000);
      return;
    }
    $('#addModal').classList.add('hidden');
    $('#fileInput').value = '';
    $('#fileList').innerHTML = '';
    $('#uploadTitle').value = '';
    showToast('تم رفع الملفات بنجاح ✓');
    fetchMedia({reset:true});
  };
  xhr.onerror = () => {
    $('#uploadBtn').disabled = false;
    $('#uploadProgress').classList.add('hidden');
    showToast('حصل خطأ في الاتصال أثناء الرفع.', 5000);
  };
  xhr.send(form);
}

async function addLink() {
  const url = $('#linkUrl').value.trim();
  const title = $('#linkTitle').value.trim();
  const type = $('#linkType').value;
  if (!url) return showToast('اكتب الرابط الأول.');
  const btn = $('#linkBtn');
  btn.disabled = true;
  $('#linkError').classList.add('hidden');
  try {
    const {res, data} = await readResponse(await fetch('/api/media/link', {
      method:'POST',
      headers:{'Content-Type':'application/json', ...authHeaders()},
      body:JSON.stringify({url,title,type})
    }));
    if (res.status === 401 || res.status === 403) {
      clearAuth();
      $('#addModal').classList.add('hidden');
      showPasswordModal(data.error || 'كلمة السر غير صالحة.');
      return;
    }
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    $('#addModal').classList.add('hidden');
    $('#linkUrl').value = '';
    $('#linkTitle').value = '';
    showToast('تمت إضافة الرابط ✓');
    fetchMedia({reset:true});
  } catch (err) {
    $('#linkError').textContent = err.message;
    $('#linkError').classList.remove('hidden');
  } finally {
    btn.disabled = false;
  }
}

function openLightbox(index) {
  state.lightboxIndex = index;
  $('#lightbox').classList.remove('hidden');
  renderLightbox();
}

function renderLightbox() {
  const item = state.items[state.lightboxIndex];
  if (!item) return;
  const box = $('#lbMedia');
  box.innerHTML = '';
  if (item.type === 'image') {
    const img = document.createElement('img');
    img.src = item.src;
    img.alt = item.title || '';
    box.appendChild(img);
  } else if (item.embedUrl) {
    const iframe = document.createElement('iframe');
    iframe.src = item.embedUrl;
    iframe.allow = 'autoplay; encrypted-media; picture-in-picture';
    iframe.allowFullscreen = true;
    box.appendChild(iframe);
  } else {
    const video = document.createElement('video');
    video.src = item.src;
    video.controls = true;
    video.autoplay = true;
    box.appendChild(video);
  }
  $('#lbTitle').textContent = item.title || 'بدون عنوان';
}

function closeLightbox() {
  $('#lightbox').classList.add('hidden');
  $('#lbMedia').innerHTML = '';
  state.lightboxIndex = -1;
}

function moveLightbox(delta) {
  if (!state.items.length) return;
  state.lightboxIndex = (state.lightboxIndex + delta + state.items.length) % state.items.length;
  renderLightbox();
}

async function deleteCurrent() {
  const item = state.items[state.lightboxIndex];
  if (!item) return;
  if (!confirm(`حذف "${item.title || 'بدون عنوان'}"؟`)) return;

  try {
    const {res, data} = await readResponse(await fetch(`/api/media/${encodeURIComponent(item.id)}`, {
      method:'DELETE',
      headers: authHeaders(),
    }));
    if (res.status === 401 || res.status === 403) {
      clearAuth();
      closeLightbox();
      showPasswordModal(data.error || 'كلمة السر غير صالحة.');
      return;
    }
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    closeLightbox();
    showToast('تم الحذف ✓');
    fetchMedia({reset:true});
  } catch (err) {
    showToast(`فشل الحذف: ${err.message}`, 5000);
  }
}

function initEvents() {
  $('#openAddBtn').addEventListener('click', openAddModal);
  $('#emptyAddBtn').addEventListener('click', openAddModal);
  $('#passwordSubmit').addEventListener('click', async () => {
    const ok = await verifyPassword($('#passwordInput').value);
    if (ok && state.pendingAction) {
      const action = state.pendingAction;
      state.pendingAction = null;
      action();
    }
  });
  $('#passwordInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') $('#passwordSubmit').click();
  });
  $$('.filter').forEach(btn => btn.addEventListener('click', () => {
    $$('.filter').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.type = btn.dataset.type;
    fetchMedia({reset:true});
  }));
  let timer;
  $('#searchInput').addEventListener('input', e => {
    clearTimeout(timer);
    state.search = e.target.value.trim();
    timer = setTimeout(() => fetchMedia({reset:true}), 280);
  });
  $('#loadMoreBtn').addEventListener('click', () => { state.page++; fetchMedia(); });
  $$('.add-tab').forEach(btn => btn.addEventListener('click', () => setMode(btn.dataset.mode)));
  $('#fileInput').addEventListener('change', e => renderFileList(e.target.files));
  $('#uploadBtn').addEventListener('click', () => ensureAuthorized(uploadFiles));
  $('#linkBtn').addEventListener('click', () => ensureAuthorized(addLink));
  $('#dropzone').addEventListener('dragover', e => { e.preventDefault(); $('#dropzone').style.borderColor='#6e5bff'; });
  $('#dropzone').addEventListener('dragleave', () => $('#dropzone').style.borderColor='');
  $('#dropzone').addEventListener('drop', e => {
    e.preventDefault();
    $('#dropzone').style.borderColor='';
    if (e.dataTransfer.files.length) {
      const dt = new DataTransfer();
      [...e.dataTransfer.files].slice(0,20).forEach(f => dt.items.add(f));
      $('#fileInput').files = dt.files;
      renderFileList(dt.files);
    }
  });
  $$('.close').forEach(btn => btn.addEventListener('click', () => $('#' + btn.dataset.close).classList.add('hidden')));
  $('#lbClose').addEventListener('click', closeLightbox);
  $('#lbPrev').addEventListener('click', () => moveLightbox(-1));
  $('#lbNext').addEventListener('click', () => moveLightbox(1));
  $('#lbDelete').addEventListener('click', () => ensureAuthorized(deleteCurrent));
  $('#lightbox').addEventListener('click', e => { if (e.target.id === 'lightbox') closeLightbox(); });
  document.addEventListener('keydown', e => {
    if ($('#lightbox').classList.contains('hidden')) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') moveLightbox(1);
    if (e.key === 'ArrowRight') moveLightbox(-1);
  });
  $('#themeBtn').addEventListener('click', () => {
    document.body.classList.toggle('light');
    $('#themeBtn').textContent = document.body.classList.contains('light') ? '☀' : '☾';
  });
}

async function init() {
  initEvents();
  await loadConfig();
  await fetchMedia({reset:true});
  const stored = authPassword();
  if (state.requiresPassword && stored) {
    verifyPassword(stored).catch(console.error);
  }
}
init();
