import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, type Route, test } from "@playwright/test";
import { handle } from "./mock-data.mjs";

const clientDir = join(import.meta.dirname, "..", "dist", "client");

const self = {
	id: "30000000-0000-0000-0000-000000000001",
	username: "contract",
	display_name: "Contract",
	avatar_url: "",
};
const bot = {
	id: "30000000-0000-0000-0000-000000000002",
	username: "bot",
	display_name: "Bot",
	avatar_url: "",
};
const createdAt = "2026-09-23T10:00:00Z";

test("bot 增量事件逐段更新同一条气泡，断线补发回查最新内容", async ({ page, context }) => {
	await context.addCookies([
		{ name: "contract_admin", value: "1", url: "http://127.0.0.1:4173" },
	]);
	await page.addInitScript(() => {
		const listeners = new Set<EventListenerOrEventListenerObject>();
		class ControlledEventSource {
			addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
				if (type === "chat") listeners.add(listener);
			}
			close() {
				listeners.clear();
			}
		}
		Object.defineProperty(window, "EventSource", { value: ControlledEventSource });
		(window as Window & { emitChat?: (payload: unknown) => void }).emitChat = (payload) => {
			const event = new MessageEvent("chat", { data: JSON.stringify(payload) });
			for (const listener of listeners) {
				if (typeof listener === "function") listener(event);
				else listener.handleEvent(event);
			}
		};
	});
	let savedContent = "占位";
	let messageReads = 0;
	const message = () => ({
		id: "m1",
		conversation_id: "c1",
		sender: bot,
		type: "text",
		content: savedContent,
		reactions: [],
		is_deleted: false,
		created_at: createdAt,
	});
	const conversation = () => ({
		id: "c1",
		kind: "direct",
		title: "Bot",
		owner: self,
		members: [self, bot].map((user) => ({
			user,
			role: "member",
			joined_at: createdAt,
			is_muted: false,
		})),
		last_message: message(),
		unread_count: 0,
		created_at: createdAt,
		updated_at: createdAt,
	});
	const reply = (route: Route, data: unknown, paged = false) =>
		route.fulfill({
			json: {
				data,
				...(paged ? { meta: { pagination: { limit: 50, has_more: false } } } : {}),
			},
		});
	await page.route("**/*", async (route) => {
		const request = route.request();
		const url = new URL(request.url());
		const path = url.pathname;
		if (path.startsWith("/assets/")) {
			const file = join(clientDir, path);
			if (!existsSync(file)) return route.abort();
			return route.fulfill({
				contentType: path.endsWith(".css")
					? "text/css"
					: path.endsWith(".woff2")
						? "font/woff2"
						: "application/javascript",
				body: readFileSync(file),
			});
		}
		if (!path.startsWith("/api/")) return route.continue();
		if (path === "/api/v1/chat/conversations") return reply(route, [conversation()], true);
		if (path === "/api/v1/chat/conversations/c1") return reply(route, conversation());
		if (path === "/api/v1/chat/conversations/c1/members")
			return reply(route, conversation().members);
		if (path === "/api/v1/chat/conversations/c1/messages") {
			messageReads++;
			return reply(route, [message()], true);
		}
		if (path === "/api/v1/chat/unread-count") return reply(route, { unread_count: 0 });
		const result = handle(request.method(), path, url.search, "contract_admin=1");
		return route.fulfill({
			status: result.status,
			contentType: "application/json",
			body: result.body,
		});
	});
	await page.goto("/chat?c=c1");
	const bubble = page.getByTestId("chat-message-m1");
	await expect(bubble).toContainText("占位");
	await page.waitForLoadState("networkidle");
	const initialReads = messageReads;
	for (const [id, content] of [
		["1", "第一段"],
		["2", "第一段第二段"],
		["3", "完整回复"],
	]) {
		await page.evaluate(
			(payload) =>
				(window as Window & { emitChat?: (payload: unknown) => void }).emitChat?.(payload),
			{
				id,
				type: "message.updated",
				data: { conversation_id: "c1", message_id: "m1", content, edited_at: createdAt },
			},
		);
		await expect(bubble).toContainText(content);
		await expect(bubble).toHaveCount(1);
	}
	expect(messageReads).toBe(initialReads);
	savedContent = "断线后的最终正文";
	await page.evaluate(
		(payload) =>
			(window as Window & { emitChat?: (payload: unknown) => void }).emitChat?.(payload),
		{ id: "4", type: "message.updated", data: { conversation_id: "c1", message_id: "m1" } },
	);
	await expect(bubble).toContainText(savedContent);
	expect(messageReads).toBeGreaterThan(initialReads);
	await page.reload();
	await expect(page.getByTestId("chat-message-m1")).toContainText(savedContent);
});
