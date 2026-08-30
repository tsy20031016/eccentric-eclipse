# TSY Blog Worker v3 — 部署说明

写作后台 `src/pages/write.astro` 会请求：

| 接口 | 方法 | 作用 |
| --- | --- | --- |
| `/` | POST | 发布新文章 |
| `/upload` | POST | 上传图片 |
| `/posts/update` | POST | 更新已有文章 |
| `/posts/delete` | POST | 删除文章 |
| `/version` | GET | 确认已部署 v3 |

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

应看到 JSON：`"version": 3`。如果仍是纯文本 `TSY Blog API is running.`，说明还是旧版，编辑/删除不会好。
