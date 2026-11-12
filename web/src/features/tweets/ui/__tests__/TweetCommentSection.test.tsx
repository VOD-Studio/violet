import type { TweetComment } from "@entities/tweet/model/types";
import { authKeys } from "@features/auth/api/keys";
import { emojiKeys } from "@features/emojis/api/keys";
import { apiGetPaged, apiPost } from "@shared/api/request";
import { useSessionStore } from "@shared/api/session";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	createMemoryHistory,
	createRootRoute,
	createRouter,
	RouterProvider,
} from "@tanstack/react-router";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { tweetKeys } from "../../api/keys";
import { TweetCommentSection } from "../TweetCommentSection";

vi.mock("@shared/api/request", () => ({
	apiGet: vi.fn(),
	apiGetPaged: vi.fn(),
	apiPost: vi.fn(),
	apiDelete: vi.fn(),
}));

afterEach(() => {
	cleanup();
	useSessionStore.setState({ sessionActive: false });
	vi.restoreAllMocks();
});

it("真实评论标题只显示一次数量，最热按钮切换真实请求和服务端顺序，不自动展开回复", async () => {
	const qc = new QueryClient({
		defaultOptions: { queries: { retry: false, staleTime: Infinity } },
	});
	qc.setQueryData(authKeys.me(), null);
	qc.setQueryData(emojiKeys.publicGroupList(), []);
	useSessionStore.setState({ sessionActive: false });
	const newest: TweetComment = {
		id: "new",
		tweet_id: "t1",
		author: { id: "u1", username: "alice", avatar_url: "" },
		body: "最新评论",
		pictures: [],
		depth: 0,
		replies_count: 2,
		created_at: "2026-11-12T12:00:00Z",
	};
	const hottest: TweetComment = {
		...newest,
		id: "hot",
		body: "最热评论",
		created_at: "2026-11-11T12:00:00Z",
	};
	vi.mocked(apiGetPaged).mockImplementation(
		(_path, options) =>
			Promise.resolve({
				data: options?.params.sort === "hot" ? [hottest, newest] : [newest, hottest],
				pagination: { page: 1, limit: 10, total: 2, total_pages: 1 },
			}) as never,
	);
	vi.mocked(apiPost).mockResolvedValue([
		{ comment_id: "new", reactions: [] },
		{ comment_id: "hot", reactions: [] },
	]);
	const routeTree = createRootRoute({ component: () => <TweetCommentSection tweetId="t1" /> });
	const router = createRouter({
		routeTree,
		history: createMemoryHistory({ initialEntries: ["/"] }),
	});
	render(
		<QueryClientProvider client={qc}>
			<RouterProvider router={router} />
		</QueryClientProvider>,
	);
	await screen.findByText("最新评论");
	expect(screen.getAllByText("评论", { exact: true })).toHaveLength(1);
	expect(screen.getAllByText("2", { exact: true })).toHaveLength(1);
	const before = screen.getAllByRole("article");
	expect(before[0].textContent).toContain("最新评论");
	fireEvent.click(screen.getByRole("radio", { name: "最热" }));
	await waitFor(() =>
		expect(screen.getAllByRole("article")[0].textContent).toContain("最热评论"),
	);
	expect(screen.getByRole("radio", { name: "最热" }).getAttribute("aria-checked")).toBe("true");
	expect(apiGetPaged).toHaveBeenCalledWith("/tweets/t1/comments", {
		params: { page: 1, limit: 10, sort: "hot" },
	});
	expect(vi.mocked(apiGetPaged).mock.calls.every(([path]) => !path.endsWith("/replies"))).toBe(
		true,
	);
	expect(qc.getQueryData(tweetKeys.commentListOf("t1", "latest"))).toBeDefined();
	expect(qc.getQueryData(tweetKeys.commentListOf("t1", "hot"))).toBeDefined();
	cleanup();
	qc.clear();
});
