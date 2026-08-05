/**
 * 导航方向感知 — 根据 from/to 路径推断"前进"或"后退"
 *
 * 按 URL 首段映射到导航顺序（NAV_ORDER），序号增大为 forward，减小为 back。
 * 同段内导航（如 /blog → /blog/$slug）返回 null，回退到简单淡入淡出。
 *
 * 被 TanStack Router 的 defaultViewTransition.types 回调消费，
 * 返回的方向字符串直接作为 VT type，CSS 用 :active-view-transition-type() 匹配。
 */

/** 前台一级路由的导航顺序（值越小越靠左） */
const NAV_ORDER: Record<string, number> = {
	"": 0, // /
	blog: 1, // /blog、/blog/$slug、/blog/archive
	projects: 2,
	about: 3,
};

/** 取路径的首段作为 section key */
function segmentFor(pathname: string): string {
	const parts = pathname.split("/").filter(Boolean);
	return parts[0] ?? "";
}

export type NavDirection = "forward" | "back";

/**
 * 比较两个路径的导航方向
 *
 * @returns "forward" | "back" | null（同段或未知段返回 null）
 */
export function getNavDirection(from?: string, to?: string): NavDirection | null {
	if (!from || !to) return null;

	const fromSeg = segmentFor(from);
	const toSeg = segmentFor(to);

	const fromIdx = NAV_ORDER[fromSeg];
	const toIdx = NAV_ORDER[toSeg];

	if (fromIdx === undefined || toIdx === undefined) return null;
	if (fromIdx === toIdx) return null;

	return toIdx > fromIdx ? "forward" : "back";
}

/**
 * 判断路径是否属于后台路由
 */
export function isAdminRoute(pathname: string): boolean {
	return pathname.startsWith("/admin");
}
