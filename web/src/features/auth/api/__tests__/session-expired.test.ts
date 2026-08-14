/**
 * onSessionExpired 回归测试
 *
 * 防回归：401 session 过期时，useMe 缓存必须立即清空（置 null），
 * 否则 Header 残留假登录态而守卫踢人，用户看到"header 说登录却跳 login"。
 */
import type { UserDTO } from "@entities/user/model/types";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@shared/api/request", () => ({
	apiGet: vi.fn(),
	apiPost: vi.fn(),
	apiPatch: vi.fn(),
	apiDelete: vi.fn(),
	apiPut: vi.fn(),
	apiGetPaged: vi.fn(),
}));

vi.mock("@shared/api/csrf", () => ({
	CSRF_HEADER: "X-CSRF-Token",
	getCSRFToken: vi.fn(() => ""),
}));

import { clientQueryClient } from "@shared/api/query-client";
import { onSessionExpired } from "@shared/api/session-expired";
import { authKeys } from "../keys";
// 副作用 import：触发 queries.ts 顶层注册 registerSessionExpiredHandler
import "../queries";

function makeUser(): UserDTO {
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
	};
}

describe("onSessionExpired — 401 清空 auth 缓存", () => {
	afterEach(() => {
		clientQueryClient.clear();
	});

	it("me 缓存置 null、csrf-token 移除", () => {
		clientQueryClient.setQueryData<UserDTO>(authKeys.me(), makeUser());
		clientQueryClient.setQueryData<string>(authKeys.csrfToken(), "stale-token");
		expect(clientQueryClient.getQueryData(authKeys.me())).not.toBeNull();

		onSessionExpired();

		expect(clientQueryClient.getQueryData(authKeys.me())).toBeNull();
		expect(clientQueryClient.getQueryData(authKeys.csrfToken())).toBeUndefined();
	});
});
