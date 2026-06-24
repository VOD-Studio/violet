import { apiGet } from "@shared/api/request";
import { useQuery } from "@tanstack/react-query";
import type { AuthUser, CsrfTokenResponse } from "../model/types";
import { authKeys } from "./keys";

/**
 * fetchCsrfToken - 调后端 GET /auth/csrf-token 获取 CSRF token
 *
 * double-submit 模式下，未登录用户发起 login/register 前需先取 CSRF cookie。
 * 已登录用户调用会刷新 token 防止长期不变。响应体同时返回 token 字符串，
 * 但攻击者拿不到 cookie 故无法伪造 header，可安全暴露。
 *
 * @returns 包含 csrf_token 字符串的对象
 */
export const fetchCsrfToken = (): Promise<CsrfTokenResponse> =>
	apiGet<CsrfTokenResponse>("/auth/csrf-token");

/**
 * fetchMe - 调后端 GET /auth/me 获取当前登录用户信息
 *
 * 需携带 access token cookie，httpClient 自动 withCredentials。
 *
 * @returns 当前登录用户完整信息
 */
export const fetchMe = (): Promise<AuthUser> => apiGet<AuthUser>("/auth/me");

/**
 * useMe - 当前登录用户 hook
 *
 * 默认 enabled，未登录时会收到 401 业务错误，调用方按需控制 enabled。
 * 缓存 key 为 auth.me，写操作成功后通过 invalidate 触发刷新。
 *
 * @param options 透传 useQuery 选项，常用于禁用自动请求
 */
export const useMe = (options: { enabled?: boolean } = {}) =>
	useQuery({
		queryKey: authKeys.me(),
		queryFn: fetchMe,
		enabled: options.enabled,
	});
