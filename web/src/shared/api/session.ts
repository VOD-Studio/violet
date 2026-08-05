import { create } from "zustand";

/**
 * session - client 侧「曾登录且未主动登出」的响应式状态（Zustand 单例）
 *
 * 解决守卫把"token 过期的瞬态网络失败"误判为"未登录"而踢人的问题，
 * 同时让 UI（Header）能在登录/登出瞬间响应式刷新，无需依赖静态的 context.auth。
 *
 * 与 context.auth / React Query me 缓存的区别：
 * - context.auth：SSR 时通过 /auth/session 只读探活算一次，客户端导航时由
 *   getAuthSession 重算；不因网络瞬态失败翻 false，且登录/登出后不会立即变。
 * - me 缓存：业务请求驱动，401 时直接失败，不会立即翻 undefined。
 * - sessionActive（本模块）：**只在登录成功置 true、登出/取消重登置 false**，
 *   不受任何网络瞬态失败影响，且是响应式的（Zustand）——订阅者（Header、守卫
 *   在客户端）能立即感知。
 *
 * 守卫新逻辑：未登录踢人 = (网络判定未登录) && (!sessionActive)。
 * 即 session 过期（sessionActive 仍 true）时不踢——交给 401 弹窗机制原地恢复。
 *
 * 仅客户端有意义；isSessionActive() 在 SSR 返回 false（守卫在 SSR 用 context.auth）。
 */
interface SessionState {
	/** 当前客户端是否处于"已登录且未登出"状态 */
	sessionActive: boolean;
	/** 标记已登录（登录成功时调用） */
	markSessionActive: () => void;
	/** 标记已登出（登出/取消重登时调用） */
	clearSessionActive: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
	// SSR 阶段默认 false；客户端 hydrate 后若已登录，__root.beforeLoad 会读到 SSR 的
	// context.auth.isAuthenticated 并在客户端 mount 时通过 markSessionActive 校正（见 __root.tsx）。
	sessionActive: false,
	markSessionActive: () => set({ sessionActive: true }),
	clearSessionActive: () => set({ sessionActive: false }),
}));

/**
 * isSessionActive - 非响应式读取，供守卫 beforeLoad（非组件）使用
 *
 * 守卫在 beforeLoad 里无法用 hook，故提供命令式 getter。
 * SSR 永远返回 false——SSR 阶段守卫只认 context.auth。
 */
export const isSessionActive = (): boolean => {
	if (typeof window === "undefined") return false;
	return useSessionStore.getState().sessionActive;
};

/**
 * markSessionActive / clearSessionActive - 命令式 setter，供非组件代码（mutations、authGate）使用
 */
export const markSessionActive = (): void => useSessionStore.getState().markSessionActive();
export const clearSessionActive = (): void => useSessionStore.getState().clearSessionActive();
