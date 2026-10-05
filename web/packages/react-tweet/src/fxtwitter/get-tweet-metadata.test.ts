import { afterEach, describe, expect, it, vi } from "vitest";

import { getTweet } from "./get-tweet.ts";

const fullText = `完整长文 😀 ${"保留全部正文。".repeat(80)}`;

function fxTweet(id = "20", authorId = "12") {
	return {
		id,
		text: fullText,
		author: {
			id: authorId,
			name: "jack",
			screen_name: "jack",
			verification: { verified: true, type: "individual" },
		},
		media: {
			all: [
				{ type: "photo", url: "https://pbs.twimg.com/media/one.jpg" },
				{ type: "photo", url: "https://pbs.twimg.com/media/two.jpg" },
			],
		},
	};
}

function officialTweet(id = "20", authorId = "12") {
	return {
		__typename: "Tweet",
		id_str: id,
		text: "不采用这段被截断的正文",
		user: {
			id_str: authorId,
			screen_name: "jack",
			is_blue_verified: true,
			highlighted_label: {
				badge: { url: "https://pbs.twimg.com/profile_images/square.jpg" },
				description: "Square",
				url: { url: "https://twitter.com/Square" },
				user_label_type: "BusinessLabel",
				user_label_display_type: "Badge",
			},
		},
	};
}

function respond(tweet: unknown, official: unknown = officialTweet()) {
	const fetcher = vi
		.fn()
		.mockImplementation(
			async (url: string) =>
				new Response(
					JSON.stringify(
						url.startsWith("https://api.fxtwitter.com/")
							? { code: 200, tweet }
							: official,
					),
					{ headers: { "content-type": "application/json" } },
				),
		);
	vi.stubGlobal("fetch", fetcher);
	return fetcher;
}

afterEach(() => vi.unstubAllGlobals());

describe("FxTwitter 正文与官方作者元数据组合", () => {
	it("服务端默认补组织关联但保留完整 Unicode 正文与媒体顺序", async () => {
		const fetcher = respond(fxTweet());
		const controller = new AbortController();
		const result = await getTweet("20", { signal: controller.signal });
		expect(fetcher).toHaveBeenCalledTimes(2);
		expect(result.snapshot?.text).toBe(fullText);
		expect(result.snapshot?.media?.map((media) => media.url)).toEqual([
			"https://pbs.twimg.com/media/one.jpg?name=orig",
			"https://pbs.twimg.com/media/two.jpg?name=orig",
		]);
		expect(result.snapshot?.author.affiliation).toMatchObject({ name: "Square" });
		expect(fetcher.mock.calls[1][1].signal).toBe(controller.signal);
	});

	it.each([
		["organization", "business"],
		["business", "business"],
		["government", "government"],
		["individual", "individual"],
	])("FxTwitter 认证 %s 映射为 %s", async (type, expected) => {
		const tweet = fxTweet();
		tweet.author.verification.type = type;
		respond(tweet, {});
		expect((await getTweet("20")).snapshot?.author.verification).toBe(expected);
	});

	it("未知 FxTwitter 认证类型不伪装成蓝标", async () => {
		const tweet = fxTweet();
		tweet.author.verification.type = "other";
		respond(tweet, {});
		expect((await getTweet("20")).snapshot?.author.verification).toBeUndefined();
	});

	it.each([
		{ ...fxTweet(), type: "tombstone", reason: "private" },
		{ ...fxTweet(), type: "tombstone", reason: "deleted" },
		{ ...fxTweet(), author: { ...fxTweet().author, protected: true } },
	])("私密或删除状态不调用官方来源补回残留内容", async (tweet) => {
		const fetcher = respond(tweet);
		const result = await getTweet("20");
		expect(result.snapshot).toBeUndefined();
		expect(fetcher).toHaveBeenCalledTimes(1);
	});

	it.each([
		[{ __typename: "TweetTombstone" }, "unavailable"],
		[{ ...officialTweet(), user: { ...officialTweet().user, protected: true } }, "private"],
		[
			{
				...officialTweet(),
				user: { ...officialTweet().user, screen_name: "renamed", protected: true },
			},
			"private",
		],
	] as const)("官方明确不可用时丢弃 FxTwitter 的旧正文与引用", async (official, availability) => {
		const fetcher = respond({ ...fxTweet(), quote: fxTweet("21") }, official);
		const result = await getTweet("20");
		expect(result.availability).toBe(availability);
		expect(result.snapshot).toBeUndefined();
		expect(result.quotedTweet).toBeUndefined();
		expect(fetcher).toHaveBeenCalledTimes(2);
	});

	it("公开引用独立校验作者身份，私密引用不会补全", async () => {
		const fetcher = respond({ ...fxTweet(), quote: fxTweet("21", "13") });
		fetcher.mockImplementation(async (url: string) => {
			const data = url.startsWith("https://api.fxtwitter.com/")
				? { code: 200, tweet: { ...fxTweet(), quote: fxTweet("21", "13") } }
				: new URL(url).searchParams.get("id") === "21"
					? officialTweet("21", "13")
					: officialTweet();
			return new Response(JSON.stringify(data), {
				headers: { "content-type": "application/json" },
			});
		});
		const result = await getTweet("20");
		expect(result.quotedTweet?.snapshot?.author.affiliation).toMatchObject({ name: "Square" });
		expect(result.quotedTweet?.snapshot?.text).toBe(fullText);
		expect(fetcher).toHaveBeenCalledTimes(3);

		const privateFetcher = respond({
			...fxTweet(),
			quote: { ...fxTweet("21"), type: "tombstone", reason: "private" },
		});
		const withPrivateQuote = await getTweet("20");
		expect(withPrivateQuote.quotedTweet?.availability).toBe("private");
		expect(withPrivateQuote.quotedTweet?.snapshot).toBeUndefined();
		expect(privateFetcher).toHaveBeenCalledTimes(2);
	});

	it("官方身份不匹配不改写 FxTwitter 的作者、正文与认证", async () => {
		respond(fxTweet(), officialTweet("20", "99"));
		const result = await getTweet("20");
		expect(result.snapshot?.text).toBe(fullText);
		expect(result.snapshot?.author).toMatchObject({
			handle: "jack",
			verification: "individual",
		});
		expect(result.snapshot?.author.affiliation).toBeUndefined();
	});
});
