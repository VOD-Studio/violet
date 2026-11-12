// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { createAnonymousHtmlCache } from "../anonymous-html-cache";

const TTL = 60_000;
const STALE_IF_ERROR = 300_000;

function page(body: BodyInit, init: ResponseInit = {}) {
	return new Response(body, {
		...init,
		headers: { "content-type": "text/html; charset=utf-8", ...init.headers },
	});
}

function setup(maxBytes = 1024) {
	const clock = { now: 0 };
	// 每次渲染产出不同的内容，读到哪一份一目了然
	const render = vi.fn(async () => page(`渲染 ${render.mock.calls.length}`));
	const serve = createAnonymousHtmlCache({
		cacheable: (pathname) => pathname.startsWith("/blog/"),
		ttlMs: TTL,
		staleIfErrorMs: STALE_IF_ERROR,
		maxBytes,
		now: () => clock.now,
	});
	async function open(path: string, init: RequestInit = {}) {
		const response = await serve(new Request(`https://violet.test${path}`, init), render);
		return {
			body: await response.text(),
			status: response.status,
			cache: response.headers.get("x-ssr-cache"),
			age: response.headers.get("age"),
			cacheControl: response.headers.get("cache-control"),
		};
	}
	return { clock, render, open };
}

const withCookie = (cookie: string): RequestInit => ({ headers: { cookie } });

describe("匿名 HTML 缓存", () => {
	it("游客重复打开同一篇文章，第二次起直接用已渲染的页面", async () => {
		const { open, render } = setup();
		expect(await open("/blog/a")).toMatchObject({
			body: "渲染 1",
			cache: "miss",
			cacheControl: "private, no-store",
		});
		expect(await open("/blog/a")).toMatchObject({ body: "渲染 1", cache: "hit" });
		expect(await open("/blog/b")).toMatchObject({ body: "渲染 2", cache: "miss" });
		expect(render).toHaveBeenCalledTimes(2);
	});

	it("登录读者的页面每次单独渲染，不存也不读游客的副本", async () => {
		const { open } = setup();
		await open("/blog/a");
		const session = withCookie("appearance=dark; violet_session=abc");
		expect(await open("/blog/a", session)).toMatchObject({
			body: "渲染 2",
			cache: null,
			cacheControl: "private, no-store",
		});
		expect(await open("/blog/a", session)).toMatchObject({ body: "渲染 3", cache: null });
		// 登录读者渲染出的页面没有流进游客的副本
		expect(await open("/blog/a")).toMatchObject({ body: "渲染 1", cache: "hit" });
	});

	it("外观偏好不同的游客各有一份，偏好相同的共用", async () => {
		const { open } = setup();
		expect(await open("/blog/a")).toMatchObject({ body: "渲染 1" });
		expect(await open("/blog/a", withCookie("appearance=dark"))).toMatchObject({
			body: "渲染 2",
			cache: "miss",
		});
		expect(await open("/blog/a", withCookie("violet_csrf=t; appearance=dark"))).toMatchObject({
			body: "渲染 2",
			cache: "hit",
		});
	});

	it("名单外的路径、带查询串的地址与非 GET 请求不经过缓存", async () => {
		const { open, render } = setup();
		for (const [path, init] of [
			["/about", {}],
			["/blog/a?comment=7", {}],
			["/blog/a", { method: "POST" }],
		] as const) {
			expect(await open(path, init)).toMatchObject({ cache: null });
			expect(await open(path, init)).toMatchObject({ cache: null });
		}
		expect(render).toHaveBeenCalledTimes(6);
	});
});

describe("缓存副本的安全与新鲜度", () => {
	it("过期后重新渲染并让更新后的文章在新鲜期内可见", async () => {
		const { clock, open, render } = setup();
		await open("/blog/a");
		clock.now = TTL - 1;
		expect(await open("/blog/a")).toMatchObject({ body: "渲染 1", cache: "hit" });
		clock.now = TTL;
		expect(await open("/blog/a")).toMatchObject({ body: "渲染 2", cache: "miss" });
		expect(render).toHaveBeenCalledTimes(2);
	});

	it("过期重渲染失败时返回旧版，超过故障容忍期则交付错误", async () => {
		const { clock, open, render } = setup();
		await open("/blog/a");
		clock.now = TTL;
		render.mockRejectedValueOnce(new Error("API down"));
		expect(await open("/blog/a")).toMatchObject({ body: "渲染 1", cache: "stale" });
		clock.now = TTL + STALE_IF_ERROR;
		render.mockImplementationOnce(async () => page("暂时不可用", { status: 503 }));
		expect(await open("/blog/a")).toMatchObject({
			body: "暂时不可用",
			status: 503,
			cache: null,
		});
	});

	it("带 Set-Cookie 的响应不留副本，随后无 cookie 的响应仍需重新渲染", async () => {
		const { open, render } = setup();
		render.mockImplementationOnce(async () =>
			page("迁移偏好", { headers: { "set-cookie": "appearance=dark; Path=/" } }),
		);
		expect(await open("/blog/a")).toMatchObject({
			body: "迁移偏好",
			cache: null,
			cacheControl: "private, no-store",
		});
		expect(await open("/blog/a")).toMatchObject({ body: "渲染 2", cache: "miss" });
	});

	it("Authorization 请求、响应禁止共享时不读写副本", async () => {
		const { open, render, clock } = setup();
		await open("/blog/a");
		expect(
			await open("/blog/a", { headers: { authorization: "Bearer secret" } }),
		).toMatchObject({ body: "渲染 2", cache: null });
		render.mockImplementationOnce(async () =>
			page("不可共享", { headers: { "cache-control": "private, no-store" } }),
		);
		clock.now = TTL;
		expect(await open("/blog/a")).toMatchObject({ body: "不可共享", cache: null });
		expect(await open("/blog/a")).toMatchObject({ body: "渲染 4", cache: "miss" });
	});

	it("数据仍在流动时不命中；流中断不存入残缺页面", async () => {
		const { open, render } = setup();
		render.mockImplementationOnce(async () => {
			const body = new ReadableStream({
				start(controller) {
					controller.enqueue(new TextEncoder().encode("前半截"));
					controller.error(new Error("断流"));
				},
			});
			return page(body);
		});
		await expect(open("/blog/a")).rejects.toThrow("断流");
		expect(await open("/blog/a")).toMatchObject({ body: "渲染 2", cache: "miss" });
	});

	it("旧副本过期后即使新 HTML 传了一半才断流，也回退到完整旧页", async () => {
		const { clock, open, render } = setup();
		await open("/blog/a");
		clock.now = TTL;
		render.mockImplementationOnce(async () =>
			page(
				new ReadableStream({
					start(controller) {
						controller.enqueue(new TextEncoder().encode("新版的前半截"));
						controller.error(new Error("stream aborted"));
					},
				}),
			),
		);
		expect(await open("/blog/a")).toMatchObject({ body: "渲染 1", cache: "stale" });
	});

	it("容量超限时淘汰最久没访问的副本；大于容量的页面不保存", async () => {
		const { open } = setup(12);
		await open("/blog/a");
		await open("/blog/b");
		expect(await open("/blog/a")).toMatchObject({ cache: "miss" });
		const large = setup(1);
		await large.open("/blog/a");
		expect(await large.open("/blog/a")).toMatchObject({ cache: "miss" });
	});
});
