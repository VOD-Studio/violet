import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, type Page, type Route } from "@playwright/test";
import { handle } from "./mock-data.mjs";

const clientDir = join(import.meta.dirname, "..", "dist", "client");

const self = {
	id: "30000000-0000-0000-0000-000000000001",
	username: "contract",
	display_name: "Contract",
	avatar_url: "",
};
const peer = {
	id: "30000000-0000-0000-0000-000000000002",
	username: "lin",
	display_name: "林间",
	avatar_url: "",
};
const members = [self, peer].map((user, index) => ({
	user,
	role: index === 0 ? "owner" : "member",
	joined_at: "2026-11-16T08:00:00Z",
	is_muted: false,
	can_speak: true,
}));
const messages = Array.from({ length: 36 }, (_, index) => ({
	id: `m${index}`,
	conversation_id: "c1",
	sender: index % 3 === 0 ? peer : self,
	type: "text",
	content:
		index === 35
			? "这是一段需要在会话列表中省略的长消息。".repeat(12)
			: `记录 ${index}：浏览历史时保留当前位置。`,
	reactions: [],
	read_state: { read_count: 1, member_count: 1 },
	is_deleted: false,
	created_at: `2026-11-16T08:00:${String(index).padStart(2, "0")}Z`,
}));
const conversation = {
	id: "c1",
	kind: "room",
	title: "回归群聊",
	owner: self,
	members,
	member_count: 2,
	unread_count: 0,
	is_muted: false,
	last_message: messages.at(-1),
	created_at: "2026-11-16T08:00:00Z",
	updated_at: "2026-11-16T08:00:35Z",
};
const appearance = {
	avatar_frame_id: "",
	avatar_charm_id: "",
	bubble_theme_id: "",
	badge_ids: [],
	revision: 1,
};
const reply = (route: Route, data: unknown, paged = false) =>
	route.fulfill({
		json: { data, ...(paged ? { meta: { pagination: { limit: 50, has_more: false } } } : {}) },
	});

/**
 * 装载隔离的聊天会话，页面交互仍使用真实组件。
 *
 * @remarks SSR 使用既有 contract_admin 身份，浏览器 API 全部在本页拦截。
 */
export async function prepareChat(page: Page) {
	await page
		.context()
		.addCookies([{ name: "contract_admin", value: "1", url: "http://127.0.0.1:4173" }]);
	await page.route("**/*", async (route) => {
		const request = route.request();
		const url = new URL(request.url());
		const path = url.pathname;
		if (path.startsWith("/assets/") || path.startsWith("/chat-appearance/")) {
			const file = join(clientDir, path);
			if (!existsSync(file)) return route.abort();
			return route.fulfill({
				contentType: path.endsWith(".css")
					? "text/css"
					: path.endsWith(".woff2")
						? "font/woff2"
						: path.endsWith(".png")
							? "image/png"
							: path.endsWith(".webp")
								? "image/webp"
								: "application/javascript",
				body: readFileSync(file),
			});
		}
		if (!path.startsWith("/api/")) return route.continue();
		if (path === "/api/v1/auth/me") return reply(route, { ...self, permissions: ["*"] });
		if (path === "/api/v1/chat/conversations") return reply(route, [conversation], true);
		if (path === "/api/v1/chat/conversations/c1") return reply(route, conversation);
		if (path.endsWith("/members")) return reply(route, members);
		if (path.endsWith("/messages")) return reply(route, [...messages].reverse(), true);
		if (path.endsWith("/bot-commands")) return reply(route, { bots: [] });
		if (path.endsWith("/contacts") || path === "/api/v1/chat/users")
			return reply(route, [peer], true);
		if (path === "/api/v1/chat/appearance") return reply(route, appearance);
		if (path === "/api/v1/chat/appearances") return reply(route, {});
		if (path === "/api/v1/chat/badges") return reply(route, []);
		if (path === "/api/v1/chat/settings") return reply(route, { hide_online: false });
		if (path === "/api/v1/chat/unread-count") return reply(route, { unread_count: 0 });
		if (path === "/api/v1/custom-emojis/mine")
			return reply(route, { owned: [], favorited: [] });
		if (path === "/api/v1/chat/events")
			return route.fulfill({ contentType: "text/event-stream", body: ": connected\n\n" });
		if (path.endsWith("/typing") || path.endsWith("/read")) return reply(route, {});
		const result = handle(request.method(), path, url.search, "contract_admin=1");
		return route.fulfill({
			status: result.status,
			contentType: "application/json",
			body: result.body,
		});
	});
	await page.goto("/chat?c=c1");
	await expect(page.getByTestId("chat-message-m35")).toBeVisible();
}
