# TSY Blog Worker v7 — 部署说明

写作后台 `src/pages/write.astro` 会请求：

| 接口 | 方法 | 作用 |
| --- | --- | --- |
| `/` | POST | 发布新文章 |
| `/upload` | POST | 上传图片 |
| `/posts/update` | POST | 更新已有文章 |
| `/posts/delete` | POST | 删除文章 |
| `/projects/aegis-agent` | GET / POST | 读取 / 保存 Aegis Agent 独立论文稿 |
| `/projects/aegis-agent/overview`, `/abstract`, `/architecture` | GET / POST | 分别读取 / 保存 Aegis 子文档 |
| `/projects/aegis-agent/documents` | GET / POST | 列出 / 新建项目章节 |
| `/projects/aegis-agent/documents/:slug` | DELETE | 删除非核心项目章节 |
| `/projects/upload` | POST | 上传 Aegis Agent 项目图片 |
| `/self-notes` | GET / PUT | 读取 / 保存写给自己的话 |
| `/version` | GET | 确认已部署 v7 |

线上旧 Worker **只处理发布和传图**。编辑 / 删除会打到 `/posts/update`、`/posts/delete`，旧代码返回纯文本 `Not Found`，页面就会报网络或接口失败。

## 部署（必须覆盖现有 Worker）

Worker 名称必须仍是 `tsy-blog-api`，这样写作页里的地址不用改：

`https://tsy-blog-api.1468709192.workers.dev/`

```bash
cd worker
npx wrangler login
npx wrangler deploy
```

或在 Cloudflare Dashboard → Workers → `tsy-blog-api` → Edit code，把 `worker/index.js` **整份粘贴覆盖保存并 Deploy**。

密钥不用重新填：Settings → Variables and Secrets 里的 `GITHUB_TOKEN` 在更新代码后还在。

## 部署是否成功

浏览器打开：

https://tsy-blog-api.1468709192.workers.dev/version

应看到 JSON：`"version": 7`，并列出写给自己、Aegis 子文档及章节管理接口。GitHub Pages 前端还需单独构建部署。

项目稿保存在 `src/content/projects/aegis-agent.md`，项目图片保存在 `public/images/projects/aegis-agent/`。编辑入口位于 `/write/projects/aegis-agent/`，登录共用普通写作后台的浏览器登录状态。

首次启用 Aegis 项目写入前，必须在 `worker/` 目录运行 `npx wrangler secret put AEGIS_WRITE_TOKEN` 设置独立项目写入凭据；编辑器不会将此凭据保存到 localStorage。项目读取公开，项目稿保存和图片上传均要求该凭据。普通文章接口使用既有写入策略，不受该项目凭据改变。

## Aegis 文章管理

在项目工作区选择文章，可以修改标题、注释说明（卡片标题上方）、文章简介、所属板块和排序序号，再点击“保存项目稿”。序号为非负整数，同一板块内越小越靠前；相同序号按文档标识稳定排序。设置保存在 Markdown 的 `subtitle`、`description`、`section`、`order` 元数据中，本地草稿也会保留这些设置。

项目首页按“项目导读 → 七大系统架构板块 → 实现过程”组织。新文章可在保存时归入对应板块。新增的七大板块与实现过程文档是待撰写提纲，不代表已经完成实现。旧文章缺少新增字段时默认归入项目导读，排序序号为 100。

本次更新需发布前端和内容文件；若要让后台章节下拉列表也按序号排序，还需部署更新后的 `worker/index.js`。现有 v6 的文档保存接口已能保存这些元数据。

文章还可填写“子专题”（`topic`），形成“板块 → 子专题 → 文章”的层级。相同板块中名称相同的子专题自动合并；留空则显示在板块首页。子专题内按文章序号排序，首页可折叠展开。已提供“理解、决策与规划域 → 用户问题十维解构 → D1–D10 实现过程”的写作提纲。

普通文章与 Aegis 编辑器均支持保持文字选区后直接调整颜色和像素字号，以及常用色、清除格式、撤销与重做。项目 Markdown 编辑器对跨行文字逐行添加格式，保留标题和列表标记；公式、代码与元数据应使用各自编辑工具。
# 写给自己（v7）

写作页的「写给自己」按每行一句编辑，保存到 `src/data/self-notes.json`。
首页构建时读取该文件，每 3 秒随机渐变切换一句，不连续重复同一条，不显示序号；后台可调整行顺序整理内容。只有一句时静态显示，空列表时显示占位文案。
这些话公开展示，不属于加密日记。

- `GET /self-notes`：读取 `{ success, notes, sha }`。
- `PUT /self-notes`：提交 `{ notes, sha }`，使用现有 `WRITE_TOKEN` / `X-Write-Token` 校验，返回最新 `sha`。
- 每次最多 100 句，每句最多 500 个字符；传入空数组可清空。
- 版本冲突返回 409，避免覆盖其他设备上的更新。

上线时需同时发布 Astro 网站并部署本目录 Worker（`npx wrangler deploy --config worker/wrangler.toml`），
`/version` 应返回版本 7。后台保存会触发仓库现有 GitHub Pages 构建，完成后首页更新。
