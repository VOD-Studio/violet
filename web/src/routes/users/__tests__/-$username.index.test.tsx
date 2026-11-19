import type { UserDTO } from "@entities/user/model/types";
import { publicActivityOptions } from "@features/profile/api/public-profile";
import type { PublicActivity, PublicProfile } from "@features/profile/model/public-profile";
import { ApiError } from "@shared/api/error";
import { apiGet, apiGetPaged, apiPatch } from "@shared/api/request";
import type { PagedResponse } from "@shared/api/types";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Route } from "../$username.index";

const navigate = vi.fn();
const createChat = vi.fn();
let viewer: Pick<UserDTO, "id" | "username" | "email"> | null = null;
vi.mock("@shared/api/request", () => ({
	apiGet: vi.fn(),
	apiGetPaged: vi.fn(),
	apiPatch: vi.fn(),
}));
vi.mock("@features/auth/api/queries", () => ({ useMe: () => ({ data: viewer }) }));
vi.mock("@features/chat/api/queries", () => ({
	useCreateChatConversation: () => ({ mutateAsync: createChat, isPending: false }),
}));
vi.mock("@features/profile/ui/ProfileCoverSection", () => ({
	ProfileCoverSection: () => <div>横幅编辑</div>,
}));
vi.mock("@tanstack/react-router", async () => ({
	...(await vi.importActual("@tanstack/react-router")),
	useNavigate: () => navigate,
	Link: ({
		children,
		to,
		params: _params,
		search: _search,
		resetScroll: _scroll,
		...props
	}: {
		to: string;
		children?: ReactNode;
		params?: unknown;
		search?: unknown;
		resetScroll?: boolean;
	} & AnchorHTMLAttributes<HTMLAnchorElement>) => (
		<a href={to} {...props}>
			{children}
		</a>
	),
}));

const profile: PublicProfile = {
	id: "alice-id",
	username: "alice",
	display_name: "Alice",
	avatar_url: "",
	cover_url: "",
	bio: "公开简介",
	created_at: "2026-01-01T00:00:00Z",
	location: "杭州",
	website: "https://example.com",
	public_reading_preferences: ["Go"],
	stats: {
		posts: 23,
		tweets: 31,
		comments: 42,
		annotations: 9,
		received_likes: 100,
		received_reactions: 7,
	},
	activity: {
		timezone: "UTC",
		start_date: "2026-05-18",
		end_date: "2026-11-18",
		total: 12,
		days: [
			{ date: "2026-11-17", count: 0 },
			{ date: "2026-11-18", count: 12 },
		],
	},
};
const activity: PublicActivity = {
	id: "a1",
	type: "annotation",
	title: "真实文章",
	body: "公开批注",
	selected_text: "原文选区",
	url: "/blog/real-post",
	cover_image: "",
	images: [],
	created_at: "2026-11-18T10:00:00Z",
};
const page: PagedResponse<PublicActivity> = {
	data: [activity],
	pagination: { limit: 20, has_more: true, next_cursor: "next-page" },
};

function wrapper(client: QueryClient) {
	return ({ children }: { children: ReactNode }) => (
		<QueryClientProvider client={client}>{children}</QueryClientProvider>
	);
}
function prepare(search: { tab?: "annotations" | "posts"; cursor?: string } = {}) {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	vi.mocked(apiGet).mockResolvedValue(profile);
	vi.mocked(apiGetPaged).mockResolvedValue(page);
	vi.spyOn(Route, "useParams").mockReturnValue({ username: "alice" });
	vi.spyOn(Route, "useSearch").mockReturnValue(search);
	vi.spyOn(Route, "useLoaderData").mockReturnValue({ profile, page });
	vi.spyOn(Route, "useNavigate").mockReturnValue(navigate);
	const Component = Route.options.component as React.ComponentType;
	render(<Component />, { wrapper: wrapper(client) });
	return client;
}

beforeEach(() => {
	vi.clearAllMocks();
	viewer = null;
});

describe("公开主页", () => {
	it("直接访问分类和游标时预取同一份可水合数据，并保留真正的 404", async () => {
		const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
		vi.mocked(apiGet).mockResolvedValue(profile);
		vi.mocked(apiGetPaged).mockResolvedValue(page);
		const loader = Route.options.loader as (args: {
			context: { queryClient: QueryClient };
			params: { username: string };
			deps: { tab: "annotations"; cursor: string };
		}) => Promise<{ profile: PublicProfile; page: PagedResponse<PublicActivity> }>;
		const loaded = await loader({
			context: { queryClient: client },
			params: { username: "alice" },
			deps: { tab: "annotations", cursor: "previous-page" },
		});
		expect(loaded.page.data[0].selected_text).toBe("原文选区");
		expect(
			client.getQueryData(
				publicActivityOptions("alice", "annotations", "previous-page").queryKey,
			),
		).toEqual(page);
		expect(apiGetPaged).toHaveBeenCalledWith(
			"/users/alice/activity",
			expect.objectContaining({
				params: { tab: "annotations", cursor: "previous-page", limit: 20 },
			}),
		);
		client.clear();
		vi.mocked(apiGet).mockRejectedValue(
			new ApiError({ status: 404, error: "NOT_FOUND", message: "已注销" }),
		);
		await expect(
			loader({
				context: { queryClient: client },
				params: { username: "alice" },
				deps: { tab: "annotations", cursor: "" },
			}),
		).rejects.toMatchObject({ isNotFound: true });
	});

	it("匿名只看到公开资料和全量统计，批注保留选区与来源，分类切换保留滚动", async () => {
		prepare({ tab: "annotations" });
		expect(await screen.findByText("Alice")).toBeTruthy();
		expect(screen.getByText("原文选区")).toBeTruthy();
		expect(screen.getByText("真实文章").closest("a")?.getAttribute("href")).toBe("/blog/$slug");
		expect(screen.getByText("100")).toBeTruthy();
		expect(screen.queryByRole("button", { name: "更换横幅" })).toBeNull();
		expect(screen.queryByText("编辑公开偏好")).toBeNull();
		fireEvent.mouseDown(screen.getByRole("tab", { name: /文章/ }), { button: 0 });
		expect(navigate).toHaveBeenCalledWith({ search: { tab: "posts" }, resetScroll: false });
		const originalURL = window.location.href;
		const target = "/users/alice?tab=annotations#activity";
		window.history.replaceState(null, "", target);
		try {
			fireEvent.click(screen.getByRole("button", { name: "私信" }));
			expect(navigate).toHaveBeenCalledWith({ to: "/login", search: { redirect: target } });
		} finally {
			window.history.replaceState(null, "", originalURL);
		}
	});

	it("本人可清除明确公开的偏好，并显示横幅编辑入口", async () => {
		viewer = { id: profile.id, username: profile.username, email: "private@example.com" };
		vi.mocked(apiPatch).mockResolvedValue({ ...viewer, public_reading_preferences: [] });
		prepare();
		expect(screen.getByRole("button", { name: "更换横幅" })).toBeTruthy();
		expect(screen.queryByRole("button", { name: "私信" })).toBeNull();
		fireEvent.click(screen.getByRole("button", { name: "编辑公开偏好" }));
		fireEvent.change(screen.getByRole("textbox", { name: "常读主题" }), {
			target: { value: "" },
		});
		fireEvent.click(screen.getByRole("button", { name: "保存公开资料" }));
		await waitFor(() =>
			expect(apiPatch).toHaveBeenCalledWith("/auth/profile", {
				location: "杭州",
				website: "https://example.com",
				public_reading_preferences: [],
			}),
		);
		expect(screen.queryByText("private@example.com")).toBeNull();
	});
});
