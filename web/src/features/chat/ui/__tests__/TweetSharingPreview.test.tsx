/** 分享预览：不出站导航，二级引用只留一行说明。 */
import type { Tweet } from "@entities/tweet/model/types";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const query = vi.hoisted(() => ({
	data: null as Tweet | null,
	isPending: false,
	isFetching: false,
	isError: false,
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

	it("被引用的推文已删除时写明删除，不显示作者与时间", () => {
		query.data = makeTweet({ quote_of: "q1" });
		render(<TweetSharingPreview id="t1" />);
		expect(screen.getByText("原推文已删除")).toBeTruthy();
	});

	it("读取失败给出重试提示", () => {
		query.isError = true;
		render(<TweetSharingPreview id="t1" />);
		expect(screen.getByRole("alert").textContent).toContain("推文暂不可用");
	});
});
