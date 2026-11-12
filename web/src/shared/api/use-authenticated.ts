import { useSessionStore } from "./session";

/**
 * UI 判断「是否已登录」的统一口径，登录态差异会改变渲染结构的地方（如导航里的聊天入口）用它。
 *
 * 会话标记从未变动过（`sessionVersion` 为 0，即首渲染与水合）时取 SSR 登录态，保证首帧一致；
 * 之后以响应式会话标记为准，登录与登出立即生效，不必等根路由上下文刷新。
 *
 * @param ssrAuthenticated - 根路由上下文里 SSR 已知的登录态
 */
export function useAuthenticated(ssrAuthenticated: boolean): boolean {
	const sessionActive = useSessionStore((state) => state.sessionActive);
	const touched = useSessionStore((state) => state.sessionVersion > 0);
	return touched ? sessionActive : ssrAuthenticated;
}
