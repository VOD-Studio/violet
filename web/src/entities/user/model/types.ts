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
	/** 角色 */
	role: UserRole;
	/** 角色描述，来自 roles 表，供界面显示角色标签 */
	role_description?: string;
	is_root: boolean;
	/** 邮箱是否已验证 */
	email_verified: boolean;
	/** 账户是否启用 */
	is_active: boolean;
	/** 创建时间（RFC3339） */
	created_at: string;
	/** 权限码列表（仅当后端返回时存在） */
	permissions?: string[];
}

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
	/** 是否为 root 用户 */
	is_root: boolean;
}

/**
 * 用户角色类型。列举内置角色供 IDE 补全，{} & string 兼容自定义角色。
 */
export type UserRole = "user" | "author" | "admin" | "superadmin" | ({} & string);
