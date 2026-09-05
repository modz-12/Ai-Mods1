(() => {
  'use strict';

  // =========================================================
  // الحالة العامة
  // =========================================================
  const state = {
    type: 'all',
    search: '',
    page: 1,
    limit: 24,
    items: [],
    hasMore: false,

    // نظام الحماية
    requiresPassword: false,
    authVerified: false,
    authChecking: false,

    lightboxIndex: -1,
  };

  // =========================================================
  // عناصر الصفحة
  // =========================================================
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

  // العملية التي تنتظر نجاح تسجيل الدخول
  let pendingAction = null;

  // لمنع الضغط المتكرر على زر تسجيل الدخول
  let passwordRequestId = 0;

  // =========================================================
  // أدوات عامة
  // =========================================================

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str == null ? '' : String(str);
    return d.innerHTML;
  }

  function safeJsonParse(text) {
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }

  function getErrorMessage(error, fallback = 'حدث خطأ غير معروف') {
    if (!error) return fallback;

    if (typeof error === 'string') {
      return error;
    }

    if (error.message) {
      return error.message;
    }

    return fallback;
  }

  /**
   * قراءة استجابة API بطريقة آمنة.
   *
   * المشكلة في النسخة القديمة:
   * res.json()
   * لو السيرفر رجع HTML أو نص عادي كان بيرمي Exception
   * وبالتالي المستخدم يشوف:
   * "حصل خطأ، حاول تاني"
   *
   * هنا بنعرف بالضبط السيرفر رجع إيه.
   */
  async function readApiResponse(res) {
    const text = await res.text();

    const data = safeJsonParse(text);

    if (data !== null) {
      return {
        data,
        raw: text,
      };
    }

    return {
      data: null,
      raw: text,
    };
  }

  function formatHttpError(res, data, raw = '') {
    if (data && data.error) {
      return `خطأ ${res.status}: ${data.error}`;
    }

    if (data && data.message) {
      return `خطأ ${res.status}: ${data.message}`;
    }

    if (raw) {
      const clean = raw
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (clean) {
        return `الخادم رجّع رد غير متوقع (${res.status}): ${clean.slice(0, 300)}`;
      }
    }

    return `الخادم رجّع خطأ HTTP ${res.status} ${res.statusText || ''}`.trim();
  }

  function showPasswordError(message) {
    if (!el.passwordError) return;

    el.passwordError.textContent = message;
    el.passwordError.hidden = false;
  }

  function clearPasswordError() {
    if (!el.passwordError) return;

    el.passwordError.textContent = '';
    el.passwordError.hidden = true;
  }

  function setPasswordButtonLoading(loading) {
    if (!el.passwordConfirm) return;

    el.passwordConfirm.disabled = loading;

    if (loading) {
      el.passwordConfirm.dataset.oldText =
        el.passwordConfirm.textContent || 'دخول';

      el.passwordConfirm.textContent = 'جاري التحقق...';
    } else {
      el.passwordConfirm.textContent =
        el.passwordConfirm.dataset.oldText || 'دخول';
    }
  }

  // =========================================================
  // إعدادات الموقع
  // =========================================================

  async function loadConfig() {
    try {
      const res = await fetch('/api/config', {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'Cache-Control': 'no-cache',
        },
        cache: 'no-store',
      });

      const result = await readApiResponse(res);

      if (!res.ok) {
        throw new Error(
          formatHttpError(res, result.data, result.raw)
        );
      }

      if (!result.data) {
        throw new Error(
          `الخادم لم يرجع JSON صالحًا من /api/config. الرد: ${
            result.raw?.slice(0, 300) || '(فارغ)'
          }`
        );
      }

      const data = result.data;

      if (el.siteName && data.siteName) {
        el.siteName.textContent = data.siteName;
        document.title = data.siteName;
      }

      state.requiresPassword = Boolean(data.requiresPassword);

      console.log(
        '[Gallery] Config loaded:',
        {
          siteName: data.siteName,
          requiresPassword: state.requiresPassword,
        }
      );

      // لو السيرفر يقول إن مفيش باسورد، نمسح أي باسورد قديم
      if (!state.requiresPassword) {
        clearStoredPassword();
        state.authVerified = true;
      }

      return data;
    } catch (error) {
      console.error('[Gallery] فشل تحميل إعدادات الموقع:', error);

      // هنا لا نخفي الخطأ الحقيقي
      state.requiresPassword = false;

      showGlobalError(
        `تعذر الاتصال بإعدادات الموقع: ${getErrorMessage(
          error,
          'خطأ غير معروف'
        )}`
      );

      return null;
    }
  }

  // =========================================================
  // نظام كلمة السر
  // =========================================================

  const PASSWORD_STORAGE_KEY = 'gallery_admin_password';

  function getStoredPassword() {
    try {
      return localStorage.getItem(PASSWORD_STORAGE_KEY) || '';
    } catch (error) {
      console.error(
        '[Gallery] تعذر قراءة localStorage:',
        error
      );
      return '';
    }
  }

  function storePassword(password) {
    try {
      localStorage.setItem(PASSWORD_STORAGE_KEY, password);
    } catch (error) {
      console.error(
        '[Gallery] تعذر حفظ كلمة السر:',
        error
      );
    }
  }

  function clearStoredPassword() {
    try {
      localStorage.removeItem(PASSWORD_STORAGE_KEY);
    } catch (error) {
      console.error(
        '[Gallery] تعذر حذف كلمة السر من localStorage:',
        error
      );
    }

    state.authVerified = false;
  }

  function openPasswordModal(message = '') {
    if (!el.passwordModal) {
      console.error(
        '[Gallery] عنصر password-modal غير موجود في index.html'
      );

      return;
    }

    clearPasswordError();

    if (message) {
      showPasswordError(message);
    }

    el.passwordModal.hidden = false;

    if (el.passwordInput) {
      el.passwordInput.value = '';
      setTimeout(() => {
        try {
          el.passwordInput.focus();
        } catch {}
      }, 50);
    }
  }

  function closePasswordModal() {
    if (el.passwordModal) {
      el.passwordModal.hidden = true;
    }
  }

  /**
   * التحقق من كلمة السر مع السيرفر.
   *
   * أهم تعديل:
   * - نفحص HTTP status.
   * - نقرأ الرد كنص أولًا.
   * - لو مش JSON نعرض الرد الحقيقي.
   * - لو 401/403 نمسح الباسورد القديم.
   */
  async function verifyPassword(password) {
    const currentRequest = ++passwordRequestId;

    password = String(password || '');

    if (!password.trim()) {
      showPasswordError('اكتب كلمة السر الأول');
      return false;
    }

    setPasswordButtonLoading(true);
    clearPasswordError();

    try {
      console.log('[Gallery] جاري التحقق من كلمة السر...');

      const res = await fetch('/api/admin/check', {
        method: 'POST',

        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'Cache-Control': 'no-cache',
        },

        body: JSON.stringify({
          password,
        }),

        cache: 'no-store',
      });

      const result = await readApiResponse(res);
      const data = result.data;

      console.log(
        '[Gallery] /api/admin/check:',
        {
          status: res.status,
          ok: res.ok,
          data,
        }
      );

      // لو فيه محاولة أحدث، تجاهل النتيجة القديمة
      if (currentRequest !== passwordRequestId) {
        return false;
      }

      // السيرفر رجع HTTP error
      if (!res.ok) {
        // 401/403 معناها إن الباسورد غير مقبول
        if (res.status === 401 || res.status === 403) {
          clearStoredPassword();

          showPasswordError(
            data?.error ||
              `كلمة السر مرفوضة من السيرفر (${res.status})`
          );

          return false;
        }

        throw new Error(
          formatHttpError(res, data, result.raw)
        );
      }

      // السيرفر لم يرجع JSON
      if (!data) {
        throw new Error(
          `الـ API رجع استجابة ليست JSON صالحًا. HTTP ${res.status}. ` +
          `الرد: ${result.raw?.slice(0, 300) || '(فارغ)'}`
        );
      }

      // الباسورد صحيح
      if (data.ok === true) {
        storePassword(password);

        state.authVerified = true;

        clearPasswordError();
        closePasswordModal();

        console.log('[Gallery] تم التحقق من كلمة السر بنجاح');

        return true;
      }

      // الباسورد غلط
      if (data.ok === false) {
        clearStoredPassword();

        showPasswordError(
          data.error || 'كلمة السر غلط'
        );

        return false;
      }

      // رد غير متوقع
      throw new Error(
        `استجابة غير متوقعة من /api/admin/check: ${JSON.stringify(
          data
        )}`
      );
    } catch (error) {
      console.error(
        '[Gallery] خطأ أثناء التحقق من كلمة السر:',
        error
      );

      const message = getErrorMessage(
        error,
        'تعذر التحقق من كلمة السر'
      );

      showPasswordError(
        `❌ ${message}`
      );

      return false;
    } finally {
      if (currentRequest === passwordRequestId) {
        setPasswordButtonLoading(false);
      }
    }
  }

  /**
   * التحقق قبل تنفيذ أي عملية إدارية.
   */
  async function ensureAuthorized(action) {
    if (typeof action !== 'function') {
      console.error(
        '[Gallery] ensureAuthorized استقبل action غير صالح'
      );
      return;
    }

    // السيرفر لا يحتاج كلمة سر
    if (!state.requiresPassword) {
      return action();
    }

    // لو عندنا جلسة متحققة بالفعل
    if (state.authVerified) {
      return action();
    }

    const stored = getStoredPassword();

    // عندنا باسورد محفوظ
    if (stored) {
      const valid = await verifyPassword(stored);

      if (valid) {
        return action();
      }

      // verifyPassword مسح الباسورد لو غلط
      pendingAction = action;

      openPasswordModal(
        'الباسورد المحفوظ لم يعد صالحًا. اكتب كلمة السر مرة أخرى.'
      );

      return;
    }

    // لا يوجد باسورد محفوظ
    pendingAction = action;

    openPasswordModal();
  }

  async function handlePasswordSubmit() {
    const password = el.passwordInput
      ? el.passwordInput.value
      : '';

    if (!password.trim()) {
      showPasswordError('اكتب كلمة السر الأول');
      return;
    }

    const action = pendingAction;

    const valid = await verifyPassword(password);

    if (!valid) {
      return;
    }

    pendingAction = null;

    try {
      if (typeof action === 'function') {
        await action();
      }
    } catch (error) {
      console.error(
        '[Gallery] خطأ أثناء تنفيذ العملية بعد تسجيل الدخول:',
        error
      );

      showGlobalError(
        `تم تسجيل الدخول، لكن العملية فشلت: ${
          getErrorMessage(error)
        }`
      );
    }
  }

  if (el.passwordConfirm) {
    el.passwordConfirm.addEventListener(
      'click',
      handlePasswordSubmit
    );
  }

  if (el.passwordInput) {
    el.passwordInput.addEventListener(
      'keydown',
      (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          handlePasswordSubmit();
        }

        if (e.key === 'Escape') {
          closePasswordModal();
          pendingAction = null;
        }
      }
    );
  }

  if (el.passwordCancel) {
    el.passwordCancel.addEventListener('click', () => {
      closePasswordModal();
      pendingAction = null;
      clearPasswordError();
    });
  }

  /**
   * Headers الخاصة بعمليات الإدارة.
   */
  function authHeaders() {
    if (!state.requiresPassword) {
      return {};
    }

    const pw = getStoredPassword();

    if (!pw) {
      return {};
    }

    return {
      'x-admin-password': pw,
    };
  }

  /**
   * لو السيرفر رفض العملية بسبب الباسورد،
   * نمسح الباسورد القديم ونطلبه من جديد.
   */
  function handleUnauthorizedResponse(res, data) {
    if (res.status !== 401 && res.status !== 403) {
      return false;
    }

    console.warn(
      '[Gallery] السيرفر رفض صلاحية الأدمن:',
      data
    );

    clearStoredPassword();

    openPasswordModal(
      data?.error ||
        'انتهت صلاحية كلمة السر. اكتبها مرة أخرى.'
    );

    return true;
  }

  // =========================================================
  // أخطاء عامة
  // =========================================================

  function showGlobalError(message) {
    console.error('[Gallery]', message);

    // لو فيه عنصر مناسب في الصفحة نستخدمه
    if (el.addError) {
      el.addError.textContent = message;
      el.addError.hidden = false;
      return;
    }

    // fallback
    console.error(message);
  }

  function showAddError(msg) {
    if (!el.addError) {
      console.error('[Gallery]', msg);
      return;
    }

    el.addError.textContent = msg;
    el.addError.hidden = false;

    if (el.addProgress) {
      el.addProgress.hidden = true;
    }
  }

  // =========================================================
  // تحميل الميديا
  // =========================================================

  async function fetchMedia({ reset = false } = {}) {
    if (reset) {
      state.page = 1;
      state.items = [];
    }

    const params = new URLSearchParams({
      type: state.type,
      search: state.search,
      page: String(state.page),
      limit: String(state.limit),
    });

    try {
      if (el.loadMore) {
        el.loadMore.disabled = true;
      }

      const res = await fetch(
        `/api/media?${params.toString()}`,
        {
          method: 'GET',
          headers: {
            Accept: 'application/json',
          },
          cache: 'no-store',
        }
      );

      const result = await readApiResponse(res);

      if (!res.ok) {
        throw new Error(
          formatHttpError(
            res,
            result.data,
            result.raw
          )
        );
      }

      if (!result.data) {
        throw new Error(
          'الخادم رجع رد غير صالح من /api/media'
        );
      }

      const data = result.data;

      if (!Array.isArray(data.items)) {
        throw new Error(
          'استجابة /api/media لا تحتوي على items بشكل صحيح'
        );
      }

      state.items = reset
        ? data.items
        : [...state.items, ...data.items];

      state.hasMore = Boolean(data.hasMore);

      renderGallery();

      if (el.loadMore) {
        el.loadMore.hidden = !state.hasMore;
      }

      if (el.emptyState) {
        el.emptyState.hidden = state.items.length > 0;
      }

      return data;
    } catch (error) {
      console.error(
        '[Gallery] فشل تحميل الميديا:',
        error
      );

      showGlobalError(
        `فشل تحميل الميديا: ${getErrorMessage(
          error,
          'خطأ غير معروف'
        )}`
      );

      return null;
    } finally {
      if (el.loadMore) {
        el.loadMore.disabled = false;
      }
    }
  }

  // =========================================================
  // كروت الميديا
  // =========================================================

  function cardMarkup(item) {
    if (item.type === 'image') {
      return `
        <img
          src="${escapeHtml(item.thumbnail || item.src || '')}"
          alt="${escapeHtml(item.title)}"
          loading="lazy"
        />
      `;
    }

    if (item.thumbnail) {
      return `
        <img
          src="${escapeHtml(item.thumbnail)}"
          alt="${escapeHtml(item.title)}"
          loading="lazy"
        />
        <div class="play-badge">▶</div>
      `;
    }

    return `
      <div class="video-placeholder">
        <span class="play-badge">▶</span>
      </div>
    `;
  }

  function renderGallery() {
    if (!el.gallery) return;

    el.gallery.innerHTML = state.items
      .map(
        (item, idx) => `
          <div
            class="media-card"
            data-idx="${idx}"
          >
            ${cardMarkup(item)}

            <div class="card-label">
              ${escapeHtml(item.title)}
            </div>
          </div>
        `
      )
      .join('');

    el.gallery
      .querySelectorAll('.media-card')
      .forEach((card) => {
        card.addEventListener('click', () => {
          openLightbox(
            Number(card.dataset.idx)
          );
        });
      });
  }

  // =========================================================
  // الفلاتر والبحث
  // =========================================================

  if (el.filterBtns) {
    el.filterBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        el.filterBtns.forEach((b) =>
          b.classList.remove('active')
        );

        btn.classList.add('active');

        state.type = btn.dataset.type || 'all';

        fetchMedia({
          reset: true,
        });
      });
    });
  }

  let searchTimer = null;

  if (el.searchInput) {
    el.searchInput.addEventListener('input', () => {
      clearTimeout(searchTimer);

      searchTimer = setTimeout(() => {
        state.search = el.searchInput.value.trim();

        fetchMedia({
          reset: true,
        });
      }, 350);
    });
  }

  if (el.loadMore) {
    el.loadMore.addEventListener('click', () => {
      if (state.hasMore) {
        state.page += 1;

        fetchMedia();
      }
    });
  }

  // =========================================================
  // لوحة الإضافة
  // =========================================================

  async function openAddPanel() {
    await ensureAuthorized(async () => {
      if (!el.addPanel) return;

      el.addPanel.hidden = false;

      if (el.addError) {
        el.addError.hidden = true;
      }

      if (el.addProgress) {
        el.addProgress.hidden = true;
      }
    });
  }

  if (el.openAdd) {
    el.openAdd.addEventListener(
      'click',
      openAddPanel
    );
  }

  if (el.closeAdd) {
    el.closeAdd.addEventListener(
      'click',
      () => {
        if (el.addPanel) {
          el.addPanel.hidden = true;
        }
      }
    );
  }

  if (el.addPanel) {
    el.addPanel.addEventListener(
      'click',
      (e) => {
        if (e.target === el.addPanel) {
          el.addPanel.hidden = true;
        }
      }
    );
  }

  if (el.tabBtns) {
    el.tabBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        el.tabBtns.forEach((b) =>
          b.classList.remove('active')
        );

        el.tabPanels.forEach((p) =>
          p.classList.remove('active')
        );

        btn.classList.add('active');

        const panel = document.getElementById(
          `tab-${btn.dataset.tab}`
        );

        if (panel) {
          panel.classList.add('active');
        }
      });
    });
  }

  // =========================================================
  // اختيار الملفات
  // =========================================================

  if (el.dropZone) {
    el.dropZone.addEventListener('click', (e) => {
      e.preventDefault();

      if (el.fileInput) {
        el.fileInput.click();
      }
    });
  }

  if (el.fileInput) {
    el.fileInput.addEventListener(
      'change',
      () => {
        addFiles(el.fileInput.files);
      }
    );
  }

  ['dragover', 'dragenter'].forEach((evt) => {
    if (!el.dropZone) return;

    el.dropZone.addEventListener(evt, (e) => {
      e.preventDefault();

      el.dropZone.classList.add(
        'drag-over'
      );
    });
  });

  ['dragleave', 'drop'].forEach((evt) => {
    if (!el.dropZone) return;

    el.dropZone.addEventListener(evt, (e) => {
      e.preventDefault();

      el.dropZone.classList.remove(
        'drag-over'
      );
    });
  });

  if (el.dropZone) {
    el.dropZone.addEventListener(
      'drop',
      (e) => {
        addFiles(
          e.dataTransfer
            ? e.dataTransfer.files
            : []
        );
      }
    );
  }

  function addFiles(fileList) {
    if (!fileList) return;

    selectedFiles = [
      ...selectedFiles,
      ...Array.from(fileList),
    ].slice(0, 20);

    if (!el.fileList) return;

    el.fileList.innerHTML = selectedFiles
      .map(
        (f) =>
          `<span>${escapeHtml(f.name)}</span>`
      )
      .join('');
  }

  // =========================================================
  // رفع الملفات
  // =========================================================

  if (el.doUpload) {
    el.doUpload.addEventListener(
      'click',
      async () => {
        if (selectedFiles.length === 0) {
          showAddError(
            'اختار ملف واحد على الأقل'
          );
          return;
        }

        await ensureAuthorized(doUpload);
      }
    );
  }

  function doUpload() {
    return new Promise((resolve) => {
      const formData = new FormData();

      selectedFiles.forEach((file) => {
        formData.append(
          'files',
          file
        );
      });

      formData.append(
        'title',
        el.uploadTitle
          ? el.uploadTitle.value.trim()
          : ''
      );

      const xhr =
        new XMLHttpRequest();

      xhr.open(
        'POST',
        '/api/media/upload'
      );

      Object.entries(authHeaders())
        .forEach(([key, value]) => {
          xhr.setRequestHeader(
            key,
            value
          );
        });

      xhr.upload.addEventListener(
        'progress',
        (e) => {
          if (
            e.lengthComputable &&
            el.addProgress
          ) {
            const pct = Math.round(
              (e.loaded / e.total) * 100
            );

            el.addProgress.hidden = false;

            el.addProgress.textContent =
              `جاري الرفع... ${pct}%`;
          }
        }
      );

      xhr.onload = () => {
        const data =
          safeJsonParse(
            xhr.responseText
          );

        console.log(
          '[Gallery] Upload response:',
          {
            status: xhr.status,
            data,
            raw: xhr.responseText,
          }
        );

        // Unauthorized
        if (
          xhr.status === 401 ||
          xhr.status === 403
        ) {
          clearStoredPassword();

          showAddError(
            data?.error ||
              `رفض السيرفر العملية (${xhr.status})`
          );

          openPasswordModal(
            'كلمة السر غير صالحة. اكتبها مرة أخرى.'
          );

          resolve(false);
          return;
        }

        if (
          xhr.status >= 200 &&
          xhr.status < 300
        ) {
          if (el.addProgress) {
            el.addProgress.hidden = false;
            el.addProgress.textContent =
              'تم الرفع بنجاح';
          }

          selectedFiles = [];

          if (el.fileList) {
            el.fileList.innerHTML = '';
          }

          if (el.fileInput) {
            el.fileInput.value = '';
          }

          if (el.uploadTitle) {
            el.uploadTitle.value = '';
          }

          fetchMedia({
            reset: true,
          });

          setTimeout(() => {
            if (el.addPanel) {
              el.addPanel.hidden = true;
            }
          }, 600);

          resolve(true);
          return;
        }

        // خطأ حقيقي
        if (data?.error) {
          showAddError(
            `خطأ ${xhr.status}: ${data.error}`
          );
        } else if (xhr.responseText) {
          showAddError(
            `فشل الرفع (${xhr.status}): ${xhr.responseText.slice(
              0,
              300
            )}`
          );
        } else {
          showAddError(
            `فشل الرفع. HTTP ${xhr.status}`
          );
        }

        resolve(false);
      };

      xhr.onerror = () => {
        const message =
          'فشل الاتصال بالسيرفر أثناء الرفع. ' +
          'تأكد أن السيرفر شغال وأن الصفحة مفتوحة من نفس الدومين.';

        console.error(
          '[Gallery] Upload network error'
        );

        showAddError(message);

        resolve(false);
      };

      xhr.ontimeout = () => {
        showAddError(
          'انتهت مهلة الرفع. الملف كبير جدًا أو الاتصال بطيء.'
        );

        resolve(false);
      };

      xhr.onabort = () => {
        showAddError(
          'تم إلغاء عملية الرفع.'
        );

        resolve(false);
      };

      xhr.timeout = 10 * 60 * 1000;

      xhr.send(formData);
    });
  }

  // =========================================================
  // إضافة رابط
  // =================================================