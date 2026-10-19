import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
	testDir: ".",
	testMatch: "**/*.spec.ts",
	globalSetup: "./global-setup.ts",
	// CI 机器同时跑别的任务，默认按核数开的并发会让 Chromium 因资源不足崩溃；与站点契约用例一样限两个
	workers: process.env.CI ? 2 : undefined,
	timeout: 30_000,
	expect: { timeout: 5_000 },
	reporter: process.env.CI ? "github" : "list",
	use: { ...devices["Desktop Chrome"], viewport: { width: 1200, height: 700 } },
});
