/**
 * TSY Blog Worker v2
 *
 * 在 v1（发布文章 / 上传图片）的基础上新增：
 *   POST /posts/update  更新已有文章
 *   POST /posts/delete  删除文章
 *
 * 文章以 Markdown 文件的形式提交到 GitHub 仓库（src/content/posts/），
 * push 会自动触发 GitHub Pages 重新部署。
 *
 * 所需密钥 / 变量（Cloudflare Worker Settings → Variables and Secrets）：
 *   GITHUB_TOKEN  有 repo 写权限的 GitHub Personal Access Token（必需）
 *   GITHUB_OWNER  仓库所有者，默认 tsy20031016
 *   GITHUB_REPO   仓库名，默认 eccentric-eclipse
 *   GITHUB_BRANCH 分支，默认 main
 *   SITE_BASE     博客站点地址（拼图片 URL 用），
 *                 默认 https://tsy20031016.github.io/eccentric-eclipse
 *   WRITE_TOKEN   可选。设置后所有写操作都要求请求头 X-Write-Token 匹配
 */

const GITHUB_API = "https://api.github.com";

const POSTS_DIR = "src/content/posts";
const IMAGES_DIR = "public/images";

export default {
	async fetch(request, env) {
		if (request.method === "OPTIONS") {
			return new Response(null, { status: 204, headers: cors() });
		}

		const url = new URL(request.url);

		let response;

		try {
			if (request.method === "GET") {
				response = health();
			} else if (request.method === "POST" && (url.pathname === "/" || url.pathname === "")) {
				response = await createPost(request, env);
			} else if (request.method === "POST" && url.pathname === "/upload") {
				response = await uploadImage(request, env);
			} else if (request.method === "POST" && url.pathname === "/posts/update") {
				response = await updatePost(request, env);
			} else if (request.method === "POST" && url.pathname === "/posts/delete") {
				response = await deletePost(request, env);
			} else {
				response = json({ success: false, message: "接口不存在。" }, 404);
			}
		} catch (error) {
			console.error(error);
			response = json({
				success: false,
				message: "服务器发生错误。",
				error: String((error && error.message) || error),
			}, 500);
		}

		const headers = new Headers(response.headers);
		for (const [key, value] of Object.entries(cors())) {
			headers.set(key, value);
		}

		return new Response(response.body, {
			status: response.status,
			statusText: response.statusText,
			headers,
		});
	},
};

// ========================================
// 路由处理
// ========================================

function health() {
	return new Response("TSY Blog API is running.", {
		status: 200,
		headers: { "Content-Type": "text/plain; charset=utf-8" },
	});
}

/** POST / —— 发布新文章 */
async function createPost(request, env) {
	const body = await readJson(request);

	if (!checkWriteToken(request, env)) {
		return json({ success: false, message: "没有权限。" }, 401);
	}

	if (!body.title || !body.content) {
		return json({ success: false, message: "标题和正文不能为空。" }, 400);
	}

	const filename = `${slugify(body.title)}-${Date.now()}.md`;

	const fileContent =
		buildFrontmatter(body) + String(body.content).replace(/\r\n/g, "\n");

	const path = `${POSTS_DIR}/${filename}`;

	await commitFile(env, {
		path,
		content: fileContent,
		message: `Add post: ${String(body.title).trim()}`,
	});

	return json({ success: true, message: "文章已发布。", filename });
}

/** POST /upload —— 上传图片 */
async function uploadImage(request, env) {
	if (!checkWriteToken(request, env)) {
		return json({ success: false, message: "没有权限。" }, 401);
	}

	const contentType = request.headers.get("Content-Type") || "";

	const ext = {
		"image/jpeg": "jpg",
		"image/png": "png",
		"image/gif": "gif",
		"image/webp": "webp",
	}[contentType];

	if (!ext) {
		return json({ success: false, message: "只支持 JPG / PNG / GIF / WebP。" }, 400);
	}

	const buffer = await request.arrayBuffer();

	if (!buffer.byteLength) {
		return json({ success: false, message: "图片内容为空。" }, 400);
	}

	const name = `${Date.now()}-${randomSuffix(8)}.${ext}`;

	await commitBinary(env, {
		path: `${IMAGES_DIR}/${name}`,
		bytes: buffer,
		message: `Upload image: ${name}`,
	});

	const siteBase = (env.SITE_BASE || "https://tsy20031016.github.io/eccentric-eclipse").replace(/\/?$/, "");

	return json({ success: true, url: `${siteBase}/images/${name}` });
}

/** POST /posts/update —— 更新已有文章 */
async function updatePost(request, env) {
	const body = await readJson(request);

	if (!checkWriteToken(request, env)) {
		return json({ success: false, message: "没有权限。" }, 401);
	}

	const filenameError = validateFilename(body.filename);

	if (filenameError) {
		return json({ success: false, message: filenameError }, 400);
	}

	if (!body.title || !body.content) {
		return json({ success: false, message: "标题和正文不能为空。" }, 400);
	}

	const path = `${POSTS_DIR}/${body.filename}`;

	const existing = await getFile(env, path);

	if (!existing) {
		return json({ success: false, message: "要更新的文章不存在。" }, 404);
	}

	const fileContent =
		buildFrontmatter(body) + String(body.content).replace(/\r\n/g, "\n");

	await commitFile(env, {
		path,
		content: fileContent,
		sha: existing.sha,
		message: `Update post: ${String(body.title).trim()}`,
	});

	return json({ success: true, message: "文章已更新。" });
}

/** POST /posts/delete —— 删除文章 */
async function deletePost(request, env) {
	const body = await readJson(request);

	if (!checkWriteToken(request, env)) {
		return json({ success: false, message: "没有权限。" }, 401);
	}

	const filenameError = validateFilename(body.filename);

	if (filenameError) {
		return json({ success: false, message: filenameError }, 400);
	}

	const path = `${POSTS_DIR}/${body.filename}`;

	const existing = await getFile(env, path);

	if (!existing) {
		return json({ success: false, message: "要删除的文章不存在。" }, 404);
	}

	await deleteFile(env, {
		path,
		sha: existing.sha,
		message: `Delete post: ${body.filename}`,
	});

	return json({ success: true, message: "文章已删除。" });
}

// ========================================
// GitHub Contents API
// ========================================

function githubConfig(env) {
	const token = env.GITHUB_TOKEN || env.GH_TOKEN || env.TOKEN;

	if (!token) {
		throw new Error("Worker 未配置 GITHUB_TOKEN，请在 Cloudflare 设置里添加。");
	}

	return {
		token,
		owner: env.GITHUB_OWNER || "tsy20031016",
		repo: env.GITHUB_REPO || "eccentric-eclipse",
		branch: env.GITHUB_BRANCH || "main",
	};
}

async function githubRequest(env, repoPath, init = {}) {
	const { token, owner, repo } = githubConfig(env);

	return fetch(`${GITHUB_API}/repos/${owner}/${repo}/contents/${encodePath(repoPath)}`, {
		...init,
		headers: {
			Authorization: `Bearer ${token}`,
			Accept: "application/vnd.github+json",
			"User-Agent": "tsy-blog-api",
			"X-GitHub-Api-Version": "2022-11-28",
			...(init.headers || {}),
		},
	});
}

/** 查询文件（拿 sha 用），不存在返回 null */
async function getFile(env, repoPath) {
	const response = await githubRequest(env, repoPath, {
		method: "GET",
	});

	if (response.status === 404) {
		return null;
	}

	if (!response.ok) {
		throw new Error(`GitHub API 错误（HTTP ${response.status}）`);
	}

	const data = await response.json();

	return { sha: data.sha };
}

/** 提交文本文件（新建或更新） */
async function commitFile(env, { path, content, sha, message }) {
	const payload = {
		message,
		content: base64Encode(content),
		branch: githubConfig(env).branch,
	};

	if (sha) {
		payload.sha = sha;
	}

	const response = await githubRequest(env, path, {
		method: "PUT",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(payload),
	});

	if (!response.ok) {
		throw new Error(`GitHub 提交失败（HTTP ${response.status}）`);
	}
}

/** 提交二进制文件（图片） */
async function commitBinary(env, { path, bytes, message }) {
	const payload = {
		message,
		content: base64EncodeBytes(new Uint8Array(bytes)),
		branch: githubConfig(env).branch,
	};

	const response = await githubRequest(env, path, {
		method: "PUT",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(payload),
	});

	if (!response.ok) {
		throw new Error(`GitHub 提交失败（HTTP ${response.status}）`);
	}
}

/** 删除文件 */
async function deleteFile(env, { path, sha, message }) {
	const payload = {
		message,
		sha,
		branch: githubConfig(env).branch,
	};

	const response = await githubRequest(env, path, {
		method: "DELETE",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(payload),
	});

	if (!response.ok) {
		throw new Error(`GitHub 删除失败（HTTP ${response.status}）`);
	}
}

// ========================================
// 工具函数
// ========================================

function cors() {
	return {
		"Access-Control-Allow-Origin": "*",
		"Access-Control-Allow-Headers": "Content-Type, X-Write-Token",
		"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
	};
}

function json(data, status = 200) {
	return new Response(JSON.stringify(data), {
		status,
		headers: { "Content-Type": "application/json; charset=utf-8" },
	});
}

async function readJson(request) {
	try {
		return await request.json();
	} catch {
		return {};
	}
}

/** 可选的写操作鉴权：只有设置了 WRITE_TOKEN 变量才会启用 */
function checkWriteToken(request, env) {
	if (!env.WRITE_TOKEN) {
		return true;
	}

	return request.headers.get("X-Write-Token") === env.WRITE_TOKEN;
}

/** 防路径穿越：只允许仓库 posts 目录下的 .md 文件名 */
function validateFilename(filename) {
	if (!filename || typeof filename !== "string") {
		return "缺少文件名。";
	}

	if (filename.includes("/") || filename.includes("\\") || filename.includes("..")) {
		return "文件名不合法。";
	}

	if (!filename.endsWith(".md")) {
		return "只能操作 .md 文件。";
	}

	return null;
}

function slugify(text) {
	const slug = String(text || "")
		.trim()
		.toLowerCase()
		.replace(/[\s.]+/g, "-")
		.replace(/[^\p{L}\p{N}_-]+/gu, "")
		.replace(/-{2,}/g, "-")
		.replace(/^-+|-+$/g, "");

	return slug || "post";
}

/** 生成与文章 schema 对齐的 frontmatter */
function buildFrontmatter(post) {
	let fm = "---\n";

	fm += `title: ${yamlString(post.title)}\n`;
	fm += `description: ${yamlString(post.description || String(post.title).trim())}\n`;
	fm += `date: ${yamlString(post.date || new Date().toISOString().slice(0, 10))}\n`;
	fm += `category: ${yamlString(post.category || "随笔")}\n`;

	const tags = Array.isArray(post.tags) ? post.tags.filter(Boolean) : [];

	if (tags.length) {
		fm += "tags:\n";

		for (const tag of tags) {
			fm += `  - ${yamlString(tag)}\n`;
		}
	}

	fm += "---\n\n";

	return fm;
}

function yamlString(value) {
	return JSON.stringify(String(value ?? ""));
}

function randomSuffix(length) {
	const chars = "abcdefghijklmnopqrstuvwxyz0123456789";

	let out = "";

	for (let i = 0; i < length; i++) {
		out += chars[Math.floor(Math.random() * chars.length)];
	}

	return out;
}

function encodePath(path) {
	return path.split("/").map(encodeURIComponent).join("/");
}

function base64Encode(text) {
	return base64EncodeBytes(new TextEncoder().encode(text));
}

function base64EncodeBytes(bytes) {
	let binary = "";

	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}

	return btoa(binary);
}
