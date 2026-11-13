import { expect, type Route, test } from "@playwright/test";
import { loadClient } from "./client";
import { openClientPage } from "./support";

test("Header 博客二级菜单只标记精确命中的当前页", async ({ page, context }) => {
	await loadClient(context);
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	for (const route of [
		{ path: "/blog/archive", current: "归档", inactive: "全部文章" },
		{ path: "/blog", current: "全部文章", inactive: "归档" },
	]) {
		await page.goto(route.path);
		await page.waitForLoadState("networkidle");
		await page
			.getByRole("navigation", { name: "主导航" })
			.getByRole("link", { name: "博客", exact: true })
			.hover();
		const panel = page.getByRole("group", { name: "博客二级菜单" });
		await expect(
			panel.getByRole("link", { name: new RegExp(`^${route.current}`) }),
		).toHaveAttribute("aria-current", "page");
		await expect(
			panel.getByRole("link", { name: new RegExp(`^${route.inactive}`) }),
		).not.toHaveAttribute("aria-current");
	}
});

test("Header logo 药丸点击展开站长卡片，Esc 与点外面收起并归还焦点", async ({ page, context }) => {
	await loadClient(context);
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto("/blog");
	await page.waitForLoadState("networkidle");
	const trigger = page.getByRole("button", { name: /站长档案/ });
	const card = page.getByRole("dialog", { name: "站长与此刻" });

	// 悬停不再展开，点击才展开
	await trigger.hover();
	await expect(card).toHaveCount(0);
	await trigger.click();
	await expect(trigger).toHaveAttribute("aria-expanded", "true");
	await expect(card).toBeVisible();
	await expect(card.getByRole("link", { name: "关于我" })).toHaveAttribute("href", "/about");
	await expect(card.getByRole("link", { name: "人设" })).toHaveAttribute("href", "/persona");
	await expect(card.getByRole("link", { name: "友链" })).toHaveAttribute("href", "/friends");
	// 最新文章与最新手记各一条，取自站点数据
	await expect(card.getByText("新文章")).toBeVisible();
	await expect(card.getByText("新手记")).toBeVisible();

	await page.keyboard.press("Escape");
	await expect(card).toHaveCount(0);
	await expect(trigger).toBeFocused();

	await trigger.click();
	await expect(card).toBeVisible();
	await page.mouse.click(1300, 700);
	await expect(card).toHaveCount(0);

	await trigger.click();
	await card.getByRole("link", { name: "人设" }).click();
	await expect(page).toHaveURL(/\/persona$/);
	await expect(card).toHaveCount(0);
});

test("站长药丸、资料卡与首页缺图时使用同一姓名首字和中性底色", async ({ page, context }) => {
	await loadClient(context);
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await openClientPage(page, "/");
	const trigger = page.getByRole("button", { name: /站长档案/ });
	const brandAvatar = trigger.locator('[data-slot="brand-avatar"]');
	const homeAvatar = page.getByRole("region", { name: "首页序章" }).getByRole("img", {
		name: "contract",
		exact: true,
	});
	await expect(brandAvatar).toHaveText("C");
	await expect(homeAvatar).toHaveText("C");
	await trigger.click();
	const profileAvatar = page
		.getByRole("dialog", { name: "站长与此刻" })
		.locator('[data-slot="profile-avatar"]');
	await expect(profileAvatar).toHaveText("C");
	const backgroundOf = (element: HTMLElement) =>
		getComputedStyle(element, "::before").backgroundColor;
	const background = await homeAvatar.evaluate(backgroundOf);
	expect(background).not.toBe("rgba(0, 0, 0, 0)");
	expect(await brandAvatar.evaluate(backgroundOf)).toBe(background);
	expect(await profileAvatar.evaluate(backgroundOf)).toBe(background);
});

test("Header 右药丸的控件常驻可见，游客只有季节与外观和登录", async ({ page, context }) => {
	await loadClient(context);
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto("/blog");
	await page.waitForLoadState("networkidle");
	// 不悬停、不聚焦：右药丸里的入口一开始就看得见
	const header = page.locator("header").first();
	await expect(header.getByRole("button", { name: /^季节与外观：/ })).toBeVisible();
	await expect(header.getByRole("link", { name: "登录", exact: true })).toBeVisible();
	await expect(header.getByRole("button", { name: /^消息/ })).toHaveCount(0);
	await expect(header.getByRole("button", { name: "用户菜单" })).toHaveCount(0);
	// 外观与主题合并成同一个入口：面板里有明暗三态，顶栏没有独立的外观开关
	await expect(header.getByRole("radiogroup", { name: "外观切换" })).toHaveCount(0);
	await header.getByRole("button", { name: /^季节与外观：/ }).click();
	const panel = page.getByRole("dialog", { name: "季节与外观", exact: true });
	await expect(panel.getByRole("radiogroup", { name: "外观切换" })).toBeVisible();
	await expect(panel.getByRole("radiogroup", { name: "主题", exact: true })).toBeVisible();
});

test("Header 一级入口随登录态：聊天在 SSR 首帧就已确定，水合无差异", async ({ page, context }) => {
	await loadClient(context);
	const hydrationErrors: string[] = [];
	page.on("pageerror", (error) => {
		if (/hydration|hydrated|React error #418/i.test(error.message)) {
			hydrationErrors.push(error.message);
		}
	});
	const navOf = (html: string) =>
		html.match(/<nav[^>]*aria-label="主导航"[\s\S]*?<\/nav>/)?.[0] ?? "";

	const guest = await context.request.get("/");
	expect(navOf(await guest.text())).not.toContain("聊天");

	await context.addCookies([
		{ name: "contract_admin", value: "1", url: "http://127.0.0.1:4173" },
	]);
	const member = await context.request.get("/");
	expect(navOf(await member.text())).toContain("聊天");

	await page.setViewportSize({ width: 1440, height: 900 });
	await page.goto("/");
	await page.waitForLoadState("networkidle");
	await expect(
		page.getByRole("navigation", { name: "主导航" }).getByRole("link", { name: "聊天" }),
	).toHaveAttribute("href", "/chat");
	expect(hydrationErrors).toEqual([]);
});

test("Header 在已登录页面登出后，导航立即回到游客入口", async ({ page, context }) => {
	await loadClient(context);
	await context.addCookies([
		{ name: "contract_admin", value: "1", url: "http://127.0.0.1:4173" },
	]);
	await page.route("**/api/v1/auth/logout", (route) =>
		route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({ data: { message: "ok" } }),
		}),
	);
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.goto("/");
	await page.waitForLoadState("networkidle");
	const nav = page.getByRole("navigation", { name: "主导航" });
	await expect(nav.getByRole("link", { name: "聊天" })).toBeVisible();

	await page.getByRole("button", { name: "用户菜单" }).click();
	await page
		.getByRole("dialog", { name: "用户菜单" })
		.getByRole("button", { name: "登出", exact: true })
		.click();

	await expect(nav.getByRole("link", { name: "聊天" })).toHaveCount(0);
	await expect(
		page.locator("header").getByRole("link", { name: "登录", exact: true }),
	).toBeVisible();
});

test("Header 向下滚动后导航收起，往回滚恢复", async ({ page, context }) => {
	await loadClient(context);
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.goto("/");
	await page.waitForLoadState("networkidle");
	const bar = page.locator('[data-slot="site-navbar"]');
	const right = page.locator('[data-slot="navbar-right"]');
	await expect(bar).toHaveAttribute("data-collapsed", "false");

	await page.evaluate(() => window.scrollTo(0, 800));
	await expect(bar).toHaveAttribute("data-collapsed", "true");
	await expect(right).toHaveAttribute("inert", "");
	await expect(
		page.getByRole("navigation", { name: "主导航" }).getByRole("link", { name: "首页" }),
	).toBeVisible();

	await page.evaluate(() => window.scrollTo(0, 700));
	await expect(bar).toHaveAttribute("data-collapsed", "false");
	await expect(right).not.toHaveAttribute("inert");
});

test("Header 路由切换超过 300ms 才在导航下沿显示加载进度线，完成后收起", async ({
	page,
	context,
}) => {
	await loadClient(context);
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.goto("/");
	await page.waitForLoadState("networkidle");
	const line = page.getByRole("progressbar", { name: "页面加载" });

	let release: (() => void) | undefined;
	const gate = new Promise<void>((resolve) => {
		release = resolve;
	});
	await page.route("**/api/v1/notes**", async (route) => {
		await gate;
		await route.fallback();
	});
	await page
		.getByRole("navigation", { name: "主导航" })
		.getByRole("link", { name: "手记" })
		.click();
	await expect(line).toBeVisible();
	expect(Number(await line.getAttribute("aria-valuenow"))).toBeLessThan(100);

	release?.();
	await expect(page).toHaveURL(/\/notes$/);
	await expect(line).toHaveCount(0);
});

test("Header 消息铃铛：从整枚右胶囊展开，通知与聊天两个标签；不在聊天室时新消息弹轻提示", async ({
	page,
	context,
}) => {
	await loadClient(context);
	await context.addCookies([
		{ name: "contract_admin", value: "1", url: "http://127.0.0.1:4173" },
	]);
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.emulateMedia({ reducedMotion: "reduce" });

	const envelope = (data: unknown) => JSON.stringify({ data });
	const paged = (data: unknown[]) =>
		JSON.stringify({
			data,
			meta: { pagination: { page: 1, limit: 20, total: data.length, total_pages: 1 } },
		});
	const ME = "30000000-0000-0000-0000-000000000001";
	const CLAUDE = { id: "bot", username: "claude", display_name: "Claude", avatar_url: "" };
	const message = (id: string, content: string) => ({
		id,
		conversation_id: "c1",
		sender: CLAUDE,
		type: "text",
		content,
		reactions: [],
		is_deleted: false,
		created_at: new Date().toISOString(),
	});
	let conversation = {
		id: "c1",
		kind: "direct",
		title: "",
		owner: CLAUDE,
		members: [
			{
				user: { ...CLAUDE, id: ME, username: "contract" },
				role: "owner",
				joined_at: "",
				is_muted: false,
			},
			{ user: CLAUDE, role: "member", joined_at: "", is_muted: false },
		],
		last_message: message("m0", "早上好"),
		unread_count: 0,
		created_at: "2026-11-01T00:00:00Z",
		updated_at: new Date().toISOString(),
	};
	const json = (route: Route, body: string) =>
		route.fulfill({ status: 200, contentType: "application/json", body });
	await page.route("**/api/v1/notifications?**", (route) =>
		json(
			route,
			paged([
				{
					id: "n1",
					source_type: "comment_created",
					source_id: "s1",
					title: "林间 评论了你的文章",
					body: "",
					payload: {},
					actor: { name: "林间" },
					object_title: "拆解 Saber",
					quote: "二十行是乐观估计吧",
					is_read: false,
					created_at: new Date().toISOString(),
				},
			]),
		),
	);
	await page.route("**/api/v1/notifications/unread-count", (route) =>
		json(route, envelope({ unread_count: 1 })),
	);
	await page.route("**/api/v1/notifications/push/config**", (route) =>
		json(route, envelope({ public_key: "", enabled: false, subscribed: false })),
	);
	await page.route("**/api/v1/chat/conversations?**", (route) =>
		json(route, paged([conversation])),
	);
	await page.route("**/api/v1/chat/unread-count", (route) =>
		json(route, envelope({ unread_count: conversation.unread_count })),
	);
	// 两条事件流换成可手动推送的替身
	await page.addInitScript(() => {
		type Listener = (event: MessageEvent) => void;
		const sources: StubEventSource[] = [];
		class StubEventSource {
			url: string;
			listeners: Record<string, Listener[]> = {};
			onopen: (() => void) | null = null;
			constructor(url: string) {
				this.url = url;
				sources.push(this);
			}
			addEventListener(type: string, callback: Listener) {
				this.listeners[type] = [...(this.listeners[type] ?? []), callback];
			}
			close() {}
		}
		Object.assign(window, {
			EventSource: StubEventSource,
			__emitChat: (payload: unknown) => {
				for (const source of sources.filter((item) => item.url.endsWith("/chat/events"))) {
					for (const callback of source.listeners.chat ?? []) {
						callback(new MessageEvent("chat", { data: JSON.stringify(payload) }));
					}
				}
			},
		});
	});
	const emitIncoming = async () => {
		conversation = {
			...conversation,
			last_message: message("m1", "摘要已经整理好了"),
			unread_count: 1,
		};
		await page.evaluate((sender) => {
			const emit = Reflect.get(window, "__emitChat");
			if (typeof emit !== "function") throw new Error("事件流替身未就绪");
			emit({
				id: "1",
				type: "message.created",
				version: 1,
				occurred_at: new Date().toISOString(),
				data: { conversation_id: "c1", message_id: "m1", sender_id: sender },
			});
		}, CLAUDE.id);
	};

	await page.goto("/");
	await page.waitForLoadState("networkidle");
	const header = page.locator("header").first();
	const bell = header.getByRole("button", { name: /^消息/ });
	await expect(bell).toHaveAttribute("aria-label", "消息，1 条未读");

	const pill = header.locator('[data-slot="morphing-popover-anchor"]');
	const anchorBox = await pill.boundingBox();
	await bell.click();
	const panel = page.getByRole("dialog", { name: "消息" });
	await expect(panel).toBeVisible();
	await expect(pill).toHaveAttribute("inert", "");
	const box = await panel.boundingBox();
	const panelRight = (box?.x ?? 0) + (box?.width ?? 0);
	const anchorRight = (anchorBox?.x ?? 0) + (anchorBox?.width ?? 0);
	expect(Math.abs(panelRight - anchorRight)).toBeLessThan(3);
	await expect(
		panel.getByRole("button", {
			name: /^林间 评论了你的文章《拆解 Saber》：二十行是乐观估计吧。.+，未读$/,
		}),
	).toBeVisible();
	await panel.getByRole("tab", { name: /^聊天/ }).click();
	await expect(panel.getByRole("button", { name: /^Claude，早上好/ })).toBeVisible();
	await expect(panel.getByRole("link", { name: "进入聊天室" })).toHaveAttribute("href", "/chat");
	await page.keyboard.press("Escape");
	await expect(panel).toHaveCount(0);

	// 不在聊天室：新消息弹轻提示、角标计入，几秒后提示收起而角标仍在
	// 指针停在提示上会暂停计时（读不完不收），先把它移开
	await page.mouse.move(600, 600);
	const toast = page.getByRole("status").filter({ hasText: "Claude" });
	await emitIncoming();
	await expect(toast).toContainText("Claude 发来一条消息");
	await expect(toast).toContainText("摘要已经整理好了");
	await expect(bell).toHaveAttribute("aria-label", "消息，2 条未读");
	await expect(toast).toHaveCount(0, { timeout: 9000 });
	await expect(bell).toHaveAttribute("aria-label", "消息，2 条未读");

	// 在聊天室里：同样的新消息不弹提示
	await page
		.getByRole("navigation", { name: "主导航" })
		.getByRole("link", { name: "聊天" })
		.click();
	await expect(page).toHaveURL(/\/chat$/);
	// 会话列表刷新到这条消息之后才会弹提示；等刷新完成再断言「没有弹」
	const refreshed = page.waitForResponse((response) =>
		response.url().includes("/api/v1/chat/conversations"),
	);
	await emitIncoming();
	await refreshed;
	await expect(toast).toHaveCount(0);
});

test("Header 账号面板可按 Tab 操作，Esc 回到头像后可打开消息面板", async ({ page, context }) => {
	await loadClient(context);
	await context.addCookies([
		{ name: "contract_admin", value: "1", url: "http://127.0.0.1:4173" },
	]);
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	const json = (route: Route, body: unknown) =>
		route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify(body),
		});
	const empty = {
		data: [],
		meta: { pagination: { page: 1, limit: 20, total: 0, total_pages: 1 } },
	};
	await page.route("**/api/v1/notifications?**", (route) => json(route, empty));
	await page.route("**/api/v1/notifications/unread-count", (route) =>
		json(route, { data: { unread_count: 0 } }),
	);
	await page.route("**/api/v1/notifications/push/config**", (route) =>
		json(route, { data: { public_key: "", enabled: false, subscribed: false } }),
	);
	await page.route("**/api/v1/chat/conversations?**", (route) => json(route, empty));
	await page.route("**/api/v1/chat/unread-count", (route) =>
		json(route, { data: { unread_count: 0 } }),
	);

	await page.goto("/");
	await page.waitForLoadState("networkidle");
	const header = page.locator("header").first();
	const account = header.getByRole("button", { name: "用户菜单" });
	await account.click();
	const accountPanel = page.getByRole("dialog", { name: "用户菜单" });
	await expect(accountPanel).toBeVisible();
	await expect(accountPanel.getByRole("link", { name: "个人中心" })).toBeFocused();
	await page.keyboard.press("Tab");
	await expect(accountPanel.getByRole("link", { name: "后台管理" })).toBeFocused();
	await page.keyboard.press("Tab");
	await expect(accountPanel.getByRole("button", { name: "登出" })).toBeFocused();
	await page.keyboard.press("Escape");
	await expect(accountPanel).toHaveCount(0);
	await expect(account).toBeFocused();

	await header.getByRole("button", { name: "消息", exact: true }).click();
	const panel = page.getByRole("dialog", { name: "消息", exact: true });
	await expect(panel).toBeVisible();
	await expect
		.poll(() => panel.evaluate((node) => node.contains(document.activeElement)))
		.toBe(true);
	await page.keyboard.press("Escape");
	await expect(panel).toHaveCount(0);
	await expect(header.getByRole("button", { name: "消息", exact: true })).toBeFocused();
});

test("Header 右药丸分隔线居中，未读 9、99、99+ 不遮挡头像", async ({ page, context }) => {
	await loadClient(context);
	await context.addCookies([
		{ name: "contract_admin", value: "1", url: "http://127.0.0.1:4173" },
	]);
	let unread = 9;
	await page.route("**/api/v1/notifications/unread-count", (route) =>
		route.fulfill({ json: { data: { unread_count: unread } } }),
	);
	await page.route("**/api/v1/chat/unread-count", (route) =>
		route.fulfill({ json: { data: { unread_count: 0 } } }),
	);
	for (const width of [320, 1440]) {
		await page.setViewportSize({ width, height: 900 });
		for (const count of [9, 99, 100]) {
			unread = count;
			await page.goto("/");
			const right = page.locator('header [data-slot="navbar-right"]');
			const bell = right.getByRole("button", { name: `消息，${count} 条未读` });
			await expect(bell).toBeVisible();
			const badge = bell.locator('[data-slot="count"]');
			await expect(badge).toHaveText(count > 99 ? "99+" : String(count));
			const geometry = await right.evaluate((pill) => {
				const rect = (selector: string) => {
					const element = pill.querySelector(selector);
					if (!element) throw new Error(`缺少页头控件：${selector}`);
					return element.getBoundingClientRect();
				};
				const avatar = rect('button[aria-label="用户菜单"]');
				const badge = rect('[data-slot="count"]');
				const separator = rect('[data-orientation="vertical"]');
				const bell = rect('button[aria-label^="消息"]');
				const box = pill.getBoundingClientRect();
				return {
					gap: avatar.left - badge.right,
					centerOffset: separator.top + separator.height / 2 - (box.top + box.height / 2),
					aboveCenter: badge.bottom <= bell.top + bell.height / 2 + 3,
					overlapsBell: badge.left < bell.right && badge.right > bell.right,
					right: box.right,
					left: box.left,
				};
			});
			expect(geometry.gap).toBeGreaterThanOrEqual(4);
			expect(geometry.aboveCenter).toBe(true);
			expect(geometry.overlapsBell).toBe(true);
			expect(Math.abs(geometry.centerOffset)).toBeLessThanOrEqual(1);
			expect(geometry.left).toBeGreaterThanOrEqual(0);
			expect(geometry.right).toBeLessThanOrEqual(width);
		}
	}
});
