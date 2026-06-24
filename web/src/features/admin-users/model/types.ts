/**
 * admin-users 模块类型定义
 *
 * 对接后端 application/useradmin/service.go 的 UserDTO 与 handler 的请求体。
 * 所有字段均来自打了 json tag 的 DTO，序列化为 snake_case，与 entities/user 的
 * 公开 UserDTO 不同：管理后台字段更全且 avatar 字段名为 avatar 而非 avatar_url。
 */
import type { UserRole } from "@entities/user/model/types";

/**
 * AdminUser - 管理后台用户读模型
 *
 * 对应后端 application/useradmin/service.go 的 UserDTO，handler 直接序列化此对象。
 * 与 entities/user 的 UserDTO 字段有差异：本类型头像字段为 avatar，公开 DTO 为
 * avatar_url；本类型无 permissions 字段。字段集以后端 UserDTO 为准。
 */
export interface AdminUser {
	/** 用户 ID，UUID 字符串 */
	id: string;
	/** 用户名 */
	username: string;
	/** 邮箱 */
	email: string;
	/** 角色：user / admin / superadmin */
	role: UserRole;
	/** 邮箱是否已验证 */
	email_verified: boolean;
	/** 账户是否启用 */
	is_active: boolean;
	/** 个人简介 */
	bio: string;
	/** 头像 URL */
	avatar: string;
	/** 创建时间，RFC3339 字符串 */
	created_at: string;
}

/**
 * UserDetail - 用户详情，当前与列表元素同构
 *
 * 后端 GetDetail 返回同一个 UserDTO，详情字段集与列表一致，故直接别名。
 * 若后端未来扩展详情字段如 last_login，此处可独立声明补充。
 */
export type UserDetail = AdminUser;

/**
 * UserListQuery - 用户列表查询参数
 *
 * 对应后端 ListUsers handler 解析的 r.URL.Query() 字段：
 * role 字符串、is_active 布尔、keyword 模糊词，外加 page/limit 分页。
 */
export interface UserListQuery {
	/** 页码，从 1 开始，默认 1 */
	page?: number;
	/** 每页条数，默认 20，后端限制上限 100 */
	limit?: number;
	/** 按角色筛选，user / admin / superadmin */
	role?: UserRole;
	/** 按启用状态筛选，true 仅启用、false 仅禁用 */
	is_active?: boolean;
	/** 用户名或邮箱模糊搜索关键词 */
	keyword?: string;
}

/**
 * CreateUserRequest - 创建用户请求体
 *
 * 对应后端 CreateUser handler 的内联结构体，username/email/password 必填，
 * role 与 is_active 可选，缺省时后端默认 user 与 true。
 */
export interface CreateUserRequest {
	/** 用户名，必填 */
	username: string;
	/** 邮箱，必填，需合法邮箱格式 */
	email: string;
	/** 密码，必填，最少 6 位 */
	password: string;
	/** 角色，缺省 user */
	role?: UserRole;
	/** 是否启用，缺省 true */
	is_active?: boolean;
}

/**
 * UpdateUserRequest - 编辑用户请求体
 *
 * 对应后端 UpdateUser handler 的内联结构体，所有字段为可选指针，
 * 仅传出的字段会被更新。password 传空字符串等价于不修改。
 */
export interface UpdateUserRequest {
	/** 新用户名，省略则不修改 */
	username?: string;
	/** 新邮箱，省略则不修改 */
	email?: string;
	/** 新密码，省略或空字符串不修改 */
	password?: string;
	/** 新角色，省略则不修改 */
	role?: UserRole;
	/** 新启用状态，省略则不修改 */
	is_active?: boolean;
}

/**
 * UpdateUserRoleRequest - 修改用户角色请求体
 *
 * 对应后端 UpdateUserRole handler 的内联结构体，role 必填。
 */
export interface UpdateUserRoleRequest {
	/** 新角色，必填 */
	role: UserRole;
}

/**
 * UpdateUserStatusRequest - 启用或禁用用户请求体
 *
 * 对应后端 UpdateUserStatus handler 的内联结构体，is_active 必填。
 */
export interface UpdateUserStatusRequest {
	/** 目标启用状态，true 启用、false 禁用 */
	is_active: boolean;
}

/**
 * BatchUpdateStatusRequest - 批量启用或禁用请求体
 *
 * 对应后端 BatchUpdateStatus handler 的内联结构体，ids 至少一项。
 */
export interface BatchUpdateStatusRequest {
	/** 目标用户 ID 列表，至少一项 */
	ids: string[];
	/** 目标启用状态 */
	is_active: boolean;
}

/**
 * BatchUpdateRoleRequest - 批量修改角色请求体
 *
 * 对应后端 BatchUpdateRole handler 的内联结构体，ids 至少一项，role 必填。
 */
export interface BatchUpdateRoleRequest {
	/** 目标用户 ID 列表，至少一项 */
	ids: string[];
	/** 目标角色，必填 */
	role: UserRole;
}

/**
 * BatchAffected - 批量操作返回的受影响数
 *
 * 后端 BatchUpdateStatus / BatchUpdateRole 返回 { affected: number }。
 */
export interface BatchAffected {
	/** 实际受影响的用户数 */
	affected: number;
}

/**
 * MutationMessageResult - 返回消息而非数据的写操作结果
 *
 * 后端 UpdateUserRole / UpdateUserStatus / DeleteUser 走 RespondMessage，
 * 业务 data 为 null，仅 meta.message 有值，apiPost 解包后得到 null。
 * 此类型用于标注这类无数据返回的 mutation，调用方通常无需消费返回值。
 */
export type MutationMessageResult = null;
