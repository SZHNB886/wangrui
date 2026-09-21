/* =========================================================
   猎奇人物志  —  逻辑层
   数据来源：
     data/profile.json   → site（站点信息）+ characters[]（各人物档案）
     /api/photos         → 本地 Node 服务扫描 photos/（静态托管时自动回退 index.json）
   ========================================================= */
(function () {
  "use strict";

  var $  = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  function pad(n) { return (n < 10 ? "0" : "") + n; }

  /* 数字滚动：把 `12` / `3.5 年` 这类文本做递增动画；没有数字就原样返回 */
  function countUp(node) {
    var raw = node.textContent;
    var m = raw.match(/^([^\d]*)(\d+(?:\.\d+)?)([\s\S]*)$/);
    if (!m) return;
    var pre = m[1], num = parseFloat(m[2]), suf = m[3];
    var dec = (m[2].split(".")[1] || "").length;
    var dur = 900, t0 = null;
    function step(t) {
      if (t0 === null) t0 = t;
      var p = Math.min((t - t0) / dur, 1);
      var e = 1 - Math.pow(1 - p, 3);
      node.textContent = pre + (num * e).toFixed(dec) + suf;
      if (p < 1) requestAnimationFrame(step); else node.textContent = raw;
    }
    requestAnimationFrame(step);
  }

  /* 3D 倾斜：鼠标在卡片上移动时轻微转动，离开复位 */
  function addTilt(node, max) {
    if (!node || !window.matchMedia || !window.matchMedia("(pointer:fine)").matches) return;
    max = max || 6;
    node.addEventListener("mouseenter", function () { node.classList.add("tilting"); });
    node.addEventListener("mousemove", function (e) {
      var r = node.getBoundingClientRect();
      var px = (e.clientX - r.left) / r.width - 0.5;
      var py = (e.clientY - r.top) / r.height - 0.5;
      node.style.transform = "perspective(900px) rotateY(" + (px * max).toFixed(2) +
        "deg) rotateX(" + (-py * max).toFixed(2) + "deg) translateY(-6px)";
    });
    node.addEventListener("mouseleave", function () {
      node.style.transform = "";
      node.classList.remove("tilting");
    });
  }

  /* ---------------- 主题 ---------------- */
  var root = document.documentElement;
  var THEME_KEY = "bizarre-theme";
  try { var saved = localStorage.getItem(THEME_KEY); if (saved) root.setAttribute("data-theme", saved); } catch (e) {}
  var themeBtn = $("#themeBtn");
  if (themeBtn) {
    themeBtn.addEventListener("click", function () {
      var next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
      root.setAttribute("data-theme", next);
      try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
    });
  }

  /* ---------------- 导航 ---------------- */
  var nav = $("#nav"), menuBtn = $("#menuBtn"), navLinks = $("#navLinks");
  function onScroll() { if (nav) nav.classList.toggle("shrunk", window.scrollY > 40); }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
  if (menuBtn && navLinks) {
    menuBtn.addEventListener("click", function () { navLinks.classList.toggle("open"); });
    navLinks.addEventListener("click", function (e) { if (e.target.tagName === "A") navLinks.classList.remove("open"); });
  }
  var spyLinks = {};
  $$("#navLinks a").forEach(function (a) {
    var id = (a.getAttribute("href") || "").replace("#", "");
    if (id) spyLinks[id] = a;
  });
  if ("IntersectionObserver" in window) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        Object.keys(spyLinks).forEach(function (k) { spyLinks[k].classList.remove("active"); });
        var a = spyLinks[en.target.id];
        if (a) a.classList.add("active");
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    $$("main section[id]").forEach(function (s) { spy.observe(s); });
  }

  /* ---------------- 滚动显现（双向常驻 + 兜底） ---------------- */
  var ioFired = false;
  var io = ("IntersectionObserver" in window)
    ? new IntersectionObserver(function (entries) {
        ioFired = true;
        entries.forEach(function (en) { en.target.classList.toggle("in", en.isIntersecting); });
      }, { rootMargin: "0px 0px -12% 0px", threshold: 0 })
    : null;

  function inView(n) {
    var vh = window.innerHeight || 800;
    var r = n.getBoundingClientRect();
    return r.top < vh * 0.88 && r.bottom > 0;
  }
  function applyScrollState() {
    $$(".reveal").forEach(function (n) { n.classList.toggle("in", inView(n)); });
  }
  function useFallback() {
    io = null;
    applyScrollState();
    window.addEventListener("scroll", applyScrollState, { passive: true });
    window.addEventListener("resize", applyScrollState);
  }
  function watch(scope) {
    $$(".reveal", scope || document).forEach(function (n) {
      if (io) io.observe(n); else n.classList.toggle("in", inView(n));
    });
  }
  var ioGuard = setTimeout(function () { if (!ioFired) useFallback(); }, 1200);
  window.addEventListener("load", function () {
    if (!ioFired) setTimeout(function () { if (!ioFired) useFallback(); }, 300);
  });

  /* ---------------- 状态 ---------------- */
  var DATA = { site: {}, characters: [] };
  var current = 0;
  var allPhotos = [];
  var switching = false;

  var FALLBACK_SITE = { title: "猎奇人物志", en: "BIZARRE PROFILES", mark: "志", tagline: "", footer: "猎奇人物志" };
  var FALLBACK_CHAR = {
    id: "unknown", name: "待补充", en: "", avatar: "", tagline: "这个人物的档案还没有内容。",
    chips: [], stats: [], about: ["内容待补充。"], facts: [], timeline: [], skills: [], works: [], contacts: []
  };

  /* 归一化：兼容旧的「单人物扁平格式」 */
  function normalize(raw) {
    if (!raw) return { site: FALLBACK_SITE, characters: [FALLBACK_CHAR] };
    if (raw.characters && raw.characters.length) {
      var s = raw.site || {};
      return {
        site: {
          title: s.title || FALLBACK_SITE.title,
          en: s.en || FALLBACK_SITE.en,
          mark: s.mark || (s.title || "志").slice(0, 1),
          tagline: s.tagline || "",
          footer: s.footer || s.title || FALLBACK_SITE.footer
        },
        characters: raw.characters.map(function (c, i) {
          c.id = c.id || ("char" + (i + 1));
          return c;
        })
      };
    }
    var nm = raw.name || "个人主页";
    raw.id = raw.id || "me";
    return {
      site: { title: nm, en: raw.en || "", mark: nm.slice(0, 1), tagline: raw.tagline || "", footer: nm },
      characters: [raw]
    };
  }

  /* ---------------- 站点外框 ---------------- */
  function renderChrome() {
    var s = DATA.site;
    document.title = DATA.characters.length > 1 ? s.title : (s.title + " · " + (DATA.characters[0] || {}).name);
    var bm = $("#brandMark"); if (bm) bm.textContent = s.mark;
    var bn = $("#brandName"); if (bn) bn.textContent = s.title;
    var be = $("#brandEn"); if (be) be.textContent = (s.en || "").toUpperCase();
    var fn = $("#footName"); if (fn) fn.textContent = s.footer;
    var fnt = $("#footNote");
    if (fnt) fnt.textContent = DATA.characters.map(function (c) { return c.name; }).join(" · ") + "　内容持续补充中";
    $("#year").textContent = String(new Date().getFullYear());
  }

  /* ---------------- 人物切换栏 + 索引 ---------------- */
  function renderCast() {
    var bar = $("#castBar");
    bar.innerHTML = "";
    DATA.characters.forEach(function (c, i) {
      var b = el("button", "cast-pill" + (i === current ? " is-active" : ""));
      b.type = "button";
      b.setAttribute("role", "tab");
      b.setAttribute("aria-selected", i === current ? "true" : "false");
      b.appendChild(el("span", "cp-idx", pad(i + 1)));
      b.appendChild(el("span", "cp-name", esc(c.name)));
      b.addEventListener("click", function () { switchTo(i); });
      bar.appendChild(b);
    });

    var grid = $("#castGrid");
    grid.innerHTML = "";
    DATA.characters.forEach(function (c, i) {
      var card = el("button", "cast-card glass reveal" + (i === current ? " is-active" : ""));
      card.type = "button";
      card.appendChild(el("span", "cc-num", pad(i + 1)));
      var body = el("div", "cc-body");
      body.appendChild(el("h3", null, esc(c.name)));
      if (c.en) body.appendChild(el("em", null, esc(c.en)));
      body.appendChild(el("p", null, esc(c.tagline || "档案待补充。")));
      card.appendChild(body);
      card.appendChild(el("span", "cc-go", i === current ? "正在查看" : "查看档案 →"));
      card.addEventListener("click", function () { switchTo(i); });
      addTilt(card, 7);
      grid.appendChild(card);
    });
  }
  function markCastActive() {
    $$("#castBar .cast-pill").forEach(function (b, i) { b.classList.toggle("is-active", i === current); b.setAttribute("aria-selected", i === current ? "true" : "false"); });
    $$("#castGrid .cast-card").forEach(function (c, i) {
      c.classList.toggle("is-active", i === current);
      var go = $(".cc-go", c);
      if (go) go.textContent = i === current ? "正在查看" : "查看档案 →";
    });
  }

  /* ---------------- 渲染某个人物 ---------------- */
  function renderCharacter(c, i) {
    c = Object.assign({}, FALLBACK_CHAR, c || {});

    /* 首屏 */
    var en = $("#heroEn");
    if (en) en.textContent = "CHARACTER · " + pad(i + 1) + (c.en ? " · " + c.en : "");
    var hn = $("#heroName"); if (hn) hn.textContent = c.name;
    var ht = $("#heroTagline"); if (ht) ht.textContent = c.tagline || "";
    if (DATA.characters.length > 1) document.title = DATA.site.title + " · " + c.name;
    else document.title = DATA.site.title;

    /* 头像 */
    var img = $("#avatarImg"), fb = $("#avatarFallback");
    if (fb) fb.textContent = c.name.slice(0, 1);
    if (img) {
      img.hidden = true;
      img.alt = c.name + "的头像";
      if (c.avatar) {
        img.onload = function () { fb.style.display = "none"; };
        img.onerror = function () { img.hidden = true; fb.style.display = ""; };
        img.src = c.avatar;
        img.hidden = false;
        if (fb) fb.style.display = "";
      } else {
        img.removeAttribute("src");
        if (fb) fb.style.display = "";
      }
    }

    /* 标签 */
    var chips = $("#heroChips");
    chips.innerHTML = "";
    (c.chips || []).forEach(function (x) { chips.appendChild(el("span", "chip", esc(x))); });

    /* 数据条 */
    var stats = $("#stats");
    stats.innerHTML = "";
    (c.stats || []).forEach(function (s) {
      var d = el("div", "stat");
      d.appendChild(el("b", null, esc(s.value)));
      d.appendChild(el("span", null, esc(s.label)));
      stats.appendChild(d);
    });
    stats.classList.add("reveal");
    $$(".stat b", stats).forEach(countUp);

    /* 关于 */
    var about = $("#aboutText");
    about.innerHTML = "";
    (c.about || []).forEach(function (p) { about.appendChild(el("p", null, esc(p))); });

    /* 信息栏 */
    var facts = $("#facts");
    facts.innerHTML = "";
    (c.facts || []).forEach(function (f) {
      var row = el("div", "fact");
      row.appendChild(el("dt", null, esc(f.label)));
      row.appendChild(el("dd", null, esc(f.value)));
      facts.appendChild(row);
    });

    /* 经历 */
    var tl = $("#timelineList");
    tl.innerHTML = "";
    (c.timeline || []).forEach(function (t) {
      var li = el("li", "tl-item reveal");
      var card = el("div", "tl-card glass");
      if (t.time) card.appendChild(el("div", "tl-time", esc(t.time)));
      card.appendChild(el("h3", null, esc(t.title || "")));
      if (t.desc) card.appendChild(el("p", null, esc(t.desc)));
      if (t.tags && t.tags.length) {
        var tw = el("div", "tl-tags");
        t.tags.forEach(function (g) { tw.appendChild(el("span", "tag", esc(g))); });
        card.appendChild(tw);
      }
      li.appendChild(card);
      tl.appendChild(li);
    });

    /* 专长 */
    var sk = $("#skillList");
    sk.innerHTML = "";
    (c.skills || []).forEach(function (s) {
      var box = el("div", "skill");
      var top = el("div", "skill-top");
      top.appendChild(el("b", null, esc(s.name)));
      top.appendChild(el("span", null, s.level != null ? s.level + "%" : ""));
      var bar = el("div", "bar");
      var fill = el("i");
      fill.setAttribute("data-level", String(s.level == null ? 60 : s.level));
      bar.appendChild(fill);
      box.appendChild(top); box.appendChild(bar);
      sk.appendChild(box);
    });
    syncSkillBars(sk);

    /* 作品 */
    var wk = $("#workList");
    wk.innerHTML = "";
    (c.works || []).forEach(function (w) {
      var box = el("article", "work glass reveal");
      box.appendChild(el("h3", null, esc(w.title || "")));
      if (w.desc) box.appendChild(el("p", null, esc(w.desc)));
      if (w.tags && w.tags.length) {
        var tw = el("div", "tl-tags");
        w.tags.forEach(function (g) { tw.appendChild(el("span", "tag", esc(g))); });
        box.appendChild(tw);
      }
      if (w.link) {
        var a = el("a", "work-link", "查看详情 →");
        a.href = w.link; a.target = "_blank"; a.rel = "noopener";
        box.appendChild(a);
      }
      box.addEventListener("mousemove", function (e) {
        var r = box.getBoundingClientRect();
        box.style.setProperty("--mx", (e.clientX - r.left) + "px");
        box.style.setProperty("--my", (e.clientY - r.top) + "px");
      });
      addTilt(box, 5);
      wk.appendChild(box);
    });

    /* 联系 */
    var ct = $("#contactList");
    ct.innerHTML = "";
    (c.contacts || []).forEach(function (x) {
      var box = x.link ? el("a", "contact") : el("div", "contact");
      if (x.link) { box.href = x.link; if (x.link.indexOf("http") === 0) { box.target = "_blank"; box.rel = "noopener"; } }
      box.appendChild(el("div", "ci", esc(x.icon || "•")));
      var t = el("div", "ct");
      t.appendChild(el("small", null, esc(x.label)));
      t.appendChild(el("b", null, esc(x.value)));
      box.appendChild(t);
      ct.appendChild(box);
    });

    /* 档案信息条 */
    var dos = $("#dossier");
    if (dos) {
      dos.innerHTML = "";
      (c.dossier || []).forEach(function (d) {
        var cell = el("div", "dos-cell");
        cell.appendChild(el("small", null, esc(d.label)));
        cell.appendChild(el("b", null, esc(d.value)));
        dos.appendChild(cell);
      });
      dos.hidden = !(c.dossier && c.dossier.length);
    }

    /* 关键词 */
    var kw = $("#keywords");
    if (kw) {
      kw.innerHTML = "";
      (c.keywords || []).forEach(function (k) { kw.appendChild(el("span", "kw", esc(k))); });
      kw.hidden = !(c.keywords && c.keywords.length);
    }

    /* 语录 */
    var q = $("#quote");
    if (q) {
      if (c.quote && c.quote.text) {
        q.innerHTML = "";
        q.appendChild(el("blockquote", null, esc(c.quote.text)));
        q.appendChild(el("figcaption", null, "— " + esc(c.quote.by || c.name)));
        q.hidden = false;
      } else { q.hidden = true; }
    }

    /* 人物关系 */
    var rl = $("#relationList");
    if (rl) {
      rl.innerHTML = "";
      (c.relations || []).forEach(function (r) {
        var idx = -1;
        for (var k2 = 0; k2 < DATA.characters.length; k2++) {
          if (DATA.characters[k2].id === r.id) idx = k2;
        }
        var t = idx >= 0 ? DATA.characters[idx] : null;
        var card = el("button", "relation glass reveal");
        card.type = "button";
        var head = el("div", "rel-head");
        head.appendChild(el("span", "rel-code", t && t.dossier && t.dossier[0] ? esc(t.dossier[0].value) : "—"));
        head.appendChild(el("h3", null, esc(r.name || (t ? t.name : r.id))));
        card.appendChild(head);
        if (r.rel) card.appendChild(el("p", "rel-type", esc(r.rel)));
        if (r.note) card.appendChild(el("p", "rel-note", esc(r.note)));
        if (t) {
          card.appendChild(el("span", "cc-go", "查看档案 →"));
          card.addEventListener("click", function () { switchTo(idx); });
          addTilt(card, 6);
        } else {
          card.disabled = true;
        }
        rl.appendChild(card);
      });
      rl.hidden = !(c.relations && c.relations.length);
    }

    /* 相册（按人物过滤） */
    renderGallery(photosFor(c));
    watch();
  }

  /* ---------------- 专长进度条 ---------------- */
  var skillEl = null;
  var skillObs = null;
  function setBars(on) {
    if (!skillEl) return;
    $$(".bar i", skillEl).forEach(function (f) {
      var lv = Math.max(0, Math.min(100, Number(f.getAttribute("data-level")) || 0));
      f.style.width = on ? lv + "%" : "0%";
    });
  }
  function syncSkillBars(scope) {
    skillEl = scope || skillEl || $("#skillList");
    if (skillEl && !skillObs && "IntersectionObserver" in window) {
      skillObs = new IntersectionObserver(function (es) {
        es.forEach(function (en) { setBars(en.isIntersecting); });
      }, { threshold: 0.15 });
      skillObs.observe(skillEl);
    }
    if (skillEl) setBars(inView(skillEl));
  }

  /* ---------------- 散开 / 展开动画 ---------------- */
  var ANIM_SEL = [
    "#home .avatar-wrap", "#home .hero-text > *", "#home .stats",
    ".section-head", ".gallery-bar", ".card",
    ".tl-item", ".work", ".gitem", ".contact", ".empty", ".footer-inner",
    ".dossier", ".quote", ".relation"
  ].join(",");

  function animBlocks() {
    var all = $$(ANIM_SEL);
    /* 去掉被其它块包含的，避免嵌套叠加 */
    return all.filter(function (x) {
      return !all.some(function (o) { return o !== x && o.contains(x); });
    });
  }
  function dirOf(x) {
    var r = x.getBoundingClientRect();
    var dx = (r.left + r.width / 2) - window.innerWidth / 2;
    var dy = (r.top + r.height / 2) - window.innerHeight / 2;
    var d = Math.sqrt(dx * dx + dy * dy) || 1;
    return { x: dx / d, y: dy / d, d: d };
  }
  function waitAll(anims) {
    return Promise.all(anims.map(function (a) {
      return a.finished ? a.finished.catch(function () {}) : Promise.resolve();
    })).then(function () { anims.forEach(function (a) { try { a.cancel(); } catch (e) {} }); });
  }

  /* 旧内容：由中心向四周错落散开 */
  function scatterOut() {
    var els = animBlocks(), anims = [];
    els.forEach(function (x) {
      var v = dirOf(x);
      var spread = 90 + Math.min(v.d, 700) * 0.28;
      var delay = Math.min(v.d * 0.26, 220);
      anims.push(x.animate([
        { transform: "translate(0,0) scale(1)", opacity: 1 },
        { transform: "translate(" + (v.x * spread).toFixed(1) + "px," + (v.y * spread).toFixed(1) + "px) scale(.9)", opacity: 0 }
      ], { duration: 420, delay: delay, easing: "cubic-bezier(.4,0,.2,1)", fill: "both" }));
    });
    return waitAll(anims);
  }

  /* 新内容：由中心向四周错落展开 */
  function unfoldIn() {
    var els = animBlocks(), anims = [];
    els.forEach(function (x) {
      var v = dirOf(x);
      var spread = 80 + Math.min(v.d, 700) * 0.22;
      var delay = Math.min(v.d * 0.30, 260);
      anims.push(x.animate([
        { transform: "translate(" + (-v.x * spread).toFixed(1) + "px," + (-v.y * spread).toFixed(1) + "px) scale(.86)", opacity: 0 },
        { transform: "translate(0,0) scale(1)", opacity: 1 }
      ], { duration: 560, delay: delay, easing: "cubic-bezier(.16,.84,.3,1)", fill: "both" }));
    });
    return waitAll(anims);
  }

  var pendingTo = null;

  function switchTo(i) {
    if (!DATA.characters[i]) return;
    if (i === current) { pendingTo = null; return; }
    /* 正在播动画时，把最新一次点击记下来，等这次播完接着切 —— 不丢点击 */
    if (switching) { pendingTo = i; return; }

    switching = true;
    document.body.classList.add("switching");

    scatterOut().then(function () {
      window.scrollTo(0, 0);
      current = i;
      markCastActive();
      /* 把当前人物写进地址栏，刷新或分享都停在同一个人 */
      if (history.replaceState) history.replaceState(null, "", "#" + DATA.characters[i].id);
      renderCharacter(DATA.characters[i], i);
      /* 进场交给 WAAPI，先让 .reveal 处于可见基底 */
      $$(".reveal").forEach(function (n) { n.classList.add("in"); });
      return unfoldIn();
    }).then(function () {
      applyScrollState();
      document.body.classList.remove("switching");
      switching = false;
      /* 排队中的下一次切换 */
      if (pendingTo !== null && pendingTo !== current) {
        var nx = pendingTo;
        pendingTo = null;
        switchTo(nx);
      }
    });
  }

  /* ---------------- 相册 ---------------- */
  var photos = [];
  var lbIndex = 0;
  var lb = $("#lightbox");

  function photosFor(c) {
    var id = (c && c.id) || "";
    return allPhotos.filter(function (p) {
      var f = p.file || "";
      return f.indexOf("/") < 0 || f.split("/")[0] === id;   /* 根目录=共用，子目录=归属该人物 */
    });
  }

  function renderGallery(list) {
    photos = list || [];
    var grid = $("#galleryGrid");
    var empty = $("#galleryEmpty");
    var count = $("#photoCount");
    grid.innerHTML = "";
    if (!photos.length) {
      empty.hidden = false;
      grid.hidden = true;
      count.textContent = "共 0 张";
      return;
    }
    empty.hidden = true;
    grid.hidden = false;
    count.textContent = "共 " + photos.length + " 张 · 点击查看大图";
    photos.forEach(function (p, i) {
      var item = el("figure", "gitem reveal");
      var im = el("img");
      im.src = p.url;
      im.alt = p.title || "照片";
      im.loading = "lazy";
      im.decoding = "async";
      im.addEventListener("error", function () {
        im.style.display = "none";
        item.classList.add("gitem-error");
        item.appendChild(el("div", "gph", "<span>🖼</span><small>这张图片无法显示<br>" + esc(p.file || p.url) + "</small>"));
      });
      item.appendChild(im);
      if (p.title || p.desc) {
        var cap = el("figcaption", "gcap");
        if (p.title) cap.appendChild(el("b", null, esc(p.title)));
        if (p.desc) cap.appendChild(el("small", null, esc(p.desc)));
        item.appendChild(cap);
      }
      item.addEventListener("click", function () { openLb(i); });
      grid.appendChild(item);
    });
    watch(grid);
  }

  function openLb(i) {
    if (!photos.length) return;
    lbIndex = (i + photos.length) % photos.length;
    var p = photos[lbIndex];
    $("#lbImg").src = p.url;
    $("#lbImg").alt = p.title || "照片";
    $("#lbCap").innerHTML = (p.title ? "<b>" + esc(p.title) + "</b>" : "") +
                            (p.desc ? (p.title ? " · " : "") + esc(p.desc) : "");
    lb.hidden = false;
    document.body.style.overflow = "hidden";
  }
  function closeLb() { lb.hidden = true; document.body.style.overflow = ""; }
  function stepLb(d) { if (photos.length) openLb(lbIndex + d); }

  if (lb) {
    $("#lbClose").addEventListener("click", closeLb);
    $("#lbPrev").addEventListener("click", function (e) { e.stopPropagation(); stepLb(-1); });
    $("#lbNext").addEventListener("click", function (e) { e.stopPropagation(); stepLb(1); });
    lb.addEventListener("click", function (e) { if (e.target === lb) closeLb(); });
    document.addEventListener("keydown", function (e) {
      if (lb.hidden) return;
      if (e.key === "Escape") closeLb();
      if (e.key === "ArrowLeft") stepLb(-1);
      if (e.key === "ArrowRight") stepLb(1);
    });
  }

  function loadPhotos() {
    fetch("api/photos", { cache: "no-store" })
      .then(function (r) {
        var ct = (r.headers.get("content-type") || "").toLowerCase();
        if (!r.ok || ct.indexOf("json") < 0) throw new Error("no api");
        return r.json();
      })
      .then(function (d) { allPhotos = (d && d.photos) || []; })
      .catch(function () {
        return fetch("photos/index.json", { cache: "no-store" })
          .then(function (r) {
            var ct = (r.headers.get("content-type") || "").toLowerCase();
            if (!r.ok || ct.indexOf("json") < 0) throw new Error("no manifest");
            return r.json();
          })
          .then(function (d) {
            allPhotos = ((d && d.photos) || []).map(function (x) {
              return typeof x === "string" ? { url: "photos/" + x, file: x } : x;
            });
          })
          .catch(function () { allPhotos = []; });
      })
      .then(function () {
        renderGallery(photosFor(DATA.characters[current]));
      });
  }

  /* ---------------- 高级质感特性 ---------------- */
  function applyHash() {
    var id = decodeURIComponent((location.hash || "").replace(/^#/, ""));
    if (!id) return false;
    for (var i = 0; i < DATA.characters.length; i++) {
      if (DATA.characters[i].id === id) { if (i !== current) switchTo(i); return true; }
    }
    return false;
  }

  function initPremium() {
    /* 顶部阅读进度条 */
    var prog = $("#progress");
    function upd() {
      if (!prog) return;
      var h = document.documentElement.scrollHeight - window.innerHeight;
      var p = h > 0 ? Math.min(Math.max(window.scrollY / h, 0), 1) : 0;
      prog.style.transform = "scaleX(" + p.toFixed(4) + ")";
    }
    window.addEventListener("scroll", upd, { passive: true });
    window.addEventListener("resize", upd);
    upd();

    /* 光标柔光（仅精确指针设备） */
    var fine = window.matchMedia && window.matchMedia("(pointer:fine)").matches;
    var glow = $("#cursorGlow");
    if (glow && fine) {
      window.addEventListener("mousemove", function (e) {
        glow.style.transform = "translate3d(" + e.clientX + "px," + e.clientY + "px,0)";
        glow.classList.add("on");
      }, { passive: true });
      document.addEventListener("mouseleave", function () { glow.classList.remove("on"); });
    }

    /* 数字键 1..N 切换人物 */
    document.addEventListener("keydown", function (e) {
      var t = e.target;
      if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      var n = parseInt(e.key, 10);
      if (!isNaN(n) && n >= 1 && n <= DATA.characters.length) { e.preventDefault(); switchTo(n - 1); }
    });

    /* 地址栏哈希：?#tangchen 直接打开某人，刷新也停在这儿 */
    window.addEventListener("hashchange", applyHash);
    applyHash();
  }

  /* ---------------- 启动 ---------------- */
  fetch("data/profile.json", { cache: "no-store" })
    .then(function (r) { if (!r.ok) throw new Error("404"); return r.json(); })
    .catch(function () { return null; })
    .then(function (raw) {
      DATA = normalize(raw);
      if (!DATA.characters.length) DATA.characters = [FALLBACK_CHAR];
      renderChrome();
      renderCast();
      renderCharacter(DATA.characters[current], current);
      window.__switchTo = switchTo;   /* 便于调试 */
      initPremium();
      loadPhotos();
    });
})();
