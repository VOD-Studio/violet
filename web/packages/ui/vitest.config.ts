import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const packageRoot = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	test: {
		root: packageRoot,
		environment: "jsdom",
		globals: false,
		include: ["src/**/*.test.{ts,tsx}", "tests/**/*.test.{ts,tsx}"],
		exclude: ["dist/**", "fixtures/**"],
		setupFiles: [resolve(packageRoot, "tests/setup.ts")],
		passWithNoTests: false,
	},
});
