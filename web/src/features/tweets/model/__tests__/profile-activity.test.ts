import type { Tweet } from "@entities/tweet/model/types";
import { describe, expect, it } from "vitest";
import { summarizeActivity } from "../profile-activity";

const now = new Date("2026-10-10T00:00:00Z");
const day = 24 * 60 * 60 * 1000;

function tweet(id: string, ageDays: number, content = "", likes = 0): Tweet {
	return {
		id,
		author: { id: "u", username: "u", avatar_url: "" },
		content,
		images: [],
		like_count: likes,
		comment_count: 0,
		quote_count: 0,
		is_liked: false,
		created_at: new Date(now.getTime() - ageDays * day).toISOString(),
	};
}

describe("summarizeActivity", () => {
	it("没有推文时各项为零且没有最新时间", () => {
		expect(summarizeActivity([], false, now)).toEqual({
			latestAt: undefined,
			recentCount: 0,
			likeCount: 0,
			topics: [],
			partial: false,
		});
	});

	it("统计近 30 天条数与累计点赞，最新时间取第一条", () => {
		const tweets = [tweet("a", 1, "", 3), tweet("b", 29, "", 4), tweet("c", 31, "", 5)];
		const result = summarizeActivity(tweets, true, now);
		expect(result.recentCount).toBe(2);
		expect(result.likeCount).toBe(12);
		expect(result.latestAt).toBe(tweets[0].created_at);
		expect(result.partial).toBe(true);
	});

	it("话题按次数降序，同次数时更近出现的靠前，并限制数量", () => {
		const tweets = [
			tweet("a", 1, "今天 #摄影# 与 #旅行#"),
			tweet("b", 2, "#旅行# 继续 #美食#"),
			tweet("c", 3, "#摄影# #旅行#"),
		];
		const topics = summarizeActivity(tweets, false, now).topics;
		expect(topics.map((t) => t.tag)).toEqual(["旅行", "摄影", "美食"]);
		expect(topics.map((t) => t.count)).toEqual([3, 2, 1]);

		const many = [tweet("m", 1, Array.from({ length: 12 }, (_, i) => `#t${i}#`).join(" "))];
		expect(summarizeActivity(many, false, now).topics).toHaveLength(8);
	});

	it("空白话题不计入", () => {
		expect(summarizeActivity([tweet("a", 1, "# #")], false, now).topics).toEqual([]);
	});
});
