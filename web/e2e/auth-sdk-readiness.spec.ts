import { type BrowserContext, expect, type Locator, type Page, test } from "@playwright/test";
import { loadClient } from "./client";
import { handle } from "./mock-data.mjs";
import { authenticated } from "./support";

const SDK_URL = "https://accounts.google.com/gsi/client";
const SDK_ERROR = "Google 登录组件加载失败，请使用其他登录方式或刷新页面重试。";
const IDENTIFIER = "reader@example.com";
const PASSWORD = "contract-password";

// 仅替换外部 GIS 边界；Provider、useGoogleOAuth 和各登录入口均运行真实实现。
const SDK_SCRIPT = `window.google = { accounts: { oauth2: {
  initTokenClient: () => ({ requestAccessToken: () => {
    void fetch('/oauth-sdk-request', { method: 'POST' });
  } })
} } };`;

async function prepareAuth(context: BrowserContext) {
	await loadClient(context);
	await context.route("**/api/v1/settings", async (route) => {
		const response = handle("GET", "/api/v1/settings", "");
		const body = JSON.parse(response.body);
		Object.assign(body.data, {
			google_login_enabled: true,
			github_login_enabled: true,
			google_client_id: "contract-google-client",
			github_client_id: "contract-github-client",
		});
		await route.fulfill({ json: body });
	});
	await context.route("**/api/v1/auth/csrf-token", (route) =>
		route.fulfill({ json: { data: { csrf_token: "contract-csrf" } } }),
	);
	await context.route("**/api/v1/auth/login", (route) =>
		route.fulfill({ status: 400, json: { error: "BAD_REQUEST", message: "契约登录未提交" } }),
	);
	await context.route("https://github.com/login/oauth/authorize**", (route) =>
		route.fulfill({ contentType: "text/html", body: "GitHub OAuth 外部边界" }),
	);
	await context.route("**/oauth-sdk-request", (route) => route.fulfill({ status: 204 }));
}

async function holdGoogleSdk(context: BrowserContext) {
	const { promise: outcome, resolve: finish } = Promise.withResolvers<"success" | "error">();
	await context.route(SDK_URL, async (route) => {
		if ((await outcome) === "error") await route.abort("failed");
		else await route.fulfill({ contentType: "application/javascript", body: SDK_SCRIPT });
	});
	return finish;
}

async function openAuthPage(page: Page, path: string) {
	// pending SDK 会延后 load；这里只等待 DOM 与客户端会话探活。
	await Promise.all([
		page.waitForResponse("**/api/v1/auth/me"),
		page.goto(path, { waitUntil: "domcontentloaded" }),
	]);
}

async function openSecurity(context: BrowserContext, page: Page) {
	await authenticated(context, []);
	await context.route("**/api/v1/auth/me", async (route) => {
		const response = handle("GET", "/api/v1/auth/me", "", "contract_admin=1");
		const body = JSON.parse(response.body);
		Object.assign(body.data, { has_password: true, google_bound: false, github_bound: false });
		await route.fulfill({ json: body });
	});
	await openAuthPage(page, "/profile");
	await page.getByRole("tab", { name: "账户与安全" }).click();
	await expect(page.getByRole("heading", { name: "登录方式", exact: true })).toBeVisible();
}

async function openLoginSurface(
	context: BrowserContext,
	page: Page,
	surface: "page" | "inline" | "dialog",
) {
	if (surface === "page") {
		await openAuthPage(page, "/login");
		return page.locator("form");
	}
	if (surface === "inline") {
		await openAuthPage(page, "/blog/contract-rich-code");
		const card = page.getByText("加入讨论", { exact: true }).locator("../../..");
		await card.getByRole("button", { name: "登录", exact: true }).click();
		await card.getByRole("button", { name: "使用账号密码登录" }).click();
		return card;
	}
	await openSecurity(context, page);
	await context.route("**/api/v1/auth/password", (route) =>
		route.fulfill({ status: 401, json: { error: "UNAUTHORIZED", message: "会话已失效" } }),
	);
	await page.getByRole("button", { name: "修改密码", exact: true }).click();
	await page.getByLabel("原密码", { exact: true }).fill(PASSWORD);
	await page.getByLabel("新密码", { exact: true }).fill(PASSWORD);
	await page.getByLabel("确认新密码", { exact: true }).fill(PASSWORD);
	await page.getByRole("button", { name: "确认修改", exact: true }).click();
	const dialog = page.getByRole("dialog", { name: "重新登录" });
	await expect(dialog).toBeVisible();
	return dialog;
}

async function expectOtherLoginsWork(page: Page, surface: Locator) {
	const github = surface.getByRole("button", { name: "GitHub", exact: true });
	await expect(github).toBeEnabled();
	const [popup] = await Promise.all([page.waitForEvent("popup"), github.click()]);
	await expect(popup).toHaveURL(/github\.com\/login\/oauth\/authorize\?/);
	await popup.close();
	const submit = surface.getByRole("button", { name: "登录", exact: true });
	await expect(submit).toBeEnabled();
	const [request] = await Promise.all([
		page.waitForRequest("**/api/v1/auth/login"),
		submit.click(),
	]);
	expect(request.postDataJSON()).toEqual({ identifier: IDENTIFIER, password: PASSWORD });
}

for (const surface of ["page", "inline", "dialog"] as const) {
	for (const outcome of ["success", "error"] as const) {
		test(`${surface}: Google SDK pending → ${outcome} 保留输入与其他登录方式`, async ({
			context,
			page,
		}) => {
			await prepareAuth(context);
			const release = await holdGoogleSdk(context);
			const content = await openLoginSurface(context, page, surface);
			const google = content.getByRole("button", { name: "Google", exact: true });
			await expect(google).toBeDisabled();
			const identifier = content.getByRole("textbox", { name: /账号|用户名或邮箱/ });
			const password = content.getByLabel("密码", { exact: true });
			await identifier.fill(IDENTIFIER);
			await password.fill(PASSWORD);
			const inputNode = await identifier.elementHandle();
			await expectOtherLoginsWork(page, content);
			release(outcome);
			if (outcome === "error") {
				await expect(content.getByRole("alert")).toHaveText(SDK_ERROR);
				await expect(google).toBeDisabled();
				await expectOtherLoginsWork(page, content);
			} else {
				await expect(google).toBeEnabled();
				await Promise.all([page.waitForRequest("**/oauth-sdk-request"), google.click()]);
			}
			await expect(identifier).toHaveValue(IDENTIFIER);
			await expect(password).toHaveValue(PASSWORD);
			expect(await inputNode?.evaluate((node) => node.isConnected)).toBe(true);
		});
	}
}

for (const outcome of ["success", "error"] as const) {
	test(`绑定: Google SDK pending → ${outcome} 不阻断 GitHub`, async ({ context, page }) => {
		await prepareAuth(context);
		const release = await holdGoogleSdk(context);
		await openSecurity(context, page);
		const google = page
			.locator("dl > div")
			.filter({ has: page.getByText("Google", { exact: true }) });
		const github = page
			.locator("dl > div")
			.filter({ has: page.getByText("GitHub", { exact: true }) });
		await expect(google.getByRole("button", { name: "绑定", exact: true })).toBeDisabled();
		await expect(github.getByRole("button", { name: "绑定", exact: true })).toBeEnabled();
		release(outcome);
		if (outcome === "error") {
			await expect(page.getByRole("alert")).toHaveText(SDK_ERROR);
			await expect(google.getByRole("button", { name: "绑定", exact: true })).toBeDisabled();
		} else {
			await expect(google.getByRole("button", { name: "绑定", exact: true })).toBeEnabled();
			await Promise.all([
				page.waitForRequest("**/oauth-sdk-request"),
				google.getByRole("button", { name: "绑定", exact: true }).click(),
			]);
		}
		const [popup] = await Promise.all([
			page.waitForEvent("popup"),
			github.getByRole("button", { name: "绑定", exact: true }).click(),
		]);
		await expect(popup).toHaveURL(/github\.com\/login\/oauth\/authorize\?/);
		await popup.close();
	});
}
