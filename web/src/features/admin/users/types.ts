// 用户管理类型定义

/** 用户角色类型 */
export type UserRole = string;

/** 用户状态类型 */
export type UserStatus = "active" | "inactive";

/** 用户数据结构 */
export interface AdminUser {
  /** 用户唯一标识 */
  id: string;
  /** 用户名 */
  username: string;
  /** 邮箱 */
  email: string;
  /** 角色 */
  role: UserRole;
  /** 是否启用 */
  is_active: boolean;
  /** 邮箱是否已验证 */
  email_verified: boolean;
  /** 注册时间 */
  created_at: string;
}

/** 用户列表查询参数 */
export interface UserListParams {
  /** 搜索关键词（匹配用户名或邮箱） */
  search?: string;
  /** 角色筛选 */
  role?: UserRole;
  /** 状态筛选 */
  status?: UserStatus;
  /** 页码 */
  page?: number;
  /** 每页数量 */
  limit?: number;
}

/** 用户列表响应 */
export interface UserListResponse {
  /** 用户列表 */
  users: AdminUser[];
  /** 总数 */
  total: number;
  /** 当前页码 */
  page: number;
  /** 每页数量 */
  limit: number;
}

/** 创建用户请求参数 */
export interface CreateUserRequest {
  username: string;
  email: string;
  password: string;
  role: UserRole;
  is_active: boolean;
}

/** 编辑用户请求参数 */
export interface UpdateUserRequest {
  username: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  email_verified: boolean;
  bio: string;
}

/** 编辑用户表单数据（包含 ID） */
export type EditFormData = UpdateUserRequest & { id: string };

/** 角色配置（用于前端组件） */
export interface RoleConfig {
  value: string;
  label: string;
}

/** 状态配置 */
export interface StatusConfig {
  value: UserStatus | "all";
  label: string;
}

/** 状态选项配置 */
export const statusOptions: StatusConfig[] = [
  { value: "all", label: "全部状态" },
  { value: "active", label: "启用" },
  { value: "inactive", label: "禁用" },
];
