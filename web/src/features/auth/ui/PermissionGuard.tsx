import type { ReactNode } from "react";
import {
	useHasAllPermissions,
	useHasAnyPermission,
	useHasPermission,
} from "../hooks/usePermissions";

/**
 * PermissionGuardProps - 权限守卫组件属性
 */
export interface PermissionGuardProps {
	/** 单个权限码或权限码数组 */
	permission: string | string[];
	/** 多个权限时是否需要全部满足（默认 false，满足任一即可） */
	requireAll?: boolean;
	/** 无权限时显示的内容（可选） */
	fallback?: ReactNode;
	/** 有权限时渲染的内容 */
	children: ReactNode;
}

/**
 * PermissionGuard - 权限守卫组件
 *
 * 根据用户权限决定是否渲染子组件。支持单个或多个权限检查，
 * 多个权限时可配置是否需要全部满足。
 *
 * 用法示例：
 * ```tsx
 * // 单个权限
 * <PermissionGuard permission="admin:access">
 *   <AdminPanel />
 * </PermissionGuard>
 *
 * // 多个权限（满足任一）
 * <PermissionGuard permission={["post:edit", "post:delete"]}>
 *   <EditButton />
 * </PermissionGuard>
 *
 * // 多个权限（需要全部满足）
 * <PermissionGuard permission={["post:edit", "post:publish"]} requireAll>
 *   <PublishButton />
 * </PermissionGuard>
 *
 * // 无权限时显示提示
 * <PermissionGuard permission="vip:access" fallback={<UpgradePrompt />}>
 *   <VipContent />
 * </PermissionGuard>
 * ```
 */
export function PermissionGuard({
	permission,
	requireAll = false,
	fallback = null,
	children,
}: PermissionGuardProps) {
	// 单个权限检查
	const hasSinglePermission = useHasPermission(typeof permission === "string" ? permission : "");

	// 多个权限检查（满足任一）
	const hasAnyPermission = useHasAnyPermission(Array.isArray(permission) ? permission : []);

	// 多个权限检查（需要全部满足）
	const hasAllPermissions = useHasAllPermissions(Array.isArray(permission) ? permission : []);

	// 确定是否有权限
	let hasPermission = false;

	if (typeof permission === "string") {
		// 单个权限
		hasPermission = hasSinglePermission;
	} else if (Array.isArray(permission)) {
		// 多个权限
		hasPermission = requireAll ? hasAllPermissions : hasAnyPermission;
	}

	// 有权限时渲染 children，无权限时渲染 fallback
	return hasPermission ? children : fallback;
}
