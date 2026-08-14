/**
 * usePermissions hook 测试
 *
 * 用真实 QueryClient 预置 me 缓存（不 mock useMe），验证权限判定矩阵：
 *   - root 通配：持有 * 时任意权限返回 true
 *   - 普通 user：按 permissions 列表精确匹配
 *   - role 判定：admin / superadmin / root
 *
 * 范式参考 comments/api/__tests__/useCreateComment.test.tsx 的真实 QueryClient 风格。
 */
import type { UserDTO } from "@entities/user/model/types";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { authKeys } from "../../api/keys";
import {
	useHasAllPermissions,
	useHasAnyPermission,
	useHasPermission,
	useIsAdmin,
	useIsRoot,
	useIsSuperAdmin,
} from "../usePermissions";

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

describe("usePermissions", () => {
	let qc: QueryClient;

	beforeEach(() => {
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

	it("me 缓存为空时所有权限判定返回 false", () => {
		// 不预置 me 缓存
		const { result } = renderHook(
			() => ({
				has: useHasPermission("post:read"),
				hasAny: useHasAnyPermission(["post:read"]),
				hasAll: useHasAllPermissions(["post:read"]),
				isAdmin: useIsAdmin(),
				isSuperAdmin: useIsSuperAdmin(),
				isBuiltin: useIsRoot(),
			}),
			{ wrapper: createWrapper(qc) },
		);

		expect(result.current.has).toBe(false);
		expect(result.current.hasAny).toBe(false);
		expect(result.current.hasAll).toBe(false);
		expect(result.current.isAdmin).toBe(false);
		expect(result.current.isSuperAdmin).toBe(false);
		expect(result.current.isBuiltin).toBe(false);
	});

	it("超管（含内置与委派）持有通配码 * 时任意权限通过", () => {
		qc.setQueryData<UserDTO>(
			authKeys.me(),
			makeUser({
				role: "superadmin",
				is_root: true,
				permissions: ["*"], // 后端对超管返回通配码，任意权限码判定通过
			}),
		);

		const { result } = renderHook(
			() => ({
				has: useHasPermission("any:thing"),
				hasAny: useHasAnyPermission(["not-in-list"]),
				hasAll: useHasAllPermissions(["a", "b", "c"]),
				isAdmin: useIsAdmin(),
				isSuperAdmin: useIsSuperAdmin(),
				isBuiltin: useIsRoot(),
			}),
			{ wrapper: createWrapper(qc) },
		);

		expect(result.current.has).toBe(true);
		expect(result.current.hasAny).toBe(true);
		expect(result.current.hasAll).toBe(true);
		expect(result.current.isAdmin).toBe(true);
		expect(result.current.isSuperAdmin).toBe(true);
		expect(result.current.isBuiltin).toBe(true);
	});

	it("普通 user 按权限列表精确匹配", () => {
		qc.setQueryData<UserDTO>(
			authKeys.me(),
			makeUser({ role: "user", permissions: ["post:read", "comment:write"] }),
		);

		const { result } = renderHook(
			() => ({
				hasRead: useHasPermission("post:read"),
				hasWrite: useHasPermission("post:write"),
				hasAny: useHasAnyPermission(["post:read", "post:write"]),
				hasAll: useHasAllPermissions(["post:read", "post:write"]),
				isAdmin: useIsAdmin(),
			}),
			{ wrapper: createWrapper(qc) },
		);

		expect(result.current.hasRead).toBe(true);
		expect(result.current.hasWrite).toBe(false);
		expect(result.current.hasAny).toBe(true); // 有其中之一
		expect(result.current.hasAll).toBe(false); // 缺 post:write
		expect(result.current.isAdmin).toBe(false);
	});

	it("admin 角色判定为管理员但非超管", () => {
		qc.setQueryData<UserDTO>(authKeys.me(), makeUser({ role: "admin", is_root: false }));

		const { result } = renderHook(
			() => ({
				isAdmin: useIsAdmin(),
				isSuperAdmin: useIsSuperAdmin(),
				isBuiltin: useIsRoot(),
			}),
			{ wrapper: createWrapper(qc) },
		);

		expect(result.current.isAdmin).toBe(true);
		expect(result.current.isSuperAdmin).toBe(false);
		expect(result.current.isBuiltin).toBe(false);
	});

	it("被委派超管（role=superadmin 但非内置）isSuperAdmin 为 true、isBuiltin 为 false", () => {
		qc.setQueryData<UserDTO>(authKeys.me(), makeUser({ role: "superadmin", is_root: false }));

		const { result } = renderHook(
			() => ({
				isAdmin: useIsAdmin(),
				isSuperAdmin: useIsSuperAdmin(),
				isBuiltin: useIsRoot(),
			}),
			{ wrapper: createWrapper(qc) },
		);

		expect(result.current.isAdmin).toBe(true);
		expect(result.current.isSuperAdmin).toBe(true);
		expect(result.current.isBuiltin).toBe(false);
	});
});
