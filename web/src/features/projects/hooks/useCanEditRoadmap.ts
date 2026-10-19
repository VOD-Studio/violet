import { useHasPermission } from "@features/auth/hooks/usePermissions";
import { useHydrated } from "@tanstack/react-router";

/**
 * 当前用户能否编辑路线图（project:update）。
 *
 * 水合完成之前一律为 false：服务端渲染时可能已经知道权限、客户端首帧却还没有，
 * 两边渲染出可编辑与只读两种看板会造成水合不一致。挂载之后再按权限打开编辑。
 */
export function useCanEditRoadmap(): boolean {
	const hydrated = useHydrated();
	const permitted = useHasPermission("project:update");
	return hydrated && permitted;
}
