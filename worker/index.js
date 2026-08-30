/**
 * TSY Blog Worker v3
 *
 * 必须整份部署到 Cloudflare Worker「tsy-blog-api」。
 * 线上旧版只认识 POST / 和 POST /upload，对编辑/删除会返回纯文本
 * 「Not Found」，写作后台就会显示网络/接口失败。
 *
 * 与 src/pages/write.astro 对齐的接口：
 *   POST /                发布新文章
 *   POST /upload          上传图片（请求体是图片二进制，Content-Type 为图片 MIME）
 *   POST /posts/update    更新已有文章（JSON 里带 filename）
 *   POST /posts/delete    删除文章（JSON 里带 filename）
 *
 * 额外：
 *   GET  /                健康检查（纯文本，兼容旧版）
 *   GET  /version         确认已部署 v3（JSON，含路由列表）
 *
 * Cloudflare → Worker → Settings → Variables and Secrets：
 *   GITHUB_TOKEN   有 repo 写权限的 GitHub PAT（必需）
 *   GITHUB_OWNER   默认 tsy20031016
 *   GITHUB_REPO    默认 eccentric-eclipse
 *   GITHUB_BRANCH  默认 main
 *   SITE_BASE      默认 https://tsy20031016.github.io/eccentric-eclipse
 *   WRITE_TOKEN    可选。设置后写操作需要请求头 X-Write-Token
 */

const GITHUB_API = "https://api.github.com";
const POSTS_DIR = "src/content/posts";
const IMAGES_DIR = "public/images";
const VERSION = 3;

const CORS = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Headers": "Content-Type, X-Write-Token",
	"Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
	"Access-Control-Max-Age": "86400",
};

export default {
	async fetch(request, env) {
		if (request.method === "OPTIONS") {
			return new Response(null, { status: 204, headers: CORS });
		}

		let response;

		try {
			response = await route(request, env || {});
		} catch (error) {
			console.error(error);
			response = json(
				{
					success: false,
					message: "服务器发生错误。",
					error: String((error && error.message) || error),
				},
				500
			);
		}

		const headers = new Headers(response.headers);

		for (const [key, value] of Object.entries(CORS)) {
			headers.set(key, value);
		}

		return new Response(response.body, {
			status: response.status,
			statusText: response.statusText,
			headers,
		});
	},
};

async function route(request, env) {
	const url = new URL(request.url);
	const path = normalizePath(url.pathname);
	const method = request.method.toUpperCase();

	if (method === "GET" || method === "HEAD") {
		if (path === "/version") {
			return json({
				success: true,
				version: VERSION,
				message: "TSY Blog API v3",
				routes: [
					"POST /",
					"POST /upload",
					"POST /posts/update",
					"POST /posts/delete",
					"GET /version",
				],
			});
		}

		return health();
	}

	if (method === "POST" || method === "PUT") {
		if (path === "/") {
			return createPost(request, env);
		}

		if (path === "/upload") {
			return uploadImage(request, env);
		}

		if (path === "/posts/update" || path === "/update") {
			return updatePost(request, env);
		}

		if (path === "/posts/delete" || path === "/delete") {
			return deletePost(request, env);
		}
	}

	if (method === "DELETE" && (path === "/posts/delete" || path === "/delete")) {
		return deletePost(request, env);
	}

	return json(
		{
			success: false,
			message: "接口不存在。",
			method,
			path,
		},
		404
	);
}

function health() {
	return new Response("TSY Blog API is running.", {
		status: 200,
		headers: { "Content-Type": "text/plain; charset=utf-8" },
	});
}

function normalizePath(pathname) {
	const path = String(pathname || "/").replace(/\/+$/, "");
	return path || "/";
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

/** POST /upload —— 上传图片（原始二进制 + Content-Type） */
async function uploadImage(request, env) {
	if (!checkWriteToken(request, env)) {
		return json({ success: false, message: "没有权限。" }, 401);
	}

	const contentType = (request.headers.get("Content-Type") || "")
		.split(";")[0]
		.trim()
		.toLowerCase();

	const ext = {
		"image/jpeg": "jpg",
		"image/jpg": "jpg",
		"image/png": "png",
		"image/gif": "gif",
		"image/webp": "webp",
	}[contentType];

	if (!ext) {
		return json(
			{ success: false, message: "只支持 JPG / PNG / GIF / WebP。" },
			400
		);
	}

	const buffer = await request.arrayBuffer();

	if (!buffer.byteLength) {
		return json({ success: false, message: "图片内容为空。" }, 400);
	}

	if (buffer.byteLength > 10 * 1024 * 1024) {
		return json({ success: false, message: "图片不能超过 10MB。" }, 400);
	}

	const name = `${Date.now()}-${randomSuffix(8)}.${ext}`;

	await commitBinary(env, {
		path: `${IMAGES_DIR}/${name}`,
		bytes: buffer,
		message: `Upload image: ${name}`,
	});

	const siteBase = (
		env.SITE_BASE || "https://tsy20031016.github.io/eccentric-eclipse"
	).replace(/\/?$/, "");

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

function githubConfig(env) {
	const token =
		env.GITHUB_TOKEN ||
		env.GH_TOKEN ||
		env.TOKEN ||
		env.GITHUB_PAT;

	if (!token) {
		throw new Error(
			"Worker 未配置 GITHUB_TOKEN，请在 Cloudflare Settings → Variables and Secrets 里添加。"
		);
	}

	return {
		token,
		owner: env.GITHUB_OWNER || "tsy20031016",
		repo: env.GITHUB_REPO || "eccentric-eclipse",
		branch: env.GITHUB_BRANCH || "main",
	};
}

async function githubRequest(env, repoPath, init = {}, useRef = false) {
	const { token, owner, repo, branch } = githubConfig(env);
	const encoded = encodePath(repoPath);
	const query = useRef ? `?ref=${encodeURIComponent(branch)}` : "";

	return fetch(
		`${GITHUB_API}/repos/${owner}/${repo}/contents/${encoded}${query}`,
		{
			...init,
			headers: {
				Authorization: `Bearer ${token}`,
				Accept: "application/vnd.github+json",
				"User-Agent": "tsy-blog-api",
				"X-GitHub-Api-Version": "2022-11-28",
				...(init.headers || {}),
			},
		}
	);
}

async function githubError(response, fallback) {
	let detail = "";

	try {
		const data = await response.json();
		detail = data && data.message ? `：${data.message}` : "";
	} catch {
		detail = "";
	}

	return new Error(`${fallback}（HTTP ${response.status}）${detail}`);
}

async function getFile(env, repoPath) {
	const response = await githubRequest(env, repoPath, { method: "GET" }, true);

	if (response.status === 404) {
		return null;
	}

	if (!response.ok) {
		throw await githubError(response, "GitHub API 错误");
	}

	const data = await response.json();

	if (!data || !data.sha) {
		return null;
	}

	return { sha: data.sha };
}

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
		throw await githubError(response, "GitHub 提交失败");
	}
}

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
		throw await githubError(response, "GitHub 提交失败");
	}
}

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
		throw await githubError(response, "GitHub 删除失败");
	}
}

function json(data, status = 200) {
	return new Response(JSON.stringify(data), {
		status,
		headers: { "Content-Type": "application/json; charset=utf-8" },
	});
}

async function readJson(request) {
	const text = await request.text();

	if (!text) {
		return {};
	}

	try {
		return JSON.parse(text);
	} catch {
		return {};
	}
}

function checkWriteToken(request, env) {
	if (!env.WRITE_TOKEN) {
		return true;
	}

	return request.headers.get("X-Write-Token") === env.WRITE_TOKEN;
}

function validateFilename(filename) {
	if (!filename || typeof filename !== "string") {
		return "缺少文件名。";
	}

	if (
		filename.includes("/") ||
		filename.includes("\\") ||
		filename.includes("..")
	) {
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
