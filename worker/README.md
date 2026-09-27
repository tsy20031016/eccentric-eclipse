# TSY Blog Worker v6 — 部署说明

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
| `/version` | GET | 确认已部署 v6 |

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

应看到 JSON：`"version": 6`，并列出 Aegis 子文档及章节管理接口。若要让写作后台的项目编辑器读取和保存，必须部署此版 Worker；GitHub Pages 前端还需单独构建部署。

项目稿保存在 `src/content/projects/aegis-agent.md`，项目图片保存在 `public/images/projects/aegis-agent/`。编辑入口位于 `/write/projects/aegis-agent/`，登录共用普通写作后台的浏览器登录状态。

首次启用 Aegis 项目写入前，必须在 `worker/` 目录运行 `npx wrangler secret put AEGIS_WRITE_TOKEN` 设置独立项目写入凭据；编辑器不会将此凭据保存到 localStorage。项目读取公开，项目稿保存和图片上传均要求该凭据。普通文章接口使用既有写入策略，不受该项目凭据改变。
