/**
 * auth mutations 缓存行为测试
 *
 * 验证登录/登出/改资料/改密码的 onSuccess 缓存副作用：
 *   - useLogout：cancelQueries + me 置 null + 移除 csrf-token 缓存 + clearSessionActive
 *   - useLogin：invalidate me + markSessionActive
 *   - useUpdateProfile：合并 me，刷新公开资料，改名后清除旧主页缓存
 *   - useChangePassword：invalidate me
 *
 * 范式复制 comments/api/__tests__/useCreateComment.test.tsx。
 */
import { userKeys } from "@entities/user/api/keys";
import type { UserDTO, UserProfile } from "@entities/user/model/types";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
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

import type { UpdatedProfile } from "@features/auth/model/types";
import { apiGet, apiPatch, apiPost } from "@shared/api/request";
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
		display_name: "",
		email: "alice@example.com",
		avatar_url: "",
		cover_url: "",
		bio: "",
		role: "user",
		is_root: false,
		email_verified: true,
		is_active: true,
		created_at: "2026-01-01T00:00:00Z",
		has_password: true,
		google_bound: false,
		github_bound: false,
		permissions: [],
		...overrides,
	};
}

function makeUpdatedProfile(overrides: Partial<UpdatedProfile> = {}): UpdatedProfile {
	return {
		id: "u1",
		username: "alice",
		display_name: "",
		email: "alice@example.com",
		avatar_url: "",
		cover_url: "",
		bio: "",
		role: "user",
		...overrides,
	};
}

function makePublicProfile(overrides: Partial<UserProfile> = {}): UserProfile {
	return {
		id: "u1",
		username: "alice",
		display_name: "",
		avatar_url: "",
		cover_url: "",
		bio: "",
		created_at: "2026-01-01T00:00:00Z",
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
		await qc.fetchQuery({
			queryKey: ["private-profile"],
			queryFn: async () => ({ secret: "alice-only" }),
			meta: { sessionScoped: true },
		});
		qc.setQueryData(["public-catalog"], ["公开数据"]);
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
		expect(qc.getQueryData(["private-profile"])).toBeUndefined();
		expect(qc.getQueryData(["public-catalog"])).toEqual(["公开数据"]);
	});

	it("useLogin：失效 me 缓存并标记会话活跃", async () => {
		// 用 invalidateQueries 的 spy 验证调用，而非预置缓存
		const invalidateSpy = vi.spyOn(qc, "invalidateQueries");

		vi.mocked(apiPost).mockResolvedValue({ user_id: "u1" });

		const { result } = renderHook(() => useLogin(), { wrapper: createWrapper(qc) });
		await result.current.mutateAsync({
			identifier: "alice@example.com",
			password: "secret",
		});

		expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: authKeys.me() });
		expect(useSessionStore.getState().sessionActive).toBe(true);
	});

	it("useUpdateProfile：改名后合并 me，旧用户名不再命中新资料缓存", async () => {
		const initial = makeUser({ username: "old-name", bio: "old-bio" });
		qc.setQueryData<UserDTO>(authKeys.me(), initial);
		qc.setQueryData(userKeys.profile("old-name"), makePublicProfile({ username: "old-name" }));
		const response = makeUpdatedProfile({ username: "new-name", bio: "old-bio" });
		vi.mocked(apiPatch).mockResolvedValue(response);

		const { result } = renderHook(() => useUpdateProfile(), { wrapper: createWrapper(qc) });
		await result.current.mutateAsync({ username: "new-name" });

		const updated = qc.getQueryData<UserDTO>(authKeys.me());
		expect(updated?.username).toBe("new-name");
		expect(updated?.bio).toBe("old-bio");
		expect(qc.getQueryData(userKeys.profile("old-name"))).toBeUndefined();
	});

	it.each([
		{ operation: "保存", cover: "https://images.example/cover.gif?crop=0.1,0.2,0.8,0.6" },
		{ operation: "移除", cover: "" },
	])("useUpdateProfile：$operation封面后重新打开主页获取新资料", async ({ cover }) => {
		qc.setQueryData(authKeys.me(), makeUser({ cover_url: "https://images.example/old.jpg" }));
		qc.setQueryData(
			userKeys.profile("alice"),
			makePublicProfile({ cover_url: "https://images.example/old.jpg" }),
		);
		const otherUser = makePublicProfile({
			id: "u2",
			username: "bob",
			cover_url: "https://images.example/bob.jpg",
		});
		qc.setQueryData(userKeys.profile("bob"), otherUser);
		vi.mocked(apiPatch).mockResolvedValue(makeUpdatedProfile({ cover_url: cover }));
		vi.mocked(apiGet).mockImplementation(async (path) =>
			path === "/users/bob"
				? makePublicProfile({
						...otherUser,
						cover_url: "https://images.example/bob-new.jpg",
					})
				: makePublicProfile({ cover_url: cover }),
		);

		const mutation = renderHook(() => useUpdateProfile(), { wrapper: createWrapper(qc) });
		await mutation.result.current.mutateAsync({ cover_url: cover });

		const homepage = renderHook(
			() => ({
				profile: useQuery({
					queryKey: userKeys.profile("alice"),
					queryFn: () => apiGet<UserProfile>("/users/alice"),
				}),
				otherProfile: useQuery({
					queryKey: userKeys.profile("bob"),
					queryFn: () => apiGet<UserProfile>("/users/bob"),
				}),
			}),
			{ wrapper: createWrapper(qc) },
		);
		await waitFor(() => expect(homepage.result.current.profile.data?.cover_url).toBe(cover));
		expect(qc.getQueryData<UserDTO>(authKeys.me())?.cover_url).toBe(cover);
		expect(homepage.result.current.otherProfile.data).toEqual(otherUser);
		homepage.unmount();
		mutation.unmount();
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
