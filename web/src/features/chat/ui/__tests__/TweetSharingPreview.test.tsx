/** 分享预览：不出站导航，二级引用只留一行说明。 */
import type { Tweet } from "@entities/tweet/model/types";
import { ApiError } from "@shared/api/error";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const query = vi.hoisted(() => ({
	data: null as Tweet | null,
	isPending: false,
	isFetching: false,
	isError: false,
	error: null as Error | null,
}));

vi.mock("@entities/tweet/api/queries", () => ({
	useSharedTweet: () => query,
}));

import { TweetSharingPreview } from "../TweetSharingPreview";

function makeTweet(overrides: Partial<Tweet> = {}): Tweet {
	return {
		id: "t1",
		author: { id: "u-author", username: "author", avatar_url: "" },
		content: "分享的正文",
		images: [],
		like_count: 0,
		is_liked: false,
		comment_count: 0,
		quote_count: 0,
		created_at: "2026-01-01T00:00:00Z",
		link_cards: [],
		...overrides,
	};
}

describe("TweetSharingPreview", () => {
	afterEach(() => {
		cleanup();
		query.data = null;
		query.isError = false;
		query.error = null;
	});

	it("预览只展示内容，不生成导航链接", () => {
		query.data = makeTweet();
		render(<TweetSharingPreview id="t1" />);
		expect(screen.getByText("author")).toBeTruthy();
		expect(screen.getByText("分享的正文")).toBeTruthy();
		expect(screen.queryByRole("link")).toBeNull();
	});

	it("多张图片只留第一张缩略图", () => {
		query.data = makeTweet({
			images: [
				{ url: "/uploads/a.png", width: null, height: null },
				{ url: "/uploads/b.png", width: null, height: null },
			],
		});
		const { container } = render(<TweetSharingPreview id="t1" />);
		expect(container.querySelectorAll(".v-quote-card__image")).toHaveLength(1);
	});

	it("二级引用只写一行提示", () => {
		query.data = makeTweet({
			quoted_tweet: {
				id: "q1",
				author: { id: "u-quoted", username: "quoted", avatar_url: "" },
				content: "更早的正文",
				images: [],
				quote_count: 0,
				created_at: "2025-12-01T00:00:00Z",
				link_cards: [],
			},
		});
		render(<TweetSharingPreview id="t1" />);
		expect(screen.getByText("引用了一条推文")).toBeTruthy();
		expect(screen.queryByText("更早的正文")).toBeNull();
	});

	it("下一层目标已删除仍保留当前卡作者、时间与引用关系", () => {
		query.data = makeTweet({ quote_of: "q1" });
		const { container } = render(<TweetSharingPreview id="t1" />);
		expect(screen.getByText("author")).toBeTruthy();
		expect(screen.getByText("分享的正文")).toBeTruthy();
		expect(container.querySelector("time")).not.toBeNull();
		expect(container.querySelector(".v-quote-card__nested")).not.toBeNull();
		expect(screen.queryByRole("link")).toBeNull();
	});

	it("当前推文读取为 404 时只保留不可点的删除态", () => {
		query.data = makeTweet();
		query.isError = true;
		query.error = new ApiError({ error: "NOT_FOUND", message: "已删除", status: 404 });
		const { container } = render(<TweetSharingPreview id="t1" />);
		expect(screen.queryByText("author")).toBeNull();
		expect(screen.queryByText("分享的正文")).toBeNull();
		expect(screen.queryByRole("link")).toBeNull();
		expect(screen.queryByRole("alert")).toBeNull();
		expect(container.querySelector("[data-state='deleted']")).not.toBeNull();
		expect(container.querySelector("time, img, button, [tabindex]")).toBeNull();
	});

	it("读取失败给出重试提示", () => {
		query.isError = true;
		render(<TweetSharingPreview id="t1" />);
		expect(screen.getByRole("alert").textContent).toContain("推文暂不可用");
	});
});
