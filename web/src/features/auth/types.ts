/**
 * 认证功能类型定义
 */

/** 登录表单数据 */
export interface LoginFormData {
  email: string;
  password: string;
}

/** 注册表单数据 */
export interface RegisterFormData {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
}

/** 登录响应结构 */
export interface LoginResponse {
  /** JWT 访问令牌 */
  access_token: string;
  /** JWT 刷新令牌 */
  refresh_token: string;
  /** 令牌过期时间（秒） */
  expires_in: number;
  /** 刷新令牌过期时间（秒） */
  refresh_expires_in: number;
}

/** 用户信息结构 */
export interface UserInfo {
  id: string;
  username: string;
  email: string;
  avatar_url?: string;
  bio?: string;
  role?: string;
  email_verified?: boolean;
  is_active?: boolean;
  permissions?: string[];
}

/** 更新个人资料请求体 */
export interface UpdateProfileData {
  username: string;
  bio?: string;
  avatar_url?: string;
}

/** 修改密码请求体 */
export interface UpdatePasswordData {
  old_password: string;
  new_password: string;
}
