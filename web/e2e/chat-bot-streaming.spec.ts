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
	is_bot: true,
};
const createdAt = "2026-09-23T10:00:00Z";

type MockToolCall = {
	id: string;
	name: string;
	status: "running" | "completed" | "failed";
	arguments?: string;
	result?: string;
	error?: string;
	duration_ms?: number;
};

test("Bot 卡片随生成快照更新状态，断线后回查最新内容", async ({ page, context }) => {
	await page.clock.setFixedTime(new Date(createdAt));
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
	let savedContent = "";
	let savedStatus = "pending";
	let savedThinking = "";
	let savedRevision = 0;
	let savedToolCalls: MockToolCall[] = [];
	let messageReads = 0;
	const message = () => ({
		id: "m1",
		conversation_id: "c1",
		sender: bot,
		type: "text",
		content: savedContent,
		bot_reply: {
			status: savedStatus,
			thinking: savedThinking,
			revision: savedRevision,
			updated_at: createdAt,
			tool_calls: savedToolCalls,
		},
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
	await expect(bubble).toContainText("BOT");
	await expect(bubble).toContainText("等待回复");
	await page.waitForLoadState("networkidle");
	const initialReads = messageReads;
	for (const [id, status, content] of [
		["1", "thinking", ""],
		["2", "streaming", "第一段"],
		["3", "completed", "完整回复"],
	]) {
		savedStatus = status;
		savedContent = content;
		savedThinking = "检查输入";
		savedRevision = Number(id);
		savedToolCalls =
			status === "streaming"
				? [
						{
							id: "call_1",
							name: "web_search",
							status: "running",
							arguments: '{"query":"violet tool calls"}',
							duration_ms: 120,
						},
						{
							id: "call_2",
							name: "fetch_page",
							status: "completed",
							arguments: '{"url":"https://example.com"}',
							result: "示例页面内容",
							duration_ms: 2300,
						},
					]
				: status === "completed"
					? [
							{
								id: "call_1",
								name: "web_search",
								status: "completed",
								arguments: '{"query":"violet tool calls"}',
								result: "搜索结果",
								duration_ms: 850,
							},
							{
								id: "call_2",
								name: "fetch_page",
								status: "completed",
								arguments: '{"url":"https://example.com"}',
								result: "示例页面内容",
								duration_ms: 2300,
							},
							{
								id: "call_3",
								name: "summarize",
								status: "failed",
								arguments: '{"text":"示例页面内容"}',
								error: "抓取失败：连接超时",
								duration_ms: 4000,
							},
						]
					: [];
		await page.evaluate(
			(payload) =>
				(window as Window & { emitChat?: (payload: unknown) => void }).emitChat?.(payload),
			{
				id,
				type: "message.updated",
				data: {
					conversation_id: "c1",
					message_id: "m1",
					content,
					bot_reply: {
						status,
						thinking: "检查输入",
						revision: Number(id),
						updated_at: createdAt,
						tool_calls: savedToolCalls,
					},
				},
			},
		);
		await expect(bubble).toContainText(
			status === "thinking" ? "正在思考" : status === "streaming" ? "正在回复" : "完整回复",
		);
		if (status === "thinking") {
			await bubble.getByRole("button", { name: /思考过程/ }).click();
			await expect(bubble).toContainText("检查输入");
		}
		if (status === "streaming") {
			await expect(bubble.getByRole("button", { name: /工具调用/ })).toContainText("2");
			await bubble.getByRole("button", { name: /工具调用/ }).click();
			await expect(bubble).toContainText("web_search");
			await expect(bubble).toContainText("fetch_page");
			await expect(bubble).toContainText('{"query":"violet tool calls"}');
			await expect(bubble).toContainText("示例页面内容");
			await expect(bubble).toContainText("运行中");
			await expect(bubble).toContainText("2.3s");
		}
		if (status === "completed") {
			await expect(bubble.getByText("运行中")).toHaveCount(0);
			await expect(bubble).toContainText("已完成");
			await expect(bubble).toContainText("失败");
			await expect(bubble).toContainText("抓取失败：连接超时");
			await expect(bubble).toContainText("搜索结果");
		}
		await expect(bubble).toHaveCount(1);
	}
	await expect(bubble.getByRole("status")).toHaveCount(0);
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
	await page.setViewportSize({ width: 375, height: 812 });
	await page
		.getByTestId("bot-reply-card")
		.getByRole("button", { name: /工具调用/ })
		.click();
	await expect(page.getByTestId("bot-reply-card")).toContainText("summarize");
	const cardBounds = await page.getByTestId("bot-reply-card").boundingBox();
	expect(cardBounds).not.toBeNull();
	expect(cardBounds?.x ?? -1).toBeGreaterThanOrEqual(0);
	expect((cardBounds?.x ?? 0) + (cardBounds?.width ?? 0)).toBeLessThanOrEqual(375);
});
