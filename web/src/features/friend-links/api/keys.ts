import { friendLinkKeys } from "@features/admin-friend-links/api/keys";
import type { FriendLinkPublicQuery } from "../model/types";

/** 公开分页与管理列表共用失效根键，查询参数隔离每一页的快照。 */
export const friendLinkPublicKeys = {
	list: (query: FriendLinkPublicQuery) =>
		[...friendLinkKeys.all, "public", "list", query] as const,
};
