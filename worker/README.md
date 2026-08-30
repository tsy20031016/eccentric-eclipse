# TSY Blog Worker v2 — 部署说明

这是给博客写作后台提供 API 的 Cloudflare Worker。v2 在原有"发布文章 / 上传图片"的基础上，新增了**更新文章**和**删除文章**两个接口，配合 `src/pages/write.astro` 里的"文章管理"面板使用。

## 为什么需要部署

旧的 Worker 只认识 `POST /`（发布）和 `POST /upload`（传图）。写作后台新加的"编辑 / 删除"功能会调用：

| 接口 | 方法 | 作用 |
| --- | --- | --- |
| `/` | POST | 发布新文章（原有） |
| `/upload` | POST | 上传图片（原有） |
| `/posts/update` | POST | 更新已有文章（**新增**） |
| `/posts/delete` | POST | 删除文章（**新增**） |

没部署 v2 之前，编辑和删除按钮会提示"API 还不支持该操作"。

## 部署步骤

```bash
cd worker
npx wrangler login
npx wrangler deploy
```

密钥（`GITHUB_TOKEN` 等）保存在 Cloudflare Worker 的 Settings → Variables and Secrets 里，**部署新代码不会丢**。如果原来用的变量名不是 `GITHUB_TOKEN`，改一下 `worker/index.js` 里 `githubConfig()` 的兜底列表即可。

## 环境变量

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `GITHUB_TOKEN` | 无（必需） | 有 repo 写权限的 GitHub PAT |
| `GITHUB_OWNER` | `tsy20031016` | 仓库所有者 |
| `GITHUB_REPO` | `eccentric-eclipse` | 仓库名 |
| `GITHUB_BRANCH` | `main` | 分支 |
| `SITE_BASE` | `https://tsy20031016.github.io/eccentric-eclipse` | 拼图片下载地址用 |
| `WRITE_TOKEN` | 不启用 | 可选鉴权，见下 |

## 安全提示（建议读一下）

和旧版一样，这个 API **没有鉴权**——知道地址的人都能发布、更新、删除文章。新增的删除接口让这个风险变大了。如果想加一道锁：

1. 在 Worker 里设置变量 `WRITE_TOKEN`（随便一串只有你自己知道的字符）；
2. 之后所有写操作都要求请求头 `X-Write-Token` 匹配，写作后台需要相应改造（在 `write.astro` 的 `postJson` 里带上这个请求头，值可以放在 localStorage 或构建变量里）。

## 工作原理

Worker 收到请求后，用 GitHub Contents API 直接向 `tsy20031016/eccentric-eclipse` 仓库提交文件：

- 发布 → 新建 `src/content/posts/<标题slug>-<时间戳>.md`
- 更新 → 先取文件 sha，再 PUT 覆盖 `src/content/posts/<原文件名>`
- 删除 → 先取文件 sha，再 DELETE
- 上传图片 → 提交到 `public/images/<时间戳>-<随机串>.<扩展名>`

push 到 `main` 后，GitHub Pages 会自动重新构建，一两分钟后线上就能看到变化。
