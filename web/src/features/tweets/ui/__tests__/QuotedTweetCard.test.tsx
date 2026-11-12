/** 引用卡三态在推文侧的契约：整卡一处链接、单张缩略图、删除态不可点。 */
import type { QuotedTweet, Tweet } from "@entities/tweet/model/types";
import { cleanup, render, screen } from "@testing-library/react";
import type { QuoteCardLinkProps } from "@violet/ui";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QuotedTweetCard } from "../QuotedTweetCard";
import { TweetDetailSources } from "../TweetDetailSources";

vi.mock("@tanstack/react-router", () => ({
	Link: ({
		children,
		to,
		params,
		...props
	}: Omit<QuoteCardLinkProps, "href"> & { to: string; params: { id: string } }) => (
		<a {...props} href={to.replace("$id", params.id)}>
			{children}
		</a>
	),
}));

function makeQuoted(overrides: Partial<QuotedTweet> = {}): QuotedTweet {
	return {
		id: "q1",
		author: { id: "u-quoted", username: "quoted", avatar_url: "" },
		content: "被引用的正文",
		images: [],
		quote_count: 0,
		created_at: "2026-11-01T02:00:00Z",
		link_cards: [],
		...overrides,
	};
}

function makeTweet(overrides: Partial<Tweet> = {}): Tweet {
	return {
		id: "t1",
		author: { id: "u-author", username: "author", avatar_url: "" },
		content: "转发了别人的推文",
		images: [],
		like_count: 0,
		is_liked: false,
		comment_count: 0,
		quote_count: 1,
		created_at: "2026-11-02T02:00:00Z",
		link_cards: [],
		...overrides,
	};
}

describe("QuotedTweetCard", () => {
	afterEach(() => cleanup());

	it("整卡只有一处链接，指向被引用的推文", () => {
		render(<QuotedTweetCard tweet={makeQuoted()} />);
		const links = screen.getAllByRole("link");
		expect(links).toHaveLength(1);
		expect(links[0]?.getAttribute("href")).toBe("/tweets/q1");
		expect(screen.getByText("quoted")).toBeTruthy();
		expect(screen.getByText("被引用的正文")).toBeTruthy();
	});

	it("多张图片只保留第一张缩略图，不再折叠成 +N", () => {
		const images = ["a", "b", "c"].map((name) => ({
			url: `/uploads/${name}.webp`,
			width: 800,
			height: 600,
		}));
		const { container } = render(<QuotedTweetCard tweet={makeQuoted({ images })} />);
		const thumbs = container.querySelectorAll(".v-quote-card__image");
		expect(thumbs).toHaveLength(1);
		expect(thumbs[0]?.getAttribute("src")).toContain("/uploads/a.webp");
		expect(screen.queryByText("+2")).toBeNull();
	});

	it("被引用推文自身还引用了 X 原文时只写一行提示", () => {
		render(
			<QuotedTweetCard
				tweet={makeQuoted({
					external_tweet: {
						id: "e1",
						source_id: "123",
						canonical_url: "https://x.com/i/status/123",
						snapshot_version: "1",
						availability: "deleted",
					},
				})}
			/>,
		);
		expect(screen.getByText("引用了一条推文")).toBeTruthy();
		expect(screen.getByRole("link", { name: /quoted/ })).toBeTruthy();
	});

	it("被引用推文有下一层引用时不展开更深内容，即使其目标已经删除", () => {
		const { container } = render(
			<QuotedTweetCard tweet={makeQuoted({ quote_of: "deleted-nested" })} />,
		);
		expect(screen.getAllByRole("link")).toHaveLength(1);
		expect(screen.getByText("被引用的正文")).toBeTruthy();
		expect(container.querySelector(".v-quote-card__nested")).not.toBeNull();
		expect(container.querySelectorAll("[data-slot='quote-card']")).toHaveLength(1);
	});
});

describe("TweetDetailSources — 被引用推文已删除", () => {
	afterEach(() => cleanup());

	it("只留一行说明，不可点也不显示作者", () => {
		const { container } = render(<TweetDetailSources tweet={makeTweet({ quote_of: "q1" })} />);
		expect(screen.getByText("原推文已删除")).toBeTruthy();
		expect(screen.queryByRole("link")).toBeNull();
		expect(container.querySelector("img")).toBeNull();
	});

	it("有引用数据时渲染引用卡本身", () => {
		render(<TweetDetailSources tweet={makeTweet({ quoted_tweet: makeQuoted() })} />);
		expect(screen.getByText("被引用的正文")).toBeTruthy();
		expect(screen.queryByText("原推文已删除")).toBeNull();
	});

	it("两类来源都没有时不渲染", () => {
		const { container } = render(<TweetDetailSources tweet={makeTweet()} />);
		expect(container.firstChild).toBeNull();
	});
});

describe("TweetDetailSources — X 原文", () => {
	afterEach(() => cleanup());

	it("外站原文仍走自己的渲染链，不被引用卡替代", () => {
		render(
			<TweetDetailSources
				tweet={makeTweet({
					external_tweet: {
						id: "e1",
						source_id: "123",
						canonical_url: "https://x.com/i/status/123",
						snapshot_version: "1",
						availability: "deleted",
					},
				})}
			/>,
		);
		expect(screen.getByText("这条推文已删除")).toBeTruthy();
		expect(screen.queryByText("原推文已删除")).toBeNull();
	});
});
