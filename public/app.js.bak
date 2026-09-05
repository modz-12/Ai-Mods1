(() => {
  const state = {
    type: 'all',
    search: '',
    page: 1,
    limit: 24,
    items: [],
    hasMore: false,
    requiresPassword: false,
    lightboxIndex: -1,
  };

  const el = {
    gallery: document.getElementById('gallery'),
    emptyState: document.getElementById('empty-state'),
    loadMore: document.getElementById('load-more'),
    filterBtns: document.querySelectorAll('.filter-btn'),
    searchInput: document.getElementById('search-input'),
    siteName: document.getElementById('site-name'),

    openAdd: document.getElementById('open-add'),
    closeAdd: document.getElementById('close-add'),
    addPanel: document.getElementById('add-panel'),
    tabBtns: document.querySelectorAll('.tab-btn'),
    tabPanels: document.querySelectorAll('.tab-panel'),

    dropZone: document.getElementById('drop-zone'),
    fileInput: document.getElementById('file-input'),
    uploadTitle: document.getElementById('upload-title'),
    fileList: document.getElementById('file-list'),
    doUpload: document.getElementById('do-upload'),

    linkUrl: document.getElementById('link-url'),
    linkTitle: document.getElementById('link-title'),
    doLink: document.getElementById('do-link'),

    addError: document.getElementById('add-error'),
    addProgress: document.getElementById('add-progress'),

    lightbox: document.getElementById('lightbox'),
    lightboxContent: document.getElementById('lightbox-content'),
    lightboxTitle: document.getElementById('lightbox-title'),
    lightboxClose: document.getElementById('lightbox-close'),
    lightboxPrev: document.getElementById('lightbox-prev'),
    lightboxNext: document.getElementById('lightbox-next'),
    lightboxDelete: document.getElementById('lightbox-delete'),

    passwordModal: document.getElementById('password-modal'),
    passwordInput: document.getElementById('password-input'),
    passwordError: document.getElementById('password-error'),
    passwordConfirm: document.getElementById('password-confirm'),
    passwordCancel: document.getElementById('password-cancel'),
  };

  let selectedFiles = [];
  let pendingAction = null; // دالة هتتنفذ بعد التحقق من كلمة السر بنجاح

  // ---------- إعدادات الموقع ----------
  async function loadConfig() {
    try {
      const res = await fetch('/api/config');
      const data = await res.json();
      el.siteName.textContent = data.siteName;
      document.title = data.siteName;
      state.requiresPassword = data.requiresPassword;
    } catch {
      /* استخدم الإعدادات الافتراضية لو فشل الطلب */
    }
  }

  // ---------- كلمة السر ----------
  function getStoredPassword() {
    return localStorage.getItem('gallery_admin_password') || '';
  }

  function ensureAuthorized(action) {
    if (!state.requiresPassword) return action();
    const stored = getStoredPassword();
    if (stored) {
      pendingAction = action;
      verifyAndRun(stored);
      return;
    }
    pendingAction = action;
    el.passwordError.hidden = true;
    el.passwordInput.value = '';
    el.passwordModal.hidden = false;
    el.passwordInput.focus();
  }

  async function verifyAndRun(password) {
    try {
      const res = await fetch('/api/admin/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (data.ok) {
        localStorage.setItem('gallery_admin_password', password);
        el.passwordModal.hidden = true;
        const action = pendingAction;
        pendingAction = null;
        if (action) action();
      } else {
        el.passwordError.textContent = 'كلمة السر غلط';
        el.passwordError.hidden = false;
      }
    } catch {
      el.passwordError.textContent = 'حصل خطأ، حاول تاني';
      el.passwordError.hidden = false;
    }
  }

  el.passwordConfirm.addEventListener('click', () => verifyAndRun(el.passwordInput.value));
  el.passwordInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') verifyAndRun(el.passwordInput.value);
  });
  el.passwordCancel.addEventListener('click', () => {
    el.passwordModal.hidden = true;
    pendingAction = null;
  });

  function authHeaders() {
    const pw = getStoredPassword();
    return pw ? { 'x-admin-password': pw } : {};
  }

  // ---------- تحميل الميديا ----------
  async function fetchMedia({ reset = false } = {}) {
    if (reset) {
      state.page = 1;
      state.items = [];
    }
    const params = new URLSearchParams({
      type: state.type,
      search: state.search,
      page: state.page,
      limit: state.limit,
    });
    const res = await fetch(`/api/media?${params.toString()}`);
    const data = await res.json();

    state.items = reset ? data.items : [...state.items, ...data.items];
    state.hasMore = data.hasMore;

    renderGallery();
    el.loadMore.hidden = !state.hasMore;
    el.emptyState.hidden = state.items.length > 0;
  }

  function cardMarkup(item) {
    if (item.type === 'image') {
      return `<img src="${item.thumbnail || item.src}" alt="${escapeHtml(item.title)}" loading="lazy" />`;
    }
    // فيديو
    if (item.thumbnail) {
      return `<img src="${item.thumbnail}" alt="${escapeHtml(item.title)}" loading="lazy" /><div class="play-badge">▶</div>`;
    }
    return `<div class="video-placeholder"><span class="play-badge">▶</span></div>`;
  }

  function renderGallery() {
    el.gallery.innerHTML = state.items
      .map(
        (item, idx) => `
      <div class="media-card" data-idx="${idx}">
        ${cardMarkup(item)}
        <div class="card-label">${escapeHtml(item.title)}</div>
      </div>`
      )
      .join('');

    el.gallery.querySelectorAll('.media-card').forEach((card) => {
      card.addEventListener('click', () => openLightbox(Number(card.dataset.idx)));
    });
  }

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }

  // ---------- فلاتر وبحث ----------
  el.filterBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      el.filterBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      state.type = btn.dataset.type;
      fetchMedia({ reset: true });
    });
  });

  let searchTimer;
  el.searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.search = el.searchInput.value;
      fetchMedia({ reset: true });
    }, 350);
  });

  el.loadMore.addEventListener('click', () => {
    state.page += 1;
    fetchMedia();
  });

  // ---------- لوحة الإضافة ----------
  function openAddPanel() {
    ensureAuthorized(() => {
      el.addPanel.hidden = false;
      el.addError.hidden = true;
      el.addProgress.hidden = true;
    });
  }

  el.openAdd.addEventListener('click', openAddPanel);
  el.closeAdd.addEventListener('click', () => (el.addPanel.hidden = true));
  el.addPanel.addEventListener('click', (e) => {
    if (e.target === el.addPanel) el.addPanel.hidden = true;
  });

  el.tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      el.tabBtns.forEach((b) => b.classList.remove('active'));
      el.tabPanels.forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
    });
  });

  // ---------- رفع الملفات ----------
  el.dropZone.addEventListener('click', (e) => e.preventDefault() || el.fileInput.click());
  el.fileInput.addEventListener('change', () => addFiles(el.fileInput.files));

  ['dragover', 'dragenter'].forEach((evt) =>
    el.dropZone.addEventListener(evt, (e) => {
      e.preventDefault();
      el.dropZone.classList.add('drag-over');
    })
  );
  ['dragleave', 'drop'].forEach((evt) =>
    el.dropZone.addEventListener(evt, (e) => {
      e.preventDefault();
      el.dropZone.classList.remove('drag-over');
    })
  );
  el.dropZone.addEventListener('drop', (e) => addFiles(e.dataTransfer.files));

  function addFiles(fileList) {
    selectedFiles = [...selectedFiles, ...Array.from(fileList)].slice(0, 20);
    el.fileList.innerHTML = selectedFiles.map((f) => `<span>${escapeHtml(f.name)}</span>`).join('');
  }

  el.doUpload.addEventListener('click', () => {
    if (selectedFiles.length === 0) {
      showAddError('اختار ملف واحد على الأقل');
      return;
    }
    ensureAuthorized(doUpload);
  });

  function doUpload() {
    const formData = new FormData();
    selectedFiles.forEach((f) => formData.append('files', f));
    formData.append('title', el.uploadTitle.value.trim());

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/media/upload');
    Object.entries(authHeaders()).forEach(([k, v]) => xhr.setRequestHeader(k, v));

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 100);
        el.addProgress.hidden = false;
        el.addProgress.textContent = `جاري الرفع... ${pct}%`;
      }
    });

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        el.addProgress.textContent = 'تم الرفع بنجاح';
        selectedFiles = [];
        el.fileList.innerHTML = '';
        el.fileInput.value = '';
        el.uploadTitle.value = '';
        fetchMedia({ reset: true });
        setTimeout(() => (el.addPanel.hidden = true), 600);
      } else {
        try {
          const data = JSON.parse(xhr.responseText);
          showAddError(data.error || 'فشل الرفع');
        } catch {
          showAddError('فشل الرفع');
        }
      }
    };
    xhr.onerror = () => showAddError('حصل خطأ في الاتصال');
    xhr.send(formData);
  }

  // ---------- إضافة رابط ----------
  el.doLink.addEventListener('click', () => {
    const url = el.linkUrl.value.trim();
    if (!url) {
      showAddError('اكتب رابط الأول');
      return;
    }
    ensureAuthorized(() => doLink(url));
  });

  async function doLink(url) {
    const type = document.querySelector('input[name="link-type"]:checked').value;
    try {
      const res = await fetch('/api/media/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ url, title: el.linkTitle.value.trim(), type }),
      });
      const data = await res.json();
      if (!res.ok) {
        showAddError(data.error || 'فشلت إضافة الرابط');
        return;
      }
      el.linkUrl.value = '';
      el.linkTitle.value = '';
      fetchMedia({ reset: true });
      el.addPanel.hidden = true;
    } catch {
      showAddError('حصل خطأ في الاتصال');
    }
  }

  function showAddError(msg) {
    el.addError.textContent = msg;
    el.addError.hidden = false;
    el.addProgress.hidden = true;
  }

  // ---------- العارض الكبير (Lightbox) ----------
  function openLightbox(idx) {
    state.lightboxIndex = idx;
    renderLightbox();
    el.lightbox.hidden = false;
  }

  function renderLightbox() {
    const item = state.items[state.lightboxIndex];
    if (!item) return;

    let inner = '';
    if (item.type === 'image') {
      inner = `<img src="${item.src}" alt="${escapeHtml(item.title)}" />`;
    } else if (item.source === 'embed') {
      inner = `<iframe src="${item.embedUrl}" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>`;
    } else {
      inner = `<video src="${item.src}" controls autoplay></video>`;
    }
    el.lightboxContent.innerHTML = inner;
    el.lightboxTitle.textContent = item.title;
  }

  function closeLightbox() {
    el.lightbox.hidden = true;
    el.lightboxContent.innerHTML = '';
  }

  el.lightboxClose.addEventListener('click', closeLightbox);
  el.lightbox.addEventListener('click', (e) => {
    if (e.target === el.lightbox) closeLightbox();
  });

  el.lightboxPrev.addEventListener('click', () => {
    if (state.items.length === 0) return;
    state.lightboxIndex = (state.lightboxIndex - 1 + state.items.length) % state.items.length;
    renderLightbox();
  });
  el.lightboxNext.addEventListener('click', () => {
    if (state.items.length === 0) return;
    state.lightboxIndex = (state.lightboxIndex + 1) % state.items.length;
    renderLightbox();
  });

  document.addEventListener('keydown', (e) => {
    if (el.lightbox.hidden) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') el.lightboxPrev.click();
    if (e.key === 'ArrowRight') el.lightboxNext.click();
  });

  el.lightboxDelete.addEventListener('click', () => {
    const item = state.items[state.lightboxIndex];
    if (!item) return;
    if (!confirm('متأكد إنك عايز تحذف ده؟')) return;
    ensureAuthorized(() => doDelete(item.id));
  });

  async function doDelete(id) {
    try {
      const res = await fetch(`/api/media/${id}`, {
        method: 'DELETE',
        headers: { ...authHeaders() },
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'فشل الحذف');
        return;
      }
      closeLightbox();
      fetchMedia({ reset: true });
    } catch {
      alert('حصل خطأ في الاتصال');
    }
  }

  // ---------- بداية التشغيل ----------
  loadConfig().then(() => fetchMedia({ reset: true }));
})();
