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
	username: "saber",
	display_name: "Saber",
	avatar_url: "",
	is_bot: true,
};
const createdAt = "2026-09-24T10:00:00Z";
const members = [self, bot].map((user) => ({
	user,
	role: "member",
	joined_at: createdAt,
	is_muted: false,
}));
const conversation = {
	id: "c1",
	kind: "direct",
	title: "Saber",
	owner: self,
	members,
	unread_count: 0,
	created_at: createdAt,
	updated_at: createdAt,
};
const reply = (route: Route, data: unknown, paged = false) =>
	route.fulfill({
		json: { data, ...(paged ? { meta: { pagination: { limit: 50, has_more: false } } } : {}) },
	});

test("聊天候选浮在输入框上方，多行工具栏靠底且 Bot 命令可补全发送", async ({ page, context }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await context.addCookies([
		{ name: "contract_admin", value: "1", url: "http://127.0.0.1:4173" },
	]);
	const sent: unknown[] = [];
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
		if (path === "/api/v1/chat/conversations") return reply(route, [conversation], true);
		if (path === "/api/v1/chat/conversations/c1") return reply(route, conversation);
		if (path === "/api/v1/chat/conversations/c1/members") return reply(route, members);
		if (path === "/api/v1/chat/conversations/c1/bot-commands")
			return reply(route, {
				bots: [
					{
						bot_user_id: bot.id,
						username: bot.username,
						name: "Saber",
						revision: "v1",
						commands: [
							{
								id: "task.list",
								path: ["task", "list"],
								description: "查看任务列表",
								arguments: [],
								scope: "conversation",
							},
							{
								id: "task.status",
								path: ["task", "status"],
								description: "查看任务状态",
								arguments: [{ name: "id", type: "integer", required: true }],
								scope: "conversation",
							},
						],
					},
				],
			});
		if (path === "/api/v1/chat/conversations/c1/messages") {
			if (request.method() === "GET") return reply(route, [], true);
			sent.push(request.postDataJSON());
			return reply(route, {
				id: "m1",
				conversation_id: "c1",
				sender: self,
				type: "text",
				content: (request.postDataJSON() as { content: string }).content,
				reactions: [],
				is_deleted: false,
				created_at: createdAt,
			});
		}
		if (path === "/api/v1/chat/events")
			return route.fulfill({ contentType: "text/event-stream", body: ": connected\n\n" });
		if (path === "/api/v1/chat/unread-count") return reply(route, { unread_count: 0 });
		const result = handle(request.method(), path, url.search, "contract_admin=1");
		return route.fulfill({
			status: result.status,
			contentType: "application/json",
			body: result.body,
		});
	});
	await page.goto("/chat?c=c1");
	const editor = page.getByRole("textbox", { name: "消息内容" });
	const inputShell = editor.locator("xpath=ancestor::*[@data-slot='rich-text-input']");
	const initialBounds = await inputShell.boundingBox();
	if (!initialBounds) {
		throw new Error("输入容器未渲染");
	}
	await editor.fill("@sa");
	await expect(page.getByRole("option", { name: /Saber/ })).toBeVisible();
	await expect(editor).toBeFocused();
	await expect(editor).toHaveText("@sa");
	await expect(async () => {
		const shell = await inputShell.boundingBox();
		const panel = await page.getByRole("dialog", { name: "输入建议" }).boundingBox();
		if (!shell || !panel) {
			throw new Error("提及候选浮层未渲染");
		}
		expect(Math.abs(shell.height - initialBounds.height)).toBeLessThanOrEqual(1);
		expect(panel.y + panel.height).toBeLessThanOrEqual(shell.y);
		expect(panel.x).toBeGreaterThanOrEqual(0);
		expect(panel.x + panel.width).toBeLessThanOrEqual(390);
	}).toPass();
	await editor.press("Escape");
	await expect(page.getByRole("dialog", { name: "输入建议" })).toHaveCount(0);
	const multilineDraft = Array.from(
		{ length: 32 },
		(_, index) => `第 ${index + 1} 行，多行输入保持正文可滚动。`,
	).join("\n");
	await editor.fill(multilineDraft);
	await expect(async () => {
		const editorBounds = await editor.boundingBox();
		if (!editorBounds) {
			throw new Error("多行编辑器未渲染");
		}
		expect(
			await editor.evaluate((element) => element.scrollHeight > element.clientHeight),
		).toBe(true);
		for (const name of ["添加内容", "添加表情", "发送消息"]) {
			const action = await page.getByRole("button", { name, exact: true }).boundingBox();
			if (!action) {
				throw new Error(`缺少输入操作：${name}`);
			}
			const shellBounds = await inputShell.boundingBox();
			if (!shellBounds) throw new Error("输入容器未渲染");
			expect(action.y).toBeGreaterThanOrEqual(shellBounds.y);
			expect(action.y + action.height).toBeLessThanOrEqual(
				shellBounds.y + shellBounds.height,
			);
		}
		expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
			390,
		);
	}).toPass();
	await page.getByRole("button", { name: "添加内容", exact: true }).click();
	await page.getByRole("menuitem", { name: "提及成员", exact: true }).click();
	await expect(page.getByRole("option", { name: /Saber/ })).toBeVisible();
	await expect(editor).toBeFocused();
	await editor.press("Escape");
	await editor.press("Shift+Enter");
	await editor.evaluate((element) =>
		element.dispatchEvent(
			new KeyboardEvent("keydown", { key: "Enter", isComposing: true, bubbles: true }),
		),
	);
	expect(sent).toHaveLength(0);
	await editor.fill("");
	await editor.fill("/ta");
	const list = page.getByRole("listbox", { name: "Bot 命令" });
	await expect(list).toBeVisible();
	await expect(list.getByRole("option")).toHaveCount(2);
	await expect(async () => {
		const shell = await inputShell.boundingBox();
		const panel = await page.getByRole("dialog", { name: "输入建议" }).boundingBox();
		if (!shell || !panel) {
			throw new Error("角色命令浮层未渲染");
		}
		expect(Math.abs(shell.height - initialBounds.height)).toBeLessThanOrEqual(1);
		expect(panel.y + panel.height).toBeLessThanOrEqual(shell.y);
	}).toPass();
	const bounds = await list.boundingBox();
	if (!bounds) {
		throw new Error("命令菜单未渲染");
	}
	expect(bounds.x).toBeGreaterThanOrEqual(0);
	expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);
	await page.setViewportSize({ width: 390, height: 480 });
	await expect(list.getByRole("option").last()).toBeInViewport();
	await list.getByRole("option").first().click({ trial: true });
	await expect(editor).toBeInViewport();
	await editor.press("ArrowDown");
	await editor.press("Enter");
	await expect(list).toHaveCount(0);
	await expect(editor).toContainText("/task status");
	expect(sent).toHaveLength(0);
	await editor.type("7");
	await editor.press("Enter");
	await expect.poll(() => sent.length).toBe(1);
	expect((sent[0] as { content: string }).content).toBe("/task status 7");
});
