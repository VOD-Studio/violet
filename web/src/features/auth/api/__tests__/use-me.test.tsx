import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@shared/api/request", () => ({ apiGet: vi.fn() }));

import { apiGet } from "@shared/api/request";
import { clearSessionActive, markSessionActive } from "@shared/api/session";
import { useMe } from "../queries";

function renderUseMe(options?: { enabled?: boolean }) {
	const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	return renderHook(() => useMe(options), {
		wrapper: ({ children }: { children: ReactNode }) => (
			<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
		),
	});
}

afterEach(() => {
	act(() => clearSessionActive());
	vi.clearAllMocks();
});

describe("当前登录用户查询", () => {
	it("游客没有会话，不向后端询问身份", async () => {
		const { result } = renderUseMe({ enabled: true });
		// 请求在挂载后的 effect 里发起，让出一轮再断言
		await act(async () => {});
		expect(apiGet).not.toHaveBeenCalled();
		expect(result.current.data).toBeUndefined();
	});

	it("会话建立后取回用户资料", async () => {
		vi.mocked(apiGet).mockResolvedValue({ id: "u1", username: "alice" });
		const { result } = renderUseMe();
		act(() => markSessionActive());
		await waitFor(() => expect(result.current.data).toEqual({ id: "u1", username: "alice" }));
		expect(apiGet).toHaveBeenCalledWith("/auth/me", { __skipAuthDialog: true });
	});

	it("调用方停用时有会话也不请求", async () => {
		act(() => markSessionActive());
		renderUseMe({ enabled: false });
		await act(async () => {});
		expect(apiGet).not.toHaveBeenCalled();
	});
});
