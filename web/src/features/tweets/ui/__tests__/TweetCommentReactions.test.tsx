import type { EmojiGroup } from "@entities/emoji/model/types";
import type { AggregatedReaction, CommentReactionResult } from "@entities/reaction/model/types";
import { authKeys } from "@features/auth/api/keys";
import { emojiKeys } from "@features/emojis/api/keys";
import { apiDelete, apiGet, apiGetPaged, apiPost } from "@shared/api/request";
import { useSessionStore } from "@shared/api/session";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { tweetKeys } from "../../api/keys";
import { useTweetComments } from "../../api/queries";
import { TweetCommentReactionProvider, TweetCommentReactions } from "../TweetCommentReactions";

vi.mock("@shared/api/request", () => ({
	apiGet: vi.fn(),
	apiPost: vi.fn(),
	apiDelete: vi.fn(),
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

function Root({ children }: { children: ReactNode }) {
	return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

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

it("同批评论等待一个批量请求，范围外才 GET；访客只能阅读和提示登录", async () => {
	useSessionStore.setState({ sessionActive: false });
	qc.setQueryData(authKeys.me(), null);
	const batch = Promise.withResolvers<CommentReactionResult[]>();
	vi.mocked(apiPost).mockReturnValue(batch.promise);
	vi.mocked(apiGet).mockResolvedValue([original]);
	const info = vi.spyOn(toast, "info");
	const { rerender } = render(
		<TweetCommentReactionProvider tweetId="t1" commentIds={["c2", "c1", "c1"]}>
			<TweetCommentReactions tweetId="t1" commentId="c1" isLoggedIn={false} />
			<TweetCommentReactions tweetId="t1" commentId="c2" isLoggedIn={false} />
		</TweetCommentReactionProvider>,
		{ wrapper: Root },
	);
	await waitFor(() => expect(apiPost).toHaveBeenCalledTimes(1));
	expect(apiPost).toHaveBeenCalledWith("/tweets/t1/comments/reactions/batch", {
		comment_ids: ["c1", "c2"],
	});
	expect(apiGet).not.toHaveBeenCalled();
	await act(async () =>
		batch.resolve([
			{ comment_id: "c1", reactions: [original] },
			{ comment_id: "c2", reactions: [] },
		]),
	);
	fireEvent.click(await screen.findByRole("button", { name: "赞，2 人" }));
	expect(info).toHaveBeenCalledWith("登录后可以回应");
	expect(screen.queryByRole("button", { name: "添加回应" })).toBeNull();
	expect(apiPost).toHaveBeenCalledTimes(1);
	expect(apiDelete).not.toHaveBeenCalled();
	rerender(
		<TweetCommentReactionProvider tweetId="t1" commentIds={["c1", "c2"]}>
			<TweetCommentReactions tweetId="t1" commentId="new-reply" isLoggedIn={false} />
		</TweetCommentReactionProvider>,
	);
	await screen.findByRole("button", { name: "赞，2 人" });
	expect(apiGet).toHaveBeenCalledTimes(1);
	expect(apiGet).toHaveBeenCalledWith("/tweets/t1/comments/new-reply/reactions");
});

function HotList() {
	const query = useTweetComments("t1", "hot");
	return <output>{query.data?.pages[0].pagination.total}</output>;
}

it("失败定点回滚保留并发成功、其它表情和新增评论；回应与 hot 刷新都结束才解除忙碌", async () => {
	const key = tweetKeys.commentReactionBatch("t1", ["c1", "c2"]);
	qc.setQueryData<CommentReactionResult[]>(key, [
		{ comment_id: "c1", reactions: [original] },
		{ comment_id: "c2", reactions: [original] },
	]);
	const page = { data: [], pagination: { page: 1, limit: 10, total: 0, total_pages: 1 } };
	qc.setQueryData(tweetKeys.commentListOf("t1", "hot"), { pages: [page], pageParams: [1] });
	const firstWrite = Promise.withResolvers<null>();
	const secondWrite = Promise.withResolvers<null>();
	const refresh = Promise.withResolvers<CommentReactionResult[]>();
	const hotRefresh = Promise.withResolvers<typeof page>();
	vi.mocked(apiPost).mockImplementation((path) => {
		if (path.endsWith("/batch")) {
			return refresh.promise as never;
		}
		if (path.includes("/c1/")) {
			return firstWrite.promise as never;
		}
		return secondWrite.promise as never;
	});
	vi.mocked(apiGetPaged).mockReturnValue(hotRefresh.promise);
	render(
		<>
			<HotList />
			<TweetCommentReactionProvider tweetId="t1" commentIds={["c1", "c2"]}>
				<section aria-label="第一条">
					<TweetCommentReactions tweetId="t1" commentId="c1" isLoggedIn />
				</section>
				<section aria-label="第二条">
					<TweetCommentReactions tweetId="t1" commentId="c2" isLoggedIn />
				</section>
			</TweetCommentReactionProvider>
		</>,
		{ wrapper: Root },
	);
	const first = within(screen.getByRole("region", { name: "第一条" }));
	const second = within(screen.getByRole("region", { name: "第二条" }));
	fireEvent.click(first.getByRole("button", { name: "赞，2 人" }));
	await first.findByRole("button", { name: "赞，3 人，你已回应" });
	fireEvent.click(second.getByRole("button", { name: "赞，2 人" }));
	await second.findByRole("button", { name: "赞，3 人，你已回应" });
	expect(qc.getQueryData<CommentReactionResult[]>(key)?.[0].reactions[0].recent_users[0]).toEqual(
		{
			id: "me",
			name: "本人",
		},
	);
	expect(
		first.getByRole("button", { name: "赞，3 人，你已回应" }).querySelector("img")?.src,
	).toContain("/like.gif");
	const extra = { ...original, emoji_id: 2, emoji_name: "笑", count: 7 };
	act(() => {
		qc.setQueryData<CommentReactionResult[]>(key, (data) => [
			...(data ?? []).map((entry) => {
				if (entry.comment_id === "c1") {
					return { ...entry, reactions: [...entry.reactions, extra] };
				}
				return entry;
			}),
			{ comment_id: "new", reactions: [extra] },
		]);
	});
	await act(async () => secondWrite.resolve(null));
	await waitFor(() => expect(apiGetPaged).toHaveBeenCalled());
	await act(async () => firstWrite.reject(new Error("拒绝")));
	await first.findByRole("button", { name: "赞，2 人" });
	expect(first.getByRole("button", { name: "笑，7 人" })).toBeTruthy();
	expect(second.getByRole("button", { name: "赞，3 人，你已回应" })).toBeTruthy();
	expect(
		qc.getQueryData<CommentReactionResult[]>(key)?.find((entry) => entry.comment_id === "new")
			?.reactions,
	).toEqual([extra]);
	expect(first.getByRole("button", { name: "赞，2 人" }).getAttribute("aria-disabled")).toBe(
		"true",
	);
	await act(async () => refresh.resolve(qc.getQueryData<CommentReactionResult[]>(key) ?? []));
	expect(first.getByRole("button", { name: "赞，2 人" }).getAttribute("aria-disabled")).toBe(
		"true",
	);
	await act(async () => hotRefresh.resolve(page));
	await waitFor(() =>
		expect(
			first.getByRole("button", { name: "赞，2 人" }).getAttribute("aria-disabled"),
		).not.toBe("true"),
	);
});

it("取消失败把原 GIF 与公开名单恢复在原位置，真实 DELETE 使用推文作用域", async () => {
	const key = tweetKeys.commentReactionList("t1", "c1");
	const mine = { ...original, count: 1, self: true, recent_users: [{ id: "me", name: "本人" }] };
	const other = { ...original, emoji_id: 2, emoji_name: "笑" };
	qc.setQueryData(key, [mine, other]);
	const write = Promise.withResolvers<null>();
	vi.mocked(apiDelete).mockReturnValue(write.promise);
	const refresh = Promise.withResolvers<AggregatedReaction[]>();
	vi.mocked(apiGet).mockReturnValue(refresh.promise);
	render(<TweetCommentReactions tweetId="t1" commentId="c1" isLoggedIn />, { wrapper: Root });
	fireEvent.click(screen.getByRole("button", { name: "赞，1 人，你已回应" }));
	await waitFor(() =>
		expect(screen.queryByRole("button", { name: "赞，1 人，你已回应" })).toBeNull(),
	);
	expect(apiDelete).toHaveBeenCalledWith("/tweets/t1/comments/c1/reactions/1");
	await act(async () => write.reject(new Error("拒绝")));
	await screen.findByRole("button", { name: "赞，1 人，你已回应" });
	expect(qc.getQueryData(key)).toEqual([mine, other]);
	await act(async () => refresh.resolve([mine, other]));
});

it("真实完整选择器新增携带 GIF 和本人名单，失败移除新项且使用公共最近记录", async () => {
	const key = tweetKeys.commentReactionList("t1", "c1");
	qc.setQueryData(key, []);
	const write = Promise.withResolvers<null>();
	vi.mocked(apiPost).mockReturnValue(write.promise);
	vi.mocked(apiGet).mockResolvedValue([]);
	render(<TweetCommentReactions tweetId="t1" commentId="c1" isLoggedIn />, { wrapper: Root });
	fireEvent.click(screen.getByRole("button", { name: "添加回应" }));
	fireEvent.click(await screen.findByRole("button", { name: "更多表情" }));
	const picker = await screen.findByRole("dialog", { name: "选择回应" });
	fireEvent.click(within(picker).getByRole("tab", { name: "默认" }));
	fireEvent.click(await within(picker).findByRole("option", { name: "赞" }));
	const button = await screen.findByRole("button", { name: "赞，1 人，你已回应" });
	expect(button.querySelector("img")?.src).toContain("/like.gif");
	expect(qc.getQueryData<AggregatedReaction[]>(key)?.[0].recent_users).toEqual([
		{ id: "me", name: "本人" },
	]);
	expect(apiPost).toHaveBeenCalledWith("/tweets/t1/comments/c1/reactions", { emoji_id: 1 });
	expect(localStorage.getItem("violet:recent-emojis")).toContain("1");
	await act(async () => write.reject(new Error("拒绝")));
	await waitFor(() =>
		expect(screen.queryByRole("button", { name: "赞，1 人，你已回应" })).toBeNull(),
	);
	expect(screen.queryByRole("toolbar", { name: "常用回应" })).toBeNull();
});

it.each(["失败", "缺项"])("批量%s显示原位重试，不把范围内评论拆成逐条请求", async (scenario) => {
	if (scenario === "失败") {
		vi.mocked(apiPost).mockRejectedValueOnce(new Error("不可用"));
	} else {
		vi.mocked(apiPost).mockResolvedValueOnce([]);
	}
	vi.mocked(apiPost).mockResolvedValue([{ comment_id: "c1", reactions: [original] }]);
	render(
		<TweetCommentReactionProvider tweetId="t1" commentIds={["c1"]}>
			<TweetCommentReactions tweetId="t1" commentId="c1" isLoggedIn={false} />
		</TweetCommentReactionProvider>,
		{ wrapper: Root },
	);
	fireEvent.click(await screen.findByRole("button", { name: "重试" }));
	await screen.findByRole("button", { name: "赞，2 人" });
	expect(apiGet).not.toHaveBeenCalled();
	expect(apiPost).toHaveBeenCalledTimes(2);
	expect(apiPost).toHaveBeenLastCalledWith("/tweets/t1/comments/reactions/batch", {
		comment_ids: ["c1"],
	});
});

it("范围外单条 GET 失败同样原位重试，恢复后显示真实回应", async () => {
	vi.mocked(apiGet).mockRejectedValueOnce(new Error("不可用")).mockResolvedValue([original]);
	render(<TweetCommentReactions tweetId="t1" commentId="reply" isLoggedIn={false} />, {
		wrapper: Root,
	});
	fireEvent.click(await screen.findByRole("button", { name: "重试" }));
	await screen.findByRole("button", { name: "赞，2 人" });
	expect(apiGet).toHaveBeenCalledTimes(2);
	expect(apiGet).toHaveBeenLastCalledWith("/tweets/t1/comments/reply/reactions");
	expect(apiPost).not.toHaveBeenCalled();
});

it("批量尚未完成也不阻塞范围外回复的单条读取", async () => {
	const batch = Promise.withResolvers<CommentReactionResult[]>();
	vi.mocked(apiPost).mockReturnValue(batch.promise);
	vi.mocked(apiGet).mockResolvedValue([original]);
	render(
		<TweetCommentReactionProvider tweetId="t1" commentIds={["c1"]}>
			<TweetCommentReactions tweetId="t1" commentId="c1" isLoggedIn={false} />
			<TweetCommentReactions tweetId="t1" commentId="new-reply" isLoggedIn={false} />
		</TweetCommentReactionProvider>,
		{ wrapper: Root },
	);
	await screen.findByRole("button", { name: "赞，2 人" });
	expect(apiGet).toHaveBeenCalledTimes(1);
	expect(apiGet).toHaveBeenCalledWith("/tweets/t1/comments/new-reply/reactions");
	await act(async () => batch.resolve([{ comment_id: "c1", reactions: [] }]));
});

it("加载超过一批的评论后，尾批仍显示真实回应而不突破服务端边界", async () => {
	const ids = Array.from({ length: 205 }, (_, index) => `c${String(index).padStart(3, "0")}`);
	const target = ids[204];
	vi.mocked(apiPost).mockImplementation(async (_url, body) => {
		if (!body || typeof body !== "object" || !("comment_ids" in body)) {
			throw new Error("批量请求缺少评论范围");
		}
		const requested = body.comment_ids;
		if (!Array.isArray(requested) || !requested.every((id) => typeof id === "string")) {
			throw new Error("评论范围必须是字符串数组");
		}
		if (requested.length > 100) {
			throw new Error("批量上限为 100");
		}
		return requested.map((commentId) => ({
			comment_id: commentId,
			reactions: commentId === target ? [original] : [],
		}));
	});
	render(
		<TweetCommentReactionProvider tweetId="t1" commentIds={ids}>
			<TweetCommentReactions tweetId="t1" commentId={target} isLoggedIn={false} />
		</TweetCommentReactionProvider>,
		{ wrapper: Root },
	);
	await screen.findByRole("button", { name: "赞，2 人" });
	expect(screen.queryByRole("button", { name: "重试" })).toBeNull();
	expect(apiGet).not.toHaveBeenCalled();
});
