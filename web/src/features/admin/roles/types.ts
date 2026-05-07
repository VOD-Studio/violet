// 角色管理类型定义

/** 角色数据结构 */
export interface Role {
  /** 角色唯一标识 */
  id: number;
  /** 角色名称 */
  name: string;
  /** 角色描述 */
  description: string | null;
  /** 创建时间 */
  created_at: string;
  /** 使用该角色的用户数量 */
  user_count?: number;
}

/** 带权限的角色 */
export interface RoleWithPermissions extends Role {
  permissions: Permission[];
}

/** 权限数据结构 */
export interface Permission {
  /** 权限代码 */
  code: string;
  /** 权限名称 */
  name: string;
  /** 权限模块（用于分组） */
  module?: string;
}

/** 创建角色输入 */
export interface CreateRoleInput {
  name: string;
  description?: string;
}

/** 更新角色输入 */
export interface UpdateRoleInput {
  name?: string;
  description?: string;
}

/** 更新角色权限输入 */
export interface UpdateRolePermissionsInput {
  permissions: string[]; // 权限代码列表
}