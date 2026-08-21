import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "jsdom",
		globals: false,
		include: ["src/**/*.test.{ts,tsx}", "packages/*/src/**/*.test.{ts,tsx}"],
		setupFiles: ["src/test/setup.ts"],
	},
	resolve: {
		alias: {
			"#": resolve(__dirname, "src"),
			"@": resolve(__dirname, "src"),
			"@app": resolve(__dirname, "src/app"),
			"@routes": resolve(__dirname, "src/routes"),
			"@widgets": resolve(__dirname, "src/widgets"),
			"@features": resolve(__dirname, "src/features"),
			"@entities": resolve(__dirname, "src/entities"),
			"@shared": resolve(__dirname, "src/shared"),
			"@server": resolve(__dirname, "src/shared/server"),
			"@ui": resolve(__dirname, "src/shared/ui"),
			"@lib": resolve(__dirname, "src/shared/lib"),
			"@config": resolve(__dirname, "src/shared/config"),
			"@vendor/react-bits": resolve(__dirname, "src/shared/vendor/react-bits"),
		},
	},
});
