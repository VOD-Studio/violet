// 用户管理类型定义

/** 用户数据结构 */
export interface AdminUser {
  /** 用户唯一标识 */
  id: string;
  /** 用户名 */
  username: string;
  /** 邮箱 */
  email: string;
  /** 角色：admin / user */
  role: string;
  /** 是否启用 */
  is_active: boolean;
  /** 邮箱是否已验证 */
  email_verified: boolean;
  /** 注册时间 */
  created_at: string;
}
