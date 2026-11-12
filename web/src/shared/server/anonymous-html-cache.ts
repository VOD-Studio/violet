import { anonymousRenderVariant } from "./visitor-cookies";

/** 响应头：`miss` 现渲染并存下，`hit` 用新鲜副本，`stale` 渲染失败后用旧副本。 */
export const HTML_CACHE_HEADER = "x-ssr-cache";

export interface AnonymousHtmlCacheOptions {
	/** 哪些路径的匿名页面可以在游客之间共享 */
	cacheable: (pathname: string) => boolean;
	/** 副本的新鲜期，也是内容更新后游客最迟看到新版的时间 */
	ttlMs: number;
	/** 过了新鲜期、重新渲染又失败时，旧副本还能顶替多久 */
	staleIfErrorMs: number;
	/** 全部副本正文的字节上限，超出时淘汰最久没被读到的 */
	maxBytes: number;
	/** @default Date.now */
	now?: () => number;
}

interface Entry {
	body: Uint8Array<ArrayBuffer>;
	headers: [string, string][];
	storedAt: number;
}

/**
 * 只在游客之间共享的 SSR 页面缓存，常驻当前进程。
 *
 * 带着名单外 cookie 的请求既不读也不写；副本按路径与访客偏好指纹区分。
 *
 * @returns 处理单个请求的函数：命中时不调用 `render`
 */
export function createAnonymousHtmlCache({
	cacheable,
	ttlMs,
	staleIfErrorMs,
	maxBytes,
	now = Date.now,
}: AnonymousHtmlCacheOptions) {
	// Map 保持插入顺序：读到的副本重新插到末尾，开头就是最久没被读到的
	const entries = new Map<string, Entry>();
	let totalBytes = 0;

	function keyOf(request: Request): string | null {
		if (request.method !== "GET" || request.headers.has("authorization")) return null;
		const url = new URL(request.url);
		// 查询串可能改变渲染结果，任意取值还会撑大副本数量
		if (url.search || !cacheable(url.pathname)) return null;
		const variant = anonymousRenderVariant(request.headers.get("cookie") ?? "");
		return variant === null ? null : `${url.pathname}\n${variant}`;
	}

	function drop(key: string) {
		const entry = entries.get(key);
		if (!entry) return;
		totalBytes -= entry.body.byteLength;
		entries.delete(key);
	}

	function store(key: string, entry: Entry) {
		drop(key);
		if (entry.body.byteLength > maxBytes) return;
		entries.set(key, entry);
		totalBytes += entry.body.byteLength;
		for (const oldest of entries.keys()) {
			// 除字节数外也限制副本数，避免大量空/极短页面占着键与 header。
			if (totalBytes <= maxBytes && entries.size <= 128) break;
			drop(oldest);
		}
	}

	function replay(entry: Entry, state: "hit" | "stale"): Response {
		const headers = new Headers(entry.headers);
		headers.set("age", String(Math.floor((now() - entry.storedAt) / 1000)));
		headers.set(HTML_CACHE_HEADER, state);
		headers.set("cache-control", "private, no-store");
		return new Response(entry.body, { status: 200, headers });
	}

	return async function serve(
		request: Request,
		render: () => Response | Promise<Response>,
	): Promise<Response> {
		const key = keyOf(request);
		if (key === null) {
			if (!cacheable(new URL(request.url).pathname)) return render();
			const response = await render();
			if (!(response.headers.get("content-type") ?? "").startsWith("text/html")) {
				return response;
			}
			const headers = new Headers(response.headers);
			headers.set("cache-control", "private, no-store");
			return new Response(response.body, {
				status: response.status,
				statusText: response.statusText,
				headers,
			});
		}

		const cached = entries.get(key);
		const age = cached ? now() - cached.storedAt : Number.POSITIVE_INFINITY;
		if (cached && age < ttlMs) {
			entries.delete(key);
			entries.set(key, cached);
			return replay(cached, "hit");
		}
		const fallback = cached && age < ttlMs + staleIfErrorMs ? cached : undefined;

		let response: Response;
		try {
			response = await render();
		} catch (error) {
			if (fallback) return replay(fallback, "stale");
			throw error;
		}
		if (response.status >= 500 && fallback) {
			void response.body?.cancel().catch(() => {});
			return replay(fallback, "stale");
		}
		// 走到这里旧副本要么已过顶替期，要么页面已变成别的结果（404、跳转、要写 cookie）
		drop(key);

		const cacheControl = response.headers.get("cache-control") ?? "";
		const isHtml = (response.headers.get("content-type") ?? "").startsWith("text/html");
		const shareable =
			response.status === 200 &&
			response.body !== null &&
			!response.headers.has("set-cookie") &&
			!/(?:^|,)\s*(private|no-store|no-cache)(?:\s|=|,|$)/i.test(cacheControl) &&
			!response.headers.has("vary") &&
			isHtml;
		const outgoing = new Headers(response.headers);
		if (isHtml) outgoing.set("cache-control", "private, no-store");
		if (!shareable || !response.body) {
			if (!isHtml) return response;
			return new Response(response.body, {
				status: response.status,
				statusText: response.statusText,
				headers: outgoing,
			});
		}
		const storedAt = now();
		const headers = [...response.headers];
		outgoing.set(HTML_CACHE_HEADER, "miss");
		if (fallback) {
			// 有旧版时必须先读完新流：一旦向客户端发送首字节，断流后就不能再换回旧页。
			let body: Uint8Array<ArrayBuffer>;
			try {
				body = new Uint8Array(await response.arrayBuffer());
			} catch {
				return replay(fallback, "stale");
			}
			store(key, { body, headers, storedAt });
			return new Response(body, {
				status: response.status,
				statusText: response.statusText,
				headers: outgoing,
			});
		}
		let chunks: Uint8Array[] | null = [];
		let size = 0;
		// 边发边存：流完整走完才落库，中途出错或读者断开都不留下半截页面
		const recorder = new TransformStream<Uint8Array, Uint8Array>({
			transform(chunk, controller) {
				if (chunks) {
					size += chunk.byteLength;
					if (size > maxBytes) chunks = null;
					else chunks.push(chunk);
				}
				controller.enqueue(chunk);
			},
			flush() {
				if (!chunks) return;
				const body = new Uint8Array(size);
				let offset = 0;
				for (const chunk of chunks) {
					body.set(chunk, offset);
					offset += chunk.byteLength;
				}
				store(key, { body, headers, storedAt });
			},
		});
		return new Response(response.body.pipeThrough(recorder), {
			status: response.status,
			statusText: response.statusText,
			headers: outgoing,
		});
	};
}
