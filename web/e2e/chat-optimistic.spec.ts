import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, type Route, test } from "@playwright/test";
import { handle } from "./mock-data.mjs";

const clientDir = join(import.meta.dirname, "..", "dist", "client");
const png = Buffer.from(
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
	"base64",
);
const self = {
	id: "30000000-0000-0000-0000-000000000001",
	username: "contract",
	display_name: "Contract",
	avatar_url: "",
};
const peer = {
	id: "30000000-0000-0000-0000-000000000002",
	username: "bob",
	display_name: "Bob",
	avatar_url: "",
};
const members = [self, peer].map((user) => ({
	user,
	role: "member",
	joined_at: "2026-09-16T00:00:00Z",
	is_muted: false,
}));
const conversations = ["c1", "c2"].map((id) => ({
	id,
	kind: id === "c1" ? "room" : "direct",
	title: id,
	owner: self,
	members,
	member_count: 2,
	unread_count: 0,
	is_muted: false,
	created_at: "2026-09-16T00:00:00Z",
	updated_at: "2026-09-16T00:00:00Z",
}));
const reply = (route: Route, data: unknown, paged = false) =>
	route.fulfill({
		json: { data, ...(paged ? { meta: { pagination: { limit: 50, has_more: false } } } : {}) },
	});

for (const viewport of [
	{ width: 1440, height: 900 },
	{ width: 390, height: 844 },
]) {
	test(`消息使用左侧等待指示并保留失败重试 ${viewport.width}`, async ({
		page,
		context,
	}, testInfo) => {
		await page.setViewportSize(viewport);
		await context.addCookies([
			{ name: "contract_admin", value: "1", url: "http://127.0.0.1:4173" },
		]);
		const errors: string[] = [];
		page.on("pageerror", (error) => errors.push(error.message));
		const messages: Record<string, unknown>[] = [];
		const retryKeys: string[] = [];
		let heldText: Route | undefined;
		let heldUpload: Route | undefined;
		const confirm = async (route: Route) => {
			const input = route.request().postDataJSON();
			const message = {
				...input,
				id: `m${messages.length}`,
				client_message_id: route.request().headers()["idempotency-key"],
				conversation_id: "c1",
				sender: self,
				reactions: [],
				read_state: { read_count: 0, member_count: 1 },
				is_deleted: false,
				created_at: new Date().toISOString(),
				...(input.type === "image"
					? {
							media: [
								{
									id: "media",
									url: "/chat-test-image.png",
									mime_type: "image/png",
									size: png.length,
								},
							],
						}
					: {}),
			};
			messages.unshift(message);
			await reply(route, message);
		};
		await context.route("**/*", async (route) => {
			const request = route.request();
			const url = new URL(request.url());
			const path = url.pathname;
			if (path === "/chat-test-image.png" || url.hostname === "ui-avatars.com")
				return route.fulfill({ contentType: "image/png", body: png });
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
			if (path.endsWith("/events"))
				return route.fulfill({ contentType: "text/event-stream", body: ": connected\n\n" });
			if (path === "/api/v1/chat/conversations") return reply(route, conversations, true);
			if (/\/chat\/conversations\/c[12]$/.test(path))
				return reply(
					route,
					conversations.find((item) => path.endsWith(item.id)),
				);
			if (path.endsWith("/members")) return reply(route, members);
			if (path.endsWith("/messages")) {
				if (request.method() === "GET")
					return reply(route, path.includes("/c1/") ? messages : [], true);
				const input = request.postDataJSON();
				if (input.content === "1") {
					heldText = route;
					return;
				}
				if (input.content === "失败重试") {
					retryKeys.push(request.headers()["idempotency-key"]);
					if (retryKeys.length === 1)
						return route.fulfill({
							status: 400,
							json: { error: "BAD_REQUEST", message: "测试发送失败" },
						});
				}
				return confirm(route);
			}
			if (path === "/api/v1/uploads") {
				heldUpload = route;
				return;
			}
			if (path.endsWith("/typing") || path.endsWith("/read")) return reply(route, {});
			if (path.endsWith("/unread-count")) return reply(route, { unread_count: 0 });
			if (path.endsWith("/custom-emojis/mine"))
				return reply(route, { owned: [], favorited: [] });
			const result = handle(request.method(), path, url.search, "contract_admin=1");
			return route.fulfill({
				status: result.status,
				contentType: "application/json",
				body: result.body,
			});
		});
		await page.goto("/chat?c=c1");
		const editor = page.getByRole("textbox", { name: "消息内容" });
		await expect(editor).toBeVisible();
		const startupErrors = errors.splice(0);
		expect(startupErrors.length).toBeLessThanOrEqual(1);
		for (const error of startupErrors) {
			expect(error).toContain("Minified React error #418;");
			testInfo.annotations.push({
				type: "baseline-warning",
				description: "模拟 SSR 首帧 hydration 警告；release/2.0 的 30183b56 同样复现",
			});
		}
		const send = page.getByRole("button", { name: "发送消息", exact: true });
		await page.evaluate(() => document.fonts.ready);
		await editor.fill("1");
		await editor.press("Enter");
		const firstMessage = page.locator("article").filter({ hasText: "1" });
		const waiting = firstMessage.getByRole("status");
		await expect(waiting).toContainText("发送中");
		await expect(waiting.locator("svg")).toBeVisible();
		await expect
			.poll(() =>
				waiting.locator("svg").evaluate((svg) =>
					Array.from(svg.querySelectorAll("path, circle, ellipse")).some((part) => {
						const style = getComputedStyle(part);
						return (
							style.fill !== "none" &&
							Number(style.fillOpacity) > 0.5 &&
							Number(style.opacity) > 0.5
						);
					}),
				),
			)
			.toBe(true);
		const loadingBounds = await waiting.boundingBox();
		const bubbleBounds = await firstMessage.locator("[data-chat-bubble]").boundingBox();
		if (!loadingBounds || !bubbleBounds) throw new Error("缺少发送指示或消息气泡");
		expect(loadingBounds.x + loadingBounds.width).toBeLessThanOrEqual(bubbleBounds.x);
		expect(loadingBounds.x).toBeGreaterThanOrEqual(0);
		await expect(firstMessage.getByRole("button", { name: /人已读/ })).toHaveCount(0);
		const pendingTextBounds = await firstMessage.getByText("1", { exact: true }).boundingBox();
		if (!pendingTextBounds) throw new Error("缺少待发送正文");
		await page.screenshot({ path: testInfo.outputPath("sending.png") });
		await expect(editor).toBeEmpty();
		await expect(send.locator(".animate-spin")).toHaveCount(0);
		await editor.fill("正在输入下一条");
		await expect(send).toBeEnabled();
		await expect.poll(() => Boolean(heldText)).toBe(true);
		if (!heldText) throw new Error("未捕获发送请求");
		const pendingBounds = await page.locator("article").filter({ hasText: "1" }).boundingBox();
		if (!pendingBounds) throw new Error("待发送消息不可见");
		await confirm(heldText);
		await expect(page.getByText("发送中", { exact: true })).toHaveCount(0);
		await expect(editor).toHaveText("正在输入下一条");
		await expect(firstMessage.getByRole("button", { name: "0 人已读" })).toBeVisible();
		const sentBounds = await firstMessage.boundingBox();
		if (!sentBounds) throw new Error("已确认消息不可见");
		expect(Math.abs(sentBounds.height - pendingBounds.height)).toBeLessThanOrEqual(0.5);
		const confirmedBubble = await firstMessage.locator("[data-chat-bubble]").boundingBox();
		const confirmedText = await firstMessage.getByText("1", { exact: true }).boundingBox();
		if (!confirmedBubble || !confirmedText) throw new Error("缺少已确认气泡或正文");
		expect(Math.abs(confirmedBubble.width - bubbleBounds.width)).toBeLessThanOrEqual(0.5);
		expect(Math.abs(confirmedBubble.height - bubbleBounds.height)).toBeLessThanOrEqual(0.5);
		expect(Math.abs(confirmedText.x - pendingTextBounds.x)).toBeLessThanOrEqual(0.5);
		expect(Math.abs(confirmedText.y - pendingTextBounds.y)).toBeLessThanOrEqual(0.5);
		await editor.fill("失败重试");
		await send.click();
		const retry = page.getByRole("button", { name: "重试", exact: true });
		await retry.focus();
		await expect(page.getByRole("tooltip")).toContainText("测试发送失败");
		await retry.click();
		await expect(page.getByRole("button", { name: "重试", exact: true })).toHaveCount(0);
		expect(retryKeys).toHaveLength(2);
		expect(retryKeys[0]).toBe(retryKeys[1]);
		await page
			.locator('input[type="file"]')
			.setInputFiles({ name: "photo.png", mimeType: "image/png", buffer: png });
		await expect.poll(() => Boolean(heldUpload)).toBe(true);
		await send.click();
		await expect(editor).toBeEmpty();
		await expect(page.getByRole("status").filter({ hasText: /图片上传中/ })).toBeVisible();
		const localImage = page.locator('article img[src^="blob:"]');
		await expect(localImage).toBeVisible();
		await expect
			.poll(() => localImage.evaluate((img) => (img as HTMLImageElement).naturalWidth))
			.toBeGreaterThan(0);
		await editor.fill("图片之后的文字");
		await editor.press("Enter");
		await expect(page.locator("article").filter({ hasText: "图片之后的文字" })).toBeVisible();
		await page.evaluate(() => {
			history.pushState({}, "", "/chat?c=c2");
			dispatchEvent(new PopStateEvent("popstate"));
		});
		await expect(page.getByText(/图片上传中/)).toHaveCount(0);
		await page.evaluate(() => {
			history.pushState({}, "", "/chat?c=c1");
			dispatchEvent(new PopStateEvent("popstate"));
		});
		await expect(page.getByRole("status").filter({ hasText: /图片上传中/ })).toBeVisible();
		await expect(
			page.getByRole("heading", { name: "c1", exact: true }).locator("../../../.."),
		).toHaveCSS("opacity", "1");
		await page.screenshot({
			path: testInfo.outputPath("uploading.png"),
			animations: "disabled",
		});
		if (!heldUpload) throw new Error("未捕获上传请求");
		await reply(heldUpload, { instant: true, file_id: "media", url: "/chat-test-image.png" });
		await expect(page.getByText(/图片上传中/)).toHaveCount(0);
		await expect(page.locator("article")).toHaveCount(4);
		await expect(page.locator('article img[src="/chat-test-image.png"]')).toBeVisible();
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
			true,
		);
		expect(errors).toEqual([]);
	});
}
