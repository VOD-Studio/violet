// 用户管理类型定义

/** 用户数据结构 */
export interface AdminUser {
  /** 用户唯一标识 */
  id: string;
  /** 用户名 */
  username: string;
  /** 邮箱 */
  email: string;
  /** 角色：admin / user / superadmin */
  role: string;
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
  role?: string;
  /** 状态筛选 */
  status?: string;
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