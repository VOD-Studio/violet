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

it("普通推文的显示范围与实体索引都按码点换算", async () => {
	respond({
		text: "中文😀 @jack https://t.co/link https://t.co/photo",
		display_text_range: [0, 46],
		facets: [
			{ type: "mention", indices: [4, 9] },
			{
				type: "url",
				indices: [10, 27],
				replacement: "https://example.com/story",
				display: "example.com/story",
			},
			{ type: "media", indices: [28, 46] },
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

it("正文中有 emoji 时不丢失紧邻媒体链接前的末尾字符", async () => {
	const text = "上传20张😍\n\nClaude小姐会一直看着你.JPG";
	const end = Array.from(text).length;
	respond({
		text: `${text} https://t.co/media`,
		display_text_range: [0, end],
		facets: [{ type: "media", indices: [end + 1, end + 19] }],
	});
	expect((await getTweet("20")).snapshot?.text).toBe(text);
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

it("越界实体拒绝，危险链接降为纯文本", async () => {
	respond({ text: "😀x", facets: [{ type: "url", indices: [1, 9] }] });
	await expect(getTweet("20")).rejects.toThrow("invalid facet");
	respond({
		text: "bad",
		facets: [{ type: "url", indices: [0, 3], replacement: "javascript:alert(1)" }],
	});
	expect((await getTweet("20")).snapshot?.segments).toEqual([{ kind: "text", text: "bad" }]);
});
