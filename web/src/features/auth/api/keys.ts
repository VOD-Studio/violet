/**
 * authKeys - auth 模块 query key 工厂
 *
 * 用工厂模式集中管理 key，避免散落字符串导致缓存失效不彻底。
 * 目前只有 me 维度；写操作通过 invalidate me 触发当前用户信息刷新。
 */
export const authKeys = {
	/** auth 模块根 key */
	all: ["auth"] as const,
	/** 当前登录用户维度 */
	me: () => [...authKeys.all, "me"] as const,
};
