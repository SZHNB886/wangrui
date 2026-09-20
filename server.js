/* 王睿 · 个人主页 —— 零依赖本地静态服务
 * 用法: node server.js [端口]
 * 特性:
 *   - 静态托管 public/
 *   - /api/photos 自动扫描 photos/ 目录
 *   - 无扩展名的未知路径回落到 index.html（单页站点，避免出现裸 404）
 *   - /favicon.ico 直接返回内联图标
 *   - /photos/ 列出目录内容，方便确认照片有没有放进去
 *   - 每个请求都打日志（含状态码），便于排查
 */
"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "public");
const PHOTOS_DIR = path.join(ROOT, "photos");
const CAPTIONS = path.join(PHOTOS_DIR, "captions.json");
const PORT = Number(process.argv[2] || process.env.PORT || 8788);
const HOST = process.env.HOST || "127.0.0.1";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".bmp": "image/bmp",
  ".ico": "image/x-icon",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/plain; charset=utf-8"
};
const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif", ".bmp", ".svg"]);

const FAVICON = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'>" +
  "<rect width='100' height='100' rx='24' fill='#202020'/>" +
  "<text x='50' y='69' font-size='54' text-anchor='middle' fill='#ffffff' " +
  "font-family='sans-serif'>\u738B</text></svg>";

function log(status, req, extra) {
  const t = new Date().toTimeString().slice(0, 8);
  console.log("[" + t + "] " + status + "  " + req.method + " " + req.url + (extra ? "  " + extra : ""));
}

function walkImages(dir, base) {
  let out = [];
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch (e) { return out; }
  for (const ent of entries) {
    if (ent.name.startsWith(".")) continue;
    const abs = path.join(dir, ent.name);
    const rel = base ? base + "/" + ent.name : ent.name;
    if (ent.isDirectory()) out = out.concat(walkImages(abs, rel));
    else if (IMAGE_EXT.has(path.extname(ent.name).toLowerCase())) {
      let st = null;
      try { st = fs.statSync(abs); } catch (e) {}
      out.push({ rel, abs, mtime: st ? st.mtimeMs : 0 });
    }
  }
  return out;
}

function readCaptions() {
  try { return JSON.parse(fs.readFileSync(CAPTIONS, "utf8")); }
  catch (e) { return {}; }
}

function send(req, res, code, body, headers) {
  const h = Object.assign({ "Cache-Control": "no-store" }, headers || {});
  res.writeHead(code, h);
  res.end(body);
  if (code >= 400) log(code, req);
}

function notFoundPage(req, res, why) {
  const body = "<!DOCTYPE html><html lang='zh-CN'><head><meta charset='utf-8'>" +
    "<meta name='viewport' content='width=device-width,initial-scale=1'>" +
    "<title>404 · 王睿的个人主页</title>" +
    "<style>html,body{height:100%;margin:0}body{display:grid;place-items:center;background:#0a0a0a;color:#f2f2f2;" +
    "font-family:'PingFang SC','Microsoft YaHei',system-ui,sans-serif}" +
    ".b{max-width:560px;padding:40px 44px;border-radius:20px;background:rgba(255,255,255,.06);" +
    "border:1px solid rgba(255,255,255,.14);backdrop-filter:blur(22px);-webkit-backdrop-filter:blur(22px);" +
    "box-shadow:0 18px 50px -18px rgba(0,0,0,.75),inset 0 1px 0 rgba(255,255,255,.16);text-align:center}" +
    "h1{margin:0 0 8px;font-size:40px;letter-spacing:.06em;font-weight:900;" +
    "background:linear-gradient(115deg,#fff,#b8b8b8);-webkit-background-clip:text;background-clip:text;color:transparent}" +
    "p{margin:8px 0;color:rgba(242,242,242,.66);font-size:14.5px;line-height:1.7}" +
    "code{background:rgba(255,255,255,.10);border:1px solid rgba(255,255,255,.20);border-radius:6px;padding:.1em .45em;font-size:.9em}" +
    "a{display:inline-block;margin-top:20px;padding:11px 26px;border-radius:999px;text-decoration:none;color:#0e0e0e;" +
    "font-weight:600;font-size:14.5px;background:linear-gradient(120deg,#fff,#cacaca)}</style></head><body><div class='b'>" +
    "<h1>404</h1><p>没有这个地址：<code>" + String(req.url).replace(/[&<>"]/g, "") + "</code></p>" +
    "<p>" + why + "</p><a href='/'>返回首页</a></div></body></html>";
  send(req, res, 404, body, { "Content-Type": "text/html; charset=utf-8" });
}

function handlePhotos(req, res) {
  const caps = readCaptions();
  const files = walkImages(PHOTOS_DIR, "").sort(function (a, b) {
    return a.rel.localeCompare(b.rel, "zh-Hans-CN", { numeric: true, sensitivity: "base" });
  });
  const photos = files.map(function (f) {
    const base = path.basename(f.rel);
    const c = caps[f.rel] || caps[base] || {};
    return {
      url: "photos/" + f.rel.split("/").map(encodeURIComponent).join("/"),
      file: f.rel,
      title: c.title || path.basename(f.rel, path.extname(f.rel)),
      desc: c.desc || "",
      mtime: f.mtime
    };
  });
  const body = JSON.stringify({ count: photos.length, photos: photos }, null, 2);
  res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(body);
  log(200, req, photos.length + " 张");
}

function listPhotosDir(req, res) {
  const files = walkImages(PHOTOS_DIR, "");
  const items = files.length
    ? files.map(function (f) { return "<li><a href='/photos/" + f.rel.split("/").map(encodeURIComponent).join("/") + "'>" + f.rel + "</a></li>"; }).join("")
    : "<li style='color:#8f8f8f'>（空）把你的照片复制到 public/photos/ 目录</li>";
  const body = "<!DOCTYPE html><meta charset='utf-8'><title>photos/</title>" +
    "<body style='background:#0a0a0a;color:#f2f2f2;font-family:system-ui;padding:32px'>" +
    "<h2>photos/ 目录 —— 共 " + files.length + " 个文件</h2><ul>" + items + "</ul>" +
    "<p><a style='color:#ccc' href='/'>← 返回首页</a></p></body>";
  send(req, res, 200, body, { "Content-Type": "text/html; charset=utf-8" });
}

function serveFile(req, res, abs, statusHint) {
  fs.readFile(abs, function (err, buf) {
    if (err) return notFoundPage(req, res, "文件读取失败：" + path.basename(abs));
    const ext = path.extname(abs).toLowerCase();
    const h = { "Content-Type": MIME[ext] || "application/octet-stream" };
    if (statusHint === 404) h["X-Fallback"] = "index.html";
    res.writeHead(200, Object.assign({ "Cache-Control": "no-store" }, h));
    res.end(buf);
    log(200, req);
  });
}

function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel === "/" || rel === "") rel = "/index.html";
  const safe = path.normalize(rel).replace(/^([/\\])+/, "");
  const abs = path.join(ROOT, safe);
  if (!abs.startsWith(ROOT)) return notFoundPage(req, res, "路径越界。");

  fs.stat(abs, function (err, st) {
    if (!err && st) {
      if (st.isDirectory()) {
        if (path.basename(abs) === "photos") return listPhotosDir(req, res);
        return serveFile(req, res, path.join(abs, "index.html"));
      }
      return serveFile(req, res, abs);
    }
    // 未知路径：没有扩展名的当作页面路由，回落到首页（单页站点，避免裸 404）
    if (!path.extname(safe)) return serveFile(req, res, path.join(ROOT, "index.html"), 404);
    return notFoundPage(req, res, "这个资源不存在。静态目录里只有 public/ 下的文件。");
  });
}

const server = http.createServer(function (req, res) {
  const u = new URL(req.url, "http://" + (req.headers.host || "localhost"));
  const pathname = u.pathname;
  if (pathname === "/api/photos") return handlePhotos(req, res);
  if (pathname === "/api/health") return send(req, res, 200, JSON.stringify({ ok: true, root: ROOT }), { "Content-Type": "application/json" });
  if (pathname === "/favicon.ico") {
    res.writeHead(200, { "Content-Type": "image/svg+xml", "Cache-Control": "no-store" });
    res.end(FAVICON);
    return log(200, req, "favicon");
  }
  return serveStatic(req, res, pathname);
});

server.on("error", function (e) {
  if (e.code === "EADDRINUSE") {
    console.error("端口 " + PORT + " 已被占用，请换一个端口，例如: node server.js 8789");
    process.exit(1);
  }
  throw e;
});

server.listen(PORT, HOST, function () {
  console.log("================ 王睿 · 个人主页 ================");
  console.log("  本地地址: http://" + HOST + ":" + PORT + "/");
  console.log("  相册接口: http://" + HOST + ":" + PORT + "/api/photos");
  console.log("  照片目录: " + PHOTOS_DIR);
  console.log("  静态根目录: " + ROOT);
  console.log("  每个请求都会打印在下方的日志里");
  console.log("  停止服务: Ctrl + C");
  console.log("=================================================");
});
