import type { Tweet } from "@entities/tweet/model/types";
import { tweetDetailContextOptions } from "@features/tweets/api/detail-context";
import { ApiError } from "@shared/api/error";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Route } from "../$id";

// Mock router hooks on Route
vi.mock("@tanstack/react-router", async () => {
	const actual = await vi.importActual("@tanstack/react-router");
	return {
		...actual,
		useNavigate: () => vi.fn(),
		Link: ({
			children,
			onClick,
			to,
			params,
			hashScrollIntoView: _hashScrollIntoView,
			...props
		}: {
			children?: ReactNode;
			onClick?: () => void;
			to?: string;
			params?: { username?: string };
			hashScrollIntoView?: ScrollIntoViewOptions;
		} & ComponentPropsWithoutRef<"a">) => (
			<a
				href={to?.replace("$username", params?.username ?? "") ?? "#"}
				onClick={onClick}
				{...props}
			>
				{children}
			</a>
		),
	};
});

// Mock Tweet queries & mutations
const mockTweet: Tweet = {
	id: "3e0d081e-d6cd-4837-9620-30af5d17cb7d",
	author: { id: "u1", username: "xfy", avatar_url: "" },
	content: "测试推文内容",
	images: [],
	like_count: 0,
	view_count: 0,
	comment_count: 2,
	quote_count: 0,
	is_liked: false,
	created_at: "2026-08-20T00:00:00Z",
	link_cards: [],
};

let mockTweetDetailResult = {
	data: mockTweet as Tweet | undefined,
	isLoading: false,
	error: null as Error | null,
};

vi.mock("@features/tweets/api/queries", () => ({
	fetchTweetDetail: vi.fn(),
	useTweetDetail: () => mockTweetDetailResult,
	useTweetComments: () => ({
		data: {
			pages: [
				{
					data: [
						{
							id: "c1",
							author: { id: "u1", username: "xfy", avatar_url: "" },
							content: "123123",
							created_at: "2026-08-20T00:00:00Z",
						},
						{
							id: "c2",
							author: { id: "u1", username: "xfy", avatar_url: "" },
							content: "asdasd",
							created_at: "2026-08-20T00:00:00Z",
						},
					],
					pagination: { total: 2, limit: 10, offset: 0, has_more: false },
				},
			],
		},
		isLoading: false,
		fetchNextPage: vi.fn(),
		hasNextPage: false,
		isFetchingNextPage: false,
	}),
}));

vi.mock("@features/auth/api/queries", () => ({
	useMe: () => ({ data: { id: "u1", username: "xfy" } }),
}));

vi.mock("@features/auth/hooks/usePermissions", () => ({
	useHasPermission: () => false,
}));

vi.mock("@features/tweets/api/mutations", () => ({
	useDeleteTweet: () => ({ mutate: vi.fn(), isPending: false }),
	useDeleteTweetComment: () => ({ mutate: vi.fn(), isPending: false }),
	useCreateTweetComment: () => ({ mutate: vi.fn(), isPending: false }),
	useToggleLikeTweet: () => ({ mutate: vi.fn(), isPending: false }),
}));

function createWrapper() {
	const qc = new QueryClient({
		defaultOptions: { queries: { retry: false, staleTime: Infinity } },
	});
	qc.setQueryData(tweetDetailContextOptions(mockTweet.id).queryKey, {
		author: {
			username: "xfy",
			display_name: "",
			avatar_url: "",
			bio: "",
			tweet_count: 1,
			received_like_count: 0,
		},
		quotes: [],
	});
	return function Wrapper({ children }: { children: ReactNode }) {
		return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
	};
}

describe("推文详情", () => {
	beforeEach(() => {
		mockTweetDetailResult = {
			data: mockTweet,
			isLoading: false,
			error: null,
		};
		vi.spyOn(Route, "useSearch").mockReturnValue({});
	});

	it("后台刷新失败时保留已展示的推文", () => {
		const Component = Route.options.component;
		if (!Component) throw new Error("推文详情路由缺少页面");
		mockTweetDetailResult.error = ApiError.network();
		vi.spyOn(Route, "useParams").mockReturnValue({ id: mockTweet.id });
		vi.spyOn(Route, "useLoaderData").mockReturnValue(mockTweet);

		render(<Component />, { wrapper: createWrapper() });

		expect(screen.getByText("测试推文内容")).toBeTruthy();
		expect(screen.queryByText("推文不存在")).toBeNull();
	});
});
