/* =========================================================
   王睿 · 个人主页  —  逻辑层
   数据来源：
     data/profile.json   → 文字内容（关于/经历/专长/作品/联系）
     /api/photos         → 由本地 Node 服务扫描 photos/ 目录自动生成
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

  /* ---------------- 默认内容（当 data/profile.json 不存在时使用） ---------------- */
  var FALLBACK = {
    name: "王睿",
    en: "WANG RUI",
    avatar: "",
    tagline: "这里是一句个人简介，等待补充。",
    chips: ["待补充标签"],
    stats: [ { value: "—", label: "待补充" } ],
    about: ["关于我的介绍还没有填写，稍后会补充在这里。"],
    facts: [ { label: "所在地", value: "待补充" } ],
    timeline: [ { time: "20XX", title: "待补充", desc: "这段经历的具体内容稍后补充。", tags: [] } ],
    skills: [ { name: "待补充", level: 60 } ],
    works: [ { title: "待补充", desc: "作品说明稍后补充。", tags: [], link: "" } ],
    contacts: [ { icon: "✉", label: "邮箱", value: "待补充", link: "" } ]
  };

  /* ---------------- 主题 ---------------- */
  var root = document.documentElement;
  var THEME_KEY = "wangrui-theme";
  try {
    var saved = localStorage.getItem(THEME_KEY);
    if (saved) root.setAttribute("data-theme", saved);
  } catch (e) {}
  var themeBtn = $("#themeBtn");
  if (themeBtn) {
    themeBtn.addEventListener("click", function () {
      /* 默认是浅色（纯白画布），点一下切到深色 */
      var next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
      root.setAttribute("data-theme", next);
      try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
    });
  }

  /* ---------------- 导航 ---------------- */
  var nav = $("#nav");
  var menuBtn = $("#menuBtn");
  var navLinks = $("#navLinks");
  function onScroll() {
    if (nav) nav.classList.toggle("shrunk", window.scrollY > 40);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  if (menuBtn && navLinks) {
    menuBtn.addEventListener("click", function () { navLinks.classList.toggle("open"); });
    navLinks.addEventListener("click", function (e) {
      if (e.target.tagName === "A") navLinks.classList.remove("open");
    });
  }

  /* 滚动高亮当前区块 */
  var spyTargets = $$("main section[id]");
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
    spyTargets.forEach(function (s) { spy.observe(s); });
  }

  /* ---------------- 滚动显现（双向常驻：进=淡入，出=淡出，可反复触发） ----------------
     主用 IntersectionObserver；万一它不工作（例如页面被嵌进 iframe 时观察器不回调），
     自动退化为 scroll 事件 + getBoundingClientRect，保证内容永远不会卡在不可见状态。 */
  var ioFired = false;
  var io = ("IntersectionObserver" in window)
    ? new IntersectionObserver(function (entries) {
        ioFired = true;
        entries.forEach(function (en) {
          en.target.classList.toggle("in", en.isIntersecting);
        });
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

  /* 兜底：启动 1.2s 内观察器一次都没回调过，就换成滚动监听 */
  var ioGuard = setTimeout(function () { if (!ioFired) useFallback(); }, 1200);
  window.addEventListener("load", function () {
    if (!ioFired) setTimeout(function () { if (!ioFired) useFallback(); }, 300);
  });

  /* ---------------- 渲染：文字内容 ---------------- */
  function renderProfile(p) {
    var name = p.name || FALLBACK.name;
    document.title = name + " · 个人主页";
    var bm = $("#brandMark"); if (bm) bm.textContent = name.slice(0, 1);
    var bn = $("#brandName"); if (bn) bn.textContent = name;
    var be = $("#brandEn"); if (be) be.textContent = (p.en || "").toUpperCase();
    var hn = $("#heroName"); if (hn) hn.textContent = name;
    var ht = $("#heroTagline"); if (ht) ht.textContent = p.tagline || "";
    var af = $("#avatarFallback"); if (af) af.textContent = name.slice(0, 1);

    /* 头像 */
    var img = $("#avatarImg");
    if (img && p.avatar) {
      img.src = p.avatar;
      img.hidden = false;
      img.addEventListener("load", function () { var f = $("#avatarFallback"); if (f) f.style.display = "none"; });
      img.addEventListener("error", function () { img.hidden = true; });
    }

    /* 标签 */
    var chips = $("#heroChips");
    if (chips) {
      chips.innerHTML = "";
      (p.chips || []).forEach(function (c) { chips.appendChild(el("span", "chip", esc(c))); });
    }

    /* 数据条 */
    var stats = $("#stats");
    if (stats) {
      stats.innerHTML = "";
      (p.stats || []).forEach(function (s) {
        var d = el("div", "stat");
        d.appendChild(el("b", null, esc(s.value)));
        d.appendChild(el("span", null, esc(s.label)));
        stats.appendChild(d);
      });
      stats.classList.add("reveal");
    }

    /* 关于 */
    var about = $("#aboutText");
    if (about) {
      about.innerHTML = "";
      (p.about || []).forEach(function (para) { about.appendChild(el("p", null, esc(para))); });
    }

    /* 侧栏事实 */
    var facts = $("#facts");
    if (facts) {
      facts.innerHTML = "";
      (p.facts || []).forEach(function (f) {
        var row = el("div", "fact");
        row.appendChild(el("dt", null, esc(f.label)));
        row.appendChild(el("dd", null, esc(f.value)));
        facts.appendChild(row);
      });
    }

    /* 经历 */
    var tl = $("#timelineList");
    if (tl) {
      tl.innerHTML = "";
      (p.timeline || []).forEach(function (t) {
        var li = el("li", "tl-item reveal");
        var card = el("div", "tl-card glass");
        if (t.time) card.appendChild(el("div", "tl-time", esc(t.time)));
        card.appendChild(el("h3", null, esc(t.title)));
        if (t.desc) card.appendChild(el("p", null, esc(t.desc)));
        if (t.tags && t.tags.length) {
          var tw = el("div", "tl-tags");
          t.tags.forEach(function (g) { tw.appendChild(el("span", "tag", esc(g))); });
          card.appendChild(tw);
        }
        li.appendChild(card);
        tl.appendChild(li);
      });
    }

    /* 专长 */
    var sk = $("#skillList");
    if (sk) {
      sk.innerHTML = "";
      (p.skills || []).forEach(function (s) {
        var box = el("div", "skill");
        var top = el("div", "skill-top");
        top.appendChild(el("b", null, esc(s.name)));
        top.appendChild(el("span", null, (s.level != null ? s.level + "%" : "")));
        var bar = el("div", "bar");
        var fill = el("i");
        fill.setAttribute("data-level", String(s.level == null ? 60 : s.level));
        bar.appendChild(fill);
        box.appendChild(top); box.appendChild(bar);
        sk.appendChild(box);
      });
      var skillObs = new IntersectionObserver(function (es) {
        es.forEach(function (en) {
          $$(".bar i", en.target).forEach(function (f) {
            var lv = Math.max(0, Math.min(100, Number(f.getAttribute("data-level")) || 0));
            f.style.width = en.isIntersecting ? lv + "%" : "0%";
          });
        });
      }, { threshold: 0.15 });
      skillObs.observe(sk);
    }

    /* 作品 */
    var wk = $("#workList");
    if (wk) {
      wk.innerHTML = "";
      (p.works || []).forEach(function (w) {
        var c = el("article", "work glass reveal");
        c.appendChild(el("h3", null, esc(w.title)));
        if (w.desc) c.appendChild(el("p", null, esc(w.desc)));
        if (w.tags && w.tags.length) {
          var tw = el("div", "tl-tags");
          w.tags.forEach(function (g) { tw.appendChild(el("span", "tag", esc(g))); });
          c.appendChild(tw);
        }
        if (w.link) {
          var a = el("a", "work-link", "查看详情 →");
          a.href = w.link; a.target = "_blank"; a.rel = "noopener";
          c.appendChild(a);
        }
        c.addEventListener("mousemove", function (e) {
          var r = c.getBoundingClientRect();
          c.style.setProperty("--mx", (e.clientX - r.left) + "px");
          c.style.setProperty("--my", (e.clientY - r.top) + "px");
        });
        wk.appendChild(c);
      });
    }

    /* 联系 */
    var ct = $("#contactList");
    if (ct) {
      ct.innerHTML = "";
      (p.contacts || []).forEach(function (c) {
        var box = c.link ? el("a", "contact") : el("div", "contact");
        if (c.link) { box.href = c.link; }
        if (c.link && c.link.indexOf("http") === 0) { box.target = "_blank"; box.rel = "noopener"; }
        box.appendChild(el("div", "ci", esc(c.icon || "•")));
        var t = el("div", "ct");
        t.appendChild(el("small", null, esc(c.label)));
        t.appendChild(el("b", null, esc(c.value)));
        box.appendChild(t);
        ct.appendChild(box);
      });
    }

    $("#year").textContent = String(new Date().getFullYear());
    watch();
  }

  /* ---------------- 相册 ---------------- */
  var photos = [];
  var lbIndex = 0;
  var lb = $("#lightbox");

  function renderGallery(list) {
    var grid = $("#galleryGrid");
    var empty = $("#galleryEmpty");
    var count = $("#photoCount");
    grid.innerHTML = "";
    if (!list.length) {
      empty.hidden = false;
      grid.hidden = true;
      count.textContent = "共 0 张";
      return;
    }
    empty.hidden = true;
    grid.hidden = false;
    count.textContent = "共 " + list.length + " 张 · 点击查看大图";
    list.forEach(function (p, i) {
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
    lbIndex = (i + photos.length) % photos.length;
    var p = photos[lbIndex];
    $("#lbImg").src = p.url;
    $("#lbImg").alt = p.title || "照片";
    var cap = $("#lbCap");
    cap.innerHTML = (p.title ? "<b>" + esc(p.title) + "</b>" : "") +
                    (p.desc ? (p.title ? " · " : "") + esc(p.desc) : "");
    lb.hidden = false;
    document.body.style.overflow = "hidden";
  }
  function closeLb() {
    lb.hidden = true;
    document.body.style.overflow = "";
  }
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
        /* 静态托管（Cloudflare Pages 等）没有这个接口，可能返回 200 的 HTML，
           所以必须确认返回的确实是 JSON，否则走 photos/index.json 静态清单 */
        var ct = (r.headers.get("content-type") || "").toLowerCase();
        if (!r.ok || ct.indexOf("json") < 0) throw new Error("no api");
        return r.json();
      })
      .then(function (data) {
        photos = (data && data.photos) || [];
        renderGallery(photos);
      })
      .catch(function () {
        /* 无服务端时退回静态清单 */
        fetch("photos/index.json", { cache: "no-store" })
          .then(function (r) {
            var ct = (r.headers.get("content-type") || "").toLowerCase();
            if (!r.ok || ct.indexOf("json") < 0) throw new Error("no manifest");
            return r.json();
          })
          .then(function (d) {
            photos = (d.photos || []).map(function (x) {
              return typeof x === "string" ? { url: "photos/" + x } : x;
            });
            renderGallery(photos);
          })
          .catch(function () { renderGallery([]); });
      });
  }

  /* ---------------- 启动 ---------------- */
  var boot = fetch("data/profile.json", { cache: "no-store" })
    .then(function (r) { if (!r.ok) throw new Error("404"); return r.json(); })
    .catch(function () { return FALLBACK; })
    .then(function (p) {
      renderProfile(Object.assign({}, FALLBACK, p || {}));
    });

  boot.then(loadPhotos);
  watch();
})();
