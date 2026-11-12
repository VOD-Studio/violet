import { describe, expect, it } from "vitest";
import type { MentionCandidate } from "../mention";
import {
	filterMentionCandidates,
	MENTION_CANDIDATE_LIMIT,
	MENTION_QUERY_LIMIT,
	parseMentionTrigger,
} from "../mention-filter";

const PEOPLE: MentionCandidate[] = [
	{ id: "u1", username: "xunrua", displayName: "xunrua" },
	{ id: "u2", username: "linjian", displayName: "林间" },
	{ id: "u3", username: "saber", displayName: "Saber", isBot: true },
	{ id: "u4", username: "sam_s", displayName: "Sam" },
	{ id: "u5", username: "wuli", displayName: "雾里" },
	{ id: "u6", username: "momo", displayName: "Momo" },
	{ id: "u7", username: "xiaojing", displayName: "小径" },
];

const BROADCAST: MentionCandidate = {
	id: "all",
	username: "all",
	displayName: "全体成员",
	memberCount: 23,
};

describe("parseMentionTrigger", () => {
	it("在行首与空白之后触发，空格或第二个 @ 结束查询", () => {
		expect(parseMentionTrigger("@")).toEqual({ start: 0, end: 1, query: "" });
		expect(parseMentionTrigger("找 @林间")).toEqual({ start: 2, end: 5, query: "林间" });
		expect(parseMentionTrigger("找 @林间 落花")).toBeNull();
		expect(parseMentionTrigger("@a@b")).toBeNull();
	});

	it("只在词首触发，邮箱与句子中间不算", () => {
		expect(parseMentionTrigger("mail@example.com")).toBeNull();
		expect(parseMentionTrigger("a@b")).toBeNull();
	});

	it(`查询窗口是 ${MENTION_QUERY_LIMIT} 个字`, () => {
		const within = `@${"字".repeat(MENTION_QUERY_LIMIT)}`;
		expect(parseMentionTrigger(within)?.query).toHaveLength(MENTION_QUERY_LIMIT);
		expect(parseMentionTrigger(`@${"字".repeat(MENTION_QUERY_LIMIT + 1)}`)).toBeNull();
	});

	it("按光标位置解析，光标之后的文字不参与", () => {
		expect(parseMentionTrigger("@lin 后面还有", 4)).toEqual({ start: 0, end: 4, query: "lin" });
	});
});

describe("filterMentionCandidates", () => {
	it("显示名、用户名与拼音首字母都能匹配", () => {
		expect(filterMentionCandidates(PEOPLE, "林间").map((item) => item.id)).toEqual(["u2"]);
		expect(filterMentionCandidates(PEOPLE, "SAM").map((item) => item.id)).toEqual(["u4"]);
		expect(filterMentionCandidates(PEOPLE, "lj").map((item) => item.id)).toEqual(["u2"]);
		expect(filterMentionCandidates(PEOPLE, "wuli").map((item) => item.id)).toEqual(["u5"]);
	});

	it("空查询保留传入顺序，最多 6 条", () => {
		const matched = filterMentionCandidates(PEOPLE, "");
		expect(matched).toHaveLength(MENTION_CANDIDATE_LIMIT);
		expect(matched.map((item) => item.id)).toEqual(["u1", "u2", "u3", "u4", "u5", "u6"]);
	});

	it("全体成员置顶，且不会被上限挤掉", () => {
		const matched = filterMentionCandidates([...PEOPLE, BROADCAST], "");
		expect(matched[0]).toBe(BROADCAST);
		expect(matched).toHaveLength(MENTION_CANDIDATE_LIMIT);
	});

	it("人数也能筛到全体成员，其余候选按传入顺序", () => {
		expect(filterMentionCandidates([...PEOPLE, BROADCAST], "23")).toEqual([BROADCAST]);
		expect(
			filterMentionCandidates([...PEOPLE, BROADCAST], "全体").map((item) => item.id),
		).toEqual(["all"]);
		expect(
			filterMentionCandidates([...PEOPLE, BROADCAST], "sa").map((item) => item.id),
		).toEqual(["u3", "u4"]);
	});

	it("没有命中返回空数组", () => {
		expect(filterMentionCandidates(PEOPLE, "zzz")).toEqual([]);
	});
});
