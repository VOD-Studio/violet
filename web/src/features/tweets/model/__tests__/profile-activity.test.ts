import type { Tweet } from "@entities/tweet/model/types";
import { describe, expect, it } from "vitest";
import { buildActivityGrid, summarizeActivity } from "../profile-activity";

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

describe("buildActivityGrid", () => {
	// 2026-10-10 是周六；站点时区为 UTC+8。
	const today = new Date("2026-10-10T04:00:00Z");
	const at = (iso: string): Tweet => ({ ...tweet("x", 0), created_at: iso });

	it("网格共 weeks × 7 天，按周一到周日分列，最后一列是本周", () => {
		const grid = buildActivityGrid([], today, 12);
		expect(grid.days).toHaveLength(84);
		expect(grid.days[0].date).toBe("2026-07-20");
		expect(new Date(`${grid.days[0].date}T00:00:00Z`).getUTCDay()).toBe(1);
		// 本周周一是 10-05，本周最后一天（周日 10-11）晚于今天。
		const last = grid.days.slice(-7);
		expect(last[0].date).toBe("2026-10-05");
		expect(last.map((d) => d.future)).toEqual([false, false, false, false, false, false, true]);
		expect(last[5].date).toBe("2026-10-10");
	});

	it("按站点时区归到当天，且只统计窗口内", () => {
		const grid = buildActivityGrid(
			[
				// UTC 10-09 17:00 = 站点 10-10 01:00
				at("2026-10-09T17:00:00Z"),
				at("2026-10-10T01:00:00Z"),
				at("2026-10-09T10:00:00Z"),
				// 窗口之前
				at("2026-07-01T00:00:00Z"),
			],
			today,
		);
		const byDate = new Map(grid.days.map((d) => [d.date, d.count]));
		expect(byDate.get("2026-10-10")).toBe(2);
		expect(byDate.get("2026-10-09")).toBe(1);
		expect(grid.total).toBe(3);
	});

	it("无效时间被忽略，未来格子不计数", () => {
		const grid = buildActivityGrid([at("not-a-date"), at("2026-10-11T02:00:00Z")], today);
		expect(grid.total).toBe(0);
		expect(grid.days.at(-1)).toMatchObject({ date: "2026-10-11", future: true, count: 0 });
	});
});
