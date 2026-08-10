import type { UserDTO } from "@entities/user/model/types";
import { clientQueryClient } from "@shared/api/query-client";
import { apiGet } from "@shared/api/request";
import { registerSessionExpiredHandler } from "@shared/api/session-expired";
import { type QueryClient, type UseQueryResult, useQuery } from "@tanstack/react-query";
import type { CsrfTokenResponse } from "../model/types";
import { authKeys } from "./keys";

/**
 * useLogout（主动登出）、LoginDialog 取消重登、401 拦截器（被动过期）共用：
 * me 写成 null 让 useMe 订阅者立即翻回未登录态，csrf 移除防陈旧命中。
 * 不能用 invalidate/remove——会触发 refetch，配合 useMe 的 staleTime: Infinity
 * 阻止自动重试。
 */
export const clearAuthCache = (qc: QueryClient): void => {
	void qc.cancelQueries({ queryKey: authKeys.me() });
	qc.setQueryData<UserDTO | null>(authKeys.me(), null);
	qc.removeQueries({ queryKey: authKeys.csrfToken() });
};

// 注册会话失效清理：401 拦截器调 onSessionExpired → clearAuthCache(clientQueryClient)。
// queries.ts 被 useMe 消费（Header/Profile 必加载），顶层注册保证 401 发生前 handler 已就位。
registerSessionExpiredHandler(() => {
	clearAuthCache(clientQueryClient);
});

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
 * useCsrfToken - 获取 CSRF token 的 hook 形态
 *
 * double-submit 模式下，未登录用户发起 login/register 前需先取 CSRF cookie。
 * 用 useQuery 包裹：同一 queryKey 的 in-flight 请求自动去重，规避 React
 * StrictMode dev 双调用 effect 带来的重复请求与 token/cookie 竞态。
 *
 * staleTime 与后端 violet_csrf cookie MaxAge 对齐，避免页面反复进出或弹窗
 * 反复开关时重复请求；登出时由 useLogout 清缓存以防陈旧 token 命中。
 *
 * @param options enabled 可按需关闭，LoginDialog 仅在弹窗打开时请求
 * @returns CSRF token 字符串，未取到返回空串
 */
export const useCsrfToken = (options: { enabled?: boolean } = {}): string => {
	const { data } = useQuery({
		queryKey: authKeys.csrfToken(),
		queryFn: fetchCsrfToken,
		enabled: options.enabled,
		// violet_csrf cookie MaxAge 为 1 小时，token 在此期间有效
		staleTime: 60 * 60 * 1000,
	});
	return data?.csrf_token ?? "";
};

/**
 * fetchMe - 调后端 GET /auth/me 获取当前登录用户信息
 *
 * 需携带 session cookie，httpClient 自动 withCredentials。
 *
 * __skipAuthDialog=true：这是「身份探活」请求，401 时不应触发登录弹窗，
 * 否则登出后导航重跑 getAuthSession/useMe 会撞 401 → 弹窗干扰用户。
 * 401 直接 reject，由调用方（getAuthSession 的 try/catch、useMe 的 error 态）处理。
 *
 * @returns 当前登录用户完整信息
 */
export const fetchMe = (): Promise<UserDTO> =>
	apiGet<UserDTO>("/auth/me", { __skipAuthDialog: true });

/**
 * useMe - 当前登录用户 hook
 *
 * 默认 enabled，未登录时会收到 401 业务错误，调用方按需控制 enabled。
 * 缓存 key 为 auth.me，写操作成功后通过 invalidate 触发刷新。
 *
 * staleTime 设为 Infinity：用户资料只在显式 invalidate 时刷新，避免登出后
 * 窗口聚焦或组件重挂时再次请求 /auth/me 导致 401。
 *
 * @param options 透传 useQuery 选项，常用于禁用自动请求
 */
export const useMe = (options: { enabled?: boolean } = {}): UseQueryResult<UserDTO | null> =>
	useQuery<UserDTO | null>({
		queryKey: authKeys.me(),
		queryFn: fetchMe,
		enabled: options.enabled,
		staleTime: Infinity,
	});
