import type { MediaCatalogQuery } from "../model/types";

/** 素材目录 query key 工厂。 */
export const mediaCatalogKeys = {
	/** 模块根 */
	all: ["admin-media"] as const,
	/** 列表维度 */
	lists: () => [...mediaCatalogKeys.all, "list"] as const,
	/** 具体列表查询 */
	list: (query: MediaCatalogQuery) => [...mediaCatalogKeys.lists(), query] as const,
	/** 当前用户自己的素材列表 */
	ownedList: (query: MediaCatalogQuery) =>
		[...mediaCatalogKeys.all, "owned-list", query] as const,
	/** 无限滚动列表查询 */
	infinite: (query: Omit<MediaCatalogQuery, "page">) =>
		[...mediaCatalogKeys.lists(), "infinite", query] as const,
};
