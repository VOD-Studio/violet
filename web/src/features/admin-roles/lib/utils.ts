/**
 * 角色工具函数
 */
import type { RoleDTO } from "../model/types";

/**
 * 根据角色名称获取 Badge variant
 */
export const getRoleBadgeVariant = (
    roleName?: string,
): "default" | "secondary" | "outline" | "destructive" => {
    switch (roleName) {
        case "superadmin":
            return "default";
        case "admin":
            return "secondary";
        default:
            return "outline";
    }
};

/**
 * 根据角色名称从角色列表中查找角色
 */
export const findRoleByName = (roles: RoleDTO[], name?: string): RoleDTO | undefined => {
    if (!name) return undefined;
    return roles.find((role) => role.name === name);
};

/**
 * 获取角色显示名称（优先使用 description，fallback 到 name）
 */
export const getRoleDisplayName = (roles: RoleDTO[], name?: string, fallback?: string): string => {
    if (!name) return fallback || "";
    const role = findRoleByName(roles, name);
    return role?.description || fallback || name;
};

/**
 * 创建角色映射对象（name -> RoleDTO）
 */
export const createRoleMap = (roles: RoleDTO[]): Record<string, RoleDTO> => {
    return roles.reduce(
        (map, role) => {
            if (role.name) {
                map[role.name] = role;
            }
            return map;
        },
        {} as Record<string, RoleDTO>,
    );
};
