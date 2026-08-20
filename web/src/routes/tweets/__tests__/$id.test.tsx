import type { Tweet } from "@entities/tweet/model/types";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
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
			...props
		}: {
			children?: ReactNode;
			onClick?: () => void;
			to?: string;
			params?: { username?: string };
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
	comment_count: 2,
	quote_count: 0,
	is_liked: false,
	created_at: "2026-08-20T00:00:00Z",
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
		defaultOptions: { queries: { retry: false } },
	});
	return function Wrapper({ children }: { children: ReactNode }) {
		return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
	};
}

describe("/tweets/$id TweetDetailPage layout", () => {
	beforeEach(() => {
		mockTweetDetailResult = {
			data: mockTweet,
			isLoading: false,
			error: null,
		};
	});

	it("renders page content wrapped inside PageShell with vertical spacing", () => {
		const Component = Route.options.component;
		expect(Component).toBeDefined();
		if (!Component) return;

		// Mock Route.useParams & Route.useLoaderData
		vi.spyOn(Route, "useParams").mockReturnValue({ id: mockTweet.id });
		vi.spyOn(Route, "useLoaderData").mockReturnValue(mockTweet);

		const { container } = render(<Component />, { wrapper: createWrapper() });

		// Assert PageShell container exists (providing standard vertical padding & min-height)
		const pageShell = container.querySelector(".min-h-\\[calc\\(100dvh-4rem\\)\\]");
		expect(pageShell).not.toBeNull();
		expect(pageShell?.className).toContain("py-8");
		expect(pageShell?.className).toContain("md:py-12");
	});

	it("renders loading skeleton wrapped inside PageShell", () => {
		const Component = Route.options.component;
		expect(Component).toBeDefined();
		if (!Component) return;

		mockTweetDetailResult = {
			data: undefined,
			isLoading: true,
			error: null,
		};

		vi.spyOn(Route, "useParams").mockReturnValue({ id: mockTweet.id });
		vi.spyOn(Route, "useLoaderData").mockReturnValue(undefined);

		const { container } = render(<Component />, { wrapper: createWrapper() });

		const pageShell = container.querySelector(".min-h-\\[calc\\(100dvh-4rem\\)\\]");
		expect(pageShell).not.toBeNull();
	});

	it("renders empty state wrapped inside PageShell when tweet not found", () => {
		const Component = Route.options.component;
		expect(Component).toBeDefined();
		if (!Component) return;

		mockTweetDetailResult = {
			data: undefined,
			isLoading: false,
			error: new Error("Not found"),
		};

		vi.spyOn(Route, "useParams").mockReturnValue({ id: mockTweet.id });
		vi.spyOn(Route, "useLoaderData").mockReturnValue(undefined);

		const { container } = render(<Component />, { wrapper: createWrapper() });

		const pageShell = container.querySelector(".min-h-\\[calc\\(100dvh-4rem\\)\\]");
		expect(pageShell).not.toBeNull();
	});
});
