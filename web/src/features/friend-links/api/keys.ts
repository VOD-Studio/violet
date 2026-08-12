import { friendLinkKeys } from "@features/admin-friend-links/api/keys";

/**
 * friendLinkPublicKeys - 前台公开友链缓存键
 *
 * 复用 admin-friend-links 暴露的 friendLinkKeys.all（共享根维度
 * ["friend-links"]），公开列表挂在 "public" 子键下：
 *
 *   public list  → ["friend-links", "public", "list"]
 *   admin lists  → ["friend-links", "admin", "list"]
 *   pending count → ["friend-links", "pending-count"]
 *
 * 后台 invalidate 只清 admin 子键，不会误清前台公开缓存。
 */
export const friendLinkPublicKeys = {
	/** 公开列表维度（无参数——公开列表不接受筛选/分页） */
	list: () => [...friendLinkKeys.all, "public", "list"] as const,
};
