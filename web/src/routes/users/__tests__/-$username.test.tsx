import type { Tweet } from "@entities/tweet/model/types";
import type { UserProfile } from "@entities/user/model/types";
import { useUserTimeline } from "@features/tweets/api/queries";
import type { PagedResponse } from "@shared/api/types";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Route } from "../$username";

vi.mock("@shared/api/request", () => ({
	apiGet: vi.fn(),
	apiGetPaged: vi.fn(),
}));

const mockNavigate = vi.fn();
vi.mock("@tanstack/react-router", async () => {
	const actual = await vi.importActual("@tanstack/react-router");
	return {
		...actual,
		useNavigate: () => mockNavigate,
		Link: ({
			children,
			to,
			...props
		}: { to: string; children?: ReactNode } & AnchorHTMLAttributes<HTMLAnchorElement>) => (
			<a href={to} {...props}>
				{children}
			</a>
		),
	};
});

vi.mock("@features/auth/api/queries", () => ({
	useMe: () => ({
		data: { id: "current_user_1", username: "tester" },
	}),
}));

const mockCreateChatMutateAsync = vi.fn();
vi.mock("@features/chat/api/queries", () => ({
	useCreateChatConversation: () => ({
		mutateAsync: mockCreateChatMutateAsync,
	}),
}));

import { apiGet, apiGetPaged } from "@shared/api/request";

function createWrapper(qc: QueryClient) {
	return function Wrapper({ children }: { children: ReactNode }) {
		return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
	};
}

describe("/users/$username Route.loader", () => {
	it("prefetches profile and timeline into QueryClient cache compatible with useUserTimeline", async () => {
		const qc = new QueryClient({
			defaultOptions: { queries: { retry: false } },
		});

		const mockProfile: UserProfile = {
			id: "u1",
			username: "大鸟哥",
			display_name: "大鸟哥",
			avatar_url: "",
			bio: "Hello bio",
			created_at: "2026-01-01T00:00:00Z",
		};
		const mockTimeline: PagedResponse<Tweet> = {
			data: [
				{
					id: "t1",
					author: { id: "u1", username: "大鸟哥", avatar_url: "" },
					content: "推文1",
					images: [],
					like_count: 5,
					comment_count: 1,
					quote_count: 0,
					is_liked: false,
					created_at: "2026-01-01T00:00:00Z",
				},
			],
			pagination: {
				has_more: false,
				limit: 20,
				next_cursor: undefined,
			},
		};

		vi.mocked(apiGet).mockResolvedValue(mockProfile);
		vi.mocked(apiGetPaged).mockResolvedValue(mockTimeline);

		const loaderFn = Route.options.loader as (args: {
			context: { queryClient: QueryClient };
			params: { username: string };
		}) => Promise<UserProfile>;
		const profile = await loaderFn({
			context: { queryClient: qc },
			params: { username: "大鸟哥" },
		});
		expect(profile).toEqual(mockProfile);

		const { result } = renderHook(() => useUserTimeline("大鸟哥"), {
			wrapper: createWrapper(qc),
		});

		expect(result.current.data?.pages[0].data[0].content).toBe("推文1");
	});
});

describe("UserPublicProfilePage rendering", () => {
	let qc: QueryClient;

	beforeEach(() => {
		qc = new QueryClient({
			defaultOptions: { queries: { retry: false } },
		});
		vi.clearAllMocks();
		Object.assign(navigator, {
			clipboard: {
				writeText: vi.fn().mockResolvedValue(undefined),
			},
		});
	});

	it("renders user profile bento card and empty state properly", async () => {
		const mockProfile: UserProfile = {
			id: "u2",
			username: "dfy",
			display_name: "DFY",
			avatar_url: "",
			bio: "前端工程师，热爱开源",
			created_at: "2026-08-01T00:00:00Z",
		};
		const mockTimeline: PagedResponse<Tweet> = {
			data: [],
			pagination: {
				has_more: false,
				limit: 20,
				next_cursor: undefined,
			},
		};

		vi.mocked(apiGet).mockResolvedValue(mockProfile);
		vi.mocked(apiGetPaged).mockResolvedValue(mockTimeline);
		vi.spyOn(Route, "useParams").mockReturnValue({ username: "dfy" });
		vi.spyOn(Route, "useLoaderData").mockReturnValue(mockProfile);

		const Component = Route.options.component as React.ComponentType;

		render(<Component />, {
			wrapper: createWrapper(qc),
		});
		expect(await screen.findByText("DFY")).toBeTruthy();
		expect(screen.getByText("@dfy")).toBeTruthy();
		expect(screen.getByText("前端工程师，热爱开源")).toBeTruthy();
		expect(await screen.findByText("静候发声")).toBeTruthy();
		expect(screen.getByText("发起私聊")).toBeTruthy();
		// 测试发起私聊跳转
		mockCreateChatMutateAsync.mockResolvedValueOnce({ id: "conv_123" });
		fireEvent.click(screen.getByRole("button", { name: /发起私聊/ }));

		await waitFor(() => {
			expect(mockCreateChatMutateAsync).toHaveBeenCalledWith({
				kind: "direct",
				participant_ids: ["u2"],
			});
			expect(mockNavigate).toHaveBeenCalledWith({
				to: "/chat",
				search: { c: "conv_123" },
			});
		});
	});

	it("supports media filter tab when tweets exist", async () => {
		const mockProfile: UserProfile = {
			id: "u3",
			username: "alice",
			display_name: "Alice",
			avatar_url: "",
			bio: "",
			created_at: "2026-01-01T00:00:00Z",
		};
		const mockTimeline: PagedResponse<Tweet> = {
			data: [
				{
					id: "t1",
					author: { id: "u3", username: "alice", avatar_url: "" },
					content: "普通纯文本推文",
					images: [],
					like_count: 2,
					comment_count: 0,
					quote_count: 0,
					is_liked: false,
					created_at: "2026-01-01T00:00:00Z",
				},
				{
					id: "t2",
					author: { id: "u3", username: "alice", avatar_url: "" },
					content: "带图摄影推文",
					images: ["/uploads/photo.jpg"],
					like_count: 8,
					comment_count: 1,
					quote_count: 0,
					is_liked: false,
					created_at: "2026-01-02T00:00:00Z",
				},
			],
			pagination: {
				has_more: false,
				limit: 20,
				next_cursor: undefined,
			},
		};

		vi.mocked(apiGet).mockResolvedValue(mockProfile);
		vi.mocked(apiGetPaged).mockResolvedValue(mockTimeline);
		vi.spyOn(Route, "useParams").mockReturnValue({ username: "alice" });

		const Component = Route.options.component as React.ComponentType;

		render(<Component />, {
			wrapper: createWrapper(qc),
		});

		expect(await screen.findByText("普通纯文本推文")).toBeTruthy();
		expect(screen.getByText("带图摄影推文")).toBeTruthy();

		// 切换到图文 Tab
		const mediaTab = screen.getByRole("button", { name: /图文/ });
		fireEvent.click(mediaTab);

		expect(screen.queryByText("普通纯文本推文")).toBeNull();
		expect(screen.getByText("带图摄影推文")).toBeTruthy();
	});
});
