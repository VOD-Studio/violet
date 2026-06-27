import { useMe } from "../api/queries";

/**
 * useHasPermission - 检查当前用户是否拥有指定权限
 *
 * @param code 权限码（如 "admin:access"）
 * @returns 是否拥有该权限
 */
export function useHasPermission(code: string): boolean {
    const { data: user } = useMe({ enabled: true });

    // 未登录或无权限数据时返回 false
    if (!user?.permissions) {
        return false;
    }

    return user.permissions.includes(code);
}

/**
 * useHasAnyPermission - 检查当前用户是否拥有任一指定权限
 *
 * @param codes 权限码数组
 * @returns 是否拥有其中任一权限
 */
export function useHasAnyPermission(codes: string[]): boolean {
    const { data: user } = useMe({ enabled: true });

    // 未登录或无权限数据时返回 false
    if (!user?.permissions) {
        return false;
    }

    return codes.some((code) => user.permissions?.includes(code));
}

/**
 * useHasAllPermissions - 检查当前用户是否拥有所有指定权限
 *
 * @param codes 权限码数组
 * @returns 是否拥有所有权限
 */
export function useHasAllPermissions(codes: string[]): boolean {
    const { data: user } = useMe({ enabled: true });

    // 未登录或无权限数据时返回 false
    if (!user?.permissions) {
        return false;
    }

    return codes.every((code) => user.permissions?.includes(code));
}

/**
 * useIsAdmin - 检查当前用户是否为管理员（admin 或 superadmin）
 *
 * @returns 是否为管理员
 */
export function useIsAdmin(): boolean {
    const { data: user } = useMe({ enabled: true });

    if (!user) {
        return false;
    }

    return user.role === "admin" || user.role === "superadmin";
}

/**
 * useIsSuperAdmin - 检查当前用户是否为超级管理员
 *
 * @returns 是否为超级管理员
 */
export function useIsSuperAdmin(): boolean {
    const { data: user } = useMe({ enabled: true });

    if (!user) {
        return false;
    }

    return user.role === "superadmin";
}
