import type { EmojiGroup } from "@entities/emoji/model/types";
import type { AggregatedReaction, CommentReactionResult } from "@entities/reaction/model/types";
import { authKeys } from "@features/auth/api/keys";
import { emojiKeys } from "@features/emojis/api/keys";
import { apiGet, apiPost } from "@shared/api/request";
import { useSessionStore } from "@shared/api/session";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { toast } from "sonner";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { commentKeys } from "../../api/keys";
import { CommentReactions } from "../CommentReactions";
import { ReactionProvider } from "../ReactionProvider";

vi.mock("@shared/api/request", () => ({
	apiGet: vi.fn(),
	apiPost: vi.fn(),
	apiDelete: vi.fn(),
	apiPatch: vi.fn(),
	apiGetPaged: vi.fn(),
}));

const original: AggregatedReaction = {
	emoji_id: 1,
	emoji_name: "赞",
	emoji_url: "/like.png",
	gif_url: "/like.gif",
	count: 2,
	self: false,
	recent_users: [{ id: "other", name: "小明" }],
};
const groups: EmojiGroup[] = [
	{
		id: 1,
		name: "默认",
		source: "system",
		sort_order: 0,
		is_enabled: true,
		type: 2,
		emojis: [{ id: 1, name: "赞", url: "/like.png", gif_url: "/like.gif" }],
	},
];
let qc: QueryClient;

beforeEach(() => {
	vi.clearAllMocks();
	qc = new QueryClient({
		defaultOptions: {
			queries: { retry: false, staleTime: Infinity },
			mutations: { retry: false },
		},
	});
	qc.setQueryData(authKeys.me(), { id: "me", display_name: "本人", username: "myself" });
	qc.setQueryData(emojiKeys.publicGroupList(), groups);
	useSessionStore.setState({ sessionActive: true });
});
afterEach(() => {
	cleanup();
	qc.clear();
	useSessionStore.setState({ sessionActive: false });
	localStorage.removeItem("violet:recent-emojis");
	vi.restoreAllMocks();
});

it("失败只恢复目标回应，保留另一评论成功更新与同评论其他回应；刷新完成前保持忙碌", async () => {
	const key = [...commentKeys.reactions(), "batch", ["c1", "c2"]];
	qc.setQueryData<CommentReactionResult[]>(key, [
		{ comment_id: "c1", reactions: [original] },
		{ comment_id: "c2", reactions: [original] },
	]);
	const { promise: write, reject: rejectWrite } = Promise.withResolvers<null>();
	const { promise: refresh, resolve: finishRefresh } =
		Promise.withResolvers<CommentReactionResult[]>();
	vi.mocked(apiPost).mockImplementation((path) => {
		if (path === "/comments/reactions/batch") {
			return refresh as never;
		}
		return write as never;
	});
	const error = vi.spyOn(toast, "error");
	render(
		<QueryClientProvider client={qc}>
			<ReactionProvider commentIds={["c1", "c2"]}>
				<section aria-label="第一条">
					<CommentReactions postId="p1" commentId="c1" isLoggedIn />
				</section>
				<section aria-label="第二条">
					<CommentReactions postId="p1" commentId="c2" isLoggedIn />
				</section>
			</ReactionProvider>
		</QueryClientProvider>,
	);
	const first = within(screen.getByRole("region", { name: "第一条" }));
	fireEvent.click(first.getByRole("button", { name: "赞，2 人" }));
	await first.findByRole("button", { name: "赞，3 人，你已回应" });
	const optimistic = qc.getQueryData<CommentReactionResult[]>(key)?.[0].reactions[0];
	expect(optimistic?.recent_users[0]).toEqual({ id: "me", name: "本人" });
	expect(
		first.getByRole("button", { name: "赞，3 人，你已回应" }).querySelector("img")?.src,
	).toContain("/like.gif");
	const otherReaction = { ...original, emoji_id: 2, emoji_name: "笑", count: 7 };
	act(() =>
		qc.setQueryData<CommentReactionResult[]>(key, (data) =>
			data?.map((item) => ({
				...item,
				reactions:
					item.comment_id === "c1"
						? [...item.reactions, otherReaction]
						: [{ ...original, count: 9 }],
			})),
		),
	);
	await act(async () => {
		rejectWrite(new Error("拒绝"));
	});
	await first.findByRole("button", { name: "赞，2 人" });
	expect(first.getByRole("button", { name: "笑，7 人" })).toBeTruthy();
	expect(
		within(screen.getByRole("region", { name: "第二条" })).getByRole("button", {
			name: "赞，9 人",
		}),
	).toBeTruthy();
	expect(error).toHaveBeenCalledWith("回应没有成功");
	expect(first.getByRole("button", { name: "赞，2 人" }).getAttribute("aria-disabled")).toBe(
		"true",
	);
	await act(async () => {
		finishRefresh(qc.getQueryData<CommentReactionResult[]>(key) ?? []);
	});
	await waitFor(() =>
		expect(
			first.getByRole("button", { name: "赞，2 人" }).getAttribute("aria-disabled"),
		).not.toBe("true"),
	);
});

it("访客没有添加入口，点已有回应只提示登录而不提交", async () => {
	qc.setQueryData(commentKeys.reactionList("c1"), [original]);
	const info = vi.spyOn(toast, "info");
	render(
		<QueryClientProvider client={qc}>
			<CommentReactions postId="p1" commentId="c1" />
		</QueryClientProvider>,
	);
	fireEvent.click(await screen.findByRole("button", { name: "赞，2 人" }));
	expect(info).toHaveBeenCalledWith("登录后可以回应");
	expect(screen.queryByRole("button", { name: "添加回应" })).toBeNull();
	expect(apiPost).not.toHaveBeenCalled();
	expect(apiGet).not.toHaveBeenCalled();
});

it("完整选择器新增回应立即携带本人名单和 GIF，失败移除新项且不退回快捷条", async () => {
	qc.setQueryData(commentKeys.reactionList("c1"), []);
	let rejectWrite!: (error: Error) => void;
	vi.mocked(apiPost).mockReturnValue(
		new Promise((_resolve, reject) => {
			rejectWrite = reject;
		}),
	);
	vi.mocked(apiGet).mockResolvedValue([]);
	render(
		<QueryClientProvider client={qc}>
			<CommentReactions postId="p1" commentId="c1" isLoggedIn />
		</QueryClientProvider>,
	);
	fireEvent.click(screen.getByRole("button", { name: "添加回应" }));
	fireEvent.click(await screen.findByRole("button", { name: "更多表情" }));
	const picker = await screen.findByRole("dialog", { name: "选择回应" });
	fireEvent.click(within(picker).getByRole("tab", { name: "默认" }));
	fireEvent.click(await within(picker).findByRole("option", { name: "赞" }));
	const added = await screen.findByRole("button", { name: "赞，1 人，你已回应" });
	expect(added.querySelector("img")?.src).toContain("/like.gif");
	expect(qc.getQueryData<AggregatedReaction[]>(commentKeys.reactionList("c1"))?.[0]).toEqual(
		expect.objectContaining({
			gif_url: "/like.gif",
			recent_users: [{ id: "me", name: "本人" }],
		}),
	);
	await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
	await act(async () => {
		rejectWrite(new Error("拒绝"));
	});
	await waitFor(() =>
		expect(screen.queryByRole("button", { name: "赞，1 人，你已回应" })).toBeNull(),
	);
	expect(screen.queryByRole("toolbar", { name: "常用回应" })).toBeNull();
});
