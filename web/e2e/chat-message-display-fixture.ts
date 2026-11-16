import { expect, type Page } from "@playwright/test";
import type { ChatMessage, ChatUser } from "../src/features/chat/model/types";
import { prepareChat } from "./chat-harness";

const self: ChatUser = {
	id: "30000000-0000-0000-0000-000000000001",
	username: "contract",
	display_name: "Contract",
	avatar_url: "",
};
const peer: ChatUser = {
	id: "30000000-0000-0000-0000-000000000002",
	username: "lin",
	display_name: "林间",
	avatar_url: "",
};
const bot: ChatUser = {
	id: "30000000-0000-0000-0000-000000000003",
	username: "bot",
	display_name: "验收 Bot",
	avatar_url: "",
	is_bot: true,
};
const message = (
	id: string,
	sender: ChatUser,
	content: string,
	overrides: Partial<ChatMessage> = {},
): ChatMessage => ({
	id,
	conversation_id: "c1",
	sender,
	type: "text",
	content,
	reactions: [],
	read_state: { read_count: 0, member_count: 1 },
	is_deleted: false,
	created_at: "2026-11-16T08:00:00Z",
	...overrides,
});
const choices = [
	{ name: "鼓掌", symbol: "👏" },
	{ name: "热情", symbol: "🔥" },
	{ name: "感谢", symbol: "🙏" },
];
const reactions = choices.map((choice, index) => ({
	emoji_id: index + 1,
	emoji_name: choice.name,
	emoji_url: `/chat-message-display/${index + 1}.svg`,
	count: 1,
	self: index === 2,
	recent_users: [
		{
			id: index === 2 ? self.id : peer.id,
			name: index === 2 ? self.display_name : peer.display_name,
		},
	],
}));
const messages = [
	message("m29", peer, "第一条：连续消息只在组尾显示时间。"),
	message("m30", peer, "同组下一条。"),
	message("m31", self, "1", {
		read_state: { read_count: 1, member_count: 1 },
		created_at: "2026-11-16T08:01:00Z",
	}),
	message("m32", self, "12", { created_at: "2026-11-16T08:02:00Z" }),
	message("m33", self, "收尾一条。", { created_at: "2026-11-16T08:03:00Z" }),
	message("m34", bot, "Bot 的回应与时间也使用同一套消息底栏。", {
		reactions,
		created_at: "2026-11-16T08:04:00Z",
	}),
	message("m35", self, "引用后的回复。", {
		created_at: "2026-11-16T08:05:00Z",
		reply_to: {
			id: "m30",
			sender: peer,
			type: "text",
			content: "同组下一条。",
			is_deleted: false,
		},
	}),
];
const appearance = {
	avatar_frame_id: "",
	avatar_charm_id: "",
	bubble_theme_id: "",
	badge_ids: [],
	revision: 1,
};

/**
 * 装载连续短消息、角色回复与不同归属的真实回应胶囊。
 *
 * @param options - 长历史仅前置旧消息，不改变末尾样本的分组。
 */
export async function prepareMessageDisplay(
	page: Page,
	options: { themeId?: string; withHistory?: boolean } = {},
) {
	await prepareChat(page);
	const currentAppearance = { ...appearance, bubble_theme_id: options.themeId ?? "" };
	const scenarioMessages = messages.map((entry) => ({ ...entry }));
	if (options.withHistory) {
		scenarioMessages.unshift(
			...Array.from({ length: 30 }, (_, index) =>
				message(`history-${index}`, index % 2 === 0 ? peer : self, `历史记录 ${index}`, {
					created_at: new Date(Date.UTC(2026, 10, 15, 23, 0, index)).toISOString(),
				}),
			),
		);
	}
	await page.route("**/chat-message-display/*.svg", (route) => {
		const match = /\/(\d+)\.svg$/.exec(new URL(route.request().url()).pathname);
		const choice = match ? choices[Number(match[1]) - 1] : undefined;
		if (!choice) return route.abort();
		return route.fulfill({
			contentType: "image/svg+xml",
			body: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><text y="16" font-size="16">${choice.symbol}</text></svg>`,
		});
	});
	await page.route("**/api/v1/emojis", (route) =>
		route.fulfill({
			json: {
				data: [
					{
						id: 1,
						name: "默认",
						source: "system",
						sort_order: 0,
						is_enabled: true,
						type: 2,
						emojis: reactions.map((reaction) => ({
							id: reaction.emoji_id,
							name: reaction.emoji_name,
							url: reaction.emoji_url,
						})),
					},
				],
			},
		}),
	);
	await page.route("**/api/v1/chat/conversations/c1/messages**", async (route) => {
		const path = new URL(route.request().url()).pathname;
		if (route.request().method() === "POST" && path.endsWith("/reactions")) {
			const id = /\/messages\/([^/]+)\/reactions$/.exec(path)?.[1];
			const target = scenarioMessages.find((entry) => entry.id === id);
			const reaction = reactions.find(
				(entry) => entry.emoji_id === route.request().postDataJSON().emoji_id,
			);
			if (!target || !reaction) return route.abort();
			target.reactions = [
				...(target.reactions ?? []),
				{
					...reaction,
					self: true,
					recent_users: [{ id: self.id, name: self.display_name }],
				},
			];
			return route.fulfill({ json: { data: null } });
		}
		if (route.request().method() !== "GET") return route.fallback();
		if (path.endsWith("/readers")) {
			return route.fulfill({
				json: { data: [{ user: peer, read_at: "2026-11-16T08:01:30Z" }] },
			});
		}
		return route.fulfill({
			json: {
				data: [...scenarioMessages].reverse(),
				meta: { pagination: { limit: 50, has_more: false } },
			},
		});
	});
	await page.route("**/api/v1/chat/appearance*", (route) =>
		route.fulfill({
			json: {
				data: new URL(route.request().url()).pathname.endsWith("/appearances")
					? { [self.id]: currentAppearance }
					: currentAppearance,
			},
		}),
	);
	await page.reload();
	await expect(page.getByTestId("chat-message-m35")).toBeVisible();
	await page.evaluate(() => document.fonts.ready);
}
