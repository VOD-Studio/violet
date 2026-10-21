import { expect, test } from "@playwright/test";
import jsQR from "jsqr";
import { PNG } from "pngjs";
import { loadClient } from "./client";
import { authenticated, openClientPage } from "./support";

const LOGIN_URL = "https://music.163.com/login?codekey=0123456789abcdef0123456789abcdef00000000";

for (const appearance of [
	{ name: "亮色桌面", theme: "light", width: 1280, height: 900, deviceScaleFactor: 1 },
	{ name: "暗色窄屏", theme: "dark", width: 390, height: 844, deviceScaleFactor: 2 },
] as const) {
	test.describe(appearance.name, () => {
		test.use({
			viewport: { width: appearance.width, height: appearance.height },
			deviceScaleFactor: appearance.deviceScaleFactor,
			colorScheme: appearance.theme,
		});

		test("扫码弹窗的实际截图可解码为服务端提供的完整登录 URL", async ({ page, context }) => {
			await loadClient(context);
			await authenticated(context, ["admin:access", "music:manage"]);
			await context.addCookies([
				{ name: "theme", value: appearance.theme, url: "http://127.0.0.1:4173" },
			]);
			await context.addInitScript(
				(theme) => localStorage.setItem("theme", theme),
				appearance.theme,
			);
			await context.route("**/api/v1/admin/music/**", async (route) => {
				const request = route.request();
				const path = new URL(request.url()).pathname.replace("/api/v1/admin/music", "");
				const responses: Record<string, unknown> = {
					"GET /status": {
						configured: true,
						credential_storage_ready: true,
						base_url: "http://kite:3721",
					},
					"GET /account": { state: "disconnected", profile: null },
					"GET /playlists": [],
					"POST /login/qr": {
						id: "scanability",
						url: LOGIN_URL,
						expires_at: new Date(Date.now() + 180_000).toISOString(),
					},
					"POST /login/qr/scanability/check": { state: "waiting", account: null },
					"DELETE /login/qr/scanability": null,
				};
				const key = `${request.method()} ${path}`;
				if (!(key in responses)) return route.fallback();
				await route.fulfill({ json: { data: responses[key] } });
			});

			await openClientPage(page, "/admin/music");
			await page.getByRole("button", { name: "扫码连接账号" }).click();
			const qr = page.getByRole("img", { name: "网易云登录二维码" });
			await expect(qr).toBeVisible();
			const image = PNG.sync.read(await qr.screenshot());
			const decoded = jsQR(new Uint8ClampedArray(image.data), image.width, image.height);
			expect(decoded?.data).toBe(LOGIN_URL);
		});
	});
}
