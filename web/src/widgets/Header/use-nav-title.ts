import { useRouterState } from "@tanstack/react-router";

/**
 * 读取最深命中路由的导航标题。
 *
 * @returns 标题及其匹配路径；无标题时为 null。导航期间 location 可能先于 matches 更新，
 * 调用方须用 path 确认标题仍属于当前页面。
 */
export function useNavTitle(): { path: string; title: string } | null {
	const path = useRouterState({ select: (state) => state.matches.at(-1)?.pathname });
	const title = useRouterState({
		select: (state) => {
			const leaf = state.matches.at(-1);
			return leaf?.staticData.navTitle?.(leaf.loaderData as never)?.trim() || null;
		},
	});
	return path !== undefined && title ? { path, title } : null;
}
