import type { Tweet } from "@entities/tweet/model/types";
import { describe, expect, it } from "vitest";
import { summarizeFeed } from "../feed-insights";

const author = (id: string) => ({ id, username: `u-${id}`, avatar_url: `/a/${id}.png` });

function tweet(over: Partial<Tweet> & { id: string }): Tweet {
	return {
		author: author("1"),
		content: "",
		images: [],
		like_count: 0,
		is_liked: false,
		comment_count: 0,
		quote_count: 0,
		created_at: "2026-10-11T00:00:00Z",
		...over,
	} as Tweet;
}

describe("summarizeFeed", () => {
	it("话题按次数排序，同次数时更近出现的靠前", () => {
		const { topics } = summarizeFeed([
			tweet({ id: "3", content: "#新#" }),
			tweet({ id: "2", content: "#热# #热#" }),
			tweet({ id: "1", content: "#旧#" }),
		]);
		expect(topics.map((t) => t.tag)).toEqual(["热", "新", "旧"]);
		expect(topics[0].count).toBe(2);
	});

	it("作者按发文数排序，带头像", () => {
		const { authors } = summarizeFeed([
			tweet({ id: "3", author: author("2") }),
			tweet({ id: "2", author: author("1") }),
			tweet({ id: "1", author: author("1") }),
		]);
		expect(authors.map((a) => [a.id, a.count])).toEqual([
			["1", 2],
			["2", 1],
		]);
		expect(authors[0].avatarUrl).toBe("/a/1.png");
	});

	it("图片取本站图片与 X 原文照片，视频不计入，最多 9 张且去重", () => {
		const external = {
			snapshot: {
				media: [
					{ kind: "photo", url: "/x/1.png", thumbnail_url: "/x/1-t.png" },
					{ kind: "video", url: "/x/v.png", thumbnail_url: "/x/v-t.png" },
				],
			},
		} as unknown as Tweet["external_tweet"];
		const { photos } = summarizeFeed([
			tweet({ id: "2", external_tweet: external }),
			tweet({
				id: "1",
				images: Array.from({ length: 12 }, (_, i) => ({
					url: `/uploads/${i}.png`,
					width: null,
					height: null,
				})),
			}),
		]);
		expect(photos).toHaveLength(9);
		expect(photos[0]).toEqual({ src: "/x/1-t.png", tweetId: "2" });
		expect(photos.some((p) => p.src.includes("v-t"))).toBe(false);
		expect(new Set(photos.map((p) => p.src)).size).toBe(9);
	});

	it("没有推文时返回空摘要", () => {
		expect(summarizeFeed([])).toEqual({ topics: [], authors: [], photos: [] });
	});
});
