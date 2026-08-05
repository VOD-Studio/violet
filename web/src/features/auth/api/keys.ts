/**
 * authKeys - auth 模块 query key 工厂
 *
 * 用工厂模式集中管理 key，避免散落字符串导致缓存失效不彻底。
 * 包含 me 与 csrf-token 维度；写操作通过 invalidate/remove 触发对应缓存刷新。
 */
export const authKeys = {
	/** auth 模块根 key */
	all: ["auth"] as const,
	/** 当前登录用户维度 */
	me: () => [...authKeys.all, "me"] as const,
	/** CSRF token 维度，useCsrfToken 使用，登出时清除避免陈旧 token */
	csrfToken: () => [...authKeys.all, "csrf-token"] as const,
};
