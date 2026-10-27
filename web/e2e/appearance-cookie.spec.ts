import { expect, test } from "@playwright/test";
import { loadClient } from "./client";
import { CONTRACT_ORIGIN } from "./theme-harness";

for (const appearance of ["light", "dark"] as const) {
	test(`旧外观 cookie：${appearance} 在禁用 JS 时由 SSR 迁移`, async ({ browser }) => {
		const context = await browser.newContext({ javaScriptEnabled: false });
		await context.addCookies([{ name: "theme", value: appearance, url: CONTRACT_ORIGIN }]);
		await loadClient(context);
		const page = await context.newPage();
		await page.goto("/", { waitUntil: "load" });
		await expect(page.locator("html")).toHaveClass(appearance);
		const migrated = (await context.cookies()).find((cookie) => cookie.name === "appearance");
		expect(migrated?.value).toBe(appearance);
		expect(migrated?.path).toBe("/");
		expect(migrated?.sameSite).toBe("Lax");
		expect(migrated?.expires).toBeGreaterThan(Date.now() / 1000 + 364 * 86400);
		await context.close();
	});
}

test("新外观 cookie 优先于旧偏好", async ({ browser }) => {
	const context = await browser.newContext({ javaScriptEnabled: false });
	await context.addCookies([
		{ name: "theme", value: "dark", url: CONTRACT_ORIGIN },
		{ name: "appearance", value: "light", url: CONTRACT_ORIGIN },
	]);
	await loadClient(context);
	const page = await context.newPage();
	await page.goto("/", { waitUntil: "load" });
	await expect(page.locator("html")).toHaveClass("light");
	expect((await context.cookies()).find((cookie) => cookie.name === "appearance")?.value).toBe(
		"light",
	);
	await context.close();
});

test("旧 system 偏好迁移后仍跟随系统，手动切换只更新新 cookie", async ({ browser }) => {
	const context = await browser.newContext({ colorScheme: "dark", reducedMotion: "reduce" });
	await context.addCookies([{ name: "theme", value: "dark", url: CONTRACT_ORIGIN }]);
	await context.addInitScript(() => localStorage.setItem("theme", "system"));
	await loadClient(context);
	const page = await context.newPage();
	await page.goto("/", { waitUntil: "load" });
	const header = page.locator("header").first();
	await expect(header.getByRole("radio", { name: "跟随系统", exact: true })).toHaveAttribute(
		"aria-checked",
		"true",
	);
	await expect(page.locator("html")).toHaveClass(/\bdark\b/);
	await page.emulateMedia({ colorScheme: "light" });
	await expect(page.locator("html")).toHaveClass(/\blight\b/);
	await expect
		.poll(
			async () =>
				(await context.cookies()).find((cookie) => cookie.name === "appearance")?.value,
		)
		.toBe("light");
	await header.getByRole("link", { name: "登录", exact: true }).hover();
	await header.getByRole("radio", { name: "暗黑", exact: true }).click();
	await expect(page.locator("html")).toHaveClass(/\bdark\b/);
	await expect
		.poll(
			async () =>
				(await context.cookies()).find((cookie) => cookie.name === "appearance")?.value,
		)
		.toBe("dark");
	expect((await context.cookies()).find((cookie) => cookie.name === "theme")?.value).toBe("dark");
	expect(await page.evaluate(() => localStorage.getItem("theme"))).toBe("dark");
	await context.close();
});
