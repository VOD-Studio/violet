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
