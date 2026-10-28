import type { DecorationLayers } from "@shared/lib/decoration-preference";
import { useRouteContext } from "@tanstack/react-router";

/** 从根路由读取独立的装饰分层开关。 */
export function useDecorationLayers(): DecorationLayers {
	return useRouteContext({ from: "__root__" }).decorationLayers;
}
