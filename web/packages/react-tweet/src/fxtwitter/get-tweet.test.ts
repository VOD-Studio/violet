import { afterEach, describe, expect, it, vi } from "vitest";

import { parseTweetId } from "../data/urls.js";
import { getTweet } from "./get-tweet.js";

/** 字段形状取自实际 /status/20 响应；每个用例按行为覆盖特定字段。 */
function fixture(overrides: Record<string, unknown> = {}) {
	return {
		id: "20",
		url: "https://x.com/jack/status/20",
		text: "just setting up my twttr",
		raw_text: { text: "just setting up my twttr", display_text_range: [0, 24], facets: [] },
		author: {
			name: "jack",
			screen_name: "jack",
			protected: false,
			verification: { verified: true, type: "individual" },
		},
		created_timestamp: 1142974214,
		...overrides,
	};
}

function respond(tweet: unknown, code = 200) {
	const fetcher = vi.fn().mockResolvedValue(
		new Response(JSON.stringify({ code, tweet }), {
			status: 200,
			headers: { "content-type": "application/json" },
		}),
	);
	vi.stubGlobal("fetch", fetcher);
	return fetcher;
}

afterEach(() => vi.unstubAllGlobals());

describe("推文标识与请求边界", () => {
	it.each([
		["20", "20"],
		["https://x.com/jack/status/20", "20"],
		["https://twitter.com/jack/status/20?s=20", "20"],
		["https://x.com/i/web/status/20", "20"],
		["https://mobile.twitter.com/jack/status/20/photo/1", "20"],
		["0", null],
		["-20", null],
		["2e1", null],
		["20/../21", null],
		["https://x.com.evil.test/jack/status/20", null],
		["https://evil.test/jack/status/20", null],
		["https://user@x.com/jack/status/20", null],
		["javascript:alert(20)", null],
		["//x.com/jack/status/20", null],
		["/jack/status/20", null],
		["https://x.com:444/jack/status/20", null],
		["https://x.com\\evil.test/jack/status/20", null],
	])("解析 %s", (input, result) => expect(parseTweetId(input as string)).toBe(result));

	it("仅请求固定 JSON 接口并透传取消信号，不携带凭证或跟随重定向", async () => {
		const fetcher = respond(fixture());
		const controller = new AbortController();
		const result = await getTweet("https://x.com/jack/status/20", {
			signal: controller.signal,
		});
		expect(fetcher).toHaveBeenCalledWith("https://api.fxtwitter.com/status/20", {
			signal: controller.signal,
			credentials: "omit",
			redirect: "error",
			headers: { Accept: "application/json" },
		});
		expect(result).toMatchObject({
			availability: "available",
			snapshot: {
				text: "just setting up my twttr",
				author: { verification: "individual" },
				publishedAt: "2006-03-21T20:50:14.000Z",
			},
		});
		expect(result.snapshot?.metrics).toBeUndefined();
	});

	it.each([
		"business",
		"government",
		"individual",
	])("FxTwitter 明确认证类型 %s 不再降为布尔值", async (type) => {
		const tweet = fixture();
		tweet.author.verification.type = type;
		respond(tweet);
		expect((await getTweet("20")).snapshot?.author.verification).toBe(type);
	});

	it("未知 FxTwitter 认证类型不伪装成蓝标", async () => {
		const tweet = fixture();
		tweet.author.verification.type = "other";
		respond(tweet);
		expect((await getTweet("20")).snapshot?.author.verification).toBeUndefined();
	});

	it("非法标识在请求前拒绝", async () => {
		const fetcher = respond(fixture());
		await expect(getTweet("https://evil.test/status/20")).rejects.toThrow(TypeError);
		expect(fetcher).not.toHaveBeenCalled();
	});

	it.each([404, 401, 403])("不将含糊的 %i 错误伪造成删除或私密", async (code) => {
		respond(fixture(), code);
		expect(await getTweet("20")).toEqual({
			id: "20",
			url: "https://x.com/i/web/status/20",
			availability: "unavailable",
		});
	});

	it.each(["deleted", "private"])("明确 %s 状态丢弃残留正文", async (reason) => {
		respond(fixture({ type: "tombstone", reason }));
		const result = await getTweet("20");
		expect(result.availability).toBe(reason);
		expect(result.snapshot).toBeUndefined();
	});

	it("受保护作者不暴露残留正文", async () => {
		respond(fixture({ author: { protected: true }, quote: fixture({ id: "21" }) }));
		expect(await getTweet("20")).toEqual({
			id: "20",
			url: "https://x.com/i/web/status/20",
			availability: "private",
		});
	});

	it("协议错误和临时失败保留为可重试异常", async () => {
		respond(fixture(), 429);
		await expect(getTweet("20")).rejects.toThrow("429");
		respond(fixture({ id: "21" }));
		await expect(getTweet("20")).rejects.toThrow("invalid tweet");
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(
				new Response("<html>error</html>", {
					headers: { "content-type": "text/html" },
				}),
			),
		);
		await expect(getTweet("20")).rejects.toThrow("non-JSON");
	});
});

describe("真实协议形状的媒体与引用转换", () => {
	it("all 优先避免重复图片，原图与缩略图/视频源严格分离", async () => {
		const photo = {
			type: "photo",
			url: "https://pbs.twimg.com/media/sample.jpg?name=small",
			width: 1200,
			height: 800,
			altText: "照片",
		};
		respond(
			fixture({
				media: {
					all: [
						photo,
						{
							type: "video",
							url: "https://video.twimg.com/movie.mp4",
							thumbnail_url: "https://pbs.twimg.com/poster.jpg",
						},
						{ type: "gif", url: "https://video.twimg.com/loop.mp4" },
						{ type: "video", thumbnail_url: "https://pbs.twimg.com/only-poster.jpg" },
					],
					photos: [photo],
				},
				likes: 0,
			}),
		);
		const result = await getTweet("20");
		expect(result.snapshot?.media).toHaveLength(4);
		expect(result.snapshot?.media?.[0]).toMatchObject({
			kind: "photo",
			url: "https://pbs.twimg.com/media/sample.jpg?name=orig",
			alt: "照片",
		});
		expect(result.snapshot?.media?.[1]).toMatchObject({
			kind: "video",
			url: "https://video.twimg.com/movie.mp4",
			thumbnailUrl: "https://pbs.twimg.com/poster.jpg",
		});
		expect(result.snapshot?.media?.[2].kind).toBe("animated_gif");
		expect(result.snapshot?.media?.[3].url).toBeUndefined();
		expect(result.snapshot?.metrics).toEqual({ likes: 0 });
	});

	it("无 all 时合并媒体列表并过滤危险地址，图片地址不能伪装视频源", async () => {
		respond(
			fixture({
				media: {
					photos: [{ type: "photo", url: "data:image/svg+xml,bad" }],
					videos: [
						{
							type: "video",
							url: "https://pbs.twimg.com/poster.jpg",
							thumbnail_url: "https://pbs.twimg.com/poster.jpg",
						},
						{ type: "video", url: "javascript:alert(1)" },
					],
				},
			}),
		);
		const media = (await getTweet("20")).snapshot?.media;
		expect(media).toHaveLength(1);
		expect(media?.[0]).toMatchObject({
			kind: "video",
			thumbnailUrl: "https://pbs.twimg.com/poster.jpg",
		});
		expect(media?.[0].url).toBeUndefined();
	});

	it("只展开一层引用，更深保留原文链接；损坏引用不吞掉父正文", async () => {
		respond(fixture({ quote: fixture({ id: "21", quote: fixture({ id: "22" }) }) }));
		let result = await getTweet("20");
		expect(result.quotedTweet?.id).toBe("21");
		expect(result.quotedTweet?.quotedTweet).toBeUndefined();
		expect(result.quotedTweet?.snapshot?.quoteUrl).toBe("https://x.com/i/web/status/22");
		respond(fixture({ quote: { id: "21" } }));
		result = await getTweet("20");
		expect(result.availability).toBe("available");
		expect(result.quotedTweet?.availability).toBe("unavailable");
	});
});
