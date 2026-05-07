// 权限分组工具函数

import type { Permission } from "@/features/admin/roles/types";

/**
 * 模块名称中文映射
 */
export const moduleNames: Record<string, string> = {
  post: "文章管理",
  comment: "评论管理",
  tag: "标签管理",
  media: "媒体管理",
  emoji: "表情管理",
  playlist: "歌单管理",
  song: "歌曲管理",
  user: "用户管理",
  role: "角色管理",
  project: "项目管理",
  settings: "系统设置",
  announcement: "公告管理",
};

/**
 * 从权限代码提取模块名
 * @param code - 权限代码，格式为 "module:action"
 * @returns 模块名
 */
export function getModule(code: string): string {
  return code.split(":")[0];
}

/**
 * 按模块分组权限
 * @param permissions - 权限列表
 * @returns 模块名 -> 权限列表的映射
 */
export function groupPermissionsByModule(
  permissions: Permission[]
): Record<string, Permission[]> {
  return permissions.reduce<Record<string, Permission[]>>((acc, perm) => {
    const module = getModule(perm.code);
    if (!acc[module]) acc[module] = [];
    acc[module].push(perm);
    return acc;
  }, {});
}

/**
 * 获取模块的中文显示名
 * @param module - 模块代码
 * @returns 中文模块名
 */
export function getModuleDisplayName(module: string): string {
  return moduleNames[module] || module;
}