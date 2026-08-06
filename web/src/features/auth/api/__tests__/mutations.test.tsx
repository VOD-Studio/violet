/**
 * auth mutations 缓存行为测试
 *
 * 验证登录/登出/改资料/改密码的 onSuccess 缓存副作用：
 *   - useLogout：cancelQueries + me 置 null + 移除 csrf-token 缓存 + clearSessionActive
 *   - useLogin：invalidate me + markSessionActive
 *   - useUpdateProfile：setQueryData 合并更新 me
 *   - useChangePassword：invalidate me
 *
 * 范式复制 comments/api/__tests__/useCreateComment.test.tsx。
 */
import type { UserDTO } from "@entities/user/model/types";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// mock 整个 request 模块（列出所有导出，避免别处 import 拿到 undefined）
vi.mock("@shared/api/request", () => ({
	apiPost: vi.fn(),
	apiGet: vi.fn(),
	apiPatch: vi.fn(),
	apiDelete: vi.fn(),
	apiPut: vi.fn(),
	apiGetPaged: vi.fn(),
}));

// mock csrf：login 走 getCSRFToken() 读 cookie，这里固定返回空避免 jsdom cookie 干扰
vi.mock("@shared/api/csrf", () => ({
	CSRF_HEADER: "X-CSRF-Token",
	getCSRFToken: vi.fn(() => ""),
}));

import { apiPatch, apiPost } from "@shared/api/request";
import { useSessionStore } from "@shared/api/session";
import { authKeys } from "../keys";
import { useChangePassword, useLogin, useLogout, useUpdateProfile } from "../mutations";

function createWrapper(qc: QueryClient) {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	return ({ children }: any) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

function makeUser(overrides: Partial<UserDTO> = {}): UserDTO {
	return {
		id: "u1",
		username: "alice",
		email: "alice@example.com",
		avatar_url: "",
		bio: "",
		role: "user",
		is_root: false,
		email_verified: true,
		is_active: true,
		created_at: "2026-01-01T00:00:00Z",
		permissions: [],
		...overrides,
	};
}

describe("auth mutations — 缓存副作用", () => {
	let qc: QueryClient;

	beforeEach(() => {
		vi.clearAllMocks();
		useSessionStore.setState({ sessionActive: false });
		qc = new QueryClient({
			defaultOptions: {
				queries: { retry: false, staleTime: Infinity, gcTime: Infinity },
				mutations: { retry: false },
			},
		});
	});

	afterEach(() => {
		qc.clear();
	});

	it("useLogout：me 缓存置 null、csrf-token 缓存移除、会话清零", async () => {
		// 预置缓存：登录态
		qc.setQueryData<UserDTO>(authKeys.me(), makeUser());
		qc.setQueryData<string>(authKeys.csrfToken(), "stale-token");
		useSessionStore.setState({ sessionActive: true });

		vi.mocked(apiPost).mockResolvedValue({ message: "ok" });

		const { result } = renderHook(() => useLogout(), { wrapper: createWrapper(qc) });
		await result.current.mutateAsync();

		await waitFor(() => {
			// me 缓存被写成 null（不是移除），让订阅者立即翻回未登录态
			expect(qc.getQueryData(authKeys.me())).toBeNull();
		});
		// csrf-token 缓存被移除，避免下次登录命中陈旧值
		expect(qc.getQueryData(authKeys.csrfToken())).toBeUndefined();
		// 会话活跃标志清零
		expect(useSessionStore.getState().sessionActive).toBe(false);
	});

	it("useLogin：失效 me 缓存并标记会话活跃", async () => {
		// 用 invalidateQueries 的 spy 验证调用，而非预置缓存
		const invalidateSpy = vi.spyOn(qc, "invalidateQueries");

		vi.mocked(apiPost).mockResolvedValue({ user_id: "u1" });

		const { result } = renderHook(() => useLogin(), { wrapper: createWrapper(qc) });
		await result.current.mutateAsync({
			email: "alice@example.com",
			password: "secret",
		});

		expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: authKeys.me() });
		expect(useSessionStore.getState().sessionActive).toBe(true);
	});

	it("useUpdateProfile：返回字段合并进 me 缓存", async () => {
		const initial = makeUser({ username: "old-name", bio: "old-bio" });
		qc.setQueryData<UserDTO>(authKeys.me(), initial);

		// 后端返回更新后的字段子集（omitempty：只含被改的字段）
		vi.mocked(apiPatch).mockResolvedValue({ username: "new-name" });

		const { result } = renderHook(() => useUpdateProfile(), { wrapper: createWrapper(qc) });
		await result.current.mutateAsync({ username: "new-name" });

		await waitFor(() => {
			const updated = qc.getQueryData<UserDTO>(authKeys.me());
			// 新 username 被合并
			expect(updated?.username).toBe("new-name");
			// 未改的字段保留
			expect(updated?.bio).toBe("old-bio");
		});
	});

	it("useChangePassword：失效 me 缓存（引导上层跳转登录页）", async () => {
		const invalidateSpy = vi.spyOn(qc, "invalidateQueries");

		vi.mocked(apiPatch).mockResolvedValue({ message: "ok" });

		const { result } = renderHook(() => useChangePassword(), { wrapper: createWrapper(qc) });
		await result.current.mutateAsync({
			old_password: "old",
			new_password: "new-secret",
		});

		expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: authKeys.me() });
	});
});
