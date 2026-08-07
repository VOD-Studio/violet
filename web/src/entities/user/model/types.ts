/**
 * UserDTO - 后端 /auth/me 返回的用户对象
 *
 * 对接后端 internal/application/auth/query/auth_queries.go 的 UserDTO。
 * 所有鉴权相关 feature 共用此类型（跨模块复用走 entities）。
 */
export interface UserDTO {
	/** 用户 ID（UUID 字符串） */
	id: string;
	/** 用户名 */
	username: string;
	/** 邮箱 */
	email: string;
	/** 头像 URL */
	avatar_url: string;
	/** 个人简介 */
	bio: string;
	/** 角色：user / admin / superadmin */
	role: UserRole;
	/** 是否为内置超级管理员（通配符权限，授权链起点） */
	is_builtin_super_admin: boolean;
	/** 邮箱是否已验证 */
	email_verified: boolean;
	/** 账户是否启用 */
	is_active: boolean;
	/** 创建时间（RFC3339） */
	created_at: string;
	/** 权限码列表（仅当后端返回时存在） */
	permissions?: string[];
}

/** 用户角色枚举（与后端 context 注入的 role 字符串对应） */
export type UserRole = "user" | "admin" | "superadmin";

/**
 * SessionClaims - GET /auth/session 返回的只读鉴权声明
 *
 * 后端 /auth/session 只读不写：命中即返回 claims，不续期、不 Set-Cookie。
 * 完整 UserDTO 由客户端 useMe（GET /auth/me）按需拉取。
 */
export interface SessionClaims {
	/** 用户 ID */
	user_id: string;
	/** 用户角色 */
	role: UserRole;
	/** 用户邮箱 */
	email: string;
	/** 是否为内置超级管理员 */
	is_builtin_super_admin: boolean;
}
/**
 * UserProfile - 公开用户资料卡
 *
 * 对接后端 GET /api/v1/users/{username}。只包含公开字段（头像/用户名/简介/注册时间）。
 */
export interface UserProfile {
	/** 用户 ID */
	id: string;
	/** 用户名 */
	username: string;
	/** 头像 URL */
	avatar_url: string;
	/** 个人简介 */
	bio: string;
	/** 注册时间（RFC3339） */
	created_at: string;
}
