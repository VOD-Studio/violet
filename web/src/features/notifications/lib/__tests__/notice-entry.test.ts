import type { NotificationItem } from "@shared/api/notifications";
import { Megaphone } from "lucide-react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toNoticeEntry } from "../notice-entry";

const BASE: NotificationItem = {
	id: "n1",
	source_type: "comment_created",
	source_id: "s1",
	title: "xx 评论了你的文章",
	body: "旧正文",
	payload: {},
	is_read: false,
	created_at: "2026-11-09T09:00:00+08:00",
};

describe("toNoticeEntry", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-11-09T10:00:00+08:00"));
	});
	afterEach(() => vi.useRealTimers());

	it("有行为人时：谁、做了什么、对哪条内容，再引用一行原文", () => {
		const entry = toNoticeEntry({
			...BASE,
			actor: { name: "林间", avatar_url: "/a.png" },
			object_title: "拆解 Saber",
			quote: "二十行是乐观估计吧",
		});
		expect(entry.actor).toEqual({ name: "林间", avatar: "/a.png" });
		expect(entry.text).toBe("评论了你的文章《拆解 Saber》");
		expect(entry.quote).toBe("二十行是乐观估计吧");
	});

	it("赞与引用没有原文时，被点赞的内容本身作为引用行", () => {
		const entry = toNoticeEntry({
			...BASE,
			source_type: "tweet_liked",
			actor: { name: "南山记" },
			object_title: "11 月 2 日 · 给博客加了季节",
		});
		expect(entry.text).toBe("赞了你的推文");
		expect(entry.quote).toBe("11 月 2 日 · 给博客加了季节");
	});

	it("旧通知没有结构化字段：整句取标题，引用行取旧正文", () => {
		const entry = toNoticeEntry(BASE);
		expect(entry.actor).toBeUndefined();
		expect(entry.text).toBe("xx 评论了你的文章");
		expect(entry.quote).toBe("旧正文");
	});

	it("系统通知保持标题原句，结构化原文优先于旧正文", () => {
		const entry = toNoticeEntry({
			...BASE,
			source_type: "announcement",
			title: "新公告：评论编辑器支持实时预览",
			quote: "下周起生效",
		});
		expect(entry.actor).toBeUndefined();
		expect(entry.text).toBe("新公告：评论编辑器支持实时预览");
		expect(entry.quote).toBe("下周起生效");
		expect(entry.icon).toBe(Megaphone);
	});

	it("评论审核结果用对象标题说清是哪条评论，缺对象标题时取标题原句", () => {
		const base = {
			...BASE,
			source_type: "comment_approved" as const,
			title: "你的评论已通过审核",
		};
		const withObject = toNoticeEntry({ ...base, object_title: "拆解 Saber", quote: "二十行" });
		expect(withObject.text).toBe("你在《拆解 Saber》下的评论已通过审核");
		expect(withObject.quote).toBe("二十行");
		expect(toNoticeEntry(base).text).toBe("你的评论已通过审核");
	});

	it("没有对象标题时，动作句不留空引号", () => {
		const entry = toNoticeEntry({
			...BASE,
			actor: { name: "林间" },
		});
		expect(entry.text).toBe("评论了你的文章");
	});

	it("已读状态与分组：当天归今天，其余归更早", () => {
		const today = toNoticeEntry({ ...BASE, is_read: true });
		const earlier = toNoticeEntry({
			...BASE,
			created_at: "2026-11-08T23:59:00+08:00",
		});
		expect(today.unread).toBe(false);
		expect(today.group).toBe("today");
		expect(earlier.unread).toBe(true);
		expect(earlier.group).toBe("earlier");
	});
});
