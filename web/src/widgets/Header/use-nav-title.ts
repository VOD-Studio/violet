import { useRouterState } from "@tanstack/react-router";

/**
 * 详情页声明的导航标题，取最深命中路由的 `staticData.navTitle(loaderData)`。
 *
 * 返回 `path`（该路由实际命中的路径）供调用方校验：导航进行中 `location` 先于 `matches` 更新，
 * 标题只对仍在渲染的那一页有效。
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
