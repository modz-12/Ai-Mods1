/*
  MODZ CSS — documentation/playground script.
  This file powers the docs page ONLY (search, filtering, live previews,
  copy-to-clipboard). The MODZ CSS library itself (modz.css / modz.min.css)
  does not use, load, or depend on this file in any way.
*/
(function () {
  "use strict";

  var state = {
    data: null,
    activeCategory: null, // null = "all"
    query: "",
    visibleCount: 60,
    step: 60,
  };

  var sizeSuffixes = ["xs", "sm", "md", "lg", "xl"];

  function baseForShape(cls) {
    var parts = cls.split("-");
    var last = parts[parts.length - 1];
    if (sizeSuffixes.indexOf(last) !== -1 && parts.length > 1) {
      return parts.slice(0, -1).join("-");
    }
    return null;
  }

  function previewHTML(item) {
    var full = item.class; // full class name, already including the "mz-" prefix, e.g. "mz-bg-purple-500"
    var cat = item.category;

    if (cat === "colors") {
      if (full.indexOf("mz-bg-") === 0) {
        return '<div class="doc-preview-box ' + full + '"></div>';
      }
      if (full.indexOf("mz-text-") === 0) {
        return '<span class="' + full + '" style="font-weight:800;font-size:1.2rem;">Aa</span>';
      }
      if (full.indexOf("mz-border-") === 0) {
        return '<div class="doc-preview-outline ' + full + '" style="border-style:solid;border-width:3px;width:70%;height:70%;"></div>';
      }
    }

    if (cat === "shapes" || cat === "3d") {
      var base = baseForShape(full);
      var classes = base ? full + " " + base : full;
      return '<div class="' + classes + '" style="width:2.1em;height:2.1em;"></div>';
    }

    if (cat === "typography") {
      return '<span class="' + full + '" style="color:#d9d9ff;font-size:1.05rem;">Aa</span>';
    }

    if (cat === "spacing") {
      return '<div class="doc-preview-outline"><div class="doc-preview-inner ' + full + '"></div></div>';
    }

    if (cat === "sizing") {
      return '<div class="doc-preview-outline"><div class="' + full + '" style="background:var(--doc-cyan);max-width:100%;max-height:100%;min-width:4px;min-height:4px;"></div></div>';
    }

    if (cat === "display" || cat === "overflow" || cat === "position" ||
        cat === "flex" || cat === "grid" || cat === "responsive" ||
        cat === "accessibility" || cat === "aspect" || cat === "theme") {
      return '<div class="doc-preview-box ' + full + '"></div>';
    }

    // glow, shadows, borders, radius, glass, gradients, filters, images,
    // backgrounds, effects, transforms, transitions, animations, hover, opacity
    return '<div class="doc-preview-box ' + full + '"></div>';
  }

  function el(tag, attrs, html) {
    var e = document.createElement(tag);
    if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (html !== undefined) e.innerHTML = html;
    return e;
  }

  function filteredItems() {
    var items = state.data.classes;
    if (state.activeCategory) {
      items = items.filter(function (i) { return i.category === state.activeCategory; });
    }
    if (state.query.trim()) {
      var q = state.query.trim().toLowerCase();
      items = items.filter(function (i) {
        return i.class.toLowerCase().indexOf(q) !== -1 || i.css.toLowerCase().indexOf(q) !== -1;
      });
    }
    return items;
  }

  function renderSidebar() {
    var list = document.getElementById("doc-cat-list");
    list.innerHTML = "";

    var allBtn = el("button", { class: "doc-cat-item" + (state.activeCategory === null ? " doc-active" : "") },
      "الكل (All)<span class=\"doc-cat-count\">" + state.data.total + "</span>");
    allBtn.addEventListener("click", function () { setCategory(null); });
    var allLi = el("li"); allLi.appendChild(allBtn); list.appendChild(allLi);

    state.data.categories.forEach(function (c) {
      var btn = el("button", { class: "doc-cat-item" + (state.activeCategory === c.id ? " doc-active" : "") },
        c.label + '<span class="doc-cat-count">' + c.count + "</span>");
      btn.addEventListener("click", function () { setCategory(c.id); });
      var li = el("li"); li.appendChild(btn); list.appendChild(li);
    });
  }

  function setCategory(id) {
    state.activeCategory = id;
    state.visibleCount = state.step;
    renderSidebar();
    renderMain();
  }

  function copyClass(cls, btn) {
    var text = cls; // cls is already the full class name, e.g. "mz-bg-purple-500"
    function done() {
      btn.textContent = "تم النسخ";
      btn.classList.add("doc-copied");
      setTimeout(function () {
        btn.textContent = "نسخ";
        btn.classList.remove("doc-copied");
      }, 1400);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(function () { fallbackCopy(text, done); });
    } else {
      fallbackCopy(text, done);
    }
  }

  function fallbackCopy(text, done) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); } catch (e) {}
    document.body.removeChild(ta);
    done();
  }

  function renderMain() {
    var main = document.getElementById("doc-main");
    var items = filteredItems();
    var heading = document.getElementById("doc-main-heading");
    var sub = document.getElementById("doc-main-sub");

    var catLabel = state.activeCategory
      ? (state.data.categories.filter(function (c) { return c.id === state.activeCategory; })[0] || {}).label
      : "كل الأقسام";
    heading.textContent = catLabel || "كل الأقسام";
    sub.textContent = items.length + " class" + (items.length === 1 ? "" : "es") + " — انقر Copy لنسخ اسم الـ class مباشرة";

    var list = document.getElementById("doc-list");
    list.innerHTML = "";

    if (items.length === 0) {
      list.appendChild(el("div", { class: "doc-empty" }, "لا توجد نتائج مطابقة للبحث."));
      var lm0 = document.getElementById("doc-loadmore");
      if (lm0) lm0.style.display = "none";
      return;
    }

    var slice = items.slice(0, state.visibleCount);
    slice.forEach(function (item) {
      var row = el("div", { class: "doc-row" });
      row.appendChild(el("div", { class: "doc-preview" }, previewHTML(item)));
      var meta = el("div", { class: "doc-meta" });
      meta.appendChild(el("span", { class: "doc-classname" }, "." + escapeHTML(item.class)));
      meta.appendChild(el("span", { class: "doc-css" }, escapeHTML(item.css)));
      row.appendChild(meta);
      var copyBtn = el("button", { class: "doc-copy doc-row-copy", type: "button" }, "نسخ");
      copyBtn.addEventListener("click", function () { copyClass(item.class, copyBtn); });
      row.appendChild(copyBtn);
      list.appendChild(row);
    });

    var lm = document.getElementById("doc-loadmore");
    if (state.visibleCount < items.length) {
      lm.style.display = "inline-flex";
      lm.textContent = "تحميل المزيد (" + (items.length - state.visibleCount) + " متبقي)";
    } else {
      lm.style.display = "none";
    }
  }

  function escapeHTML(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function init(data) {
    state.data = data;
    document.getElementById("doc-total-count").textContent = data.total;

    renderSidebar();
    renderMain();

    var search = document.getElementById("doc-search");
    var debounceTimer;
    search.addEventListener("input", function (e) {
      clearTimeout(debounceTimer);
      var val = e.target.value;
      debounceTimer = setTimeout(function () {
        state.query = val;
        state.visibleCount = state.step;
        renderMain();
      }, 120);
    });

    document.getElementById("doc-loadmore").addEventListener("click", function () {
      state.visibleCount += state.step;
      renderMain();
    });
  }

  fetch("./docs-data.json")
    .then(function (r) { return r.json(); })
    .then(init)
    .catch(function (err) {
      document.getElementById("doc-list").innerHTML =
        '<div class="doc-empty">تعذّر تحميل بيانات التوثيق (docs-data.json).</div>';
      console.error(err);
    });
})();
