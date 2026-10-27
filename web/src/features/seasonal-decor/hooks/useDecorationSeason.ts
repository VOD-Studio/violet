import { resolveDecoration } from "@shared/lib/decoration-preference";
import type { Season } from "@shared/lib/theme-preference";
import { useRouteContext } from "@tanstack/react-router";

/**
 * 实际投放的季节装饰；null 表示不显示。
 *
 * 主题或装饰偏好切换后路由上下文刷新，装饰随之更新。
 */
export function useDecorationSeason(): Season | null {
	const { theme, decoration } = useRouteContext({ from: "__root__" });
	return resolveDecoration(decoration, theme);
}
