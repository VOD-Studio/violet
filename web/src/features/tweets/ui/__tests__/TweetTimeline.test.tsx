import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

let loggedIn = false;
const globalNext = vi.fn();
const topicNext = vi.fn();
const globalQuery = {
	data: { pages: [{ data: [{ id: "global-one" }] }, { data: [{ id: "global-two" }] }] },
	isLoading: false,
	isError: false,
	error: null,
	fetchNextPage: globalNext,
	hasNextPage: true,
	isFetchingNextPage: false,
};
const topicQuery = {
	...globalQuery,
	data: { pages: [{ data: [{ id: "topic-one" }] }] },
	fetchNextPage: topicNext,
};
vi.mock("@features/auth/api/queries", () => ({
	useMe: () => ({ data: loggedIn ? { id: "author" } : null }),
}));
vi.mock("@features/tweets/api/queries", () => ({
	useTimeline: () => globalQuery,
	useTopicTimeline: () => topicQuery,
}));
vi.mock("../TweetCard", () => ({
	default: ({ tweet }: { tweet: { id: string } }) => <article aria-label={`推文 ${tweet.id}`} />,
}));
vi.mock("../TweetComposer", () => ({ TweetComposer: () => <form aria-label="发布推文" /> }));

import { TweetTimeline } from "../TweetTimeline";

describe("公开推文信息流", () => {
	beforeEach(() => {
		loggedIn = false;
		globalQuery.isFetchingNextPage = false;
		vi.clearAllMocks();
	});

	it("匿名可阅读所有已加载页并继续加载，但没有发布入口", () => {
		render(<TweetTimeline />);
		expect(screen.queryByRole("form", { name: "发布推文" })).toBeNull();
		expect(screen.getAllByRole("article")).toHaveLength(2);
		fireEvent.click(screen.getByRole("button", { name: "加载更多" }));
		expect(globalNext).toHaveBeenCalledTimes(1);
		expect(topicNext).not.toHaveBeenCalled();
	});

	it("登录后发布器留在时间线内，加载更多期间不可重复请求", () => {
		loggedIn = true;
		globalQuery.isFetchingNextPage = true;
		render(<TweetTimeline />);
		expect(screen.getByRole("form", { name: "发布推文" })).toBeTruthy();
		const next = screen.getByRole("button", { name: "加载中…" });
		fireEvent.click(next);
		expect(globalNext).not.toHaveBeenCalled();
	});

	it("话题流展示话题推文并使用自己的下一页", () => {
		render(<TweetTimeline tag="开发" />);
		expect(screen.getByRole("article", { name: "推文 topic-one" })).toBeTruthy();
		expect(screen.getAllByRole("article")).toHaveLength(1);
		fireEvent.click(screen.getByRole("button", { name: "加载更多" }));
		expect(topicNext).toHaveBeenCalledTimes(1);
		expect(globalNext).not.toHaveBeenCalled();
	});
});
