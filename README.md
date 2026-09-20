# 王睿 · 个人主页

玻璃拟态（极光玻璃）单页个人主页，**纯静态**，可直接部署到 Cloudflare Pages / GitHub Pages / 任意静态托管。

---

## 一、目录结构

```
wangrui-site/
├─ public/                    ← ★ 整个网站，部署时只需要这个目录
│  ├─ index.html
│  ├─ 404.html                404 页面（Cloudflare Pages 会自动使用）
│  ├─ assets/css/style.css    全部样式与配色
│  ├─ assets/js/main.js       内容渲染 / 相册 / 灯箱 / 主题切换
│  ├─ data/profile.json       ★ 所有文字内容
│  └─ photos/                 ★ 所有照片
│     ├─ captions.json        照片标题与说明（可选）
│     └─ index.json           相册清单（由 build-photos.js 生成）
├─ build-photos.js            扫描 photos/ 生成相册清单
├─ server.js                  本地预览服务（只用于本地，部署不需要）
├─ wrangler.toml              Cloudflare Pages 配置
├─ start.cmd                  双击本地预览
└─ package.json
```

---

## 二、本地预览

双击 `start.cmd`，或：

```powershell
npm run dev            # = node server.js，默认 http://127.0.0.1:8788/
```

本地模式下 `server.js` 提供 `/api/photos`，**丢照片进 photos/ 刷新即可**，不用手动生成清单。

---

## 三、补充内容

### 文字
编辑 `public/data/profile.json`，保存刷新即可。字段说明：

| 字段 | 作用 |
| --- | --- |
| `name` / `en` | 姓名与英文名 |
| `avatar` | 头像路径，如 `photos/avatar.jpg`；留空显示姓氏首字 |
| `tagline` | 首页简介 |
| `chips` | 首页小标签数组 |
| `stats` | 数据条 `{ value, label }` |
| `about` | 「关于」段落数组 |
| `facts` | 右侧信息栏 `{ label, value }` |
| `timeline` | 「经历」`{ time, title, desc, tags }` |
| `skills` | 「专长」`{ name, level }`，level 为 0–100 |
| `works` | 「作品」`{ title, desc, tags, link }` |
| `contacts` | 「联系」`{ icon, label, value, link }` |

### 照片
1. 把图片放进 `public/photos/`（可建子文件夹分类，支持 jpg/png/webp/gif/avif/bmp/svg）
2. 想加标题说明就编辑 `public/photos/captions.json`：
   ```json
   { "毕业照.jpg": { "title": "毕业那天", "desc": "2024 年夏" } }
   ```
3. **运行 `npm run photos`** 生成 `photos/index.json`（静态托管必需）

> Cloudflare Pages 的构建命令已设为 `node build-photos.js`，所以线上会自动重新生成，你只要把照片提交到仓库就行。

---

## 四、部署到 Cloudflare Pages

### 方式 A：连接 GitHub 仓库（推荐，以后 push 就自动部署）

1. 把仓库推到 GitHub（见第五节）
2. 打开 <https://dash.cloudflare.com/> → 左侧 **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
3. 选择你的仓库，然后按下表填写：

   | 配置项 | 值 |
   | --- | --- |
   | Production branch | `main` |
   | Framework preset | `None` |
   | Build command | `node build-photos.js` |
   | Build output directory | `public` |

4. 点 **Save and Deploy**，等约 30 秒，得到地址 `https://<项目名>.pages.dev`

之后每次 `git push`，Cloudflare 自动重新构建部署。

### 方式 B：命令行直传（不需要 GitHub）

```powershell
npx wrangler login          # 浏览器授权一次
npm run photos              # 先生成相册清单
npm run deploy              # = wrangler pages deploy public
```

### 绑定自己的域名
Pages 项目 → **Custom domains** → **Set up a custom domain**，按提示在域名 DNS 加一条 CNAME。

---

## 五、推到 GitHub

第一次：

```powershell
cd wangrui-site
git init -b main
git add -A
git commit -m "王睿个人主页：玻璃拟态单页站点"
git remote add origin https://github.com/<你的用户名>/wangrui-site.git
git push -u origin main
```

> 仓库先在 GitHub 网页上建好（空仓库，不要勾选 README），或者用 `gh repo create`。
> 推送时会要求登录：推荐装 [GitHub CLI](https://cli.github.com/) 后执行 `gh auth login`，最省事。

---

## 六、已实现的功能

- 首页：头像圈、渐变姓名、简介、标签、按钮、数据条
- 关于 / 经历时间线 / 专长进度条 / 作品卡片 / 相册（灯箱 + ←→ + Esc）/ 联系
- 明暗主题切换（记忆在浏览器）
- 滚动显现：**进出双向、可反复播放**（滚进淡入、滚出淡出）
- 移动端自适应、毛玻璃导航、极光背景
- 相册图片加载失败时显示占位而不是裂图
- 自定义 404 页面
- 页面被嵌进 iframe 导致 IntersectionObserver 不回调时，自动退化为滚动监听

---

## 七、常见问题

**Q：线上相册是空的？**
运行 `npm run photos` 并把 `public/photos/index.json` 一起提交；或确认 Cloudflare 的构建命令填了 `node build-photos.js`。

**Q：改了 profile.json 线上没变？**
浏览器缓存。强制刷新（Ctrl+F5），或在 Cloudflare 上点 **Retry deployment**。

**Q：`server.js` 会被部署上去吗？**
不会。Cloudflare 只发布 `public/` 目录，`server.js` 只是本地预览用的。
