import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// 管理设置页依赖的 hooks 与守卫按条件打桩（persisted 由用例切换）
const mocks = vi.hoisted(() => ({
	authData: { google_login_enabled: true, github_login_enabled: true },
	oauthStatus: {
		google: { configured: true, client_id_preview: "xxxx...xx", issue: "" },
		github: { configured: true, client_id_preview: "0v23liT", issue: "" },
		persisted: true,
	},
}));

vi.mock("@features/admin-settings/api/queries", () => ({
	useAuthSettings: () => ({ data: mocks.authData, isLoading: false }),
	useOAuthStatus: () => ({ data: mocks.oauthStatus }),
	useUpdateAuth: () => ({ mutateAsync: vi.fn().mockResolvedValue({}), isPending: false }),
	useUpdateOAuthCredentials: () => ({
		mutateAsync: vi.fn().mockResolvedValue({ persisted: true }),
		isPending: false,
	}),
	useVerifyOAuth: () => ({ mutateAsync: vi.fn().mockResolvedValue({}), isPending: false }),
}));
vi.mock("@features/admin-layout/ui/PageShell", () => ({
	PageShell: ({
		title,
		children,
		action,
	}: {
		title: string;
		children?: React.ReactNode;
		action?: React.ReactNode;
	}) => (
		<div>
			<h1>{title}</h1>
			{action}
			{children}
		</div>
	),
}));

Object.assign(navigator, {
	clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
});
Object.defineProperty(window, "isSecureContext", {
	value: true,
	configurable: true,
});

import { AuthSettingsPage } from "../admin.settings.auth";

function renderPage() {
	const qc = new QueryClient();
	render(
		<QueryClientProvider client={qc}>
			<AuthSettingsPage />
		</QueryClientProvider>,
	);
}

describe("认证设置页 OAuth 持久化提示", () => {
	beforeEach(() => {
		vi.mocked(navigator.clipboard.writeText).mockClear();
		mocks.oauthStatus.persisted = true;
	});

	it("已持久化时不出现警告块", () => {
		renderPage();
		expect(screen.queryByText(/未持久化/)).toBeNull();
	});
	it("未持久化时展示红色警告与诊断命令，并可复制", async () => {
		mocks.oauthStatus.persisted = false;
		renderPage();
		expect(screen.getByText(/API 重启后将回退 \.env 旧值/)).toBeTruthy();
		const cmd = screen.getByText(/docker exec/);
		expect(cmd.textContent).toContain("/app/.env");

		fireEvent.click(screen.getByRole("button", { name: "复制诊断命令" }));
		await waitFor(() => {
			expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
				expect.stringContaining("docker exec"),
			);
		});
		expect(screen.getByText("已复制")).toBeTruthy();
	});
});
