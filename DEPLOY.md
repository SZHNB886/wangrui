# 部署步骤（照抄即可）

本文档只讲部署。内容怎么改见 `README.md`。

---

## 第 0 步（可选）：改掉提交身份

本地这次提交用的是占位身份，你可以先改掉再推：

```powershell
cd C:\Users\17849\deepk\wangrui-site
git config user.name  "你的名字"
git config user.email "你的邮箱"
git commit --amend --reset-author --no-edit
```

---

## 第 1 步：在 GitHub 建一个空仓库

1. 打开 <https://github.com/new>
2. **Repository name** 填 `wangrui-site`
3. 选 **Public**（Private 也能部署到 Cloudflare，但要额外授权）
4. **不要**勾选 "Add a README file" / .gitignore / license（我们的项目里已经有）
5. 点 **Create repository**

建好后页面会显示仓库地址，形如：
`https://github.com/你的用户名/wangrui-site.git`

---

## 第 2 步：推送

把下面第一行的 `你的用户名` 换成你的 GitHub 用户名，然后整段复制到 PowerShell 执行：

```powershell
cd C:\Users\17849\deepk\wangrui-site

git remote add origin https://github.com/你的用户名/wangrui-site.git
git push -u origin main
```

**会弹出浏览器让你登录 GitHub**（Git Credential Manager，Git for Windows 自带）。
登录并授权后，推送自动完成。以后再推只需 `git push`。

> 如果提示 `remote origin already exists`，改用：
> `git remote set-url origin https://github.com/你的用户名/wangrui-site.git`

---

## 第 3 步：Cloudflare Pages 连接仓库

1. 打开 <https://dash.cloudflare.com/> 并登录（没有账号就先注册，免费）
2. 左侧菜单 **Workers & Pages** → 右上 **Create** → 选 **Pages** 标签 → **Connect to Git**
3. 首次会要求授权 Cloudflare 访问你的 GitHub：
   - 选 **Only select repositories** → 勾选 `wangrui-site`（更安全）
   - 点 Install & Authorize
4. 回到 Cloudflare，选中 `wangrui-site` 仓库 → **Begin setup**
5. 按下表填写（**这一步是关键，填错会部署失败**）：

   | 配置项 | 填什么 |
   | --- | --- |
   | Project name | `wangrui-site` |
   | Production branch | `main` |
   | Framework preset | `None` |
   | Build command | `node build-photos.js` |
   | Build output directory | `public` |

6. 点 **Save and Deploy**，等 30 秒左右

成功后地址是：

**https://wangrui-site.pages.dev**

（如果你把 Project name 填成别的，地址就跟着变。）

---

## 第 4 步：以后怎么更新

1. 改 `public/data/profile.json` 改文字
2. 照片丢进 `public/photos/`，需要标题就编辑 `public/photos/captions.json`
3. 提交并推送：

```powershell
cd C:\Users\17849\deepk\wangrui-site
git add -A
git commit -m "更新内容"
git push
```

Cloudflare 会自动重新构建部署（约 30 秒）。
构建命令 `node build-photos.js` 会自动重新扫描照片生成相册清单，**你不用手动跑**。

---

## 附：本地预览

```powershell
cd C:\Users\17849\deepk\wangrui-site
npm run dev
```

打开 <http://127.0.0.1:8788/>。本地模式下丢照片进 `public/photos/` 刷新即可，无需生成清单。

---

## 附：绑定自己的域名

Cloudflare Pages 项目 → **Custom domains** → **Set up a custom domain** →
输入域名 → 按提示在 DNS 里加 CNAME（域名也在 Cloudflare 的话会自动加好）。

---

## 常见问题

| 现象 | 原因 / 解决 |
| --- | --- |
| 部署失败 `Output directory "public" not found` | Build output directory 必须填 `public`（不是 `/public`、不是 `./public`） |
| 线上相册是空的 | 确认 Build command 填了 `node build-photos.js`；否则手动 `npm run photos` 后一起提交 |
| 改了内容线上没变 | 浏览器缓存，Ctrl+F5；或 Cloudflare 里点 **Retry deployment** |
| `git push` 卡住不动 | 弹窗被浏览器拦了，看任务栏是否有 GitHub 登录窗口 |
| 想换成命令行部署（不用 GitHub） | `npx wrangler login` 然后 `npm run deploy` |
