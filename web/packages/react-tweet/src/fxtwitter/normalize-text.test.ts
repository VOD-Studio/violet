import { afterEach, expect, it, vi } from "vitest";

import { getTweet } from "./get-tweet.ts";

function respond(rawText: unknown, isNoteTweet = false) {
	vi.stubGlobal(
		"fetch",
		vi.fn().mockResolvedValue(
			new Response(
				JSON.stringify({
					code: 200,
					tweet: {
						id: "20",
						author: { name: "jack", screen_name: "jack" },
						raw_text: rawText,
						is_note_tweet: isNoteTweet,
					},
				}),
				{ headers: { "content-type": "application/json" } },
			),
		),
	);
}

afterEach(() => vi.unstubAllGlobals());

it("保留真实中文推文末尾的 emoji，不把显示范围误当作 UTF-16 索引", async () => {
	respond({
		text: "收回我这句话，slot 根本没法用，全是bug😇",
		display_text_range: [0, 24],
		facets: [],
	});
	expect((await getTweet("20")).snapshot?.text).toBe("收回我这句话，slot 根本没法用，全是bug😇");
});

it("普通推文的显示范围按码点换算，片段仍按 UTF-16 展开", async () => {
	respond({
		text: "中文😀 @jack https://t.co/link https://t.co/photo",
		display_text_range: [0, 46],
		facets: [
			{ type: "mention", indices: [5, 10] },
			{
				type: "url",
				indices: [11, 28],
				replacement: "https://example.com/story",
				display: "example.com/story",
			},
			{ type: "media", indices: [29, 47] },
		],
	});
	const result = await getTweet("20");
	expect(result.snapshot?.text).toBe("中文😀 @jack example.com/story");
	expect(result.snapshot?.segments).toContainEqual({
		kind: "mention",
		text: "@jack",
		url: "https://x.com/jack",
	});
});

it("长推文采用 UTF-16 显示范围和码点片段索引", async () => {
	respond(
		{
			text: "😀 @jack 链接",
			display_text_range: [0, 11],
			facets: [{ type: "mention", indices: [2, 7] }],
		},
		true,
	);
	const result = await getTweet("20");
	expect(result.snapshot?.text).toBe("😀 @jack 链接");
	expect(result.snapshot?.segments).toContainEqual({
		kind: "mention",
		text: "@jack",
		url: "https://x.com/jack",
	});
});

it("非法代理对边界拒绝，危险链接降为纯文本", async () => {
	respond({ text: "😀x", facets: [{ type: "url", indices: [1, 2] }] });
	await expect(getTweet("20")).rejects.toThrow("invalid facet");
	respond({
		text: "bad",
		facets: [{ type: "url", indices: [0, 3], replacement: "javascript:alert(1)" }],
	});
	expect((await getTweet("20")).snapshot?.segments).toEqual([{ kind: "text", text: "bad" }]);
});
