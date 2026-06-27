import type { UserDTO } from "@entities/user/model/types";
import { CSRF_HEADER, getCSRFToken } from "@shared/api/csrf";
import { apiPatch, apiPost } from "@shared/api/request";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type {
    ChangePasswordRequest,
    ForgotPasswordRequest,
    LoginRequest,
    MessageResponse,
    RefreshRequest,
    RegisterRequest,
    ResetPasswordRequest,
    TokenResponse,
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
        mutationFn: (body: RegisterRequest) => apiPost<MessageResponse>("/auth/register", body),
    });

/**
 * useVerifyEmail - 用验证码激活账户
 *
 * @returns POST /auth/verify-email，成功 data 为 null
 */
export const useVerifyEmail = () =>
    useMutation({
        mutationFn: (body: VerifyEmailRequest) =>
            apiPost<MessageResponse>("/auth/verify-email", body),
    });

/**
 * useLogin - 邮箱密码登录
 *
 * 成功后后端通过 HttpOnly cookie 下发 access/refresh/CSRF token，
 * 响应体仅返回 access_token 等非敏感字段。onSuccess 主动拉取最新用户信息。
 *
 * @param csrfToken 可选的 CSRF token；当浏览器 cookie 未成功写入时，可显式传入并写入请求头。
 * @returns POST /auth/login，返回 token 信息
 */
export const useLogin = (csrfToken?: string) => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (body: LoginRequest) => {
            // 优先使用调用方传入的最新 token；若 state 尚未同步，回退到当前 cookie。
            const token = csrfToken || getCSRFToken();
            return apiPost<TokenResponse>(
                "/auth/login",
                body,
                token ? { headers: { [CSRF_HEADER]: token } } : undefined,
            );
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: authKeys.me() });
        },
    });
};

/**
 * fetchRefresh - 显式刷新 access token
 *
 * httpClient 在 401 时已自动调用本接口，此处导出供手动刷新场景使用。
 * cookie 存在时 body 可为空对象。
 *
 * @param body 可选的 refresh_token，cookie 缺失时必须提供
 * @returns 新的 token 信息
 */
export const fetchRefresh = (body: RefreshRequest = {}): Promise<TokenResponse> =>
    apiPost<TokenResponse>("/auth/refresh", body);

/**
 * useRefresh - 显式刷新 token 的 hook 形态
 *
 * @returns POST /auth/refresh
 */
export const useRefresh = () =>
    useMutation({
        mutationFn: (body: RefreshRequest) => fetchRefresh(body),
    });

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
            apiPost<MessageResponse>("/auth/forgot-password", body),
    });

/**
 * useResetPassword - 用验证码重置密码
 *
 * @returns POST /auth/reset-password，成功 data 为 null
 */
export const useResetPassword = () =>
    useMutation({
        mutationFn: (body: ResetPasswordRequest) =>
            apiPost<MessageResponse>("/auth/reset-password", body),
    });

/**
 * useLogout - 登出并清除客户端凭据
 *
 * 后端会 blacklist refresh token 并清除 cookie。onSuccess 失效 me 缓存
 * 并主动写入 undefined，让 useMe 立即回到未登录态。
 *
 * @returns POST /auth/logout，成功 data 为 null
 */
export const useLogout = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: () => apiPost<MessageResponse>("/auth/logout"),
        onSuccess: () => {
            qc.setQueryData<UserDTO>(authKeys.me(), undefined);
            qc.invalidateQueries({ queryKey: authKeys.me() });
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
