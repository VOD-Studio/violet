import type { FriendLinkListQuery } from "../model/types";

/**
 * friendLinkKeys - 友链 query key 工厂
 *
 * 根维度 "friend-links" 与将来的前台公开列表（F3）共享：
 * 后台维度挂在 admin 子键下，审核操作失效后台列表 + pending 计数，
 * 不波及将来的公开缓存键。
 */
export const friendLinkKeys = {
	/** 模块根 */
	all: ["friend-links"] as const,
	/** 后台列表维度（按状态筛选） */
	adminLists: () => [...friendLinkKeys.all, "admin", "list"] as const,
	/** 具体后台列表查询（按状态 + 分页） */
	adminList: (query: FriendLinkListQuery) => [...friendLinkKeys.adminLists(), query] as const,
	/** 待审核数量（后台菜单角标） */
	pendingCount: () => [...friendLinkKeys.all, "pending-count"] as const,
};
