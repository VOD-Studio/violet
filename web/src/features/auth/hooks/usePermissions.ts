import { useMe } from "../api/queries";

/**
 * useHasPermission - 检查当前用户是否拥有指定权限
 *
 * @param code 权限码（如 "admin:access"）
 * @returns 是否拥有该权限
 */
export function useHasPermission(code: string): boolean {
	const { data: user } = useMe({ enabled: true });

	if (!user) {
		return false;
	}

	// 内置超级管理员拥有通配符权限（所有权限），避免后端权限数组短暂缺失时隐藏全部操作。
	if (user.is_builtin_super_admin) {
		return true;
	}

	return user.permissions?.includes(code) ?? false;
}

/**
 * useHasAnyPermission - 检查当前用户是否拥有任一指定权限
 *
 * @param codes 权限码数组
 * @returns 是否拥有其中任一权限
 */
export function useHasAnyPermission(codes: string[]): boolean {
	const { data: user } = useMe({ enabled: true });

	if (!user) {
		return false;
	}

	if (user.is_builtin_super_admin) {
		return true;
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

	if (!user) {
		return false;
	}

	if (user.is_builtin_super_admin) {
		return true;
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
 * 注意：内置超管和被委派超管都是 superadmin 角色。
 * 若需区分"内置超管"（通配符权限、可授权他人），请用 useIsBuiltinSuperAdmin。
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

/**
 * useIsBuiltinSuperAdmin - 检查当前用户是否为内置超级管理员
 *
 * 内置超管拥有通配符权限、可授权他人当超管、不可被任何人降级/删除。
 * 被委派超管虽为 superadmin 角色，但本 hook 返回 false。
 *
 * @returns 是否为内置超级管理员
 */
export function useIsBuiltinSuperAdmin(): boolean {
	const { data: user } = useMe({ enabled: true });

	if (!user) {
		return false;
	}

	return user.is_builtin_super_admin === true;
}
