/**
 * auth 模块类型定义
 *
 * 对接后端 /auth/* 系列接口。请求/响应字段均来自后端 handler 显式声明的
 * json tag 或 handler 内手拼的 map[string]any，全部为 snake_case，
 * 无 domain struct 透传导致的 PascalCase 风险。
 */
import type { UserRole } from "@entities/user/model/types";

/**
 * CsrfTokenResponse - GET /auth/csrf-token 返回
 *
 * handler 同时下发 violet_csrf cookie（HttpOnly=false，JS 可读）并返回 token 字符串。
 * double-submit 模式下前端需把该 token 放入自定义请求头，值与 cookie 一致。
 */
export interface CsrfTokenResponse {
	/** CSRF token 字符串，hex 编码 64 字符 */
	csrf_token: string;
}

/**
 * RegisterRequest - POST /auth/register 请求体
 */
export interface RegisterRequest {
	/** 邮箱 */
	email: string;
	/** 用户名，3 到 32 字符 */
	username: string;
	/** 密码，至少 8 位 */
	password: string;
}

/**
 * VerifyEmailRequest - POST /auth/verify-email 请求体
 */
export interface VerifyEmailRequest {
	/** 邮箱 */
	email: string;
	/** 6 位数字验证码 */
	code: string;
}

/**
 * LoginRequest - POST /auth/login 请求体
 */
export interface LoginRequest {
	/** 邮箱 */
	email: string;
	/** 密码 */
	password: string;
}

/**
 * LoginResponse - 登录成功返回的信息
 *
 * 后端通过 HttpOnly cookie 下发 session，响应体仅返回 user_id。
 */
export interface LoginResponse {
	/** 用户 ID */
	user_id: string;
}

/**
 * ForgotPasswordRequest - POST /auth/forgot-password 请求体
 */
export interface ForgotPasswordRequest {
	/** 邮箱 */
	email: string;
}

/**
 * ResetPasswordRequest - POST /auth/reset-password 请求体
 */
export interface ResetPasswordRequest {
	/** 邮箱 */
	email: string;
	/** 重置验证码 */
	code: string;
	/** 新密码，至少 8 位 */
	new_password: string;
}

/**
 * UpdateProfileRequest - PATCH /auth/profile 请求体
 *
 * 所有字段均可选，omitempty 校验，仅传需要更新的字段。
 */
export interface UpdateProfileRequest {
	/** 用户名，3 到 32 字符 */
	username?: string;
	/** 个人简介，最多 500 字符 */
	bio?: string;
	/** 头像 URL，最多 2048 字符 */
	avatar_url?: string;
}

/**
 * UpdatedProfile - PATCH /auth/profile 返回
 *
 * handler 手拼 map，字段是 UserDTO 的子集，缺 email_verified/is_active/
 * created_at/permissions。需要完整用户请改用 GET /auth/me。
 */
export interface UpdatedProfile {
	/** 用户 ID */
	id: string;
	/** 用户名 */
	username: string;
	/** 邮箱 */
	email: string;
	/** 头像 URL */
	avatar_url: string;
	/** 个人简介 */
	bio: string;
	/** 角色，复用 entities 的 UserRole 联合类型 */
	role: UserRole;
}

/**
 * ChangePasswordRequest - PATCH /auth/password 请求体
 */
export interface ChangePasswordRequest {
	/** 旧密码 */
	old_password: string;
	/** 新密码，至少 8 位 */
	new_password: string;
}

/**
 * MessageResponse - 后端 RespondMessage 返回结构
 *
 * 后端 RespondMessage 把消息放进 meta.message，data 为 null。
 * httpClient 已把 envelope 拆成 { data, meta }，apiPost 返回 data 即 null。
 * 调用方通常只关心请求成功与否，如需消息文本请直接读 meta。
 */
export type MessageResponse = null;

export type { UserRole };
