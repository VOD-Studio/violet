import type { UserDTO } from "@entities/user/model/types";
import { CSRF_HEADER, getCSRFToken } from "@shared/api/csrf";
import { apiPatch, apiPost } from "@shared/api/request";
import { clearSessionActive, markSessionActive } from "@shared/api/session";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type {
	ChangePasswordRequest,
	ForgotPasswordRequest,
	LoginRequest,
	LoginResponse,
	MessageResponse,
	RegisterRequest,
	ResetPasswordRequest,
	UpdatedProfile,
	UpdateProfileRequest,
	VerifyEmailRequest,
} from "../model/types";
import { authKeys } from "./keys";

/**
 * useRegister - 注册并触发邮箱验证邮件
 *
 * @returns POST /auth/register，成功 data 为 null
 */
export const useRegister = () =>
	useMutation({
		mutationFn: (body: RegisterRequest) =>
			// 主动认证请求，401/403 是业务结果，不触发登录弹窗
			apiPost<MessageResponse>("/auth/register", body, { __skipAuthDialog: true }),
	});

/**
 * useVerifyEmail - 用验证码激活账户
 *
 * @returns POST /auth/verify-email，成功 data 为 null
 */
export const useVerifyEmail = () =>
	useMutation({
		mutationFn: (body: VerifyEmailRequest) =>
			apiPost<MessageResponse>("/auth/verify-email", body, { __skipAuthDialog: true }),
	});

/**
 * useLogin - 账号密码登录
 *
 * 成功后后端通过 HttpOnly cookie 下发 session，响应体仅返回 user_id。
 * onSuccess 主动拉取最新用户信息。
 *
 * @param csrfToken 可选的 CSRF token；当浏览器 cookie 未成功写入时，可显式传入并写入请求头。
 * @returns POST /auth/login，返回登录响应
 */
export const useLogin = (csrfToken?: string) => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (body: LoginRequest) => {
			const token = csrfToken || getCSRFToken();
			return apiPost<LoginResponse>("/auth/login", body, {
				headers: token ? { [CSRF_HEADER]: token } : undefined,
				// login 本身就是认证请求，401 是正常业务结果（密码错/账户禁用），
				// 不应触发登录弹窗。
				__skipAuthDialog: true,
			});
		},
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: authKeys.me() });
			// 登录成功：标记会话活跃（守卫据此不再因瞬态失败踢人）
			markSessionActive();
		},
	});
};

/**
 * googleLogin - POST /auth/google
 */
export const googleLogin = (credential: string, csrfToken?: string) => {
	const token = csrfToken || getCSRFToken();
	return apiPost<LoginResponse>(
		"/auth/google",
		{ credential },
		{
			headers: token ? { [CSRF_HEADER]: token } : undefined,
			__skipAuthDialog: true,
		},
	);
};

/**
 * useGoogleLoginMutation - Google 登录
 */
export const useGoogleLoginMutation = (csrfToken?: string) => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (credential: string) => googleLogin(credential, csrfToken),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: authKeys.me() });
			markSessionActive();
		},
	});
};

/**
 * githubLogin - POST /auth/github
 */
export const githubLogin = (credential: string, csrfToken?: string) => {
	const token = csrfToken || getCSRFToken();
	return apiPost<LoginResponse>(
		"/auth/github",
		{ credential },
		{
			headers: token ? { [CSRF_HEADER]: token } : undefined,
			__skipAuthDialog: true,
		},
	);
};

/**
 * useGithubLoginMutation - GitHub 登录
 */
export const useGithubLoginMutation = (csrfToken?: string) => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (credential: string) => githubLogin(credential, csrfToken),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: authKeys.me() });
			markSessionActive();
		},
	});
};

/**
 * useForgotPassword - 发起密码重置邮件
 *
 * 后端始终返回成功以防邮箱枚举，调用方不应据响应判断邮箱是否存在。
 *
 * @returns POST /auth/forgot-password，成功 data 为 null
 */
export const useForgotPassword = () =>
	useMutation({
		mutationFn: (body: ForgotPasswordRequest) =>
			// 公开接口，无需登录；401/403 是业务结果，不触发登录弹窗
			apiPost<MessageResponse>("/auth/forgot-password", body, { __skipAuthDialog: true }),
	});

/**
 * useResetPassword - 用验证码重置密码
 *
 * @returns POST /auth/reset-password，成功 data 为 null
 */
export const useResetPassword = () =>
	useMutation({
		mutationFn: (body: ResetPasswordRequest) =>
			apiPost<MessageResponse>("/auth/reset-password", body, { __skipAuthDialog: true }),
	});

/**
 * useLogout - 登出并清除客户端状态
 *
 * 后端会清除 session cookie。onSuccess 把 me 缓存置为 null（不移除），
 * 让 useMe 订阅者立即翻回未登录态，同时避免 removeQueries 导致观察者重新创建
 * 并发起 fetch → 401。
 *
 * @returns POST /auth/logout，成功 data 为 null
 */
export const useLogout = () => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: () =>
			apiPost<MessageResponse>("/auth/logout", undefined, { __skipAuthDialog: true }),
		onSuccess: async () => {
			// 登出后清会话状态。注意：不能用 invalidateQueries——它会触发 refetch，
			// 而 cookie 已被后端清除 → fetchMe 必然 401 → 弹登录窗（bug：登出反而触发登录弹窗）。
			// 也不能用 removeQueries——它会让仍挂载的 useMe 观察者重新创建查询并立即 fetch，
			// 同样导致 401。正确做法：取消进行中的 me 查询 + 把缓存写成 null（不发请求），
			// 配合 useMe 的 staleTime: Infinity 即可阻止任何自动重试。
			await qc.cancelQueries({ queryKey: authKeys.me() });
			qc.setQueryData<UserDTO | null>(authKeys.me(), null);
			// 登出清 CSRF token 缓存：后端已清 violet_csrf cookie，
			// 缓存留旧 token 会让下次登录页命中陈旧值，与新 cookie 对不上。
			qc.removeQueries({ queryKey: authKeys.csrfToken() });
			// 登出：清除会话活跃标志（守卫据此允许踢人/跳登录）
			clearSessionActive();
		},
	});
};

/**
 * useUpdateProfile - 更新当前用户资料
 *
 * 所有字段 omitempty，仅传需要更新的字段。返回更新后的用户字段子集，
 * onSuccess 同步更新 me 缓存避免额外请求。
 *
 * @returns PATCH /auth/profile，返回更新后的用户资料
 */
export const useUpdateProfile = () => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (body: UpdateProfileRequest) => apiPatch<UpdatedProfile>("/auth/profile", body),
		onSuccess: (data) => {
			qc.setQueryData<UserDTO>(authKeys.me(), (old) => (old ? { ...old, ...data } : old));
		},
	});
};

/**
 * useChangePassword - 修改当前用户密码
 *
 * 成功后后端建议重新登录，onSuccess 失效 me 缓存以便上层跳转登录页。
 *
 * @returns PATCH /auth/password，成功 data 为 null
 */
export const useChangePassword = () => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (body: ChangePasswordRequest) =>
			apiPatch<MessageResponse>("/auth/password", body),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: authKeys.me() });
		},
	});
};
