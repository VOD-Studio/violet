import { defineConfig, devices } from "@playwright/test";

const SERVER_PORT = 4173;
const MOCK_PORT = 9410;

export default defineConfig({
	testDir: "./e2e",
	timeout: 60_000,
	expect: { timeout: 10_000 },
	reporter: process.env.CI ? "github" : "list",
	use: {
		baseURL: `http://127.0.0.1:${SERVER_PORT}`,
		...devices["Desktop Chrome"],
	},
	webServer: [
		{
			command: "node e2e/mock-api.mjs",
			port: MOCK_PORT,
			reuseExistingServer: !process.env.CI,
			env: { PORT: String(MOCK_PORT) },
		},
		{
			command: "node server.mjs",
			port: SERVER_PORT,
			reuseExistingServer: !process.env.CI,
			env: {
				PORT: String(SERVER_PORT),
				HOST: "127.0.0.1",
				VITE_SSR_API_BASE_URL: `http://127.0.0.1:${MOCK_PORT}/api/v1`,
			},
		},
	],
});
