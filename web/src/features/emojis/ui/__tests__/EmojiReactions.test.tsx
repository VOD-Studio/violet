import { rememberEmoji } from "@entities/emoji/model/recent";
import type { EmojiGroup } from "@entities/emoji/model/types";
import type { AggregatedReaction } from "@entities/reaction/model/types";
import { emojiKeys } from "@features/emojis/api/keys";
import { useSessionStore } from "@shared/api/session";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { EmojiReactions } from "../EmojiReactions";

const emojis = Array.from({ length: 10 }, (_, index) => ({
	id: index + 1,
	name: `表情${index + 1}`,
	url: `/emoji-${index + 1}.png`,
}));
const groups: EmojiGroup[] = [
	{
		id: 1,
		name: "默认",
		source: "system",
		sort_order: 0,
		is_enabled: true,
		type: 2,
		emojis,
	},
];
const reactions: AggregatedReaction[] = emojis.map((emoji) => ({
	emoji_id: emoji.id,
	emoji_name: emoji.name,
	emoji_url: emoji.url,
	count: 1,
	self: true,
	recent_users: [{ id: "me", name: "本人" }],
}));
let qc: QueryClient;
beforeEach(() => {
	qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
	qc.setQueryData(emojiKeys.publicGroupList(), groups);
	useSessionStore.setState({ sessionActive: true });
	localStorage.removeItem("violet:recent-emojis");
});
afterEach(() => {
	cleanup();
	qc.clear();
	useSessionStore.setState({ sessionActive: false });
	localStorage.removeItem("violet:recent-emojis");
});

it("快捷入口读取公共最近八个系统表情，私人项不出现，已选不能重复；完整选择直接关闭同一浮层", async () => {
	for (const emoji of [...emojis].reverse()) {
		rememberEmoji(emoji);
	}
	rememberEmoji({ id: 100, name: "私人", url: "/private.png", custom_emoji_id: "private" });
	const onAdd = vi.fn();
	render(
		<QueryClientProvider client={qc}>
			<EmojiReactions
				reactions={reactions.slice(0, 1)}
				currentUserId="me"
				isLoggedIn
				onAdd={onAdd}
				onRemove={vi.fn()}
			/>
		</QueryClientProvider>,
	);
	const trigger = screen.getByRole("button", { name: "添加回应" });
	fireEvent.click(trigger);
	const toolbar = await screen.findByRole("toolbar", { name: "常用回应" });
	expect(within(toolbar).getAllByRole("button")).toHaveLength(9);
	expect(within(toolbar).queryByRole("button", { name: "私人" })).toBeNull();
	expect(within(toolbar).queryByRole("button", { name: "表情9" })).toBeNull();
	fireEvent.click(within(toolbar).getByRole("button", { name: "表情1，已回应" }));
	expect(onAdd).not.toHaveBeenCalled();
	fireEvent.click(within(toolbar).getByRole("button", { name: "更多表情" }));
	const dialog = await screen.findByRole("dialog", { name: "选择回应" });
	expect(screen.getAllByRole("dialog")).toHaveLength(1);
	fireEvent.click(within(dialog).getByRole("tab", { name: "默认" }));
	fireEvent.click(await within(dialog).findByRole("option", { name: "表情9" }));
	expect(onAdd).toHaveBeenCalledExactlyOnceWith(9);
	await waitFor(() => expect(trigger.getAttribute("aria-expanded")).toBe("false"));
	await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
	expect(screen.queryByRole("toolbar", { name: "常用回应" })).toBeNull();
	expect(JSON.parse(localStorage.getItem("violet:recent-emojis") ?? "[]")[0]).toBe("system:9");
});

it("本机没有最近记录时，快捷条用系统默认分组的前八个，完整选择器直接落在该分组", async () => {
	const onAdd = vi.fn();
	render(
		<QueryClientProvider client={qc}>
			<EmojiReactions
				reactions={[]}
				currentUserId="me"
				isLoggedIn
				onAdd={onAdd}
				onRemove={vi.fn()}
			/>
		</QueryClientProvider>,
	);
	fireEvent.click(screen.getByRole("button", { name: "添加回应" }));
	const toolbar = await screen.findByRole("toolbar", { name: "常用回应" });
	expect(within(toolbar).getAllByRole("button")).toHaveLength(9);
	expect(within(toolbar).getByRole("button", { name: "表情1" })).toBeTruthy();
	expect(within(toolbar).queryByRole("button", { name: "表情9" })).toBeNull();
	fireEvent.click(within(toolbar).getByRole("button", { name: "更多表情" }));
	const dialog = await screen.findByRole("dialog", { name: "选择回应" });
	expect(within(dialog).getByRole("tab", { name: "默认" }).getAttribute("aria-selected")).toBe(
		"true",
	);
	fireEvent.click(await within(dialog).findByRole("option", { name: "表情9" }));
	expect(onAdd).toHaveBeenCalledExactlyOnceWith(9);
});

it("评论不限种类且不折叠，十种本人回应仍能打开添加入口", async () => {
	render(
		<QueryClientProvider client={qc}>
			<EmojiReactions
				reactions={reactions}
				currentUserId="me"
				isLoggedIn
				onAdd={vi.fn()}
				onRemove={vi.fn()}
			/>
		</QueryClientProvider>,
	);
	expect(screen.getByRole("button", { name: "表情10，1 人，你已回应" })).toBeTruthy();
	expect(screen.queryByRole("button", { name: /展开另外/ })).toBeNull();
	fireEvent.click(screen.getByRole("button", { name: "添加回应" }));
	expect(await screen.findByRole("toolbar", { name: "常用回应" })).toBeTruthy();
});
