import type { QuotedTweet } from "@entities/tweet/model/types";
import { TweetShareCard } from "@features/chat/ui/TweetShareCard";
import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	RouterProvider,
} from "@tanstack/react-router";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { QuotedTweetCard } from "../QuotedTweetCard";

const tweet: QuotedTweet = {
	id: "quoted-target",
	author: { id: "quoted-author", username: "quoted", avatar_url: "" },
	content: "用于导航验收的原文摘要",
	images: [],
	quote_count: 0,
	created_at: "2026-11-01T00:00:00Z",
	link_cards: [],
};

describe("引用卡原文路由", () => {
	afterEach(() => cleanup());

	it.each(["tweet", "chat"])("%s 整卡唯一链接通过客户端路由打开原文", async (kind) => {
		const root = createRootRoute();
		const index = createRoute({
			getParentRoute: () => root,
			path: "/",
			component: () =>
				kind === "tweet" ? (
					<QuotedTweetCard tweet={tweet} />
				) : (
					<TweetShareCard
						tweet={{
							...tweet,
							author: { ...tweet.author, display_name: "Quoted author" },
							is_deleted: false,
						}}
					/>
				),
		});
		const detail = createRoute({
			getParentRoute: () => root,
			path: "/tweets/$id",
			component: () => <main aria-label="原文详情" />,
		});
		const router = createRouter({
			routeTree: root.addChildren([index, detail]),
			history: createMemoryHistory({ initialEntries: ["/"] }),
		});
		render(<RouterProvider router={router} />);
		await act(async () => router.load());
		const links = await screen.findAllByRole("link");
		expect(links).toHaveLength(1);
		expect(links[0]?.getAttribute("href")).toBe("/tweets/quoted-target");
		fireEvent.click(links[0]);
		await waitFor(() => expect(router.state.location.pathname).toBe("/tweets/quoted-target"));
		expect(await screen.findByRole("main", { name: "原文详情" })).toBeTruthy();
	});
});
