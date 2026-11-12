import type { EmojiGroup } from "@entities/emoji/model/types";
import type { AggregatedReaction } from "@entities/reaction/model/types";
import { authKeys } from "@features/auth/api/keys";
import { emojiKeys } from "@features/emojis/api/keys";
import { apiDelete, apiGetPaged, apiPost } from "@shared/api/request";
import { useSessionStore } from "@shared/api/session";
import type { PagedResponse } from "@shared/api/types";
import { type InfiniteData, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { toast } from "sonner";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { chatKeys } from "../../api/keys";
import { useChatMessages } from "../../api/queries";
import type { ChatMessage } from "../../model/types";
import { MessageReactions } from "../MessageReactions";

vi.mock("@shared/api/request", () => ({
	apiGet: vi.fn(),
	apiPost: vi.fn(),
	apiDelete: vi.fn(),
	apiPatch: vi.fn(),
	apiGetPaged: vi.fn(),
}));
const reaction: AggregatedReaction = {
	emoji_id: 1,
	emoji_name: "赞",
	emoji_url: "/like.png",
	gif_url: "/like.gif",
	count: 2,
	self: true,
	recent_users: [
		{ id: "me", name: "本人" },
		{ id: "other", name: "小明" },
	],
};
const groups: EmojiGroup[] = [
	{
		id: 1,
		name: "默认",
		source: "system",
		sort_order: 0,
		is_enabled: true,
		type: 2,
		emojis: Array.from({ length: 8 }, (_, index) => ({
			id: index + 1,
			name: `表情${index + 1}`,
			url: `/emoji${index + 1}.png`,
		})),
	},
];
const sender = { id: "other", username: "other", display_name: "小明", avatar_url: "" };
function message(id: string, reactions: AggregatedReaction[]): ChatMessage {
	return {
		id,
		conversation_id: "c",
		sender,
		type: "text",
		content: id,
		reactions,
		is_deleted: false,
		created_at: "2026-11-12T00:00:00Z",
	};
}
function Messages() {
	const { data } = useChatMessages("c");
	return data?.pages
		.flatMap((page) => page.data)
		.map((entry) => (
			<section aria-label={entry.id} key={entry.id}>
				<p>{entry.content}</p>
				<MessageReactions
					conversationId="c"
					messageId={entry.id}
					currentUserId="me"
					reactions={entry.reactions}
					mine={false}
				/>
			</section>
		));
}
let qc: QueryClient;
function seed(messages: ChatMessage[]) {
	qc.setQueryData<InfiniteData<PagedResponse<ChatMessage>>>(chatKeys.messages("c"), {
		pages: [
			{
				data: messages,
				pagination: { next_cursor: "", has_more: false, limit: 50 },
			},
		],
		pageParams: [""],
	});
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
	vi.restoreAllMocks();
	useSessionStore.setState({ sessionActive: false });
	localStorage.removeItem("violet:recent-emojis");
});

it("取消失败恢复本人名单与 GIF，但不覆盖同会话的新消息和其他消息成功回应", async () => {
	seed([message("m1", [reaction]), message("m2", [reaction])]);
	let rejectWrite!: (error: Error) => void;
	let finishRefresh!: (data: PagedResponse<ChatMessage>) => void;
	vi.mocked(apiDelete).mockReturnValue(
		new Promise((_resolve, reject) => {
			rejectWrite = reject;
		}),
	);
	vi.mocked(apiGetPaged).mockReturnValue(
		new Promise((resolve) => {
			finishRefresh = resolve as typeof finishRefresh;
		}),
	);
	const error = vi.spyOn(toast, "error");
	render(
		<QueryClientProvider client={qc}>
			<Messages />
		</QueryClientProvider>,
	);
	const first = within(screen.getByRole("region", { name: "m1" }));
	fireEvent.click(first.getByRole("button", { name: "赞，2 人，你已回应" }));
	await first.findByRole("button", { name: "赞，1 人" });
	const optimistic = qc.getQueryData<InfiniteData<PagedResponse<ChatMessage>>>(
		chatKeys.messages("c"),
	);
	expect(optimistic?.pages[0].data[0].reactions[0].recent_users).toEqual([
		{ id: "other", name: "小明" },
	]);
	act(() =>
		qc.setQueryData<InfiniteData<PagedResponse<ChatMessage>>>(chatKeys.messages("c"), (old) => {
			if (!old) {
				return old;
			}
			return {
				...old,
				pages: old.pages.map((page) => ({
					...page,
					data: [
						...page.data.map((entry) =>
							entry.id === "m2"
								? { ...entry, reactions: [{ ...reaction, count: 10 }] }
								: entry,
						),
						message("m3", []),
					],
				})),
			};
		}),
	);
	await act(async () => {
		rejectWrite(new Error("拒绝"));
	});
	await first.findByRole("button", { name: "赞，2 人，你已回应" });
	expect(
		first.getByRole("button", { name: "赞，2 人，你已回应" }).querySelector("img")?.src,
	).toContain("/like.gif");
	expect(
		within(screen.getByRole("region", { name: "m2" })).getByRole("button", {
			name: "赞，10 人，你已回应",
		}),
	).toBeTruthy();
	expect(screen.getByText("m3")).toBeTruthy();
	expect(error).toHaveBeenCalledWith("回应没有成功");
	expect(
		first.getByRole("button", { name: "赞，2 人，你已回应" }).getAttribute("aria-disabled"),
	).toBe("true");
	await act(async () => {
		const current = qc.getQueryData<InfiniteData<PagedResponse<ChatMessage>>>(
			chatKeys.messages("c"),
		);
		if (!current) {
			throw new Error("刷新屏障前应保留会话消息缓存");
		}
		finishRefresh(current.pages[0]);
	});
	await waitFor(() =>
		expect(
			first.getByRole("button", { name: "赞，2 人，你已回应" }).getAttribute("aria-disabled"),
		).not.toBe("true"),
	);
});

it("三种已选时仍可取消，添加与未选回应给出准确限额提示；超过六种可以展开", async () => {
	const reactions = Array.from({ length: 7 }, (_, index) => ({
		...reaction,
		emoji_id: index + 1,
		emoji_name: `表情${index + 1}`,
		self: index < 3,
	}));
	seed([message("m1", reactions)]);
	const info = vi.spyOn(toast, "info");
	vi.mocked(apiDelete).mockReturnValue(new Promise(() => {}));
	render(
		<QueryClientProvider client={qc}>
			<Messages />
		</QueryClientProvider>,
	);
	fireEvent.click(screen.getByRole("button", { name: "添加回应" }));
	expect(info).toHaveBeenLastCalledWith("单条消息最多 3 种回应，先取消一种");
	fireEvent.click(screen.getByRole("button", { name: "表情4，2 人" }));
	expect(apiPost).not.toHaveBeenCalled();
	expect(info).toHaveBeenCalledTimes(2);
	expect(screen.queryByRole("button", { name: "表情7，2 人" })).toBeNull();
	fireEvent.click(screen.getByRole("button", { name: /展开.*1/ }));
	expect(screen.getByRole("button", { name: "表情7，2 人" })).toBeTruthy();
	fireEvent.click(screen.getByRole("button", { name: "表情1，2 人，你已回应" }));
	await waitFor(() =>
		expect(apiDelete).toHaveBeenCalledWith("/chat/conversations/c/messages/m1/reactions/1"),
	);
});

it("永久不可回应的消息保留人数，但没有失效的添加入口且不提交切换", () => {
	render(
		<QueryClientProvider client={qc}>
			<MessageReactions
				conversationId="c"
				messageId="m1"
				currentUserId="me"
				reactions={[reaction]}
				mine={false}
				disabled
				deleted
			/>
		</QueryClientProvider>,
	);
	const chip = screen.getByRole("button", { name: "赞，2 人，你已回应" });
	expect(chip.getAttribute("aria-disabled")).toBe("true");
	expect(screen.queryByRole("button", { name: "添加回应" })).toBeNull();
	fireEvent.click(chip);
	expect(apiDelete).not.toHaveBeenCalled();
	expect(apiPost).not.toHaveBeenCalled();
});

it("待发送的消息保留禁用的添加入口，确认后不产生版面位移", () => {
	render(
		<QueryClientProvider client={qc}>
			<MessageReactions
				conversationId="c"
				messageId="m1"
				currentUserId="me"
				reactions={[]}
				mine={false}
				disabled
			/>
		</QueryClientProvider>,
	);
	const add = screen.getByRole("button", { name: "添加回应" });
	expect(add.getAttribute("aria-disabled")).toBe("true");
	fireEvent.click(add);
	expect(screen.queryByRole("toolbar", { name: "常用回应" })).toBeNull();
});
