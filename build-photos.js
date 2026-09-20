/* build-photos.js —— 扫描 public/photos/ 生成静态相册清单
 * 用途：Cloudflare Pages 上没有 Node 服务，相册改由这个脚本在构建时生成。
 * 用法：node build-photos.js
 */
"use strict";
const fs = require("fs");
const path = require("path");

const PHOTOS_DIR = path.join(__dirname, "public", "photos");
const CAPTIONS = path.join(PHOTOS_DIR, "captions.json");
const OUT = path.join(PHOTOS_DIR, "index.json");
const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif", ".bmp", ".svg"]);

function walk(dir, base) {
  let out = [];
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch (e) { return out; }
  for (const ent of entries) {
    if (ent.name.startsWith(".")) continue;
    const abs = path.join(dir, ent.name);
    const rel = base ? base + "/" + ent.name : ent.name;
    if (ent.isDirectory()) out = out.concat(walk(abs, rel));
    else if (IMAGE_EXT.has(path.extname(ent.name).toLowerCase())) out.push(rel);
  }
  return out;
}

let captions = {};
try { captions = JSON.parse(fs.readFileSync(CAPTIONS, "utf8")); } catch (e) {}

const files = walk(PHOTOS_DIR, "").sort(function (a, b) {
  return a.localeCompare(b, "zh-Hans-CN", { numeric: true, sensitivity: "base" });
});

const photos = files.map(function (rel) {
  const base = path.basename(rel);
  const c = captions[rel] || captions[base] || {};
  return {
    url: "photos/" + rel.split("/").map(encodeURIComponent).join("/"),
    file: rel,
    title: c.title || path.basename(rel, path.extname(rel)),
    desc: c.desc || ""
  };
});

fs.writeFileSync(OUT, JSON.stringify({ count: photos.length, photos: photos }, null, 2) + "\n", "utf8");
console.log("已生成 " + OUT);
console.log("共 " + photos.length + " 张照片");
photos.forEach(function (p) { console.log("  - " + p.file + "  「" + p.title + "」"); });
