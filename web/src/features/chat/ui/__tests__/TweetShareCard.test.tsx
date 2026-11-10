import type { SharedTweet } from "@features/chat/model/types";
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

interface MockLinkProps {
	children: ReactNode;
	to?: string;
	params?: { username?: string; id?: string };
	"aria-label"?: string;
	className?: string;
}

vi.mock("@tanstack/react-router", () => ({
	Link: ({ children, to, params, ...props }: MockLinkProps) => (
		<a
			href={to?.replace("$username", params?.username ?? "").replace("$id", params?.id ?? "")}
			{...props}
		>
			{children}
		</a>
	),
}));

import { TweetShareCard } from "../TweetShareCard";

function makeSharedTweet(overrides: Partial<SharedTweet> = {}): SharedTweet {
	return {
		id: "tweet-1",
		author: { id: "u-author", username: "author", display_name: "Author", avatar_url: "" },
		content: "快来看这条推文",
		images: [],
		created_at: "2026-01-01T00:00:00Z",
		is_deleted: false,
		...overrides,
	};
}

describe("TweetShareCard — 分享的推文存在", () => {
	afterEach(() => cleanup());

	it("渲染作者、正文，整卡只有一处链接指向推文详情", () => {
		render(<TweetShareCard tweet={makeSharedTweet()} />);
		expect(screen.getByText("author")).toBeTruthy();
		expect(screen.getByText("快来看这条推文")).toBeTruthy();
		const links = screen.getAllByRole("link");
		expect(links).toHaveLength(2);
		const card = screen.getByRole("link", { name: "查看 author 的这条推文" });
		expect(card.getAttribute("href")).toBe("/tweets/tweet-1");
		expect(card.classList.contains("v-quote-card__link")).toBe(true);
	});

	it("作者是独立的站内链接，浮在整卡链接之外", () => {
		render(<TweetShareCard tweet={makeSharedTweet()} />);
		const authorLink = screen.getByRole("link", { name: "author" });
		expect(authorLink.getAttribute("href")).toBe("/users/author");
		expect(authorLink.classList.contains("v-quote-card__link")).toBe(false);
		expect(screen.getByRole("link", { name: "查看 author 的这条推文" })).toBeTruthy();
	});

	it("多张图片只留第一张缩略图，不再折叠成 +N", () => {
		const urls = ["a", "b", "c", "d"].map((n) => `/uploads/${n}.png`);
		const refs = urls.map((url) => ({ url, width: null, height: null }));
		const { container } = render(<TweetShareCard tweet={makeSharedTweet({ images: refs })} />);
		const thumbs = container.querySelectorAll(".v-quote-card__image");
		expect(thumbs).toHaveLength(1);
		expect(thumbs[0]?.getAttribute("src")).toContain("/uploads/a.png");
		expect(screen.queryByText(/^\+\d+$/)).toBeNull();
	});

	it("被分享的推文还引用了别的推文时只写一行提示", () => {
		const { container } = render(
			<TweetShareCard
				tweet={makeSharedTweet({
					quoted_tweet: {
						id: "q1",
						author: { id: "u-quoted", username: "quoted", avatar_url: "" },
						content: "更早的正文",
						images: [],
						quote_count: 0,
						created_at: "2025-12-01T00:00:00Z",
						link_cards: [],
					},
				})}
			/>,
		);
		expect(screen.getByText("引用了一条推文")).toBeTruthy();
		expect(container.querySelectorAll(".v-quote-card")).toHaveLength(1);
		expect(screen.queryByText("更早的正文")).toBeNull();
	});
});

describe("TweetShareCard — 分享的推文已删除", () => {
	afterEach(() => cleanup());

	it("渲染占位文案，不泄露任何原内容字段", () => {
		render(
			<TweetShareCard
				tweet={makeSharedTweet({
					is_deleted: true,
					author: undefined,
					content: undefined,
					images: undefined,
					created_at: undefined,
				})}
			/>,
		);
		expect(screen.getByText("原推文已删除")).toBeTruthy();
		expect(screen.queryByText("author")).toBeNull();
		expect(screen.queryByText("快来看这条推文")).toBeNull();
	});

	it("已删除占位不可点，也没有作者与时间", () => {
		const { container } = render(
			<TweetShareCard tweet={makeSharedTweet({ is_deleted: true, author: undefined })} />,
		);
		expect(screen.queryByRole("link")).toBeNull();
		expect(container.querySelector("img")).toBeNull();
		expect(container.querySelector("[tabindex]")).toBeNull();
		expect(container.querySelector("time")).toBeNull();
	});
});
