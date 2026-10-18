import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
	testDir: ".",
	testMatch: "**/*.spec.ts",
	globalSetup: "./global-setup.ts",
	timeout: 30_000,
	expect: { timeout: 5_000 },
	reporter: process.env.CI ? "github" : "list",
	use: { ...devices["Desktop Chrome"], viewport: { width: 1200, height: 700 } },
});
